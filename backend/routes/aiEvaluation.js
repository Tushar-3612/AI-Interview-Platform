import express from "express";
import authMiddleware, { authorizeRoles } from "../middleware/authMiddleware.js";
import {
  evaluateTestResult,
  retryEvaluationHandler,
  getEvaluationStatus,
  getStudentEvaluationList,
  getAdminEvaluationsByTest,
  checkEvaluationReady,
} from "../controllers/aiEvaluationController.js";

const router = express.Router();

router.use(authMiddleware);

// ─── Student routes ───
router.get("/student/list", getStudentEvaluationList);
router.get("/status/:testResultId", getEvaluationStatus);
router.get("/ready/:testResultId", checkEvaluationReady);

// ─── Admin routes ───
router.post("/evaluate/:testResultId", authorizeRoles("admin"), evaluateTestResult);
router.post("/retry/:testResultId", authorizeRoles("admin"), retryEvaluationHandler);
router.get("/admin/by-test/:testId", authorizeRoles("admin"), getAdminEvaluationsByTest);

export default router;
