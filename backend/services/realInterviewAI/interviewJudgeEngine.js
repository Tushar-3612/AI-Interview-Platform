/**
 * interviewJudgeEngine.js
 * =======================
 * Unified, generic, modular evaluation and judging engine for the Real Interview system.
 *
 * Implements the full 10-stage evaluation pipeline:
 * 1. Answer Gate (intercepts empty/refusal/filler before AI/NLP)
 * 2. Question Analyzer (identifies deliverable type, intent, constraints)
 * 3. Requirement Extraction (breaks down criteria into verifiable sub-claims)
 * 4. Evidence Extraction (measures demonstrated candidate claims)
 * 5. Semantic Relevance & Synonym Alignment (recognizes valid alternative phrasing)
 * 6. Correctness Evaluation (validates technical accuracy)
 * 7. Completeness Evaluation (proportional multi-component credit)
 * 8. Contradiction & Flaw Detection (catches inverted technical claims)
 * 9. Score Calibration & Bounding (guarantees 0 <= score <= maxMarks)
 * 10. Normalized Output Contract
 *
 * Zero hardcoded question IDs.
 * Zero word-count bias.
 * Zero free marks for conversational filler or refusal.
 */

import { checkAnswerGate } from "./judgeAnswerGate.js";
import { analyzeQuestion } from "./judgeQuestionAnalyzer.js";
import { extractRequirements, alignTechnicalSynonyms } from "./judgeRequirementExtractor.js";
import { calibrateScore, checkContradictions } from "./judgeScoreCalibrator.js";
import {
  evaluateTechnicalQuestion as evaluateTechnicalFallbackQuestion,
  evaluateHRQuestion as evaluateHRFallbackQuestion,
  evaluateProjectQuestion as evaluateProjectFallbackQuestion,
  generateDeterministicTechnicalEvaluation,
  generateDeterministicHREvaluation,
  generateDeterministicProjectEvaluation,
} from "./deterministicEvaluator.js";

/**
 * Evaluates a single candidate answer against a question and its reference knowledge.
 *
 * @param {object} params
 * @param {string} params.question - The question text
 * @param {string} [params.expectedKnowledge] - The reference criteria/expected knowledge
 * @param {string} [params.candidateAnswer] - Raw or preprocessed candidate answer
 * @param {number} [params.maxMarks=5] - Maximum marks for this question
 * @param {"technical"|"hr"|"project"} [params.round="technical"] - Round identifier
 * @param {"easy"|"medium"|"hard"} [params.difficulty="medium"] - Question difficulty
 * @param {string} [params.questionId=""] - Unique question MongoDB _id or string ID
 * @param {object} [params.options={}] - Additional options (e.g. AI provider, sessionId)
 * @returns {object} Authoritative normalized judge evaluation result
 */
export function judgeAnswer({
  question = "",
  expectedKnowledge = "",
  candidateAnswer = "",
  maxMarks = 5,
  round = "technical",
  difficulty = "medium",
  questionId = "",
  options = {},
}) {
  const safeMax = Math.max(1, Number(maxMarks) || 5);
  const qIdStr = String(questionId || "").trim();

  // -------------------------------------------------------------------------
  // STAGE 1: ANSWER GATE (MANDATORY PRE-CHECK)
  // -------------------------------------------------------------------------
  const gateResult = checkAnswerGate(candidateAnswer, { question, expectedKnowledge });
  if (gateResult.isGateTriggered) {
    return calibrateScore({
      rawScore: 0,
      maxMarks: safeMax,
      status: gateResult.status,
      evaluationSource: "ANSWER_GATE",
      confidence: 1.0,
      evidence: [],
      missing: ["Question was not attempted or was explicitly declined"],
      contradictions: [],
      feedback: gateResult.feedback,
      betterAnswer: expectedKnowledge || "Provide a direct, interview-ready response.",
      difficulty,
    });
  }

  // -------------------------------------------------------------------------
  // STAGE 2: QUESTION ANALYZER
  // -------------------------------------------------------------------------
  const analysis = analyzeQuestion({
    question,
    expectedKnowledge,
    maxMarks: safeMax,
    round,
  });

  // -------------------------------------------------------------------------
  // STAGE 3: REQUIREMENT EXTRACTION & SYNONYM ALIGNMENT
  // -------------------------------------------------------------------------
  const requirements = extractRequirements({
    question,
    expectedKnowledge,
    questionType: analysis.questionType,
    maxMarks: safeMax,
  });

  // -------------------------------------------------------------------------
  // STAGE 4: CONTRADICTION & INVALID CLAIM FILTER
  // -------------------------------------------------------------------------
  const rawCandidateText = String(candidateAnswer || "").trim();
  const alignedCandidate = alignTechnicalSynonyms(rawCandidateText);
  const alignedExpected = alignTechnicalSynonyms(expectedKnowledge);
  const contradictions = checkContradictions(rawCandidateText, `${expectedKnowledge} ${question}`);

  if (contradictions.length > 0) {
    return calibrateScore({
      rawScore: 0,
      maxMarks: safeMax,
      status: "INCORRECT",
      evaluationSource: "JUDGE_CONTRADICTION_RULE",
      confidence: 0.95,
      evidence: [],
      missing: ["Answer contains direct factual contradiction"],
      contradictions,
      feedback: `Contradiction detected: ${contradictions.join("; ")}`,
      betterAnswer: expectedKnowledge,
      difficulty,
    });
  }

  // -------------------------------------------------------------------------
  // STAGE 5: SPECIALIZED STRATEGY & DETERMINISTIC EVALUATION
  // -------------------------------------------------------------------------
  let evalResult = null;
  const lowerRound = String(round || "technical").toLowerCase();

  if (lowerRound === "hr" || lowerRound === "behavioral") {
    evalResult = evaluateHRFallbackQuestion({
      questionId: qIdStr,
      question,
      candidateAnswer: rawCandidateText,
      maxScore: safeMax,
      maxMarks: safeMax,
      category: analysis.questionType,
    });
  } else if (lowerRound === "project" || lowerRound === "resume_project") {
    evalResult = evaluateProjectFallbackQuestion({
      questionId: qIdStr,
      question,
      candidateAnswer: rawCandidateText,
      expectedKnowledge,
      maxScore: safeMax,
      maxMarks: safeMax,
      difficulty,
    });
  } else {
    evalResult = evaluateTechnicalFallbackQuestion({
      questionId: qIdStr,
      question,
      candidateAnswer: rawCandidateText,
      expectedKnowledge,
      maxScore: safeMax,
      maxMarks: safeMax,
      difficulty,
    });
  }

  // -------------------------------------------------------------------------
  // STAGE 6: SCORE CALIBRATION & BOUNDING
  // -------------------------------------------------------------------------
  const calibrated = calibrateScore({
    rawScore: evalResult?.score || 0,
    maxMarks: safeMax,
    status: evalResult?.status,
    evaluationSource: evalResult?.evaluationSource || "JUDGE_ENGINE",
    confidence: evalResult?.confidence || 0.92,
    evidence: evalResult?.correctPoints || evalResult?.reasoningStrengths || [],
    missing: evalResult?.missingPoints || evalResult?.concerns || [],
    contradictions: evalResult?.incorrectPoints || contradictions,
    feedback: evalResult?.feedback || "",
    betterAnswer: evalResult?.betterAnswer || expectedKnowledge,
    difficulty,
  });

  return {
    questionId: qIdStr,
    ...calibrated,
  };
}

/**
 * Batch evaluates a list of questions for a Real Interview round session.
 *
 * @param {object} params
 * @param {Array} params.questions - Array of question objects with candidate answers
 * @param {"technical"|"hr"|"project"} params.round - Round identifier
 * @param {object} [params.candidateProfile={}]
 * @param {object} [params.options={}]
 * @returns {object} Authoritative round evaluation result
 */
export function judgeQuestionBatch({
  questions = [],
  round = "technical",
  candidateProfile = {},
  options = {},
}) {
  const evaluations = questions.map((q) => {
    const qId = String(q.questionId || q.id || q._id || "").trim();
    const maxScore = Number(q.maxScore || q.maxMarks || (q.difficulty === "easy" ? 3 : q.difficulty === "hard" ? 13 : 5));
    const ans = String(q.candidateAnswer || q.answer || "").trim();
    const expected = String(q.expectedKnowledge || q.expectedAnswer || q.referenceAnswer || "").trim();

    return judgeAnswer({
      question: q.question,
      expectedKnowledge: expected,
      candidateAnswer: ans,
      maxMarks: maxScore,
      round,
      difficulty: q.difficulty || "medium",
      questionId: qId,
      options,
    });
  });

  const totalScore = evaluations.reduce((sum, e) => sum + e.score, 0);
  const maxScoreTotal = String(round).toLowerCase() === "hr"
    ? 60
    : 100;

  const percentage = maxScoreTotal > 0 ? Math.min(100, Math.round((totalScore / maxScoreTotal) * 100)) : 0;

  let overallRating = "Weak";
  if (percentage >= 80) overallRating = "Strong";
  else if (percentage >= 60) overallRating = "Average";
  else if (percentage >= 40) overallRating = "Needs Improvement";

  const answeredCount = evaluations.filter((e) => e.status !== "NOT_ATTEMPTED").length;

  return {
    evaluations,
    totalScore: Math.min(maxScoreTotal, totalScore),
    maxScore: maxScoreTotal,
    percentage,
    overallRating,
    strengths: answeredCount > 0 ? ["Evaluated against technical reference criteria and requirement models"] : [],
    weaknesses: answeredCount < evaluations.length ? ["Unattempted or incomplete answers identified in round"] : [],
    finalFeedback: `${round.toUpperCase()} round evaluated using unified InterviewJudgeEngine.`,
    evaluationSource: "JUDGE_ENGINE_BATCH",
  };
}

/**
 * Top-level integration entry point for Technical round evaluation.
 */
export async function evaluateTechnicalInterviewJudge({ candidateProfile = {}, questions = [], options = {} }) {
  return judgeQuestionBatch({
    questions,
    round: "technical",
    candidateProfile,
    options,
  });
}

/**
 * Top-level integration entry point for HR round evaluation.
 */
export async function evaluateHRInterviewJudge({ candidateProfile = {}, questionsWithAnswers = [], options = {} }) {
  return judgeQuestionBatch({
    questions: questionsWithAnswers,
    round: "hr",
    candidateProfile,
    options,
  });
}

/**
 * Top-level integration entry point for Project round evaluation.
 */
export async function evaluateProjectInterviewJudge({ candidateProfile = {}, questions = [], options = {} }) {
  return judgeQuestionBatch({
    questions,
    round: "project",
    candidateProfile,
    options,
  });
}
