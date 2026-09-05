/**
 * Company Mock — Backend reference answers for technical questions.
 *
 * Reads expectedAnswer, explanation, and betterAnswer from the
 * question bank files. These are the AUTHORITATIVE references
 * that do NOT depend on the AI API.
 *
 * Used by both AI evaluation (as context) and fallback scoring (as ground truth).
 */

import { loadCompanyMockTechnical } from "../../companyMockBank.js";

/**
 * Load reference answers for a set of technical question IDs.
 * Returns a Map<questionId, { expectedAnswer, explanation, betterAnswer, marks, difficulty }>.
 */
export function loadTechnicalReferences(companyId, questionIds = []) {
  const allQuestions = loadCompanyMockTechnical(companyId);
  const refMap = new Map();

  for (const q of allQuestions) {
    const qid = String(q.questionId);
    if (questionIds.length > 0 && !questionIds.includes(qid)) continue;

    refMap.set(qid, {
      questionId: qid,
      question: q.question || "",
      topic: q.topic || "",
      difficulty: q.difficulty || "Medium",
      marks: q.marks || 3,
      expectedAnswer: q.expectedAnswer || "",
      explanation: q.explanation || "",
      betterAnswer: q.betterAnswer || "",
      options: q.options || [],
      hasOptions: Array.isArray(q.options) && q.options.length > 0,
    });
  }

  return refMap;
}

/**
 * Get a single question's reference data.
 * Returns null if question not found.
 */
export function getQuestionReference(companyId, questionId) {
  const refs = loadTechnicalReferences(companyId, [questionId]);
  return refs.get(String(questionId)) || null;
}
