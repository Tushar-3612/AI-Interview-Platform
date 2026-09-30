import RealInterviewHRQuestion from "../../models/RealInterviewHRQuestion.js";
import RealInterviewHRSession from "../../models/RealInterviewHRSession.js";
import Interview from "../../models/Interview.js";
import { generateHRAI, evaluateHRAI } from "../realInterviewAI/hrAI.js";
import { withInFlightLock } from "./inFlightLock.js";
import {
  getUserQuestionHistorySet,
  recordUserQuestionHistory,
  filterUniqueQuestions,
  normalizeQuestionText,
} from "./questionHistoryService.js";
import { preprocessAnswerBatch } from "../realInterviewAI/answerPreprocessor.js";
import { resolveCandidateAnswer } from "./answerResolver.js";
import { classifyInterviewAIError } from "./errorClassifier.js";
import { idempotentUpsertQuestion } from "../aiReliability/utils/mongoConnectionHelper.js";
import { checkAnswerGate } from "../realInterviewAI/judgeAnswerGate.js";

/**
 * 1. Generate & Process HR Questions (AI CALL #1)
 * Enforces EXACTLY 3 questions, 20 maxMarks each (Total 60 marks).
 * Q1 is ALWAYS the fixed question: "Introduce yourself."
 * Q2 and Q3 are dynamically generated from AI.
 */
export async function generateAndProcessHRQuestions({ userId = null, sessionId, candidateProfile = {} }) {
  if (!sessionId) {
    throw new Error("sessionId is required to generate HR questions.");
  }

  const lockKey = `hr:${sessionId}`;
  return withInFlightLock(lockKey, async () => {
    let session = await RealInterviewHRSession.findOne({ sessionId });
    let existingQuestions = await RealInterviewHRQuestion.find({ sessionId }).sort({ orderIndex: 1 });

    // --- MIGRATION: Clean up old sessions that had more than 3 HR questions ---
    if (existingQuestions.length > 3) {
      const excessQuestions = existingQuestions.filter((q) => q.orderIndex > 3);
      if (excessQuestions.length > 0) {
        console.log(`[HRService] Session ${sessionId} has ${existingQuestions.length} HR questions (old config). Removing ${excessQuestions.length} excess questions (orderIndex > 3).`);
        await RealInterviewHRQuestion.deleteMany({ sessionId, orderIndex: { $gt: 3 } });
        existingQuestions = existingQuestions.filter((q) => q.orderIndex <= 3);
      }
    }

    const existingIndicesSet = new Set(existingQuestions.map((q) => q.orderIndex));
    const isFullyGenerated = [1, 2, 3].every((idx) => existingIndicesSet.has(idx));

    if (session && session.generationStatus === "GENERATED" && existingQuestions.length === 3 && isFullyGenerated) {
      console.log(`[HRService] Session ${sessionId} already has 3 valid GENERATED HR questions. Reusing without re-generation.`);
      return {
        executionCompleted: true,
        generationSucceeded: false, // Reused from DB
        roundComplete: true,
        count: 3,
        expectedCount: 3,
        status: "COMPLETE",
        success: true,
        sessionId,
        questions: existingQuestions,
        reused: true,
        aiGenerationCalls: session.aiGenerationCalls,
      };
    }

    if (!session) {
      session = new RealInterviewHRSession({
        sessionId,
        userId,
        candidateProfile,
        generationStatus: "GENERATING",
        aiGenerationCalls: 0,
      });
    } else {
      session.generationStatus = "GENERATING";
    }

    session.aiGenerationCalls += 1;
    await session.save();

    const requestId = `hr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    console.log(`\n[AI-REQUEST-START]\nround=hr\nsessionId=${sessionId}\nrequestId=${requestId}`);

    const FIXED_Q1 = {
      question: "Introduce yourself.",
      category: "Behavioral",
      difficulty: "easy",
      maxMarks: 20,
      behavioralDimensions: ["communication", "selfAwareness", "personalBrand"],
      resumeReference: "General Background & Introduction",
      source: "FIXED_INTRODUCTION",
    };

    // Ensure FIXED_Q1 is always safely persisted at orderIndex: 1
    await idempotentUpsertQuestion(
      RealInterviewHRQuestion,
      { sessionId, orderIndex: 1 },
      {
        sessionId,
        userId,
        orderIndex: 1,
        ...FIXED_Q1,
      }
    );

    const currentQuestions = await RealInterviewHRQuestion.find({ sessionId }).sort({ orderIndex: 1 });
    const currentIndicesSet = new Set(currentQuestions.map((q) => q.orderIndex));
    const missingAiIndices = [2, 3].filter((idx) => !currentIndicesSet.has(idx));

    let aiQuestions = [];
    const userHistorySet = await getUserQuestionHistorySet(userId, candidateProfile?.resumeHash, "hr");

    const fixedQ1PoolSet = new Set();
    const fixedQ1Norm = normalizeQuestionText(FIXED_Q1.question);
    if (fixedQ1Norm) fixedQ1PoolSet.add(fixedQ1Norm);
    currentQuestions.forEach((q) => {
      const norm = normalizeQuestionText(q.question);
      if (norm) fixedQ1PoolSet.add(norm);
    });

    if (missingAiIndices.length > 0) {
      try {
        const res = await generateHRAI({
          candidateProfile,
          userHistorySet,
          count: missingAiIndices.length,
          currentPoolSet: fixedQ1PoolSet,
          options: { sessionId },
        });

        if (Array.isArray(res)) {
          aiQuestions = res;
        }
      } catch (err) {
        console.error(`\n[AI-REQUEST-FAILED]\nround=hr\nrequestId=${requestId}\nerror=${err.message}`);
        const classified = classifyInterviewAIError(err);
        const allExisting = await RealInterviewHRQuestion.find({ sessionId }).sort({ orderIndex: 1 });
        const validCount = Math.min(allExisting.length, 3);
        session.generationStatus = validCount === 3 ? "GENERATED" : (validCount > 0 ? "PARTIAL" : "FAILED");
        await session.save();

        return {
          executionCompleted: true,
          generationSucceeded: false,
          roundComplete: validCount === 3,
          count: validCount,
          expectedCount: 3,
          status: validCount === 3 ? "COMPLETE" : (validCount > 0 ? "PARTIAL" : "FAILED"),
          success: false,
          recoverable: classified.recoverable,
          generatedCount: validCount,
          totalRequired: 3,
          nextQuestionNumber: validCount + 1,
          errorCode: classified.code,
          message: classified.message,
          questions: allExisting.slice(0, 3),
        };
      }
    }

    const createdAiQuestions = [];
    for (let i = 0; i < aiQuestions.length && i < missingAiIndices.length; i++) {
      const item = aiQuestions[i];
      const slotIdx = missingAiIndices[i];
      const qDocData = {
        sessionId,
        userId,
        orderIndex: slotIdx,
        question: item.question,
        category: item.category || "Behavioral",
        difficulty: slotIdx === 2 ? "medium" : "hard",
        maxMarks: 20,
        behavioralDimensions: item.behavioralDimensions || ["decisionMaking", "ownership"],
        resumeReference: item.resumeReference || "General Workplace Scenario",
        source: "AI_PROVIDER",
      };

      const saved = await idempotentUpsertQuestion(
        RealInterviewHRQuestion,
        { sessionId, orderIndex: slotIdx },
        qDocData
      );
      if (saved) createdAiQuestions.push(saved);
    }

    if (userId && sessionId && createdAiQuestions.length > 0) {
      await recordUserQuestionHistory({
        userId,
        sessionId,
        resumeHash: candidateProfile?.resumeHash,
        round: "hr",
        questions: createdAiQuestions,
      });
    }

    const allFinalQuestions = await RealInterviewHRQuestion.find({ sessionId }).sort({ orderIndex: 1 });
    const isComplete = allFinalQuestions.length === 3;

    session.generationStatus = isComplete ? "GENERATED" : (allFinalQuestions.length > 0 ? "PARTIAL" : "FAILED");
    session.fallbackUsed = false;
    await session.save();

    if (!isComplete) {
      console.warn(`\n[AI-REQUEST-PARTIAL]\nround=hr\nrequestId=${requestId}\nquestionsAvailable=${allFinalQuestions.length}/3`);
      return {
        executionCompleted: true,
        generationSucceeded: false,
        roundComplete: false,
        count: allFinalQuestions.length,
        expectedCount: 3,
        status: "PARTIAL",
        success: false,
        recoverable: true,
        generatedCount: allFinalQuestions.length,
        totalRequired: 3,
        nextQuestionNumber: allFinalQuestions.length + 1,
        errorCode: "PARTIAL_HR_GENERATION",
        message: `Generated ${allFinalQuestions.length}/3 HR questions. Remaining questions will be retried via AI.`,
        questions: allFinalQuestions.slice(0, 3),
      };
    }

    console.log(`\n[AI-REQUEST-SUCCESS]\nround=hr\nrequestId=${requestId}\nquestionsReturned=${allFinalQuestions.length}`);

    return {
      executionCompleted: true,
      generationSucceeded: true,
      roundComplete: true,
      count: allFinalQuestions.length,
      expectedCount: 3,
      status: "COMPLETE",
      success: true,
      sessionId,
      questions: allFinalQuestions.slice(0, 3),
      reused: false,
      fallbackUsed: false,
      aiGenerationCalls: session.aiGenerationCalls,
    };
  });
}

/**
 * 2. Get Next HR Question (ZERO AI CALLS)
 */
export async function getNextHRQuestion({ sessionId }) {
  if (!sessionId) throw new Error("sessionId is required to fetch next HR question.");

  const session = await RealInterviewHRSession.findOne({ sessionId });
  if (!session) throw new Error(`HR Session not found for ID: ${sessionId}`);

  const allQuestions = await RealInterviewHRQuestion.find({ sessionId }).sort({ orderIndex: 1 });
  if (allQuestions.length === 0) throw new Error("No HR questions found for this session. Please call /generate first.");

  const answeredQuestionIds = new Set(session.answers.map((a) => String(a.questionId)));
  const nextQuestion = allQuestions.find((q) => !answeredQuestionIds.has(String(q._id)));

  if (!nextQuestion) {
    return {
      success: true,
      completed: true,
      message: "All 3 HR questions have been answered.",
      totalQuestions: allQuestions.length,
      questionsAnswered: session.answers.length,
    };
  }

  return {
    success: true,
    completed: false,
    question: {
      _id: nextQuestion._id,
      sessionId: nextQuestion.sessionId,
      orderIndex: nextQuestion.orderIndex,
      question: nextQuestion.question,
      category: nextQuestion.category,
      maxMarks: 20,
      behavioralDimensions: nextQuestion.behavioralDimensions,
      resumeReference: nextQuestion.resumeReference,
    },
    progress: {
      currentQuestionIndex: session.answers.length + 1,
      totalQuestions: allQuestions.length,
    },
  };
}

/**
 * 3. Submit HR Answer (ZERO AI CALLS)
 */
export async function submitHRAnswer({ sessionId, questionId, candidateAnswer, userId = null }) {
  if (!sessionId || !questionId) throw new Error("sessionId and questionId are required to submit HR answer.");

  const session = await RealInterviewHRSession.findOne({ sessionId });
  if (!session) throw new Error(`HR Session not found for ID: ${sessionId}`);

  const qDoc = await RealInterviewHRQuestion.findById(questionId);
  if (!qDoc) throw new Error(`HR Question not found for ID: ${questionId}`);

  const existingIdx = session.answers.findIndex((a) => String(a.questionId) === String(questionId));

  const answerPayload = {
    questionId: qDoc._id,
    question: qDoc.question,
    difficulty: qDoc.difficulty,
    maxScore: 20,
    category: qDoc.category,
    behavioralDimensions: qDoc.behavioralDimensions,
    resumeReference: qDoc.resumeReference,
    candidateAnswer: String(candidateAnswer || "").trim(),
    submittedAt: new Date(),
  };

  if (existingIdx >= 0) {
    session.answers[existingIdx] = { ...session.answers[existingIdx].toObject(), ...answerPayload };
  } else {
    session.answers.push(answerPayload);
  }

  session.questionsAnswered = session.answers.length;
  session.currentQuestionIndex = session.answers.length;
  if (userId && !session.userId) session.userId = userId;

  await session.save();

  return {
    success: true,
    message: "HR Answer recorded successfully (0 AI calls).",
    sessionId,
    questionId,
    questionsAnswered: session.answers.length,
    totalQuestions: 3,
  };
}

function getHROverallRating(percentage) {
  if (percentage >= 90) return "Exceptional";
  if (percentage >= 80) return "Very Strong";
  if (percentage >= 70) return "Strong";
  if (percentage >= 60) return "Good";
  if (percentage >= 50) return "Average";
  if (percentage >= 40) return "Needs Improvement";
  return "Weak";
}

/**
 * 4. Complete Batch Evaluation for HR Session (AI CALL #2) with immediate persistence and duplicate skipping
 */
export async function evaluateHRInterviewSession({ sessionId, candidateProfile = {}, forceRecalculate = false }) {
  if (!sessionId) throw new Error("sessionId parameter is required for evaluation.");

  const session = await RealInterviewHRSession.findOne({ sessionId });
  if (!session) throw new Error(`HR Session not found for ID: ${sessionId}`);

  if (!forceRecalculate && (session.evaluationCompleted || session.evaluationStatus === "COMPLETED")) {
    return {
      success: true,
      sessionId,
      totalScore: session.totalScore,
      maxScore: session.maxScore,
      percentage: session.percentage,
      overallRating: session.overallRating,
      behavioralProfile: session.behavioralProfile,
      strengths: session.strengths,
      areasForImprovement: session.areasForImprovement,
      consistencyObservations: session.consistencyObservations,
      finalFeedback: session.finalFeedback,
      evaluations: session.answers,
      reused: true,
      fallbackUsed: session.fallbackUsed,
      aiEvaluationCalls: session.aiEvaluationCalls,
    };
  }

  const questionsWithAnswers = await RealInterviewHRQuestion.find({ sessionId }).sort({ orderIndex: 1 });
  if (questionsWithAnswers.length === 0) throw new Error("No questions found for this session to evaluate.");

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

  for (let idx = 0; idx < questionsWithAnswers.length; idx++) {
    const q = questionsWithAnswers[idx];
    const qIdStr = q._id.toString();
    const existingAnsIndex = (session.answers || []).findIndex((a) => String(a.questionId) === qIdStr);
    const existingAns = existingAnsIndex !== -1 ? session.answers[existingAnsIndex] : null;

    if (existingAns && isAlreadyEvaluated(existingAns) && !forceRecalculate) {
      continue;
    }

    const resolved = resolveCandidateAnswer({
      roundType: "HR",
      questionId: qIdStr,
      questionIndex: idx + 1,
      questionText: q.question,
      roundSessionAnswers: session.answers || [],
      mainInterviewAnswers,
    });

    const gate = checkAnswerGate(resolved.answer, { question: q.question });

    if (!resolved.answerPresent || gate.isGateTriggered) {
      const answerData = {
        questionId: q._id,
        question: q.question,
        difficulty: q.difficulty || "medium",
        category: q.category,
        candidateAnswer: resolved.answerPresent ? resolved.answer : "(No answer provided)",
        score: 0,
        maxScore: 20,
        status: gate.status || "NOT_ATTEMPTED",
        rating: gate.rating || "Weak",
        evaluationSource: gate.isGateTriggered ? "ANSWER_GATE" : "not_attempted",
        reasoningStrengths: [],
        concerns: ["Question was not attempted or was declined"],
        feedback: gate.feedback || "Question was not attempted.",
        betterAnswer: "Provide a structured behavioral response using the STAR method.",
        submittedAt: existingAns?.submittedAt || new Date(),
      };

      if (existingAnsIndex !== -1) session.answers[existingAnsIndex] = answerData;
      else session.answers.push(answerData);
    } else {
      questionsToEvaluate.push({
        questionId: q._id,
        question: q.question,
        category: q.category,
        behavioralDimensions: q.behavioralDimensions,
        candidateAnswer: resolved.answer,
        answerPresent: true,
      });
    }
  }

  await session.save();

  if (questionsToEvaluate.length === 0) {
    const totalScore = session.answers.reduce((sum, a) => sum + (a.score || 0), 0);
    const maxScore = 60;
    const percentage = Math.round((totalScore / maxScore) * 100);
    const overallRating = getHROverallRating(percentage);

    session.totalScore = totalScore;
    session.maxScore = maxScore;
    session.percentage = percentage;
    session.overallRating = overallRating;
    session.behavioralProfile = session.behavioralProfile || {};
    session.consistencyObservations = [];
    session.strengths = session.answers.some((a) => (a.score || 0) > 0)
      ? ["Constructive communication", "Accountability"]
      : [];
    session.areasForImprovement = session.answers.every((a) => (a.score || 0) === 0)
      ? ["No questions attempted"]
      : ["Elaborate practical examples"];
    session.finalFeedback = session.answers.some((a) => (a.score || 0) > 0)
      ? `Completed HR behavioral interview. Score: ${totalScore}/60.`
      : "No HR behavioral questions were attempted during the interview.";
    session.evaluationCompleted = true;
    session.evaluationStatus = "COMPLETED";
    session.status = "completed";
    session.fallbackUsed = false;
    session.aiEvaluationCalls = session.aiEvaluationCalls || 0;

    await session.save();

    return {
      success: true,
      sessionId,
      totalScore,
      maxScore,
      percentage,
      overallRating,
      behavioralProfile: session.behavioralProfile,
      consistencyObservations: session.consistencyObservations,
      strengths: session.strengths,
      areasForImprovement: session.areasForImprovement,
      finalFeedback: session.finalFeedback,
      evaluations: session.answers,
      reused: false,
      fallbackUsed: false,
      aiEvaluationCalls: session.aiEvaluationCalls,
    };
  }

  session.evaluationStatus = "EVALUATING";
  await session.save();

  const preprocessMap = await preprocessAnswerBatch(
    questionsToEvaluate.map((p) => ({ questionId: String(p.questionId), answer: p.candidateAnswer, round: "hr" })),
    250
  );

  const qaPairsForAI = questionsToEvaluate.map((p) => {
    const pre = preprocessMap.get(String(p.questionId));
    return { ...p, candidateAnswer: pre?.compactAnswer || p.candidateAnswer };
  });

  let evalResult;
  try {
    evalResult = await evaluateHRAI({
      candidateProfile: candidateProfile && Object.keys(candidateProfile).length ? candidateProfile : session.candidateProfile,
      questionsWithAnswers: qaPairsForAI,
      options: {
        sessionId,
        onBatchComplete: async (batchEvaluated) => {
          for (const item of batchEvaluated) {
            const qIdStr = String(item.questionId);
            const targetQ = questionsWithAnswers.find((q) => q._id.toString() === qIdStr);
            const baseObj = questionsToEvaluate.find((q) => q.questionId.toString() === qIdStr);

            const rawScore = Number(item.score);
            const score = isNaN(rawScore) ? 0 : Math.max(0, Math.min(20, Math.round(rawScore)));
            const status = score >= 16 ? "CORRECT" : score >= 8 ? "PARTIALLY_CORRECT" : score > 0 ? "PARTIALLY_CORRECT" : "INCORRECT";
            const rating = score >= 16 ? "Exceptional" : score >= 11 ? "Strong" : score >= 6 ? "Average" : "Weak";

            const answerData = {
              questionId: targetQ ? targetQ._id : item.questionId,
              question: targetQ?.question || baseObj?.question || "",
              difficulty: targetQ?.difficulty || "medium",
              category: targetQ?.category || "Behavioral",
              candidateAnswer: baseObj?.candidateAnswer || "(No answer provided)",
              score,
              maxScore: 20,
              status,
              rating,
              evaluationSource: "ai_provider",
              reasoningStrengths: Array.isArray(item.reasoningStrengths) ? item.reasoningStrengths : [],
              concerns: Array.isArray(item.concerns) ? item.concerns : [],
              feedback: item.feedback || "Evaluation complete.",
              betterAnswer: String(item.betterAnswer || "Provide a structured behavioral response using the STAR method.").trim(),
              submittedAt: new Date(),
            };

            const existingAnsIndex = session.answers.findIndex((a) => String(a.questionId) === qIdStr);
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
    console.log(`\n[RESULT-EVALUATION]\nround=hr\nstatus=AI_SUCCESS\nevaluationSource=AI\n`);
  } catch (err) {
    console.error(`\n[RESULT-EVALUATION]\nround=hr\nstatus=AI_FAILED\nerrorCode=${err.message}\n`);
    const hasSomeEvaluated = session.answers.some((a) => a.evaluationSource === "ai_provider" || a.evaluationSource === "ai_evaluated");
    session.evaluationStatus = hasSomeEvaluated ? "PARTIAL" : "FAILED";
    session.evaluationCompleted = false;
    await session.save();
    const propagatedErr = new Error(`HR AI evaluation failed: ${err.message}`);
    propagatedErr.isQuotaExhausted = err.isQuotaExhausted;
    propagatedErr.keySource = err.keySource;
    propagatedErr.mode = err.mode;
    propagatedErr.category = err.category;
    throw propagatedErr;
  }

  const totalScore = session.answers.reduce((sum, a) => sum + (a.score || 0), 0);
  const maxScore = 60;
  const percentage = Math.round((totalScore / maxScore) * 100);
  const overallRating = getHROverallRating(percentage);

  session.totalScore = totalScore;
  session.maxScore = maxScore;
  session.percentage = percentage;
  session.overallRating = overallRating;
  session.behavioralProfile = evalResult.behavioralProfile || {};
  session.consistencyObservations = evalResult.consistencyObservations || [];
  session.strengths = evalResult.strengths || ["Constructive communication", "Accountability"];
  session.areasForImprovement = evalResult.areasForImprovement || ["Elaborate trade-offs"];
  session.finalFeedback = evalResult.finalFeedback || "Completed HR behavioral interview.";
  session.evaluationCompleted = true;
  session.evaluationStatus = "COMPLETED";
  session.status = "completed";
  session.fallbackUsed = false;
  session.aiEvaluationCalls = (session.aiEvaluationCalls || 0) + 1;

  await session.save();

  return {
    success: true,
    sessionId,
    totalScore,
    maxScore,
    percentage,
    overallRating,
    behavioralProfile: session.behavioralProfile,
    consistencyObservations: session.consistencyObservations,
    strengths: session.strengths,
    areasForImprovement: session.areasForImprovement,
    finalFeedback: session.finalFeedback,
    evaluations: session.answers,
    reused: false,
    fallbackUsed: false,
    aiEvaluationCalls: session.aiEvaluationCalls,
  };
}
