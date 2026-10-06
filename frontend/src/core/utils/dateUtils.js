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

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

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

