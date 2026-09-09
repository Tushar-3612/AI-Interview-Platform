import express from "express";
import {
  startProjectSessionHandler,
  getProjectSessionHandler,
  saveProjectAnswerHandler,
  submitProjectSessionHandler,
  retryProjectEvaluationHandler,
  getProjectResultHandler,
  downloadProjectPdfHandler,
} from "../../../controllers/individualRound/project/individualProjectController.js";
import authMiddleware from "../../../middleware/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/start", startProjectSessionHandler);
router.get("/session/:sessionId", getProjectSessionHandler);
router.post("/session/:sessionId/answer", saveProjectAnswerHandler);
router.post("/session/:sessionId/submit", submitProjectSessionHandler);
router.post("/session/:sessionId/retry-evaluation", retryProjectEvaluationHandler);
router.get("/result/:sessionId/pdf", downloadProjectPdfHandler);
router.get("/result/:sessionId", getProjectResultHandler);

export default router;
