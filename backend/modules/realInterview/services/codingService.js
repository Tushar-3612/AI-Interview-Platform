import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import RealInterviewCodingQuestion from "../models/RealInterviewCodingQuestion.js";
import RealInterviewCodingSession from "../models/RealInterviewCodingSession.js";
import RealInterviewCodingSubmission from "../models/RealInterviewCodingSubmission.js";
import { executeJudge0TestSuite } from "../../codingAssessment/services/judge0Service.js";
import { withInFlightLock } from "./inFlightLock.js";
import {
  getUserQuestionHistorySet,
  recordUserQuestionHistory,
} from "./questionHistoryService.js";
import { idempotentUpsertQuestion } from "../../ai/reliability/utils/mongoConnectionHelper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let realInterviewBankCache = null;

function loadRealInterviewCodingBank() {
  if (realInterviewBankCache && realInterviewBankCache.length > 0) {
    return realInterviewBankCache;
  }
  const possiblePaths = [
    path.join(__dirname, "../../data/realinterviewcodingque.json"),
    path.join(__dirname, "../../../realinterviewcodingque.json"),
    path.join(process.cwd(), "backend/data/realinterviewcodingque.json"),
    path.join(process.cwd(), "realinterviewcodingque.json"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const data = fs.readFileSync(p, "utf-8");
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(`[CodingService] Loaded ${parsed.length} verified real interview coding questions from ${p}`);
          realInterviewBankCache = parsed;
          return realInterviewBankCache;
        }
      } catch (err) {
        console.warn(`[CodingService] Failed to parse questions from ${p}: ${err.message}`);
      }
    }
  }

  return [];
}

function formatRealInterviewQuestion(rawQ, orderIndex, marks) {
  const visible = (rawQ.visibleTestCases || []).map(tc => ({
    input: String(tc.input ?? ""),
    expected: String(tc.expectedOutput ?? tc.expected ?? ""),
    isHidden: false,
  }));
  const hidden = (rawQ.hiddenTestCases || []).map(tc => ({
    input: String(tc.input ?? ""),
    expected: String(tc.expectedOutput ?? tc.expected ?? ""),
    isHidden: true,
  }));

  const examples = (rawQ.visibleTestCases || []).slice(0, 2).map(tc => ({
    input: String(tc.input ?? ""),
    output: String(tc.expectedOutput ?? tc.expected ?? ""),
    explanation: String(tc.explanation ?? ""),
  }));

  const templates = rawQ.templates || rawQ.starterTemplates || {};

  return {
    orderIndex,
    title: String(rawQ.title).trim(),
    description: String(rawQ.description || "Solve the algorithmic problem.").trim(),
    difficulty: rawQ.difficulty,
    marks,
    topic: rawQ.topic || "DSA",
    category: rawQ.topic || "Algorithmic Problem Solving",
    constraints: Array.isArray(rawQ.constraints) ? rawQ.constraints : [String(rawQ.constraints || "")],
    inputFormat: rawQ.inputFormat || "Standard input",
    outputFormat: rawQ.outputFormat || "Standard output",
    examples,
    starterCode: {
      python: templates.python || "import sys\n\ndef main():\n    pass\n\nif __name__ == '__main__':\n    main()",
      java: templates.java || "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {}\n}",
      cpp: templates.cpp || "#include <iostream>\nusing namespace std;\n\nint main() {\n    return 0;\n}",
      c: templates.c || "#include <stdio.h>\n#include <stdlib.h>\n\nint main() {\n    return 0;\n}",
      javascript: templates.javascript || "function solution() {\n}"
    },
    functionSignature: "main()",
    supportedLanguages: ["python", "java", "cpp", "c"],
    visibleTestCases: visible.length > 0 ? visible : [
      { input: "sample_1", expected: "expected_1", isHidden: false },
      { input: "sample_2", expected: "expected_2", isHidden: false }
    ],
    hiddenTestCases: hidden.length > 0 ? hidden : [
      { input: "hidden_1", expected: "hidden_1", isHidden: true },
      { input: "hidden_2", expected: "hidden_2", isHidden: true }
    ],
    source: typeof rawQ.source === "object" && rawQ.source?.company ? `Reported from ${rawQ.source.company}` : (rawQ.source || "Real Interview Question Bank"),
    generationMethod: "REAL_INTERVIEW_LOCAL_BANK",
    isFallback: false
  };
}

/**
 * 1. Generate & Process Coding Questions (ZERO AI CALLS - Pure Local Bank Selection)
 * Enforces EXACTLY 3 problems: Q1 (20m Easy), Q2 (30m Medium), Q3 (50m Hard) = 100 total marks.
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
    const isFullyGenerated = [1, 2, 3].every((idx) => existingIndicesSet.has(idx));

    // If 3 valid questions already exist in DB, report roundComplete: true
    if (existingQuestions.length === 3 && isFullyGenerated) {
      console.log(`[CodingService] Session ${sessionId} already fully GENERATED (3 problems). Reusing existing questions.`);
      if (session) {
        session.generationStatus = "GENERATED";
        await session.save();
      }
      return {
        executionCompleted: true,
        generationSucceeded: true,
        fallbackUsed: false,
        roundComplete: true,
        count: 3,
        expectedCount: 3,
        status: "COMPLETE",
        completionSource: "REAL_INTERVIEW_LOCAL_BANK",
        success: true,
        sessionId,
        questions: sanitizeQuestionsForClient(existingQuestions),
        reused: true,
        aiGenerationCalls: 0,
      };
    }

    if (!session) {
      session = new RealInterviewCodingSession({
        sessionId,
        userId,
        candidateProfile,
        generationStatus: "GENERATING",
        aiGenerationCalls: 0,
      });
    } else {
      session.generationStatus = "GENERATING";
    }

    await session.save();

    const bank = loadRealInterviewCodingBank();
    const userHistorySet = await getUserQuestionHistorySet(userId, candidateProfile?.resumeHash, "coding");
    const usedTitlesSet = new Set([...Array.from(userHistorySet), ...existingQuestions.map(q => q.title)]);
    const chosenTopics = new Set(existingQuestions.map(q => q.topic));

    const slots = [
      { orderIndex: 1, difficulty: "Easy", marks: 20 },
      { orderIndex: 2, difficulty: "Medium", marks: 30 },
      { orderIndex: 3, difficulty: "Hard", marks: 50 },
    ];

    const missingSlots = slots.filter(s => !existingIndicesSet.has(s.orderIndex));
    let newlySelectedCount = 0;

    for (const slot of missingSlots) {
      const targetDiff = slot.difficulty.toLowerCase();
      const diffCandidates = bank.filter(q => String(q.difficulty).toLowerCase() === targetDiff);

      // Strategy 1: Unused + Different topic
      let matched = diffCandidates.find(q => !usedTitlesSet.has(q.title) && !usedTitlesSet.has(q.id) && !chosenTopics.has(q.topic));

      // Strategy 2: Unused (relax topic)
      if (!matched) {
        matched = diffCandidates.find(q => !usedTitlesSet.has(q.title) && !usedTitlesSet.has(q.id));
      }

      // Strategy 3: Controlled recycling if user exhausted difficulty pool
      if (!matched) {
        matched = diffCandidates.find(q => !existingQuestions.some(eq => eq.title === q.title) && !chosenTopics.has(q.topic));
      }
      if (!matched) {
        matched = diffCandidates.find(q => !existingQuestions.some(eq => eq.title === q.title)) || diffCandidates[0];
      }

      if (matched) {
        usedTitlesSet.add(matched.title);
        if (matched.topic) chosenTopics.add(matched.topic);

        const problemData = formatRealInterviewQuestion(matched, slot.orderIndex, slot.marks);
        const qDocData = {
          sessionId,
          userId,
          orderIndex: slot.orderIndex,
          title: problemData.title,
          description: problemData.description,
          difficulty: problemData.difficulty,
          marks: slot.marks,
          topic: problemData.topic || "DSA",
          category: problemData.category || "Algorithmic Problem Solving",
          constraints: problemData.constraints || [],
          inputFormat: problemData.inputFormat || "",
          outputFormat: problemData.outputFormat || "",
          examples: problemData.examples || [],
          starterCode: problemData.starterCode || {},
          functionSignature: problemData.functionSignature || "",
          supportedLanguages: ["python", "java", "cpp", "c"],
          visibleTestCases: problemData.visibleTestCases || [],
          hiddenTestCases: problemData.hiddenTestCases || [],
          source: problemData.source,
          generationMethod: "REAL_INTERVIEW_LOCAL_BANK",
          isFallback: false,
        };

        await idempotentUpsertQuestion(
          RealInterviewCodingQuestion,
          { sessionId, orderIndex: slot.orderIndex },
          qDocData
        );
        newlySelectedCount++;
      }
    }

    // Refetch current session questions from DB
    const finalQuestions = await RealInterviewCodingQuestion.find({ sessionId }).sort({ orderIndex: 1 });
    const count = finalQuestions.length;
    const expectedCount = 3;
    const roundComplete = count === 3;

    session.generationStatus = roundComplete ? "GENERATED" : (count > 0 ? "PARTIAL" : "FAILED");
    session.fallbackUsed = false;

    // Update problemScores in session
    session.problemScores = finalQuestions.map(q => ({
      questionId: q._id,
      orderIndex: q.orderIndex,
      title: q.title,
      difficulty: q.difficulty,
      maxMarks: q.marks,
      score: 0,
      status: "Not Attempted",
      passedTests: 0,
      totalTests: (q.visibleTestCases?.length || 0) + (q.hiddenTestCases?.length || 0)
    }));

    await session.save();

    if (userId && finalQuestions.length > 0) {
      await recordUserQuestionHistory({
        userId,
        sessionId,
        resumeHash: candidateProfile?.resumeHash,
        round: "coding",
        questions: finalQuestions.map((q) => ({
          id: q._id,
          question: `${q.title} - ${q.description}`.trim(),
        })),
      });
    }

    return {
      executionCompleted: true,
      generationSucceeded: roundComplete,
      fallbackUsed: false,
      roundComplete,
      count,
      expectedCount,
      status: roundComplete ? "COMPLETE" : "PARTIAL",
      completionSource: "REAL_INTERVIEW_LOCAL_BANK",
      success: roundComplete,
      recoverable: !roundComplete,
      generatedCount: count,
      totalRequired: expectedCount,
      nextQuestionNumber: count + 1,
      sessionId,
      questions: sanitizeQuestionsForClient(finalQuestions),
      reused: false,
      aiGenerationCalls: 0,
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
 */
export async function runCodingCode({ sessionId, questionId, language, sourceCode }) {
  if (!sessionId || !questionId || !language || !sourceCode) {
    throw new Error("sessionId, questionId, language, and sourceCode are required to run code.");
  }

  let qDoc = null;
  if (mongoose.Types.ObjectId.isValid(String(questionId))) {
    qDoc = await RealInterviewCodingQuestion.findById(questionId);
  }
  if (!qDoc) {
    qDoc = await RealInterviewCodingQuestion.findOne({ sessionId, $or: [{ _id: questionId }, { orderIndex: Number(questionId) }] });
  }
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

  const execResult = await executeJudge0TestSuite({
    sourceCode,
    language,
    testCases: visibleCases,
  });

  return {
    success: true,
    sessionId,
    questionId: qDoc._id,
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
 */
export async function submitCodingCode({ sessionId, questionId, language, sourceCode, userId = null }) {
  if (!sessionId || !questionId || !language || !sourceCode) {
    throw new Error("sessionId, questionId, language, and sourceCode are required to submit code.");
  }

  let session = await RealInterviewCodingSession.findOne({ sessionId });
  if (!session && mongoose.Types.ObjectId.isValid(String(sessionId))) {
    session = await RealInterviewCodingSession.findOne({ _id: sessionId });
  }
  if (!session) {
    throw new Error(`Coding Session not found for ID: ${sessionId}`);
  }

  let qDoc = null;
  if (mongoose.Types.ObjectId.isValid(String(questionId))) {
    qDoc = await RealInterviewCodingQuestion.findById(questionId);
  }
  if (!qDoc) {
    qDoc = await RealInterviewCodingQuestion.findOne({ sessionId, $or: [{ _id: questionId }, { orderIndex: Number(questionId) }] });
  }
  if (!qDoc) {
    throw new Error(`Coding Question not found for ID: ${questionId}`);
  }

  const allCases = [...(qDoc.visibleTestCases || []), ...(qDoc.hiddenTestCases || [])];
  const execResult = await executeJudge0TestSuite({
    sourceCode,
    language,
    testCases: allCases,
  });

  const totalTests = allCases.length;
  const passedTests = execResult.passed;
  const maxMarks = qDoc.marks;

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

    const maxMarks = qDoc.marks;
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
    evaluations: problemResults,
    fallbackUsed: session.fallbackUsed,
    aiGenerationCalls: session.aiGenerationCalls,
  };
}
