import {
  generateProjectAI,
  evaluateProjectInterviewAI,
} from "../realInterviewAI/projectAI.js";
import RealInterviewProjectQuestion from "../../models/RealInterviewProjectQuestion.js";
import RealInterviewProjectSession from "../../models/RealInterviewProjectSession.js";
import Interview from "../../models/Interview.js";
import { withInFlightLock } from "./inFlightLock.js";
import {
  getUserQuestionHistorySet,
  recordUserQuestionHistory,
  filterUniqueQuestions,
  normalizeQuestionText,
} from "./questionHistoryService.js";
import { isQuestionGroundedInResume, getOrBuildCandidateResumeContext } from "../../utils/resumeContextBuilder.js";

/**
 * Generates or retrieves existing 10 Project/Resume questions for a Real Interview session (AI CALL #1).
 * Enforces IDEMPOTENCY: Does NOT re-generate questions if aiGenerationCalls >= 1 or 10 questions exist.
 */
export async function generateAndProcessProjectQuestions({
  userId = null,
  sessionId = null,
  candidateProfile = {},
} = {}) {
  if (!sessionId) {
    throw new Error("sessionId is required for project question generation");
  }

  const lockKey = `project:${sessionId}`;
  return withInFlightLock(lockKey, async () => {
    let session = await RealInterviewProjectSession.findOne({ sessionId });

    const existingQuestions = await RealInterviewProjectQuestion.find({ sessionId }).sort({
      orderIndex: 1,
    });

  if (
    (session && (session.aiGenerationCalls >= 1 || session.generationStatus === "GENERATED")) ||
    existingQuestions.length >= 10
  ) {
    console.log(
      `[ProjectService] Session ${sessionId} already generated (${existingQuestions.length} questions, aiGenerationCalls: ${session?.aiGenerationCalls || 1}). Reusing existing questions without AI call.`
    );

    if (!session) {
      session = await RealInterviewProjectSession.create({
        sessionId,
        userId,
        currentQuestionIndex: 0,
        strongAnswerCount: 0,
        hardUnlocked: false,
        questionsAnswered: 0,
        answers: [],
        status: "in_progress",
        generationStatus: "GENERATED",
        aiGenerationCalls: 1,
      });
    }

    const studentQuestions = existingQuestions.slice(0, 10).map((q) => ({
      id: q._id.toString(),
      question: q.question,
      difficulty: q.difficulty,
      maxMarks: q.maxMarks || (q.difficulty === "easy" ? 5 : q.difficulty === "hard" ? 20 : 10),
      topic: q.topic,
      category: q.category,
      projectName: q.projectName,
      source: q.source,
    }));

    return {
      success: true,
      message: "Reused existing 10 project questions",
      count: studentQuestions.length,
      questions: studentQuestions,
      reused: true,
      aiGenerationCalls: session.aiGenerationCalls || 1,
    };
  }

  // AI CALL #1: Generate 10 deep project questions
  const effectiveProfile = await getOrBuildCandidateResumeContext(userId, candidateProfile);
  const userHistorySet = await getUserQuestionHistorySet(userId);

  const requestId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const modelName = process.env.REAL_INTERVIEW_PROJECT_MODEL || "openai/gpt-oss-120b";
  const hasKey = Boolean(process.env.REAL_INTERVIEW_PROJECT_API_KEY?.trim());

  console.log(`\n[AI-REQUEST-START]\nround=project\nprovider=groq\nmodel=${modelName}\nkeyPresent=${hasKey}\nrequestId=${requestId}`);
  console.log(`\n[REAL-INTERVIEW][PROJECT-CONTEXT]\nprojects=${JSON.stringify((effectiveProfile.projects || []).map(p => ({ name: p.name, technologies: p.technologies })))}\n`);

  let aiResult;
  try {
    aiResult = await generateProjectAI(effectiveProfile);
  } catch (genErr) {
    console.error(`\n[AI-REQUEST-FAILED]\nround=project\nprovider=groq\nrequestId=${requestId}\nerror=${genErr.message}`);
    throw new Error(`Project AI generation failed: ${genErr.message}`);
  }

  const rawAiQuestions = aiResult?.questions || [];
  let rawQuestions = filterUniqueQuestions(rawAiQuestions, userHistorySet);
  if (rawQuestions.length < 10) {
    rawQuestions = rawAiQuestions.slice(0, 10);
  }

  if (rawQuestions.length < 10) {
    console.error(`\n[AI-REQUEST-FAILED]\nround=project\nprovider=groq\nrequestId=${requestId}\nerror=Insufficient AI questions returned (${rawQuestions.length}/10)`);
    throw new Error(`Insufficient Project AI questions generated (${rawQuestions.length}/10)`);
  }

  console.log(`\n[AI-REQUEST-SUCCESS]\nround=project\nprovider=groq\nrequestId=${requestId}\nquestionsReturned=${rawQuestions.length}`);
  console.log(`\n[QUESTION-SOURCE]\nround=project\nsource=AI_PROVIDER\ncount=${rawQuestions.length}\n`);

  const selectedQuestions = rawQuestions.slice(0, 10);

  // Enforce EXACTLY 4 Easy (5m), 4 Medium (10m), 2 Hard (20m) -> Total = 100 Marks
  const validatedDocs = selectedQuestions.map((q, idx) => {
    const questionText = String(q.question || "").trim();
    if (!questionText) {
      throw new Error(`Project Question #${idx + 1} has empty question text`);
    }

    const expectedKnowledge = String(
      q.expectedKnowledge ||
        q.expected_knowledge ||
        q.expectedAnswer ||
        "Demonstrate clear project workflow, architecture reasoning, and technical implementation details."
    ).trim();

    // Assign difficulty strictly based on index slot to guarantee 100 max marks (4 Easy, 4 Medium, 2 Hard)
    const slotDiff = idx < 4 ? "easy" : idx < 8 ? "medium" : "hard";
    const maxMarks = slotDiff === "easy" ? 5 : slotDiff === "hard" ? 20 : 10;

    return {
      sessionId,
      userId,
      orderIndex: idx,
      question: questionText,
      expectedKnowledge,
      difficulty: slotDiff,
      maxMarks,
      topic: String(q.topic || "Project Engineering").trim(),
      category: "resume_project",
      projectName: String(q.projectName || "Software Project").trim(),
      source: "AI_PROVIDER",
    };
  });

  const savedQuestions = await RealInterviewProjectQuestion.insertMany(validatedDocs);
  if (userId && sessionId) {
    await recordUserQuestionHistory({ userId, sessionId, round: "resume_project", questions: savedQuestions });
  }

  if (!session) {
    session = await RealInterviewProjectSession.create({
      sessionId,
      userId,
      currentQuestionIndex: 0,
      strongAnswerCount: 0,
      hardUnlocked: false,
      questionsAnswered: 0,
      answers: [],
      status: "in_progress",
      generationStatus: "GENERATED",
      aiGenerationCalls: 1,
    });
  } else {
    session.generationStatus = "GENERATED";
    session.aiGenerationCalls = 1;
    await session.save();
  }

  const studentQuestions = savedQuestions.map((q) => ({
    id: q._id.toString(),
    question: q.question,
    difficulty: q.difficulty,
    maxMarks: q.maxMarks,
    topic: q.topic,
    category: q.category,
    projectName: q.projectName,
    source: q.source,
  }));

    return {
      success: true,
      message: "10 resume-project questions generated successfully",
      count: studentQuestions.length,
      questions: studentQuestions,
      reused: false,
      aiGenerationCalls: 1,
    };
  });
}

/**
 * Retrieves candidate's next adaptive Project question.
 * ZERO AI CALLS.
 */
export async function getNextProjectQuestion({ sessionId }) {
  if (!sessionId) {
    throw new Error("sessionId is required");
  }

  const session = await RealInterviewProjectSession.findOne({ sessionId });
  if (!session) {
    throw new Error("Project session not found for this sessionId");
  }

  if (session.status === "completed" || session.questionsAnswered >= 10) {
    return {
      success: true,
      completed: true,
      message: "Project round completed",
    };
  }

  const allQuestions = await RealInterviewProjectQuestion.find({ sessionId }).sort({
    orderIndex: 1,
  });

  if (allQuestions.length === 0) {
    throw new Error("No project questions found for this session. Generate questions first.");
  }

  const answeredQuestionIds = (session.answers || []).map((a) => a.questionId.toString());
  const unanswered = allQuestions.filter((q) => !answeredQuestionIds.includes(q._id.toString()));

  if (unanswered.length === 0) {
    session.status = "completed";
    await session.save();
    return {
      success: true,
      completed: true,
      message: "All project questions answered",
    };
  }

  let candidatePool = unanswered;
  if (!session.hardUnlocked) {
    const easyMediumPool = unanswered.filter((q) => q.difficulty !== "hard");
    if (easyMediumPool.length > 0) {
      candidatePool = easyMediumPool;
    }
  }

  const selectedQuestion = candidatePool[0];

  return {
    success: true,
    completed: false,
    question: {
      id: selectedQuestion._id.toString(),
      question: selectedQuestion.question,
      difficulty: selectedQuestion.difficulty,
      maxMarks: selectedQuestion.maxMarks || (selectedQuestion.difficulty === "easy" ? 5 : selectedQuestion.difficulty === "hard" ? 20 : 10),
      topic: selectedQuestion.topic,
      category: selectedQuestion.category,
      projectName: selectedQuestion.projectName,
      source: selectedQuestion.source,
      questionNumber: session.questionsAnswered + 1,
      totalQuestions: 10,
    },
    adaptiveState: {
      strongAnswerCount: session.strongAnswerCount,
      hardUnlocked: session.hardUnlocked,
      questionsAnswered: session.questionsAnswered,
      totalQuestions: 10,
    },
  };
}

/**
 * Submits candidate's project answer.
 * STRICTLY ZERO AI CALLS.
 */
export async function submitProjectAnswer({
  sessionId,
  questionId,
  candidateAnswer,
  userId = null,
}) {
  if (!sessionId || !questionId) {
    throw new Error("sessionId and questionId are required");
  }

  const questionDoc = await RealInterviewProjectQuestion.findById(questionId);
  if (!questionDoc) {
    throw new Error("Question not found");
  }

  const session = await RealInterviewProjectSession.findOne({ sessionId });
  if (!session) {
    throw new Error("Project session not found");
  }

  const existingAnswerIndex = session.answers.findIndex(
    (a) => a.questionId.toString() === questionId
  );
  if (existingAnswerIndex !== -1) {
    return {
      success: true,
      message: "Answer already recorded previously",
      questionId,
      adaptiveState: {
        strongAnswerCount: session.strongAnswerCount,
        hardUnlocked: session.hardUnlocked,
        questionsAnswered: session.questionsAnswered,
        totalQuestions: 10,
        completed: session.questionsAnswered >= 10 || session.status === "completed",
      },
    };
  }

  const cleanAnswer = String(candidateAnswer || "").trim();

  const isSubstantialAnswer = cleanAnswer.length >= 15;
  if (isSubstantialAnswer) {
    session.strongAnswerCount += 1;
  }

  if (session.strongAnswerCount >= 2) {
    session.hardUnlocked = true;
  }

  session.questionsAnswered += 1;
  session.currentQuestionIndex = session.questionsAnswered;

  if (session.questionsAnswered >= 10) {
    session.status = "completed";
  }

  const maxScore = questionDoc.maxMarks || (questionDoc.difficulty === "easy" ? 5 : questionDoc.difficulty === "hard" ? 20 : 10);

  const answerRecord = {
    questionId: questionDoc._id,
    question: questionDoc.question,
    difficulty: questionDoc.difficulty,
    maxScore,
    topic: questionDoc.topic,
    category: questionDoc.category,
    projectName: questionDoc.projectName,
    candidateAnswer: cleanAnswer,
    submittedAt: new Date(),
  };

  session.answers.push(answerRecord);
  await session.save();

  return {
    success: true,
    message: "Candidate answer stored successfully (No AI call executed)",
    questionId,
    adaptiveState: {
      strongAnswerCount: session.strongAnswerCount,
      hardUnlocked: session.hardUnlocked,
      questionsAnswered: session.questionsAnswered,
      totalQuestions: 10,
      completed: session.questionsAnswered >= 10 || session.status === "completed",
    },
  };
}

/**
 * Evaluates ALL 10 candidate project answers in ONE SINGLE AI API Request after completion (AI CALL #2).
 * Includes safe deterministic application-level fallback if AI request fails (e.g. rate limit/network error).
 */
export async function evaluateProjectInterviewSession({ sessionId, candidateProfile = {} }) {
  if (!sessionId) {
    throw new Error("sessionId is required for evaluation");
  }

  const session = await RealInterviewProjectSession.findOne({ sessionId });
  if (!session) {
    throw new Error("Project session not found for evaluation");
  }

  // Idempotency Check
  if (
    session.aiEvaluationCalls >= 1 ||
    session.evaluationStatus === "COMPLETED" ||
    session.evaluationCompleted
  ) {
    console.log(
      `[ProjectService] Session ${sessionId} already evaluated (aiEvaluationCalls: ${session.aiEvaluationCalls}). Reusing stored evaluation without AI call.`
    );
    return {
      success: true,
      message: "Reused existing project evaluation result",
      sessionId,
      totalScore: session.totalScore || session.overallScore || 0,
      maxScore: session.maxScore || 100,
      percentage: session.percentage || 0,
      overallRating: session.overallRating || "N/A",
      strengths: session.strengths || [],
      weaknesses: session.weaknesses || [],
      finalFeedback: session.finalFeedback || "",
      evaluations: session.answers.map((a) => ({
        questionId: a.questionId.toString(),
        question: a.question,
        candidateAnswer: a.candidateAnswer,
        score: a.score || 0,
        maxScore: a.maxScore || (a.difficulty === "easy" ? 5 : a.difficulty === "hard" ? 20 : 10),
        difficulty: a.difficulty,
        rating: a.rating || "weak",
        correctPoints: a.correctPoints || [],
        missingPoints: a.missingPoints || [],
        incorrectPoints: a.incorrectPoints || [],
        grammarIssues: a.grammarIssues || [],
        feedback: a.feedback || "",
        betterAnswer: a.betterAnswer || "",
      })),
      reused: true,
      aiEvaluationCalls: session.aiEvaluationCalls,
    };
  }

  const allQuestions = await RealInterviewProjectQuestion.find({ sessionId }).sort({
    orderIndex: 1,
  });

  if (allQuestions.length === 0) {
    throw new Error("No project questions found for evaluation in this session");
  }

  const mainInterviewDoc = await Interview.findById(sessionId).lean().catch(() => null);
  const mainInterviewAnswers = mainInterviewDoc?.answers || [];

  const questionsToEvaluate = allQuestions.map((q) => {
    const qIdStr = q._id.toString();
    const matchedAnswer = (session.answers || []).find(
      (a) => a.questionId.toString() === qIdStr
    );
    const mainAnsMatch = mainInterviewAnswers.find(
      (a) => String(a.questionId) === qIdStr
    );

    const rawAns = (matchedAnswer?.candidateAnswer || mainAnsMatch?.answer || mainAnsMatch?.transcript || "").trim();
    const finalAnsText = rawAns.length > 0 ? rawAns : "(No answer submitted)";
    const maxScore = q.maxMarks || (q.difficulty === "easy" ? 5 : q.difficulty === "hard" ? 20 : 10);

    return {
      questionId: qIdStr,
      question: q.question,
      difficulty: q.difficulty,
      maxScore,
      topic: q.topic,
      category: q.category,
      projectName: q.projectName,
      expectedKnowledge: q.expectedKnowledge || `Architectural and technical implementation details for ${q.projectName || q.topic || "project"}.`,
      candidateAnswer: finalAnsText,
    };
  });

  session.evaluationStatus = "EVALUATING";
  session.evaluationStartedAt = new Date();
  await session.save();

  console.log(`[ProjectService] Making AI CALL #2 (complete evaluation) for session ${sessionId}...`);
  let evalResult;
  let isFallback = false;

  try {
    evalResult = await evaluateProjectInterviewAI({
      candidateProfile,
      questions: questionsToEvaluate,
    });
  } catch (evalErr) {
    console.warn(`[ProjectService] AI evaluation call failed (${evalErr.message}). Applying deterministic application-level fallback evaluation.`);
    isFallback = true;
    evalResult = generateDeterministicProjectFallback(questionsToEvaluate, evalErr.message);
  }

  const evaluationsList = Array.isArray(evalResult.evaluations) ? evalResult.evaluations : [];
  let calculatedTotalScore = 0;

  for (const q of allQuestions) {
    const qIdStr = q._id.toString();
    const itemEval = evaluationsList.find((e) => String(e.questionId) === qIdStr) || {};
    const mainAnsMatch = mainInterviewAnswers.find((a) => String(a.questionId) === qIdStr);
    const maxScore = q.maxMarks || (q.difficulty === "easy" ? 5 : q.difficulty === "hard" ? 20 : 10);

    const rawScore = Number(itemEval.score);
    const score = isNaN(rawScore) ? 0 : Math.max(0, Math.min(maxScore, Math.round(rawScore)));
    calculatedTotalScore += score;

    const ratingCandidate = String(itemEval.rating || "").trim();
    const rating = ratingCandidate || (
      score >= maxScore * 0.8 ? "Strong" : score >= maxScore * 0.5 ? "Acceptable" : "Weak"
    );

    const existingAnsIndex = session.answers.findIndex(
      (a) => a.questionId.toString() === qIdStr
    );

    const answerData = {
      questionId: q._id,
      question: q.question,
      difficulty: q.difficulty,
      maxScore,
      topic: q.topic,
      category: q.category,
      projectName: q.projectName,
      candidateAnswer: (existingAnsIndex !== -1 && session.answers[existingAnsIndex].candidateAnswer && session.answers[existingAnsIndex].candidateAnswer !== "(No answer submitted)")
        ? session.answers[existingAnsIndex].candidateAnswer
        : (mainAnsMatch?.answer || mainAnsMatch?.transcript || "(No answer submitted)"),
      score,
      rating,
      evaluationSource: itemEval.evaluationSource || (isFallback ? "deterministic_fallback" : "ai_evaluated"),
      correctPoints: Array.isArray(itemEval.correctPoints) ? itemEval.correctPoints : [],
      missingPoints: Array.isArray(itemEval.missingPoints) ? itemEval.missingPoints : [],
      incorrectPoints: Array.isArray(itemEval.incorrectPoints) ? itemEval.incorrectPoints : [],
      grammarIssues: Array.isArray(itemEval.grammarIssues) ? itemEval.grammarIssues : [],
      feedback: String(itemEval.feedback || "Evaluation complete.").trim(),
      betterAnswer: String(
        itemEval.betterAnswer || q.expectedKnowledge || "Interview-ready response based on candidate answer."
      ).trim(),
      submittedAt: existingAnsIndex !== -1 ? session.answers[existingAnsIndex].submittedAt : new Date(),
    };

    if (existingAnsIndex !== -1) {
      session.answers[existingAnsIndex] = answerData;
    } else {
      session.answers.push(answerData);
    }
  }

  const maxScoreTotal = 100;
  const percentage = Math.round((calculatedTotalScore / maxScoreTotal) * 100);

  let overallRating = "Weak";
  if (percentage >= 90) overallRating = "Excellent";
  else if (percentage >= 80) overallRating = "Very Strong";
  else if (percentage >= 70) overallRating = "Strong";
  else if (percentage >= 60) overallRating = "Good";
  else if (percentage >= 50) overallRating = "Average";
  else if (percentage >= 40) overallRating = "Needs Improvement";

  session.totalScore = calculatedTotalScore;
  session.overallScore = calculatedTotalScore;
  session.maxScore = maxScoreTotal;
  session.percentage = percentage;
  session.overallRating = evalResult.overallRating || overallRating;
  session.strengths = Array.isArray(evalResult.strengths) ? evalResult.strengths : ["Candidate project answer recorded"];
  session.weaknesses = Array.isArray(evalResult.weaknesses) ? evalResult.weaknesses : ["Automated AI evaluation was unavailable"];
  session.finalFeedback = String(evalResult.finalFeedback || "Project interview evaluated using deterministic application fallback.").trim();

  session.evaluationStatus = "COMPLETED";
  session.evaluationCompleted = true;
  session.aiEvaluationCalls = 1;
  session.evaluationCompletedAt = new Date();
  session.status = "completed";

  await session.save();

  console.log(`[ProjectService] Evaluation complete for session ${sessionId}. Total score: ${calculatedTotalScore}/100 (${percentage}%). Fallback used: ${isFallback}`);

  return {
    success: true,
    message: isFallback
      ? "Project interview evaluated using deterministic application fallback (0 extra AI calls)"
      : "Project interview evaluated successfully in 1 AI call",
    sessionId,
    totalScore: session.totalScore,
    maxScore: session.maxScore,
    percentage: session.percentage,
    overallRating: session.overallRating,
    strengths: session.strengths,
    weaknesses: session.weaknesses,
    finalFeedback: session.finalFeedback,
    evaluations: session.answers.map((a) => ({
      questionId: a.questionId.toString(),
      question: a.question,
      candidateAnswer: a.candidateAnswer,
      score: a.score,
      maxScore: a.maxScore,
      difficulty: a.difficulty,
      rating: a.rating,
      evaluationSource: a.evaluationSource || (isFallback ? "deterministic_fallback" : "ai_evaluated"),
      correctPoints: a.correctPoints,
      missingPoints: a.missingPoints,
      incorrectPoints: a.incorrectPoints,
      grammarIssues: a.grammarIssues,
      feedback: a.feedback,
      betterAnswer: a.betterAnswer,
    })),
    reused: false,
    aiEvaluationCalls: 1,
    isFallback,
  };
}

/**
 * Deterministic application-level fallback evaluation generator.
 * Does NOT fabricate semantic correctness or positive marks if AI is unavailable.
 */
function generateDeterministicProjectFallback(questionsToEvaluate, reason = "AI provider unavailable") {
  console.log(`\n[REAL-INTERVIEW][EVALUATION-FALLBACK]\nround=project\nreason=${reason}\nevaluationSource=deterministic_fallback\n`);

  const evaluations = questionsToEvaluate.map((q) => {
    const ans = String(q.candidateAnswer || "").trim();
    const maxScore = Number(q.maxScore || (q.difficulty === "easy" ? 5 : q.difficulty === "hard" ? 20 : 10));
    const isUnanswered = !ans || ans === "(No answer submitted)" || ans.toLowerCase() === "not answered";

    return {
      questionId: q.questionId,
      score: 0,
      maxScore,
      difficulty: q.difficulty,
      rating: isUnanswered ? "Not Attempted" : "Unverified (AI Unavailable)",
      evaluationSource: "deterministic_fallback",
      correctPoints: [],
      missingPoints: isUnanswered ? ["Question was not attempted"] : ["Automated AI evaluation was unavailable for this response"],
      incorrectPoints: [],
      grammarIssues: [],
      feedback: isUnanswered
        ? "Question was not attempted."
        : "Automated detailed evaluation was unavailable for this response. Answer preserved for review.",
      betterAnswer: q.expectedKnowledge || "Detailed project architectural explanation grounded in resume evidence.",
    };
  });

  return {
    evaluations,
    totalScore: 0,
    maxScore: 100,
    percentage: 0,
    overallRating: "Unverified",
    strengths: ["Candidate project answers preserved in session"],
    weaknesses: ["Automated AI evaluation service was unavailable"],
    finalFeedback: "Project interview completed with deterministic fallback because AI evaluation was unavailable.",
  };
}
