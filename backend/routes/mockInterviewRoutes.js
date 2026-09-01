import express from "express";
import {
  startMockInterview,
  submitMockInterview,
  saveMockInterviewProgress,
  resumeMockInterview,
  getMockResult,
  listUnfinishedMocks,
  listMockHistory,
} from "../controllers/mockInterviewController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware); // All routes require authentication

router.post("/start", startMockInterview);
router.post("/submit", submitMockInterview);
router.post("/save", saveMockInterviewProgress);
router.get("/resume", resumeMockInterview);
router.get("/unfinished", listUnfinishedMocks);
router.get("/result/:attemptId", getMockResult);
router.get("/history", listMockHistory);

export default router;
