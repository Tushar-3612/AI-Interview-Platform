import express from "express";
import multer from "multer";
import authMiddleware from "../../../core/middleware/authMiddleware.js";
import {
  getProfile,
  updateProfile,
  uploadResumeAndAnalyze,
  downloadResume,
  viewResume,
  updateTargetCompany,
} from "../controllers/studentController.js";
import {
  getStudentApiKeys,
  saveStudentApiKey,
  deleteStudentApiKey,
  updateStudentApiKeyPreference,
  testStudentApiKey,
} from "../controllers/apiKeysController.js";
import {
  getAssignedTests,
  startTest,
  saveAnswer,
  getAttemptState,
  recordTabSwitch,
  recordIntegrityEvent,
  recordHeartbeat,
  submitTest,
  getTestResult,
} from "../../testEngine/controllers/testAttemptController.js";
import {
  getStudentResults,
  getStudentResultByAttempt,
} from "../../testEngine/controllers/resultController.js";
import { getDashboardStats } from "../../administration/controllers/dashboardStatsController.js";

import {
  checkInterviewEligibility,
  createInterviewSession,
  getInterviewSession,
  completeInterviewSession,
  getStudentInterviews,
  saveInterviewAnswer,
  saveInterviewIntegrityEvent,
} from "../../realInterview/controllers/studentInterviewController.js";

import { uploadLimiter, testLimiter } from "../../../core/middleware/rateLimiter.js";

const router = express.Router();

// Secure multer configuration for resume uploads (5MB limit, strict MIME filter)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB maximum file size
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
    const originalName = (file.originalname || "").toLowerCase();
    const isAllowedExt = originalName.endsWith(".pdf") || originalName.endsWith(".docx") || originalName.endsWith(".doc");

    if (allowedMimeTypes.includes(file.mimetype) || isAllowedExt) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF and DOC/DOCX files are supported."));
    }
  },
});

// Protect all routes with authMiddleware
router.use(authMiddleware);

// Profile
router.get("/profile", getProfile);
router.put("/profile", updateProfile);

// Manage Student AI API Keys (BYOK)
router.get("/api-keys", getStudentApiKeys);
router.post("/api-keys", saveStudentApiKey);
router.delete("/api-keys/:provider", deleteStudentApiKey);
router.put("/api-keys/preference", updateStudentApiKeyPreference);
router.post("/api-keys/test", testStudentApiKey);

// Target Company
router.put("/target-company", updateTargetCompany);

// Resume upload, view, download
router.post("/resume/upload", uploadLimiter, upload.single("resume"), uploadResumeAndAnalyze);
router.get("/resume/download", downloadResume);
router.get("/resume/view", viewResume);

// Dashboard statistics
router.get("/dashboard-stats", getDashboardStats);

// ─── Real Interview Sessions ───
router.get("/interviews/eligibility", checkInterviewEligibility);
router.post("/interviews", createInterviewSession);
router.get("/interviews", getStudentInterviews);
router.get("/interviews/:sessionId", getInterviewSession);
router.post("/interviews/:sessionId/answer", saveInterviewAnswer);
router.post("/interviews/:sessionId/integrity-event", saveInterviewIntegrityEvent);
router.post("/interviews/:sessionId/complete", completeInterviewSession);

// ─── Test Engine ───
router.get("/tests", getAssignedTests);
router.post("/tests/:testId/start", testLimiter, startTest);
router.get("/tests/attempt/:attemptId", testLimiter, getAttemptState);
router.post("/tests/attempt/:attemptId/answer", testLimiter, saveAnswer);
router.post("/tests/attempt/:attemptId/tab-switch", testLimiter, recordTabSwitch);
router.post("/tests/attempt/:attemptId/integrity-event", testLimiter, recordIntegrityEvent);
router.post("/tests/attempt/:attemptId/heartbeat", testLimiter, recordHeartbeat);
router.post("/tests/attempt/:attemptId/submit", testLimiter, submitTest);
router.get("/tests/attempt/:attemptId/result", testLimiter, getTestResult);


// ─── Test Results (Student) ───
router.get("/results", getStudentResults);
router.get("/tests/results", getStudentResults);
router.get("/tests/results/:attemptId", getStudentResultByAttempt);

export default router;
