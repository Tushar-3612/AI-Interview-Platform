import {
  generateTechnicalAI,
  generateTechnicalAIBatch,
  evaluateTechnicalInterviewAI,
} from "../realInterviewAI/technicalAI.js";
import { generateDeterministicTechnicalEvaluation } from "../realInterviewAI/deterministicEvaluator.js";
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
import { resolveTechnicalFallbackQuestion } from "../realInterviewAI/technicalFallbackResolver.js";
import { idempotentUpsertQuestion } from "../aiReliability/utils/mongoConnectionHelper.js";

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
    const initialMissingCount = missingIndices.length;

    if (initialMissingCount > 0) {
      // Curated fallback activates for ANY number of missing questions (not just <= 3)
      // This ensures 100% question delivery even during complete AI outage
      console.log(
        `[TechnicalService] AI generation ended with missingCount=${initialMissingCount} (missingIndices=[${missingIndices.join(", ")}]). Invoking curated technical fallback resolver for ALL missing slots...`
      );

      for (const slotIndex of missingIndices) {
        const fallbackDoc = resolveTechnicalFallbackQuestion({
          sessionId,
          userId,
          candidateProfile: effectiveProfile,
          existingQuestions,
          targetSlotIndex: slotIndex,
          userHistorySet,
          missingCount: initialMissingCount,
          currentPoolSet,
        });

        if (fallbackDoc) {
          const savedFallback = await idempotentUpsertQuestion(
            RealInterviewTechnicalQuestion,
            { sessionId, orderIndex: slotIndex },
            fallbackDoc
          );
          if (savedFallback && userId && sessionId) {
            await recordUserQuestionHistory({
              userId,
              sessionId,
              resumeHash: effectiveProfile.resumeHash,
              round: "technical",
              questions: [savedFallback],
            });
            const norm = normalizeQuestionText(savedFallback.question);
            if (norm) currentPoolSet.add(norm);
            existingQuestions.push(savedFallback);
          }
        }
      }

      missingIndices = computeMissingIndices(existingQuestions);
    }

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
 * Evaluates technical session after completion.
 */
export async function evaluateTechnicalInterviewSession({ sessionId, candidateProfile = {} }) {
  if (!sessionId) throw new Error("sessionId is required for evaluation");
  const session = await RealInterviewTechnicalSession.findOne({ sessionId });
  if (!session) throw new Error("Technical session not found for evaluation");

  if (session.evaluationCompleted || session.evaluationStatus === "COMPLETED") {
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

  const baseQuestions = allQuestions.map((q, idx) => {
    const qIdStr = q._id.toString();
    const resolved = resolveCandidateAnswer({
      roundType: "TECHNICAL",
      questionId: qIdStr,
      questionIndex: idx + 1,
      questionText: q.question,
      roundSessionAnswers: session.answers || [],
      mainInterviewAnswers,
    });
    const maxScore = q.maxMarks || (q.difficulty === "easy" ? 3 : q.difficulty === "hard" ? 13 : 5);
    return {
      questionId: qIdStr,
      question: q.question,
      difficulty: q.difficulty,
      maxScore,
      topic: q.topic,
      category: q.category,
      expectedKnowledge: q.expectedKnowledge || `Technical explanation for ${q.topic || q.question}.`,
      candidateAnswer: resolved.answer,
      answerPresent: resolved.answerPresent,
    };
  });

  const attemptedQuestions = baseQuestions.filter((q) => q.answerPresent);
  if (attemptedQuestions.length === 0) {
    for (const q of allQuestions) {
      const qIdStr = q._id.toString();
      const maxScore = q.maxMarks || (q.difficulty === "easy" ? 3 : q.difficulty === "hard" ? 13 : 5);
      const existingAnsIndex = session.answers.findIndex((a) => a.questionId.toString() === qIdStr);
      const answerData = {
        questionId: q._id,
        question: q.question,
        difficulty: q.difficulty,
        maxScore,
        topic: q.topic,
        category: q.category,
        candidateAnswer: "(No answer submitted)",
        score: 0,
        rating: "Weak",
        evaluationSource: "not_attempted",
        correctPoints: [],
        missingPoints: ["Question was not attempted"],
        incorrectPoints: [],
        grammarIssues: [],
        feedback: "Question was not attempted.",
        betterAnswer: q.expectedKnowledge || "Comprehensive technical explanation.",
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
    session.finalFeedback = "No technical questions were attempted during the interview.";
    session.evaluationStatus = "COMPLETED";
    session.evaluationCompleted = true;
    session.aiEvaluationCalls = 0;
    session.status = "completed";
    await session.save();

    return {
      success: true,
      message: "Technical session completed with 0 attempted questions (0 AI calls)",
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
    attemptedQuestions.map((q) => ({ questionId: q.questionId, answer: q.candidateAnswer, round: "technical" })),
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
    evalResult = await evaluateTechnicalInterviewAI({
      candidateProfile,
      questions: questionsToEvaluate,
      options: { sessionId }
    });
  } catch (evalErr) {
    console.log(`\n[RESULT-EVALUATION]\nround=technical\nstatus=AI_FAILED\nerrorCode=${evalErr.message}\nfallback=LOCAL_OR_UNAVAILABLE`);
    console.log(`\n[RESULT-EVALUATION]\nround=technical\nstatus=CONTINUING_AFTER_FAILURE`);
    evalResult = generateDeterministicTechnicalEvaluation(questionsToEvaluate, evalErr.message);
  }

  const evaluationsList = Array.isArray(evalResult.evaluations) ? evalResult.evaluations : [];
  let calculatedTotalScore = 0;

  for (const q of allQuestions) {
    const qIdStr = q._id.toString();
    const itemEval = evaluationsList.find((e) => String(e.questionId) === qIdStr) || {};
    const baseObj = baseQuestions.find((bq) => bq.questionId === qIdStr);
    const maxScore = q.maxMarks || (q.difficulty === "easy" ? 3 : q.difficulty === "hard" ? 13 : 5);

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
  session.strengths = Array.isArray(evalResult.strengths) ? evalResult.strengths : ["Technical knowledge recorded"];
  session.weaknesses = Array.isArray(evalResult.weaknesses) ? evalResult.weaknesses : ["Areas identified in response"];
  session.finalFeedback = String(evalResult.finalFeedback || "Technical interview evaluated.").trim();
  session.evaluationStatus = "COMPLETED";
  session.evaluationCompleted = true;
  session.aiEvaluationCalls = 1;
  session.status = "completed";

  await session.save();

  return {
    success: true,
    message: "Technical interview evaluated successfully in 1 AI call",
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
