import express from "express";
import multer from "multer";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getProfile,
  updateProfile,
  uploadResumeAndAnalyze,
  startInterview,
  submitAnswer,
  completeInterview,
  getInterviews,
  getResults,
} from "../controllers/studentController.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Protect all routes with authMiddleware
router.use(authMiddleware);

// Profile
router.get("/profile", getProfile);
router.put("/profile", updateProfile);

// Resume upload and Gemini ATS grading
router.post("/resume/upload", upload.single("resume"), uploadResumeAndAnalyze);

// Interview management
router.post("/interviews", startInterview);
router.post("/interviews/answer", submitAnswer);
router.post("/interviews/:interviewId/complete", completeInterview);

// Fetching history
router.get("/interviews", getInterviews);
router.get("/results", getResults);

export default router;
