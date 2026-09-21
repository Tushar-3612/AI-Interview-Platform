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
import { resolveHRFallbackQuestions } from "../realInterviewAI/hrFallbackResolver.js";

/**
 * 1. Generate & Process HR Questions (AI CALL #1)
 * Enforces EXACTLY 5 questions, 20 maxMarks each (Total 100 marks).
 */
export async function generateAndProcessHRQuestions({ userId = null, sessionId, candidateProfile = {} }) {
  if (!sessionId) {
    throw new Error("sessionId is required to generate HR questions.");
  }

  const lockKey = `hr:${sessionId}`;
  return withInFlightLock(lockKey, async () => {
    let session = await RealInterviewHRSession.findOne({ sessionId });
    const existingQuestions = await RealInterviewHRQuestion.find({ sessionId }).sort({ orderIndex: 1 });
    const existingIndicesSet = new Set(existingQuestions.map((q) => q.orderIndex));
    const isFullyGenerated = [1, 2, 3, 4, 5].every((idx) => existingIndicesSet.has(idx) || existingIndicesSet.has(idx - 1));

    if (session && session.generationStatus === "GENERATED" && existingQuestions.length === 5 && isFullyGenerated) {
      console.log(`[HRService] Session ${sessionId} already has 5 valid GENERATED HR questions. Reusing without re-generation.`);
      return {
        executionCompleted: true,
        generationSucceeded: false, // Reused from DB
        roundComplete: true,
        count: existingQuestions.length,
        expectedCount: 5,
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

    let questionsData = [];
    const userHistorySet = await getUserQuestionHistorySet(userId, candidateProfile?.resumeHash, "hr");

    try {
      const res = await generateHRAI({ candidateProfile, userHistorySet, count: 5, options: { sessionId } });
      if (res && Array.isArray(res)) {
        questionsData = filterUniqueQuestions(res, userHistorySet);
      } else {
        throw new Error(`HR AI returned empty or invalid response`);
      }
    } catch (err) {
      console.error(`\n[AI-REQUEST-FAILED]\nround=hr\nrequestId=${requestId}\nerror=${err.message}`);
      // Attempt curated HR fallback before returning FAILED
      if (existingQuestions.length < 5) {
        console.log(`[HRService] AI failed — attempting curated HR fallback for missing ${5 - existingQuestions.length} questions.`);
        const fallbackDocs = resolveHRFallbackQuestions({
          sessionId, userId, candidateProfile, existingQuestions, userHistorySet,
          neededCount: 5 - existingQuestions.length,
        });
        for (const fbDoc of fallbackDocs) {
          const saved = await idempotentUpsertQuestion(
            RealInterviewHRQuestion,
            { sessionId, orderIndex: fbDoc.orderIndex },
            fbDoc
          );
          if (saved) existingQuestions.push(saved);
        }
        if (existingQuestions.length === 5) {
          console.log(`[HRService] Curated HR fallback filled all 5 slots successfully.`);
          session.generationStatus = "GENERATED";
          session.fallbackUsed = true;
          await session.save();
          return {
            executionCompleted: true, generationSucceeded: false, roundComplete: true,
            count: 5, expectedCount: 5, status: "COMPLETE", success: true,
            sessionId, questions: existingQuestions, reused: false,
            fallbackUsed: true, aiGenerationCalls: session.aiGenerationCalls,
          };
        }
      }
      const classified = classifyInterviewAIError(err);
      session.generationStatus = existingQuestions.length === 5 ? "GENERATED" : (existingQuestions.length > 0 ? "PARTIAL" : "FAILED");
      await session.save();
      return {
        executionCompleted: true, generationSucceeded: false,
        roundComplete: existingQuestions.length === 5,
        count: existingQuestions.length, expectedCount: 5,
        status: existingQuestions.length === 5 ? "COMPLETE" : (existingQuestions.length > 0 ? "PARTIAL" : "FAILED"),
        success: false, recoverable: classified.recoverable,
        generatedCount: existingQuestions.length, totalRequired: 5,
        nextQuestionNumber: existingQuestions.length + 1,
        errorCode: classified.code, message: classified.message, questions: existingQuestions,
      };
    }

    if (questionsData.length < 5) {
      // Supplement insufficient AI questions with curated HR fallback questions
      const missingCount = 5 - questionsData.length;
      console.warn(`[HRService] AI returned only ${questionsData.length}/5 questions. Filling ${missingCount} slots from HR fallback bank.`);
      const fallbackDocs = resolveHRFallbackQuestions({
        sessionId, userId, candidateProfile, existingQuestions, userHistorySet,
        neededCount: missingCount,
      });
      // Will be saved below alongside the AI questions
      questionsData = [...questionsData, ...fallbackDocs.map(fd => ({
        question: fd.question, category: fd.category, behavioralDimensions: fd.behavioralDimensions,
        resumeReference: fd.resumeReference, isFallback: true,
      }))];
    }

    console.log(`\n[AI-REQUEST-SUCCESS]\nround=hr\nrequestId=${requestId}\nquestionsReturned=${questionsData.length}`);

    const finalQuestionsData = questionsData.slice(0, 5);
    const createdQuestions = [];

    for (let i = 0; i < finalQuestionsData.length; i++) {
      const item = finalQuestionsData[i];
      const qDocData = {
        sessionId,
        userId,
        orderIndex: i + 1,
        question: item.question,
        category: item.category || "Behavioral",
        difficulty: i < 2 ? "easy" : i < 4 ? "medium" : "hard",
        maxMarks: 20,
        behavioralDimensions: item.behavioralDimensions || ["decisionMaking", "ownership"],
        resumeReference: item.resumeReference || "General Workplace Scenario",
        source: "AI_PROVIDER",
      };

      const saved = await idempotentUpsertQuestion(
        RealInterviewHRQuestion,
        { sessionId, orderIndex: i + 1 },
        qDocData
      );

      if (saved) createdQuestions.push(saved);
    }

    if (userId && sessionId && createdQuestions.length > 0) {
      await recordUserQuestionHistory({ userId, sessionId, resumeHash: candidateProfile?.resumeHash, round: "hr", questions: createdQuestions });
    }

    session.generationStatus = "GENERATED";
    session.fallbackUsed = false;
    await session.save();

    return {
      executionCompleted: true,
      generationSucceeded: true,
      roundComplete: true,
      count: createdQuestions.length,
      expectedCount: 5,
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
      message: "All 5 HR questions have been answered.",
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
    totalQuestions: 5,
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
    session.maxScore = 100;
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
      maxScore: 100,
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

  const maxScore = 100;
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
