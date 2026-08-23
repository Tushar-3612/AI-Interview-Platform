import Interview from "../models/Interview.js";
import InterviewQuestion from "../models/InterviewQuestion.js";
import Answer from "../models/Answer.js";
import CodingSubmission from "../models/CodingSubmission.js";
import { aiGenerateJSON } from "./ai/aiClient.js";
import {
  buildResumeProjectGenerationPrompt,
  buildResumeProjectEvaluationPrompt,
  buildTechnicalGenerationPrompt,
  buildTechnicalEvaluationPrompt,
  buildCodingGenerationPrompt,
  buildCodingEvaluationPrompt,
  buildHRGenerationPrompt,
  buildHREvaluationPrompt,
} from "./ai/aiPrompts.js";
import { generateAptitudeQuestions } from "./roundGenerators.js";

/* ======================================================================
   NEW ARCHITECTURE — 4 independent AI rounds (8 AI calls total)
   Aptitude is LOCAL (no AI). Each AI round = 1 generation + 1 evaluation.
   Generation/evaluation are LAZY (triggered when student enters/completes
   a round) and IDEMPOTENT (persisted; reused on refresh / re-entry).
   ====================================================================== */

export const ROUND_META = {
  resume_project: { label: "Resume / Project", count: 10, kind: "verbal", ai: true },
  technical: { label: "Technical", count: 20, kind: "mcq", ai: true },
  coding: { label: "Coding", count: 3, kind: "coding", ai: true },
  hr: { label: "HR", count: 5, kind: "verbal", ai: true },
  aptitude: { label: "Aptitude", count: 25, kind: "aptitude", ai: false },
};

const AI_ROUNDS = ["resume_project", "technical", "coding", "hr"];
export const TOTAL_QUESTIONS =
  ROUND_META.aptitude.count +
  ROUND_META.resume_project.count +
  ROUND_META.technical.count +
  ROUND_META.coding.count +
  ROUND_META.hr.count;

const GENERATION_PROMPTS = {
  resume_project: buildResumeProjectGenerationPrompt,
  technical: buildTechnicalGenerationPrompt,
  coding: buildCodingGenerationPrompt,
  hr: buildHRGenerationPrompt,
};

const EVALUATION_PROMPTS = {
  resume_project: buildResumeProjectEvaluationPrompt,
  technical: buildTechnicalEvaluationPrompt,
  coding: buildCodingEvaluationPrompt,
  hr: buildHREvaluationPrompt,
};

function normRound(r) {
  return String(r || "").toLowerCase();
}

function cloneRoundProgress(progress = {}) {
  return { ...progress };
}

async function setRoundProgress(interview, round, status, extra = {}) {
  interview.roundsProgress = cloneRoundProgress(interview.roundsProgress);
  interview.roundsProgress[round] = status;
  if (extra.generatedAt) {
    interview.roundGeneratedAt = { ...(interview.roundGeneratedAt || {}), [round]: extra.generatedAt };
  }
  if (extra.evaluatedAt) {
    interview.roundEvaluatedAt = { ...(interview.roundEvaluatedAt || {}), [round]: extra.evaluatedAt };
  }
}

function sanitizeForClient(questions, round) {
  const r = normRound(round);
  return (questions || []).map((q) => {
    const c = { ...q };
    if (r === "technical") {
      // correctAnswer must NEVER be sent to the frontend.
      delete c.correctAnswer;
      delete c.explanation;
    }
    return c;
  });
}

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/* -------------------- GENERATION -------------------- */

function normalizeGenerated(round, raw, count) {
  const list = Array.isArray(raw) ? raw : [];
  const items = list.slice(0, count);
  const r = normRound(round);
  const prefix = r === "coding" ? "CODE" : r === "technical" ? "TECH" : r === "hr" ? "HR" : "RESUME";

  return items.map((item, idx) => {
    const qid = `${prefix}-AI-${String(idx + 1).padStart(2, "0")}`;
    const base = {
      id: qid,
      questionId: qid,
      questionNumber: idx + 1,
      order: idx + 1,
      round: r,
      section: r.toUpperCase(),
      category: r,
      source: "ai",
      difficulty: ["easy", "medium", "hard"].includes(String(item.difficulty).toLowerCase())
        ? String(item.difficulty).toLowerCase()
        : "medium",
      topic: item.topic || "General",
      aiSpeechText: item.question || item.description || "",
    };

    if (r === "technical") {
      const options = Array.isArray(item.options) ? item.options.slice(0, 4) : [];
      return {
        ...base,
        type: "technical",
        questionType: "technical",
        skill: item.topic || "Technical",
        question: String(item.question || "").trim(),
        options,
        correctAnswer: String(item.correctAnswer || "").trim(),
        explanation: String(item.explanation || "").trim(),
      };
    }
    if (r === "coding") {
      return {
        ...base,
        type: "coding",
        questionType: "coding",
        title: String(item.title || "").trim(),
        question: String(item.description || item.title || "").trim(),
        description: String(item.description || "").trim(),
        problemStatement: String(item.description || "").trim(),
        constraints: String(item.constraints || "").trim(),
        examples: Array.isArray(item.examples) ? item.examples : [],
        testCases: Array.isArray(item.testCases) ? item.testCases : [],
        expectedApproach: String(item.expectedApproach || "").trim(),
        languageOptions: Array.isArray(item.languageOptions) && item.languageOptions.length
          ? item.languageOptions
          : ["Python", "Java", "C++", "C", "JavaScript"],
      };
    }
    // verbal (resume_project / hr)
    return {
      ...base,
      type: r,
      questionType: r,
      skill: item.topic || "General",
      question: String(item.question || "").trim(),
    };
  });
}

export async function generateRoundQuestions({ interviewId, userId, round }) {
  const r = normRound(round);
  if (!AI_ROUNDS.includes(r)) {
    const e = new Error(`Invalid AI round: ${round}`);
    e.status = 400;
    throw e;
  }
  const meta = ROUND_META[r];

  const interview = await Interview.findOne({ _id: interviewId, userId });
  if (!interview) {
    const e = new Error("Interview session not found");
    e.status = 404;
    throw e;
  }
  if (interview.status !== "in_progress") {
    const e = new Error("Interview is not in progress");
    e.status = 400;
    throw e;
  }

  // Idempotency: reuse already-generated questions.
  const existing = await InterviewQuestion.find({ interviewId, round: r }).lean();
  if (existing.length >= meta.count) {
    await setRoundProgress(interview, r, "READY", { generatedAt: interview.roundGeneratedAt?.[r] });
    await interview.save();
    return { round: r, generated: false, count: existing.length, questions: sanitizeForClient(existing, r) };
  }

  await setRoundProgress(interview, r, "GENERATING");
  await interview.save();

  try {
    const profile = interview.candidateProfile || {};
    const prompt = GENERATION_PROMPTS[r](profile, meta.count);
    const data = await aiGenerateJSON(prompt, { temperature: 0.7 });
    const raw = (data && Array.isArray(data.questions) ? data.questions : []).filter(
      (q) => q && (q.question || q.description || q.title)
    );
    if (raw.length < meta.count) {
      throw new Error(`AI returned only ${raw.length} of ${meta.count} ${r} questions`);
    }
    const normalized = normalizeGenerated(r, raw, meta.count);
    const docs = normalized.map((q) => ({ ...q, interviewId, userId }));
    await InterviewQuestion.insertMany(docs);

    await setRoundProgress(interview, r, "READY", { generatedAt: new Date() });
    await interview.save();

    return { round: r, generated: true, count: docs.length, questions: sanitizeForClient(docs, r) };
  } catch (err) {
    await setRoundProgress(interview, r, "FAILED");
    await interview.save();
    const wrapped = new Error(err.message || "Generation failed");
    wrapped.errorType = err.errorType || "AI_GENERATION_FAILED";
    wrapped.status = err.status || 502;
    throw wrapped;
  }
}

/* -------------------- EVALUATION -------------------- */

function normalizeEvaluation(round, raw) {
  const r = normRound(round);
  const out = {
    round: r,
    score: num(raw?.score, 0),
    percentage: num(raw?.percentage, raw?.score ?? 0),
    strengths: Array.isArray(raw?.strengths) ? raw.strengths : [],
    weaknesses: Array.isArray(raw?.weaknesses) ? raw.weaknesses : [],
    recommendations: Array.isArray(raw?.recommendations) ? raw.recommendations : [],
  };
  if (r === "technical") {
    out.correctCount = num(raw?.correctCount, 0);
    out.incorrectCount = num(raw?.incorrectCount, 0);
    out.skippedCount = num(raw?.skippedCount, 0);
    out.topicPerformance = raw?.topicPerformance || {};
    out.questionEvaluations = Array.isArray(raw?.questionEvaluations) ? raw.questionEvaluations : [];
  } else if (r === "coding") {
    out.problemEvaluations = Array.isArray(raw?.problemEvaluations) ? raw.problemEvaluations : [];
  } else {
    out.questionEvaluations = Array.isArray(raw?.questionEvaluations) ? raw.questionEvaluations : [];
  }
  return out;
}

export async function evaluateRound({ interviewId, userId, round }) {
  const r = normRound(round);
  if (!AI_ROUNDS.includes(r)) {
    const e = new Error(`Invalid AI round: ${round}`);
    e.status = 400;
    throw e;
  }

  const interview = await Interview.findOne({ _id: interviewId, userId });
  if (!interview) {
    const e = new Error("Interview session not found");
    e.status = 404;
    throw e;
  }

  // Idempotency: reuse existing evaluation.
  const existingEval = interview.sectionEvaluations?.[r];
  if (existingEval && typeof existingEval.score === "number") {
    return { round: r, evaluated: false, evaluation: existingEval };
  }

  const questions = await InterviewQuestion.find({ interviewId, round: r }).lean();
  if (!questions.length) {
    const e = new Error(`No questions found for ${r} round`);
    e.status = 400;
    throw e;
  }

  let evalInput;
  if (r === "technical") {
    const answers = await Answer.find({ interviewId, questionType: "technical" }).lean();
    evalInput = {
      questions,
      answers: answers.map((a) => ({ questionId: a.questionId, answer: a.answer })),
    };
  } else if (r === "coding") {
    const subs = await CodingSubmission.find({ interviewId }).lean();
    evalInput = {
      questions,
      submissions: subs.map((s) => ({
        questionId: s.questionId,
        code: s.code,
        language: s.language,
        passedTests: s.passedCount,
        totalTests: s.totalCount,
      })),
    };
  } else {
    const answers = await Answer.find({ interviewId, questionType: r }).lean();
    evalInput = {
      questions,
      answers: answers.map((a) => ({ questionId: a.questionId, answer: a.answer })),
    };
  }

  try {
    const prompt = EVALUATION_PROMPTS[r](interview.candidateProfile || {}, evalInput.questions, evalInput.answers || evalInput.submissions);
    const rawEval = await aiGenerateJSON(prompt, { temperature: 0.3 });
    const normalized = normalizeEvaluation(r, rawEval);

    interview.sectionEvaluations = { ...(interview.sectionEvaluations || {}), [r]: normalized };
    await setRoundProgress(interview, r, "COMPLETED", { evaluatedAt: new Date() });
    await interview.save();

    return { round: r, evaluated: true, evaluation: normalized };
  } catch (err) {
    const wrapped = new Error(err.message || "Evaluation failed");
    wrapped.errorType = err.errorType || "AI_EVALUATION_FAILED";
    wrapped.status = err.status || 502;
    throw wrapped;
  }
}

/* -------------------- FINAL AGGREGATION (NO AI) -------------------- */

export function computeOverallFromSections(interview) {
  const evals = interview.sectionEvaluations || {};
  const aiRounds = ["resume_project", "technical", "coding", "hr"];
  const available = aiRounds.filter((r) => evals[r] && typeof evals[r].score === "number");

  if (available.length === 0) {
    return { overallScore: 0, sections: {}, completed: false };
  }

  const total = available.reduce((sum, r) => sum + num(evals[r].score, 0), 0);
  const overallScore = Math.round(total / available.length);

  return {
    overallScore,
    completed: available.length === aiRounds.length,
    sections: Object.fromEntries(available.map((r) => [r, num(evals[r].score, 0)])),
  };
}

export { AI_ROUNDS };
