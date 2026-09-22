import express from "express";
import {
  startPractice,
  getSession,
  saveAnswer,
  submitSession,
  getResult,
  retryEvaluation,
  downloadPDF,
} from "../../../controllers/individualRound/technical/individualTechnicalController.js";
import authMiddleware from "../../../middleware/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/start", startPractice);
router.get("/session/:sessionId", getSession);
router.post("/session/:sessionId/answer", saveAnswer);
router.post("/session/:sessionId/submit", submitSession);
router.get("/result/:sessionId/pdf", downloadPDF);
router.get("/result/:sessionId", getResult);
router.post("/result/:sessionId/retry", retryEvaluation);

export default router;

