import express from "express";
import authMiddleware, { authorizeRoles } from "../middleware/authMiddleware.js";
import {
  createQuestion,
  getQuestions,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
  togglePublishQuestion,
  duplicateQuestion,
  addTestCase,
  getQuestionTestCases,
  updateTestCase,
  deleteTestCase,
  createAssessment,
  getAssessments,
  getAssessmentById,
  updateAssessment,
  deleteAssessment,
  toggleActivateAssessment,
  getAssessmentResults,
  getCandidateAttemptDetail,
} from "../controllers/adminCodingAssessmentController.js";

const router = express.Router();

// Strict RBAC: only admins can access these endpoints
router.use(authMiddleware);
router.use(authorizeRoles("admin"));

// Question management
router.post("/questions", createQuestion);
router.get("/questions", getQuestions);
router.get("/questions/:id", getQuestionById);
router.put("/questions/:id", updateQuestion);
router.delete("/questions/:id", deleteQuestion);
router.patch("/questions/:id/publish", togglePublishQuestion);
router.post("/questions/:id/duplicate", duplicateQuestion);

// Test case management
router.post("/questions/:id/testcases", addTestCase);
router.get("/questions/:id/testcases", getQuestionTestCases);
router.put("/testcases/:id", updateTestCase);
router.delete("/testcases/:id", deleteTestCase);

// Assessment management
router.post("/assessments", createAssessment);
router.get("/assessments", getAssessments);
router.get("/assessments/:id", getAssessmentById);
router.put("/assessments/:id", updateAssessment);
router.delete("/assessments/:id", deleteAssessment);
router.patch("/assessments/:id/activate", toggleActivateAssessment);
router.get("/assessments/:id/results", getAssessmentResults);
router.get("/attempts/:id", getCandidateAttemptDetail);

export default router;
