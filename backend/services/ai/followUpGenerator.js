import { aiGenerateJSON } from "./aiClient.js";
import { buildFollowUpPrompt } from "./aiPrompts.js";

/**
 * Decides whether a contextual follow-up question is appropriate, based on the
 * candidate's answer and interview context. Returns a safe default when the AI
 * is unavailable or the response is malformed — it NEVER invents a question.
 */
export async function generateFollowUp(ctx = {}) {
  const defaultResponse = { shouldFollowUp: false };

  try {
    const prompt = buildFollowUpPrompt(ctx);
    const data = await aiGenerateJSON(prompt, { temperature: 0.6 });

    if (!data || typeof data.shouldFollowUp !== "boolean") {
      return defaultResponse;
    }
    if (data.shouldFollowUp !== true) {
      return { shouldFollowUp: false };
    }
    if (!data.question || !String(data.question).trim()) {
      return defaultResponse;
    }
    return {
      shouldFollowUp: true,
      question: String(data.question).trim(),
      reason: data.reason || "",
      topic: data.topic || ctx.section || "General",
    };
  } catch (err) {
    return defaultResponse;
  }
}
