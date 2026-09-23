/**
 * judgeScoreCalibrator.js
 * =======================
 * Calibrates and normalizes evaluation scores from evidence, requirements,
 * contradiction filters, and AI outputs.
 *
 * Guarantees:
 * - 0 <= score <= maxMarks strictly.
 * - Zero marks for contradictions, refusals, empty answers, and unrelated claims.
 * - Full marks for short, completely correct answers without length penalties.
 * - Normalized JSON output contract.
 */

import { alignTechnicalSynonyms } from "./judgeRequirementExtractor.js";

// Contradiction detection patterns
const KNOWN_CONTRADICTIONS = [
  {
    pattern: /\b(get\s+(?:deletes|modifies|updates|removes|destroys)|http\s+get\s+deletes)\b/i,
    context: /get|http method|rest/i,
    message: "HTTP GET is safe/read-only and does not delete or modify server resources.",
  },
  {
    pattern: /\b(post\s+is\s+idempotent|get\s+is\s+not\s+idempotent)\b/i,
    context: /idempotent|http/i,
    message: "HTTP POST is not idempotent, whereas GET, PUT, and DELETE are idempotent.",
  },
  {
    pattern: /\b(tcp\s+is\s+(?:connectionless|unreliable)|udp\s+is\s+(?:connection-oriented|reliable|guaranteed))\b/i,
    context: /tcp|udp|transport|network/i,
    message: "TCP is connection-oriented and reliable; UDP is connectionless and best-effort.",
  },
  {
    pattern: /\b(docker\s+is\s+a\s+(?:relational\s+)?database|react\s+is\s+a\s+database|node(?:\.js)?\s+is\s+a\s+database)\b/i,
    context: /docker|react|node/i,
    message: "Tool classification is incorrect (e.g. Docker is a container platform, not a database).",
  },
  {
    pattern: /\b(const\s+(?:variables?\s+can\s+be\s+reassigned|can\s+be\s+reassigned)|tuple\s+is\s+mutable)\b/i,
    context: /const|tuple|immutable/i,
    message: "Const variables and tuples are immutable / cannot be reassigned.",
  },
  {
    pattern: /\b(final\s+classes?\s+(?:can\s+be\s+extended|allows?\s+inheritance|can\s+be\s+inherited)|final\s+method\s+can\s+be\s+overridden)\b/i,
    context: /final|inheritance|override/i,
    message: "Final classes cannot be extended/inherited, and final methods cannot be overridden.",
  },
  {
    pattern: /\b(redis\s+is\s+(?:a\s+)?(?:relational|permanent|sql)|redis\s+is\s+used\s+to\s+permanently\s+store)\b/i,
    context: /redis|cache|key-value/i,
    message: "Redis is an in-memory key-value cache, not a relational SQL database for permanent storage.",
  },
  {
    pattern: /\b(404\s+means\s+(?:success|ok|server\s+found|resource\s+found|successful))\b/i,
    context: /404|status code/i,
    message: "HTTP 404 indicates the requested resource was NOT found, not a success.",
  },
];

/**
 * Detects explicit factual contradictions in candidate answer.
 *
 * @param {string} candidateAnswer
 * @param {string} contextText
 * @returns {string[]} List of contradiction messages
 */
export function checkContradictions(candidateAnswer, contextText = "") {
  const found = [];
  const combined = (candidateAnswer + " " + contextText).toLowerCase();
  for (const rule of KNOWN_CONTRADICTIONS) {
    if (rule.context.test(combined) && rule.pattern.test(candidateAnswer)) {
      found.push(rule.message);
    }
  }
  return found;
}

/**
 * Calibrates score and normalizes the final judge result.
 *
 * @param {object} params
 * @param {number} params.rawScore
 * @param {number} params.maxMarks
 * @param {string} [params.status]
 * @param {string} [params.evaluationSource="AI"]
 * @param {number} [params.confidence=0.9]
 * @param {string[]} [params.evidence=[]]
 * @param {string[]} [params.missing=[]]
 * @param {string[]} [params.contradictions=[]]
 * @param {string} [params.feedback=""]
 * @param {string} [params.betterAnswer=""]
 * @param {string} [params.difficulty="medium"]
 * @returns {object} Authoritative normalized judge result
 */
export function calibrateScore({
  rawScore = 0,
  maxMarks = 5,
  status = "",
  evaluationSource = "JUDGE_ENGINE",
  confidence = 0.9,
  evidence = [],
  missing = [],
  contradictions = [],
  feedback = "",
  betterAnswer = "",
  difficulty = "medium",
}) {
  const safeMax = Math.max(1, Number(maxMarks) || 5);
  let finalScore = Number(rawScore);

  if (isNaN(finalScore)) finalScore = 0;

  // 1. Contradictions trigger 0 score override
  if (contradictions && contradictions.length > 0) {
    finalScore = 0;
  }

  // 2. Strict bounding: 0 <= score <= maxMarks
  finalScore = Math.max(0, Math.min(safeMax, Math.round(finalScore)));

  // 3. Status determination
  let finalStatus = status;
  if (!finalStatus) {
    if (contradictions.length > 0 || finalScore === 0) {
      finalStatus = "INCORRECT";
    } else if (finalScore >= safeMax * 0.8) {
      finalStatus = "CORRECT";
    } else {
      finalStatus = "PARTIALLY_CORRECT";
    }
  }

  // If status is NOT_ATTEMPTED, force score 0
  if (finalStatus === "NOT_ATTEMPTED") {
    finalScore = 0;
  }

  // 4. Rating derivation
  let rating = "Weak";
  if (finalStatus === "NOT_ATTEMPTED") {
    rating = "Not Attempted";
  } else if (finalScore >= safeMax * 0.85) {
    rating = "Strong";
  } else if (finalScore >= safeMax * 0.45) {
    rating = "Acceptable";
  } else {
    rating = "Weak";
  }

  // 5. Build clean feedback
  let finalFeedback = String(feedback || "").trim();
  if (contradictions.length > 0) {
    finalFeedback = `Contradiction detected: ${contradictions.join("; ")}`;
  } else if (!finalFeedback) {
    finalFeedback = finalScore >= safeMax * 0.8
      ? "Answer demonstrates thorough technical accuracy and expected deliverables."
      : finalScore > 0
      ? `Partially correct. Awarded ${finalScore}/${safeMax} marks for demonstrated concepts.`
      : "Answer does not meet the expected technical requirements.";
  }

  return {
    status: finalStatus,
    score: finalScore,
    maxScore: safeMax,
    maxMarks: safeMax,
    difficulty,
    confidence: Number(confidence) || 0.9,
    evaluationSource,
    rating,
    evidence: Array.isArray(evidence) ? evidence : [],
    correctPoints: Array.isArray(evidence) ? evidence : [],
    missing: Array.isArray(missing) ? missing : [],
    missingPoints: Array.isArray(missing) ? missing : [],
    contradictions: Array.isArray(contradictions) ? contradictions : [],
    incorrectPoints: Array.isArray(contradictions) ? contradictions : [],
    grammarIssues: [],
    feedback: finalFeedback,
    reason: finalFeedback,
    betterAnswer: String(betterAnswer || "").trim(),
  };
}
