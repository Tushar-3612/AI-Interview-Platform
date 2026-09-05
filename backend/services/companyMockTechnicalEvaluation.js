/**
 * Company Mock Technical Question AI Evaluation Service.
 *
 * Evaluates free-text/descriptive technical answers using AI (Groq).
 * Falls back gracefully when AI API is unavailable.
 *
 * This is ONLY used by Company Mock — Real Interview has its own evaluation.
 */

import { isMockAIConfigured, mockAiGenerateJSON } from "./ai/mockAiClient.js";

/**
 * Stopwords to exclude from keyword matching.
 */
const STOPWORDS = new Set([
  "a","an","the","is","are","was","were","be","been","being",
  "have","has","had","do","does","did","will","would","shall","should",
  "may","might","must","can","could","of","in","to","for","with","on",
  "at","from","by","about","as","into","through","during","before",
  "after","above","below","between","out","off","over","under","again",
  "further","then","once","here","there","when","where","why","how",
  "all","both","each","few","more","most","other","some","such","no",
  "nor","not","only","own","same","so","than","too","very","just",
  "don","now","and","but","or","if","while","that","this","these",
  "those","it","its","i","me","my","we","our","you","your","he","him",
  "his","she","her","they","them","their","what","which","who","whom",
  "up","down","also","like","well","much","many","get","got","make",
  "made","say","said","go","going","come","came","know","known",
  "think","think","take","taken","see","seen","want","use","used",
  "find","found","give","given","tell","told","work","call","need",
  "try","tried","ask","asked","put","keep","let","begin","seem",
  "help","show","hear","play","run","move","live","believe","bring",
  "happen","write","provide","sit","stand","lose","pay","meet","include",
  "continue","set","learn","change","lead","understand","watch","follow",
  "stop","create","speak","read","allow","add","spend","grow","open",
  "walk","win","offer","remember","love","consider","appear","buy","wait",
  "serve","die","send","expect","build","stay","fall","cut","reach",
  "kill","remain","suggest","raise","pass","sell","require","report",
  "decide","pull","develop","agree","support","hold","produce","eat",
  "apply","feel","especially","actually","however","typically","often",
  "using","used","based","may","can","will","also","rather","one",
  "two","three","four","five","first","second","third","new","old",
  "different","similar","important","example","part","number","type",
  "system","way","method","technique","approach","use","used","using",
]);

/**
 * Extract meaningful keywords from text.
 * Filters stopwords, short words, and normalizes.
 */
function extractKeywords(text) {
  if (!text) return new Set();
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s\-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
  );
}

/**
 * Deterministic fallback scoring using keyword/concept matching.
 *
 * Compares candidate answer against the stored expected answer.
 * Never exceeds maxMarks. Returns evaluationStatus: "fallback".
 */
function fallbackScore({ candidateAnswer, expectedAnswer, explanation, betterAnswer, maxMarks }) {
  const candidate = candidateAnswer.trim();
  const expected = (expectedAnswer || "").trim();

  if (!candidate) {
    return {
      score: 0,
      maxMarks,
      evaluation: "No answer provided.",
      strengths: [],
      weaknesses: ["No answer was submitted."],
      betterAnswer: betterAnswer || expectedAnswer || "",
      evaluationStatus: "fallback",
    };
  }

  if (!expected) {
    return {
      score: null,
      maxMarks,
      evaluation:
        "AI evaluation is not available and no reference answer is stored for automatic scoring. Your answer has been saved.",
      strengths: [],
      weaknesses: [],
      betterAnswer: betterAnswer || "",
      evaluationStatus: "fallback",
    };
  }

  // Extract keywords from both answers
  const candidateKeywords = extractKeywords(candidate);
  const expectedKeywords = extractKeywords(expected);

  if (expectedKeywords.size === 0) {
    return {
      score: null,
      maxMarks,
      evaluation:
        "AI evaluation is not available and the reference answer contains no scorable keywords. Your answer has been saved.",
      strengths: [],
      weaknesses: [],
      betterAnswer: betterAnswer || expected,
      evaluationStatus: "fallback",
    };
  }

  // Compute keyword overlap ratio
  let matchedCount = 0;
  for (const kw of expectedKeywords) {
    if (candidateKeywords.has(kw)) matchedCount++;
  }
  const overlapRatio = matchedCount / expectedKeywords.size;

  // Compute length ratio (penalize very short answers)
  const lengthRatio = Math.min(candidate.length / Math.max(expected.length, 1), 2);

  // Combined score: weighted combination
  // overlapRatio (0-1) is primary; lengthRatio adjusts for very short answers
  let rawScore = overlapRatio * 0.85 + Math.min(lengthRatio, 1) * 0.15;

  // Map to marks scale
  let score = Math.round(rawScore * maxMarks * 10) / 10;

  // Clamp to [0, maxMarks]
  if (score < 0) score = 0;
  if (score > maxMarks) score = maxMarks;

  // Build evaluation text
  const pctMatch = Math.round(overlapRatio * 100);
  let evaluation;
  if (overlapRatio >= 0.8) {
    evaluation = `Answer covers approximately ${pctMatch}% of the key concepts in the reference answer. Strong response.`;
  } else if (overlapRatio >= 0.5) {
    evaluation = `Answer covers approximately ${pctMatch}% of the key concepts. Good foundation but some important topics are missing.`;
  } else if (overlapRatio >= 0.2) {
    evaluation = `Answer covers approximately ${pctMatch}% of the key concepts. Significant gaps in the response.`;
  } else {
    evaluation = `Answer covers approximately ${pctMatch}% of the key concepts. The response is largely incomplete.`;
  }

  // Identify matched and missing concepts for strengths/weaknesses
  const matched = [...expectedKeywords].filter((kw) => candidateKeywords.has(kw)).slice(0, 5);
  const missing = [...expectedKeywords].filter((kw) => !candidateKeywords.has(kw)).slice(0, 5);

  return {
    score,
    maxMarks,
    evaluation,
    strengths: matched.length > 0 ? [`Covered concepts: ${matched.join(", ")}`] : [],
    weaknesses: missing.length > 0 ? [`Missing concepts: ${missing.join(", ")}`] : [],
    betterAnswer: betterAnswer || expected,
    evaluationStatus: "fallback",
  };
}

/**
 * Build the AI evaluation prompt for a single technical question.
 */
function buildEvaluationPrompt({ question, topic, difficulty, candidateAnswer, expectedAnswer, marks }) {
  const maxMarks = marks || 3;
  const diffContext = difficulty ? `Difficulty: ${difficulty} (${maxMarks} marks maximum).` : `${maxMarks} marks maximum.`;

  return `You are an expert technical interviewer evaluating a candidate's answer for a Data Scientist position.

QUESTION: ${question}
TOPIC: ${topic || "Technical"}
${diffContext}

CANDIDATE'S ANSWER:
${candidateAnswer}

${expectedAnswer ? `EXPECTED/REFERENCE ANSWER:\n${expectedAnswer}\n` : ""}

Evaluate the candidate's answer and return a JSON response with the following structure:
{
  "score": <number 0 to ${maxMarks}>,
  "evaluation": "<detailed evaluation of the answer quality, accuracy, and completeness>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "betterAnswer": "<an improved, comprehensive answer that the candidate could learn from>"
}

SCORING GUIDELINES:
- Score 0: Completely wrong, irrelevant, or no answer
- Score ${Math.ceil(maxMarks * 0.3)}: Partially correct but major gaps or misunderstandings
- Score ${Math.ceil(maxMarks * 0.6)}: Mostly correct but missing key concepts or examples
- Score ${Math.max(maxMarks - 1, Math.ceil(maxMarks * 0.8))}: Very good answer with minor gaps
- Score ${maxMarks}: Excellent, comprehensive, and accurate answer

Be fair but rigorous. The evaluation should be constructive and educational.
Return ONLY valid JSON, no markdown fences or extra text.`;
}

/**
 * Evaluate a single candidate answer using AI.
 * Returns: { score, maxMarks, evaluation, strengths, weaknesses, betterAnswer, status, evaluationStatus }
 */
export async function evaluateSingleAnswer({ question, topic, difficulty, candidateAnswer, expectedAnswer, explanation, betterAnswer, marks }) {
  const maxMarks = marks || 3;

  // If no answer provided, return zero score
  if (!candidateAnswer || !candidateAnswer.trim()) {
    return {
      score: 0,
      maxMarks,
      evaluation: "No answer provided.",
      strengths: [],
      weaknesses: ["No answer was submitted."],
      betterAnswer: betterAnswer || expectedAnswer || "",
      status: "fallback",
      evaluationStatus: "fallback",
    };
  }

  // If Company Mock AI key is not configured, use deterministic fallback scoring
  if (!isMockAIConfigured()) {
    return fallbackScore({
      candidateAnswer,
      expectedAnswer,
      explanation,
      betterAnswer,
      maxMarks,
    });
  }

  try {
    const prompt = buildEvaluationPrompt({
      question,
      topic,
      difficulty,
      candidateAnswer,
      expectedAnswer,
      marks: maxMarks,
    });

    const result = await mockAiGenerateJSON(prompt, {
      temperature: 0.3,
      maxTokens: 1024,
      timeout: 60000,
    });

    // Validate and clamp the score
    let score = Number(result?.score);
    if (isNaN(score) || score < 0) score = 0;
    if (score > maxMarks) score = maxMarks;
    score = Math.round(score * 10) / 10; // one decimal

    return {
      score,
      maxMarks,
      evaluation: String(result?.evaluation || "Evaluation completed."),
      strengths: Array.isArray(result?.strengths) ? result.strengths.map(String) : [],
      weaknesses: Array.isArray(result?.weaknesses) ? result.weaknesses.map(String) : [],
      betterAnswer: String(result?.betterAnswer || betterAnswer || expectedAnswer || ""),
      status: "ai_evaluated",
      evaluationStatus: "ai_evaluated",
    };
  } catch (error) {
    console.error("[COMPANY MOCK AI EVAL] Evaluation failed:", error.message);
    // AI failed — fall back to deterministic scoring
    return fallbackScore({
      candidateAnswer,
      expectedAnswer,
      explanation,
      betterAnswer,
      maxMarks,
    });
  }
}

/**
 * Evaluate multiple technical answers in sequence (to avoid rate limits).
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
