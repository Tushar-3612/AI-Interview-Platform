import { preprocessAnswer } from "../../realInterviewAI/answerPreprocessor.js";

/**
 * Isolated adapter for Individual Technical Answer Preprocessing.
 * Wraps existing preprocessAnswer without touching Real Interview files.
 */
export async function preprocessTechnicalAnswer(rawAnswer) {
  try {
    const res = await preprocessAnswer({ answer: rawAnswer, round: "technical" });
    return {
      originalText: res.originalAnswer || String(rawAnswer || ""),
      cleanText: res.compactAnswer || res.normalizedAnswer || String(rawAnswer || ""),
    };
  } catch (err) {
    console.error("[IndividualTechnicalAnswerPreprocessor] Preprocessing fallback:", err.message);
    return {
      originalText: String(rawAnswer || ""),
      cleanText: String(rawAnswer || ""),
    };
  }
}
