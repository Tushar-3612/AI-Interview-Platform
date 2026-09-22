import { normalizeProviderError } from "./utils/normalizeProviderError.js";

export const ERROR_CATEGORIES = {
  INVALID_AUTH: "INVALID_AUTH",
  PERMANENT_QUOTA: "PERMANENT_QUOTA",
  RATE_LIMIT: "RATE_LIMIT",
  TIMEOUT: "TIMEOUT",
  TRANSIENT_PROVIDER: "TRANSIENT_PROVIDER",
  INVALID_JSON: "INVALID_JSON",
  CONTEXT_TOO_LARGE: "CONTEXT_TOO_LARGE",
  MODEL_UNAVAILABLE: "MODEL_UNAVAILABLE",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
  AI_PROVIDER_AUTH_ERROR: "AI_PROVIDER_AUTH_ERROR",
  AI_PROVIDER_RATE_LIMIT: "AI_PROVIDER_RATE_LIMIT",
  AI_PROVIDER_TIMEOUT: "AI_PROVIDER_TIMEOUT",
  AI_PROVIDER_UNAVAILABLE: "AI_PROVIDER_UNAVAILABLE",
  AI_INVALID_JSON: "AI_INVALID_JSON",
  AI_SCHEMA_VALIDATION_ERROR: "AI_SCHEMA_VALIDATION_ERROR",
  AI_EMPTY_RESPONSE: "AI_EMPTY_RESPONSE",
  AI_TRUNCATED_JSON: "AI_TRUNCATED_JSON",
  AI_EVALUATION_PARSE_ERROR: "AI_EVALUATION_PARSE_ERROR",
  AI_EVALUATION_UNAVAILABLE: "AI_EVALUATION_UNAVAILABLE",
};

/**
 * Classifies raw or normalized errors into standard error categories & retryability flags.
 */
export class AIErrorClassifier {
  static classify(error) {
    const normalized = normalizeProviderError(error);
    const { statusCode, rawSafeError } = normalized;
    const message = rawSafeError || error?.message || String(error || "");
    const lowerMsg = (message || "").toLowerCase();

    let category = ERROR_CATEGORIES.UNKNOWN_ERROR;
    let isRetryable = true; // Default UNKNOWN_ERROR to retryable with retry limits instead of failing permanently!
    let userFacingMessage = "An unexpected AI provider error occurred. Retrying operation...";

    // 1. Invalid Auth (Permanent)
    if (
      statusCode === 401 ||
      statusCode === 403 ||
      lowerMsg.includes("invalid api key") ||
      lowerMsg.includes("incorrect api key") ||
      lowerMsg.includes("unauthorized") ||
      lowerMsg.includes("authentication failed") ||
      lowerMsg.includes("access denied") ||
      lowerMsg.includes("auth_error")
    ) {
      category = ERROR_CATEGORIES.INVALID_AUTH;
      isRetryable = false;
      userFacingMessage = "Your provided API key is invalid or unauthorized. Please verify your API key.";
    }
    // 2. Permanent Quota / Billing Disabled (Permanent)
    else if (
      statusCode === 402 ||
      lowerMsg.includes("billing") ||
      lowerMsg.includes("quota exceeded") ||
      lowerMsg.includes("insufficient_quota") ||
      lowerMsg.includes("credit balance") ||
      lowerMsg.includes("payment required") ||
      lowerMsg.includes("exceeded your current quota")
    ) {
      category = ERROR_CATEGORIES.PERMANENT_QUOTA;
      isRetryable = false;
      userFacingMessage = "The API key has exceeded its quota or has billing disabled.";
    }
    // 3. Rate Limit / Throttle (Retryable)
    else if (
      statusCode === 429 ||
      statusCode === 413 ||
      lowerMsg.includes("rate limit") ||
      lowerMsg.includes("too many requests") ||
      lowerMsg.includes("tokens per minute") ||
      lowerMsg.includes("requests per minute") ||
      lowerMsg.includes("tpm") ||
      lowerMsg.includes("rpm")
    ) {
      category = ERROR_CATEGORIES.RATE_LIMIT;
      isRetryable = true;
      userFacingMessage = "AI rate limit reached. Retrying automatically with backoff...";
    }
    // 4. Timeout (Retryable)
    else if (
      statusCode === 408 ||
      statusCode === 504 ||
      lowerMsg.includes("timed out") ||
      lowerMsg.includes("timeout") ||
      lowerMsg.includes("deadline exceeded")
    ) {
      category = ERROR_CATEGORIES.TIMEOUT;
      isRetryable = true;
      userFacingMessage = "AI request timed out. Retrying execution...";
    }
    // 5. Transient Provider Error / Network Error (Retryable)
    else if (
      statusCode === 500 ||
      statusCode === 502 ||
      statusCode === 503 ||
      lowerMsg.includes("econnreset") ||
      lowerMsg.includes("etimedout") ||
      lowerMsg.includes("internal server error") ||
      lowerMsg.includes("bad gateway") ||
      lowerMsg.includes("service unavailable") ||
      lowerMsg.includes("overloaded") ||
      // Windows socket errors (WinError 10054 / WSASEND) — network disruption on Windows
      lowerMsg.includes("wsasend") ||
      lowerMsg.includes("winerror 10054") ||
      lowerMsg.includes("forcibly closed") ||
      lowerMsg.includes("econnrefused") ||
      lowerMsg.includes("epipe") ||
      lowerMsg.includes("network error") ||
      lowerMsg.includes("socket hang up") ||
      lowerMsg.includes("connection reset")
    ) {
      category = ERROR_CATEGORIES.TRANSIENT_PROVIDER;
      isRetryable = true;
      userFacingMessage = "AI provider server experienced a temporary issue. Retrying...";
    }
    // 6. Context Length Exceeded (Retryable with trim)
    else if (
      (statusCode === 400 && (lowerMsg.includes("context length") || lowerMsg.includes("maximum context") || lowerMsg.includes("token count"))) ||
      lowerMsg.includes("too long") || lowerMsg.includes("max_tokens")
    ) {
      category = ERROR_CATEGORIES.CONTEXT_TOO_LARGE;
      isRetryable = true;
      userFacingMessage = "Prompt context exceeded model limit. Trimming context and retrying...";
    }
    // 7. Model Unavailable (Permanent)
    else if (
      statusCode === 404 ||
      lowerMsg.includes("model not found") ||
      lowerMsg.includes("does not exist")
    ) {
      category = ERROR_CATEGORIES.MODEL_UNAVAILABLE;
      isRetryable = false;
      userFacingMessage = "The requested AI model is unavailable or non-existent.";
    }
    // 8. Invalid JSON format error (Retryable)
    else if (
      lowerMsg.includes("json parse error") ||
      lowerMsg.includes("could not extract valid json") ||
      lowerMsg.includes("invalid json structure") ||
      lowerMsg.includes("unexpected token")
    ) {
      category = ERROR_CATEGORIES.INVALID_JSON;
      isRetryable = true;
      userFacingMessage = "AI returned malformed output. Attempting JSON repair and retry...";
    }

    return {
      category,
      isRetryable,
      statusCode,
      rawMessage: message,
      userFacingMessage,
      retryAfterHeader: normalized.retryAfter
    };
  }
}

export default AIErrorClassifier;
