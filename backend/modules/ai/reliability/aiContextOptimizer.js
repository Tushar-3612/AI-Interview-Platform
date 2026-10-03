import { safeLogger } from "./utils/safeLogger.js";

/**
 * Optimizes and trims prompt context when token length limits are approached or exceeded.
 */
export class AIContextOptimizer {
  /**
   * Trims long text strings (such as resume text, project descriptions, or transcript histories)
   * while keeping front and back context.
   */
  static trimText(text, maxChars = 4000) {
    if (!text || typeof text !== "string" || text.length <= maxChars) {
      return text;
    }

    safeLogger.info(`[ContextOptimizer] Trimming text from ${text.length} to ${maxChars} chars.`);
    const headLen = Math.floor(maxChars * 0.6);
    const tailLen = Math.floor(maxChars * 0.35);

    const head = text.slice(0, headLen);
    const tail = text.slice(-tailLen);

    return `${head}\n\n[... Context truncated for token optimization ...]\n\n${tail}`;
  }

  /**
   * Optimizes prompt object or string context based on round type.
   */
  static optimizePrompt({ prompt, systemPrompt, roundType, isRetry = false }) {
    let optPrompt = prompt;
    let optSystem = systemPrompt;

    // Default max chars per round
    const maxCharsMap = {
      technical: 6000,
      project: 6000,
      hr: 4000,
      coding: 5000,
      evaluation: 6000
    };

    const limit = (maxCharsMap[roundType] || 6000) * (isRetry ? 0.7 : 1.0);

    if (typeof optPrompt === "string" && optPrompt.length > limit) {
      optPrompt = this.trimText(optPrompt, Math.floor(limit));
    }

    return {
      prompt: optPrompt,
      systemPrompt: optSystem
    };
  }
}

export default AIContextOptimizer;
