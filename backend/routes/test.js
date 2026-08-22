import express from "express";
import authMiddleware, { authorizeRoles } from "../middleware/authMiddleware.js";
import {
  createTest,
  getTests,
  getTestById,
  updateTest,
  deleteTest,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  publishTest,
  scheduleTest,
  rescheduleTest,
  closeTest,
  assignTest,
  getAssignedTests,
  getAssignmentById,
  deleteAssignment,
  closeAssignment,
  getAssignmentStudents,
  updateAssignmentStatus,
  uploadQuestions,
  uploadMiddleware,
  downloadTemplate,
} from "../controllers/testController.js";
import {
  processTestResult,
  getResultById,
  getResultsByTest,
  getTestRankings,
  recomputeRankings,
  getResultStats,
} from "../controllers/resultController.js";

const router = express.Router();

router.use(authMiddleware);
router.use(authorizeRoles("admin"));

router.post("/", createTest);
router.get("/", getTests);
router.get("/:id", getTestById);
router.put("/:id", updateTest);
router.delete("/:id", deleteTest);

router.post("/questions/:id", addQuestion);
router.put("/questions/:id/:questionId", updateQuestion);
router.delete("/questions/:id/:questionId", deleteQuestion);

router.post("/upload-questions", uploadMiddleware, uploadQuestions);
router.get("/question-templates/:format", downloadTemplate);

router.put("/:id/publish", publishTest);
router.put("/:id/schedule", scheduleTest);
router.put("/:id/reschedule", rescheduleTest);
router.put("/:id/close", closeTest);

router.post("/assign", assignTest);
router.get("/assignments/list", getAssignedTests);
router.get("/assignments/:id", getAssignmentById);
router.get("/assignments/:id/students", getAssignmentStudents);
router.put("/assignments/:id", updateAssignmentStatus);
router.put("/assignments/:id/close", closeAssignment);
router.delete("/assignments/:id", deleteAssignment);

router.post("/results/process/:attemptId", processTestResult);
router.get("/results/by-test/:testId", getResultsByTest);
router.get("/results/:testId/stats", getResultStats);
router.get("/results/:testId/rankings", getTestRankings);
router.post("/results/:testId/recompute-rankings", recomputeRankings);
router.get("/results/:resultId", getResultById);

export default router;
