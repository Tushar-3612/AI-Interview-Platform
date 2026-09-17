/**
 * Manages exponential backoff calculation, jitter, and Retry-After header parsing.
 */
export class AIBackoffManager {
  /**
   * Calculates backoff delay in milliseconds.
   * @param {number} attempt Attempt number (1-based index)
   * @param {object} options Config options
   * @param {string|number} retryAfterHeader Optional Retry-After header
   */
  static calculateDelay(attempt, options = {}, retryAfterHeader = null) {
    const initialDelayMs = options.initialDelayMs || 1000;
    const maxDelayMs = options.maxDelayMs || 30000;
    const factor = options.factor || 2;
    const useJitter = options.useJitter !== false;

    // Check Retry-After header if provided
    if (retryAfterHeader) {
      const headerDelay = this.parseRetryAfter(retryAfterHeader);
      if (headerDelay > 0) {
        return Math.min(headerDelay, maxDelayMs);
      }
    }

    // Exponential backoff: initial * (factor ^ (attempt - 1))
    const rawDelay = initialDelayMs * Math.pow(factor, Math.max(0, attempt - 1));
    const cappedDelay = Math.min(rawDelay, maxDelayMs);

    if (useJitter) {
      // Full jitter: Random value between cappedDelay * 0.5 and cappedDelay * 1.5
      const jitterRange = cappedDelay * 0.5;
      const jittered = cappedDelay * 0.5 + Math.random() * jitterRange * 2;
      return Math.min(Math.round(jittered), maxDelayMs);
    }

    return Math.round(cappedDelay);
  }

  /**
   * Parses a Retry-After header value into milliseconds.
   * Can be either seconds ("120") or HTTP date ("Wed, 21 Oct 2015 07:28:00 GMT").
   */
  static parseRetryAfter(headerValue) {
    if (!headerValue) return 0;

    const parsedSeconds = parseInt(headerValue, 10);
    if (!isNaN(parsedSeconds) && parsedSeconds >= 0) {
      return parsedSeconds * 1000;
    }

    const parsedDate = Date.parse(headerValue);
    if (!isNaN(parsedDate)) {
      const diffMs = parsedDate - Date.now();
      return diffMs > 0 ? diffMs : 0;
    }

    return 0;
  }

  /**
   * Pauses execution for specified milliseconds.
   */
  static async wait(ms) {
    if (ms <= 0) return;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default AIBackoffManager;
