import express from "express";
import {
  generateAptitude,
  evaluateAptitude,
  generateTechnical,
  getNextTechnical,
  submitTechnical,
  evaluateTechnical,
  generateProject,
  getNextProject,
  submitProject,
  evaluateProject,
  generateHR,
  getNextHR,
  submitHR,
  evaluateHR,
  generateCoding,
  getCodingQuestionsController,
  runCoding,
  submitCoding,
  evaluateCoding,
  submitRealInterview,
  getRealInterviewResultStatus,
  getRealInterviewResult,
  retryRealInterviewEvaluation,
  downloadRealInterviewResultPDF,
  setSessionBYOKController,
} from "../controllers/realInterviewController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { aiGenerationLimiter, executionLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// BYOK Session Binding Route
router.post("/byok/set-session-key", authMiddleware, setSessionBYOKController);

// Master Result Pipeline Routes
router.post("/submit", authMiddleware, aiGenerationLimiter, submitRealInterview);
router.get("/result/:sessionId/status", authMiddleware, getRealInterviewResultStatus);
router.get("/result/:sessionId/pdf", authMiddleware, downloadRealInterviewResultPDF);
router.get("/result/:sessionId", authMiddleware, getRealInterviewResult);
router.post("/result/:sessionId/retry", authMiddleware, aiGenerationLimiter, retryRealInterviewEvaluation);

// Aptitude Routes
router.post("/aptitude/generate", authMiddleware, aiGenerationLimiter, generateAptitude);
router.post("/aptitude/evaluate", authMiddleware, evaluateAptitude);

// Technical Routes
router.post("/technical/generate", authMiddleware, aiGenerationLimiter, generateTechnical);
router.get("/technical/next-question", authMiddleware, getNextTechnical);
router.post("/technical/submit-answer", authMiddleware, submitTechnical);
router.post("/technical/evaluate", authMiddleware, aiGenerationLimiter, evaluateTechnical);

// Project / Resume Routes
router.post("/project/generate", authMiddleware, aiGenerationLimiter, generateProject);
router.get("/project/next-question", authMiddleware, getNextProject);
router.post("/project/submit-answer", authMiddleware, submitProject);
router.post("/project/evaluate", authMiddleware, aiGenerationLimiter, evaluateProject);

// HR / Behavioral Routes
router.post("/hr/generate", authMiddleware, aiGenerationLimiter, generateHR);
router.get("/hr/next-question", authMiddleware, getNextHR);
router.post("/hr/submit-answer", authMiddleware, submitHR);
router.post("/hr/evaluate", authMiddleware, aiGenerationLimiter, evaluateHR);

// Coding Routes
router.post("/coding/generate", authMiddleware, aiGenerationLimiter, generateCoding);
router.get("/coding/questions", authMiddleware, getCodingQuestionsController);
router.post("/coding/run", authMiddleware, executionLimiter, runCoding);
router.post("/coding/submit", authMiddleware, executionLimiter, submitCoding);
router.post("/coding/evaluate", authMiddleware, aiGenerationLimiter, evaluateCoding);

export default router;



