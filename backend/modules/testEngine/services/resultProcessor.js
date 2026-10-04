import TestAttempt from "../models/TestAttempt.js";
import TestAssignment from "../models/TestAssignment.js";
import User from "../../auth/models/User.js";
import TestResult from "../models/TestResult.js";
import { calculateGrade, calculatePassFail, computePassingMarks } from "../utils/gradeCalculator.js";
import {
  buildQuestionResult,
  computeSectionSummary,
  computeOverallSummary,
} from "../utils/scoringEngine.js";
import { computeRankings } from "../utils/rankingEngine.js";
import {
  executeJudge0TestSuite,
  prepareExecutionInput,
  getTestCaseExpectedOutput,
} from "../../codingAssessment/services/judge0Service.js";

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
 * Execute a coding question's code against its test cases via Judge0.
 * Returns { passedCount, totalCount, results, status, executionTime }
 */
export async function evaluateCodingQuestion(code, language, testCases, timeLimit = 2000) {
  if (!code || !language || !testCases || testCases.length === 0) {
    return { passedCount: 0, totalCount: testCases?.length || 0, results: [], status: "skipped", executionTime: 0 };
  }

  try {
    const formattedTestCases = testCases.map((tc) => ({
      input: prepareExecutionInput(tc.input ?? tc.stdin ?? ""),
      expected: getTestCaseExpectedOutput(tc),
      isHidden: Boolean(tc.isHidden),
    }));

    const suiteResult = await executeJudge0TestSuite({
      sourceCode: code,
      language,
      testCases: formattedTestCases,
      cpuTimeLimit: Math.max(1.0, (Number(timeLimit) || 2000) / 1000),
      memoryLimit: 128000,
    });

    const isAllPassed = suiteResult.passed === suiteResult.total && suiteResult.total > 0;
    return {
      passedCount: suiteResult.passed,
      totalCount: suiteResult.total,
      results: (suiteResult.testResults || []).map((r) => ({
        index: r.index,
        passed: r.passed,
        isHidden: r.isHidden,
        error: r.error || "",
      })),
      status: suiteResult.status === "compile_error" ? "compile_error" : (isAllPassed ? "accepted" : "failed"),
      executionTime: Math.round(Number(suiteResult.executionTime || 0) * 1000),
      compileOutput: suiteResult.compileOutput || "",
    };
  } catch (err) {
    console.error("evaluateCodingQuestion Judge0 error:", err.message);
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
      executionTime: 0,
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

  const user = (await User.findById(attempt.userId).lean()) || {};

  const questionResults = [];
  const sectionMap = {};

  for (const answerEntry of attempt.answers) {
    const question = test.questions[answerEntry.questionIndex];
    if (!question) continue;

    const qr = buildQuestionResult(question, answerEntry, attempt.startTime, attempt.endTime);

    // Execute coding questions against test cases
    if (question.type === "Coding" || question.problemTitle) {
      const codeText = (answerEntry.code || answerEntry.answer || "").trim();
      const lang = answerEntry.language || "python";
      const testCases = (question.testCases && question.testCases.length > 0)
        ? question.testCases
        : (question.sampleInput || question.sampleOutput)
        ? [{ input: question.sampleInput, expected: question.sampleOutput, isHidden: false }]
        : [];
      const qMarks = question.marks || 10;

      if (codeText && testCases.length > 0) {
        try {
          const evalResult = await evaluateCodingQuestion(
            codeText,
            lang,
            testCases,
            question.timeLimit || 2000
          );

          const totalCases = evalResult.totalCount || testCases.length;
          const passedCases = evalResult.passedCount || 0;
          let earnedMarks = 0;
          if (totalCases > 0) {
            earnedMarks = Math.round((passedCases / totalCases) * qMarks);
          }

          // Fallback if live evaluation failed (e.g. timeout/offline) but candidate had scored marks from previous IDE submission
          if (earnedMarks === 0 && (answerEntry.scoredMarks > 0 || answerEntry.codingScore > 0)) {
            earnedMarks = answerEntry.scoredMarks || Math.round(((answerEntry.codingScore || 0) / 100) * qMarks);
          }

          qr.obtainedMarks = earnedMarks;
          qr.status = (passedCases === totalCases && totalCases > 0) || (earnedMarks === qMarks) ? "correct" : (earnedMarks > 0 ? "wrong" : "wrong");

          qr.codingResult = {
            language: lang,
            code: codeText,
            compilationStatus: evalResult.status === "compile_error" ? "error" : "success",
            executionStatus: (passedCases === totalCases && totalCases > 0) || (earnedMarks === qMarks) ? "passed" : (evalResult.status === "compile_error" ? "error" : "failed"),
            visibleTestCasesPassed: evalResult.results?.filter((r) => !r.isHidden && r.passed).length ?? passedCases,
            visibleTestCasesTotal: testCases.filter((tc) => !tc.isHidden).length,
            hiddenTestCasesPassed: evalResult.results?.filter((r) => r.isHidden && r.passed).length ?? 0,
            hiddenTestCasesTotal: testCases.filter((tc) => tc.isHidden).length,
            executionTime: evalResult.executionTime || 0,
            memoryUsage: 0,
            marksObtained: earnedMarks,
          };
        } catch (err) {
          console.error(`Coding evaluation error for question ${answerEntry.questionIndex}:`, err.message);
          const earnedMarks = answerEntry.scoredMarks || 0;
          qr.obtainedMarks = earnedMarks;
          qr.status = earnedMarks > 0 ? (earnedMarks === qMarks ? "correct" : "wrong") : "wrong";
          qr.codingResult = {
            language: lang,
            code: codeText,
            compilationStatus: "error",
            executionStatus: "error",
            visibleTestCasesPassed: answerEntry.passedCount || 0,
            visibleTestCasesTotal: testCases.filter((tc) => !tc.isHidden).length,
            hiddenTestCasesPassed: 0,
            hiddenTestCasesTotal: testCases.filter((tc) => tc.isHidden).length,
            executionTime: 0,
            memoryUsage: 0,
            marksObtained: earnedMarks,
          };
        }
      } else if (codeText) {
        // No test cases configured on question, but code was submitted
        const earnedMarks = answerEntry.scoredMarks || 0;
        qr.obtainedMarks = earnedMarks;
        qr.status = earnedMarks > 0 ? "correct" : "wrong";
        qr.codingResult = {
          language: lang,
          code: codeText,
          compilationStatus: "success",
          executionStatus: "passed",
          visibleTestCasesPassed: 0,
          visibleTestCasesTotal: 0,
          hiddenTestCasesPassed: 0,
          hiddenTestCasesTotal: 0,
          executionTime: 0,
          memoryUsage: 0,
          marksObtained: earnedMarks,
        };
      }
    }

    questionResults.push(qr);

    const subject = question.subject || (question.type === "Coding" || question.problemTitle ? "Coding" : "General");
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
    totalAwayTimeSeconds: attempt.totalAwayTimeSeconds || 0,
    browserCloseDetected: !!attempt.browserCloseDetected,
    networkFailureDetected: !!attempt.networkFailureDetected,
    integrityEvents: (attempt.integrityEvents || []).map((e) => ({
      eventType: e.eventType,
      timestamp: e.timestamp,
      durationSeconds: e.durationSeconds || 0,
      details: e.details || {},
    })),
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

  if (attempt.assignmentId) {
    try {
      await TestAssignment.findByIdAndUpdate(attempt.assignmentId, {
        $inc: { completedCount: 0 },
        averageScore: overall.obtainedMarks,
      });
    } catch (assignErr) {
      console.warn("Assignment update warning in resultProcessor:", assignErr.message);
    }
  }

  try {
    const ranking = await computeRankings(
      test._id,
      attempt.userId,
      user.department || "",
      TestResult
    );
    testResult.ranking = ranking;
    await testResult.save();
  } catch (rankErr) {
    console.warn("Ranking compute warning in resultProcessor:", rankErr.message);
  }

  return { result: testResult, isNew: true };
}
