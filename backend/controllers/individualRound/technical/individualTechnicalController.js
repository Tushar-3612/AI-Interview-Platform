import {
  startIndividualTechnicalSession,
  getIndividualTechnicalSession,
  saveIndividualTechnicalAnswer,
  submitAndEvaluateIndividualTechnicalSession,
  getIndividualTechnicalResult,
  retryIndividualTechnicalEvaluation,
} from "../../../services/individualRound/technical/individualTechnicalService.js";
import { generateIndividualTechnicalReportPDF } from "../../../services/individualRound/technical/individualTechnicalPdfGenerator.js";
import User from "../../../models/User.js";

/**
 * POST /api/individual/technical/start
 */
export const startPractice = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { sourceMode, interviewKeyId, difficulty, candidateProfile } = req.body || {};

    const session = await startIndividualTechnicalSession({
      userId,
      sourceMode,
      interviewKeyId,
      difficulty,
      candidateProfile,
    });

    res.status(201).json({
      success: true,
      sessionId: session.sessionId,
      session,
    });
  } catch (error) {
    console.error("[IndividualTechnicalController] Start Practice Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to start Individual Technical Practice session",
    });
  }
};

/**
 * GET /api/individual/technical/session/:sessionId
 */
export const getSession = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { sessionId } = req.params;

    const session = await getIndividualTechnicalSession({ sessionId, userId });
    res.status(200).json({
      success: true,
      session,
    });
  } catch (error) {
    console.error("[IndividualTechnicalController] Get Session Error:", error.message);
    res.status(404).json({
      success: false,
      message: error.message || "Failed to fetch session",
    });
  }
};

/**
 * POST /api/individual/technical/session/:sessionId/answer
 */
export const saveAnswer = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { sessionId } = req.params;
    const { questionId, candidateAnswer, inputMethod } = req.body || {};

    const result = await saveIndividualTechnicalAnswer({
      sessionId,
      questionId,
      candidateAnswer,
      inputMethod,
      userId,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("[IndividualTechnicalController] Save Answer Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to save answer",
    });
  }
};

/**
 * POST /api/individual/technical/session/:sessionId/submit
 */
export const submitSession = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { sessionId } = req.params;

    const result = await submitAndEvaluateIndividualTechnicalSession({ sessionId, userId });
    res.status(200).json(result);
  } catch (error) {
    console.error("[IndividualTechnicalController] Submit Session Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Your answers were saved successfully, but the technical evaluation is temporarily unavailable. Please retry the evaluation.",
    });
  }
};

/**
 * GET /api/individual/technical/result/:sessionId
 */
export const getResult = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { sessionId } = req.params;

    const result = await getIndividualTechnicalResult({ sessionId, userId });
    res.status(200).json(result);
  } catch (error) {
    console.error("[IndividualTechnicalController] Get Result Error:", error.message);
    res.status(404).json({
      success: false,
      message: error.message || "Failed to fetch result",
    });
  }
};

/**
 * POST /api/individual/technical/result/:sessionId/retry
 */
export const retryEvaluation = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { sessionId } = req.params;

    const result = await retryIndividualTechnicalEvaluation({ sessionId, userId });
    res.status(200).json(result);
  } catch (error) {
    console.error("[IndividualTechnicalController] Retry Evaluation Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retry evaluation",
    });
  }
};

/**
 * GET /api/individual/technical/result/:sessionId/pdf
 */
export const downloadPDF = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { sessionId } = req.params;

    const result = await getIndividualTechnicalResult({ sessionId, userId });
    const session = await getIndividualTechnicalSession({ sessionId, userId });
    const user = await User.findById(userId).lean().catch(() => null);

    generateIndividualTechnicalReportPDF({ result, session, user, res });
  } catch (error) {
    console.error("[IndividualTechnicalController] Download PDF Error:", error.message);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: error.message || "Unable to generate the PDF right now. Please try again.",
      });
    }
  }
};

