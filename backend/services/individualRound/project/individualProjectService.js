import IndividualProjectSession from "../../../models/IndividualProjectSession.js";
import IndividualProjectResult from "../../../models/IndividualProjectResult.js";
import User from "../../../models/User.js";
import { generateIndividualProjectQuestionsAI } from "./individualProjectAI.js";
import { evaluateIndividualProjectSession } from "./individualProjectEvaluator.js";
import { recordUserQuestionHistory } from "../../realInterview/questionHistoryService.js";

/**
 * Normalizes student profile details for project generation.
 */
async function fetchCandidateProfile(userId) {
  let profile = { skills: [], projects: [], resumeProjects: [], name: "Student", email: "" };
  if (!userId) return profile;

  try {
    const userDoc = await User.findById(userId).lean();
    if (userDoc) {
      profile.name = userDoc.name || "Student";
      profile.email = userDoc.email || "";
      profile.skills = Array.isArray(userDoc.skills) ? userDoc.skills : [];
      profile.projects = Array.isArray(userDoc.projects) ? userDoc.projects : [];
      profile.resumeProjects = profile.projects;
    }
  } catch (err) {
    console.warn("[IndividualProjectService] Error loading candidate profile:", err.message);
  }
  return profile;
}

/**
 * Creates a new Individual Project / Resume practice session with EXACTLY 10 questions.
 */
export async function createIndividualProjectSession({
  userId,
  sourceMode = "RESUME",
  interviewKeyId = "",
  difficulty = "Mixed",
}) {
  if (!userId) throw new Error("User ID is required to start a session");

  const candidateProfile = await fetchCandidateProfile(userId);
  const sessionId = `ind_proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  console.log(`[IndividualProjectService] Creating session ${sessionId} for user ${userId}`);

  const questions = await generateIndividualProjectQuestionsAI({
    candidateProfile,
    sourceMode,
    interviewKeyId,
    difficulty,
    sessionHistory: [],
    userId,
  });

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("Failed to generate 10 project questions for session.");
  }

  const newSession = await IndividualProjectSession.create({
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

  // Record question history persistently in MongoDB
  await recordUserQuestionHistory({
    userId,
    sessionId,
    round: "individual_project",
    questions,
  });

  return newSession;
}

/**
 * Fetches existing individual project session.
 */
export async function getIndividualProjectSession({ userId, sessionId }) {
  const session = await IndividualProjectSession.findOne({ userId, sessionId }).lean();
  if (!session) {
    throw new Error("Individual Project session not found");
  }
  return session;
}

/**
 * Saves candidate answer for a specific question.
 */
export async function saveIndividualProjectAnswer({
  userId,
  sessionId,
  questionId,
  candidateAnswer = "",
  inputMethod = "text",
}) {
  const session = await IndividualProjectSession.findOne({ userId, sessionId });
  if (!session) throw new Error("Session not found");
  if (session.status === "COMPLETED") throw new Error("Session is already submitted and evaluated.");

  const qIdStr = String(questionId);
  const existingIdx = session.answers.findIndex((a) => String(a.questionId) === qIdStr);

  if (existingIdx >= 0) {
    session.answers[existingIdx].candidateAnswer = candidateAnswer;
    session.answers[existingIdx].inputMethod = inputMethod;
    session.answers[existingIdx].submittedAt = new Date();
  } else {
    session.answers.push({
      questionId: qIdStr,
      candidateAnswer,
      inputMethod,
      submittedAt: new Date(),
    });
  }

  await session.save();
  return { success: true, savedAnswer: candidateAnswer };
}

/**
 * Submits an individual project session and calculates result out of 100.
 */
export async function submitIndividualProjectSession({ userId, sessionId }) {
  const session = await IndividualProjectSession.findOne({ userId, sessionId });
  if (!session) throw new Error("Session not found");

  if (session.status === "COMPLETED") {
    const existingResult = await IndividualProjectResult.findOne({ userId, sessionId });
    if (existingResult) return existingResult;
  }

  session.status = "CALCULATING";
  session.submittedAt = new Date();
  await session.save();

  try {
    const candidateProfile = await fetchCandidateProfile(userId);
    const evalData = await evaluateIndividualProjectSession({
      session,
      candidateProfile,
    });

    // Create or update result
    const resultDoc = await IndividualProjectResult.findOneAndUpdate(
      { userId, sessionId },
      {
        userId,
        sessionId,
        sourceMode: session.sourceMode,
        difficulty: session.difficulty,
        obtainedScore: evalData.obtainedScore,
        maxScore: 100,
        percentage: evalData.percentage,
        attemptedCount: evalData.attemptedCount,
        unattemptedCount: evalData.unattemptedCount,
        performanceStatus: evalData.performanceStatus,
        feedback: evalData.feedback,
        questionResults: evalData.questionResults,
      },
      { upsert: true, new: true }
    );

    session.status = "COMPLETED";
    await session.save();

    return resultDoc;
  } catch (err) {
    console.error(`[IndividualProjectService] Evaluation failed for ${sessionId}:`, err.message);
    session.status = "EVALUATION_FAILED";
    await session.save();
    throw new Error(`Evaluation failed: ${err.message}`);
  }
}

/**
 * Retries failed evaluation for an individual project session.
 */
export async function retryIndividualProjectEvaluation({ userId, sessionId }) {
  const session = await IndividualProjectSession.findOne({ userId, sessionId });
  if (!session) throw new Error("Session not found");

  session.status = "CALCULATING";
  await session.save();

  try {
    const candidateProfile = await fetchCandidateProfile(userId);
    const evalData = await evaluateIndividualProjectSession({
      session,
      candidateProfile,
    });

    const resultDoc = await IndividualProjectResult.findOneAndUpdate(
      { userId, sessionId },
      {
        userId,
        sessionId,
        sourceMode: session.sourceMode,
        difficulty: session.difficulty,
        obtainedScore: evalData.obtainedScore,
        maxScore: 100,
        percentage: evalData.percentage,
        attemptedCount: evalData.attemptedCount,
        unattemptedCount: evalData.unattemptedCount,
        performanceStatus: evalData.performanceStatus,
        feedback: evalData.feedback,
        questionResults: evalData.questionResults,
      },
      { upsert: true, new: true }
    );

    session.status = "COMPLETED";
    await session.save();

    return resultDoc;
  } catch (err) {
    console.error(`[IndividualProjectService] Retry evaluation failed for ${sessionId}:`, err.message);
    session.status = "EVALUATION_FAILED";
    await session.save();
    throw new Error(`Retry evaluation failed: ${err.message}`);
  }
}

/**
 * Fetches result for an individual project session.
 */
export async function getIndividualProjectResult({ userId, sessionId }) {
  const resultDoc = await IndividualProjectResult.findOne({ userId, sessionId }).lean();
  if (!resultDoc) {
    const sessionDoc = await IndividualProjectSession.findOne({ userId, sessionId }).lean();
    if (sessionDoc && sessionDoc.status === "EVALUATION_FAILED") {
      return { status: "EVALUATION_FAILED", sessionId };
    }
    if (sessionDoc && sessionDoc.status === "CALCULATING") {
      return { status: "CALCULATING", sessionId };
    }
    throw new Error("Result not found for this session");
  }
  return resultDoc;
}
