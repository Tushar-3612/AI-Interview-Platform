import RealInterviewCodingQuestion from "../../models/RealInterviewCodingQuestion.js";
import RealInterviewCodingSession from "../../models/RealInterviewCodingSession.js";
import RealInterviewCodingSubmission from "../../models/RealInterviewCodingSubmission.js";
import { generateCodingAI } from "../realInterviewAI/codingAI.js";
import { executeJudge0TestSuite } from "../judge0Service.js";
import { withInFlightLock } from "./inFlightLock.js";
import {
  getUserQuestionHistorySet,
  recordUserQuestionHistory,
  filterUniqueQuestions,
} from "./questionHistoryService.js";
import { classifyInterviewAIError } from "./errorClassifier.js";

/**
 * Robust static fallback set of 3 DSA coding problems if AI API fails (e.g. HTTP 429 rate limit).
 */
/**
 * 1. Generate & Process Coding Questions (AI CALL #1)
 * Enforces EXACTLY 3 problems: Q1 (20m), Q2 (30m), Q3 (50m) = 100 total marks.
 * Enforces maximum 1 AI generation call per session.
 */
export async function generateAndProcessCodingQuestions({ userId = null, sessionId, candidateProfile = {} }) {
  if (!sessionId) {
    throw new Error("sessionId is required to generate Coding problems.");
  }

  const lockKey = `coding:${sessionId}`;
  return withInFlightLock(lockKey, async () => {
    let session = await RealInterviewCodingSession.findOne({ sessionId });
    const existingQuestions = await RealInterviewCodingQuestion.find({ sessionId }).sort({ orderIndex: 1 });
    const existingIndicesSet = new Set(existingQuestions.map((q) => q.orderIndex));
    const isFullyGenerated = [1, 2, 3].every((idx) => existingIndicesSet.has(idx) || existingIndicesSet.has(idx - 1));

    if (session && session.generationStatus === "GENERATED" && existingQuestions.length === 3 && isFullyGenerated) {
      console.log(`[CodingService] Session ${sessionId} already fully GENERATED (3 problems). Reusing existing questions.`);
      return {
        success: true,
        sessionId,
        questions: sanitizeQuestionsForClient(existingQuestions),
        reused: true,
        aiGenerationCalls: session.aiGenerationCalls,
      };
    }

    if (!session) {
      session = new RealInterviewCodingSession({
        sessionId,
        userId,
        candidateProfile,
        generationStatus: "GENERATING",
      });
    } else {
      session.generationStatus = "GENERATING";
    }

    session.aiGenerationCalls += 1;
    await session.save();

    const requestId = `code_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const modelName = process.env.REAL_INTERVIEW_CODING_MODEL || "openai/gpt-oss-120b";
    const hasKey = Boolean(process.env.REAL_INTERVIEW_CODING_API_KEY?.trim());

    console.log(`\n[AI-REQUEST-START]\nround=coding\nprovider=groq\nmodel=${modelName}\nkeyPresent=${hasKey}\nrequestId=${requestId}`);

    let problemsData = [];
    const userHistorySet = await getUserQuestionHistorySet(userId, candidateProfile?.resumeHash, "coding");

    try {
      const res = await generateCodingAI({ candidateProfile, userHistorySet, count: 3 });
      if (res && Array.isArray(res)) {
        problemsData = filterUniqueQuestions(res, userHistorySet);
      } else {
        throw new Error(`Coding AI returned empty or invalid response`);
      }
    } catch (err) {
      console.error(`\n[AI-REQUEST-FAILED]\nround=coding\nprovider=groq\nrequestId=${requestId}\nerror=${err.message}`);
      const classified = classifyInterviewAIError(err);
      session.generationStatus = existingQuestions.length > 0 ? "PARTIAL" : "FAILED";
      await session.save();

      return {
        success: false,
        recoverable: classified.recoverable,
        generatedCount: existingQuestions.length,
        totalRequired: 3,
        nextQuestionNumber: existingQuestions.length + 1,
        errorCode: classified.code,
        message: classified.message,
        questions: existingQuestions,
      };
    }

    if (problemsData.length < 3) {
      console.error(`\n[AI-REQUEST-FAILED]\nround=coding\nprovider=groq\nrequestId=${requestId}\nerror=Insufficient unique AI coding problems returned (${problemsData.length}/3)`);
      const classified = classifyInterviewAIError("Insufficient unique Coding AI problems generated");
      session.generationStatus = existingQuestions.length > 0 ? "PARTIAL" : "FAILED";
      await session.save();

      return {
        success: false,
        recoverable: true,
        generatedCount: existingQuestions.length,
        totalRequired: 3,
        nextQuestionNumber: existingQuestions.length + 1,
        errorCode: classified.code,
        message: classified.message,
        questions: existingQuestions,
      };
    }

    console.log(`\n[AI-REQUEST-SUCCESS]\nround=coding\nprovider=groq\nrequestId=${requestId}\nquestionsReturned=${problemsData.length}`);
    console.log(`\n[QUESTION-SOURCE]\nround=coding\nsource=AI_PROVIDER\ncount=${problemsData.length}\n`);

    const expectedMarks = [20, 30, 50];
    const expectedDifficulties = ["Easy", "Medium", "Hard"];

    await RealInterviewCodingQuestion.deleteMany({ sessionId });

    const createdQuestions = [];
    const problemScores = [];

    for (let i = 0; i < 3; i++) {
      const rawP = problemsData[i];
      const maxMarks = expectedMarks[i];

      const qDoc = new RealInterviewCodingQuestion({
        sessionId,
        userId,
        orderIndex: i + 1,
        title: rawP.title || `Problem #${i + 1}`,
        description: rawP.description || rawP.problemStatement || "",
        difficulty: expectedDifficulties[i],
        marks: maxMarks,
        topic: rawP.topic || "DSA",
        category: rawP.category || "Algorithmic Problem Solving",
        constraints: rawP.constraints || [],
        examples: rawP.examples || [],
        starterCode: rawP.starterCode || {},
        functionSignature: rawP.functionSignature || "",
        supportedLanguages: ["python", "javascript", "java", "cpp"],
        visibleTestCases: rawP.visibleTestCases || [],
        hiddenTestCases: rawP.hiddenTestCases || [],
        source: "AI_PROVIDER",
      });

      const saved = await qDoc.save();
      createdQuestions.push(saved);

      problemScores.push({
        questionId: saved._id,
        orderIndex: i + 1,
        title: saved.title,
        difficulty: saved.difficulty,
        maxMarks,
        score: 0,
        status: "Not Attempted",
        passedTests: 0,
        totalTests: (saved.visibleTestCases.length + saved.hiddenTestCases.length),
      });
    }

    session.generationStatus = "GENERATED";
    session.fallbackUsed = false;
    session.problemScores = problemScores;
    await session.save();

  if (userId && createdQuestions.length > 0) {
    await recordUserQuestionHistory({
      userId,
      sessionId,
      resumeHash: candidateProfile?.resumeHash,
      round: "coding",
      questions: createdQuestions.map((q) => ({
        id: q._id,
        question: `${q.title} - ${q.description}`.trim(),
      })),
    });
  }

  return {
    success: true,
    sessionId,
    count: createdQuestions.length,
    questions: sanitizeQuestionsForClient(createdQuestions),
    reused: false,
    fallbackUsed: false,
    aiGenerationCalls: session.aiGenerationCalls,
  };
 });
}

/**
 * Security helper: Remove hiddenTestCases before sending question data to client
 */
function sanitizeQuestionsForClient(questions) {
  return questions.map((q) => {
    const qObj = q.toObject ? q.toObject() : { ...q };
    delete qObj.hiddenTestCases;
    return qObj;
  });
}

/**
 * 2. Get Coding Questions for Session (ZERO AI CALLS)
 * Strips hiddenTestCases so candidates cannot see hidden inputs/outputs.
 */
export async function getCodingQuestions({ sessionId }) {
  if (!sessionId) {
    throw new Error("sessionId parameter is required.");
  }

  const session = await RealInterviewCodingSession.findOne({ sessionId });
  if (!session) {
    throw new Error(`Coding Session not found for ID: ${sessionId}`);
  }

  const questions = await RealInterviewCodingQuestion.find({ sessionId }).sort({ orderIndex: 1 });
  return {
    success: true,
    sessionId,
    questions: sanitizeQuestionsForClient(questions),
    problemScores: session.problemScores,
  };
}

/**
 * 3. Run Code (ZERO AI CALLS)
 * Executes candidate's code against VISIBLE test cases ONLY via Judge0.
 */
export async function runCodingCode({ sessionId, questionId, language, sourceCode }) {
  if (!sessionId || !questionId || !language || !sourceCode) {
    throw new Error("sessionId, questionId, language, and sourceCode are required to run code.");
  }

  const qDoc = await RealInterviewCodingQuestion.findById(questionId);
  if (!qDoc) {
    throw new Error(`Coding Question not found for ID: ${questionId}`);
  }

  const visibleCases = qDoc.visibleTestCases || [];
  if (visibleCases.length === 0) {
    return {
      success: true,
      status: "No test cases configured",
      passed: 0,
      total: 0,
      testResults: [],
    };
  }

  console.log(`[CodingService] Running code for Q#${qDoc.orderIndex} against ${visibleCases.length} visible test cases (0 AI Calls)...`);

  const execResult = await executeJudge0TestSuite({
    sourceCode,
    language,
    testCases: visibleCases,
  });

  return {
    success: true,
    sessionId,
    questionId,
    language,
    status: execResult.status === "completed" ? "Passed" : execResult.statusDescription || execResult.status,
    passed: execResult.passed,
    total: execResult.total,
    executionTime: execResult.executionTime,
    memory: execResult.memory,
    compileOutput: execResult.compileOutput,
    testResults: execResult.testResults,
  };
}

/**
 * 4. Submit Code (ZERO AI CALLS)
 * Executes candidate's code against ALL test cases (visible + hidden) via Judge0.
 * Backend strictly computes problem score ($20, 30$, or $50$) and updates session totalScore.
 */
export async function submitCodingCode({ sessionId, questionId, language, sourceCode, userId = null }) {
  if (!sessionId || !questionId || !language || !sourceCode) {
    throw new Error("sessionId, questionId, language, and sourceCode are required to submit code.");
  }

  const session = await RealInterviewCodingSession.findOne({ sessionId });
  if (!session) {
    throw new Error(`Coding Session not found for ID: ${sessionId}`);
  }

  const qDoc = await RealInterviewCodingQuestion.findById(questionId);
  if (!qDoc) {
    throw new Error(`Coding Question not found for ID: ${questionId}`);
  }

  const allCases = [...(qDoc.visibleTestCases || []), ...(qDoc.hiddenTestCases || [])];
  console.log(`[CodingService] Submitting code for Q#${qDoc.orderIndex} (${qDoc.marks} marks) against ${allCases.length} test cases (0 AI Calls)...`);

  const execResult = await executeJudge0TestSuite({
    sourceCode,
    language,
    testCases: allCases,
  });

  const totalTests = allCases.length;
  const passedTests = execResult.passed;
  const maxMarks = qDoc.marks; // 20, 30, or 50

  let score = 0;
  let statusStr = "Wrong Answer";

  if (execResult.status === "compile_error") {
    statusStr = "Compilation Error";
    score = 0;
  } else if (passedTests === totalTests && totalTests > 0) {
    statusStr = "Accepted";
    score = maxMarks;
  } else if (passedTests > 0) {
    statusStr = "Partial";
    score = Math.floor((passedTests / totalTests) * maxMarks);
  } else {
    statusStr = "Wrong Answer";
    score = 0;
  }

  // Save submission doc
  const submission = new RealInterviewCodingSubmission({
    sessionId,
    questionId: qDoc._id,
    userId: userId || session.userId,
    language,
    sourceCode,
    status: statusStr,
    passedTests,
    totalTests,
    score,
    maxMarks,
    executionTime: execResult.executionTime,
    memory: execResult.memory,
    compileOutput: execResult.compileOutput,
    testResults: execResult.testResults,
  });
  await submission.save();

  // Update session problem score
  const pScoreIdx = session.problemScores.findIndex((ps) => String(ps.questionId) === String(qDoc._id));
  if (pScoreIdx >= 0) {
    session.problemScores[pScoreIdx].score = score;
    session.problemScores[pScoreIdx].status = statusStr;
    session.problemScores[pScoreIdx].passedTests = passedTests;
    session.problemScores[pScoreIdx].totalTests = totalTests;
    session.problemScores[pScoreIdx].lastLanguage = language;
  } else {
    session.problemScores.push({
      questionId: qDoc._id,
      orderIndex: qDoc.orderIndex,
      title: qDoc.title,
      difficulty: qDoc.difficulty,
      maxMarks,
      score,
      status: statusStr,
      passedTests,
      totalTests,
      lastLanguage: language,
    });
  }

  // Recompute total session score
  let totalScore = 0;
  session.problemScores.forEach((ps) => {
    totalScore += ps.score || 0;
  });

  const maxScore = 100;
  const percentage = Math.round((totalScore / maxScore) * 100);

  session.totalScore = totalScore;
  session.maxScore = maxScore;
  session.percentage = percentage;
  session.overallRating = percentage >= 80 ? "Exceptional" : percentage >= 60 ? "Strong" : percentage >= 40 ? "Average" : "Needs Improvement";
  await session.save();

  // Strip hidden testcase inputs/outputs from client response
  const sanitizedTestResults = (execResult.testResults || []).map((tr) => ({
    index: tr.index,
    passed: tr.passed,
    isHidden: tr.isHidden,
    input: tr.isHidden ? "" : tr.input,
    expected: tr.isHidden ? "" : tr.expected,
    actual: tr.isHidden ? "" : tr.actual,
    error: tr.error,
    status: tr.status,
    timeMs: tr.timeMs,
  }));

  return {
    success: true,
    sessionId,
    questionId: qDoc._id,
    status: statusStr,
    passedTests,
    totalTests,
    score,
    maxMarks,
    sessionTotalScore: totalScore,
    sessionPercentage: percentage,
    executionTime: execResult.executionTime,
    memory: execResult.memory,
    compileOutput: execResult.compileOutput,
    testResults: sanitizedTestResults,
  };
}

/**
 * 5. Evaluate / Result for Coding Session (ZERO AI CALLS)
 * Summarizes the 3 coding problems and final backend score out of 100.
 */
export async function evaluateCodingInterviewSession({ sessionId }) {
  if (!sessionId) {
    throw new Error("sessionId parameter is required for evaluation.");
  }

  const session = await RealInterviewCodingSession.findOne({ sessionId });
  if (!session) {
    throw new Error(`Coding Session not found for ID: ${sessionId}`);
  }

  const questions = await RealInterviewCodingQuestion.find({ sessionId }).sort({ orderIndex: 1 });

  let totalScore = 0;
  const problemResults = [];

  for (let i = 0; i < questions.length; i++) {
    const qDoc = questions[i];
    const pScore = session.problemScores.find((ps) => String(ps.questionId) === String(qDoc._id));

    const maxMarks = qDoc.marks; // 20, 30, 50
    const score = pScore ? pScore.score : 0;
    const status = pScore ? pScore.status : "Not Attempted";

    totalScore += score;

    problemResults.push({
      orderIndex: qDoc.orderIndex,
      questionId: qDoc._id,
      title: qDoc.title,
      difficulty: qDoc.difficulty,
      topic: qDoc.topic,
      maxMarks,
      score,
      status,
      passedTests: pScore ? pScore.passedTests : 0,
      totalTests: pScore ? pScore.totalTests : (qDoc.visibleTestCases.length + qDoc.hiddenTestCases.length),
    });
  }

  const maxScore = 100;
  const percentage = Math.round((totalScore / maxScore) * 100);
  const overallRating = percentage >= 80 ? "Exceptional" : percentage >= 60 ? "Strong" : percentage >= 40 ? "Average" : "Needs Improvement";

  session.totalScore = totalScore;
  session.maxScore = maxScore;
  session.percentage = percentage;
  session.overallRating = overallRating;
  session.status = "completed";
  session.evaluationCompleted = true;
  await session.save();

  return {
    success: true,
    sessionId,
    totalScore,
    maxScore,
    percentage,
    overallRating,
    problems: problemResults,
    fallbackUsed: session.fallbackUsed,
    aiGenerationCalls: session.aiGenerationCalls,
  };
}
