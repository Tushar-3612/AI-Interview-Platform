export function timeAgo(dateValue) {
  if (!dateValue) return "Recently";
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return "Recently";
  const now = new Date();
  const diffMs = now - date;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDate(dateValue) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export const MAX_PLAUSIBLE_DURATION_SECONDS = 86400; // 24 hours

/**
 * Validates, normalizes, and sanitizes a raw duration input into integer seconds.
 * Returns null if the value is missing, negative, non-finite, or implausibly large.
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
export function formatTime(seconds, options = {}) {
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

export const formatDuration = formatTime;

/**
 * Converts a local datetime-local string (e.g. "2026-10-06T08:34")
 * or Date/timestamp into an ISO 8601 UTC string (e.g. "2026-10-06T03:04:00.000Z")
 * using the user's browser local timezone.
 *
 * @param {string|Date|number|null|undefined} value
 * @returns {string} ISO 8601 UTC string or empty string
 */
export function localToUtcIso(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? "" : value.toISOString();
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? "" : d.toISOString();
  }
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  // If already an ISO string with timezone indicator (Z or +HH:mm / -HH:mm)
  if (/Z|[+-]\d{2}(?::?\d{2})?$/i.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? "" : d.toISOString();
  }

  // Parse YYYY-MM-DDTHH:mm, YYYY-MM-DDTHH:mm:ss, or YYYY-MM-DD HH:mm
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (match) {
    const [, year, month, day, hour = "0", min = "0", sec = "0"] = match;
    const localDate = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(min),
      Number(sec)
    );
    if (!isNaN(localDate.getTime())) {
      return localDate.toISOString();
    }
  }

  const fallback = new Date(trimmed);
  return !isNaN(fallback.getTime()) ? fallback.toISOString() : "";
}

/**
 * Converts a UTC date value (ISO string, Date, timestamp)
 * into a local "YYYY-MM-DDTHH:mm" string suitable for HTML5 datetime-local inputs.
 *
 * @param {string|Date|number|null|undefined} dateValue
 * @returns {string} "YYYY-MM-DDTHH:mm" or empty string
 */
export function utcToLocalDatetimeString(dateValue) {
  if (dateValue == null || dateValue === "") return "";
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

