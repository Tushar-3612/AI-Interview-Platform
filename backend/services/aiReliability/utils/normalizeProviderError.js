import { redactSecrets } from "./redactSecrets.js";

/**
 * Normalizes HTTP status codes and provider errors into standard metadata flags.
 */
export function normalizeProviderError(error) {
  const errMsg = redactSecrets(String(error?.message || error || "")).trim();
  const status = error?.status || error?.statusCode || (errMsg.match(/HTTP\s+(\d{3})/) ? parseInt(errMsg.match(/HTTP\s+(\d{3})/)[1], 10) : 0);

  const isAuth =
    status === 401 ||
    status === 403 ||
    /unauthorized|invalid api key|invalid_key|401|403/i.test(errMsg);

  const isQuota =
    status === 402 ||
    /insufficient_quota|quota exceeded|daily quota|RPD|account balance/i.test(errMsg);

  const isRateLimit =
    status === 429 ||
    /rate_limit|429|TPM|RPM|requests per minute/i.test(errMsg);

  const isTimeout =
    status === 408 ||
    status === 504 ||
    /timeout|timed out|ETIMEDOUT|ECONNRESET/i.test(errMsg);

  const isModelUnavailable =
    status === 404 ||
    /model_not_found|model not found|decommissioned|unavailable/i.test(errMsg);

  const isTransient = (status >= 500 && status < 600) || isTimeout || isRateLimit;

  return {
    status,
    rawSafeError: errMsg,
    authenticationError: isAuth,
    quotaExceeded: isQuota,
    rateLimited: isRateLimit,
    timeout: isTimeout,
    modelUnavailable: isModelUnavailable,
    transientFailure: isTransient,
    retryAfter: error?.retryAfter || null,
  };
}
