import mongoose from "mongoose";
import Test from "../models/Test.js";
import CodingQuestion from "../models/CodingQuestion.js";
import CodingSubmission from "../models/CodingSubmission.js";
import {
  executeJudge0,
  executeJudge0TestSuite,
  getSupportedJudge0Languages,
  getJudge0Language,
} from "../services/judge0Service.js";

/**
 * Run Code Endpoint: POST /api/code/run
 * Runs candidate code against custom stdin input via Judge0.
 * Does NOT calculate final interview score.
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

    // 2. Execute test suite through Judge0
    const suiteResult = await executeJudge0TestSuite({
      sourceCode: code,
      language,
      testCases,
      cpuTimeLimit,
      memoryLimit,
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
      submissionId: savedSubmission?._id || null,
      status: suiteResult.status,
      passed: suiteResult.passed,
      total: suiteResult.total,
      score: suiteResult.score,
      execution_time: suiteResult.executionTime,
      memory: suiteResult.memory,
      compileOutput: suiteResult.compileOutput,
      test_results: suiteResult.testResults,
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

