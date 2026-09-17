import { AIErrorClassifier, ERROR_CATEGORIES } from "./aiErrorClassifier.js";
import { AIBackoffManager } from "./aiBackoffManager.js";
import { safeLogger } from "./utils/safeLogger.js";

/**
 * Handles execution of AI operations with intelligent retry policy.
 */
export class AIRetryPolicy {
  /**
   * Executes a given async operation with retries.
   * @param {Function} operation Async function to execute: async (attempt, context) => result
   * @param {object} options Options: { maxRetries: 3, providerName: string, onContextTooLarge: Function }
   */
  static async execute(operation, options = {}) {
    const maxRetries = options.maxRetries ?? 3;
    const providerName = options.providerName || "ai-provider";

    let lastError = null;
    let lastClassification = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        if (attempt > 1) {
          safeLogger.info(`[AIRetryPolicy] Attempt ${attempt}/${maxRetries + 1} for ${providerName}`);
        }

        const result = await operation(attempt, {
          isRetry: attempt > 1,
          lastError: lastClassification
        });

        return result;
      } catch (err) {
        lastError = err;
        lastClassification = AIErrorClassifier.classify(err);

        safeLogger.warn(`[AIRetryPolicy] Attempt ${attempt} failed with [${lastClassification.category}]: ${lastClassification.userFacingMessage}`);

        // Non-retryable errors stop immediately!
        if (!lastClassification.isRetryable) {
          safeLogger.error(`[AIRetryPolicy] Non-retryable error [${lastClassification.category}] encountered. Stopping immediately.`);
          const stopErr = new Error(lastClassification.userFacingMessage);
          stopErr.category = lastClassification.category;
          stopErr.isRetryable = false;
          stopErr.statusCode = lastClassification.statusCode;
          stopErr.originalError = err;
          throw stopErr;
        }

        // Handle context length exceeded specifically
        if (lastClassification.category === ERROR_CATEGORIES.CONTEXT_TOO_LARGE && typeof options.onContextTooLarge === "function") {
          try {
            options.onContextTooLarge();
          } catch (trimErr) {
            safeLogger.warn(`[AIRetryPolicy] Context trim hook failed: ${trimErr.message}`);
          }
        }

        // If maximum attempts reached, break loop and throw
        if (attempt > maxRetries) {
          safeLogger.error(`[AIRetryPolicy] Maximum retries (${maxRetries}) exhausted for ${providerName}.`);
          break;
        }

        // Calculate delay and wait
        const delayMs = AIBackoffManager.calculateDelay(
          attempt,
          options.backoffOptions || {},
          lastClassification.retryAfterHeader
        );

        safeLogger.info(`[AIRetryPolicy] Waiting ${delayMs}ms before attempt ${attempt + 1}...`);
        await AIBackoffManager.wait(delayMs);
      }
    }

    const finalErr = new Error(lastClassification?.userFacingMessage || lastError?.message || "AI Request failed after retries");
    finalErr.category = lastClassification?.category || ERROR_CATEGORIES.UNKNOWN_ERROR;
    finalErr.isRetryable = true;
    finalErr.statusCode = lastClassification?.statusCode;
    finalErr.originalError = lastError;
    throw finalErr;
  }
}

export default AIRetryPolicy;
