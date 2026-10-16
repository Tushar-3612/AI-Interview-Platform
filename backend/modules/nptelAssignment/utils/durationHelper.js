/**
 * Duration & Time Formatting Utilities for NPTEL Module
 *
 * Contract:
 * - Internal canonical unit for durations is ELAPSED SECONDS (integer >= 0).
 * - Maximum plausible duration is 86,400 seconds (24 hours).
 * - Values outside this range (such as Unix timestamps from Date.now()/1000)
 *   or negative/non-finite values are classified as invalid and rejected.
 * - Missing/invalid durations format to a neutral fallback "—".
 */

export const MAX_PLAUSIBLE_DURATION_SECONDS = 86400; // 24 hours

/**
 * Validates, normalizes, and sanitizes a raw duration input into integer seconds.
 *
 * @param {number|string|null|undefined} value - Duration value to sanitize
 * @param {object} [options]
 * @param {number} [options.maxSeconds=86400] - Upper bound in seconds
 * @param {boolean} [options.allowMs=false] - If true, converts millisecond values to seconds
 * @param {boolean} [options.autoDetectMs=false] - Alias for allowMs
 * @param {string} [options.unit='s'] - 's' or 'ms'
 * @returns {number|null} Sanitized integer seconds, or null if invalid
 */
export function sanitizeDurationSeconds(value, options = {}) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return null;
  }

  const maxSeconds =
    typeof options.maxSeconds === "number" && options.maxSeconds > 0
      ? options.maxSeconds
      : MAX_PLAUSIBLE_DURATION_SECONDS;

  const isMs = options.unit === "ms" || options.isMilliseconds;
  const allowMs = Boolean(options.allowMs || options.autoDetectMs);

  let seconds = num;
  if (isMs) {
    seconds = num / 1000;
  } else if (allowMs && num > maxSeconds && num <= maxSeconds * 1000) {
    seconds = num / 1000;
  }

  if (seconds > maxSeconds) {
    return null;
  }

  return Math.max(0, Math.floor(seconds));
}

/**
 * Formats a duration in seconds into "mm:ss" format.
 * Returns a neutral fallback (default "—") for missing or invalid values.
 *
 * @param {number|string|null|undefined} seconds - Elapsed duration in seconds
 * @param {object|string} [options] - Options or fallback string
 * @returns {string} Formatted string (e.g. "01:30", "08:12", "00:00") or fallback ("—")
 */
export function formatDuration(seconds, options = {}) {
  const opts = typeof options === "string" ? { fallback: options } : options || {};
  const fallback = opts.fallback !== undefined ? opts.fallback : "—";

  const sanitized = sanitizeDurationSeconds(seconds, opts);
  if (sanitized === null) {
    return fallback;
  }

  const mins = Math.floor(sanitized / 60);
  const secs = sanitized % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
