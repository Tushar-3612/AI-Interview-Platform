import {
  generateTechnicalAI,
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

/**
 * Generates or retrieves existing 20 Technical questions for a Real Interview session (AI CALL #1).
 * Enforces IDEMPOTENCY: Does NOT re-generate questions if aiGenerationCalls >= 1 or 20 questions already exist for sessionId.
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

    const existingQuestions = await RealInterviewTechnicalQuestion.find({ sessionId }).sort({
      orderIndex: 1,
    });

  if (
    (session && (session.aiGenerationCalls >= 1 || session.generationStatus === "GENERATED")) ||
    existingQuestions.length >= 20
  ) {
    console.log(
      `[TechnicalService] Session ${sessionId} already generated (${existingQuestions.length} questions, aiGenerationCalls: ${session?.aiGenerationCalls || 1}). Reusing existing questions without AI call.`
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

  const effectiveProfile = await getOrBuildCandidateResumeContext(userId, candidateProfile);
  const userHistorySet = await getUserQuestionHistorySet(userId);

  const requestId = `tech_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const modelName = process.env.REAL_INTERVIEW_TECHNICAL_MODEL || process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
  const hasKey = Boolean((process.env.REAL_INTERVIEW_TECHNICAL_API_KEY || process.env.GROQ_API_KEY)?.trim());

  console.log(`\n[AI-REQUEST-START]\nround=technical\nprovider=groq\nmodel=${modelName}\nkeyPresent=${hasKey}\nrequestId=${requestId}`);
  console.log(`\n[REAL-INTERVIEW][TECHNICAL-CONTEXT]\nskills=[${(effectiveProfile.skills || []).join(", ")}]\n`);

  let aiResult;
  try {
    aiResult = await generateTechnicalAI(effectiveProfile);
  } catch (genErr) {
    console.error(`\n[AI-REQUEST-FAILED]\nround=technical\nprovider=groq\nrequestId=${requestId}\nerror=${genErr.message}`);
    throw new Error(`Technical AI generation failed: ${genErr.message}`);
  }

  const rawAiQuestions = aiResult?.questions || [];
  let rawQuestions = filterUniqueQuestions(rawAiQuestions, userHistorySet);
  if (rawQuestions.length < 20) {
    rawQuestions = rawAiQuestions.slice(0, 20);
  }

  if (rawQuestions.length < 20) {
    console.error(`\n[AI-REQUEST-FAILED]\nround=technical\nprovider=groq\nrequestId=${requestId}\nerror=Insufficient AI questions returned (${rawQuestions.length}/20)`);
    throw new Error(`Insufficient Technical AI questions generated (${rawQuestions.length}/20)`);
  }

  console.log(`\n[AI-REQUEST-SUCCESS]\nround=technical\nprovider=groq\nrequestId=${requestId}\nquestionsReturned=${rawQuestions.length}`);
  console.log(`\n[QUESTION-SOURCE]\nround=technical\nsource=AI_PROVIDER\ncount=${rawQuestions.length}\n`);

  const selectedQuestions = rawQuestions.slice(0, 20);

  const validatedDocs = selectedQuestions.map((q, idx) => {
    const questionText = String(q.question || "").trim();
    if (!questionText) {
      throw new Error(`Technical Question #${idx + 1} has empty question text`);
    }

    const topic = String(q.topic || "General Technical").trim();
    const expectedKnowledge = String(
      q.expectedKnowledge ||
        q.expected_knowledge ||
        q.expectedAnswer ||
        q.expected_answer ||
        q.answer ||
        q.explanation ||
        `Comprehensive technical explanation addressing core principles, practical application, and architecture for ${topic}.`
    ).trim();

    const diff = String(q.difficulty || "medium").toLowerCase().trim();
    const validDiff = ["easy", "medium", "hard"].includes(diff) ? diff : "medium";
    const maxMarks = validDiff === "easy" ? 3 : validDiff === "hard" ? 13 : 5;

    const categoryCandidate = String(q.category || "Conceptual").trim();
    const validCategories = [
      "Fundamentals",
      "Conceptual",
      "Project Implementation",
      "Debugging",
      "Scenario",
      "Architecture",
      "System Design",
      "Technology Specific",
      "Problem Solving",
    ];
    const category = validCategories.includes(categoryCandidate)
      ? categoryCandidate
      : "Conceptual";

    return {
      sessionId,
      userId,
      orderIndex: idx,
      question: questionText,
      expectedKnowledge,
      difficulty: validDiff,
      maxMarks,
      topic,
      category,
      source: "AI_PROVIDER",
      relatedSkill: String(q.relatedSkill || "").trim(),
      relatedProject: String(q.relatedProject || "").trim(),
    };
  });

  const savedQuestions = await RealInterviewTechnicalQuestion.insertMany(validatedDocs);
  if (userId && sessionId) {
    await recordUserQuestionHistory({ userId, sessionId, round: "technical", questions: savedQuestions });
  }

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
    source: q.source,
    relatedSkill: q.relatedSkill,
    relatedProject: q.relatedProject,
  }));

    return {
      success: true,
      message: "20 resume-driven technical questions generated successfully",
      count: studentQuestions.length,
      questions: studentQuestions,
      reused: false,
      aiGenerationCalls: 1,
    };
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
