import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { runCode, submitCode, healthCheck } from "../controllers/codeExecutionController.js";

const router = express.Router();

// Health check — no auth required (for monitoring)
router.get("/health", healthCheck);

router.use(authMiddleware);

// Shared code execution endpoints
// Used by both Coding Practice and Test Coding Round
router.post("/run", runCode);
router.post("/submit", submitCode);

export default router;
