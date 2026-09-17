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

/**
 * Generates or retrieves existing 20 Technical questions for a Real Interview session (AI CALL #1).
 * Enforces IDEMPOTENCY & RESUMABLE CHECKPOINTS:
 * 1. Checks existing DB questions for current session.
 * 2. Computes exact missing 1-indexed question numbers from actual DB orderIndex values.
 * 3. Generates missing questions in 2-question AI batches.
 * 4. Saves each batch immediately to MongoDB.
 * 5. Never restarts from Q1 if partial questions exist.
 * 6. Returns a controlled recoverable response on AI failure without unhandled rejections.
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

    const TARGET_COUNT = 20;

    // Helper: compute missing 0-indexed order indices (0..19)
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

    // Check if session is already fully generated with all 20 indices present
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
        source: q.source || "AI_PROVIDER",
        relatedSkill: q.relatedSkill,
        relatedProject: q.relatedProject,
      }));

      return {
        success: true,
        message: "Reused existing 20 technical questions",
        count: studentQuestions.length,
        questions: studentQuestions,
        reused: true,
        aiGenerationCalls: session.aiGenerationCalls || 1,
      };
    }

    // Build context
    const effectiveProfile = await getOrBuildCandidateResumeContext(userId, candidateProfile);
    const userHistorySet = await getUserQuestionHistorySet(userId, effectiveProfile.resumeHash, "technical");

    // Extract skill context string
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

    // Track existing questions in memory pool for deduplication
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

    // Resumable progress-driven batch loop (EXACTLY 2 questions per batch)
    while (missingIndices.length > 0) {
      const currentBatchIndices = missingIndices.slice(0, 2);
      const startQuestionNumber = currentBatchIndices[0] + 1; // First missing 1-indexed question number
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
        });
        totalAiCallsMade++;
      } catch (aiErr) {
        console.error(`[TechnicalService] Batch generation error for Q${startQuestionNumber}: ${aiErr.message}`);
        lastError = aiErr;
        break; // Stop cleanly on AI failure
      }

      if (!batchResult || batchResult.length === 0) {
        console.warn(`[TechnicalService] Batch for Q${startQuestionNumber} returned 0 valid questions.`);
        lastError = new Error(`AI service returned no valid unique questions for Q${startQuestionNumber}`);
        break; // Stop cleanly if batch is empty
      }

      // Format & validate new batch docs mapped to exact missing orderIndex slots
      const newDocs = [];
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

        newDocs.push({
          sessionId,
          userId,
          orderIndex: assignedOrderIndex,
          question: questionText,
          expectedKnowledge,
          difficulty: targetDiff,
          maxMarks,
          topic,
          category: "Conceptual",
          source: "AI_PROVIDER",
          relatedSkill: String(q.skillsTested?.[0] || "").trim(),
          relatedProject: "",
        });
      }

      if (newDocs.length === 0) {
        lastError = new Error(`No valid question documents created for Q${startQuestionNumber}`);
        break;
      }

      // Save batch IMMEDIATELY to DB checkpoint
      const savedBatchDocs = await RealInterviewTechnicalQuestion.insertMany(newDocs);

      if (userId && sessionId) {
        await recordUserQuestionHistory({
          userId,
          sessionId,
          resumeHash: effectiveProfile.resumeHash,
          round: "technical",
          questions: savedBatchDocs,
        });
      }

      // Add to pool and update in-memory list
      savedBatchDocs.forEach((doc) => {
        const norm = normalizeQuestionText(doc.question);
        if (norm) currentPoolSet.add(norm);
        existingQuestions.push(doc);
      });

      console.log(
        `[TechnicalService] Batch saved successfully to DB! Total questions now in DB: ${existingQuestions.length}/${TARGET_COUNT}`
      );

      // Recompute missing indices
      missingIndices = computeMissingIndices(existingQuestions);
    }

    missingIndices = computeMissingIndices(existingQuestions);

    if (missingIndices.length === 0 && existingQuestions.length >= TARGET_COUNT) {
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
          source: q.source || "AI_PROVIDER",
          relatedSkill: q.relatedSkill,
          relatedProject: q.relatedProject,
        }));

      return {
        success: true,
        message: `${studentQuestions.length} resume-driven technical questions generated successfully`,
        count: studentQuestions.length,
        questions: studentQuestions,
        reused: false,
        aiGenerationCalls: totalAiCallsMade,
      };
    } else {
      // Partial generation / Recoverable failure state
      const classified = classifyInterviewAIError(lastError || "Technical generation stopped before completing all 20 questions");
      session.generationStatus = existingQuestions.length > 0 ? "PARTIAL" : "FAILED";
      session.aiGenerationCalls = totalAiCallsMade;
      session.lastErrorCode = classified.code;
      session.lastErrorMessage = classified.message;
      await session.save();

      const firstMissingQuestionNumber = missingIndices.length > 0 ? missingIndices[0] + 1 : existingQuestions.length + 1;

      console.warn(
        `[TechnicalService] Partial generation retained! Saved: ${existingQuestions.length}/${TARGET_COUNT}. First missing question number: Q${firstMissingQuestionNumber}. Error: ${classified.message}`
      );

      const studentQuestions = existingQuestions
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((q) => ({
          id: q._id.toString(),
          question: q.question,
          difficulty: q.difficulty,
          maxMarks: q.maxMarks || (q.difficulty === "easy" ? 3 : q.difficulty === "hard" ? 13 : 5),
          topic: q.topic,
          category: q.category,
          source: q.source || "AI_PROVIDER",
          relatedSkill: q.relatedSkill,
          relatedProject: q.relatedProject,
        }));

      return {
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
 * Selects the candidate's next adaptive technical question.
 * ZERO AI CALLS.
 */
export async function getNextTechnicalQuestion({ sessionId }) {
  if (!sessionId) {
    throw new Error("sessionId is required");
  }

  const session = await RealInterviewTechnicalSession.findOne({ sessionId });
  if (!session) {
    throw new Error("Technical session not found for this sessionId");
  }

  if (session.status === "completed" || session.questionsAnswered >= 20) {
    return {
      success: true,
      completed: true,
      message: "Technical round completed",
    };
  }

  const allQuestions = await RealInterviewTechnicalQuestion.find({ sessionId }).sort({
    orderIndex: 1,
  });

  if (allQuestions.length === 0) {
    throw new Error("No technical questions found for this session. Generate questions first.");
  }

  const answeredQuestionIds = (session.answers || []).map((a) => a.questionId.toString());
  const unanswered = allQuestions.filter((q) => !answeredQuestionIds.includes(q._id.toString()));

  if (unanswered.length === 0) {
    session.status = "completed";
    await session.save();
    return {
      success: true,
      completed: true,
      message: "All technical questions answered",
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
      maxMarks: selectedQuestion.maxMarks || (selectedQuestion.difficulty === "easy" ? 3 : selectedQuestion.difficulty === "hard" ? 13 : 5),
      topic: selectedQuestion.topic,
      category: selectedQuestion.category,
      source: selectedQuestion.source,
      relatedSkill: selectedQuestion.relatedSkill,
      relatedProject: selectedQuestion.relatedProject,
      questionNumber: session.questionsAnswered + 1,
      totalQuestions: 20,
    },
    adaptiveState: {
      strongAnswerCount: session.strongAnswerCount,
      hardUnlocked: session.hardUnlocked,
      questionsAnswered: session.questionsAnswered,
      totalQuestions: 20,
    },
  };
}

/**
 * Submits candidate's answer to database.
 * STRICTLY ZERO AI CALLS.
 */
export async function submitTechnicalAnswer({
  sessionId,
  questionId,
  candidateAnswer,
  userId = null,
}) {
  if (!sessionId || !questionId) {
    throw new Error("sessionId and questionId are required");
  }

  const questionDoc = await RealInterviewTechnicalQuestion.findById(questionId);
  if (!questionDoc) {
    throw new Error("Question not found");
  }

  const session = await RealInterviewTechnicalSession.findOne({ sessionId });
  if (!session) {
    throw new Error("Technical session not found");
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
        totalQuestions: 20,
        completed: session.questionsAnswered >= 20 || session.status === "completed",
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

  if (session.questionsAnswered >= 20) {
    session.status = "completed";
  }

  const maxScore = questionDoc.maxMarks || (questionDoc.difficulty === "easy" ? 3 : questionDoc.difficulty === "hard" ? 13 : 5);

  const answerRecord = {
    questionId: questionDoc._id,
    question: questionDoc.question,
    difficulty: questionDoc.difficulty,
    maxScore,
    topic: questionDoc.topic,
    category: questionDoc.category,
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
      totalQuestions: 20,
      completed: session.questionsAnswered >= 20 || session.status === "completed",
    },
  };
}

/**
 * Evaluates ALL 20 candidate answers in ONE SINGLE AI API Request after completion (AI CALL #2).
 * Includes safe deterministic application-level fallback if AI request fails (e.g. rate limit/network error).
 */
export async function evaluateTechnicalInterviewSession({ sessionId, candidateProfile = {} }) {
  if (!sessionId) {
    throw new Error("sessionId is required for evaluation");
  }

  const session = await RealInterviewTechnicalSession.findOne({ sessionId });
  if (!session) {
    throw new Error("Technical session not found for evaluation");
  }

  if (
    session.evaluationCompleted ||
    session.evaluationStatus === "COMPLETED"
  ) {
    console.log(
      `[TechnicalService] Session ${sessionId} already evaluated cleanly (aiEvaluationCalls: ${session.aiEvaluationCalls}). Reusing stored evaluation.`
    );
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

  const allQuestions = await RealInterviewTechnicalQuestion.find({ sessionId }).sort({
    orderIndex: 1,
  });

  if (allQuestions.length === 0) {
    throw new Error("No technical questions found for evaluation in this session");
  }

  const mainInterviewDoc = await Interview.findById(sessionId).lean().catch(() => null);
  const mainInterviewAnswers = mainInterviewDoc?.answers || [];

  // Build base questions-to-evaluate list using authoritative answer resolver
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

    // Sync answer back to technical session if found in main interview doc but missing in session
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
      expectedKnowledge: q.expectedKnowledge || `Detailed technical explanation covering key principles and practical implementation of ${q.topic || q.question}.`,
      candidateAnswer: resolved.answer,
      answerPresent: resolved.answerPresent,
    };
  });

  // Filter ONLY attempted questions to send to AI
  const attemptedQuestions = baseQuestions.filter((q) => q.answerPresent);

  // If ZERO questions were attempted, skip AI call completely
  if (attemptedQuestions.length === 0) {
    console.log(`[TechnicalService] 0 candidate answers submitted for technical session ${sessionId}. Skipping AI evaluation call.`);

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
        betterAnswer: q.expectedKnowledge || "Comprehensive technical explanation covering core principles.",
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
    session.finalFeedback = "No technical questions were attempted during the interview.";
    session.evaluationStatus = "COMPLETED";
    session.evaluationCompleted = true;
    session.aiEvaluationCalls = 0;
    session.evaluationCompletedAt = new Date();
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

  // Preprocess attempted answers
  const preprocessMap = await preprocessAnswerBatch(
    attemptedQuestions.map((q) => ({ questionId: q.questionId, answer: q.candidateAnswer, round: "technical" })),
    300
  );

  const questionsToEvaluate = attemptedQuestions.map((q) => {
    const pre = preprocessMap.get(q.questionId);
    if (pre && pre.reductionPercent > 0) {
      console.log(`[EVAL-NLP] round=technical questionId=${q.questionId} originalTokens=${pre.tokenCountBefore} compactTokens=${pre.tokenCountAfter} reductionPercent=${pre.reductionPercent}`);
    }
    return {
      ...q,
      candidateAnswer: pre?.compactAnswer || q.candidateAnswer,
      originalCandidateAnswer: q.candidateAnswer,
    };
  });

  session.evaluationStatus = "EVALUATING";
  session.evaluationStartedAt = new Date();
  await session.save();

  console.log(`[TechnicalService] Making AI CALL #2 (evaluation of ${questionsToEvaluate.length} attempted questions) for session ${sessionId}...`);
  let evalResult;

  try {
    evalResult = await evaluateTechnicalInterviewAI({
      candidateProfile,
      questions: questionsToEvaluate,
    });
  } catch (evalErr) {
    console.error(`[TechnicalService] Technical AI evaluation call failed for session ${sessionId}: ${evalErr.message}`);
    session.evaluationStatus = "FAILED";
    await session.save();
    throw new Error(`Technical AI evaluation failed: ${evalErr.message}`);
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
  session.strengths = Array.isArray(evalResult.strengths) ? evalResult.strengths : ["Candidate answer recorded"];
  session.weaknesses = Array.isArray(evalResult.weaknesses) ? evalResult.weaknesses : ["Areas identified in response"];
  session.finalFeedback = String(evalResult.finalFeedback || "Technical interview evaluated using AI.").trim();

  session.evaluationStatus = "COMPLETED";
  session.evaluationCompleted = true;
  session.aiEvaluationCalls = 1;
  session.evaluationCompletedAt = new Date();
  session.status = "completed";

  await session.save();

  console.log(`[TechnicalService] Evaluation complete for session ${sessionId}. Total score: ${calculatedTotalScore}/100 (${percentage}%).`);

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

// generateDeterministicTechnicalFallback removed — replaced by deterministicEvaluator.js
