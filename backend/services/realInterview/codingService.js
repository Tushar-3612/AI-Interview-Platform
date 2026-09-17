import RealInterviewCodingQuestion from "../../models/RealInterviewCodingQuestion.js";
import RealInterviewCodingSession from "../../models/RealInterviewCodingSession.js";
import RealInterviewCodingSubmission from "../../models/RealInterviewCodingSubmission.js";
import CodingQuestion from "../../models/CodingQuestion.js";
import { loadCodingBank, normalizeCodingQuestion } from "../codingQuestionBank.js";
import { generateSingleCodingAI } from "../realInterviewAI/codingAI.js";
import { executeJudge0TestSuite } from "../judge0Service.js";
import { withInFlightLock } from "./inFlightLock.js";
import {
  getUserQuestionHistorySet,
  recordUserQuestionHistory,
} from "./questionHistoryService.js";
import { classifyInterviewAIError } from "./errorClassifier.js";
import { idempotentUpsertQuestion } from "../aiReliability/utils/mongoConnectionHelper.js";

let localCodingBankCache = null;

async function getFallbackCodingQuestion({ orderIndex, difficulty, marks, usedTitlesSet }) {
  const targetDiff = String(difficulty).toLowerCase();

  // 1. Try querying Mongoose CodingQuestion collection
  try {
    const dbCandidates = await CodingQuestion.find({
      isActive: { $ne: false },
      isDeleted: { $ne: true }
    }).lean();

    if (dbCandidates && dbCandidates.length > 0) {
      const match = dbCandidates.find(c => {
        const diff = String(c.difficulty || "").toLowerCase();
        const title = String(c.title || "").trim();
        const diffMatch = diff === targetDiff || (targetDiff === "hard" && (diff === "medium" || diff === "hard"));
        return diffMatch && !usedTitlesSet.has(title);
      });

      if (match) {
        return formatFallbackQuestion(match, orderIndex, difficulty, marks);
      }
    }
  } catch (err) {
    console.warn(`[CodingService] Mongoose CodingQuestion query failed: ${err.message}`);
  }

  // 2. Fall back to static JSON local bank load
  if (!localCodingBankCache) {
    try {
      const sources = loadCodingBank();
      localCodingBankCache = sources.flatMap(s => s.questions || []);
    } catch (e) {
      localCodingBankCache = [];
    }
  }

  if (localCodingBankCache && localCodingBankCache.length > 0) {
    const rawMatch = localCodingBankCache.find(raw => {
      const norm = normalizeCodingQuestion(raw);
      if (!norm || !norm.title) return false;
      const diff = String(norm.difficulty || "").toLowerCase();
      const title = String(norm.title).trim();
      const diffMatch = diff === targetDiff || (targetDiff === "hard" && (diff === "medium" || diff === "hard"));
      return diffMatch && !usedTitlesSet.has(title);
    });

    if (rawMatch) {
      const norm = normalizeCodingQuestion(rawMatch);
      return formatFallbackQuestion(norm, orderIndex, difficulty, marks);
    }
  }

  return null;
}

function formatFallbackQuestion(q, orderIndex, difficulty, marks) {
  const title = String(q.title || `Curated ${difficulty} Problem`).trim();
  const description = String(q.problemStatement || q.description || "Solve the algorithmic problem.").trim();

  const examples = Array.isArray(q.examples) && q.examples.length > 0
    ? q.examples.map(ex => ({ input: String(ex.input ?? ""), output: String(ex.output ?? ""), explanation: String(ex.explanation ?? "") }))
    : [{ input: String(q.sampleInput ?? "sample_input"), output: String(q.sampleOutput ?? "sample_output"), explanation: String(q.explanation ?? "") }];

  const testCases = Array.isArray(q.testCases) && q.testCases.length > 0
    ? q.testCases
    : [
        { input: "sample_input_1", expected: "sample_output_1", isHidden: false },
        { input: "sample_input_2", expected: "sample_output_2", isHidden: false },
        { input: "hidden_input_1", expected: "hidden_output_1", isHidden: true },
        { input: "hidden_input_2", expected: "hidden_output_2", isHidden: true },
        { input: "hidden_input_3", expected: "hidden_output_3", isHidden: true }
      ];

  const visibleTestCases = testCases.filter(tc => !tc.isHidden).slice(0, 2).map(tc => ({
    input: String(tc.input ?? ""),
    expected: String(tc.expectedOutput ?? tc.expected ?? ""),
    isHidden: false
  }));

  const hiddenTestCases = testCases.filter(tc => tc.isHidden).map(tc => ({
    input: String(tc.input ?? ""),
    expected: String(tc.expectedOutput ?? tc.expected ?? ""),
    isHidden: true
  }));

  return {
    orderIndex,
    title,
    description,
    difficulty: String(difficulty).charAt(0).toUpperCase() + String(difficulty).slice(1).toLowerCase(),
    marks,
    topic: q.category || "DSA",
    category: "Algorithmic Problem Solving",
    constraints: q.constraints ? (Array.isArray(q.constraints) ? q.constraints : [String(q.constraints)]) : ["1 <= N <= 10^5"],
    inputFormat: q.inputFormat || "Standard input",
    outputFormat: q.outputFormat || "Standard output",
    examples,
    starterCode: typeof q.starterCode === "object" && q.starterCode !== null ? q.starterCode : {
      python: String(q.starterCode || "def solution():\n    pass"),
      javascript: String(q.starterCode || "function solution() {\n}"),
      java: "public class Main {\n    public static void main(String[] args) {}\n}",
      cpp: "#include <iostream>\nusing namespace std;\nint main() { return 0; }"
    },
    functionSignature: "solution()",
    supportedLanguages: ["python", "javascript", "java", "cpp"],
    visibleTestCases: visibleTestCases.length > 0 ? visibleTestCases : [
      { input: "sample_1", expected: "expected_1", isHidden: false },
      { input: "sample_2", expected: "expected_2", isHidden: false }
    ],
    hiddenTestCases: hiddenTestCases.length > 0 ? hiddenTestCases : [
      { input: "hidden_1", expected: "hidden_1", isHidden: true },
      { input: "hidden_2", expected: "hidden_2", isHidden: true },
      { input: "hidden_3", expected: "hidden_3", isHidden: true }
    ],
    source: "CURATED_FALLBACK_BANK",
    generationMethod: "LOCAL_CODING_BANK",
    isFallback: true
  };
}

/**
 * 1. Generate & Process Coding Questions (ONE AI CALL PER MISSING SLOT)
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

    // If 3 valid questions already exist in DB, report roundComplete: true without rerunning AI
    if (existingQuestions.length === 3 && isFullyGenerated) {
      console.log(`[CodingService] Session ${sessionId} already fully GENERATED (3 problems). Reusing existing questions.`);
      if (session) {
        session.generationStatus = "GENERATED";
        await session.save();
      }
      return {
        executionCompleted: true,
        generationSucceeded: false, // Reused from DB, AI wasn't newly run
        fallbackUsed: Boolean(existingQuestions.some(q => q.source === "CURATED_FALLBACK_BANK" || q.isFallback)),
        roundComplete: true,
        count: 3,
        expectedCount: 3,
        status: "COMPLETE",
        completionSource: "EXISTING_DB",
        success: true,
        sessionId,
        questions: sanitizeQuestionsForClient(existingQuestions),
        reused: true,
        aiGenerationCalls: session ? session.aiGenerationCalls : 0,
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

    session.aiGenerationCalls += 1;
    await session.save();

    const requestId = `code_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    console.log(`\n[AI-REQUEST-START]\nround=coding\nsessionId=${sessionId}\nrequestId=${requestId}`);

    const userHistorySet = await getUserQuestionHistorySet(userId, candidateProfile?.resumeHash, "coding");
    const usedTitlesSet = new Set([...Array.from(userHistorySet), ...existingQuestions.map(q => q.title)]);

    const slots = [
      { orderIndex: 1, difficulty: "EASY", marks: 20 },
      { orderIndex: 2, difficulty: "MEDIUM", marks: 30 },
      { orderIndex: 3, difficulty: "HARD", marks: 50 },
    ];

    const missingSlots = slots.filter(s => !existingIndicesSet.has(s.orderIndex));
    let newlyGeneratedCount = 0;
    let fallbackUsedInRun = false;

    for (const slot of missingSlots) {
      let problemData = null;
      let isFallbackForSlot = false;

      // Try AI generation for single question
      try {
        problemData = await generateSingleCodingAI({
          orderIndex: slot.orderIndex,
          difficulty: slot.difficulty,
          marks: slot.marks,
          candidateProfile,
          userHistorySet,
          attempt: 1,
          options: { sessionId }
        });
        if (problemData && problemData.title) {
          newlyGeneratedCount++;
        }
      } catch (aiErr) {
        console.warn(`[CodingService] Single Coding AI generation failed for orderIndex=${slot.orderIndex}: ${aiErr.message}`);
      }

      // If AI generation failed, use local curated fallback bank
      if (!problemData || !problemData.title) {
        problemData = await getFallbackCodingQuestion({
          orderIndex: slot.orderIndex,
          difficulty: slot.difficulty,
          marks: slot.marks,
          usedTitlesSet
        });
        if (problemData) {
          isFallbackForSlot = true;
          fallbackUsedInRun = true;
          console.log(`[CodingService] Using curated local coding bank fallback for orderIndex=${slot.orderIndex} title="${problemData.title}"`);
        }
      }

      // If a valid question was obtained (either AI or Fallback), save immediately
      if (problemData && problemData.title) {
        usedTitlesSet.add(problemData.title);

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
          supportedLanguages: ["python", "javascript", "java", "cpp"],
          visibleTestCases: problemData.visibleTestCases || [],
          hiddenTestCases: problemData.hiddenTestCases || [],
          source: isFallbackForSlot ? "CURATED_FALLBACK_BANK" : "AI_GENERATED",
          generationMethod: isFallbackForSlot ? "LOCAL_CODING_BANK" : "SINGLE_AI_REQUEST",
          isFallback: isFallbackForSlot,
        };

        await idempotentUpsertQuestion(
          RealInterviewCodingQuestion,
          { sessionId, orderIndex: slot.orderIndex },
          qDocData
        );
      }
    }

    // Refetch current session questions from DB
    const finalQuestions = await RealInterviewCodingQuestion.find({ sessionId }).sort({ orderIndex: 1 });
    const count = finalQuestions.length;
    const expectedCount = 3;
    const roundComplete = count === 3;
    const hasAnyFallback = finalQuestions.some(q => q.source === "CURATED_FALLBACK_BANK" || q.isFallback);

    let completionSource = "NONE";
    if (roundComplete) {
      if (newlyGeneratedCount === missingSlots.length && !hasAnyFallback) {
        completionSource = "AI_GENERATED";
      } else if (hasAnyFallback && newlyGeneratedCount > 0) {
        completionSource = "MIXED";
      } else if (hasAnyFallback && newlyGeneratedCount === 0) {
        completionSource = "CURATED_FALLBACK_BANK";
      } else {
        completionSource = "AI_GENERATED";
      }
    } else if (count > 0) {
      completionSource = hasAnyFallback ? "MIXED" : "AI_GENERATED";
    }

    const generationSucceeded = roundComplete && !hasAnyFallback && newlyGeneratedCount === missingSlots.length;
    const status = roundComplete ? "COMPLETE" : (count > 0 ? "PARTIAL" : "FAILED");

    session.generationStatus = roundComplete ? "GENERATED" : (count > 0 ? "PARTIAL" : "FAILED");
    session.fallbackUsed = hasAnyFallback;

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

    console.log(`\n[AI-REQUEST-${roundComplete ? "SUCCESS" : "PARTIAL"}]\nround=coding\nrequestId=${requestId}\nquestionsCount=${count}/3\nstatus=${status}\ncompletionSource=${completionSource}`);

    return {
      executionCompleted: true,
      generationSucceeded,
      fallbackUsed: hasAnyFallback,
      roundComplete,
      count,
      expectedCount,
      status,
      completionSource,
      success: roundComplete,
      sessionId,
      questions: sanitizeQuestionsForClient(finalQuestions),
      reused: false,
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
    fallbackUsed: session.fallbackUsed,
    aiGenerationCalls: session.aiGenerationCalls,
  };
}
