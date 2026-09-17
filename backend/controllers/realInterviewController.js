import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
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
import { calculateRealInterviewResult } from "../services/realInterview/realInterviewResultService.js";
import RealInterviewResult from "../models/RealInterviewResult.js";
import Interview from "../models/Interview.js";
import User from "../models/User.js";
import { sessionManager } from "../services/aiReliability/index.js";

/**
 * POST /api/real-interview/byok/set-session-key
 */
export const setSessionBYOKController = async (req, res) => {
  try {
    const { sessionId, provider, apiKey } = req.body || {};
    if (!sessionId || !provider || !apiKey) {
      return res.status(400).json({ success: false, message: "sessionId, provider, and apiKey are required" });
    }

    sessionManager.setSessionBYOK(sessionId, provider, apiKey);
    res.status(200).json({
      success: true,
      message: `BYOK provider [${provider}] successfully bound to session`,
      sessionId
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Generates structured evidence-based performance feedback for PDF and Web UI.
 */
function buildEvidenceBasedRoundFeedback(roundKey, roundName, attemptedCount, totalQuestions, score, maxScore, questionResults = []) {
  if (!attemptedCount || attemptedCount === 0) {
    return {
      roundName,
      statusLabel: "NOT ASSESSED",
      isAttempted: false,
      insight: "This section was not attempted, so there is not enough response data to evaluate performance.",
      strengths: [],
      focusAreas: [],
      nextStep: "Attempt this round in your next session to receive detailed performance evaluation.",
    };
  }

  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const roundQuestions = questionResults.filter((q) => {
    if (roundKey === "aptitude") return q.roundType === "APTITUDE";
    if (roundKey === "technical") return q.roundType === "TECHNICAL";
    if (roundKey === "project") return q.roundType === "RESUME_PROJECT";
    if (roundKey === "hr") return q.roundType === "HR";
    if (roundKey === "coding") return q.roundType === "CODING";
    return false;
  });

  const correctCount = roundQuestions.filter((q) => q.status === "CORRECT").length;

  let statusLabel = "Needs Improvement";
  if (pct >= 70) statusLabel = "Strong Performance";
  else if (pct >= 35) statusLabel = "Good Progress";

  let insight = "";
  let strengths = [];
  let focusAreas = [];
  let nextStep = "";

  if (roundKey === "aptitude") {
    if (pct >= 70) {
      insight = `Demonstrates strong quantitative precision and analytical problem-solving (${correctCount}/${totalQuestions} correct).`;
      strengths = ["High calculation accuracy in core reasoning topics.", `Successfully solved ${correctCount} aptitude questions.`];
      focusAreas = ["Maintain precision across complex multi-step reasoning problems."];
      nextStep = "Practice advanced timed aptitude sets to maintain high accuracy under time constraints.";
    } else if (pct >= 35) {
      insight = `Shows foundational problem-solving ability, but accuracy decreases on multi-step reasoning problems (${correctCount}/${attemptedCount} correct).`;
      strengths = [`Completed ${attemptedCount} out of ${totalQuestions} aptitude questions.`, "Demonstrated correct methodology on direct calculation problems."];
      focusAreas = ["Reduce calculation errors in multi-step quantitative problems.", "Improve time management per question."];
      nextStep = "Review incorrect questions step-by-step and practice targeted drills on calculation accuracy.";
    } else {
      insight = `Response accuracy indicates fundamental gaps in quantitative methods and reasoning (${correctCount}/${attemptedCount} correct).`;
      strengths = [`Completed ${attemptedCount} aptitude questions.`];
      focusAreas = ["Strengthen core mathematical formulas and shortcut techniques.", "Verify calculations systematically before selecting options."];
      nextStep = "Focus on foundational quantitative topics before attempting full-length timed tests.";
    }
  } else if (roundKey === "technical") {
    if (pct >= 70) {
      insight = `Demonstrates thorough technical domain knowledge and strong conceptual clarity (${score}/${maxScore} score).`;
      strengths = ["Strong explanation quality and conceptual accuracy.", "Articulates software engineering fundamentals effectively."];
      focusAreas = ["Incorporate architectural trade-offs and edge-case considerations into responses."];
      nextStep = "Practice deeper system design discussions and trade-off analysis for advanced rounds.";
    } else if (pct >= 35) {
      insight = `Displays foundational technical knowledge but lacks depth when explaining underlying mechanics (${score}/${maxScore} score).`;
      strengths = ["Correctly identified primary technical concepts.", `Answered ${attemptedCount} technical evaluation questions.`];
      focusAreas = ["Elaborate on internal workings, data flow, and underlying system mechanics.", "Structure responses using definition, mechanism, and use-case frameworks."];
      nextStep = "Deepen understanding of core theoretical concepts and practice explaining technical mechanisms aloud.";
    } else {
      insight = `Technical evaluation indicates limited depth in core engineering concepts (${score}/${maxScore} score).`;
      strengths = [`Attempted ${attemptedCount} technical questions.`];
      focusAreas = ["Build solid fundamentals in data structures, operating systems, and database internals.", "Provide concrete technical details and examples instead of high-level definitions."];
      nextStep = "Review fundamental technical subject material and practice answering core interview questions in detail.";
    }
  } else if (roundKey === "project") {
    if (pct >= 70) {
      insight = `Excellent articulation of project architecture, technical stack decisions, and real-world engineering challenges (${score}/${maxScore} score).`;
      strengths = ["Clear explanation of project architecture and personal contributions.", "Strong technical justification for database and API decisions."];
      focusAreas = ["Detail scalability bottlenecks and production deployment monitoring."];
      nextStep = "Prepare deeper metrics and benchmark results for key system bottlenecks in your portfolio projects.";
    } else if (pct >= 35) {
      insight = `Satisfactory overview of portfolio projects, but explanations lacked technical granularity regarding trade-offs (${score}/${maxScore} score).`;
      strengths = ["Clearly stated project objectives and tech stack.", `Answered ${attemptedCount} project questions.`];
      focusAreas = ["Provide specific implementation details rather than generic feature descriptions.", "Explain challenges faced and exact debugging techniques used."];
      nextStep = "Document system architecture diagrams, API schemas, and key technical challenges for all portfolio projects.";
    } else {
      insight = `Project evaluation indicates difficulty in defending architectural decisions of portfolio work (${score}/${maxScore} score).`;
      strengths = [`Attempted ${attemptedCount} project questions.`];
      focusAreas = ["Revisit project codebases to recall exact implementations and data flows.", "Practice explaining personal contributions vs team contributions clearly."];
      nextStep = "Perform a technical audit of your projects to articulate architecture and implementation details with confidence.";
    }
  } else if (roundKey === "hr") {
    if (pct >= 70) {
      insight = `Strong behavioral responses demonstrating leadership, decision-making, and clear professional communication (${score}/${maxScore} score).`;
      strengths = ["Clear, structured behavioral responses highlighting personal accountability.", "Demonstrates adaptability, teamwork, and problem resolution."];
      focusAreas = ["Ensure behavioral answers conclude with quantifiable business impact."];
      nextStep = "Refine behavioral scenarios using the STAR technique with emphasis on measurable results.";
    } else if (pct >= 35) {
      insight = `Good communication style, but behavioral examples could be structured more effectively using situation-action-result frameworks (${score}/${maxScore} score).`;
      strengths = ["Professional demeanor and clear articulation.", `Attempted ${attemptedCount} behavioral questions.`];
      focusAreas = ["Use the STAR method (Situation, Task, Action, Result) to structure answers.", "Highlight personal ownership and specific actions taken."];
      nextStep = "Draft structured story archives mapped to standard behavioral competencies.";
    } else {
      insight = `Behavioral evaluation highlights need for improved response structure and personal accountability narrative (${score}/${maxScore} score).`;
      strengths = [`Completed ${attemptedCount} behavioral questions.`];
      focusAreas = ["Structure responses clearly to avoid vague or overly brief answers.", "Focus on demonstrating ownership and constructive conflict resolution."];
      nextStep = "Practice framing past experiences into structured narratives that demonstrate professional growth.";
    }
  } else if (roundKey === "coding") {
    if (pct >= 70) {
      insight = `Strong algorithmic problem-solving, clean code structure, and successful test case execution (${score}/${maxScore} score).`;
      strengths = ["Correct algorithmic logic and syntax implementation.", "Successful compilation and passing test cases."];
      focusAreas = ["Analyze and state optimal time and space complexity explicitly."];
      nextStep = "Practice hard-level algorithmic problems and focus on optimal time-complexity optimization.";
    } else if (pct >= 35) {
      insight = `Demonstrates basic problem-solving logic, but submitted code encountered edge-case failures or sub-optimal complexity (${score}/${maxScore} score).`;
      strengths = [`Submitted code for ${attemptedCount} coding challenges.`, "Identified correct initial data structures."];
      focusAreas = ["Handle edge cases (boundaries, empty inputs) thoroughly before submission.", "Improve code optimization for execution time limits."];
      nextStep = "Practice dry-running code against edge-case inputs prior to execution and submission.";
    } else {
      insight = `Coding evaluation indicates difficulty in implementing functional solutions within execution constraints (${score}/${maxScore} score).`;
      strengths = [`Submitted code attempts for ${attemptedCount} problem(s).`];
      focusAreas = ["Strengthen mastery of standard language syntax and array manipulation.", "Practice translating logic into clean, compilable code."];
      nextStep = "Focus on easy-to-medium coding problems to build syntax fluency and algorithmic confidence.";
    }
  }

  return {
    roundName,
    statusLabel,
    isAttempted: true,
    insight,
    strengths,
    focusAreas,
    nextStep,
  };
}

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

    const result = await generateAndProcessTechnicalQuestions({
      userId,
      sessionId,
      candidateProfile,
    });
    console.log(`[REAL INTERVIEW AI] round=technical executionCompleted=${result.executionCompleted} generationSucceeded=${result.generationSucceeded} roundComplete=${result.roundComplete} count=${result.count}/${result.expectedCount || 20} status=${result.status}`);

    const httpStatus = result.roundComplete ? 200 : 200;
    res.status(httpStatus).json({
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

    const result = await generateAndProcessProjectQuestions({
      userId,
      sessionId,
      candidateProfile,
    });
    console.log(`[REAL INTERVIEW AI] round=project executionCompleted=${result.executionCompleted} generationSucceeded=${result.generationSucceeded} roundComplete=${result.roundComplete} count=${result.count}/${result.expectedCount || 10} status=${result.status}`);

    res.status(200).json({
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
    const candidateProfile = await getOrBuildCandidateResumeContext(userId, req.body?.candidateProfile || req.body?.resume || {});

    const result = await generateAndProcessHRQuestions({
      userId,
      sessionId,
      candidateProfile,
    });
    console.log(`[REAL INTERVIEW AI] round=hr executionCompleted=${result.executionCompleted} generationSucceeded=${result.generationSucceeded} roundComplete=${result.roundComplete} count=${result.count}/${result.expectedCount || 5} status=${result.status}`);

    res.status(200).json({
      sessionId,
      ...result,
    });
  } catch (error) {
    console.error("[RealInterviewController] HR Generation Error:", error.message);
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

    const result = await generateAndProcessCodingQuestions({
      userId,
      sessionId,
      candidateProfile,
    });
    console.log(`[REAL INTERVIEW AI] round=coding executionCompleted=${result.executionCompleted} generationSucceeded=${result.generationSucceeded} roundComplete=${result.roundComplete} count=${result.count}/${result.expectedCount || 3} status=${result.status}`);

    res.status(200).json({
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

    // Launch result calculation
    const pipelinePromise = calculateRealInterviewResult({ sessionId, userId });

    // Wait up to 3 seconds for initial status or complete if fast
    const raceResult = await Promise.race([
      pipelinePromise,
      new Promise((resolve) => setTimeout(() => resolve("TIMED_OUT_WAITING"), 2500)),
    ]);

    if (raceResult !== "TIMED_OUT_WAITING") {
      return res.status(200).json({
        success: raceResult.status === "COMPLETED",
        sessionId,
        status: raceResult.status,
        result: raceResult.status === "COMPLETED" ? raceResult : null,
        message: raceResult.status === "EVALUATION_FAILED"
          ? "Your interview was completed successfully, but we couldn't generate your result right now. Your answers are safely saved. The AI evaluation service is temporarily unavailable. Please try again later."
          : undefined,
      });
    }

    // Still progressing
    const currentDoc = await RealInterviewResult.findOne({ sessionId }).lean();
    res.status(202).json({
      success: true,
      sessionId,
      status: currentDoc?.status || "CALCULATING",
      message: "Result evaluation in progress",
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
    if (resultDoc) {
      return res.status(200).json({
        success: true,
        sessionId,
        status: resultDoc.status,
        message: resultDoc.status === "EVALUATION_FAILED"
          ? "Your interview was completed successfully, but we couldn't generate your result right now. Your answers are safely saved. The AI evaluation service is temporarily unavailable. Please try again later."
          : undefined,
      });
    }

    // Result doc not created yet — check Interview session
    const interviewDoc = await Interview.findById(sessionId).lean().catch(() => null);
    if (!interviewDoc) {
      return res.status(404).json({
        success: false,
        sessionId,
        status: "NOT_FOUND",
        message: "Interview session not found",
      });
    }

    let status = "NOT_SUBMITTED";
    if (interviewDoc.status === "SUBMITTED" || interviewDoc.status === "CALCULATING") {
      status = "CALCULATING";
    } else if (interviewDoc.status === "EVALUATION_FAILED") {
      status = "EVALUATION_FAILED";
    } else if (interviewDoc.status === "completed") {
      status = "COMPLETED";
    }

    res.status(200).json({
      success: true,
      sessionId,
      status,
      message: status === "CALCULATING" ? "Evaluation in progress" : undefined,
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

    if (resultDoc.status === "EVALUATION_FAILED") {
      return res.status(200).json({
        success: false,
        status: "EVALUATION_FAILED",
        message: "Your interview was completed successfully, but we couldn't generate your result right now. Your answers are safely saved. The AI evaluation service is temporarily unavailable. Please try again later.",
      });
    }

    if (resultDoc.status !== "COMPLETED") {
      return res.status(200).json({
        success: false,
        status: resultDoc.status,
        message: "Result evaluation not yet completed",
      });
    }

    const userDoc = await User.findById(resultDoc.userId).select("name email").lean().catch(() => null);
    if (userDoc) {
      resultDoc.candidateName = userDoc.name;
      resultDoc.candidateEmail = userDoc.email;
    }

    console.log(`[RESULT-BACKEND] sessionId=${sessionId} totalObtained=${resultDoc.totalObtained} maxScore=${resultDoc.maximumMarks} percentage=${resultDoc.percentage}`);

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

    const result = await calculateRealInterviewResult({ sessionId, userId });
    res.status(200).json({
      success: result.status === "COMPLETED",
      sessionId,
      status: result.status,
      result: result.status === "COMPLETED" ? result : null,
      message: result.status === "EVALUATION_FAILED"
        ? "Your interview was completed successfully, but we couldn't generate your result right now. Your answers are safely saved. The AI evaluation service is temporarily unavailable. Please try again later."
        : undefined,
    });
  } catch (error) {
    console.error("[RealInterviewController] Retry Evaluation Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retry result evaluation pipeline",
    });
  }
};

/**
 * GET /api/real-interview/result/:sessionId/pdf
 * Generates and downloads a real, structured PDF assessment report using PDFKit.
 * NO web screenshots, NO HTML image conversions, NO AI calls.
 */
export const downloadRealInterviewResultPDF = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId is required" });
    }

    const resultDoc = await RealInterviewResult.findOne({ sessionId }).lean();
    if (!resultDoc) {
      return res.status(404).json({ success: false, message: "Interview result not found for this session" });
    }

    // Security ownership check: verify user owns this interview session
    if (userId && resultDoc.userId && resultDoc.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized. You are not permitted to access another candidate's interview report.",
      });
    }

    const userDoc = await User.findById(resultDoc.userId).select("name email").lean().catch(() => null);
    const candidateName = userDoc?.name || req.user?.name || "Candidate";

    const filename = `Prephire_Real_Interview_Result_${sessionId}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      info: {
        Title: `Prephire Real Interview Assessment Report - ${sessionId}`,
        Author: "Prephire Assessment Platform",
        Subject: "Official Candidate Real Interview Assessment Report",
      },
      permissions: {
        modifying: false,
        copying: false,
        annotating: false,
        fillingForms: false,
      },
    });

    doc.pipe(res);

    const COLOR_TEXT = "#000000";
    const COLOR_MUTED = "#475569";
    const COLOR_BRAND = "#d97706";
    const COLOR_RED = "#dc2626";
    const COLOR_AMBER = "#d97706";
    const COLOR_GREEN = "#16a34a";
    const COLOR_BORDER = "#cbd5e1";

    const totalObtained = Number(resultDoc.totalObtained ?? 0);
    const maxScore = Number(resultDoc.maximumMarks ?? 450);
    const percentage = typeof resultDoc.percentage === "number"
      ? resultDoc.percentage
      : maxScore > 0
      ? Number(((totalObtained / maxScore) * 100).toFixed(2))
      : 0;

    let overallLabel = "NEEDS IMPROVEMENT";
    let overallColor = COLOR_RED;
    if (percentage >= 70) {
      overallLabel = "STRONG PERFORMANCE";
      overallColor = COLOR_GREEN;
    } else if (percentage >= 35) {
      overallLabel = "GOOD PROGRESS";
      overallColor = COLOR_AMBER;
    }

    // --- PDF HEADER ---
    const logoPath = path.resolve("frontend/public/images/metadata.png");
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, 40, 35, { width: 42 });
      } catch (err) {}
    }

    doc.fillColor(COLOR_BRAND).fontSize(16).font("Helvetica-Bold").text("PREPHIRE", 90, 38);
    doc.fillColor(COLOR_TEXT).fontSize(11).font("Helvetica-Bold").text("REAL INTERVIEW ASSESSMENT REPORT", 90, 56);

    doc.moveTo(40, 80).lineTo(555, 80).strokeColor(COLOR_BORDER).lineWidth(1).stroke();

    // --- METADATA HEADER BOX ---
    doc.rect(40, 90, 515, 55).fillAndStroke("#f8fafc", COLOR_BORDER);

    doc.fillColor(COLOR_MUTED).fontSize(9).font("Helvetica").text("Candidate:", 50, 100);
    doc.fillColor(COLOR_TEXT).fontSize(9).font("Helvetica-Bold").text(candidateName, 105, 100);

    doc.fillColor(COLOR_MUTED).fontSize(9).font("Helvetica").text("Interview ID:", 50, 118);
    doc.fillColor(COLOR_TEXT).fontSize(9).font("Courier").text(sessionId, 115, 118);

    const formattedDate = resultDoc.completedAt
      ? new Date(resultDoc.completedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : resultDoc.createdAt
      ? new Date(resultDoc.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : "Completed";

    doc.fillColor(COLOR_MUTED).fontSize(9).font("Helvetica").text("Date:", 350, 100);
    doc.fillColor(COLOR_TEXT).fontSize(9).font("Helvetica").text(formattedDate, 385, 100);

    doc.fillColor(COLOR_MUTED).fontSize(9).font("Helvetica").text("Status:", 350, 118);
    doc.fillColor(COLOR_GREEN).fontSize(9).font("Helvetica-Bold").text("COMPLETED", 390, 118);

    // --- OVERALL RESULT HERO BOX ---
    let y = 160;
    doc.rect(40, y, 515, 75).fillAndStroke("#f1f5f9", COLOR_BORDER);

    doc.fillColor(COLOR_MUTED).fontSize(9).font("Helvetica-Bold").text("FINAL ASSESSMENT RESULT", 52, y + 10);

    doc.fillColor(overallColor).fontSize(26).font("Helvetica-Bold").text(`${totalObtained}`, 52, y + 26);
    const scoreStrWidth = doc.widthOfString(`${totalObtained}`, { fontSize: 26 });
    doc.fillColor(COLOR_MUTED).fontSize(14).font("Helvetica").text(` / ${maxScore}`, 52 + scoreStrWidth, y + 36);

    doc.fillColor(overallColor).fontSize(16).font("Helvetica-Bold").text(`${percentage}%`, 220, y + 30);

    doc.rect(360, y + 22, 180, 24).fillAndStroke(overallColor, overallColor);
    doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold").text(overallLabel, 365, y + 29, { width: 170, align: "center" });

    const attemptedCount = resultDoc.attemptedQuestionsCount ?? 0;
    const totalCount = resultDoc.totalQuestionsCount ?? 53;
    const unattemptedCount = Math.max(0, totalCount - attemptedCount);

    doc.fillColor(COLOR_MUTED).fontSize(8.5).font("Helvetica").text(`Questions Attempted: ${attemptedCount} / ${totalCount}   |   Questions Not Attempted: ${unattemptedCount} / ${totalCount}`, 52, y + 56);

    // --- ROUND PERFORMANCE TABLE ---
    y += 90;
    doc.fillColor(COLOR_TEXT).fontSize(11).font("Helvetica-Bold").text("ROUND PERFORMANCE", 40, y);
    y += 15;

    // Table Header
    doc.rect(40, y, 515, 20).fillAndStroke("#e2e8f0", COLOR_BORDER);
    doc.fillColor(COLOR_TEXT).fontSize(8).font("Helvetica-Bold");
    doc.text("ROUND", 48, y + 6, { width: 110 });
    doc.text("QUESTIONS", 160, y + 6, { width: 70, align: "center" });
    doc.text("ATTEMPTED", 235, y + 6, { width: 80, align: "center" });
    doc.text("SCORE", 320, y + 6, { width: 80, align: "center" });
    doc.text("PERFORMANCE", 410, y + 6, { width: 135, align: "center" });
    y += 20;

    const roundList = [
      { name: "Aptitude", key: "aptitude", totalQ: 15, defaultMax: 50 },
      { name: "Technical", key: "technical", totalQ: 20, defaultMax: 100 },
      { name: "Project", key: "project", totalQ: 10, defaultMax: 100 },
      { name: "HR Behavioral", key: "hr", totalQ: 5, defaultMax: 100 },
      { name: "Coding", key: "coding", totalQ: 3, defaultMax: 100 },
    ];

    const roundFeedbacks = {};

    for (let rIdx = 0; rIdx < roundList.length; rIdx++) {
      const r = roundList[rIdx];
      const rData = resultDoc.rounds?.[r.key] || {};
      const score = Number(rData.obtained ?? 0);
      const max = Number(rData.maximum ?? r.defaultMax);
      const attempted = Number(rData.attempted ?? 0);
      const totalQ = Number(rData.totalQuestions ?? r.totalQ);
      const pct = max > 0 ? Number(((score / max) * 100).toFixed(1)) : 0;

      let rColor = COLOR_MUTED;
      let rStatus = "NOT ATTEMPTED";

      if (attempted > 0) {
        if (pct >= 70) {
          rColor = COLOR_GREEN;
          rStatus = "STRONG PERFORMANCE";
        } else if (pct >= 35) {
          rColor = COLOR_AMBER;
          rStatus = "GOOD PROGRESS";
        } else {
          rColor = COLOR_RED;
          rStatus = "NEEDS IMPROVEMENT";
        }
      }

      doc.rect(40, y, 515, 18).fillAndStroke(rIdx % 2 === 0 ? "#ffffff" : "#f8fafc", COLOR_BORDER);
      doc.fillColor(COLOR_TEXT).fontSize(8.5).font("Helvetica-Bold").text(r.name, 48, y + 5, { width: 110 });
      doc.fillColor(COLOR_MUTED).fontSize(8.5).font("Helvetica").text(`${totalQ}`, 160, y + 5, { width: 70, align: "center" });
      doc.fillColor(attempted > 0 ? COLOR_TEXT : COLOR_MUTED).fontSize(8.5).font("Helvetica").text(`${attempted} / ${totalQ}`, 235, y + 5, { width: 80, align: "center" });
      doc.fillColor(attempted > 0 ? COLOR_TEXT : COLOR_MUTED).fontSize(8.5).font("Helvetica-Bold").text(attempted > 0 ? `${score} / ${max}` : "NOT ATTEMPTED", 320, y + 5, { width: 80, align: "center" });
      doc.fillColor(rColor).fontSize(8).font("Helvetica-Bold").text(rStatus, 410, y + 5, { width: 135, align: "center" });
      y += 18;

      roundFeedbacks[r.key] = buildEvidenceBasedRoundFeedback(r.key, r.name, attempted, totalQ, score, max, resultDoc.questionResults || []);
    }

    // Summary Total Row
    doc.rect(40, y, 515, 20).fillAndStroke("#e2e8f0", COLOR_BORDER);
    doc.fillColor(COLOR_TEXT).fontSize(8.5).font("Helvetica-Bold").text("TOTAL", 48, y + 5, { width: 110 });
    doc.fillColor(COLOR_TEXT).fontSize(8.5).font("Helvetica-Bold").text(`${totalCount}`, 160, y + 5, { width: 70, align: "center" });
    doc.fillColor(COLOR_TEXT).fontSize(8.5).font("Helvetica-Bold").text(`${attemptedCount} / ${totalCount}`, 235, y + 5, { width: 80, align: "center" });
    doc.fillColor(COLOR_TEXT).fontSize(8.5).font("Helvetica-Bold").text(`${totalObtained} / ${maxScore}`, 320, y + 5, { width: 80, align: "center" });
    doc.fillColor(overallColor).fontSize(8).font("Helvetica-Bold").text(overallLabel, 410, y + 5, { width: 135, align: "center" });
    y += 20;

    // --- STUDENT PERFORMANCE SUMMARY SECTION ---
    y += 20;
    doc.fillColor(COLOR_TEXT).fontSize(11).font("Helvetica-Bold").text("STUDENT PERFORMANCE SUMMARY", 40, y);
    y += 15;

    for (const rKey of ["aptitude", "technical", "project", "hr", "coding"]) {
      const fb = roundFeedbacks[rKey];

      if (y > 710) {
        doc.addPage();
        y = 40;
      }

      if (!fb.isAttempted) {
        doc.rect(40, y, 515, 30).fillAndStroke("#f8fafc", COLOR_BORDER);
        doc.fillColor(COLOR_TEXT).fontSize(9).font("Helvetica-Bold").text(fb.roundName, 48, y + 5);
        doc.fillColor(COLOR_MUTED).fontSize(8).font("Helvetica-Bold").text("NOT ASSESSED", 180, y + 5);
        doc.fillColor(COLOR_MUTED).fontSize(8).font("Helvetica").text(fb.insight, 48, y + 17, { width: 495 });
        y += 35;
      } else {
        doc.rect(40, y, 515, 60).fillAndStroke("#ffffff", COLOR_BORDER);
        doc.fillColor(COLOR_BRAND).fontSize(9).font("Helvetica-Bold").text(fb.roundName, 48, y + 5);
        doc.fillColor(COLOR_GREEN).fontSize(8).font("Helvetica-Bold").text(fb.statusLabel, 180, y + 5);

        doc.fillColor(COLOR_TEXT).fontSize(8).font("Helvetica").text(fb.insight, 48, y + 17, { width: 495 });
        
        let subY = y + 29;
        if (fb.strengths.length > 0) {
          doc.fillColor(COLOR_MUTED).fontSize(7.5).font("Helvetica-Bold").text(`Key Strength: ${fb.strengths[0]}`, 48, subY, { width: 495 });
          subY += 11;
        }
        if (fb.focusAreas.length > 0) {
          doc.fillColor(COLOR_MUTED).fontSize(7.5).font("Helvetica").text(`Focus Area: ${fb.focusAreas[0]}`, 48, subY, { width: 495 });
        }
        y += 66;
      }
    }

    // --- QUESTION-WISE DETAILED REPORT (ALL 53 QUESTIONS PRESERVED) ---
    y += 15;
    if (y > 700) {
      doc.addPage();
      y = 40;
    }

    doc.fillColor(COLOR_TEXT).fontSize(11).font("Helvetica-Bold").text(`DETAILED QUESTION REVIEW (${resultDoc.questionResults?.length || 0} QUESTIONS)`, 40, y);
    y += 15;

    const questionResults = Array.isArray(resultDoc.questionResults) ? resultDoc.questionResults : [];

    for (let i = 0; i < questionResults.length; i++) {
      const q = questionResults[i];

      if (y > 690) {
        doc.addPage();
        y = 40;
      }

      const qRound = q.roundType || "QUESTION";
      const qScore = Number(q.score ?? 0);
      const qMax = Number(q.maxScore ?? 0);
      const qStatus = q.status || "NOT_ATTEMPTED";

      let statusBadgeColor = COLOR_MUTED;
      if (qStatus === "CORRECT") statusBadgeColor = COLOR_GREEN;
      else if (qStatus === "PARTIALLY_CORRECT" || qStatus === "PARTIAL") statusBadgeColor = COLOR_AMBER;
      else if (qStatus === "INCORRECT") statusBadgeColor = COLOR_RED;

      doc.rect(40, y, 515, 18).fillAndStroke("#f1f5f9", COLOR_BORDER);
      doc.fillColor(COLOR_BRAND).fontSize(8).font("Helvetica-Bold").text(`QUESTION ${String(i + 1).padStart(2, "0")}`, 48, y + 5);
      doc.fillColor(COLOR_MUTED).fontSize(8).font("Helvetica").text(`Round: ${qRound}`, 140, y + 5);
      doc.fillColor(statusBadgeColor).fontSize(8).font("Helvetica-Bold").text(`Status: ${qStatus}`, 300, y + 5);
      doc.fillColor(COLOR_TEXT).fontSize(8).font("Helvetica-Bold").text(`Marks: ${qScore} / ${qMax}`, 450, y + 5, { width: 95, align: "right" });
      y += 18;

      const qText = q.question || "No question text";
      const ansText = q.candidateAnswer && q.candidateAnswer.trim() ? q.candidateAnswer.trim() : "NOT ATTEMPTED";
      const correctText = q.correctAnswer ? q.correctAnswer.trim() : "";
      const feedbackText = q.feedback ? q.feedback.trim() : "";

      doc.fontSize(8).font("Helvetica-Bold");
      const qHeight = doc.heightOfString(`Question: ${qText}`, { width: 495 });

      doc.fontSize(8).font("Helvetica");
      const ansHeight = doc.heightOfString(`Candidate Answer:\n${ansText}`, { width: 495 });

      let extraHeight = 0;
      if (correctText) extraHeight += doc.heightOfString(`Correct / Expected Answer:\n${correctText}`, { width: 495 }) + 4;
      if (feedbackText) extraHeight += doc.heightOfString(`Evaluation:\n${feedbackText}`, { width: 495 }) + 4;

      const cardBodyHeight = Math.max(35, qHeight + ansHeight + extraHeight + 14);

      if (y + cardBodyHeight > 760) {
        doc.addPage();
        y = 40;
      }

      doc.rect(40, y, 515, cardBodyHeight).fillAndStroke("#ffffff", COLOR_BORDER);

      let currentY = y + 6;
      doc.fillColor(COLOR_TEXT).fontSize(8).font("Helvetica-Bold").text(`Question: ${qText}`, 48, currentY, { width: 495 });
      currentY += qHeight + 4;

      doc.fillColor(ansText === "NOT ATTEMPTED" ? COLOR_MUTED : COLOR_TEXT).fontSize(8).font("Helvetica").text(`Candidate Answer: ${ansText}`, 48, currentY, { width: 495 });
      currentY += ansHeight + 3;

      if (correctText) {
        doc.fillColor(COLOR_GREEN).fontSize(8).font("Helvetica").text(`Correct / Expected Answer: ${correctText}`, 48, currentY, { width: 495 });
        currentY += doc.heightOfString(`Correct / Expected Answer: ${correctText}`, { width: 495 }) + 3;
      }

      if (feedbackText) {
        doc.fillColor(COLOR_MUTED).fontSize(8).font("Helvetica-Oblique").text(`Evaluation: ${feedbackText}`, 48, currentY, { width: 495 });
        currentY += doc.heightOfString(`Evaluation: ${feedbackText}`, { width: 495 }) + 3;
      }

      y += cardBodyHeight + 8;
    }

    doc.end();
  } catch (error) {
    console.error("[RealInterviewController] Download PDF Error:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message || "Failed to generate PDF report" });
    }
  }
};
