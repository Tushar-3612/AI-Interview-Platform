import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getAvailableAssessments,
  getAssessmentInstructions,
  startAssessment,
  getAttemptState,
  runSampleTests,
  runCustomInput,
  submitSolution,
  autosaveCode,
  completeAssessment,
  getAssessmentResult,
  getStudentAssessmentHistory,
  generateAIPostAssessmentFeedback,
} from "../controllers/candidateCodingAssessmentController.js";

const router = express.Router();

// Candidate assessment endpoints protected by JWT authMiddleware
router.use(authMiddleware);

router.get("/assessments", getAvailableAssessments);
router.get("/assessments/:id", getAssessmentInstructions);
router.post("/assessments/:id/start", startAssessment);

router.get("/attempts/:id", getAttemptState);
router.post("/run", runSampleTests);
router.post("/run-custom", runCustomInput);
router.post("/submit", submitSolution);
router.post("/autosave", autosaveCode);
router.post("/attempts/:id/complete", completeAssessment);
router.get("/attempts/:id/result", getAssessmentResult);
router.get("/history", getStudentAssessmentHistory);
router.post("/attempts/:id/ai-feedback", generateAIPostAssessmentFeedback);

export default router;
