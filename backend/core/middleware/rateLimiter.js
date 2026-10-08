import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { getRedisClient } from "../redis/redisService.js";

const getStore = (prefix) => {
  const client = getRedisClient();
  if (client) {
    return new RedisStore({
      sendCommand: (...args) => client.call(...args),
      prefix: `rl:${prefix}:`,
    });
  }
  return undefined; // Falls back to default express-rate-limit MemoryStore
};



const standardErrorHandler = (message) => (req, res) => {
  res.status(429).json({
    success: false,
    code: "RATE_LIMIT_EXCEEDED",
    message,
    retryAfter: res.getHeader("Retry-After") || 60,
  });
};

const shouldSkipLimiter = (req) => {
  return process.env.NODE_ENV === "test" || (req.headers["x-load-test-bypass"] && req.headers["x-load-test-bypass"] === (process.env.JWT_SECRET || "fallback_secret_key"));
};

/**
 * Global API limiter.
 * Covers full mock test sessions, autosaves, and active student navigation.
 * Uses req.user.id when authenticated to prevent campus/NAT shared IP collisions.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  store: getStore("api"),
  keyGenerator: (req) => (req.user && req.user.id ? `user_${req.user.id}` : (req.ip || "unknown_ip")),
  skip: shouldSkipLimiter,
  handler: standardErrorHandler("Too many requests. Please slow down and try again later."),
});

/**
 * Dedicated Test Engine Limiter.
 * High-throughput limiter tailored for simultaneous 150-200 student tests (autosaves, heartbeats, navigation).
 */
export const testLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  store: getStore("test"),
  keyGenerator: (req) => (req.user && req.user.id ? `test_user_${req.user.id}` : (req.ip || "unknown_ip")),
  skip: shouldSkipLimiter,
  handler: standardErrorHandler("Test request limit reached. Please wait a moment before sending more answers."),
});

/**
 * Authentication limiter.
 * Protects login, signup, password reset from brute force.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore("auth"),
  handler: standardErrorHandler("Too many login or authentication attempts. Please try again after 15 minutes."),
});

/**
 * AI Generation Limiter.
 * Protects AI question generation and evaluation endpoints.
 */
export const aiGenerationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore("ai"),
  handler: standardErrorHandler("Too many AI generation requests. Please wait a moment before trying again."),
});

/**
 * File Upload Limiter.
 * Protects resume upload and analysis endpoints.
 */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore("upload"),
  handler: standardErrorHandler("Too many resume upload attempts. Please try again later."),
});

/**
 * Data Export Limiter.
 * Protects PDF / CSV generation.
 */
export const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore("export"),
  handler: standardErrorHandler("Too many export requests. Please try again later."),
});

/**
 * Code Execution Limiter.
 * Protects Judge0 & Docker execution backends.
 */
export const executionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  store: getStore("exec"),
  keyGenerator: (req) => (req.user && (req.user.id || req.user._id) ? `exec_user_${req.user.id || req.user._id}` : (req.ip || "unknown_ip")),
  skip: shouldSkipLimiter,
  handler: standardErrorHandler("Too many code execution requests. Please wait a few seconds before executing again."),
});


