import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { executionLimiter } from "../middleware/rateLimiter.js";
import {
  runCode,
  submitCode,
  healthCheck,
  getSubmissionById,
  getLanguages,
} from "../controllers/codeExecutionController.js";

const router = express.Router();

// Public metadata / health
router.get("/health", healthCheck);
router.get("/languages", getLanguages);

router.use(authMiddleware);

// Shared code execution endpoints
router.post("/run", executionLimiter, runCode);
router.post("/submit", executionLimiter, submitCode);
router.get("/submission/:id", getSubmissionById);

export default router;
