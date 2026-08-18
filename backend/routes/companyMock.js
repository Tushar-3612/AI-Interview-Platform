import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { executionLimiter } from "../middleware/rateLimiter.js";
import {
  startCompanyMock,
  saveAnswer,
  saveCodingDraft,
  getCodingDraft,
  saveProgress,
  recordTabSwitch,
  recordFullscreenExit,
  recordSecurityEvent,
  beginAttempt,
  pauseAttempt,
  resumeAttempt,
  exitAttempt,
  getAttemptStatus,
  submitCompanyMock,
  submitCodingAnswer,
  getCompanyMockHistory,
  getAttemptResult,
  getCompanyMockStats,
} from "../controllers/companyMockController.js";

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Start or resume a company mock interview
router.post("/start", startCompanyMock);

// Begin the assessment timer (only after fullscreen is confirmed)
router.post("/begin", beginAttempt);

// Pause / resume (idempotent, server-authoritative timer)
router.post("/pause", pauseAttempt);
router.post("/resume", resumeAttempt);
router.post("/exit", exitAttempt);
router.get("/status/:attemptId", getAttemptStatus);

// Save answers (auto-save)
router.post("/answer", saveAnswer);
router.post("/progress", saveProgress);

// Coding drafts
router.post("/coding-draft", saveCodingDraft);
router.get("/draft/:attemptId/:questionId", getCodingDraft);

// Per-question coding evaluation (uses existing Docker service) — tightly rate
// limited to protect the Docker daemon.
router.post("/coding-submit", executionLimiter, submitCodingAnswer);

// Security events (legacy)
router.post("/tab-switch", recordTabSwitch);
router.post("/fullscreen-exit", recordFullscreenExit);
router.post("/security-event", recordSecurityEvent);

// Submit attempt
router.post("/submit", submitCompanyMock);

// History and results
router.get("/history", getCompanyMockHistory);
router.get("/attempt/:attemptId", getAttemptResult);
router.get("/stats", getCompanyMockStats);

export default router;
