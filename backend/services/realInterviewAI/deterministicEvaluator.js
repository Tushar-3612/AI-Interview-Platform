/**
 * deterministicEvaluator.js
 * ==========================
 * Evidence-based NLP/rubric fallback evaluator for Real Interview rounds.
 * Used ONLY when AI evaluation fails (rate limit, timeout, malformed response).
 *
 * NOT a fake 0-score fallback.
 * NOT a "50% if answered" shortcut.
 *
 * This evaluator ACTUALLY reads the candidate answer and compares it against
 * the expected knowledge/rubric using normalized concept matching.
 *
 * Rounds: TECHNICAL, PROJECT, HR
 * Aptitude: deterministic by correctAnswer (handled separately)
 * Coding: Judge0 (not handled here)
 */

// -----------------------------------------------------------------------
// NORMALIZATION HELPERS
// -----------------------------------------------------------------------

/**
 * Normalize a word or phrase for matching:
 * - lowercase
 * - remove punctuation
 * - collapse whitespace
 * - strip common suffixes for lemmatization-like behavior
 */
function normalizeToken(word) {
  let w = word.toLowerCase().replace(/[^\w]/g, "").trim();
  // Lemmatization-like suffix stripping (safe subset)
  if (w.length > 5) {
    if (w.endsWith("ation")) w = w.slice(0, -5);      // authentication → authent
    else if (w.endsWith("ations")) w = w.slice(0, -6);
    else if (w.endsWith("izing")) w = w.slice(0, -4); // optimizing → optim
    else if (w.endsWith("ized")) w = w.slice(0, -4);  // optimized → optim
    else if (w.endsWith("izes")) w = w.slice(0, -4);
    else if (w.endsWith("ing")) w = w.slice(0, -3);   // caching → cach
    else if (w.endsWith("tion")) w = w.slice(0, -4);  // validation → valid
    else if (w.endsWith("ed")) w = w.slice(0, -2);    // implemented → implement
    else if (w.endsWith("er")) w = w.slice(0, -2);    // controller → controll
    else if (w.endsWith("es")) w = w.slice(0, -2);    // caches → cach
    else if (w.endsWith("s") && w.length > 4) w = w.slice(0, -1); // tokens → token
  }
  return w;
}

/**
 * Extract concept tokens from text.
 * Returns a Set of normalized tokens, including bigrams for compound terms.
 */
function extractConceptTokens(text) {
  if (!text || typeof text !== "string") return new Set();
  const words = text.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);
  const tokens = new Set();
  for (let i = 0; i < words.length; i++) {
    const t = normalizeToken(words[i]);
    if (t.length >= 3) tokens.add(t);
    // Bigrams for compound technical terms (e.g., "jwt auth", "rate limit")
    if (i + 1 < words.length) {
      const bigram = normalizeToken(words[i]) + "_" + normalizeToken(words[i + 1]);
      if (bigram.length >= 6) tokens.add(bigram);
    }
  }
  return tokens;
}

/**
 * Count how many concept tokens from `expected` appear in `candidate`.
 * Returns { matched, total, coverage (0-1) }
 */
function measureCoverage(candidateTokens, expectedTokens) {
  if (expectedTokens.size === 0) return { matched: 0, total: 0, coverage: 0 };
  let matched = 0;
  for (const token of expectedTokens) {
    if (candidateTokens.has(token)) matched++;
  }
  return {
    matched,
    total: expectedTokens.size,
    coverage: matched / expectedTokens.size,
  };
}

/**
 * Check if candidate answer has negations that might indicate understanding
 * e.g., "JWT is NOT stored in localStorage"
 */
const NEGATION_PATTERN = /\b(not|no|never|without|cannot|can't|prevent|avoid|instead|rather|unless|except)\b/i;
const REASONING_PATTERN = /\b(because|therefore|thus|hence|since|due|as a result|consequently|ensures|enables|allows|requires|leads to|results in)\b/i;
const EXAMPLE_PATTERN = /\b(for example|e\.g\.|such as|like|for instance|consider|suppose|assume)\b/i;

/**
 * Check if text appears to be a real answer (not just "I don't know" or empty noise)
 */
function isSubstantialAnswer(text) {
  const words = (text || "").split(/\s+/);
  const realWords = words.filter((w) => w.length > 2);
  return realWords.length >= 5;
}

/**
 * Detect if candidate appears to understand the topic at all
 * by checking technical vocabulary overlap
 */
function hasTopicAwareness(candidateTokens, expectedTokens) {
  // At least 1 concept must match for "topic awareness"
  for (const token of expectedTokens) {
    if (candidateTokens.has(token)) return true;
  }
  return false;
}

// -----------------------------------------------------------------------
// TECHNICAL ROUND EVALUATOR
// -----------------------------------------------------------------------

/**
 * Evaluate a single TECHNICAL question answer.
 *
 * @param {object} q - { questionId, question, candidateAnswer, expectedKnowledge, difficulty, maxScore }
 * @returns {{ questionId, score, maxScore, feedback, missingPoints, betterAnswer, evaluationSource }}
 */
function evaluateTechnicalQuestion(q) {
  const ans = String(q.candidateAnswer || "").trim();
  const expected = String(q.expectedKnowledge || q.question || "").trim();
  const maxScore = Number(q.maxScore || (q.difficulty === "easy" ? 3 : q.difficulty === "hard" ? 13 : 5));
  const qId = String(q.questionId);

  // Unanswered
  if (!ans || ans === "(No answer submitted)" || ans.toLowerCase() === "not answered") {
    return {
      questionId: qId,
      score: 0,
      maxScore,
      difficulty: q.difficulty,
      rating: "Not Attempted",
      evaluationSource: "deterministic_nlp",
      correctPoints: [],
      missingPoints: ["Question was not attempted"],
      incorrectPoints: [],
      grammarIssues: [],
      feedback: "Question was not attempted.",
      betterAnswer: expected || "Comprehensive technical explanation required.",
    };
  }

  if (!isSubstantialAnswer(ans)) {
    return {
      questionId: qId,
      score: Math.round(maxScore * 0.05),
      maxScore,
      difficulty: q.difficulty,
      rating: "Insufficient",
      evaluationSource: "deterministic_nlp",
      correctPoints: [],
      missingPoints: ["Answer is too brief to evaluate meaningfully"],
      incorrectPoints: [],
      grammarIssues: [],
      feedback: "Answer is too brief. A technical answer should explain the concept, mechanism, and practical implications.",
      betterAnswer: expected,
    };
  }

  // Extract concept tokens
  const candidateTokens = extractConceptTokens(ans);
  const expectedTokens = extractConceptTokens(expected);
  const questionTokens = extractConceptTokens(q.question || "");

  // Coverage of expected knowledge
  const { coverage } = measureCoverage(candidateTokens, expectedTokens);

  // Bonus signals
  const hasNegation = NEGATION_PATTERN.test(ans);
  const hasReasoning = REASONING_PATTERN.test(ans);
  const hasExample = EXAMPLE_PATTERN.test(ans);
  const hasTopicAware = hasTopicAwareness(candidateTokens, expectedTokens) ||
                         hasTopicAwareness(candidateTokens, questionTokens);

  // Base score from coverage
  let score = coverage * maxScore;

  // Reasoning bonus (up to 15% of maxScore)
  if (hasReasoning) score += maxScore * 0.1;
  if (hasExample) score += maxScore * 0.05;
  if (hasNegation && coverage > 0.2) score += maxScore * 0.05;

  // If no topic awareness at all, cap at 10%
  if (!hasTopicAware) score = Math.min(score, maxScore * 0.1);

  // Clamp
  score = Math.max(0, Math.min(maxScore, Math.round(score)));

  // Generate feedback
  const coveragePct = Math.round(coverage * 100);
  let rating = "Weak";
  if (score >= maxScore * 0.8) rating = "Strong";
  else if (score >= maxScore * 0.5) rating = "Acceptable";
  else if (score >= maxScore * 0.25) rating = "Partial";

  const missingPoints = [];
  if (coverage < 0.3) missingPoints.push("Key technical concepts from the expected answer were not covered");
  if (!hasReasoning) missingPoints.push("Reasoning or explanation of 'why/how' was missing");
  if (!hasExample && q.difficulty !== "easy") missingPoints.push("No concrete example or use case provided");

  return {
    questionId: qId,
    score,
    maxScore,
    difficulty: q.difficulty,
    rating,
    evaluationSource: "deterministic_nlp",
    correctPoints: coverage > 0.3 ? [`Demonstrated ~${coveragePct}% concept coverage from expected answer`] : [],
    missingPoints,
    incorrectPoints: [],
    grammarIssues: [],
    feedback: `Deterministic NLP evaluation (AI unavailable). Concept coverage: ~${coveragePct}%. ${
      hasReasoning ? "Reasoning detected. " : ""
    }${hasExample ? "Example usage detected. " : ""}Score: ${score}/${maxScore}.`,
    betterAnswer: expected,
  };
}

// -----------------------------------------------------------------------
// PROJECT ROUND EVALUATOR
// -----------------------------------------------------------------------

/**
 * Evaluate a single PROJECT question answer.
 */
function evaluateProjectQuestion(q) {
  const ans = String(q.candidateAnswer || "").trim();
  const expected = String(q.expectedKnowledge || q.question || "").trim();
  const maxScore = Number(q.maxScore || (q.difficulty === "easy" ? 5 : q.difficulty === "hard" ? 20 : 10));
  const qId = String(q.questionId);

  if (!ans || ans === "(No answer submitted)" || ans.toLowerCase() === "not answered") {
    return {
      questionId: qId,
      score: 0,
      maxScore,
      difficulty: q.difficulty,
      rating: "Not Attempted",
      evaluationSource: "deterministic_nlp",
      correctPoints: [],
      missingPoints: ["Question was not attempted"],
      incorrectPoints: [],
      grammarIssues: [],
      feedback: "Question was not attempted.",
      betterAnswer: expected,
    };
  }

  if (!isSubstantialAnswer(ans)) {
    return {
      questionId: qId,
      score: Math.round(maxScore * 0.05),
      maxScore,
      difficulty: q.difficulty,
      rating: "Insufficient",
      evaluationSource: "deterministic_nlp",
      correctPoints: [],
      missingPoints: ["Answer too brief for meaningful project evaluation"],
      incorrectPoints: [],
      grammarIssues: [],
      feedback: "Answer is too brief. Project answers should explain architecture, decisions, and trade-offs.",
      betterAnswer: expected,
    };
  }

  const candidateTokens = extractConceptTokens(ans);
  const expectedTokens = extractConceptTokens(expected);
  const questionTokens = extractConceptTokens(q.question || "");

  const { coverage } = measureCoverage(candidateTokens, expectedTokens);
  const hasTopicAware = hasTopicAwareness(candidateTokens, expectedTokens) ||
                         hasTopicAwareness(candidateTokens, questionTokens);

  // Project-specific: look for architectural/trade-off language
  const hasArchitecture = /\b(architect|design|structur|pattern|layer|module|service|api|flow|pipeline|endpoint|database|schema|auth|middleware|deploy|scale|bottleneck|trade.?off|decision|chose|because|instead|rather|performance|security|scalab|availability)\b/i.test(ans);
  const hasDebugging = /\b(debug|error|fix|issue|problem|resolv|found|discover|root.?cause|stack.?trace|log|monitor)\b/i.test(ans);
  const hasReasoning = REASONING_PATTERN.test(ans);

  let score = coverage * maxScore;
  if (hasArchitecture) score += maxScore * 0.12;
  if (hasReasoning) score += maxScore * 0.08;
  if (hasDebugging) score += maxScore * 0.05;
  if (!hasTopicAware) score = Math.min(score, maxScore * 0.1);

  score = Math.max(0, Math.min(maxScore, Math.round(score)));

  const coveragePct = Math.round(coverage * 100);
  let rating = "Weak";
  if (score >= maxScore * 0.8) rating = "Strong";
  else if (score >= maxScore * 0.5) rating = "Acceptable";
  else if (score >= maxScore * 0.25) rating = "Partial";

  const missingPoints = [];
  if (coverage < 0.3) missingPoints.push("Expected technical/architectural concepts not covered");
  if (!hasArchitecture) missingPoints.push("No architectural reasoning or design decisions mentioned");
  if (!hasReasoning) missingPoints.push("Missing reasoning for implementation choices");

  return {
    questionId: qId,
    score,
    maxScore,
    difficulty: q.difficulty,
    rating,
    evaluationSource: "deterministic_nlp",
    correctPoints: coverage > 0.25 ? [`~${coveragePct}% concept alignment with expected answer`] : [],
    missingPoints,
    incorrectPoints: [],
    grammarIssues: [],
    feedback: `Deterministic NLP evaluation (AI unavailable). Concept coverage: ~${coveragePct}%. ${
      hasArchitecture ? "Architectural reasoning detected. " : ""
    }Score: ${score}/${maxScore}.`,
    betterAnswer: expected,
  };
}

// -----------------------------------------------------------------------
// HR ROUND EVALUATOR
// -----------------------------------------------------------------------

// STAR behavioral markers
const STAR_SITUATION = /\b(situation|context|problem|challenge|scenario|issue|faced|encountered|happened|was)\b/i;
const STAR_ACTION = /\b(decided|took|approached|handled|communicated|escalated|prioritized|managed|implemented|chose|resolved|did|made|acted|led)\b/i;
const STAR_RESULT = /\b(result|outcome|impact|achieved|delivered|improved|reduced|increased|succeeded|learned|realized|ensured|resolved|completion)\b/i;
const STAR_REFLECTION = /\b(learned|realized|improved|changed|next time|would|better|growth|insight|reflection|take away)\b/i;

/**
 * Evaluate a single HR question answer.
 */
function evaluateHRQuestion(q) {
  const ans = String(q.candidateAnswer || "").trim();
  const maxScore = Number(q.maxScore || 20);
  const qId = String(q.questionId);

  if (!ans || ans === "(No answer provided)" || ans.toLowerCase() === "not answered") {
    return {
      questionId: qId,
      score: 0,
      maxScore,
      evaluationSource: "deterministic_nlp",
      behavioralDimensions: { ownership: 0, decisionMaking: 0, professionalMaturity: 0, confidence: 0 },
      reasoningStrengths: [],
      concerns: ["Question was not attempted"],
      feedback: "Question was not attempted.",
      betterAnswer: "A structured behavioral response addressing the situation, action taken, and outcome achieved.",
    };
  }

  if (!isSubstantialAnswer(ans)) {
    return {
      questionId: qId,
      score: Math.round(maxScore * 0.05),
      maxScore,
      evaluationSource: "deterministic_nlp",
      behavioralDimensions: { ownership: 1, decisionMaking: 1, professionalMaturity: 1, confidence: 1 },
      reasoningStrengths: [],
      concerns: ["Answer too brief for behavioral evaluation"],
      feedback: "Answer is too brief. HR answers should describe the situation, your actions, and the outcome.",
      betterAnswer: "A structured behavioral response with context, actions, and measurable results.",
    };
  }

  // Detect STAR elements
  const hasSituation = STAR_SITUATION.test(ans);
  const hasAction = STAR_ACTION.test(ans);
  const hasResult = STAR_RESULT.test(ans);
  const hasReflection = STAR_REFLECTION.test(ans);
  const hasReasoning = REASONING_PATTERN.test(ans);
  const hasOwnership = /\b(I |my |myself|took responsibility|my fault|I decided|I chose|I handled|I escalated|I managed)\b/i.test(ans);

  // Score from STAR components (20 marks total)
  let score = 0;
  const strengths = [];
  const concerns = [];

  // Situation (max 3 marks)
  if (hasSituation) { score += 3; strengths.push("Described the situation/context"); }
  else concerns.push("Situation or context not clearly described");

  // Action (max 6 marks — most important for HR)
  if (hasAction) {
    score += 5;
    strengths.push("Described actions taken");
    if (hasOwnership) { score += 1; strengths.push("Demonstrated personal ownership"); }
  } else {
    concerns.push("Actions taken not clearly described");
  }

  // Result (max 5 marks)
  if (hasResult) { score += 4; strengths.push("Stated outcome or result"); }
  else concerns.push("Outcome or result of the situation not mentioned");

  // Reasoning (max 3 marks)
  if (hasReasoning) { score += 2; strengths.push("Explained reasoning behind decisions"); }
  if (hasReflection) { score += 2; strengths.push("Demonstrated self-reflection or learning"); }

  // Word count bonus (longer thoughtful answer → more likely complete)
  const wordCount = ans.split(/\s+/).length;
  if (wordCount >= 80 && score >= 8) score = Math.min(maxScore, score + 1);

  score = Math.max(0, Math.min(maxScore, score));

  let rating = "Weak";
  if (score >= 16) rating = "Exceptional";
  else if (score >= 12) rating = "Strong";
  else if (score >= 8) rating = "Average";
  else if (score >= 4) rating = "Insufficient";

  const starCount = [hasSituation, hasAction, hasResult].filter(Boolean).length;
  const dimScore = Math.round((score / maxScore) * 5 * 10) / 10;

  return {
    questionId: qId,
    score,
    maxScore,
    evaluationSource: "deterministic_nlp",
    behavioralDimensions: {
      ownership: hasOwnership ? Math.min(5, dimScore + 0.5) : Math.max(0, dimScore - 1),
      decisionMaking: hasAction ? dimScore : Math.max(0, dimScore - 1),
      professionalMaturity: hasReflection ? Math.min(5, dimScore + 0.5) : dimScore,
      confidence: wordCount >= 50 ? dimScore : Math.max(0, dimScore - 0.5),
    },
    reasoningStrengths: strengths,
    concerns,
    feedback: `Deterministic behavioral evaluation (AI unavailable). STAR elements detected: ${starCount}/3. Score: ${score}/${maxScore}.`,
    betterAnswer: "A complete STAR response: (S) Describe the specific situation, (T) Your task or responsibility, (A) Concrete actions you took with reasoning, (R) The measurable result and what you learned.",
  };
}

// -----------------------------------------------------------------------
// BATCH EVALUATORS (main exports)
// -----------------------------------------------------------------------

/**
 * Generate a real deterministic evaluation for Technical questions.
 * Replaces the old fake-0 fallback.
 *
 * @param {Array} questionsToEvaluate - [{ questionId, question, candidateAnswer, expectedKnowledge, difficulty, maxScore }]
 * @param {string} reason - Why AI failed
 * @returns {{ evaluations, totalScore, maxScore, percentage, overallRating, strengths, weaknesses, finalFeedback, isFallback }}
 */
export function generateDeterministicTechnicalEvaluation(questionsToEvaluate, reason = "AI provider unavailable") {
  console.log(`\n[REAL-INTERVIEW][EVALUATION-FALLBACK]\nround=technical\nreason=${reason}\nevaluationSource=deterministic_nlp\n`);

  const evaluations = questionsToEvaluate.map(evaluateTechnicalQuestion);

  const totalScore = evaluations.reduce((sum, e) => sum + e.score, 0);
  const maxScoreTotal = 100;
  const percentage = Math.round((totalScore / maxScoreTotal) * 100);

  let overallRating = "Weak";
  if (percentage >= 80) overallRating = "Strong";
  else if (percentage >= 60) overallRating = "Average";
  else if (percentage >= 40) overallRating = "Needs Improvement";

  const answeredCount = evaluations.filter((e) => e.missingPoints[0] !== "Question was not attempted").length;

  return {
    evaluations,
    totalScore,
    maxScore: maxScoreTotal,
    percentage,
    overallRating,
    strengths: answeredCount > 0 ? ["Candidate attempted technical questions; scores reflect concept coverage"] : [],
    weaknesses: ["AI evaluation was unavailable; scores are based on NLP concept matching"],
    finalFeedback: `Technical evaluation completed with deterministic NLP fallback (AI unavailable: ${reason}). Scores reflect concept coverage vs expected knowledge.`,
    isFallback: true,
  };
}

/**
 * Generate a real deterministic evaluation for Project questions.
 */
export function generateDeterministicProjectEvaluation(questionsToEvaluate, reason = "AI provider unavailable") {
  console.log(`\n[REAL-INTERVIEW][EVALUATION-FALLBACK]\nround=project\nreason=${reason}\nevaluationSource=deterministic_nlp\n`);

  const evaluations = questionsToEvaluate.map(evaluateProjectQuestion);

  const totalScore = evaluations.reduce((sum, e) => sum + e.score, 0);
  const maxScoreTotal = 100;
  const percentage = Math.round((totalScore / maxScoreTotal) * 100);

  let overallRating = "Weak";
  if (percentage >= 80) overallRating = "Strong";
  else if (percentage >= 60) overallRating = "Average";
  else if (percentage >= 40) overallRating = "Needs Improvement";

  const answeredCount = evaluations.filter((e) => !e.missingPoints.includes("Question was not attempted")).length;

  return {
    evaluations,
    totalScore,
    maxScore: maxScoreTotal,
    percentage,
    overallRating,
    strengths: answeredCount > 0 ? ["Candidate attempted project questions; scores reflect architectural reasoning coverage"] : [],
    weaknesses: ["AI evaluation was unavailable; scores are based on NLP concept matching"],
    finalFeedback: `Project evaluation completed with deterministic NLP fallback (AI unavailable: ${reason}). Scores reflect concept and reasoning coverage.`,
    isFallback: true,
  };
}

/**
 * Generate a real deterministic evaluation for HR questions.
 */
export function generateDeterministicHREvaluation(qaPairs, reason = "AI provider unavailable") {
  console.log(`\n[REAL-INTERVIEW][EVALUATION-FALLBACK]\nround=hr\nreason=${reason}\nevaluationSource=deterministic_nlp\n`);

  const evaluations = qaPairs.map((pair) => evaluateHRQuestion({
    questionId: String(pair.questionId),
    candidateAnswer: pair.candidateAnswer,
    maxScore: 20,
    question: pair.question,
  }));

  const totalScore = evaluations.reduce((sum, e) => sum + e.score, 0);
  const maxScoreTotal = 100;
  const percentage = Math.round((totalScore / maxScoreTotal) * 100);

  let overallRating = "Weak";
  if (percentage >= 80) overallRating = "Strong";
  else if (percentage >= 60) overallRating = "Average";
  else if (percentage >= 40) overallRating = "Needs Improvement";

  return {
    evaluations,
    totalScore,
    maxScore: maxScoreTotal,
    percentage,
    overallRating,
    behavioralProfile: {
      ownership: evaluations.reduce((s, e) => s + (e.behavioralDimensions?.ownership || 0), 0) / evaluations.length,
      decisionMaking: evaluations.reduce((s, e) => s + (e.behavioralDimensions?.decisionMaking || 0), 0) / evaluations.length,
      professionalMaturity: evaluations.reduce((s, e) => s + (e.behavioralDimensions?.professionalMaturity || 0), 0) / evaluations.length,
    },
    consistencyObservations: [],
    strengths: ["Behavioral answers evaluated using STAR framework detection"],
    areasForImprovement: ["AI evaluation was unavailable; STAR completeness scoring used"],
    finalFeedback: `HR evaluation completed with deterministic NLP fallback (AI unavailable: ${reason}). Scores based on STAR element detection.`,
    isFallback: true,
  };
}
