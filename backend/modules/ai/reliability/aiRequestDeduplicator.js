import { safeLogger } from "./utils/safeLogger.js";

/**
 * Handles request deduplication using:
 * 1. In-flight Promise locking (prevents concurrent identical AI calls in process).
 * 2. Database existence check hook (prevents duplicate generation if DB already has slot).
 */
export class AIRequestDeduplicator {
  constructor() {
    this.inFlightLocks = new Map();
  }

  /**
   * Executes AI request with in-flight locking and DB check.
   * @param {string} fingerprint Unique request key (e.g. "sessionId:roundType:orderIndex")
   * @param {object} context Context object containing dbCheckFn if applicable
   * @param {Function} executor Async function to generate result if not deduplicated
   */
  async deduplicate(fingerprint, context = {}, executor) {
    if (!fingerprint) {
      return await executor();
    }

    // Layer 2 Check: Database existence check if dbCheckFn provided
    if (typeof context.dbCheckFn === "function") {
      try {
        const existingData = await context.dbCheckFn();
        if (existingData) {
          safeLogger.info(`[Deduplicator] DB match found for fingerprint [${fingerprint}]. Skipping AI execution.`);
          return existingData;
        }
      } catch (dbErr) {
        safeLogger.warn(`[Deduplicator] DB pre-check error for [${fingerprint}]: ${dbErr.message}`);
      }
    }

    // Layer 1 Check: In-flight Promise lock
    if (this.inFlightLocks.has(fingerprint)) {
      safeLogger.info(`[Deduplicator] In-flight request detected for [${fingerprint}]. Waiting for original promise...`);
      return await this.inFlightLocks.get(fingerprint);
    }

    // Create and store execution promise
    const executionPromise = (async () => {
      try {
        const result = await executor();
        return result;
      } finally {
        this.inFlightLocks.delete(fingerprint);
      }
    })();

    this.inFlightLocks.set(fingerprint, executionPromise);
    return await executionPromise;
  }

  clear() {
    this.inFlightLocks.clear();
  }
}

export const requestDeduplicator = new AIRequestDeduplicator();
export default requestDeduplicator;
