import { isBenchmarkAIConfigured, benchmarkAiGenerateJSON } from "../ai/benchmarkAiClient.js";
import { computeFallbackScore } from "./technicalFallback.js";

/**
 * Benchmark Company Mock — Dedicated Technical Evaluator.
 *
 * Evaluates free-text technical / TITA answers specifically for Benchmark IT Solutions Mock Interviews.
 * Uses benchmarkAiClient (BENCHMARK_MOCK_KEY) and strictly enforces score limits:
 * Easy = max 2, Medium = max 3, Hard = max 5.
 */

/**
 * Build the Benchmark technical evaluation prompt.
 */
export function buildBenchmarkEvaluationPrompt({ question, topic, difficulty, candidateAnswer, expectedAnswer, explanation, betterAnswer, marks }) {
  const maxMarks = marks || (difficulty === "Easy" ? 2 : difficulty === "Hard" ? 5 : 3);
  const diffLabel = difficulty || "Medium";

  return `You are an expert technical interviewer evaluating a candidate's answer for a Software Engineer / Developer role at Benchmark IT Solutions.

QUESTION: ${question}
TOPIC: ${topic || "Technical Fundamentals & DSA/OOP/DBMS"}
DIFFICULTY: ${diffLabel} (Maximum Marks: ${maxMarks})

CANDIDATE'S ANSWER:
${candidateAnswer}

${expectedAnswer ? `EXPECTED/REFERENCE ANSWER:\n${expectedAnswer}\n` : ""}
${explanation ? `CONCEPTUAL EXPLANATION:\n${explanation}\n` : ""}
${betterAnswer ? `MODEL INTERVIEW ANSWER:\n${betterAnswer}\n` : ""}

EVALUATION CRITERIA:
1. Correctness & Technical Accuracy: Is the core technical concept, algorithm, complexity, or query accurate?
2. Conceptual Understanding: Does the candidate grasp underlying principles, architecture, or mechanisms (e.g. DSA, OOP, DBMS, SQL, Web)?
3. Completeness & Relevance: Did the answer address the specific technical components asked?
4. Synonym / Paraphrase Awareness: Accept valid paraphrasing, alternative technical terminology, and concise correct descriptions (e.g., "primary key prevents duplicates" == "enforces uniqueness"). Do not penalize for wording variations.
5. Missing Concepts Penalty: Penalize omitted core aspects, but do NOT reward keyword stuffing or empty buzzwords.

Score Constraints:
- Score MUST be a number between 0 and ${maxMarks}. Never exceed ${maxMarks}.
- Easy question: 0 to 2 marks
- Medium question: 0 to 3 marks
- Hard question: 0 to 5 marks

SCORING GUIDELINES:
- Score 0: Completely incorrect, irrelevant, or non-technical gibberish.
- Partial score (~30-50%): Basic concept stated but major omissions or minor errors.
- Substantial score (~70-85%): Accurate core concepts, minor missing nuances.
- Full marks (${maxMarks}): Complete, technically accurate, clear, and well-explained answer.

Return ONLY a valid JSON object with this exact structure:
{
  "score": <number from 0 to ${maxMarks}>,
  "evaluation": "<constructive evaluation summary of candidate answer>",
  "strengths": ["<key strength 1>", "<key strength 2>"],
  "weaknesses": ["<area to improve 1>"],
  "betterAnswer": "<comprehensive, interview-ready model answer>"
}`;
}

/**
 * Evaluate a candidate's technical answer for Benchmark.
 *
 * If AI evaluation succeeds, returns structured AI evaluation.
 * If AI evaluation is unconfigured or fails (network, rate limit, timeout, malformed JSON),
 * falls back deterministically to the backend reference answer without crashing.
 */
export async function evaluateBenchmarkSingleAnswer({
  question,
  topic,
  difficulty,
  candidateAnswer,
  expectedAnswer,
  explanation,
  betterAnswer,
  marks,
}) {
  const maxMarks = marks || (difficulty === "Easy" ? 2 : difficulty === "Hard" ? 5 : 3);

  // 1. Empty answer check
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

  // 2. Try Benchmark AI evaluation
  if (isBenchmarkAIConfigured()) {
    try {
      const prompt = buildBenchmarkEvaluationPrompt({
        question,
        topic,
        difficulty,
        candidateAnswer,
        expectedAnswer,
        explanation,
        betterAnswer,
        marks: maxMarks,
      });

      const result = await benchmarkAiGenerateJSON(prompt, {
        temperature: 0.25,
        maxTokens: 1024,
      });

      // Strictly clamp score within [0, maxMarks]
      let score = Number(result?.score);
      if (isNaN(score) || score < 0) score = 0;
      if (score > maxMarks) score = maxMarks;
      score = Math.round(score * 10) / 10;

      return {
        score,
        maxMarks,
        evaluation: String(result?.evaluation || "Evaluation completed."),
        strengths: Array.isArray(result?.strengths) ? result.strengths.map(String) : [],
        weaknesses: Array.isArray(result?.weaknesses) ? result.weaknesses.map(String) : [],
        betterAnswer: String(result?.betterAnswer || betterAnswer || expectedAnswer || ""),
        expectedAnswer: expectedAnswer || "",
        explanation: explanation || "",
        evaluationStatus: "ai_evaluated",
      };
    } catch (error) {
      console.log(`[Benchmark AI] Evaluation fallback triggered: ${error.message}`);
    }
  }

  // 3. Deterministic fallback scoring (used when AI is unconfigured or fails)
  const fallbackResult = computeFallbackScore({
    candidateAnswer,
    expectedAnswer,
    explanation,
    betterAnswer,
    maxMarks,
    question,
  });

  return {
    ...fallbackResult,
    expectedAnswer: expectedAnswer || "",
    explanation: explanation || "",
    evaluationStatus: "fallback",
  };
}

export const evaluateBenchmarkTechnicalAnswer = (questionObj, candidateAnswer) => {
  return evaluateBenchmarkSingleAnswer({
    question: questionObj.question,
    topic: questionObj.topic || questionObj.category,
    difficulty: questionObj.difficulty,
    candidateAnswer,
    expectedAnswer: questionObj.expectedAnswer,
    explanation: questionObj.explanation,
    betterAnswer: questionObj.betterAnswer,
    marks: questionObj.marks,
  });
};

export function getBenchmarkDeterministicFallback(questionObj, candidateAnswer) {
  const maxMarks = questionObj.marks || (questionObj.difficulty === "Easy" ? 2 : questionObj.difficulty === "Hard" ? 5 : 3);
  const fallback = computeFallbackScore({
    candidateAnswer,
    expectedAnswer: questionObj.expectedAnswer,
    explanation: questionObj.explanation,
    betterAnswer: questionObj.betterAnswer,
    maxMarks,
    question: questionObj.question,
  });
  return {
    ...fallback,
    expectedAnswer: questionObj.expectedAnswer || "",
    explanation: questionObj.explanation || "",
    evaluationStatus: "fallback",
  };
}
