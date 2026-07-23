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
import {
  getAssignedTests,
  startTest,
  saveAnswer,
  getAttemptState,
  recordTabSwitch,
  submitTest,
  getTestResult,
} from "../controllers/testAttemptController.js";
import {
  getStudentResults,
  getStudentResultByAttempt,
} from "../controllers/resultController.js";

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

// ─── Test Engine ───
router.get("/tests", getAssignedTests);
router.post("/tests/:testId/start", startTest);
router.get("/tests/attempt/:attemptId", getAttemptState);
router.post("/tests/attempt/:attemptId/answer", saveAnswer);
router.post("/tests/attempt/:attemptId/tab-switch", recordTabSwitch);
router.post("/tests/attempt/:attemptId/submit", submitTest);
router.get("/tests/attempt/:attemptId/result", getTestResult);

// ─── Test Results (Student) ───
router.get("/tests/results", getStudentResults);
router.get("/tests/results/:attemptId", getStudentResultByAttempt);

export default router;
