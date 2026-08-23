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
} from "./ai/aiPrompts.js";
import { generateAptitudeQuestions } from "./roundGenerators.js";
import InterviewQuestion from "../models/InterviewQuestion.js";
import CodingSubmission from "../models/CodingSubmission.js";

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
