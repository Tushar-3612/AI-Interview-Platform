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
import { idempotentUpsertQuestion } from "../aiReliability/utils/mongoConnectionHelper.js";
import { checkAnswerGate } from "../realInterviewAI/judgeAnswerGate.js";

/**
 * Generates or retrieves existing 5 Project/Resume questions for a Real Interview session (AI CALL #1).
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
    const isFullyGenerated = [0, 1, 2, 3, 4].every((idx) => existingIndicesSet.has(idx));

    if (session && session.generationStatus === "GENERATED" && existingQuestions.length === 5 && isFullyGenerated) {
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

      const studentQuestions = existingQuestions.slice(0, 5).map((q) => ({
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
        expectedCount: 5,
        status: "COMPLETE",
        success: true,
        message: "Reused existing 5 project questions",
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

    const currentExistingIndices = new Set(existingQuestions.map((q) => q.orderIndex));
    const missingIndices = [0, 1, 2, 3, 4].filter((idx) => !currentExistingIndices.has(idx));

    let aiResult = null;
    try {
      aiResult = await generateProjectAI(effectiveProfile, userHistorySet, { sessionId, missingIndices });
    } catch (genErr) {
      console.error(`\n[AI-REQUEST-FAILED]\nround=project\nrequestId=${requestId}\nerror=${genErr.message}`);
      const classified = classifyInterviewAIError(genErr);
      const allExisting = await RealInterviewProjectQuestion.find({ sessionId }).sort({ orderIndex: 1 });
      session.generationStatus = allExisting.length === 5 ? "GENERATED" : (allExisting.length > 0 ? "PARTIAL" : "FAILED");
      session.aiGenerationCalls += 1;
      await session.save();

      return {
        executionCompleted: true,
        generationSucceeded: false,
        roundComplete: allExisting.length === 5,
        count: allExisting.length,
        expectedCount: 5,
        status: allExisting.length === 5 ? "COMPLETE" : (allExisting.length > 0 ? "PARTIAL" : "FAILED"),
        success: false,
        recoverable: classified.recoverable,
        generatedCount: allExisting.length,
        totalRequired: 5,
        nextQuestionNumber: allExisting.length + 1,
        errorCode: classified.code,
        message: classified.message,
        questions: allExisting,
      };
    }

    const rawAiQuestions = aiResult?.questions || [];
    let rawQuestions = filterUniqueQuestions(rawAiQuestions, userHistorySet);

    const savedQuestions = [];

    for (let idx = 0; idx < rawQuestions.length && idx < missingIndices.length; idx++) {
      const q = rawQuestions[idx];
      const slotIdx = missingIndices[idx];
      const questionText = String(q.question || "").trim();
      if (!questionText) continue;

      const expectedKnowledge = String(
        q.expectedKnowledge ||
          q.expected_knowledge ||
          q.expectedAnswer ||
          "Demonstrate clear project workflow, architecture reasoning, and technical implementation details."
      ).trim();

      const slotDiff = slotIdx < 2 ? "easy" : slotIdx < 4 ? "medium" : "hard";
      const maxMarks = slotDiff === "easy" ? 5 : slotDiff === "hard" ? 20 : 10;

      const docToSave = {
        sessionId,
        userId,
        orderIndex: slotIdx,
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
        { sessionId, orderIndex: slotIdx },
        docToSave
      );
      if (saved) savedQuestions.push(saved);
    }

    if (userId && sessionId && savedQuestions.length > 0) {
      await recordUserQuestionHistory({ userId, sessionId, resumeHash: effectiveProfile.resumeHash, round: "resume_project", questions: savedQuestions });
    }

    const allQuestions = await RealInterviewProjectQuestion.find({ sessionId }).sort({ orderIndex: 1 });
    const isComplete = allQuestions.length >= 5;

    session.generationStatus = isComplete ? "GENERATED" : (allQuestions.length > 0 ? "PARTIAL" : "FAILED");
    session.aiGenerationCalls = (session.aiGenerationCalls || 0) + 1;
    await session.save();

    const studentQuestions = allQuestions.slice(0, 5).map((q) => ({
      id: q._id.toString(),
      question: q.question,
      difficulty: q.difficulty,
      maxMarks: q.maxMarks || (q.difficulty === "easy" ? 5 : q.difficulty === "hard" ? 20 : 10),
      topic: q.topic,
      category: q.category,
      projectName: q.projectName,
      source: q.source,
    }));

    if (!isComplete) {
      console.warn(`\n[AI-REQUEST-PARTIAL]\nround=project\nrequestId=${requestId}\nquestionsAvailable=${allQuestions.length}/5`);
      return {
        executionCompleted: true,
        generationSucceeded: false,
        roundComplete: false,
        count: studentQuestions.length,
        expectedCount: 5,
        status: "PARTIAL",
        success: false,
        recoverable: true,
        generatedCount: studentQuestions.length,
        totalRequired: 5,
        nextQuestionNumber: studentQuestions.length + 1,
        errorCode: "PARTIAL_PROJECT_GENERATION",
        message: `Generated ${studentQuestions.length}/5 project questions. Remaining questions will be retried via AI.`,
        questions: studentQuestions,
      };
    }

    console.log(`\n[AI-REQUEST-SUCCESS]\nround=project\nrequestId=${requestId}\nquestionsReturned=${studentQuestions.length}`);

    return {
      executionCompleted: true,
      generationSucceeded: true,
      roundComplete: true,
      count: studentQuestions.length,
      expectedCount: 5,
      status: "COMPLETE",
      success: true,
      message: "5 resume-project questions generated successfully",
      questions: studentQuestions,
      reused: false,
      aiGenerationCalls: session.aiGenerationCalls || 1,
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

  if (session.status === "completed" || session.questionsAnswered >= 5) {
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
      totalQuestions: 5,
    },
    adaptiveState: {
      strongAnswerCount: session.strongAnswerCount,
      hardUnlocked: session.hardUnlocked,
      questionsAnswered: session.questionsAnswered,
      totalQuestions: 5,
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
        totalQuestions: 5,
        completed: session.questionsAnswered >= 5 || session.status === "completed",
      },
    };
  }

  const cleanAnswer = String(candidateAnswer || "").trim();
  if (cleanAnswer.length >= 15) session.strongAnswerCount += 1;
  if (session.strongAnswerCount >= 2) session.hardUnlocked = true;

  session.questionsAnswered += 1;
  session.currentQuestionIndex = session.questionsAnswered;
  if (session.questionsAnswered >= 5) session.status = "completed";

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
      totalQuestions: 5,
      completed: session.questionsAnswered >= 5 || session.status === "completed",
    },
  };
}

/**
 * Evaluates project session after completion with batch-wise evaluation and immediate persistence.
 */
export async function evaluateProjectInterviewSession({ sessionId, candidateProfile = {}, forceRecalculate = false }) {
  if (!sessionId) throw new Error("sessionId is required for evaluation");
  const session = await RealInterviewProjectSession.findOne({ sessionId });
  if (!session) throw new Error("Project session not found for evaluation");

  if (!forceRecalculate && (session.evaluationCompleted || session.evaluationStatus === "COMPLETED")) {
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

  const isAlreadyEvaluated = (a) =>
    a &&
    typeof a.score === "number" &&
    !isNaN(a.score) &&
    a.rating &&
    a.rating !== "pending" &&
    a.status !== "EVALUATION_FAILED" &&
    a.evaluationSource !== "AI_FAILED";

  const questionsToEvaluate = [];

  for (let idx = 0; idx < allQuestions.length; idx++) {
    const q = allQuestions[idx];
    const qIdStr = q._id.toString();
    const existingAnsIndex = (session.answers || []).findIndex((a) => a.questionId.toString() === qIdStr);
    const existingAns = existingAnsIndex !== -1 ? session.answers[existingAnsIndex] : null;

    if (existingAns && isAlreadyEvaluated(existingAns) && !forceRecalculate) {
      continue;
    }

    const resolved = resolveCandidateAnswer({
      roundType: "RESUME_PROJECT",
      questionId: qIdStr,
      questionIndex: idx + 1,
      questionText: q.question,
      roundSessionAnswers: session.answers || [],
      mainInterviewAnswers,
    });

    const maxScore = q.maxMarks || (q.difficulty === "easy" ? 5 : q.difficulty === "hard" ? 20 : 10);
    const expectedKnowledge = q.expectedKnowledge || `Implementation details for ${q.projectName || q.topic}.`;
    const gate = checkAnswerGate(resolved.answer, { question: q.question, expectedKnowledge });

    if (!resolved.answerPresent || gate.isGateTriggered) {
      const answerData = {
        questionId: q._id,
        question: q.question,
        difficulty: q.difficulty,
        maxScore,
        topic: q.topic,
        category: q.category,
        projectName: q.projectName,
        candidateAnswer: resolved.answerPresent ? resolved.answer : "(No answer submitted)",
        score: 0,
        status: gate.status || "NOT_ATTEMPTED",
        rating: gate.rating || "Weak",
        evaluationSource: gate.isGateTriggered ? "ANSWER_GATE" : "not_attempted",
        correctPoints: [],
        missingPoints: ["Question was not attempted or was declined"],
        incorrectPoints: [],
        grammarIssues: [],
        feedback: gate.feedback || "Question was not attempted.",
        betterAnswer: expectedKnowledge,
        submittedAt: existingAns?.submittedAt || new Date(),
      };

      if (existingAnsIndex !== -1) session.answers[existingAnsIndex] = answerData;
      else session.answers.push(answerData);
    } else {
      questionsToEvaluate.push({
        questionId: qIdStr,
        question: q.question,
        difficulty: q.difficulty,
        maxScore,
        topic: q.topic,
        category: q.category,
        projectName: q.projectName,
        expectedKnowledge,
        candidateAnswer: resolved.answer,
        answerPresent: true,
      });
    }
  }

  await session.save();

  const questionMaxMarksSum = allQuestions.reduce(
    (sum, q) => sum + (q.maxMarks || (q.difficulty === "easy" ? 5 : q.difficulty === "hard" ? 20 : 10)),
    0
  );

  if (questionsToEvaluate.length === 0) {
    const calculatedTotalScore = session.answers.reduce((sum, a) => sum + (a.score || 0), 0);
    const percentage = questionMaxMarksSum > 0 ? Math.round((calculatedTotalScore / questionMaxMarksSum) * 100) : 0;
    const scaledScore = questionMaxMarksSum > 0 ? Math.min(100, Math.round((calculatedTotalScore / questionMaxMarksSum) * 100)) : 0;

    session.totalScore = scaledScore;
    session.overallScore = scaledScore;
    session.maxScore = 100;
    session.percentage = percentage;
    session.overallRating = percentage >= 70 ? "Strong" : percentage >= 40 ? "Average" : "Weak";
    session.strengths = session.answers.some((a) => (a.score || 0) > 0)
      ? ["Project architecture and implementation answers evaluated"]
      : [];
    session.weaknesses = session.answers.every((a) => (a.score || 0) === 0)
      ? ["No project questions attempted"]
      : ["Areas identified in project explanations"];
    session.finalFeedback = session.answers.some((a) => (a.score || 0) > 0)
      ? `Project evaluation completed. Score: ${scaledScore}/100.`
      : "No project questions were attempted.";
    session.evaluationStatus = "COMPLETED";
    session.evaluationCompleted = true;
    session.aiEvaluationCalls = session.aiEvaluationCalls || 0;
    session.status = "completed";

    await session.save();

    return {
      success: true,
      message: "Project session evaluation complete",
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
      aiEvaluationCalls: session.aiEvaluationCalls || 0,
    };
  }

  const preprocessMap = await preprocessAnswerBatch(
    questionsToEvaluate.map((q) => ({ questionId: q.questionId, answer: q.candidateAnswer, round: "project" })),
    300
  );

  const preprocessedQuestions = questionsToEvaluate.map((q) => {
    const pre = preprocessMap.get(q.questionId);
    return {
      ...q,
      candidateAnswer: pre?.compactAnswer || q.candidateAnswer,
      originalCandidateAnswer: q.candidateAnswer,
    };
  });

  session.evaluationStatus = "EVALUATING";
  await session.save();

  let evalResult;
  try {
    evalResult = await evaluateProjectInterviewAI({
      candidateProfile,
      questions: preprocessedQuestions,
      options: {
        sessionId,
        onBatchComplete: async (batchEvaluated) => {
          for (const item of batchEvaluated) {
            const qIdStr = String(item.questionId);
            const targetQ =
              allQuestions.find((q) => q._id.toString() === qIdStr) ||
              allQuestions.find((q) => q.question === item.question);
            const baseObj =
              questionsToEvaluate.find((q) => q.questionId === qIdStr) ||
              questionsToEvaluate.find((q) => q.question === item.question);
            const maxScore = targetQ?.maxMarks || baseObj?.maxScore || (targetQ?.difficulty === "easy" ? 5 : targetQ?.difficulty === "hard" ? 20 : 10);

            const rawScore = Number(item.score);
            const score = isNaN(rawScore) ? 0 : Math.max(0, Math.min(maxScore, Math.round(rawScore)));
            const rating = item.rating || (score >= maxScore * 0.8 ? "Strong" : score >= maxScore * 0.5 ? "Acceptable" : "Weak");

            const finalQuestionText = String(targetQ?.question || baseObj?.question || item.question || "").trim();

            const answerData = {
              questionId: targetQ ? targetQ._id : baseObj?.questionId || qIdStr,
              question: finalQuestionText || "Project question",
              difficulty: targetQ?.difficulty || baseObj?.difficulty || item.difficulty || "medium",
              maxScore,
              topic: targetQ?.topic || baseObj?.topic || "",
              category: targetQ?.category || baseObj?.category || "resume_project",
              projectName: targetQ?.projectName || baseObj?.projectName || "Project",
              candidateAnswer: baseObj?.candidateAnswer || "(No answer submitted)",
              score,
              rating,
              status: item.status || (score >= maxScore * 0.8 ? "CORRECT" : score >= maxScore * 0.4 ? "PARTIALLY_CORRECT" : score > 0 ? "PARTIALLY_CORRECT" : "INCORRECT"),
              evaluationSource: "ai_evaluated",
              correctPoints: Array.isArray(item.correctPoints) ? item.correctPoints : [],
              missingPoints: Array.isArray(item.missingPoints) ? item.missingPoints : [],
              incorrectPoints: Array.isArray(item.incorrectPoints) ? item.incorrectPoints : [],
              grammarIssues: Array.isArray(item.grammarIssues) ? item.grammarIssues : [],
              feedback: String(item.feedback || "Evaluation complete.").trim(),
              betterAnswer: String(item.betterAnswer || targetQ?.expectedKnowledge || baseObj?.expectedKnowledge || "").trim(),
              submittedAt: new Date(),
            };

            const existingAnsIndex = session.answers.findIndex((a) => a.questionId.toString() === String(answerData.questionId));
            if (existingAnsIndex !== -1) {
              answerData.submittedAt = session.answers[existingAnsIndex].submittedAt || answerData.submittedAt;
              session.answers[existingAnsIndex] = answerData;
            } else {
              session.answers.push(answerData);
            }
          }
          await session.save();
        },
      },
    });
    console.log(`\n[RESULT-EVALUATION]\nround=project\nstatus=AI_SUCCESS\nevaluationSource=AI\n`);
  } catch (evalErr) {
    console.error(`\n[RESULT-EVALUATION]\nround=project\nstatus=AI_FAILED\nerrorCode=${evalErr.message}\n`);
    const hasSomeEvaluated = session.answers.some((a) => a.evaluationSource === "ai_evaluated");
    session.evaluationStatus = hasSomeEvaluated ? "PARTIAL" : "FAILED";
    session.evaluationCompleted = false;
    await session.save();
    const propagatedErr = new Error(`Project AI evaluation failed: ${evalErr.message}`);
    propagatedErr.isQuotaExhausted = evalErr.isQuotaExhausted;
    propagatedErr.keySource = evalErr.keySource;
    propagatedErr.mode = evalErr.mode;
    propagatedErr.category = evalErr.category;
    throw propagatedErr;
  }

  const calculatedTotalScore = session.answers.reduce((sum, a) => sum + (a.score || 0), 0);
  const percentage = questionMaxMarksSum > 0 ? Math.round((calculatedTotalScore / questionMaxMarksSum) * 100) : 0;
  const scaledScore = questionMaxMarksSum > 0 ? Math.min(100, Math.round((calculatedTotalScore / questionMaxMarksSum) * 100)) : 0;

  session.totalScore = scaledScore;
  session.overallScore = scaledScore;
  session.maxScore = 100;
  session.percentage = percentage;
  session.overallRating = evalResult.overallRating || (percentage >= 70 ? "Strong" : percentage >= 40 ? "Average" : "Weak");
  session.strengths = Array.isArray(evalResult.strengths) ? evalResult.strengths : ["Project answer recorded"];
  session.weaknesses = Array.isArray(evalResult.weaknesses) ? evalResult.weaknesses : ["Areas identified in response"];
  session.finalFeedback = String(evalResult.finalFeedback || "Project interview evaluated.").trim();
  session.evaluationStatus = "COMPLETED";
  session.evaluationCompleted = true;
  session.aiEvaluationCalls = (session.aiEvaluationCalls || 0) + 1;
  session.status = "completed";

  await session.save();

  return {
    success: true,
    message: "Project interview evaluated successfully",
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
    aiEvaluationCalls: session.aiEvaluationCalls,
  };
}
