import mongoose from "mongoose";
import Test from "../models/Test.js";
import TestAttempt from "../models/TestAttempt.js";
import {
  executeSingle,
  executeBatch,
  normalizeLanguage,
  isStdinLanguage,
  getSupportedLanguages,
  isLanguageSupported,
  getExecutionProviderInfo,
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
 * Shared code execution endpoint: POST /api/code/run
 * Runs student code against custom input (visible test cases only).
 * Used by both Coding Practice and Test Coding Round.
 */
export const runCode = async (req, res) => {
  try {
    const { language = "python", code = "", input = "" } = req.body;
    if (!code) return res.status(400).json({ message: "Code is required" });

    const langId = normalizeLanguage(language);
    if (!langId) {
      return res.json({
        type: "info",
        output: `Language "${language}" is not supported. Supported languages: ${getSupportedLanguages().join(", ")}.`,
        timeMs: 0,
        language,
      });
    }

    const result = isStdinLanguage(langId)
      ? await executeSingle(langId, code, [], { timeLimitMs: 1000, stdin: String(input ?? "") })
      : await executeSingle(langId, code, parseTestArgs(input, code), { timeLimitMs: 1000 });

    // Sanitized execution log (PART 19): never logs source code, stdout payload,
    // secrets, tokens or headers — only metadata useful for diagnostics.
    const logTail = (s) => (s ? String(s).replace(/\s+/g, " ").slice(0, 200) : "");
    console.log(
      `[Code Run] lang=${langId} status=${result.type} exit=${result.code} timeMs=${result.timeMs}` +
        (result.type !== "success" ? ` stderr="${logTail(result.output)}"` : "")
    );

    if (result.type !== "success") return res.json({ type: "error", output: String(result.output || ""), timeMs: result.timeMs, errorType: result.type });
    res.json({ type: "success", output: String(result.output ?? "").trim(), timeMs: result.timeMs });
  } catch (error) {
    console.error("Run Code Error:", error.message);
    res.status(500).json({ message: "Failed to run code" });
  }
};

/**
 * Shared code submission endpoint: POST /api/code/submit
 * Runs student code against ALL test cases (visible + hidden) from a question.
 * Used by both Coding Practice (CodingQuestion) and Test Coding Round (embedded questions).
 *
 * Body:
 *   language, code, timeTakenMs,
 *   questionSource: "codingQuestion" | "testQuestion",
 *   questionId (for codingQuestion), testId + questionIndex (for testQuestion)
 */
export const submitCode = async (req, res) => {
  try {
    const {
      language = "python",
      code = "",
      timeTakenMs = 0,
      questionSource = "codingQuestion",
      questionId,
      testId,
      questionIndex,
    } = req.body;

    if (!code) return res.status(400).json({ message: "Code is required" });

    let testCases = [];
    let timeLimit = 1000;
    let questionTitle = "";

    if (questionSource === "testQuestion") {
      if (!testId || questionIndex === undefined) {
        return res.status(400).json({ message: "testId and questionIndex are required for test questions" });
      }
      const test = await Test.findById(testId).lean();
      if (!test) return res.status(404).json({ message: "Test not found" });
      const question = test.questions[Number(questionIndex)];
      if (!question) return res.status(404).json({ message: "Question not found" });
      testCases = question.testCases || [];
      timeLimit = question.timeLimit || 1000;
      questionTitle = question.problemTitle || "Coding Problem";
    } else {
      if (!mongoose.Types.ObjectId.isValid(String(questionId))) {
        return res.status(400).json({ message: "Invalid question id" });
      }
      const CodingQuestion = (await import("../models/CodingQuestion.js")).default;
      const question = await CodingQuestion.findOne({ _id: questionId, isDeleted: { $ne: true } }).lean();
      if (!question) return res.status(404).json({ message: "Question not found" });
      testCases = question.testCases || [];
      timeLimit = question.timeLimit || 1000;
      questionTitle = question.title;
    }

    const langId = normalizeLanguage(language);
    if (!langId) {
      return res.status(400).json({
        message: `Language "${language}" is not supported. Supported languages: ${getSupportedLanguages().join(", ")}.`,
      });
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
        expected: tc.isHidden ? "" : String(tc.expected),
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
    const results = testCases.map((tc, index) => {
      const raw = String(batch.outputs[index] ?? "");
      let error = "";
      let actual = raw;
      if (raw.startsWith("__time_limit__:")) {
        error = `Time limit exceeded (${timeLimit}ms)`;
        actual = "";
      } else if (raw.startsWith("__runtime_error__:")) {
        error = raw.slice("__runtime_error__:".length);
        actual = "";
      }
      const passed = !error && normalizeOutput(raw) === normalizeOutput(tc.expected);
      if (passed) passedCount++;
      return {
        index: index + 1,
        passed,
        isHidden: Boolean(tc.isHidden),
        input: tc.isHidden ? "" : String(tc.input),
        expected: tc.isHidden ? "" : String(tc.expected),
        actual: passed ? "" : actual,
        error,
        timeMs: 0,
      };
    });
    const status = passedCount === testCases.length && testCases.length > 0 ? "accepted" : "failed";
    res.status(201).json({
      status,
      passedCount,
      totalCount: testCases.length,
      results,
      compileOutput: "",
      timeMs: batch.timeMs || 0,
    });
  } catch (error) {
    console.error("Submit Code Error:", error.message);
    res.status(500).json({ message: "Failed to submit code" });
  }
};

/**
 * Health check endpoint: GET /api/code/health
 * Reports Docker availability and status of all language runner images.
 */
export const healthCheck = async (req, res) => {
  try {
    const info = getExecutionProviderInfo();
    // Refresh image status on each health check
    const images = info.refreshImages ? info.refreshImages() : info.images;
    res.json({
      docker: info.docker,
      java: images.java || false,
      cpp: images.cpp || false,
      c: images.c || false,
      python: images.python || false,
    });
  } catch (error) {
    console.error("Health Check Error:", error.message);
    res.status(500).json({
      docker: false,
      java: false,
      cpp: false,
      c: false,
      python: false,
    });
  }
};
