import express from "express";
import multer from "multer";
import {
  startInterview,
  uploadResumeAndGenerateQuestions,
  getInterviewDetails,
  saveAnswer,
  completeInterview,
  getUserResults,
  getUserInterviews,
} from "../controllers/interviewController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/interview/start — create new AI interview session
router.post("/start", authMiddleware, startInterview);

// POST /api/interview/upload-resume
router.post("/upload-resume", authMiddleware, upload.single("resume"), uploadResumeAndGenerateQuestions);

// GET /api/interview/user/results (NOTE: Must come BEFORE /:id to avoid matching :id)
router.get("/user/results", authMiddleware, getUserResults);

// GET /api/interview/user/history — real past sessions for the logged-in user
router.get("/user/history", authMiddleware, getUserInterviews);

// GET /api/interview/:id
router.get("/:id", authMiddleware, getInterviewDetails);

// POST /api/interview/:id/answer
router.post("/:id/answer", authMiddleware, saveAnswer);

// POST /api/interview/:id/complete
router.post("/:id/complete", authMiddleware, completeInterview);

export default router;
