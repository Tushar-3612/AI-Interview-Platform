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
import { preprocessAnswerBatch } from "../realInterviewAI/answerPreprocessor.js";
import { resolveCandidateAnswer } from "./answerResolver.js";
import { classifyInterviewAIError } from "./errorClassifier.js";

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
  const userHistorySet = await getUserQuestionHistorySet(userId, effectiveProfile.resumeHash, "resume_project");

  const requestId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const modelName = process.env.REAL_INTERVIEW_PROJECT_MODEL || "openai/gpt-oss-120b";
  const hasKey = Boolean(process.env.REAL_INTERVIEW_PROJECT_API_KEY?.trim());

  console.log(`\n[AI-REQUEST-START]\nround=project\nprovider=groq\nmodel=${modelName}\nkeyPresent=${hasKey}\nrequestId=${requestId}`);

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
      generationStatus: "GENERATING",
      aiGenerationCalls: 0,
    });
  } else {
    session.generationStatus = "GENERATING";
    await session.save();
  }

  let aiResult = null;
  try {
    aiResult = await generateProjectAI(effectiveProfile, userHistorySet);
  } catch (genErr) {
    console.error(`\n[AI-REQUEST-FAILED]\nround=project\nprovider=groq\nrequestId=${requestId}\nerror=${genErr.message}`);
    const classified = classifyInterviewAIError(genErr);
    session.generationStatus = existingQuestions.length > 0 ? "PARTIAL" : "FAILED";
    session.aiGenerationCalls += 1;
    await session.save();

    return {
      success: false,
      recoverable: classified.recoverable,
      generatedCount: existingQuestions.length,
      totalRequired: 10,
      nextQuestionNumber: existingQuestions.length + 1,
      errorCode: classified.code,
      message: classified.message,
      questions: existingQuestions,
    };
  }

  const rawAiQuestions = aiResult?.questions || [];
  let rawQuestions = filterUniqueQuestions(rawAiQuestions, userHistorySet);

  if (rawQuestions.length < 10) {
    console.error(`\n[AI-REQUEST-FAILED]\nround=project\nprovider=groq\nrequestId=${requestId}\nerror=Insufficient unique AI questions returned (${rawQuestions.length}/10)`);
    const classified = classifyInterviewAIError("Insufficient unique Project AI questions generated");
    session.generationStatus = existingQuestions.length > 0 ? "PARTIAL" : "FAILED";
    session.aiGenerationCalls += 1;
    await session.save();

    return {
      success: false,
      recoverable: true,
      generatedCount: existingQuestions.length,
      totalRequired: 10,
      nextQuestionNumber: existingQuestions.length + 1,
      errorCode: classified.code,
      message: classified.message,
      questions: existingQuestions,
    };
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
    await recordUserQuestionHistory({ userId, sessionId, resumeHash: effectiveProfile.resumeHash, round: "resume_project", questions: savedQuestions });
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
    session.evaluationCompleted ||
    session.evaluationStatus === "COMPLETED"
  ) {
    console.log(
      `[ProjectService] Session ${sessionId} already evaluated cleanly (aiEvaluationCalls: ${session.aiEvaluationCalls}). Reusing stored evaluation.`
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

  // Build base questions with answer tracing & resolution
  const baseQuestions = allQuestions.map((q, idx) => {
    const qIdStr = q._id.toString();
    const resolved = resolveCandidateAnswer({
      roundType: "RESUME_PROJECT",
      questionId: qIdStr,
      questionIndex: idx + 1,
      questionText: q.question,
      roundSessionAnswers: session.answers || [],
      mainInterviewAnswers,
    });

    const maxScore = q.maxMarks || (q.difficulty === "easy" ? 5 : q.difficulty === "hard" ? 20 : 10);

    // Sync answer back to project session if found in main interview doc but missing in session
    if (resolved.answerPresent) {
      const existingAnsIndex = (session.answers || []).findIndex(
        (a) => a.questionId.toString() === qIdStr
      );
      if (existingAnsIndex === -1) {
        session.answers.push({
          questionId: q._id,
          question: q.question,
          difficulty: q.difficulty,
          maxScore,
          topic: q.topic,
          category: q.category,
          projectName: q.projectName,
          candidateAnswer: resolved.answer,
          submittedAt: new Date(),
        });
      } else if (!session.answers[existingAnsIndex].candidateAnswer || session.answers[existingAnsIndex].candidateAnswer === "(No answer submitted)") {
        session.answers[existingAnsIndex].candidateAnswer = resolved.answer;
      }
    }

    return {
      questionId: qIdStr,
      question: q.question,
      difficulty: q.difficulty,
      maxScore,
      topic: q.topic,
      category: q.category,
      projectName: q.projectName,
      expectedKnowledge: q.expectedKnowledge || `Architectural and technical implementation details for ${q.projectName || q.topic || "project"}.`,
      candidateAnswer: resolved.answer,
      answerPresent: resolved.answerPresent,
    };
  });

  // Filter ONLY attempted questions
  const attemptedQuestions = baseQuestions.filter((q) => q.answerPresent);

  // If ZERO questions were attempted, skip AI call completely
  if (attemptedQuestions.length === 0) {
    console.log(`[ProjectService] 0 candidate answers submitted for project session ${sessionId}. Skipping AI evaluation call.`);

    for (const q of allQuestions) {
      const qIdStr = q._id.toString();
      const maxScore = q.maxMarks || (q.difficulty === "easy" ? 5 : q.difficulty === "hard" ? 20 : 10);
      const existingAnsIndex = session.answers.findIndex((a) => a.questionId.toString() === qIdStr);

      const answerData = {
        questionId: q._id,
        question: q.question,
        difficulty: q.difficulty,
        maxScore,
        topic: q.topic,
        category: q.category,
        projectName: q.projectName,
        candidateAnswer: "(No answer submitted)",
        score: 0,
        rating: "Weak",
        evaluationSource: "not_attempted",
        correctPoints: [],
        missingPoints: ["Question was not attempted"],
        incorrectPoints: [],
        grammarIssues: [],
        feedback: "Question was not attempted.",
        betterAnswer: q.expectedKnowledge || "Architectural and technical implementation details for project.",
        submittedAt: existingAnsIndex !== -1 ? session.answers[existingAnsIndex].submittedAt : new Date(),
      };

      if (existingAnsIndex !== -1) {
        session.answers[existingAnsIndex] = answerData;
      } else {
        session.answers.push(answerData);
      }
    }

    session.totalScore = 0;
    session.overallScore = 0;
    session.maxScore = 100;
    session.percentage = 0;
    session.overallRating = "Weak";
    session.strengths = [];
    session.weaknesses = ["No questions attempted"];
    session.finalFeedback = "No project questions were attempted during the interview.";
    session.evaluationStatus = "COMPLETED";
    session.evaluationCompleted = true;
    session.aiEvaluationCalls = 0;
    session.evaluationCompletedAt = new Date();
    session.status = "completed";

    await session.save();

    return {
      success: true,
      message: "Project session completed with 0 attempted questions (0 AI calls)",
      sessionId,
      totalScore: 0,
      maxScore: 100,
      percentage: 0,
      overallRating: "Weak",
      strengths: session.strengths,
      weaknesses: session.weaknesses,
      finalFeedback: session.finalFeedback,
      evaluations: session.answers,
      reused: false,
      aiEvaluationCalls: 0,
    };
  }

  // Preprocess attempted answers
  const preprocessMap = await preprocessAnswerBatch(
    attemptedQuestions.map((q) => ({ questionId: q.questionId, answer: q.candidateAnswer, round: "project" })),
    300
  );

  const questionsToEvaluate = attemptedQuestions.map((q) => {
    const pre = preprocessMap.get(q.questionId);
    if (pre && pre.reductionPercent > 0) {
      console.log(`[EVAL-NLP] round=project questionId=${q.questionId} originalTokens=${pre.tokenCountBefore} compactTokens=${pre.tokenCountAfter} reductionPercent=${pre.reductionPercent}`);
    }
    return { ...q, candidateAnswer: pre?.compactAnswer || q.candidateAnswer, originalCandidateAnswer: q.candidateAnswer };
  });

  session.evaluationStatus = "EVALUATING";
  session.evaluationStartedAt = new Date();
  await session.save();

  console.log(`[ProjectService] Making AI CALL #2 (evaluation of ${questionsToEvaluate.length} attempted questions) for session ${sessionId}...`);
  let evalResult;

  try {
    evalResult = await evaluateProjectInterviewAI({
      candidateProfile,
      questions: questionsToEvaluate,
    });
  } catch (evalErr) {
    console.error(`[ProjectService] Project AI evaluation call failed for session ${sessionId}: ${evalErr.message}`);
    session.evaluationStatus = "FAILED";
    await session.save();
    throw new Error(`Project AI evaluation failed: ${evalErr.message}`);
  }

  const evaluationsList = Array.isArray(evalResult.evaluations) ? evalResult.evaluations : [];
  let calculatedTotalScore = 0;

  for (const q of allQuestions) {
    const qIdStr = q._id.toString();
    const itemEval = evaluationsList.find((e) => String(e.questionId) === qIdStr) || {};
    const baseObj = baseQuestions.find((bq) => bq.questionId === qIdStr);
    const maxScore = q.maxMarks || (q.difficulty === "easy" ? 5 : q.difficulty === "hard" ? 20 : 10);

    let score = 0;
    let rating = "Weak";
    let feedback = "Question was not attempted.";
    let missingPoints = ["Question was not attempted"];
    let correctPoints = [];
    let incorrectPoints = [];
    let grammarIssues = [];
    let betterAnswer = q.expectedKnowledge || "Interview-ready response based on candidate answer.";

    if (baseObj?.answerPresent) {
      const rawScore = Number(itemEval.score);
      score = isNaN(rawScore) ? 0 : Math.max(0, Math.min(maxScore, Math.round(rawScore)));
      const ratingCandidate = String(itemEval.rating || "").trim();
      rating = ratingCandidate || (score >= maxScore * 0.8 ? "Strong" : score >= maxScore * 0.5 ? "Acceptable" : "Weak");
      feedback = String(itemEval.feedback || "Evaluation complete.").trim();
      missingPoints = Array.isArray(itemEval.missingPoints) ? itemEval.missingPoints : [];
      correctPoints = Array.isArray(itemEval.correctPoints) ? itemEval.correctPoints : [];
      incorrectPoints = Array.isArray(itemEval.incorrectPoints) ? itemEval.incorrectPoints : [];
      grammarIssues = Array.isArray(itemEval.grammarIssues) ? itemEval.grammarIssues : [];
      if (itemEval.betterAnswer) betterAnswer = String(itemEval.betterAnswer).trim();
    }

    calculatedTotalScore += score;

    const existingAnsIndex = session.answers.findIndex((a) => a.questionId.toString() === qIdStr);
    const persistedAnswer = baseObj?.answerPresent
      ? baseObj.candidateAnswer
      : "(No answer submitted)";

    const answerData = {
      questionId: q._id,
      question: q.question,
      difficulty: q.difficulty,
      maxScore,
      topic: q.topic,
      category: q.category,
      projectName: q.projectName,
      candidateAnswer: persistedAnswer,
      score,
      rating,
      evaluationSource: baseObj?.answerPresent ? (itemEval.evaluationSource || "ai_evaluated") : "not_attempted",
      correctPoints,
      missingPoints,
      incorrectPoints,
      grammarIssues,
      feedback,
      betterAnswer,
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
  session.weaknesses = Array.isArray(evalResult.weaknesses) ? evalResult.weaknesses : ["Areas identified in response"];
  session.finalFeedback = String(evalResult.finalFeedback || "Project interview evaluated using AI.").trim();

  session.evaluationStatus = "COMPLETED";
  session.evaluationCompleted = true;
  session.aiEvaluationCalls = 1;
  session.evaluationCompletedAt = new Date();
  session.status = "completed";

  await session.save();

  console.log(`[ProjectService] Evaluation complete for session ${sessionId}. Total score: ${calculatedTotalScore}/100 (${percentage}%).`);

  return {
    success: true,
    message: "Project interview evaluated successfully in 1 AI call",
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
      evaluationSource: a.evaluationSource || "ai_evaluated",
      correctPoints: a.correctPoints,
      missingPoints: a.missingPoints,
      incorrectPoints: a.incorrectPoints,
      grammarIssues: a.grammarIssues,
      feedback: a.feedback,
      betterAnswer: a.betterAnswer,
    })),
    reused: false,
    aiEvaluationCalls: 1,
  };
}

// generateDeterministicProjectFallback removed — replaced by deterministicEvaluator.js
