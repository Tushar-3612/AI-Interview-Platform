import { safeLogger } from "./utils/safeLogger.js";

export const CIRCUIT_STATES = {
  CLOSED: "CLOSED",
  OPEN: "OPEN",
  HALF_OPEN: "HALF_OPEN"
};

/**
 * Implements Circuit Breaker pattern for AI Providers.
 */
export class AICircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeoutMs = options.resetTimeoutMs || 60000;
    this.halfOpenSuccessThreshold = options.halfOpenSuccessThreshold || 2;

    this.breakers = new Map();
  }

  _getBreaker(providerName) {
    const name = String(providerName).toLowerCase();
    if (!this.breakers.has(name)) {
      this.breakers.set(name, {
        state: CIRCUIT_STATES.CLOSED,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        nextAttemptTime: 0
      });
    }
    return this.breakers.get(name);
  }

  /**
   * Asserts whether execution is allowed for provider.
   * Throws Error if circuit is OPEN.
   */
  canExecute(providerName) {
    const breaker = this._getBreaker(providerName);
    const now = Date.now();

    if (breaker.state === CIRCUIT_STATES.OPEN) {
      if (now >= breaker.nextAttemptTime) {
        breaker.state = CIRCUIT_STATES.HALF_OPEN;
        breaker.consecutiveSuccesses = 0;
        safeLogger.warn(`[CircuitBreaker] Provider '${providerName}' entering HALF_OPEN trial state.`);
        return true;
      }
      const waitSec = Math.ceil((breaker.nextAttemptTime - now) / 1000);
      const err = new Error(`Provider '${providerName}' circuit is OPEN due to repeated failures. Retry in ${waitSec}s.`);
      err.category = "CIRCUIT_OPEN";
      err.isRetryable = false;
      throw err;
    }

    return true;
  }

  recordSuccess(providerName) {
    const breaker = this._getBreaker(providerName);
    if (breaker.state === CIRCUIT_STATES.HALF_OPEN) {
      breaker.consecutiveSuccesses++;
      if (breaker.consecutiveSuccesses >= this.halfOpenSuccessThreshold) {
        breaker.state = CIRCUIT_STATES.CLOSED;
        breaker.consecutiveFailures = 0;
        safeLogger.info(`[CircuitBreaker] Provider '${providerName}' circuit fully RE-CLOSED after successful trials.`);
      }
    } else if (breaker.state === CIRCUIT_STATES.CLOSED) {
      breaker.consecutiveFailures = 0;
    }
  }

  recordFailure(providerName, errorCategory) {
    // Ignore key-specific auth errors from tripping provider-wide circuit
    if (errorCategory === "INVALID_AUTH" || errorCategory === "PERMANENT_QUOTA") {
      return;
    }

    const breaker = this._getBreaker(providerName);
    breaker.consecutiveFailures++;

    if (breaker.state === CIRCUIT_STATES.HALF_OPEN || breaker.consecutiveFailures >= this.failureThreshold) {
      breaker.state = CIRCUIT_STATES.OPEN;
      breaker.nextAttemptTime = Date.now() + this.resetTimeoutMs;
      safeLogger.error(`[CircuitBreaker] Provider '${providerName}' circuit TRIPPED to OPEN state for ${this.resetTimeoutMs}ms.`);
    }
  }

  reset(providerName) {
    if (providerName) {
      this.breakers.delete(String(providerName).toLowerCase());
    } else {
      this.breakers.clear();
    }
  }
}

export const circuitBreaker = new AICircuitBreaker();
export default circuitBreaker;
