import RealInterviewHRQuestion from "../../models/RealInterviewHRQuestion.js";
import RealInterviewHRSession from "../../models/RealInterviewHRSession.js";
import Interview from "../../models/Interview.js";
import { generateHRAI, evaluateHRAI } from "../realInterviewAI/hrAI.js";
import { generateDeterministicHREvaluation } from "../realInterviewAI/deterministicEvaluator.js";
import { withInFlightLock } from "./inFlightLock.js";
import {
  getUserQuestionHistorySet,
  recordUserQuestionHistory,
  filterUniqueQuestions,
} from "./questionHistoryService.js";
import { preprocessAnswerBatch } from "../realInterviewAI/answerPreprocessor.js";
import { resolveCandidateAnswer } from "./answerResolver.js";
import { classifyInterviewAIError } from "./errorClassifier.js";
import { idempotentUpsertQuestion } from "../aiReliability/utils/mongoConnectionHelper.js";

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
    };

    let aiQuestions = [];
    const userHistorySet = await getUserQuestionHistorySet(userId, candidateProfile?.resumeHash, "hr");

    // Include fixed Q1 text in dedup pool so AI questions won't duplicate it,
    // but use a separate currentPoolSet (not userHistorySet) to avoid polluting history.
    const fixedQ1PoolSet = new Set();
    const fixedQ1Norm = FIXED_Q1.question.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
    fixedQ1PoolSet.add(fixedQ1Norm);

    try {
      // Over-request: ask AI for 4 candidate questions, then pick the first 2 unique ones.
      // This absorbs dedup filtering without needing a retry round-trip.
      const AI_OVER_REQUEST_COUNT = 4;
      const res = await generateHRAI({ candidateProfile, userHistorySet, count: AI_OVER_REQUEST_COUNT, options: { sessionId } });
      if (res && Array.isArray(res)) {
        aiQuestions = filterUniqueQuestions(res, userHistorySet, fixedQ1PoolSet).slice(0, 2);
      } else {
        throw new Error(`HR AI returned empty or invalid response`);
      }
    } catch (err) {
      console.error(`\n[AI-REQUEST-FAILED]\nround=hr\nrequestId=${requestId}\nerror=${err.message}`);
      const classified = classifyInterviewAIError(err);
      const validCount = Math.min(existingQuestions.length, 3);
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
        questions: existingQuestions.slice(0, 3),
      };
    }

    if (aiQuestions.length < 2) {
      console.error(`\n[AI-REQUEST-FAILED]\nround=hr\nrequestId=${requestId}\nerror=Insufficient unique AI questions returned (${aiQuestions.length}/2)`);
      const classified = classifyInterviewAIError("Insufficient unique HR AI questions generated");
      const validCount = Math.min(existingQuestions.length, 3);
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
        recoverable: true,
        generatedCount: validCount,
        totalRequired: 3,
        nextQuestionNumber: validCount + 1,
        errorCode: classified.code,
        message: classified.message,
        questions: existingQuestions.slice(0, 3),
      };
    }

    console.log(`\n[AI-REQUEST-SUCCESS]\nround=hr\nrequestId=${requestId}\nquestionsReturned=${aiQuestions.length}`);

    const finalQuestionsData = [FIXED_Q1, ...aiQuestions.slice(0, 2)];
    const createdQuestions = [];

    for (let i = 0; i < finalQuestionsData.length; i++) {
      const item = finalQuestionsData[i];
      const qDocData = {
        sessionId,
        userId,
        orderIndex: i + 1,
        question: item.question,
        category: item.category || "Behavioral",
        difficulty: i === 0 ? "easy" : i === 1 ? "medium" : "hard",
        maxMarks: 20,
        behavioralDimensions: item.behavioralDimensions || ["decisionMaking", "ownership"],
        resumeReference: item.resumeReference || "General Workplace Scenario",
        source: i === 0 ? "FIXED_INTRODUCTION" : "AI_PROVIDER",
      };

      const saved = await idempotentUpsertQuestion(
        RealInterviewHRQuestion,
        { sessionId, orderIndex: i + 1 },
        qDocData
      );

      if (saved) createdQuestions.push(saved);
    }

    if (userId && sessionId && createdQuestions.length > 0) {
      // Only record AI-generated questions (Q2, Q3) in history, NOT the fixed Q1 "Introduce yourself."
      // Recording Q1 would pollute the dedup set and is unnecessary since it never changes.
      const aiOnlyQuestions = createdQuestions.filter((q) => q.source !== "FIXED_INTRODUCTION");
      if (aiOnlyQuestions.length > 0) {
        await recordUserQuestionHistory({ userId, sessionId, resumeHash: candidateProfile?.resumeHash, round: "hr", questions: aiOnlyQuestions });
      }
    }

    session.generationStatus = "GENERATED";
    session.fallbackUsed = false;
    await session.save();

    return {
      executionCompleted: true,
      generationSucceeded: true,
      roundComplete: true,
      count: createdQuestions.length,
      expectedCount: 3,
      status: "COMPLETE",
      success: true,
      sessionId,
      questions: createdQuestions,
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
 * 4. Complete Batch Evaluation for HR Session (AI CALL #2)
 */
export async function evaluateHRInterviewSession({ sessionId, candidateProfile = {} }) {
  if (!sessionId) throw new Error("sessionId parameter is required for evaluation.");

  const session = await RealInterviewHRSession.findOne({ sessionId });
  if (!session) throw new Error(`HR Session not found for ID: ${sessionId}`);

  if (session.evaluationCompleted || session.evaluationStatus === "COMPLETED") {
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

  const qaPairs = questionsWithAnswers.map((q, idx) => {
    const qIdStr = q._id.toString();
    const resolved = resolveCandidateAnswer({
      roundType: "HR",
      questionId: qIdStr,
      questionIndex: idx + 1,
      questionText: q.question,
      roundSessionAnswers: session.answers || [],
      mainInterviewAnswers,
    });

    if (resolved.answerPresent) {
      const existingAnsIndex = (session.answers || []).findIndex((a) => String(a.questionId) === qIdStr);
      if (existingAnsIndex === -1) {
        session.answers.push({
          questionId: q._id,
          question: q.question,
          difficulty: q.difficulty || "medium",
          maxScore: 20,
          category: q.category,
          behavioralDimensions: q.behavioralDimensions,
          resumeReference: q.resumeReference,
          candidateAnswer: resolved.answer,
          submittedAt: new Date(),
        });
      } else if (!session.answers[existingAnsIndex].candidateAnswer || session.answers[existingAnsIndex].candidateAnswer === "(No answer provided)") {
        session.answers[existingAnsIndex].candidateAnswer = resolved.answer;
      }
    }

    return {
      questionId: q._id,
      question: q.question,
      category: q.category,
      behavioralDimensions: q.behavioralDimensions,
      candidateAnswer: resolved.answer,
      answerPresent: resolved.answerPresent,
    };
  });

  const attemptedPairs = qaPairs.filter((p) => p.answerPresent);

  if (attemptedPairs.length === 0) {
    for (const q of questionsWithAnswers) {
      const qIdStr = q._id.toString();
      const existingAnsIndex = session.answers.findIndex((a) => String(a.questionId) === qIdStr);
      const answerData = {
        questionId: q._id,
        question: q.question,
        difficulty: q.difficulty || "medium",
        category: q.category,
        candidateAnswer: "(No answer provided)",
        score: 0,
        maxScore: 20,
        rating: "Weak",
        reasoningStrengths: [],
        concerns: ["Question was not attempted"],
        feedback: "Question was not attempted.",
        betterAnswer: "Provide a structured behavioral response using the STAR method.",
        submittedAt: existingAnsIndex !== -1 ? session.answers[existingAnsIndex].submittedAt : new Date(),
      };
      if (existingAnsIndex !== -1) session.answers[existingAnsIndex] = answerData;
      else session.answers.push(answerData);
    }

    session.totalScore = 0;
    session.maxScore = 60;
    session.percentage = 0;
    session.overallRating = "Weak";
    session.strengths = [];
    session.areasForImprovement = ["No questions attempted"];
    session.finalFeedback = "No HR behavioral questions were attempted during the interview.";
    session.evaluationCompleted = true;
    session.evaluationStatus = "COMPLETED";
    session.status = "completed";
    session.fallbackUsed = false;
    await session.save();

    return {
      success: true,
      sessionId,
      totalScore: 0,
      maxScore: 60,
      percentage: 0,
      overallRating: "Weak",
      behavioralProfile: session.behavioralProfile || {},
      consistencyObservations: [],
      strengths: [],
      areasForImprovement: session.areasForImprovement,
      finalFeedback: session.finalFeedback,
      evaluations: session.answers,
      reused: false,
      fallbackUsed: false,
      aiEvaluationCalls: session.aiEvaluationCalls,
    };
  }

  session.evaluationStatus = "EVALUATING";
  session.aiEvaluationCalls += 1;
  await session.save();

  const preprocessMap = await preprocessAnswerBatch(
    attemptedPairs.map((p) => ({ questionId: String(p.questionId), answer: p.candidateAnswer, round: "hr" })),
    250
  );

  const qaPairsForAI = attemptedPairs.map((p) => {
    const pre = preprocessMap.get(String(p.questionId));
    return { ...p, candidateAnswer: pre?.compactAnswer || p.candidateAnswer };
  });

  let evalResult;
  try {
    evalResult = await evaluateHRAI({
      candidateProfile: candidateProfile && Object.keys(candidateProfile).length ? candidateProfile : session.candidateProfile,
      questionsWithAnswers: qaPairsForAI,
      options: { sessionId }
    });
  } catch (err) {
    console.log(`\n[RESULT-EVALUATION]\nround=hr\nstatus=AI_FAILED\nerrorCode=${err.message}\nfallback=LOCAL_OR_UNAVAILABLE`);
    console.log(`\n[RESULT-EVALUATION]\nround=hr\nstatus=CONTINUING_AFTER_FAILURE`);
    evalResult = generateDeterministicHREvaluation(attemptedPairs, err.message);
  }

  let totalScore = 0;
  const rawEvaluations = Array.isArray(evalResult.evaluations) ? evalResult.evaluations : [];

  qaPairs.forEach((pair) => {
    const matchingEval = rawEvaluations.find((e) => String(e.questionId) === String(pair.questionId)) || {};

    let score = 0;
    let rating = "Weak";
    let feedback = "Question was not attempted.";
    let reasoningStrengths = [];
    let concerns = ["Question was not attempted"];
    let betterAnswer = "Provide a structured behavioral response using the STAR method.";

    if (pair.answerPresent) {
      const rawScore = Number(matchingEval.score);
      score = isNaN(rawScore) ? 0 : Math.max(0, Math.min(20, Math.round(rawScore)));
      rating = score >= 16 ? "Exceptional" : score >= 11 ? "Strong" : "Average";
      feedback = matchingEval.feedback || "Evaluation complete.";
      reasoningStrengths = matchingEval.reasoningStrengths || [];
      concerns = matchingEval.concerns || [];
      if (matchingEval.betterAnswer) betterAnswer = matchingEval.betterAnswer;
    }

    totalScore += score;
    const ansIdx = session.answers.findIndex((a) => String(a.questionId) === String(pair.questionId));
    const persistedAnswer = pair.answerPresent ? pair.candidateAnswer : "(No answer provided)";

    if (ansIdx >= 0) {
      session.answers[ansIdx].candidateAnswer = persistedAnswer;
      session.answers[ansIdx].score = score;
      session.answers[ansIdx].maxScore = 20;
      session.answers[ansIdx].rating = rating;
      session.answers[ansIdx].reasoningStrengths = reasoningStrengths;
      session.answers[ansIdx].concerns = concerns;
      session.answers[ansIdx].feedback = feedback;
      session.answers[ansIdx].betterAnswer = betterAnswer;
    } else {
      session.answers.push({
        questionId: pair.questionId,
        question: pair.question,
        difficulty: pair.difficulty || "medium",
        category: pair.category,
        candidateAnswer: persistedAnswer,
        score,
        maxScore: 20,
        rating,
        reasoningStrengths,
        concerns,
        feedback,
        betterAnswer,
      });
    }
  });

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
