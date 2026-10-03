import { safeLogger } from "./safeLogger.js";

/**
 * AI Provider Concurrency Limiter
 * ---------------------------------------------------------------------------
 * Protects external AI providers from concurrent request storms (e.g. 200–300
 * students initiating interviews simultaneously).
 *
 * Instead of firing 300 unbounded outbound HTTP requests (which causes 429s and
 * socket timeouts), requests acquire a concurrency slot per provider.
 * Independent requests are queued safely with a timeout and processed with
 * maximum safe throughput.
 */
class AIConcurrencyLimiter {
  constructor() {
    this.activeCounts = new Map();
    this.queues = new Map();
    this.limits = {
      groq: 25,
      gemini: 20,
      openrouter: 20,
      openai: 20,
      deepseek: 15,
      default: 20,
    };
  }

  getLimit(providerName) {
    const p = String(providerName || "default").toLowerCase().trim();
    return this.limits[p] || this.limits.default;
  }

  getActiveCount(providerName) {
    const p = String(providerName || "default").toLowerCase().trim();
    return this.activeCounts.get(p) || 0;
  }

  getQueueLength(providerName) {
    const p = String(providerName || "default").toLowerCase().trim();
    return (this.queues.get(p) || []).length;
  }

  /**
   * Acquire a concurrency permit for the given provider.
   * @param {string} providerName
   * @param {number} timeoutMs
   * @returns {Promise<Function>} release function to call when execution finishes
   */
  async acquire(providerName, timeoutMs = 45000) {
    const p = String(providerName || "default").toLowerCase().trim();
    const limit = this.getLimit(p);

    if (!this.activeCounts.has(p)) this.activeCounts.set(p, 0);
    if (!this.queues.has(p)) this.queues.set(p, []);

    const currentActive = this.activeCounts.get(p);

    if (currentActive < limit) {
      this.activeCounts.set(p, currentActive + 1);
      return () => this.release(p);
    }

    // Must queue
    safeLogger.info(`[AIConcurrencyLimiter] Provider [${p}] at capacity (${currentActive}/${limit}). Queuing request...`);

    return new Promise((resolve, reject) => {
      const queue = this.queues.get(p);

      const timer = setTimeout(() => {
        const idx = queue.findIndex((item) => item.resolve === resolve);
        if (idx !== -1) {
          queue.splice(idx, 1);
          safeLogger.warn(`[AIConcurrencyLimiter] Request queued for [${p}] timed out after ${timeoutMs}ms.`);
          const err = new Error(`AI Provider [${p}] is busy under high load. Please try again in a few moments.`);
          err.category = "CONCURRENCY_TIMEOUT";
          err.statusCode = 503;
          reject(err);
        }
      }, timeoutMs);

      queue.push({
        resolve: () => {
          clearTimeout(timer);
          resolve(() => this.release(p));
        },
        reject,
      });
    });
  }

  release(providerName) {
    const p = String(providerName || "default").toLowerCase().trim();
    const queue = this.queues.get(p) || [];

    if (queue.length > 0) {
      const next = queue.shift();
      next.resolve();
    } else {
      const current = this.activeCounts.get(p) || 1;
      this.activeCounts.set(p, Math.max(0, current - 1));
    }
  }

  /**
   * Execute an async AI operation under controlled concurrency.
   */
  async runWithConcurrencyLimit(providerName, fn, timeoutMs = 45000) {
    const release = await this.acquire(providerName, timeoutMs);
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

export const aiConcurrencyLimiter = new AIConcurrencyLimiter();
export default aiConcurrencyLimiter;
