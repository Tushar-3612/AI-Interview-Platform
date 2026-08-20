import TestAttempt from "../models/TestAttempt.js";
import TestAssignment from "../models/TestAssignment.js";
import User from "../models/User.js";
import TestResult from "../models/TestResult.js";
import { calculateGrade, calculatePassFail, computePassingMarks } from "../utils/gradeCalculator.js";
import {
  buildQuestionResult,
  computeSectionSummary,
  computeOverallSummary,
} from "../utils/scoringEngine.js";
import { computeRankings } from "../utils/rankingEngine.js";
import {
  executeBatch,
  normalizeLanguage,
  isStdinLanguage,
  compareOutputs,
  COMPARISON_MODES,
} from "../services/codeExecutionService.js";

function findFunctionName(code) {
  const match = String(code).match(/(?:function\s+|const\s+|let\s+|var\s+)([A-Za-z_$][\w$]*)/);
  return match ? match[1] : "solution";
}

function countFunctionParams(code) {
  const fnName = findFunctionName(code);
  if (!fnName) return -1;
  const name = fnName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp("function\\s+" + name + "\\s*\\(([^)]*)\\)"),
    new RegExp("(?:const|let|var)\\s+" + name + "\\s*=\\s*(?:async\\s*)?\\(([^)]*)\\)\\s*=>"),
    new RegExp("(?:const|let|var)\\s+" + name + "\\s*=\\s*(?:async\\s*)?([A-Za-z_$][\\w$]*)\\s*=>"),
    new RegExp("\\b" + name + "\\s*\\(([^)]*)\\)\\s*\\{"),
  ];
  for (const pattern of patterns) {
    const match = String(code).match(pattern);
    if (match) {
      const params = match[1].split(",").map((p) => p.trim()).filter((p) => p && !p.startsWith("..."));
      return params.length;
    }
  }
  return -1;
}

function splitTopLevelArgs(input) {
  const groups = [];
  let depth = 0;
  let current = "";
  let inString = false;
  let escape = false;
  for (const ch of String(input)) {
    if (inString) {
      current += ch;
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      current += ch;
      continue;
    }
    if (ch === "[" || ch === "(" || ch === "{") depth++;
    if (ch === "]" || ch === ")" || ch === "}") depth--;
    if (ch === "," && depth === 0) {
      groups.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) groups.push(current);
  return groups;
}

function isScalar(value) {
  return value === null || ["number", "string", "boolean"].includes(typeof value);
}

function parseTestArgs(input, code) {
  const cleaned = String(input || "").trim();
  if (!cleaned) return [];
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      const paramCount = code ? countFunctionParams(code) : -1;
      if (parsed.length === 1 && isScalar(parsed[0])) return parsed;
      if (paramCount === 1) return [parsed];
      return parsed;
    }
    return [parsed];
  } catch {
    const groups = splitTopLevelArgs(cleaned);
    if (groups.length === 0) return [];
    return groups.map((group) => {
      try {
        return JSON.parse(group);
      } catch {
        return group.replace(/^["']|["']$/g, "");
      }
    });
  }
}

function normalizeOutput(value) {
  if (value == null) return "";
  try {
    return JSON.stringify(JSON.parse(value));
  } catch {
    return String(value).trim();
  }
}

function parseCaseMarker(raw) {
  const markers = [
    ["__compile_error__:", "compile_error"],
    ["__execution_error__:", "execution_error"],
    ["__memory_limit__:", "memory_limit"],
    ["__time_limit__:", "time_limit"],
    ["__runtime_error__:", "runtime_error"],
    ["__error__:skipped:", "skipped"],
  ];
  for (const [prefix, type] of markers) {
    if (raw.startsWith(prefix)) {
      return { errorType: type, message: raw.slice(prefix.length), actual: "" };
    }
  }
  return { errorType: null, message: "", actual: raw };
}

/**
 * Execute a coding question's code against its test cases.
 * Returns { passedCount, totalCount, results, status, executionTime }
 */
export async function evaluateCodingQuestion(code, language, testCases, timeLimit = 2000) {
  if (!code || !language || !testCases || testCases.length === 0) {
    return { passedCount: 0, totalCount: testCases?.length || 0, results: [], status: "skipped", executionTime: 0 };
  }

  const langId = normalizeLanguage(language);
  if (!langId) {
    return {
      passedCount: 0,
      totalCount: testCases.length,
      results: testCases.map((tc, i) => ({
        index: i + 1,
        passed: false,
        isHidden: Boolean(tc.isHidden),
        error: `Unsupported language: ${language}`,
      })),
      status: "failed",
      executionTime: 0,
    };
  }

  const startTime = Date.now();

  const casePayloads = isStdinLanguage(langId)
    ? testCases.map((tc) => String(tc.input ?? ""))
    : testCases.map((tc) => parseTestArgs(tc.input, code));

  try {
    const batch = await executeBatch(langId, code, casePayloads, { timeLimitMs: timeLimit });

    if (batch.type !== "success" || !batch.outputs || batch.outputs.length !== testCases.length) {
      const errorMsg = batch.type === "time_limit"
        ? "Time limit exceeded"
        : String(batch.output || batch.type || "Execution failed").trim();
      return {
        passedCount: 0,
        totalCount: testCases.length,
        results: testCases.map((tc, i) => ({
          index: i + 1,
          passed: false,
          isHidden: Boolean(tc.isHidden),
          error: errorMsg,
        })),
        status: batch.type === "compile_error" ? "compile_error" : "failed",
        executionTime: Date.now() - startTime,
      };
    }

    let passedCount = 0;
    let overallError = null;
    const results = testCases.map((tc, index) => {
      const raw = String(batch.outputs[index] ?? "");
      const { errorType, message, actual } = parseCaseMarker(raw);
      const expected = String(tc.expected ?? tc.output ?? tc.expectedOutput ?? "");
      const passed = !errorType && compareOutputs(actual, expected, COMPARISON_MODES.TOKEN);
      if (errorType === "compile_error" || errorType === "execution_error") {
        if (!overallError) overallError = { type: errorType, message };
      }
      if (passed) passedCount++;
      let displayError = "";
      if (errorType === "time_limit") displayError = "Time limit exceeded";
      else if (errorType) displayError = message;
      return { index: index + 1, passed, isHidden: Boolean(tc.isHidden), error: displayError };
    });
    const status = overallError
      ? (overallError.type === "compile_error" ? "compile_error" : "failed")
      : passedCount === testCases.length
        ? "accepted"
        : "failed";
    return { passedCount, totalCount: testCases.length, results, status, executionTime: Date.now() - startTime };
  } catch (err) {
    return {
      passedCount: 0,
      totalCount: testCases.length,
      results: testCases.map((tc, i) => ({
        index: i + 1,
        passed: false,
        isHidden: Boolean(tc.isHidden),
        error: String(err.message),
      })),
      status: "failed",
      executionTime: Date.now() - startTime,
    };
  }
}

export async function processResult(attemptId) {
  const existing = await TestResult.findOne({ attemptId });
  if (existing) {
    return { result: existing, isNew: false };
  }

  const attempt = await TestAttempt.findById(attemptId)
    .populate("testId")
    .lean();
  if (!attempt) {
    throw new Error("Attempt not found");
  }

  if (attempt.status !== "completed" && attempt.status !== "auto_submitted") {
    throw new Error("Attempt is not completed yet");
  }

  const test = attempt.testId;
  if (!test) {
    throw new Error("Test not found");
  }

  const user = await User.findById(attempt.userId).lean();
  if (!user) {
    throw new Error("User not found");
  }

  const questionResults = [];
  const sectionMap = {};

  for (const answerEntry of attempt.answers) {
    const question = test.questions[answerEntry.questionIndex];
    if (!question) continue;

    const qr = buildQuestionResult(question, answerEntry, attempt.startTime, attempt.endTime);

    // Execute coding questions against test cases
    if (question.type === "Coding" && answerEntry.code && answerEntry.language) {
      try {
        const testCases = question.testCases || [];
        if (testCases.length > 0) {
          const evalResult = await evaluateCodingQuestion(
            answerEntry.code,
            answerEntry.language,
            testCases,
            question.timeLimit || 2000
          );

          qr.codingResult = {
            language: answerEntry.language || "",
            code: answerEntry.code || "",
            compilationStatus: evalResult.status === "compile_error" ? "error" : "success",
            executionStatus: evalResult.status === "accepted" ? "passed" : evalResult.status === "skipped" ? "pending" : "failed",
            visibleTestCasesPassed: evalResult.results.filter((r) => !r.isHidden && r.passed).length,
            visibleTestCasesTotal: testCases.filter((tc) => !tc.isHidden).length,
            hiddenTestCasesPassed: evalResult.results.filter((r) => r.isHidden && r.passed).length,
            hiddenTestCasesTotal: testCases.filter((tc) => tc.isHidden).length,
            executionTime: evalResult.executionTime,
            memoryUsage: 0,
            marksObtained: 0,
          };

          // Calculate marks based on test case results
          const totalCases = evalResult.totalCount;
          const passedCases = evalResult.passedCount;
          if (totalCases > 0) {
            const marksRatio = passedCases / totalCases;
            const earnedMarks = Math.round((question.marks || 10) * marksRatio);
            qr.obtainedMarks = earnedMarks;
            qr.codingResult.marksObtained = earnedMarks;
            qr.status = passedCases === totalCases ? "correct" : passedCases > 0 ? "partial" : "wrong";
          }
        }
      } catch (err) {
        console.error(`Coding evaluation error for question ${answerEntry.questionIndex}:`, err.message);
        qr.codingResult = {
          language: answerEntry.language || "",
          code: answerEntry.code || "",
          compilationStatus: "error",
          executionStatus: "error",
          visibleTestCasesPassed: 0,
          visibleTestCasesTotal: (question.testCases || []).filter((tc) => !tc.isHidden).length,
          hiddenTestCasesPassed: 0,
          hiddenTestCasesTotal: (question.testCases || []).filter((tc) => tc.isHidden).length,
          executionTime: 0,
          memoryUsage: 0,
          marksObtained: 0,
        };
      }
    }

    questionResults.push(qr);

    const subject = question.subject || "general";
    if (!sectionMap[subject]) sectionMap[subject] = [];
    sectionMap[subject].push(qr);
  }

  const overall = computeOverallSummary(questionResults);

  const sections = Object.entries(sectionMap).map(([sectionName, qResults]) =>
    computeSectionSummary(sectionName, qResults)
  );

  const passingPercentage = Number(test.passingMarks) || 0;
  const passingMarks = computePassingMarks(overall.totalMarks, passingPercentage);
  const passed = calculatePassFail(overall.obtainedMarks, passingMarks);
  const grade = calculateGrade(overall.percentage);

  const timeTaken = attempt.startTime && attempt.submittedAt
    ? Math.round((new Date(attempt.submittedAt) - new Date(attempt.startTime)) / 1000)
    : 0;

  const audit = {
    startedAt: attempt.startTime || undefined,
    submittedAt: attempt.submittedAt || undefined,
    timeTaken,
    autoSubmitted: attempt.status === "auto_submitted",
    autoSubmitReason: attempt.autoSubmitReason || "",
    tabSwitchCount: attempt.tabSwitchCount || 0,
    browserCloseDetected: false,
    networkFailureDetected: false,
  };

  const testResult = new TestResult({
    attemptId: attempt._id,
    testId: test._id,
    userId: attempt.userId,

    audit,

    totalQuestions: overall.totalQuestions,
    attempted: overall.attempted,
    correct: overall.correct,
    wrong: overall.wrong,
    skipped: overall.skipped,
    notVisited: overall.notVisited,
    pendingEvaluation: overall.pendingEvaluation,
    totalMarks: overall.totalMarks,
    obtainedMarks: overall.obtainedMarks,
    percentage: overall.percentage,
    passed,
    passingMarks,
    passingPercentage,
    grade,

    questions: questionResults,
    sections,

    studentInfo: {
      name: user.name || "",
      email: user.email || "",
      department: user.department || "",
      year: user.year || "",
    },

    processedAt: new Date(),
    processingVersion: "1.0",
    aiEvaluationReady: false,
    aiEvaluationDone: false,
  });

  await testResult.save();

  await TestAssignment.findByIdAndUpdate(attempt.assignmentId, {
    $inc: { completedCount: 0 },
    averageScore: overall.obtainedMarks,
  });

  const ranking = await computeRankings(
    test._id,
    attempt.userId,
    user.department || "",
    TestResult
  );
  testResult.ranking = ranking;
  await testResult.save();

  return { result: testResult, isNew: true };
}
