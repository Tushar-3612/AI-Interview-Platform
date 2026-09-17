/**
 * Centralized API error classification for Real Interview AI calls.
 * Classifies HTTP statuses, rate limits, quota exhaustion, timeouts, and structural failures.
 */
export function classifyInterviewAIError(error) {
  const errMsg = String(error?.message || error || "").trim();
  const status = error?.status || (errMsg.match(/HTTP\s+(\d{3})/) ? parseInt(errMsg.match(/HTTP\s+(\d{3})/)[1], 10) : 0);

  // 401 / 403 Unauthorized / Invalid Key
  if (status === 401 || status === 403 || errMsg.includes("401") || errMsg.includes("403") || errMsg.includes("Invalid API Key") || errMsg.includes("unauthorized") || errMsg.includes("API key is not configured")) {
    return {
      code: "UNAUTHORIZED",
      status: 401,
      recoverable: false,
      isQuotaExhausted: false,
      message: "The AI service API key is invalid or unauthorized. Please verify server configuration.",
    };
  }

  // 404 Model / Provider Not Found
  if (status === 404 || errMsg.includes("404") || errMsg.includes("Model not found") || errMsg.includes("Decommissioned")) {
    return {
      code: "MODEL_UNAVAILABLE",
      status: 404,
      recoverable: false,
      isQuotaExhausted: false,
      message: "The requested AI model is currently unavailable on the provider platform.",
    };
  }

  // 429 Quota Exhausted (Daily RPD or account balance)
  const isQuota = errMsg.includes("RPD") || errMsg.includes("daily quota") || errMsg.includes("quota exceeded") || errMsg.includes("insufficient_quota");
  if (isQuota) {
    return {
      code: "QUOTA_EXHAUSTED",
      status: 429,
      recoverable: true,
      isQuotaExhausted: true,
      message: "The AI provider daily usage quota has been exhausted. Please try again later.",
    };
  }

  // 429 Rate Limit (TPM / Requests per minute)
  if (status === 429 || errMsg.includes("429") || errMsg.includes("rate_limit") || errMsg.includes("TPM")) {
    return {
      code: "RATE_LIMIT_EXCEEDED",
      status: 429,
      recoverable: true,
      isQuotaExhausted: false,
      retryAfter: error?.retryAfter || 5,
      message: "The AI service is temporarily rate limited. Questions generated so far are saved.",
    };
  }

  // Timeout / Network Error
  if (status === 408 || status === 504 || errMsg.includes("timed out") || errMsg.includes("ETIMEDOUT") || errMsg.includes("ECONNRESET")) {
    return {
      code: "REQUEST_TIMEOUT",
      status: 408,
      recoverable: true,
      isQuotaExhausted: false,
      message: "The AI request timed out. Questions generated so far are safely saved.",
    };
  }

  // 5xx Server Error
  if ((status >= 500 && status < 600) || errMsg.includes("500") || errMsg.includes("502") || errMsg.includes("503")) {
    return {
      code: "PROVIDER_SERVER_ERROR",
      status: status || 500,
      recoverable: true,
      isQuotaExhausted: false,
      message: "The AI service provider returned a temporary server error. Saved progress retained.",
    };
  }

  // Structural / JSON / Duplicate failure
  if (errMsg.includes("JSON") || errMsg.includes("empty") || errMsg.includes("duplicate") || errMsg.includes("Insufficient")) {
    return {
      code: "MALFORMED_OUTPUT",
      status: 422,
      recoverable: true,
      isQuotaExhausted: false,
      message: "AI service returned invalid or incomplete output. Click retry to resume generation.",
    };
  }

  return {
    code: "AI_GENERATION_FAILED",
    status: status || 500,
    recoverable: true,
    isQuotaExhausted: false,
    message: errMsg || "AI question generation encountered a temporary error. Click retry to resume.",
  };
}
