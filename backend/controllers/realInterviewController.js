import {
  generateAndProcessAptitudeQuestions,
  evaluateAptitudeSession,
} from "../services/realInterview/aptitudeService.js";
import {
  generateAndProcessTechnicalQuestions,
  getNextTechnicalQuestion,
  submitTechnicalAnswer,
  evaluateTechnicalInterviewSession,
} from "../services/realInterview/technicalService.js";
import {
  generateAndProcessProjectQuestions,
  getNextProjectQuestion,
  submitProjectAnswer,
  evaluateProjectInterviewSession,
} from "../services/realInterview/projectService.js";
import {
  generateAndProcessHRQuestions,
  getNextHRQuestion,
  submitHRAnswer,
  evaluateHRInterviewSession,
} from "../services/realInterview/hrService.js";
import {
  generateAndProcessCodingQuestions,
  getCodingQuestions,
  runCodingCode,
  submitCodingCode,
  evaluateCodingInterviewSession,
} from "../services/realInterview/codingService.js";
import { getOrBuildCandidateResumeContext } from "../utils/resumeContextBuilder.js";
import { executeRealInterviewResultPipeline } from "../services/realInterview/resultPipelineService.js";
import RealInterviewResult from "../models/RealInterviewResult.js";

/**
 * POST /api/real-interview/aptitude/generate
 */
export const generateAptitude = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const sessionId = req.body?.sessionId || null;

    console.log(`[REAL INTERVIEW AI] round=aptitude keyPresent=${Boolean((process.env.REAL_INTERVIEW_APTITUDE_API_KEY || "").trim())} provider=groq requestStarted=true`);
    const result = await generateAndProcessAptitudeQuestions({ userId, sessionId });
    console.log(`[REAL INTERVIEW AI] round=aptitude requestCompleted=true count=${result.count || result.questions?.length}`);
    res.status(201).json(result);
  } catch (error) {
    console.error("[RealInterviewController] Aptitude Generation Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to generate Real Interview Aptitude Questions",
    });
  }
};

/**
 * POST /api/real-interview/aptitude/evaluate
 * Deterministic Aptitude evaluation out of 50 marks (ZERO AI CALLS).
 */
export const evaluateAptitude = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { sessionId, candidateAnswers, answers } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId is required for aptitude evaluation" });
    }

    const result = await evaluateAptitudeSession({
      sessionId,
      candidateAnswers: candidateAnswers || answers || [],
      userId,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("[RealInterviewController] Aptitude Evaluation Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to evaluate Aptitude session",
    });
  }
};

/**
 * POST /api/real-interview/technical/generate
 */
export const generateTechnical = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const sessionId = req.body?.sessionId || `technical_session_${Date.now()}`;
    const candidateProfile = await getOrBuildCandidateResumeContext(userId, req.body?.candidateProfile || req.body?.resume || {});

    console.log(`[REAL INTERVIEW AI] round=technical keyPresent=${Boolean((process.env.REAL_INTERVIEW_TECHNICAL_API_KEY || "").trim())} provider=groq requestStarted=true`);
    const result = await generateAndProcessTechnicalQuestions({
      userId,
      sessionId,
      candidateProfile,
    });
    console.log(`[REAL INTERVIEW AI] round=technical requestCompleted=true count=${result.questions?.length || 20}`);

    res.status(201).json({
      sessionId,
      ...result,
    });
  } catch (error) {
    console.error("[RealInterviewController] Technical Generation Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to generate Real Interview Technical Questions",
    });
  }
};

/**
 * GET /api/real-interview/technical/next-question
 */
export const getNextTechnical = async (req, res) => {
  try {
    const sessionId = req.query?.sessionId || req.body?.sessionId;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId parameter is required" });
    }

    const result = await getNextTechnicalQuestion({ sessionId });
    res.status(200).json(result);
  } catch (error) {
    console.error("[RealInterviewController] Get Next Technical Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch next Technical Question",
    });
  }
};

/**
 * POST /api/real-interview/technical/submit-answer
 */
export const submitTechnical = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { sessionId, questionId, candidateAnswer } = req.body || {};

    if (!sessionId || !questionId) {
      return res.status(400).json({ success: false, message: "sessionId and questionId are required" });
    }

    const result = await submitTechnicalAnswer({
      sessionId,
      questionId,
      candidateAnswer,
      userId,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("[RealInterviewController] Technical Submit Answer Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to save Technical Answer",
    });
  }
};

/**
 * POST /api/real-interview/technical/evaluate
 */
export const evaluateTechnical = async (req, res) => {
  try {
    const sessionId = req.body?.sessionId;
    const candidateProfile = req.body?.candidateProfile || req.body?.resume || {};

    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId parameter is required for evaluation" });
    }

    const result = await evaluateTechnicalInterviewSession({
      sessionId,
      candidateProfile,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("[RealInterviewController] Technical Evaluate Session Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to evaluate Technical Interview session",
    });
  }
};

/**
 * POST /api/real-interview/project/generate
 */
export const generateProject = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const sessionId = req.body?.sessionId || `project_session_${Date.now()}`;
    const candidateProfile = await getOrBuildCandidateResumeContext(userId, req.body?.candidateProfile || req.body?.resume || {});

    console.log(`[REAL INTERVIEW AI] round=project keyPresent=${Boolean((process.env.REAL_INTERVIEW_PROJECT_API_KEY || "").trim())} provider=groq requestStarted=true`);
    const result = await generateAndProcessProjectQuestions({
      userId,
      sessionId,
      candidateProfile,
    });
    console.log(`[REAL INTERVIEW AI] round=project requestCompleted=true count=${result.questions?.length || 10}`);

    res.status(201).json({
      sessionId,
      ...result,
    });
  } catch (error) {
    console.error("[RealInterviewController] Project Generation Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to generate Real Interview Project Questions",
    });
  }
};

/**
 * GET /api/real-interview/project/next-question
 */
export const getNextProject = async (req, res) => {
  try {
    const sessionId = req.query?.sessionId || req.body?.sessionId;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId parameter is required" });
    }

    const result = await getNextProjectQuestion({ sessionId });
    res.status(200).json(result);
  } catch (error) {
    console.error("[RealInterviewController] Get Next Project Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch next Project Question",
    });
  }
};

/**
 * POST /api/real-interview/project/submit-answer
 */
export const submitProject = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { sessionId, questionId, candidateAnswer } = req.body || {};

    if (!sessionId || !questionId) {
      return res.status(400).json({ success: false, message: "sessionId and questionId are required" });
    }

    const result = await submitProjectAnswer({
      sessionId,
      questionId,
      candidateAnswer,
      userId,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("[RealInterviewController] Project Submit Answer Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to save Project Answer",
    });
  }
};

/**
 * POST /api/real-interview/project/evaluate
 */
export const evaluateProject = async (req, res) => {
  try {
    const sessionId = req.body?.sessionId;
    const candidateProfile = req.body?.candidateProfile || req.body?.resume || {};

    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId parameter is required for evaluation" });
    }

    const result = await evaluateProjectInterviewSession({
      sessionId,
      candidateProfile,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("[RealInterviewController] Project Evaluate Session Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to evaluate Project Interview session",
    });
  }
};

/**
 * POST /api/real-interview/hr/generate
 */
export const generateHR = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const sessionId = req.body?.sessionId || `hr_session_${Date.now()}`;
    console.log(`[HR-DIAGNOSTIC] Incoming POST /api/real-interview/hr/generate sessionId=${sessionId} userId=${userId || "ANONYMOUS"}`);

    const candidateProfile = await getOrBuildCandidateResumeContext(userId, req.body?.candidateProfile || req.body?.resume || {});
    console.log(`[HR-DIAGNOSTIC] Resume context retrieved: name=${candidateProfile.fullName || candidateProfile.name || "Candidate"}, skillsCount=${(candidateProfile.skills || []).length}, projectsCount=${(candidateProfile.projects || []).length}`);

    const hasKey = Boolean((process.env.REAL_INTERVIEW_HR_API_KEY || "").trim());
    console.log(`[HR-DIAGNOSTIC] REAL_INTERVIEW_HR_API_KEY present: ${hasKey} (key value hidden)`);

    const result = await generateAndProcessHRQuestions({
      userId,
      sessionId,
      candidateProfile,
    });
    console.log(`[HR-DIAGNOSTIC] HR generation successfully completed count=${result.questions?.length || result.count || 5}`);

    res.status(201).json({
      sessionId,
      ...result,
    });
  } catch (error) {
    console.error("[RealInterviewController] HR Generation Error:", error.message, error.stack);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to generate Real Interview HR Questions",
      error: error.message,
    });
  }
};

/**
 * GET /api/real-interview/hr/next-question
 */
export const getNextHR = async (req, res) => {
  try {
    const sessionId = req.query?.sessionId || req.body?.sessionId;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId parameter is required" });
    }

    const result = await getNextHRQuestion({ sessionId });
    res.status(200).json(result);
  } catch (error) {
    console.error("[RealInterviewController] Get Next HR Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch next HR Question",
    });
  }
};

/**
 * POST /api/real-interview/hr/submit-answer
 */
export const submitHR = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { sessionId, questionId, candidateAnswer } = req.body || {};

    if (!sessionId || !questionId) {
      return res.status(400).json({ success: false, message: "sessionId and questionId are required" });
    }

    const result = await submitHRAnswer({
      sessionId,
      questionId,
      candidateAnswer,
      userId,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("[RealInterviewController] HR Submit Answer Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to save HR Answer",
    });
  }
};

/**
 * POST /api/real-interview/hr/evaluate
 */
export const evaluateHR = async (req, res) => {
  try {
    const sessionId = req.body?.sessionId;
    const candidateProfile = req.body?.candidateProfile || req.body?.resume || {};

    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId parameter is required for evaluation" });
    }

    const result = await evaluateHRInterviewSession({
      sessionId,
      candidateProfile,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("[RealInterviewController] HR Evaluate Session Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to evaluate HR Interview session",
    });
  }
};

/**
 * POST /api/real-interview/coding/generate
 */
export const generateCoding = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const sessionId = req.body?.sessionId || `coding_session_${Date.now()}`;
    const candidateProfile = await getOrBuildCandidateResumeContext(userId, req.body?.candidateProfile || req.body?.resume || {});

    console.log(`[REAL INTERVIEW AI] round=coding keyPresent=${Boolean((process.env.REAL_INTERVIEW_CODING_API_KEY || "").trim())} provider=groq requestStarted=true`);
    const result = await generateAndProcessCodingQuestions({
      userId,
      sessionId,
      candidateProfile,
    });
    console.log(`[REAL INTERVIEW AI] round=coding requestCompleted=true count=${result.questions?.length || 3}`);

    res.status(201).json({
      sessionId,
      ...result,
    });
  } catch (error) {
    console.error("[RealInterviewController] Coding Generation Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to generate Real Interview Coding Problems",
    });
  }
};

/**
 * GET /api/real-interview/coding/questions
 */
export const getCodingQuestionsController = async (req, res) => {
  try {
    const sessionId = req.query?.sessionId || req.body?.sessionId;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId parameter is required" });
    }

    const result = await getCodingQuestions({ sessionId });
    res.status(200).json(result);
  } catch (error) {
    console.error("[RealInterviewController] Get Coding Questions Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch Coding Problems",
    });
  }
};

/**
 * POST /api/real-interview/coding/run
 * Runs candidate code against visible test cases ONLY (0 AI Calls).
 */
export const runCoding = async (req, res) => {
  try {
    const { sessionId, questionId, language, sourceCode, code } = req.body || {};
    const effectiveCode = sourceCode || code;

    if (!sessionId || !questionId || !language || !effectiveCode) {
      return res.status(400).json({
        success: false,
        message: "sessionId, questionId, language, and sourceCode are required to run code",
      });
    }

    const result = await runCodingCode({
      sessionId,
      questionId,
      language,
      sourceCode: effectiveCode,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("[RealInterviewController] Run Coding Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to execute code",
    });
  }
};

/**
 * POST /api/real-interview/coding/submit
 * Submits candidate code against visible + hidden test cases via Judge0 (0 AI Calls).
 */
export const submitCoding = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { sessionId, questionId, language, sourceCode, code } = req.body || {};
    const effectiveCode = sourceCode || code;

    if (!sessionId || !questionId || !language || !effectiveCode) {
      return res.status(400).json({
        success: false,
        message: "sessionId, questionId, language, and sourceCode are required to submit code",
      });
    }

    const result = await submitCodingCode({
      sessionId,
      questionId,
      language,
      sourceCode: effectiveCode,
      userId,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("[RealInterviewController] Submit Coding Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to submit code solution",
    });
  }
};

/**
 * POST /api/real-interview/coding/evaluate
 */
export const evaluateCoding = async (req, res) => {
  try {
    const sessionId = req.body?.sessionId;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId parameter is required for evaluation" });
    }

    const result = await evaluateCodingInterviewSession({ sessionId });
    res.status(200).json(result);
  } catch (error) {
    console.error("[RealInterviewController] Evaluate Coding Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to evaluate Coding session",
    });
  }
};

/**
 * POST /api/real-interview/submit
 * Triggers the authoritative master result pipeline.
 */
export const submitRealInterview = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { sessionId } = req.body || {};

    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId is required for interview submission" });
    }

    // Launch pipeline synchronously or asynchronously; start execution
    const pipelinePromise = executeRealInterviewResultPipeline({ sessionId, userId });

    // Wait up to 3 seconds for initial status or complete if fast
    const raceResult = await Promise.race([
      pipelinePromise,
      new Promise((resolve) => setTimeout(() => resolve("TIMED_OUT_WAITING"), 2500)),
    ]);

    if (raceResult !== "TIMED_OUT_WAITING") {
      return res.status(200).json({
        success: true,
        sessionId,
        status: raceResult.status,
        evaluationStage: raceResult.evaluationStage,
        evaluationProgress: raceResult.evaluationProgress,
        result: raceResult.status === "COMPLETED" ? raceResult : null,
      });
    }

    // Still progressing
    const currentDoc = await RealInterviewResult.findOne({ sessionId }).lean();
    res.status(202).json({
      success: true,
      sessionId,
      status: currentDoc?.status || "SUBMITTED",
      evaluationStage: currentDoc?.evaluationStage || "Saving interview responses",
      evaluationProgress: currentDoc?.evaluationProgress || 10,
    });
  } catch (error) {
    console.error("[RealInterviewController] Submit Interview Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to start interview result evaluation pipeline",
    });
  }
};

/**
 * GET /api/real-interview/result/:sessionId/status
 * Fetches real-time backend evaluation progress.
 */
export const getRealInterviewResultStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId is required" });
    }

    const resultDoc = await RealInterviewResult.findOne({ sessionId }).lean();
    if (!resultDoc) {
      return res.status(404).json({
        success: false,
        sessionId,
        status: "NOT_SUBMITTED",
        evaluationStage: "Interview not submitted yet",
        evaluationProgress: 0,
      });
    }

    res.status(200).json({
      success: true,
      sessionId,
      status: resultDoc.status,
      evaluationStage: resultDoc.evaluationStage,
      evaluationProgress: resultDoc.evaluationProgress,
      errorDetails: resultDoc.errorDetails || "",
    });
  } catch (error) {
    console.error("[RealInterviewController] Get Result Status Error:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to fetch evaluation status" });
  }
};

/**
 * GET /api/real-interview/result/:sessionId
 * Fetches stored authoritative final result object (only if status === "COMPLETED").
 */
export const getRealInterviewResult = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId is required" });
    }

    const resultDoc = await RealInterviewResult.findOne({ sessionId }).lean();
    if (!resultDoc) {
      return res.status(404).json({ success: false, message: "Result not found for this session" });
    }

    if (resultDoc.status !== "COMPLETED") {
      return res.status(200).json({
        success: false,
        status: resultDoc.status,
        evaluationStage: resultDoc.evaluationStage,
        evaluationProgress: resultDoc.evaluationProgress,
        message: "Result evaluation not yet completed",
      });
    }

    res.status(200).json({
      success: true,
      result: resultDoc,
    });
  } catch (error) {
    console.error("[RealInterviewController] Get Result Error:", error.message);
    res.status(500).json({ success: false, message: error.message || "Failed to fetch result" });
  }
};

/**
 * POST /api/real-interview/result/:sessionId/retry
 * Retries failed evaluation pipeline for existing session.
 */
export const retryRealInterviewEvaluation = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId is required to retry evaluation" });
    }

    const result = await executeRealInterviewResultPipeline({ sessionId, userId });
    res.status(200).json({
      success: true,
      sessionId,
      status: result.status,
      evaluationStage: result.evaluationStage,
      evaluationProgress: result.evaluationProgress,
      result: result.status === "COMPLETED" ? result : null,
    });
  } catch (error) {
    console.error("[RealInterviewController] Retry Evaluation Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retry result evaluation pipeline",
    });
  }
};



