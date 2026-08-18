import rateLimit from "express-rate-limit";

/**
 * Global API limiter.
 *
 * A single student typing in the coding IDE can generate a LOT of traffic if
 * autosave is not debounced on the client. The previous limit (100 / 15 min)
 * was far too low and tripped even normal usage (autosave + run + answer saves
 * + security events). The client is now debounced, so we raise the global
 * ceiling to a comfortable value that covers a full 60-minute mock without
 * ever blocking legitimate use, while still protecting against true abuse.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later" },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again later" },
});

export const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many export requests, please try again later" },
});

/**
 * Tighter limiter for expensive, Docker-backed code execution endpoints
 * (run / submit code / company-mock coding submit). This protects the Docker
 * daemon from being flooded with container spawns while still allowing a
 * student to run/submit many times during an assessment.
 *
 * Clients are also guarded (single in-flight request + disabled button), so
 * this is purely a backstop against accidental or malicious flooding.
 */
export const executionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many code execution requests, please slow down" },
});
