import {
  generateProjectAI,
  evaluateProjectInterviewAI,
} from "../realInterviewAI/projectAI.js";
import { generateDeterministicProjectEvaluation } from "../realInterviewAI/deterministicEvaluator.js";
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
import { idempotentUpsertQuestion } from "../aiReliability/utils/mongoConnectionHelper.js";

/**
 * Generates or retrieves existing 10 Project/Resume questions for a Real Interview session (AI CALL #1).
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

    const existingIndicesSet = new Set(existingQuestions.map((q) => q.orderIndex));
    const isFullyGenerated = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].every((idx) => existingIndicesSet.has(idx));

    if (session && session.generationStatus === "GENERATED" && existingQuestions.length === 10 && isFullyGenerated) {
      console.log(
        `[ProjectService] Session ${sessionId} already fully GENERATED (${existingQuestions.length} questions). Reusing existing questions.`
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
        executionCompleted: true,
        generationSucceeded: false, // Reused from DB
        roundComplete: true,
        count: studentQuestions.length,
        expectedCount: 10,
        status: "COMPLETE",
        success: true,
        message: "Reused existing 10 project questions",
        questions: studentQuestions,
        reused: true,
        aiGenerationCalls: session.aiGenerationCalls || 1,
      };
    }

    const effectiveProfile = await getOrBuildCandidateResumeContext(userId, candidateProfile);
    const userHistorySet = await getUserQuestionHistorySet(userId, effectiveProfile.resumeHash, "resume_project");

    const requestId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    console.log(`\n[AI-REQUEST-START]\nround=project\nsessionId=${sessionId}\nrequestId=${requestId}`);

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
      aiResult = await generateProjectAI(effectiveProfile, userHistorySet, { sessionId });
    } catch (genErr) {
      console.error(`\n[AI-REQUEST-FAILED]\nround=project\nrequestId=${requestId}\nerror=${genErr.message}`);
      const classified = classifyInterviewAIError(genErr);
      session.generationStatus = existingQuestions.length === 10 ? "GENERATED" : (existingQuestions.length > 0 ? "PARTIAL" : "FAILED");
      session.aiGenerationCalls += 1;
      await session.save();

      return {
        executionCompleted: true,
        generationSucceeded: false,
        roundComplete: existingQuestions.length === 10,
        count: existingQuestions.length,
        expectedCount: 10,
        status: existingQuestions.length === 10 ? "COMPLETE" : (existingQuestions.length > 0 ? "PARTIAL" : "FAILED"),
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
      console.error(`\n[AI-REQUEST-FAILED]\nround=project\nrequestId=${requestId}\nerror=Insufficient unique AI questions returned (${rawQuestions.length}/10)`);
      const classified = classifyInterviewAIError("Insufficient unique Project AI questions generated");
      session.generationStatus = existingQuestions.length === 10 ? "GENERATED" : (existingQuestions.length > 0 ? "PARTIAL" : "FAILED");
      session.aiGenerationCalls += 1;
      await session.save();

      return {
        executionCompleted: true,
        generationSucceeded: false,
        roundComplete: existingQuestions.length === 10,
        count: existingQuestions.length,
        expectedCount: 10,
        status: existingQuestions.length === 10 ? "COMPLETE" : (existingQuestions.length > 0 ? "PARTIAL" : "FAILED"),
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

    console.log(`\n[AI-REQUEST-SUCCESS]\nround=project\nrequestId=${requestId}\nquestionsReturned=${rawQuestions.length}`);

    const selectedQuestions = rawQuestions.slice(0, 10);
    const savedQuestions = [];

    for (let idx = 0; idx < selectedQuestions.length; idx++) {
      const q = selectedQuestions[idx];
      const questionText = String(q.question || "").trim();
      if (!questionText) continue;

      const expectedKnowledge = String(
        q.expectedKnowledge ||
          q.expected_knowledge ||
          q.expectedAnswer ||
          "Demonstrate clear project workflow, architecture reasoning, and technical implementation details."
      ).trim();

      const slotDiff = idx < 4 ? "easy" : idx < 8 ? "medium" : "hard";
      const maxMarks = slotDiff === "easy" ? 5 : slotDiff === "hard" ? 20 : 10;

      const docToSave = {
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

      const saved = await idempotentUpsertQuestion(
        RealInterviewProjectQuestion,
        { sessionId, orderIndex: idx },
        docToSave
      );
      if (saved) savedQuestions.push(saved);
    }

    if (userId && sessionId && savedQuestions.length > 0) {
      await recordUserQuestionHistory({ userId, sessionId, resumeHash: effectiveProfile.resumeHash, round: "resume_project", questions: savedQuestions });
    }

    session.generationStatus = "GENERATED";
    session.aiGenerationCalls = 1;
    await session.save();

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
      executionCompleted: true,
      generationSucceeded: true,
      roundComplete: true,
      count: studentQuestions.length,
      expectedCount: 10,
      status: "COMPLETE",
      success: true,
      message: "10 resume-project questions generated successfully",
      questions: studentQuestions,
      reused: false,
      aiGenerationCalls: 1,
    };
  });
}

/**
 * Retrieves candidate's next adaptive Project question (ZERO AI CALLS).
 */
export async function getNextProjectQuestion({ sessionId }) {
  if (!sessionId) throw new Error("sessionId is required");
  const session = await RealInterviewProjectSession.findOne({ sessionId });
  if (!session) throw new Error("Project session not found for this sessionId");

  if (session.status === "completed" || session.questionsAnswered >= 10) {
    return { success: true, completed: true, message: "Project round completed" };
  }

  const allQuestions = await RealInterviewProjectQuestion.find({ sessionId }).sort({ orderIndex: 1 });
  if (allQuestions.length === 0) throw new Error("No project questions found for this session.");

  const answeredQuestionIds = (session.answers || []).map((a) => a.questionId.toString());
  const unanswered = allQuestions.filter((q) => !answeredQuestionIds.includes(q._id.toString()));

  if (unanswered.length === 0) {
    session.status = "completed";
    await session.save();
    return { success: true, completed: true, message: "All project questions answered" };
  }

  let candidatePool = unanswered;
  if (!session.hardUnlocked) {
    const easyMediumPool = unanswered.filter((q) => q.difficulty !== "hard");
    if (easyMediumPool.length > 0) candidatePool = easyMediumPool;
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
 * Submits candidate's project answer (ZERO AI CALLS).
 */
export async function submitProjectAnswer({ sessionId, questionId, candidateAnswer, userId = null }) {
  if (!sessionId || !questionId) throw new Error("sessionId and questionId are required");
  const questionDoc = await RealInterviewProjectQuestion.findById(questionId);
  if (!questionDoc) throw new Error("Question not found");

  const session = await RealInterviewProjectSession.findOne({ sessionId });
  if (!session) throw new Error("Project session not found");

  const existingAnswerIndex = session.answers.findIndex((a) => a.questionId.toString() === questionId);
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
  if (cleanAnswer.length >= 15) session.strongAnswerCount += 1;
  if (session.strongAnswerCount >= 2) session.hardUnlocked = true;

  session.questionsAnswered += 1;
  session.currentQuestionIndex = session.questionsAnswered;
  if (session.questionsAnswered >= 10) session.status = "completed";

  const maxScore = questionDoc.maxMarks || (questionDoc.difficulty === "easy" ? 5 : questionDoc.difficulty === "hard" ? 20 : 10);

  session.answers.push({
    questionId: questionDoc._id,
    question: questionDoc.question,
    difficulty: questionDoc.difficulty,
    maxScore,
    topic: questionDoc.topic,
    category: questionDoc.category,
    projectName: questionDoc.projectName,
    candidateAnswer: cleanAnswer,
    submittedAt: new Date(),
  });
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
 * Evaluates project session after completion.
 */
export async function evaluateProjectInterviewSession({ sessionId, candidateProfile = {} }) {
  if (!sessionId) throw new Error("sessionId is required for evaluation");
  const session = await RealInterviewProjectSession.findOne({ sessionId });
  if (!session) throw new Error("Project session not found for evaluation");

  if (session.evaluationCompleted || session.evaluationStatus === "COMPLETED") {
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

  const allQuestions = await RealInterviewProjectQuestion.find({ sessionId }).sort({ orderIndex: 1 });
  if (allQuestions.length === 0) throw new Error("No project questions found for evaluation");

  const mainInterviewDoc = await Interview.findById(sessionId).lean().catch(() => null);
  const mainInterviewAnswers = mainInterviewDoc?.answers || [];

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
    return {
      questionId: qIdStr,
      question: q.question,
      difficulty: q.difficulty,
      maxScore,
      topic: q.topic,
      category: q.category,
      projectName: q.projectName,
      expectedKnowledge: q.expectedKnowledge || `Implementation details for ${q.projectName || q.topic}.`,
      candidateAnswer: resolved.answer,
      answerPresent: resolved.answerPresent,
    };
  });

  const attemptedQuestions = baseQuestions.filter((q) => q.answerPresent);
  if (attemptedQuestions.length === 0) {
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
        betterAnswer: q.expectedKnowledge || "Architectural details for project.",
        submittedAt: existingAnsIndex !== -1 ? session.answers[existingAnsIndex].submittedAt : new Date(),
      };
      if (existingAnsIndex !== -1) session.answers[existingAnsIndex] = answerData;
      else session.answers.push(answerData);
    }

    session.totalScore = 0;
    session.overallScore = 0;
    session.maxScore = 100;
    session.percentage = 0;
    session.overallRating = "Weak";
    session.strengths = [];
    session.weaknesses = ["No questions attempted"];
    session.finalFeedback = "No project questions were attempted.";
    session.evaluationStatus = "COMPLETED";
    session.evaluationCompleted = true;
    session.aiEvaluationCalls = 0;
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

  const preprocessMap = await preprocessAnswerBatch(
    attemptedQuestions.map((q) => ({ questionId: q.questionId, answer: q.candidateAnswer, round: "project" })),
    300
  );

  const questionsToEvaluate = attemptedQuestions.map((q) => {
    const pre = preprocessMap.get(q.questionId);
    return { ...q, candidateAnswer: pre?.compactAnswer || q.candidateAnswer, originalCandidateAnswer: q.candidateAnswer };
  });

  session.evaluationStatus = "EVALUATING";
  await session.save();

  let evalResult;
  try {
    evalResult = await evaluateProjectInterviewAI({
      candidateProfile,
      questions: questionsToEvaluate,
      options: { sessionId }
    });
  } catch (evalErr) {
    console.log(`\n[RESULT-EVALUATION]\nround=project\nstatus=AI_FAILED\nerrorCode=${evalErr.message}\nfallback=LOCAL_OR_UNAVAILABLE`);
    console.log(`\n[RESULT-EVALUATION]\nround=project\nstatus=CONTINUING_AFTER_FAILURE`);
    evalResult = generateDeterministicProjectEvaluation(questionsToEvaluate, evalErr.message);
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
    let betterAnswer = q.expectedKnowledge || "Interview-ready response.";

    if (baseObj?.answerPresent) {
      const rawScore = Number(itemEval.score);
      score = isNaN(rawScore) ? 0 : Math.max(0, Math.min(maxScore, Math.round(rawScore)));
      rating = itemEval.rating || (score >= maxScore * 0.8 ? "Strong" : score >= maxScore * 0.5 ? "Acceptable" : "Weak");
      feedback = String(itemEval.feedback || "Evaluation complete.").trim();
      missingPoints = Array.isArray(itemEval.missingPoints) ? itemEval.missingPoints : [];
      correctPoints = Array.isArray(itemEval.correctPoints) ? itemEval.correctPoints : [];
      incorrectPoints = Array.isArray(itemEval.incorrectPoints) ? itemEval.incorrectPoints : [];
      grammarIssues = Array.isArray(itemEval.grammarIssues) ? itemEval.grammarIssues : [];
      if (itemEval.betterAnswer) betterAnswer = String(itemEval.betterAnswer).trim();
    }

    calculatedTotalScore += score;
    const existingAnsIndex = session.answers.findIndex((a) => a.questionId.toString() === qIdStr);

    const answerData = {
      questionId: q._id,
      question: q.question,
      difficulty: q.difficulty,
      maxScore,
      topic: q.topic,
      category: q.category,
      projectName: q.projectName,
      candidateAnswer: baseObj?.answerPresent ? baseObj.candidateAnswer : "(No answer submitted)",
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

    if (existingAnsIndex !== -1) session.answers[existingAnsIndex] = answerData;
    else session.answers.push(answerData);
  }

  const maxScoreTotal = 100;
  const percentage = Math.round((calculatedTotalScore / maxScoreTotal) * 100);

  session.totalScore = calculatedTotalScore;
  session.overallScore = calculatedTotalScore;
  session.maxScore = maxScoreTotal;
  session.percentage = percentage;
  session.overallRating = evalResult.overallRating || (percentage >= 70 ? "Strong" : percentage >= 40 ? "Average" : "Weak");
  session.strengths = Array.isArray(evalResult.strengths) ? evalResult.strengths : ["Project answer recorded"];
  session.weaknesses = Array.isArray(evalResult.weaknesses) ? evalResult.weaknesses : ["Areas identified in response"];
  session.finalFeedback = String(evalResult.finalFeedback || "Project interview evaluated.").trim();
  session.evaluationStatus = "COMPLETED";
  session.evaluationCompleted = true;
  session.aiEvaluationCalls = 1;
  session.status = "completed";

  await session.save();

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
    evaluations: session.answers,
    reused: false,
    aiEvaluationCalls: 1,
  };
}
