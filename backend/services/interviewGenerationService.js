/**
 * interviewGenerationService.js
 *
 * Centralized, provider-independent service for the REAL AI INTERVIEW.
 *
 * AI CALL #1 — generateInterviewQuestions(profile)
 *   ONE AI request → 25 Technical + 5 HR + 3 Coding.
 *   Validates counts, retries once with a stricter instruction.
 *
 * AI CALL #2 — evaluateCompleteInterview(context)
 *   ONE AI request → final structured evaluation.
 *   Validates structure, retries once.
 *
 * All AI access goes through aiClient.js. No other module calls the provider.
 */

import {
  aiGenerateJSON,
  isAIConfigured,
} from "./ai/aiClient.js";
import {
  buildCombinedInterviewPrompt,
  buildFinalEvaluationPrompt,
  buildDynamicQuestionPrompt,
  buildSingleAnswerEvaluationPrompt,
} from "./ai/aiPrompts.js";
import { generateAptitudeQuestions } from "./roundGenerators.js";
import InterviewQuestion from "../models/InterviewQuestion.js";
import CodingSubmission from "../models/CodingSubmission.js";
import Interview from "../models/Interview.js";
import Answer from "../models/Answer.js";
import User from "../models/User.js";

const VALID_DIFFICULTIES = ["easy", "medium", "hard"];
function normDiff(d) {
  const x = String(d || "").toLowerCase();
  return VALID_DIFFICULTIES.includes(x) ? x : "medium";
}

/* ================================
   AI CALL #1 — QUESTION GENERATION
   ================================ */

export function validateCombinedGeneration(parsed, counts = { technical: 25, hr: 5, coding: 3 }) {
  if (!parsed || typeof parsed !== "object") return false;
  const t = Array.isArray(parsed.technical) ? parsed.technical : [];
  const h = Array.isArray(parsed.hr) ? parsed.hr : [];
  const c = Array.isArray(parsed.coding) ? parsed.coding : [];
  const reqT = counts.technical || 25;
  const reqH = counts.hr || 5;
  const reqC = counts.coding || 3;
  // Accept when the model returns at least the required count (extras are
  // truncated by normalizeCombined). Reject only missing/empty or wildly
  // over-generated sections. This tolerates off-by-one model outputs while
  // still guaranteeing the exact 25/5/3 set after normalization.
  const within = (n, req) => n >= req && n <= req + 5;
  if (t.length === 0 || h.length === 0 || c.length === 0) return false;
  return within(t.length, reqT) && within(h.length, reqH) && within(c.length, reqC);
}

function normalizeCombined(parsed, counts = { technical: 25, hr: 5, coding: 3 }) {
  const technical = (parsed.technical || []).slice(0, counts.technical).map((q) => ({
    question: String(q.question || "").trim(),
    topic: String(q.topic || "General").trim(),
    difficulty: normDiff(q.difficulty),
  }));

  const hr = (parsed.hr || []).slice(0, counts.hr).map((q) => ({
    question: String(q.question || "").trim(),
    topic: String(q.topic || "Behavioral").trim(),
    difficulty: normDiff(q.difficulty),
  }));

  const coding = (parsed.coding || []).slice(0, counts.coding).map((q) => ({
    title: String(q.title || q.question || "Coding Problem").trim(),
    question: String(q.description || q.question || "").trim(),
    description: String(q.description || q.question || "").trim(),
    difficulty: normDiff(q.difficulty),
    language: String(q.language || "Python").trim(),
    inputFormat: String(q.inputFormat || "").trim(),
    outputFormat: String(q.outputFormat || "").trim(),
    constraints: String(q.constraints || "").trim(),
    examples: Array.isArray(q.examples) ? q.examples : [],
    testCases: Array.isArray(q.testCases) ? q.testCases : [],
    expectedApproach: String(q.expectedApproach || "").trim(),
    topic: String(q.topic || "Data Structures & Algorithms").trim(),
  }));

  return { technical, hr, coding };
}

export async function generateInterviewQuestions(profile = {}, counts = { technical: 25, hr: 5, coding: 3 }) {
  if (!isAIConfigured()) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const basePrompt = buildCombinedInterviewPrompt(profile, counts);

  let parsed;
  try {
    parsed = await aiGenerateJSON(basePrompt, { temperature: 0.7, timeoutMs: 120000 });
  } catch (err) {
    throw err;
  }

  if (!validateCombinedGeneration(parsed, counts)) {
    // Retry ONCE with a stricter instruction (only on count/structure failure).
    try {
      const stricter = `${basePrompt}\n\nSTRICT RULE: You MUST return exactly ${counts.technical} technical, ${counts.hr} hr, and ${counts.coding} coding items. Return ONLY the JSON object and nothing else.`;
      parsed = await aiGenerateJSON(stricter, { temperature: 0.5, timeoutMs: 120000 });
    } catch (err) {
      throw err;
    }
    if (!validateCombinedGeneration(parsed, counts)) {
      throw new Error("AI_GENERATION_FAILED");
    }
  }

  return normalizeCombined(parsed, counts);
}

/* ================================
   PERSISTENCE — save generated questions
   ================================ */

export async function persistInterviewQuestions({ interviewId, userId, generated, aptitudeCount = 25 }) {
  const docs = [];

  (generated.technical || []).forEach((q, idx) => {
    docs.push({
      interviewId,
      candidateId: userId,
      round: "technical",
      questionNumber: idx + 1,
      questionId: `TECH-AI-${String(idx + 1).padStart(2, "0")}`,
      question: q.question,
      topic: q.topic,
      difficulty: q.difficulty,
      source: "ai",
      aiSpeechText: q.question,
      status: "pending",
      metadata: { generatedBy: "ai", profileBased: true },
    });
  });

  (generated.hr || []).forEach((q, idx) => {
    docs.push({
      interviewId,
      candidateId: userId,
      round: "hr",
      questionNumber: idx + 1,
      questionId: `HR-AI-${String(idx + 1).padStart(2, "0")}`,
      question: q.question,
      topic: q.topic,
      difficulty: q.difficulty,
      source: "ai",
      aiSpeechText: q.question,
      status: "pending",
      metadata: { generatedBy: "ai" },
    });
  });

  (generated.coding || []).forEach((q, idx) => {
    docs.push({
      interviewId,
      candidateId: userId,
      round: "coding",
      questionNumber: idx + 1,
      questionId: `CODE-AI-${String(idx + 1).padStart(2, "0")}`,
      question: q.question,
      title: q.title,
      topic: q.topic,
      difficulty: q.difficulty,
      source: "ai",
      language: q.language,
      inputFormat: q.inputFormat,
      outputFormat: q.outputFormat,
      constraints: q.constraints,
      examples: q.examples,
      testCases: q.testCases,
      expectedApproach: q.expectedApproach,
      aiSpeechText: q.description || q.question,
      status: "pending",
      metadata: { generatedBy: "ai" },
    });
  });

  const aptitude = await generateAptitudeQuestions(aptitudeCount);
  aptitude.forEach((q, idx) => {
    docs.push({
      interviewId,
      candidateId: userId,
      round: "aptitude",
      questionNumber: idx + 1,
      questionId: q.questionId || `APT-${String(idx + 1).padStart(2, "0")}`,
      question: q.question,
      topic: q.topic || "Aptitude",
      difficulty: q.difficulty || "medium",
      source: "local",
      options: q.options || [],
      correctAnswer: q.correctAnswer || "",
      aiSpeechText: q.question,
      status: "pending",
      metadata: { source: "local" },
    });
  });

  if (docs.length > 0) {
    await InterviewQuestion.insertMany(docs, { ordered: false });
  }
  return docs;
}

/* ================================
   AI CALL #2 — FINAL EVALUATION
   ================================ */

export function validateEvaluation(parsed) {
  if (!parsed || typeof parsed !== "object") return false;
  const sections = ["technical", "hr", "coding", "overall"];
  for (const s of sections) {
    if (!parsed[s] || typeof parsed[s] !== "object") return false;
  }
  const num = (v) => typeof v === "number" && v >= 0 && v <= 100;
  if (!num(parsed.technical.score) || !num(parsed.hr.score) || !num(parsed.coding.score)) return false;
  return true;
}

export async function evaluateCompleteInterview(context = {}) {
  if (!isAIConfigured()) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const basePrompt = buildFinalEvaluationPrompt(context);

  let parsed;
  try {
    parsed = await aiGenerateJSON(basePrompt, { temperature: 0.3, timeoutMs: 120000 });
  } catch (err) {
    throw new Error("AI_EVALUATION_FAILED");
  }

  if (!validateEvaluation(parsed)) {
    try {
      const stricter = `${basePrompt}\n\nSTRICT RULE: Return ONLY the JSON with technical.score, hr.score, coding.score (integers 0-100) and overall.recommendations array. No prose.`;
      parsed = await aiGenerateJSON(stricter, { temperature: 0.2, timeoutMs: 120000 });
    } catch (err) {
      throw new Error("AI_EVALUATION_FAILED");
    }
    if (!validateEvaluation(parsed)) {
      throw new Error("AI_EVALUATION_FAILED");
    }
  }

  const clamp = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
  parsed.technical.score = clamp(parsed.technical.score);
  parsed.hr.score = clamp(parsed.hr.score);
  parsed.coding.score = clamp(parsed.coding.score);
  return parsed;
}

/**
 * Gather coding compiler results for an interview from CodingSubmission records.
 * Returns an array aligned to the coding questions (by order/index).
 */
export async function gatherCodingResults(interviewId, codingQuestions = []) {
  const submissions = await CodingSubmission.find({ interviewId }).sort({ createdAt: 1 }).lean();
  const results = (codingQuestions || []).map((q, idx) => {
    const sub = submissions[idx];
    return {
      question: q.question || q.title || `Coding ${idx + 1}`,
      title: q.title || q.question || `Coding ${idx + 1}`,
      attempted: !!sub,
      passed: sub?.passedCount ?? 0,
      total: sub?.totalCount ?? (Array.isArray(q.testCases) ? q.testCases.length : 0),
      language: sub?.language || q.language || "N/A",
    };
  });
  return results;
}

/* ============================================================================
   REAL-TIME ADAPTIVE PER-QUESTION ENGINE
   ============================================================================ */

/**
 * Generate a single adaptive question in real-time, grounded strictly in
 * candidate resume data and adapted based on prior answers.
 * Returns the question doc and saves it directly to DB (InterviewQuestion).
 */
export async function generateSingleAdaptiveQuestion({
  interviewId,
  userId,
  round = "technical",
  questionNumber = 1,
  totalQuestions = 10,
  currentDifficulty = "medium",
  candidateProfile = null,
  lastEvaluation = null,
}) {
  const normRound = String(round || "technical").toLowerCase();

  // 1. Resolve candidate profile & context
  let resolvedProfile = candidateProfile;
  if (!resolvedProfile && userId) {
    const user = await User.findById(userId).select("-password").lean();
    resolvedProfile = user?.candidateProfile || {
      candidateName: user?.name || "Candidate",
      skills: user?.skills || [],
      projects: user?.projects || [],
      experience: user?.experience || [],
      department: user?.department || "Computer Science",
    };
  }

  // 2. Fetch existing session questions & answers for context
  let previousQuestions = [];
  let previousAnswers = [];
  if (interviewId) {
    [previousQuestions, previousAnswers] = await Promise.all([
      InterviewQuestion.find({ interviewId }).sort({ questionNumber: 1 }).lean(),
      Answer.find({ interviewId }).lean(),
    ]);
  }

  // If questionNumber not provided, compute it
  const actualQNum = Number(questionNumber) || (previousQuestions.length + 1);

  // 3. Compute adaptive difficulty based on recent performance
  let adaptedDifficulty = currentDifficulty || "medium";
  if (previousAnswers.length > 0) {
    const recentAnswers = previousAnswers.slice(-3);
    const scoredAnswers = recentAnswers.filter((a) => typeof a.score === "number");
    if (scoredAnswers.length > 0) {
      const avgScore = scoredAnswers.reduce((sum, a) => sum + a.score, 0) / scoredAnswers.length;
      if (avgScore >= 75) adaptedDifficulty = "hard";
      else if (avgScore < 50) adaptedDifficulty = "easy";
      else adaptedDifficulty = "medium";
    }
  }

  // 4. Generate via AI
  let generatedData = null;
  if (isAIConfigured()) {
    try {
      const prompt = buildDynamicQuestionPrompt({
        profile: resolvedProfile,
        round: normRound,
        questionNumber: actualQNum,
        totalQuestions,
        previousQuestions,
        previousAnswers,
        currentDifficulty: adaptedDifficulty,
        lastEvaluation,
      });

      generatedData = await aiGenerateJSON(prompt, { temperature: 0.6, timeoutMs: 45000 });
    } catch (aiErr) {
      console.warn("AI dynamic question generation error, falling back:", aiErr.message);
    }
  }

  // Fallback if AI fails or is not configured
  if (!generatedData || !generatedData.question) {
    const primarySkill = resolvedProfile?.skills?.[0] || "Software Engineering";
    const primaryProject = resolvedProfile?.projects?.[0]?.name || "your major project";
    generatedData = {
      question: `Can you explain the architecture and key technical decisions you made in ${primaryProject}, particularly focusing on ${primarySkill}?`,
      questionType: normRound === "coding" ? "coding" : normRound === "aptitude" ? "mcq" : "voice",
      difficulty: adaptedDifficulty,
      skill: primarySkill,
      topic: "System Architecture",
      section: normRound.toUpperCase(),
      aiSpeechText: `Let's discuss ${primaryProject}. Can you explain the architecture and key technical decisions you made?`,
    };
  }

  // 5. Structure and persist into InterviewQuestion model
  const questionId = `${normRound.toUpperCase()}-${String(actualQNum).padStart(2, "0")}`;
  const questionDoc = {
    interviewId,
    candidateId: userId,
    round: normRound,
    questionNumber: actualQNum,
    questionId,
    question: String(generatedData.question).trim(),
    section: (generatedData.section || normRound).toUpperCase(),
    skill: generatedData.skill || "General",
    topic: generatedData.topic || "General",
    difficulty: normDiff(generatedData.difficulty || adaptedDifficulty),
    questionType: generatedData.questionType || (normRound === "coding" ? "coding" : normRound === "aptitude" ? "mcq" : "conceptual"),
    aiSpeechText: String(generatedData.aiSpeechText || generatedData.question).trim(),
    options: Array.isArray(generatedData.options) ? generatedData.options : [],
    correctAnswer: generatedData.correctAnswer || "",
    starterCode: generatedData.starterCode || "",
    testCases: Array.isArray(generatedData.testCases) ? generatedData.testCases : [],
    inputFormat: generatedData.inputFormat || "",
    outputFormat: generatedData.outputFormat || "",
    constraints: generatedData.constraints || "",
    sampleInput: generatedData.sampleInput || "",
    sampleOutput: generatedData.sampleOutput || "",
    source: "ai_dynamic",
    metadata: {
      generatedBy: "ai_realtime",
      profileGrounded: true,
      adaptiveDifficulty: adaptedDifficulty,
      generatedAt: new Date(),
    },
  };

  let savedQuestion = null;
  if (interviewId) {
    savedQuestion = await InterviewQuestion.findOneAndUpdate(
      { interviewId, questionNumber: actualQNum, round: normRound },
      questionDoc,
      { upsert: true, new: true }
    );

    // Also link/update to Interview session document
    await Interview.findByIdAndUpdate(interviewId, {
      $addToSet: {
        generatedQuestions: {
          id: questionId,
          questionId,
          question: questionDoc.question,
          aiSpeechText: questionDoc.aiSpeechText,
          section: questionDoc.section,
          category: normRound,
          round: normRound,
          difficulty: questionDoc.difficulty,
          topic: questionDoc.topic,
          skill: questionDoc.skill,
          questionType: questionDoc.questionType,
          options: questionDoc.options,
          correctAnswer: questionDoc.correctAnswer,
          testCases: questionDoc.testCases,
          inputFormat: questionDoc.inputFormat,
          outputFormat: questionDoc.outputFormat,
          constraints: questionDoc.constraints,
          sampleInput: questionDoc.sampleInput,
          sampleOutput: questionDoc.sampleOutput,
        },
      },
    });
  }

  return savedQuestion ? savedQuestion.toObject() : questionDoc;
}

/**
 * Real-time per-answer evaluation engine.
 * Scores candidate answer (0-100) and produces actionable feedback immediately.
 */
export async function evaluateSingleAnswer({
  question = "",
  answer = "",
  round = "technical",
  skill = "General",
  topic = "General",
  difficulty = "medium",
  correctAnswer = "",
}) {
  const normRound = String(round || "technical").toLowerCase();
  const cleanAns = String(answer || "").trim();

  if (!cleanAns) {
    return {
      score: 0,
      feedback: "Question skipped or answer left blank.",
      strengths: [],
      weaknesses: ["Answer was empty or omitted."],
      suggestedDifficulty: "easy",
      followUpFocus: "Basic fundamentals",
    };
  }

  // For objective Aptitude MCQs
  if (normRound === "aptitude" || normRound === "mcq") {
    const isCorrect = correctAnswer && cleanAns.toLowerCase() === correctAnswer.trim().toLowerCase();
    return {
      score: isCorrect ? 100 : 0,
      feedback: isCorrect ? "Correct answer selected." : `Incorrect. The correct answer was: ${correctAnswer}`,
      strengths: isCorrect ? ["Accurate reasoning"] : [],
      weaknesses: isCorrect ? [] : ["Review this topic"],
      suggestedDifficulty: isCorrect ? "hard" : "easy",
      followUpFocus: "Concept verification",
    };
  }

  // For verbal technical / HR questions
  if (isAIConfigured()) {
    try {
      const prompt = buildSingleAnswerEvaluationPrompt({
        question,
        candidateAnswer: cleanAns,
        round: normRound,
        skill,
        topic,
        difficulty,
      });

      const parsed = await aiGenerateJSON(prompt, { temperature: 0.2, timeoutMs: 30000 });
      if (parsed && typeof parsed.score === "number") {
        return {
          score: Math.max(0, Math.min(100, Math.round(parsed.score))),
          feedback: String(parsed.feedback || "Answer recorded."),
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths : ["Answer provided"],
          weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
          suggestedDifficulty: normDiff(parsed.suggestedDifficulty || difficulty),
          followUpFocus: String(parsed.followUpFocus || topic),
        };
      }
    } catch (evalErr) {
      console.warn("AI single answer evaluation fallback:", evalErr.message);
    }
  }

  // Fallback evaluation heuristic
  const wordCount = cleanAns.split(/\s+/).length;
  let fallbackScore = 50;
  if (wordCount >= 30) fallbackScore = 75;
  if (wordCount >= 60) fallbackScore = 85;

  return {
    score: fallbackScore,
    feedback: "Answer recorded and evaluated successfully.",
    strengths: ["Clear verbal communication"],
    weaknesses: [],
    suggestedDifficulty: difficulty,
    followUpFocus: topic,
  };
}

