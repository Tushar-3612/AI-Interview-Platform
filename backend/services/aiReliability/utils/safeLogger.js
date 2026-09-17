import { redactSecrets } from "./redactSecrets.js";

/**
 * Sanitized logger wrapper preventing plain-text API key leaks in server output.
 */
export const safeLogger = {
  info(...args) {
    const sanitized = args.map((a) => (typeof a === "string" ? redactSecrets(a) : a));
    console.log("[AI-RELIABILITY]", ...sanitized);
  },
  warn(...args) {
    const sanitized = args.map((a) => (typeof a === "string" ? redactSecrets(a) : a));
    console.warn("[AI-RELIABILITY-WARN]", ...sanitized);
  },
  error(...args) {
    const sanitized = args.map((a) => (typeof a === "string" ? redactSecrets(a) : a));
    console.error("[AI-RELIABILITY-ERROR]", ...sanitized);
  },
  debug(...args) {
    if (process.env.NODE_ENV === "development") {
      const sanitized = args.map((a) => (typeof a === "string" ? redactSecrets(a) : a));
      console.log("[AI-RELIABILITY-DEBUG]", ...sanitized);
    }
  },
};
