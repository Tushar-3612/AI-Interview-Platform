import {
  generateTechnicalAI,
  generateTechnicalAIBatch,
  evaluateTechnicalInterviewAI,
} from "../realInterviewAI/technicalAI.js";
import RealInterviewTechnicalQuestion from "../../models/RealInterviewTechnicalQuestion.js";
import RealInterviewTechnicalSession from "../../models/RealInterviewTechnicalSession.js";
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
 * Generates or retrieves existing 15 Technical questions for a Real Interview session (AI CALL #1).
 */
export async function generateAndProcessTechnicalQuestions({
  userId = null,
  sessionId = null,
  candidateProfile = {},
} = {}) {
  if (!sessionId) {
    throw new Error("sessionId is required for technical question generation");
  }

  const lockKey = `technical:${sessionId}`;
  return withInFlightLock(lockKey, async () => {
    let session = await RealInterviewTechnicalSession.findOne({ sessionId });
    let existingQuestions = await RealInterviewTechnicalQuestion.find({ sessionId }).sort({
      orderIndex: 1,
    });

    const TARGET_COUNT = 15;

    const computeMissingIndices = (questionsList) => {
      const existingIndicesSet = new Set(questionsList.map((q) => q.orderIndex));
      const missing = [];
      for (let i = 0; i < TARGET_COUNT; i++) {
        if (!existingIndicesSet.has(i)) {
          missing.push(i);
        }
      }
      return missing;
    };

    let missingIndices = computeMissingIndices(existingQuestions);

    if (
      (session && (session.aiGenerationCalls >= 1 || session.generationStatus === "GENERATED")) &&
      missingIndices.length === 0 &&
      existingQuestions.length >= TARGET_COUNT
    ) {
      console.log(
        `[TechnicalService] Session ${sessionId} already fully generated (${existingQuestions.length} questions). Reusing existing questions.`
      );

      if (!session) {
        session = await RealInterviewTechnicalSession.create({
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

      const studentQuestions = existingQuestions.map((q) => ({
        id: q._id.toString(),
        question: q.question,
        difficulty: q.difficulty,
        maxMarks: q.maxMarks || (q.difficulty === "easy" ? 3 : q.difficulty === "hard" ? 13 : 5),
        topic: q.topic,
        category: q.category,
        source: q.source || "AI_GENERATED",
        generationMethod: q.generationMethod || (q.isFallback ? "CURATED_RESUME_MATCH" : "RESUME_BASED_AI"),
        matchedSkill: q.matchedSkill || q.relatedSkill || "",
        isFallback: Boolean(q.isFallback),
        relatedSkill: q.relatedSkill,
        relatedProject: q.relatedProject,
      }));

      return {
        executionCompleted: true,
        generationSucceeded: false, // Reused, AI wasn't newly run
        roundComplete: true,
        count: studentQuestions.length,
        expectedCount: TARGET_COUNT,
        status: "COMPLETE",
        success: true,
        message: "Reused existing 15 technical questions",
        questions: studentQuestions,
        reused: true,
        aiGenerationCalls: session.aiGenerationCalls || 1,
      };
    }

    const effectiveProfile = await getOrBuildCandidateResumeContext(userId, candidateProfile);
    const userHistorySet = await getUserQuestionHistorySet(userId, effectiveProfile.resumeHash, "technical");

    const skillsList = [
      ...(effectiveProfile.skills || []),
      ...(effectiveProfile.programmingLanguages || []),
      ...(effectiveProfile.frameworks || []),
      ...(effectiveProfile.databases || []),
      ...(effectiveProfile.tools || []),
      ...(effectiveProfile.cloud || []),
    ].map((s) => String(s).trim()).filter(Boolean);

    const uniqueSkills = Array.from(new Set(skillsList));
    const skillsContextStr = uniqueSkills.length > 0
      ? uniqueSkills.slice(0, 15).join(", ")
      : "Computer Science Fundamentals, Data Structures, OOP, Software Engineering Principles";

    const currentPoolSet = new Set();
    existingQuestions.forEach((q) => {
      const norm = normalizeQuestionText(q.question);
      if (norm) currentPoolSet.add(norm);
    });

    console.log(
      `[TechnicalService] Session ${sessionId} starting/resuming generation. Currently existing questions in DB: ${existingQuestions.length}/${TARGET_COUNT}. Missing slots count: ${missingIndices.length}`
    );

    if (!session) {
      session = await RealInterviewTechnicalSession.create({
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

    let totalAiCallsMade = session?.aiGenerationCalls || 0;
    let lastError = null;

    while (missingIndices.length > 0) {
      const currentBatchIndices = missingIndices.slice(0, 2);
      const startQuestionNumber = currentBatchIndices[0] + 1;
      const batchSize = currentBatchIndices.length;

      console.log(
        `[TechnicalService] Resuming generation: requesting Q${startQuestionNumber} to Q${startQuestionNumber + batchSize - 1} (batchSize=${batchSize}, missingIndices=[${currentBatchIndices.join(", ")}])`
      );

      let batchResult = [];
      try {
        batchResult = await generateTechnicalAIBatch({
          skillsContextStr,
          startQuestionNumber,
          batchSize,
          targetTotalCount: TARGET_COUNT,
          userHistorySet,
          currentPoolSet,
          sessionId
        });
        totalAiCallsMade++;
      } catch (aiErr) {
        console.error(`[TechnicalService] Batch generation error for Q${startQuestionNumber}: ${aiErr.message}`);
        lastError = aiErr;
        break;
      }

      if (!batchResult || batchResult.length === 0) {
        console.warn(`[TechnicalService] Batch for Q${startQuestionNumber} returned 0 valid questions.`);
        lastError = new Error(`AI service returned no valid unique questions for Q${startQuestionNumber}`);
        break;
      }

      const savedBatchDocs = [];
      for (let idx = 0; idx < Math.min(batchResult.length, currentBatchIndices.length); idx++) {
        const q = batchResult[idx];
        const assignedOrderIndex = currentBatchIndices[idx];
        const questionText = String(q.question || "").trim();
        if (!questionText) continue;

        const topic = String(q.topic || "General Technical").trim();
        const expectedKnowledge = String(
          q.expectedKnowledge ||
            q.expected_knowledge ||
            q.expectedAnswer ||
            q.expected_answer ||
            `Comprehensive technical explanation addressing core principles for ${topic}.`
        ).trim();

        const targetDiff = assignedOrderIndex <= 5 ? "easy" : assignedOrderIndex <= 17 ? "medium" : "hard";
        const maxMarks = targetDiff === "easy" ? 3 : targetDiff === "hard" ? 13 : 5;

        const docToSave = {
          sessionId,
          userId,
          orderIndex: assignedOrderIndex,
          question: questionText,
          expectedKnowledge,
          difficulty: targetDiff,
          maxMarks,
          topic,
          category: "Conceptual",
          source: "AI_GENERATED",
          generationMethod: "RESUME_BASED_AI",
          matchedSkill: String(q.skillsTested?.[0] || "").trim(),
          isFallback: false,
          relatedSkill: String(q.skillsTested?.[0] || "").trim(),
          relatedProject: "",
        };

        const saved = await idempotentUpsertQuestion(
          RealInterviewTechnicalQuestion,
          { sessionId, orderIndex: assignedOrderIndex },
          docToSave
        );
        if (saved) savedBatchDocs.push(saved);
      }

      if (savedBatchDocs.length === 0) {
        lastError = new Error(`No valid question documents created for Q${startQuestionNumber}`);
        break;
      }

      if (userId && sessionId) {
        await recordUserQuestionHistory({
          userId,
          sessionId,
          resumeHash: effectiveProfile.resumeHash,
          round: "technical",
          questions: savedBatchDocs,
        });
      }

      savedBatchDocs.forEach((doc) => {
        const norm = normalizeQuestionText(doc.question);
        if (norm) currentPoolSet.add(norm);
        existingQuestions.push(doc);
      });

      missingIndices = computeMissingIndices(existingQuestions);
    }

    missingIndices = computeMissingIndices(existingQuestions);
    const roundComplete = missingIndices.length === 0 && existingQuestions.length >= TARGET_COUNT;

    if (roundComplete) {
      session.generationStatus = "GENERATED";
      session.aiGenerationCalls = totalAiCallsMade;
      session.lastErrorCode = "";
      session.lastErrorMessage = "";
      await session.save();

      const studentQuestions = existingQuestions
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((q) => ({
          id: q._id.toString(),
          question: q.question,
          difficulty: q.difficulty,
          maxMarks: q.maxMarks || (q.difficulty === "easy" ? 3 : q.difficulty === "hard" ? 13 : 5),
          topic: q.topic,
          category: q.category,
          source: q.source || "AI_GENERATED",
          generationMethod: q.generationMethod || (q.isFallback ? "CURATED_RESUME_MATCH" : "RESUME_BASED_AI"),
          matchedSkill: q.matchedSkill || q.relatedSkill || "",
          isFallback: Boolean(q.isFallback),
          relatedSkill: q.relatedSkill,
          relatedProject: q.relatedProject,
        }));

      return {
        executionCompleted: true,
        generationSucceeded: true,
        roundComplete: true,
        count: studentQuestions.length,
        expectedCount: TARGET_COUNT,
        status: "COMPLETE",
        success: true,
        message: `${studentQuestions.length} resume-driven technical questions generated successfully`,
        questions: studentQuestions,
        reused: false,
        aiGenerationCalls: totalAiCallsMade,
      };
    } else {
      const classified = classifyInterviewAIError(lastError || "Technical generation stopped before completing all 15 questions");
      session.generationStatus = existingQuestions.length > 0 ? "PARTIAL" : "FAILED";
      session.aiGenerationCalls = totalAiCallsMade;
      session.lastErrorCode = classified.code;
      session.lastErrorMessage = classified.message;
      await session.save();

      const firstMissingQuestionNumber = missingIndices.length > 0 ? missingIndices[0] + 1 : existingQuestions.length + 1;

      const studentQuestions = existingQuestions
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((q) => ({
          id: q._id.toString(),
          question: q.question,
          difficulty: q.difficulty,
          maxMarks: q.maxMarks || (q.difficulty === "easy" ? 3 : q.difficulty === "hard" ? 13 : 5),
          topic: q.topic,
          category: q.category,
          source: q.source || "AI_GENERATED",
          generationMethod: q.generationMethod || (q.isFallback ? "CURATED_RESUME_MATCH" : "RESUME_BASED_AI"),
          matchedSkill: q.matchedSkill || q.relatedSkill || "",
          isFallback: Boolean(q.isFallback),
          relatedSkill: q.relatedSkill,
          relatedProject: q.relatedProject,
        }));

      return {
        executionCompleted: true,
        generationSucceeded: false,
        roundComplete: false,
        count: existingQuestions.length,
        expectedCount: TARGET_COUNT,
        status: existingQuestions.length > 0 ? "PARTIAL" : "FAILED",
        success: false,
        recoverable: classified.recoverable,
        generatedCount: existingQuestions.length,
        totalRequired: TARGET_COUNT,
        nextQuestionNumber: firstMissingQuestionNumber,
        errorCode: classified.code,
        message: classified.message,
        questions: studentQuestions,
      };
    }
  });
}

/**
 * Selects candidate's next adaptive technical question (ZERO AI CALLS).
 */
export async function getNextTechnicalQuestion({ sessionId }) {
  if (!sessionId) throw new Error("sessionId is required");
  const session = await RealInterviewTechnicalSession.findOne({ sessionId });
  if (!session) throw new Error("Technical session not found for this sessionId");

  if (session.status === "completed" || session.questionsAnswered >= 15) {
    return { success: true, completed: true, message: "Technical round completed" };
  }

  const allQuestions = await RealInterviewTechnicalQuestion.find({ sessionId }).sort({ orderIndex: 1 });
  if (allQuestions.length === 0) throw new Error("No technical questions found for this session.");

  const answeredQuestionIds = (session.answers || []).map((a) => a.questionId.toString());
  const unanswered = allQuestions.filter((q) => !answeredQuestionIds.includes(q._id.toString()));

  if (unanswered.length === 0) {
    session.status = "completed";
    await session.save();
    return { success: true, completed: true, message: "All technical questions answered" };
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
      maxMarks: selectedQuestion.maxMarks || (selectedQuestion.difficulty === "easy" ? 3 : selectedQuestion.difficulty === "hard" ? 13 : 5),
      topic: selectedQuestion.topic,
      category: selectedQuestion.category,
      source: selectedQuestion.source,
      relatedSkill: selectedQuestion.relatedSkill,
      relatedProject: selectedQuestion.relatedProject,
      questionNumber: session.questionsAnswered + 1,
      totalQuestions: 15,
    },
    adaptiveState: {
      strongAnswerCount: session.strongAnswerCount,
      hardUnlocked: session.hardUnlocked,
      questionsAnswered: session.questionsAnswered,
      totalQuestions: 15,
    },
  };
}

/**
 * Submits candidate answer (ZERO AI CALLS).
 */
export async function submitTechnicalAnswer({ sessionId, questionId, candidateAnswer, userId = null }) {
  if (!sessionId || !questionId) throw new Error("sessionId and questionId are required");
  const questionDoc = await RealInterviewTechnicalQuestion.findById(questionId);
  if (!questionDoc) throw new Error("Question not found");

  const session = await RealInterviewTechnicalSession.findOne({ sessionId });
  if (!session) throw new Error("Technical session not found");

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
        totalQuestions: 15,
        completed: session.questionsAnswered >= 15 || session.status === "completed",
      },
    };
  }

  const cleanAnswer = String(candidateAnswer || "").trim();
  if (cleanAnswer.length >= 15) session.strongAnswerCount += 1;
  if (session.strongAnswerCount >= 2) session.hardUnlocked = true;

  session.questionsAnswered += 1;
  session.currentQuestionIndex = session.questionsAnswered;
  if (session.questionsAnswered >= 15) session.status = "completed";

  const maxScore = questionDoc.maxMarks || (questionDoc.difficulty === "easy" ? 3 : questionDoc.difficulty === "hard" ? 13 : 5);

  session.answers.push({
    questionId: questionDoc._id,
    question: questionDoc.question,
    difficulty: questionDoc.difficulty,
    maxScore,
    topic: questionDoc.topic,
    category: questionDoc.category,
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
      totalQuestions: 15,
      completed: session.questionsAnswered >= 15 || session.status === "completed",
    },
  };
}

/**
 * Evaluates technical session after completion with batch-wise evaluation and immediate persistence.
 */
export async function evaluateTechnicalInterviewSession({ sessionId, candidateProfile = {}, forceRecalculate = false }) {
  if (!sessionId) throw new Error("sessionId is required for evaluation");
  const session = await RealInterviewTechnicalSession.findOne({ sessionId });
  if (!session) throw new Error("Technical session not found for evaluation");

  if (!forceRecalculate && (session.evaluationCompleted || session.evaluationStatus === "COMPLETED")) {
    return {
      success: true,
      message: "Reused existing technical evaluation result",
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
        maxScore: a.maxScore || (a.difficulty === "easy" ? 3 : a.difficulty === "hard" ? 13 : 5),
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

  const allQuestions = await RealInterviewTechnicalQuestion.find({ sessionId }).sort({ orderIndex: 1 });
  if (allQuestions.length === 0) throw new Error("No technical questions found for evaluation");

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
      roundType: "TECHNICAL",
      questionId: qIdStr,
      questionIndex: idx + 1,
      questionText: q.question,
      roundSessionAnswers: session.answers || [],
      mainInterviewAnswers,
    });

    const maxScore = q.maxMarks || (q.difficulty === "easy" ? 3 : q.difficulty === "hard" ? 13 : 5);
    const expectedKnowledge = q.expectedKnowledge || `Technical explanation for ${q.topic || q.question}.`;
    const gate = checkAnswerGate(resolved.answer, { question: q.question, expectedKnowledge });

    if (!resolved.answerPresent || gate.isGateTriggered) {
      const answerData = {
        questionId: q._id,
        question: q.question,
        difficulty: q.difficulty,
        maxScore,
        topic: q.topic,
        category: q.category,
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
        expectedKnowledge,
        candidateAnswer: resolved.answer,
        answerPresent: true,
      });
    }
  }

  await session.save();

  if (questionsToEvaluate.length === 0) {
    const calculatedTotalScore = session.answers.reduce((sum, a) => sum + (a.score || 0), 0);
    const maxScoreTotal = 100;
    const percentage = Math.min(100, Math.round(calculatedTotalScore));

    session.totalScore = calculatedTotalScore;
    session.overallScore = calculatedTotalScore;
    session.maxScore = maxScoreTotal;
    session.percentage = percentage;
    session.overallRating = percentage >= 70 ? "Strong" : percentage >= 40 ? "Average" : "Weak";
    session.strengths = session.answers.some((a) => (a.score || 0) > 0)
      ? ["Technical knowledge recorded"]
      : [];
    session.weaknesses = session.answers.every((a) => (a.score || 0) === 0)
      ? ["No questions attempted or answered successfully"]
      : ["Areas identified in candidate responses"];
    session.finalFeedback = session.answers.some((a) => (a.score || 0) > 0)
      ? `Technical evaluation completed. Score: ${calculatedTotalScore}/100.`
      : "No technical questions were attempted during the interview.";
    session.evaluationStatus = "COMPLETED";
    session.evaluationCompleted = true;
    session.aiEvaluationCalls = session.aiEvaluationCalls || 0;
    session.status = "completed";

    await session.save();

    return {
      success: true,
      message: "Technical session evaluation complete",
      sessionId,
      totalScore: session.totalScore,
      maxScore: 100,
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
    questionsToEvaluate.map((q) => ({ questionId: q.questionId, answer: q.candidateAnswer, round: "technical" })),
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
    evalResult = await evaluateTechnicalInterviewAI({
      candidateProfile,
      questions: preprocessedQuestions,
      options: {
        sessionId,
        onBatchComplete: async (batchEvaluated) => {
          for (const item of batchEvaluated) {
            const qIdStr = String(item.questionId);
            const targetQ = allQuestions.find((q) => q._id.toString() === qIdStr);
            const baseObj = questionsToEvaluate.find((q) => q.questionId === qIdStr);
            const maxScore = targetQ?.maxMarks || (targetQ?.difficulty === "easy" ? 3 : targetQ?.difficulty === "hard" ? 13 : 5);

            const rawScore = Number(item.score);
            const score = isNaN(rawScore) ? 0 : Math.max(0, Math.min(maxScore, Math.round(rawScore)));
            const rating = item.rating || (score >= maxScore * 0.8 ? "Strong" : score >= maxScore * 0.5 ? "Acceptable" : "Weak");

            const answerData = {
              questionId: targetQ ? targetQ._id : item.questionId,
              question: targetQ?.question || baseObj?.question || "",
              difficulty: targetQ?.difficulty || "medium",
              maxScore,
              topic: targetQ?.topic || "",
              category: targetQ?.category || "Conceptual",
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
              betterAnswer: String(item.betterAnswer || targetQ?.expectedKnowledge || "").trim(),
              submittedAt: new Date(),
            };

            const existingAnsIndex = session.answers.findIndex((a) => a.questionId.toString() === qIdStr);
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
    console.log(`\n[RESULT-EVALUATION]\nround=technical\nstatus=AI_SUCCESS\nevaluationSource=AI\n`);
  } catch (evalErr) {
    console.error(`\n[RESULT-EVALUATION]\nround=technical\nstatus=AI_FAILED\nerrorCode=${evalErr.message}\n`);
    const hasSomeEvaluated = session.answers.some((a) => a.evaluationSource === "ai_evaluated");
    session.evaluationStatus = hasSomeEvaluated ? "PARTIAL" : "FAILED";
    session.evaluationCompleted = false;
    await session.save();
    const propagatedErr = new Error(`Technical AI evaluation failed: ${evalErr.message}`);
    propagatedErr.isQuotaExhausted = evalErr.isQuotaExhausted;
    propagatedErr.keySource = evalErr.keySource;
    propagatedErr.mode = evalErr.mode;
    propagatedErr.category = evalErr.category;
    throw propagatedErr;
  }

  const calculatedTotalScore = Math.min(100, session.answers.reduce((sum, a) => sum + (a.score || 0), 0));
  const maxScoreTotal = 100;
  const percentage = calculatedTotalScore;

  session.totalScore = calculatedTotalScore;
  session.overallScore = calculatedTotalScore;
  session.maxScore = maxScoreTotal;
  session.percentage = percentage;
  session.overallRating = evalResult.overallRating || (percentage >= 70 ? "Strong" : percentage >= 40 ? "Average" : "Weak");
  session.strengths = Array.isArray(evalResult.strengths) ? evalResult.strengths : ["Technical knowledge recorded"];
  session.weaknesses = Array.isArray(evalResult.weaknesses) ? evalResult.weaknesses : ["Areas identified in response"];
  session.finalFeedback = String(evalResult.finalFeedback || "Technical interview evaluated.").trim();
  session.evaluationStatus = "COMPLETED";
  session.evaluationCompleted = true;
  session.aiEvaluationCalls = (session.aiEvaluationCalls || 0) + 1;
  session.status = "completed";

  await session.save();

  return {
    success: true,
    message: "Technical interview evaluated successfully",
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
