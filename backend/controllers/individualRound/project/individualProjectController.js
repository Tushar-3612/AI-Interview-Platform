import {
  createIndividualProjectSession,
  getIndividualProjectSession,
  saveIndividualProjectAnswer,
  submitIndividualProjectSession,
  retryIndividualProjectEvaluation,
  getIndividualProjectResult,
} from "../../../services/individualRound/project/individualProjectService.js";
import { generateIndividualProjectReportPDF } from "../../../services/individualRound/project/individualProjectPdfGenerator.js";
import User from "../../../models/User.js";
import IndividualProjectSession from "../../../models/IndividualProjectSession.js";
import IndividualProjectResult from "../../../models/IndividualProjectResult.js";

/**
 * POST /api/individual/project/start
 */
export async function startProjectSessionHandler(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    const { sourceMode, interviewKeyId, difficulty } = req.body || {};

    console.log(
      `[IndividualProjectAuth] requestReceived=true authenticated=${Boolean(req.user)} userIdPresent=${Boolean(userId)}`
    );

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized request" });
    }

    const session = await createIndividualProjectSession({
      userId,
      sourceMode,
      interviewKeyId,
      difficulty,
    });

    return res.status(201).json({
      success: true,
      sessionId: session.sessionId,
      session,
    });
  } catch (error) {
    console.error("[IndividualProjectController] Start error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/individual/project/session/:sessionId
 */
export async function getProjectSessionHandler(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    const { sessionId } = req.params;

    const session = await getIndividualProjectSession({ userId, sessionId });
    return res.status(200).json({ success: true, session });
  } catch (error) {
    return res.status(404).json({ success: false, message: error.message });
  }
}

/**
 * POST /api/individual/project/session/:sessionId/answer
 */
export async function saveProjectAnswerHandler(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    const { sessionId } = req.params;
    const { questionId, candidateAnswer, inputMethod } = req.body;

    const result = await saveIndividualProjectAnswer({
      userId,
      sessionId,
      questionId,
      candidateAnswer,
      inputMethod,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * POST /api/individual/project/session/:sessionId/submit
 */
export async function submitProjectSessionHandler(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    const { sessionId } = req.params;

    const result = await submitIndividualProjectSession({ userId, sessionId });
    return res.status(200).json({ success: true, result });
  } catch (error) {
    console.error("[IndividualProjectController] Submit error:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /api/individual/project/session/:sessionId/retry-evaluation
 */
export async function retryProjectEvaluationHandler(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    const { sessionId } = req.params;

    const result = await retryIndividualProjectEvaluation({ userId, sessionId });
    return res.status(200).json({ success: true, result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/individual/project/result/:sessionId
 */
export async function getProjectResultHandler(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    const { sessionId } = req.params;

    const result = await getIndividualProjectResult({ userId, sessionId });
    return res.status(200).json({ success: true, result });
  } catch (error) {
    return res.status(404).json({ success: false, message: error.message });
  }
}

/**
 * GET /api/individual/project/result/:sessionId/pdf
 */
export async function downloadProjectPdfHandler(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    const { sessionId } = req.params;

    const result = await IndividualProjectResult.findOne({ userId, sessionId }).lean();
    if (!result) {
      return res.status(404).json({ success: false, message: "Result document not found" });
    }

    const session = await IndividualProjectSession.findOne({ userId, sessionId }).lean();
    const user = await User.findById(userId).lean();

    generateIndividualProjectReportPDF({
      result,
      session: session || { sessionId },
      user,
      res,
    });
  } catch (error) {
    console.error("[IndividualProjectController] PDF download error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to generate PDF report" });
  }
}
