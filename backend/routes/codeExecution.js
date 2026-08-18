import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { executionLimiter } from "../middleware/rateLimiter.js";
import { runCode, submitCode, healthCheck } from "../controllers/codeExecutionController.js";

const router = express.Router();

// Health check — no auth required (for monitoring)
router.get("/health", healthCheck);

router.use(authMiddleware);

// Shared code execution endpoints
// Used by both Coding Practice and Test Coding Round. Rate limited separately to
// protect the Docker daemon from container-spawn floods (PART 36).
router.post("/run", executionLimiter, runCode);
router.post("/submit", executionLimiter, submitCode);

export default router;
