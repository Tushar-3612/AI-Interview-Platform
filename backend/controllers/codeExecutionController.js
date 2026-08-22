import mongoose from "mongoose";
import Test from "../models/Test.js";
import CodingQuestion from "../models/CodingQuestion.js";
import CodingSubmission from "../models/CodingSubmission.js";
import {
  executeSingle,
  executeBatch,
  normalizeLanguage,
  isStdinLanguage,
  getSupportedLanguages,
  isLanguageSupported,
  getExecutionProviderInfo,
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

/**
 * Parse a single per-case output produced by executeBatch.
 * Returns the error type (or null when the case succeeded) and the message.
 */
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
 * Shared code execution endpoint: POST /api/code/run
 * Runs student code against custom input (visible test cases only).
 * Used by both Coding Practice and Test Coding Round.
 */
export const runCode = async (req, res) => {
  try {
    const { language = "cpp", code = "", input = "" } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({
        status: "error",
        message: "Code cannot be empty. Please write some code before running.",
      });
    }

    const langConfig = getJudge0Language(language);
    if (!langConfig) {
      return res.status(400).json({
        status: "error",
        message: `Language "${language}" is not supported. Supported languages: ${getSupportedJudge0Languages().map(l => l.name).join(", ")}.`,
      });
    }

    const result = await executeJudge0({
      sourceCode: code,
      language,
      stdin: input,
      cpuTimeLimit: 3.0,
      memoryLimit: 128000,
    });

    console.log(`[Judge0 Run] lang=${langConfig.slug} status=${result.status} time=${result.timeSeconds}s mem=${result.memoryKB}KB`);

    res.json({
      status: result.status,
      type: result.status === "success" ? "success" : "error",
      errorType: result.status,
      statusDescription: result.statusDescription,
      stdout: result.stdout,
      stderr: result.stderr,
      compileOutput: result.compileOutput,
      output: result.output,
      timeMs: result.timeMs,
      timeSeconds: result.timeSeconds,
      memoryKB: result.memoryKB,
      token: result.token,
    });
  } catch (error) {
    console.error("Run Code Error:", error.message);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to execute code on remote compiler.",
    });
  }
};

/**
 * Submit Code Endpoint: POST /api/code/submit
 * Runs candidate code against all question test cases via Judge0.
 * Calculates score percentage and saves submission record.
 */
export const submitCode = async (req, res) => {
  try {
    const {
      language = "cpp",
      code = "",
      timeTakenMs = 0,
      questionSource = "codingQuestion",
      questionId,
      interviewId = "",
      roundId = "coding",
      candidateId = "",
      testId,
      questionIndex,
      directTestCases = null,
      questionTitle: clientTitle = "",
    } = req.body;

    const userId = req.user?._id || req.user?.id || null;

    if (!code || !code.trim()) {
      return res.status(400).json({
        status: "error",
        message: "Code cannot be empty. Please write a solution before submitting.",
      });
    }

    let testCases = [];
    let questionTitle = clientTitle || "Coding Problem";
    let cpuTimeLimit = 2.0;
    let memoryLimit = 128000;

    // 1. Resolve test cases from Test, CodingQuestion, or direct payload
    if (directTestCases && Array.isArray(directTestCases) && directTestCases.length > 0) {
      testCases = directTestCases;
    } else if (questionSource === "testQuestion" && testId && questionIndex !== undefined) {
      const test = await Test.findById(testId).lean();
      if (!test) return res.status(404).json({ message: "Test not found" });
      const question = test.questions[Number(questionIndex)];
      if (!question) return res.status(404).json({ message: "Question not found" });
      testCases = question.testCases || [];
      questionTitle = question.problemTitle || questionTitle;
    } else if (questionId) {
      if (mongoose.Types.ObjectId.isValid(String(questionId))) {
        const question = await CodingQuestion.findOne({ _id: questionId, isDeleted: { $ne: true } }).lean();
        if (question) {
          testCases = question.testCases || [];
          questionTitle = question.title || questionTitle;
          cpuTimeLimit = (question.timeLimit || 1000) / 1000;
          memoryLimit = (question.memoryLimit || 256) * 1024;
        }
      }
    }

    // Default sample test cases if question had no DB testcases configured
    if (!testCases || testCases.length === 0) {
      testCases = [
        { input: "3 5", expected: "8", isHidden: false },
        { input: "10 20", expected: "30", isHidden: false },
        { input: "100 200", expected: "300", isHidden: true },
      ];
    }

    const casePayloads = isStdinLanguage(langId)
      ? testCases.map((tc) => String(tc.input ?? ""))
      : testCases.map((tc) => parseTestArgs(tc.input, code));

    const batch = await executeBatch(langId, code, casePayloads, { timeLimitMs: timeLimit });

    if (batch.type !== "success" || !batch.outputs || batch.outputs.length !== testCases.length) {
      const errorMsg = batch.type === "time_limit"
        ? `Time limit exceeded (${timeLimit}ms)`
        : String(batch.output || batch.type || "Execution failed").trim();
      const results = testCases.map((tc, index) => ({
        index: index + 1,
        passed: false,
        isHidden: Boolean(tc.isHidden),
        input: tc.isHidden ? "" : String(tc.input),
        expected: tc.isHidden ? "" : String(tc.expected ?? tc.output ?? tc.expectedOutput ?? ""),
        actual: "",
        error: errorMsg,
        timeMs: 0,
      }));
      const status = batch.type === "time_limit" ? "time_limit" : batch.type === "compile_error" ? "compile_error" : batch.type === "execution_error" ? "execution_error" : "failed";
      return res.status(201).json({
        status,
        passedCount: 0,
        totalCount: testCases.length,
        results,
        compileOutput: batch.type === "compile_error" || batch.type === "execution_error" ? errorMsg : "",
        timeMs: 0,
      });
    }

    let passedCount = 0;
    let compileOutput = "";
    const results = testCases.map((tc, index) => {
      const raw = String(batch.outputs[index] ?? "");
      const { errorType, message, actual } = parseCaseMarker(raw);
      const expected = String(tc.expected ?? tc.output ?? tc.expectedOutput ?? "");
      const passed = !errorType && compareOutputs(actual, expected, COMPARISON_MODES.TOKEN);

      if (errorType === "compile_error" || errorType === "execution_error") {
        if (!compileOutput) compileOutput = message;
      }
      if (passed) passedCount++;

      let displayError = "";
      if (errorType === "time_limit") displayError = `Time limit exceeded (${timeLimit}ms)`;
      else if (errorType) displayError = message;

      return {
        index: index + 1,
        passed,
        isHidden: Boolean(tc.isHidden),
        input: tc.isHidden ? "" : String(tc.input),
        expected: tc.isHidden ? "" : expected,
        actual: passed || errorType ? "" : actual,
        error: displayError,
        timeMs: 0,
      };
    });

    // 3. Persist submission record in database
    let savedSubmission = null;
    try {
      savedSubmission = await CodingSubmission.create({
        userId,
        candidateId: candidateId || (userId ? String(userId) : ""),
        interviewId,
        roundId,
        questionId: questionId || `Q-${questionIndex || 1}`,
        title: questionTitle,
        language,
        code,
        status: suiteResult.status === "completed" ? "accepted" : suiteResult.status === "compile_error" ? "compile_error" : "failed",
        passedCount: suiteResult.passed,
        totalCount: suiteResult.total,
        score: suiteResult.score,
        executionTime: suiteResult.executionTime,
        memory: suiteResult.memory,
        compileOutput: suiteResult.compileOutput || "",
        results: suiteResult.testResults,
        timeTakenMs,
      });
    } catch (saveErr) {
      console.warn("Failed to persist submission record:", saveErr.message);
    }

    res.status(201).json({
      status,
      passedCount,
      totalCount: testCases.length,
      results,
      compileOutput,
      timeMs: batch.timeMs || 0,
    });
  } catch (error) {
    console.error("Submit Code Error:", error.message);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to evaluate code submission.",
    });
  }
};

/**
 * Get Submission by ID: GET /api/code/submission/:id
 */
export const getSubmissionById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid submission ID" });
    }

    const submission = await CodingSubmission.findById(id).lean();
    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    res.json(submission);
  } catch (error) {
    console.error("Get Submission Error:", error.message);
    res.status(500).json({ message: "Failed to retrieve submission" });
  }
};

/**
 * Get Supported Languages: GET /api/code/languages
 */
export const getLanguages = (req, res) => {
  res.json({
    languages: getSupportedJudge0Languages(),
  });
};

/**
 * Health Check Endpoint: GET /api/code/health
 */
export const getHealth = (req, res) => {
  res.json({
    status: "ok",
    provider: "judge0",
    engine: "Judge0 Hosted Online Sandbox",
    languages: getSupportedJudge0Languages().map((l) => l.name),
  });
};

export const healthCheck = getHealth;

