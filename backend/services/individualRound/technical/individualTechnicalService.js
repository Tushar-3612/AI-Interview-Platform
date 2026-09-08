import IndividualTechnicalSession from "../../../models/IndividualTechnicalSession.js";
import IndividualTechnicalResult from "../../../models/IndividualTechnicalResult.js";
import { generateIndividualTechnicalQuestionsAI } from "./individualTechnicalAI.js";
import { evaluateIndividualTechnicalSession } from "./individualTechnicalEvaluator.js";
import { getOrBuildCandidateResumeContext } from "../../../utils/resumeContextBuilder.js";
import { recordUserQuestionHistory } from "../../realInterview/questionHistoryService.js";

/**
 * Starts a new Individual Technical session or returns active existing one.
 */
export async function startIndividualTechnicalSession({
  userId,
  sourceMode = "RESUME",
  interviewKeyId = "",
  difficulty = "Mixed",
  candidateProfile = {},
}) {
  if (!userId) throw new Error("userId is required to start Individual Technical Practice");

  // Check if an active in-progress session exists
  const existingSession = await IndividualTechnicalSession.findOne({
    userId,
    sourceMode,
    interviewKeyId: interviewKeyId || "",
    difficulty,
    status: { $in: ["IN_PROGRESS", "PREPARING"] },
  }).sort({ createdAt: -1 });

  if (existingSession && existingSession.questions.length === 20) {
    console.log(`[IndividualTechnicalService] Resuming active session ${existingSession.sessionId}`);
    return existingSession;
  }

  const sessionId = `ind_tech_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const resumeContext = await getOrBuildCandidateResumeContext(userId, candidateProfile);

  // Generate 20 questions
  const questions = await generateIndividualTechnicalQuestionsAI({
    candidateProfile: resumeContext,
    sourceMode,
    interviewKeyId,
    difficulty,
    userId,
  });

  const session = new IndividualTechnicalSession({
    userId,
    sessionId,
    sourceMode,
    interviewKeyId: interviewKeyId || "",
    difficulty,
    questions,
    answers: [],
    status: "IN_PROGRESS",
    progress: { currentQuestionIndex: 0 },
  });

  await session.save();

  if (userId && sessionId) {
    await recordUserQuestionHistory({
      userId,
      sessionId,
      round: "individual_technical",
      questions,
    });
  }

  return session;
}

/**
 * Gets session by ID with security check.
 */
export async function getIndividualTechnicalSession({ sessionId, userId }) {
  const session = await IndividualTechnicalSession.findOne({ sessionId, userId });
  if (!session) {
    throw new Error("Individual Technical Session not found or unauthorized access.");
  }
  return session;
}

/**
 * Saves candidate answer for a question while preserving original text.
 */
export async function saveIndividualTechnicalAnswer({
  sessionId,
  questionId,
  candidateAnswer,
  inputMethod = "text",
  userId,
}) {
  const session = await IndividualTechnicalSession.findOne({ sessionId, userId });
  if (!session) {
    throw new Error("Session not found or unauthorized access.");
  }

  if (["SUBMITTED", "CALCULATING", "COMPLETED"].includes(session.status)) {
    throw new Error("Cannot modify answers for a submitted session.");
  }

  const ansIndex = session.answers.findIndex((a) => a.questionId === String(questionId));

  if (ansIndex >= 0) {
    session.answers[ansIndex].candidateAnswer = candidateAnswer || "";
    session.answers[ansIndex].inputMethod = inputMethod;
    session.answers[ansIndex].submittedAt = new Date();
  } else {
    session.answers.push({
      questionId: String(questionId),
      candidateAnswer: candidateAnswer || "",
      inputMethod,
      submittedAt: new Date(),
    });
  }

  await session.save();
  return { success: true, savedAnswer: candidateAnswer };
}

/**
 * Submits session and runs batch evaluation.
 */
export async function submitAndEvaluateIndividualTechnicalSession({ sessionId, userId }) {
  // Atomically claim session to prevent race conditions
  const claimed = await IndividualTechnicalSession.findOneAndUpdate(
    {
      sessionId,
      userId,
      status: { $in: ["IN_PROGRESS", "EVALUATION_FAILED"] },
    },
    { $set: { status: "CALCULATING", submittedAt: new Date() } },
    { new: true }
  );

  if (!claimed) {
    const existing = await IndividualTechnicalSession.findOne({ sessionId, userId });
    if (!existing) throw new Error("Session not found");
    if (existing.status === "COMPLETED") {
      const existingResult = await IndividualTechnicalResult.findOne({ sessionId, userId });
      return { completed: true, result: existingResult };
    }
    throw new Error(`Cannot submit session in status '${existing?.status}'`);
  }

  try {
    const evaluationData = await evaluateIndividualTechnicalSession({
      session: claimed,
      questions: claimed.questions,
      answers: claimed.answers,
    });

    // Save or update result document (idempotent)
    const resultDoc = await IndividualTechnicalResult.findOneAndUpdate(
      { sessionId, userId },
      {
        userId,
        sessionId,
        sourceMode: claimed.sourceMode,
        difficulty: claimed.difficulty,
        obtainedScore: evaluationData.obtainedScore,
        maxScore: 100,
        percentage: evaluationData.percentage,
        attemptedCount: evaluationData.attemptedCount,
        unattemptedCount: evaluationData.unattemptedCount,
        performanceStatus: evaluationData.performanceStatus,
        feedback: evaluationData.feedback,
        questionResults: evaluationData.questionResults,
      },
      { upsert: true, new: true }
    );

    claimed.status = "COMPLETED";
    await claimed.save();

    return { completed: true, result: resultDoc };
  } catch (err) {
    console.error(`[IndividualTechnicalService] Evaluation failed for ${sessionId}:`, err.message);

    claimed.status = "EVALUATION_FAILED";
    await claimed.save();

    throw new Error(`Technical evaluation failed: ${err.message}`);
  }
}

/**
 * Retries evaluation for a session whose status was EVALUATION_FAILED.
 */
export async function retryIndividualTechnicalEvaluation({ sessionId, userId }) {
  const session = await IndividualTechnicalSession.findOne({ sessionId, userId });
  if (!session) throw new Error("Session not found");

  session.status = "IN_PROGRESS";
  await session.save();

  return await submitAndEvaluateIndividualTechnicalSession({ sessionId, userId });
}

/**
 * Fetches persisted result.
 */
export async function getIndividualTechnicalResult({ sessionId, userId }) {
  const result = await IndividualTechnicalResult.findOne({ sessionId, userId });
  if (!result) {
    const session = await IndividualTechnicalSession.findOne({ sessionId, userId });
    if (session && session.status === "EVALUATION_FAILED") {
      return { status: "EVALUATION_FAILED", message: "Technical evaluation failed during submission." };
    }
    throw new Error("Individual Technical Result not found or unauthorized access.");
  }
  return result;
}
