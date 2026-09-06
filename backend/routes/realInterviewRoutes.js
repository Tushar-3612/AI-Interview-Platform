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
} from "../controllers/realInterviewController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Master Result Pipeline Routes
router.post("/submit", authMiddleware, submitRealInterview);
router.get("/result/:sessionId/status", authMiddleware, getRealInterviewResultStatus);
router.get("/result/:sessionId", authMiddleware, getRealInterviewResult);
router.post("/result/:sessionId/retry", authMiddleware, retryRealInterviewEvaluation);

// Aptitude Routes
router.post("/aptitude/generate", authMiddleware, generateAptitude);
router.post("/aptitude/evaluate", authMiddleware, evaluateAptitude);

// Technical Routes
router.post("/technical/generate", authMiddleware, generateTechnical);
router.get("/technical/next-question", authMiddleware, getNextTechnical);
router.post("/technical/submit-answer", authMiddleware, submitTechnical);
router.post("/technical/evaluate", authMiddleware, evaluateTechnical);

// Project / Resume Routes
router.post("/project/generate", authMiddleware, generateProject);
router.get("/project/next-question", authMiddleware, getNextProject);
router.post("/project/submit-answer", authMiddleware, submitProject);
router.post("/project/evaluate", authMiddleware, evaluateProject);

// HR / Behavioral Routes
router.post("/hr/generate", authMiddleware, generateHR);
router.get("/hr/next-question", authMiddleware, getNextHR);
router.post("/hr/submit-answer", authMiddleware, submitHR);
router.post("/hr/evaluate", authMiddleware, evaluateHR);

// Coding Routes
router.post("/coding/generate", authMiddleware, generateCoding);
router.get("/coding/questions", authMiddleware, getCodingQuestionsController);
router.post("/coding/run", authMiddleware, runCoding);
router.post("/coding/submit", authMiddleware, submitCoding);
router.post("/coding/evaluate", authMiddleware, evaluateCoding);

export default router;



