import express from "express";
import multer from "multer";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getProfile,
  updateProfile,
  uploadResumeAndAnalyze,
  downloadResume,
  viewResume,
  updateTargetCompany,
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
import { getDashboardStats } from "../controllers/dashboardStatsController.js";

import {
  createInterviewSession,
  getInterviewSession,
  completeInterviewSession,
  getStudentInterviews,
  saveInterviewAnswer,
  saveInterviewIntegrityEvent,
} from "../controllers/studentInterviewController.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Protect all routes with authMiddleware
router.use(authMiddleware);

// Profile
router.get("/profile", getProfile);
router.put("/profile", updateProfile);

// Target Company
router.put("/target-company", updateTargetCompany);

// Resume upload, view, download
router.post("/resume/upload", upload.single("resume"), uploadResumeAndAnalyze);
router.get("/resume/download", downloadResume);
router.get("/resume/view", viewResume);

// Dashboard statistics
router.get("/dashboard-stats", getDashboardStats);

// ─── Real Interview Sessions ───
router.post("/interviews", createInterviewSession);
router.get("/interviews", getStudentInterviews);
router.get("/interviews/:sessionId", getInterviewSession);
router.post("/interviews/:sessionId/answer", saveInterviewAnswer);
router.post("/interviews/:sessionId/integrity-event", saveInterviewIntegrityEvent);
router.post("/interviews/:sessionId/complete", completeInterviewSession);

// ─── Test Engine ───
router.get("/tests", getAssignedTests);
router.post("/tests/:testId/start", startTest);
router.get("/tests/attempt/:attemptId", getAttemptState);
router.post("/tests/attempt/:attemptId/answer", saveAnswer);
router.post("/tests/attempt/:attemptId/tab-switch", recordTabSwitch);
router.post("/tests/attempt/:attemptId/submit", submitTest);
router.get("/tests/attempt/:attemptId/result", getTestResult);

// ─── Test Results (Student) ───
router.get("/results", getStudentResults);
router.get("/tests/results", getStudentResults);
router.get("/tests/results/:attemptId", getStudentResultByAttempt);

export default router;
