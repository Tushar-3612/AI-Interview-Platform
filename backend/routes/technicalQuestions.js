import express from "express";
import authMiddleware, { authorizeRoles } from "../middleware/authMiddleware.js";
import {
  getTechnicalQuestions,
  getTechnicalQuestionStats,
  createTechnicalQuestion,
  updateTechnicalQuestion,
  deleteTechnicalQuestion,
  bulkCreateTechnicalQuestions,
  getQuestionUsage,
} from "../controllers/technicalQuestionController.js";

const router = express.Router();

// All routes require admin authentication
router.use(authMiddleware);
router.use(authorizeRoles("admin"));

// Get all technical questions
router.get("/", getTechnicalQuestions);

// Get stats
router.get("/stats", getTechnicalQuestionStats);

// Get usage for a specific question
router.get("/usage/:questionId", getQuestionUsage);

// Create a new question
router.post("/", createTechnicalQuestion);

// Bulk create questions
router.post("/bulk", bulkCreateTechnicalQuestions);

// Update a question
router.put("/:id", updateTechnicalQuestion);

// Delete a question (soft delete)
router.delete("/:id", deleteTechnicalQuestion);

export default router;
