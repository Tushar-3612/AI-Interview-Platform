import mongoose from "mongoose";
import Test from "../../testEngine/models/Test.js";
import CodingQuestion from "../models/CodingQuestion.js";
import CodingTestCase from "../models/CodingTestCase.js";
import CodingSubmission from "../models/CodingSubmission.js";
import {
  executeJudge0,
  executeJudge0TestSuite,
  getSupportedJudge0Languages,
  getJudge0Language,
  prepareExecutionInput,
  getTestCaseExpectedOutput,
  compareOutputs,
} from "../services/judge0Service.js";

/**
 * Shared code execution endpoint: POST /api/code/run
 * Runs student code against testcase input or custom stdin input via Judge0.
 * Used by Coding Assessment, Assigned Test Engine, and Practice IDE.
 */
export const runCode = async (req, res) => {
  try {
    const {
      language = "cpp",
      code = "",
      input = null,
      expectedOutput = null,
      testCase = null,
      directTestCases = null,
      questionId = null,
      testId = null,
      questionIndex = null,
      selectedTestCaseIndex = 0,
      questionSource = "testQuestion",
    } = req.body;

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
        message: `Language "${language}" is not supported. Supported languages: ${getSupportedJudge0Languages().map((l) => l.name).join(", ")}.`,
      });
    }

    // Resolve stdin and expected output from payload or DB
    let resolvedInput = input;
    let resolvedExpected = expectedOutput;

    if (resolvedInput === null || resolvedInput === undefined) {
      if (testCase && (testCase.input !== undefined || testCase.stdin !== undefined)) {
        resolvedInput = testCase.input ?? testCase.stdin ?? "";
        resolvedExpected = resolvedExpected ?? getTestCaseExpectedOutput(testCase);
      } else if (directTestCases && Array.isArray(directTestCases) && directTestCases.length > 0) {
        const tc = directTestCases[Number(selectedTestCaseIndex) || 0] || directTestCases[0];
        resolvedInput = tc?.input ?? tc?.stdin ?? "";
        resolvedExpected = resolvedExpected ?? getTestCaseExpectedOutput(tc);
      } else if (testId && questionIndex !== undefined) {
        const test = await Test.findById(testId).lean();
        const q = test?.questions?.[Number(questionIndex)];
        if (q) {
          const tc = (q.testCases || [])[Number(selectedTestCaseIndex) || 0] || (q.testCases || [])[0];
          resolvedInput = tc?.input ?? q.sampleInput ?? "";
          resolvedExpected = resolvedExpected ?? getTestCaseExpectedOutput(tc) ?? q.sampleOutput ?? "";
        }
      } else if (questionId) {
        if (mongoose.Types.ObjectId.isValid(String(questionId))) {
          const [question, dbTestCases] = await Promise.all([
            CodingQuestion.findOne({ _id: questionId, isDeleted: { $ne: true } }).lean(),
            CodingTestCase.find({ questionId }).lean(),
          ]);
          if (dbTestCases && dbTestCases.length > 0) {
            const tc = dbTestCases[Number(selectedTestCaseIndex) || 0] || dbTestCases[0];
            resolvedInput = tc?.input ?? "";
            resolvedExpected = resolvedExpected ?? getTestCaseExpectedOutput(tc);
          } else if (question) {
            const tc = (question.testCases || [])[Number(selectedTestCaseIndex) || 0] || (question.testCases || [])[0];
            resolvedInput = tc?.input ?? question.sampleInput ?? question.examples?.[0]?.input ?? "";
            resolvedExpected = resolvedExpected ?? getTestCaseExpectedOutput(tc) ?? question.sampleOutput ?? question.examples?.[0]?.output ?? "";
          }
        }
      }
    }

    const preparedStdin = prepareExecutionInput(resolvedInput ?? "");

    const result = await executeJudge0({
      sourceCode: code,
      language,
      stdin: preparedStdin,
      cpuTimeLimit: 3.0,
      memoryLimit: 128000,
    });

    const isMatch = resolvedExpected ? compareOutputs(result.stdout, resolvedExpected) : null;
    let runStatus = result.status;
    if (result.status === "success" && resolvedExpected && isMatch === false) {
      runStatus = "wrong_answer";
    }

    console.log(`[Judge0 Run] lang=${langConfig.slug} status=${runStatus} time=${result.timeSeconds}s mem=${result.memoryKB}KB stdinLen=${preparedStdin.length}`);

    res.json({
      status: runStatus,
      type: result.status === "success" ? (isMatch === false ? "wrong_answer" : "success") : "error",
      errorType: result.status,
      statusDescription: result.statusDescription,
      stdout: result.stdout,
      stderr: result.stderr,
      compileOutput: result.compileOutput,
      output: result.output,
      input: preparedStdin,
      expectedOutput: resolvedExpected || "",
      passed: isMatch,
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
      approach = "",
      questionSource = "codingQuestion",
      questionId,
      interviewId = "",
      roundId = "coding",
      candidateId = "",
      testId,
      questionIndex,
      directTestCases = null,
      questionTitle: clientTitle = "",
      timeTakenMs = 0,
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

    // 1. Resolve test cases from Test, CodingQuestion, CodingTestCase, or direct payload
    if (directTestCases && Array.isArray(directTestCases) && directTestCases.length > 0) {
      testCases = directTestCases.map((tc) => ({
        input: prepareExecutionInput(tc.input ?? tc.stdin),
        expected: getTestCaseExpectedOutput(tc),
        isHidden: Boolean(tc.isHidden),
      }));
    } else if ((questionSource === "testQuestion" || testId) && testId && questionIndex !== undefined) {
      const test = await Test.findById(testId).lean();
      if (!test) return res.status(404).json({ message: "Test not found" });
      const question = test.questions[Number(questionIndex)];
      if (!question) return res.status(404).json({ message: "Question not found" });
      questionTitle = question.problemTitle || question.question || questionTitle;
      testCases = (question.testCases || []).map((tc) => ({
        input: prepareExecutionInput(tc.input),
        expected: getTestCaseExpectedOutput(tc),
        isHidden: Boolean(tc.isHidden),
      }));
      if (testCases.length === 0 && (question.sampleInput || question.sampleOutput)) {
        testCases = [
          {
            input: prepareExecutionInput(question.sampleInput),
            expected: String(question.sampleOutput || ""),
            isHidden: false,
          },
        ];
      }
    } else if (questionId) {
      if (mongoose.Types.ObjectId.isValid(String(questionId))) {
        const [question, dbTestCases] = await Promise.all([
          CodingQuestion.findOne({ _id: questionId, isDeleted: { $ne: true } }).lean(),
          CodingTestCase.find({ questionId }).lean(),
        ]);
        if (dbTestCases && dbTestCases.length > 0) {
          testCases = dbTestCases.map((tc) => ({
            input: prepareExecutionInput(tc.input),
            expected: getTestCaseExpectedOutput(tc),
            isHidden: !tc.isSample,
          }));
        } else if (question) {
          questionTitle = question.title || questionTitle;
          cpuTimeLimit = (question.timeLimit || 2000) / 1000;
          memoryLimit = (question.memoryLimit || 256) * 1024;
          testCases = (question.testCases || []).map((tc) => ({
            input: prepareExecutionInput(tc.input),
            expected: getTestCaseExpectedOutput(tc),
            isHidden: Boolean(tc.isHidden),
          }));
          if (testCases.length === 0 && question.examples?.length > 0) {
            testCases = question.examples.map((ex) => ({
              input: prepareExecutionInput(ex.input),
              expected: String(ex.output || ""),
              isHidden: false,
            }));
          }
        }
      }
    }

    // Default sample test cases if question had no DB testcases configured
    if (!testCases || testCases.length === 0) {
      testCases = [
        { input: "3 5\n", expected: "8", isHidden: false },
        { input: "10 20\n", expected: "30", isHidden: false },
        { input: "100 200\n", expected: "300", isHidden: true },
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

    const resolvedTimeTakenMs =
      Number(timeTakenMs) ||
      Math.round(Number(suiteResult.executionTime || 0) * 1000) ||
      0;

    const isAllPassed = suiteResult.passed === suiteResult.total && suiteResult.total > 0;
    const resolvedStatus = suiteResult.status === "compile_error"
      ? "compile_error"
      : isAllPassed
      ? "accepted"
      : (suiteResult.passed > 0 ? "wrong" : "failed");

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
        approach: String(approach || ""),
        status: resolvedStatus,
        passedCount: suiteResult.passed,
        totalCount: suiteResult.total,
        score: suiteResult.score,
        executionTime: suiteResult.executionTime,
        memory: suiteResult.memory,
        compileOutput: suiteResult.compileOutput || "",
        results: suiteResult.testResults,
        timeTakenMs: resolvedTimeTakenMs,
      });
    } catch (saveErr) {
      console.warn("Failed to persist submission record:", saveErr.message);
    }

    res.status(201).json({
      submissionId: savedSubmission?._id || null,
      status: resolvedStatus,
      passed: suiteResult.passed,
      total: suiteResult.total,
      score: suiteResult.score,
      execution_time: suiteResult.executionTime,
      memory: suiteResult.memory,
      compileOutput: suiteResult.compileOutput || "",
      test_results: suiteResult.testResults,
      passedCount: suiteResult.passed,
      totalCount: suiteResult.total,
      results: suiteResult.testResults,
      timeMs: Math.round(Number(suiteResult.executionTime || 0) * 1000) || 0,
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

