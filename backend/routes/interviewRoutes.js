import express from "express";
import multer from "multer";
import {
  startInterview,
  uploadResumeAndGenerateQuestions,
  getInterviewDetails,
  getOrGenerateRoundQuestions,
  saveAnswer,
  completeInterview,
  getInterviewResult,
  getInterviewHistory,
  getUserResults,
  getUserInterviews,
  generateTTS,
  logIntegrityEvent,
} from "../controllers/interviewController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/interview/start — create new AI interview session
router.post("/start", authMiddleware, startInterview);

// POST /api/interview/tts — provider-agnostic TTS audio generation
router.post("/tts", authMiddleware, generateTTS);

// POST /api/interview/upload-resume
router.post("/upload-resume", authMiddleware, upload.single("resume"), uploadResumeAndGenerateQuestions);

// GET /api/interview/history — persistent student interview attempts list
router.get("/history", authMiddleware, getInterviewHistory);

// GET /api/interview/user/results
router.get("/user/results", authMiddleware, getUserResults);

// GET /api/interview/user/history — real past sessions for the logged-in user
router.get("/user/history", authMiddleware, getUserInterviews);

// GET /api/interview/:id/round/:roundName — lazy load / DB cache per round
router.get("/:id/round/:roundName", authMiddleware, getOrGenerateRoundQuestions);

// GET /api/interview/:id/result — single source of truth persistent result fetch
router.get("/:id/result", authMiddleware, getInterviewResult);

// GET /api/interview/:id
router.get("/:id", authMiddleware, getInterviewDetails);

// POST /api/interview/:id/answer
router.post("/:id/answer", authMiddleware, saveAnswer);

// POST /api/interview/:id/integrity-event — record security events
router.post("/:id/integrity-event", authMiddleware, logIntegrityEvent);

// POST /api/interview/:id/complete
router.post("/:id/complete", authMiddleware, completeInterview);

export default router;
