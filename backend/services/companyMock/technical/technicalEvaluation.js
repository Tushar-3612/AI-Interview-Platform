/**
 * Company Mock — Technical evaluation coordinator.
 *
 * Main entry point for evaluating free-text technical answers.
 * Routes through: AI evaluation → fallback scoring → reference answers.
 *
 * This is the ONLY module that should be imported by the controller.
 */

import { callAiEvaluator } from "../ai/mockTechnicalEvaluator.js";
import { evaluateTcsSingleAnswer } from "./tcsTechnicalEvaluator.js";
import { evaluateAccentureSingleAnswer } from "./accentureTechnicalEvaluator.js";
import { evaluateBenchmarkSingleAnswer } from "./benchmarkTechnicalEvaluator.js";
import { evaluateShared2SingleAnswer } from "./shared2TechnicalEvaluator.js";
import { isKey2Company } from "../../../config/companyMock/shared2.js";
import { computeFallbackScore } from "./technicalFallback.js";

/**
 * Evaluate a single free-text technical answer.
 *
 * Flow:
 *   1. If company is "tcs" → route to dedicated TCS Evaluator (TCS_MOCK_KEY)
 *   2. If company is "accenture" → route to dedicated Accenture Evaluator (ACCENTURE_MOCK_KEY)
 *   3. If company is "benchmark" → route to dedicated Benchmark Evaluator (BENCHMARK_MOCK_KEY)
 *   4. If company is KEY2 group (capgemini/cognizant/deloitte/infosys) → route to KEY2 Evaluator (MOCK_INTERVIEW_API_KEY2)
 *   5. If other company / celebal → route to standard Mock Evaluator (MOCK_INTERVIEW_API_KEY)
 *   6. If AI unavailable or error → deterministic fallback scoring
 *   7. Always return backend reference answers (expectedAnswer, explanation, betterAnswer)
 */
export async function evaluateSingleAnswer({
  companyId,
  question,
  topic,
  difficulty,
  candidateAnswer,
  expectedAnswer,
  explanation,
  betterAnswer,
  marks,
}) {
  const comp = String(companyId || "").toLowerCase();

  // ── TCS Company Mock route ──
  if (comp === "tcs") {
    return evaluateTcsSingleAnswer({
      question,
      topic,
      difficulty,
      candidateAnswer,
      expectedAnswer,
      explanation,
      betterAnswer,
      marks,
    });
  }

  // ── Accenture Company Mock route ──
  if (comp === "accenture") {
    return evaluateAccentureSingleAnswer({
      question,
      topic,
      difficulty,
      candidateAnswer,
      expectedAnswer,
      explanation,
      betterAnswer,
      marks,
    });
  }

  // ── Benchmark Company Mock route ──
  if (comp === "benchmark") {
    return evaluateBenchmarkSingleAnswer({
      question,
      topic,
      difficulty,
      candidateAnswer,
      expectedAnswer,
      explanation,
      betterAnswer,
      marks,
    });
  }

  // ── KEY2 Company Mock route (Capgemini, Cognizant, Deloitte, Infosys) ──
  if (isKey2Company(comp)) {
    return evaluateShared2SingleAnswer({
      companyId: comp,
      question,
      topic,
      difficulty,
      candidateAnswer,
      expectedAnswer,
      explanation,
      betterAnswer,
      marks,
    });
  }

  const maxMarks = marks || 3;

  // ── Empty answer → zero score ──
  if (!candidateAnswer || !candidateAnswer.trim()) {
    return {
      score: 0,
      maxMarks,
      evaluation: "No answer provided.",
      strengths: [],
      weaknesses: ["No answer was submitted."],
      betterAnswer: betterAnswer || expectedAnswer || "",
      expectedAnswer: expectedAnswer || "",
      explanation: explanation || "",
      evaluationStatus: "fallback",
    };
  }

  // ── Try AI evaluation (Celebal / Company Mock) ──
  const aiResult = await callAiEvaluator({
    question,
    topic,
    difficulty,
    candidateAnswer,
    expectedAnswer,
    marks,
  });

  if (aiResult) {
    return {
      ...aiResult,
      expectedAnswer: expectedAnswer || "",
      explanation: explanation || "",
      evaluationStatus: "ai_evaluated",
    };
  }

  // ── AI unavailable → deterministic fallback ──
  const fallbackResult = computeFallbackScore({
    candidateAnswer,
    expectedAnswer,
    explanation,
    betterAnswer,
    maxMarks,
  });

  return {
    ...fallbackResult,
    expectedAnswer: expectedAnswer || "",
    explanation: explanation || "",
  };
}

/**
 * Evaluate multiple technical answers in sequence.
 * Returns an array of evaluation results, one per question.
 */
export async function evaluateTechnicalAnswers(answers) {
  const results = [];
  for (const answer of answers) {
    const result = await evaluateSingleAnswer(answer);
    results.push(result);
  }
  return results;
}

export const evaluateCompanyMockSingleAnswer = (questionObj, candidateAnswer, opts = {}) => {
  return evaluateSingleAnswer({
    companyId: opts.companyId || questionObj.company || questionObj.companyId,
    question: questionObj.question,
    topic: questionObj.topic || questionObj.category,
    difficulty: questionObj.difficulty,
    candidateAnswer: candidateAnswer !== undefined ? candidateAnswer : questionObj.candidateAnswer,
    expectedAnswer: questionObj.expectedAnswer,
    explanation: questionObj.explanation,
    betterAnswer: questionObj.betterAnswer,
    marks: questionObj.marks,
  });
};
