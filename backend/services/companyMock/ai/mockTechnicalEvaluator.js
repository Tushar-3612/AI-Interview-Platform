import { isMockAIConfigured, mockAiGenerateJSON } from "../../ai/mockAiClient.js";

/**
 * Company Mock — AI prompt builder and response handler.
 *
 * Builds evaluation prompts for free-text technical answers and
 * processes AI responses into structured evaluation results.
 *
 * This module does NOT make API calls directly — it uses mockAiClient.
 */

/**
 * Build the AI evaluation prompt for a single technical question.
 * Returns a string prompt for the AI model.
 */
export function buildEvaluationPrompt({ question, topic, difficulty, candidateAnswer, expectedAnswer, marks }) {
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
 * Call the AI evaluator and return structured result.
 * Returns null if AI is unavailable (does NOT throw).
 */
export async function callAiEvaluator({ question, topic, difficulty, candidateAnswer, expectedAnswer, marks }) {
  const maxMarks = marks || 3;

  console.log("[COMPANY MOCK AI] Starting evaluation");
  console.log("[COMPANY MOCK AI] API configured:", isMockAIConfigured());

  if (!isMockAIConfigured()) {
    console.log("[COMPANY MOCK AI] AI not configured, returning null for fallback");
    return null;
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

    console.log("[COMPANY MOCK AI] Calling Mock AI provider");
    const result = await mockAiGenerateJSON(prompt, {
      temperature: 0.3,
      maxTokens: 1024,
      timeout: 60000,
    });

    console.log("[COMPANY MOCK AI] AI response received");

    // Validate and clamp the score
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
      betterAnswer: String(result?.betterAnswer || expectedAnswer || ""),
      status: "ai_evaluated",
    };
  } catch (error) {
    console.error("[COMPANY MOCK AI EVAL] AI evaluation failed:", error.message);
    return null;
  }
}
