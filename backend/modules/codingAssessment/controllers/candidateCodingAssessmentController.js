import mongoose from "mongoose";
import CodingAssessment from "../models/CodingAssessment.js";
import CodingAttempt from "../models/CodingAttempt.js";
import CodingQuestion from "../models/CodingQuestion.js";
import CodingTestCase from "../models/CodingTestCase.js";
import CodingSubmission from "../models/CodingSubmission.js";
import CodingAutosave from "../models/CodingAutosave.js";
import { executeDocker as executeJudge0 } from "../services/codeExecutionService.js";
import { compareOutput } from "../utils/outputComparator.js";
import { mapJudge0Status, STATUS_CODES } from "../utils/judge0StatusMapper.js";

const MAX_CUSTOM_INPUT_LENGTH = 10 * 1024; // 10 KB limit
const MAX_SOURCE_CODE_LENGTH = 64 * 1024; // 64 KB limit

/**
 * Sanitizes question for candidate delivery (never leak hidden tests or admin notes)
 */
function sanitizeQuestionForCandidate(q, order = 1, marks = 10, sampleTestCases = []) {
  if (!q) return null;
  const raw = q.toObject ? q.toObject() : q;

  // Gather samples from examples or testCases marked isSample: true or !isHidden
  const samples =
    sampleTestCases.length > 0
      ? sampleTestCases.map((tc, idx) => ({
          index: idx + 1,
          input: String(tc.input ?? ""),
          output: String(tc.expectedOutput ?? tc.expected ?? ""),
          expectedOutput: String(tc.expectedOutput ?? tc.expected ?? ""),
          explanation: tc.explanation || "",
        }))
      : Array.isArray(raw.examples) && raw.examples.length > 0
      ? raw.examples.map((ex, idx) => ({
          index: idx + 1,
          input: String(ex.input ?? ""),
          output: String(ex.output ?? ""),
          expectedOutput: String(ex.output ?? ""),
          explanation: ex.explanation || "",
        }))
      : (raw.testCases || [])
          .filter((tc) => !tc.isHidden)
          .map((tc, idx) => ({
            index: idx + 1,
            input: String(tc.input ?? ""),
            output: String(tc.expected ?? tc.expectedOutput ?? ""),
            expectedOutput: String(tc.expected ?? tc.expectedOutput ?? ""),
            explanation: "",
          }));

  return {
    _id: raw._id,
    id: raw._id,
    questionId: raw.questionId || String(raw._id),
    title: raw.title,
    description: raw.description || raw.problemStatement || "",
    problemStatement: raw.problemStatement || raw.description || "",
    difficulty: raw.difficulty,
    category: raw.category || "General",
    tags: raw.tags || [],
    inputFormat: raw.inputFormat || "",
    outputFormat: raw.outputFormat || "",
    constraints: raw.constraints || "",
    explanation: raw.explanation || "",
    examples: samples,
    sampleTestCases: samples,
    starterCode: raw.starterCode || "function solution() {\n  // Write your code here\n}",
    starterCodeByLanguage: raw.starterCodeByLanguage || {},
    supportedLanguages: raw.supportedLanguages || ["python", "cpp", "java", "c", "javascript"],
    timeLimit: raw.timeLimit || 2,
    memoryLimit: raw.memoryLimit || 256,
    marks: Number(marks) || Number(raw.marks) || 10,
    order: Number(order) || 1,
  };
}

/* ==========================================================================
   1. ASSESSMENT LIST & INSTRUCTIONS
   ========================================================================== */

export const getAvailableAssessments = async (req, res) => {
  try {
    const candidateId = req.user?._id || req.user?.id;

    const assessments = await CodingAssessment.find({ isActive: true })
      .select("title description durationMinutes totalMarks questions createdAt")
      .sort({ createdAt: -1 })
      .lean();

    // Check user's attempt status for each assessment
    const attempts = await CodingAttempt.find({
      candidateId,
      assessmentId: { $in: assessments.map((a) => a._id) },
    })
      .select("assessmentId status startedAt expiresAt submittedAt percentage obtainedMarks")
      .lean();

    const attemptMap = {};
    attempts.forEach((att) => {
      attemptMap[String(att.assessmentId)] = att;
    });

    const data = assessments.map((a) => {
      const att = attemptMap[String(a._id)];
      return {
        _id: a._id,
        title: a.title,
        description: a.description,
        durationMinutes: a.durationMinutes,
        questionCount: (a.questions || []).length,
        totalMarks: a.totalMarks,
        attempt: att || null,
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch assessments." });
  }
};

export const getAssessmentInstructions = async (req, res) => {
  try {
    const { id } = req.params;
    const assessment = await CodingAssessment.findOne({ _id: id, isActive: true })
      .populate("questions.questionId", "title difficulty marks")
      .lean();

    if (!assessment) {
      return res.status(404).json({ success: false, message: "Assessment not found or inactive." });
    }

    const candidateId = req.user?._id || req.user?.id;
    const existingAttempt = await CodingAttempt.findOne({
      candidateId,
      assessmentId: id,
    }).lean();

    res.json({
      success: true,
      data: {
        _id: assessment._id,
        title: assessment.title,
        description: assessment.description,
        durationMinutes: assessment.durationMinutes,
        totalMarks: assessment.totalMarks,
        questionCount: assessment.questions.length,
        questionsOverview: assessment.questions.map((q, idx) => ({
          order: q.order || idx + 1,
          title: q.questionId?.title || `Problem ${idx + 1}`,
          difficulty: q.questionId?.difficulty || "Medium",
          marks: q.marks || 10,
        })),
        existingAttempt: existingAttempt || null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch instructions." });
  }
};

/* ==========================================================================
   2. START ASSESSMENT (ONE ATTEMPT RULE + AUTHORITATIVE TIMER)
   ========================================================================== */

export const startAssessment = async (req, res) => {
  try {
    const candidateId = req.user?._id || req.user?.id;
    const { id: assessmentId } = req.params;

    const assessment = await CodingAssessment.findOne({ _id: assessmentId, isActive: true })
      .populate("questions.questionId")
      .lean();

    if (!assessment) {
      return res.status(404).json({ success: false, message: "Assessment not found or not active." });
    }

    // Check for existing attempt (Rule 27: One Attempt Rule)
    let attempt = await CodingAttempt.findOne({ candidateId, assessmentId });

    const now = new Date();

    if (attempt) {
      // If already submitted or expired, cannot re-start
      if (["SUBMITTED", "AUTO_SUBMITTED"].includes(attempt.status)) {
        return res.json({
          success: true,
          message: "Assessment already completed.",
          data: {
            attemptId: attempt._id,
            status: attempt.status,
            completed: true,
          },
        });
      }

      // Check if time expired while candidate was away
      if (new Date(attempt.expiresAt) <= now) {
        attempt.status = "AUTO_SUBMITTED";
        attempt.submittedAt = attempt.expiresAt;
        await attempt.save();

        return res.json({
          success: true,
          message: "Assessment time has expired.",
          data: {
            attemptId: attempt._id,
            status: "AUTO_SUBMITTED",
            completed: true,
          },
        });
      }
    } else {
      // Create new attempt with authoritative duration
      const startedAt = now;
      const expiresAt = new Date(startedAt.getTime() + assessment.durationMinutes * 60 * 1000);

      const initialProgress = assessment.questions.map((q, idx) => ({
        questionId: q.questionId?._id || q.questionId,
        status: "NOT_VISITED",
        passedTests: 0,
        totalTests: 0,
        marks: 0,
        maxMarks: Number(q.marks) || 10,
        language: "python",
        lastSavedCode: "",
      }));

      attempt = await CodingAttempt.create({
        candidateId,
        assessmentId,
        startedAt,
        expiresAt,
        status: "IN_PROGRESS",
        totalMarks: assessment.totalMarks,
        obtainedMarks: 0,
        percentage: 0,
        questionProgress: initialProgress,
      });
    }

    // Retrieve questions assigned ONLY to this assessment (Rule 12)
    const assignedQuestions = [];
    for (let i = 0; i < assessment.questions.length; i++) {
      const item = assessment.questions[i];
      const q = item.questionId;
      if (!q) continue;

      // Fetch sample test cases from CodingTestCase
      const samples = await CodingTestCase.find({
        questionId: q._id,
        isSample: true,
      })
        .select("input expectedOutput explanation")
        .lean();

      assignedQuestions.push(sanitizeQuestionForCandidate(q, item.order || i + 1, item.marks, samples));
    }

    res.json({
      success: true,
      data: {
        attemptId: attempt._id,
        assessment: {
          _id: assessment._id,
          title: assessment.title,
          durationMinutes: assessment.durationMinutes,
          totalMarks: assessment.totalMarks,
        },
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt,
        remainingSeconds: Math.max(0, Math.floor((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000)),
        status: attempt.status,
        questions: assignedQuestions,
        questionProgress: attempt.questionProgress || [],
      },
    });
  } catch (error) {
    console.error("startAssessment error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to start assessment." });
  }
};

/* ==========================================================================
   3. GET ATTEMPT STATE & RESTORE SAVED CODE
   ========================================================================== */

export const getAttemptState = async (req, res) => {
  try {
    const candidateId = req.user?._id || req.user?.id;
    const { id: attemptId } = req.params;

    const attempt = await CodingAttempt.findOne({ _id: attemptId, candidateId })
      .populate({
        path: "assessmentId",
        populate: {
          path: "questions.questionId",
        },
      })
      .lean();

    if (!attempt) {
      return res.status(404).json({ success: false, message: "Attempt not found." });
    }

    const assessment = attempt.assessmentId;
    const now = new Date();

    // Auto-expire check
    let isExpired = false;
    if (attempt.status === "IN_PROGRESS" && new Date(attempt.expiresAt) <= now) {
      await CodingAttempt.updateOne(
        { _id: attempt._id },
        { status: "AUTO_SUBMITTED", submittedAt: attempt.expiresAt }
      );
      attempt.status = "AUTO_SUBMITTED";
      isExpired = true;
    }

    // Load candidate's autosaved drafts for this attempt
    const autosaves = await CodingAutosave.find({ attemptId }).lean();
    const draftMap = {};
    autosaves.forEach((d) => {
      draftMap[`${d.questionId}_${d.language}`] = d.sourceCode;
    });

    // Sanitize questions assigned to this assessment
    const assignedQuestions = [];
    if (assessment && Array.isArray(assessment.questions)) {
      for (let i = 0; i < assessment.questions.length; i++) {
        const item = assessment.questions[i];
        const q = item.questionId;
        if (!q) continue;

        const samples = await CodingTestCase.find({
          questionId: q._id,
          isSample: true,
        }).select("input expectedOutput explanation").lean();

        assignedQuestions.push(sanitizeQuestionForCandidate(q, item.order || i + 1, item.marks, samples));
      }
    }

    res.json({
      success: true,
      data: {
        attemptId: attempt._id,
        assessment: {
          _id: assessment?._id,
          title: assessment?.title,
          durationMinutes: assessment?.durationMinutes,
          totalMarks: assessment?.totalMarks,
        },
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt,
        remainingSeconds: Math.max(0, Math.floor((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000)),
        status: attempt.status,
        isExpired,
        questions: assignedQuestions,
        questionProgress: attempt.questionProgress || [],
        savedDrafts: draftMap,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load attempt state." });
  }
};

/* ==========================================================================
   4. RUN SAMPLE TEST CASES (NEVER MODIFIES SCORE)
   ========================================================================== */

export const runSampleTests = async (req, res) => {
  try {
    const { questionId, language = "python", sourceCode = "" } = req.body;

    if (!questionId) {
      return res.status(400).json({ success: false, message: "questionId is required." });
    }

    if (!sourceCode || sourceCode.length > MAX_SOURCE_CODE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: "Code is required and must be under 64 KB.",
      });
    }

    // Retrieve question and its sample test cases ONLY from MongoDB
    const question = await CodingQuestion.findById(questionId).lean();
    if (!question) {
      return res.status(404).json({ success: false, message: "Question not found." });
    }

    // Fetch sample test cases from separate collection or question's embedded samples
    let sampleTestCases = await CodingTestCase.find({
      questionId,
      isSample: true,
    }).lean();

    if (sampleTestCases.length === 0) {
      sampleTestCases = (question.testCases || [])
        .filter((tc) => !tc.isHidden)
        .map((tc, idx) => ({
          _id: tc._id || `sample_${idx + 1}`,
          input: tc.input,
          expectedOutput: tc.expected || tc.expectedOutput || "",
          isSample: true,
        }));
    }

    if (sampleTestCases.length === 0 && question.examples?.length > 0) {
      sampleTestCases = question.examples.map((ex, idx) => ({
        _id: `example_${idx + 1}`,
        input: ex.input,
        expectedOutput: ex.output,
        isSample: true,
      }));
    }

    if (sampleTestCases.length === 0) {
      return res.json({
        success: true,
        data: {
          status: "NO_SAMPLES",
          message: "No sample test cases defined for this question.",
          results: [],
          passedCount: 0,
          totalCount: 0,
        },
      });
    }

    const comparisonMode = question.outputComparison?.mode || "trimmed";
    const cpuLimit = Number(question.timeLimit) || 2.0;
    const memoryLimit = (Number(question.memoryLimit) || 256) * 1024;

    const testResults = [];
    let passedCount = 0;

    for (let i = 0; i < sampleTestCases.length; i++) {
      const tc = sampleTestCases[i];
      const execResult = await executeJudge0({
        sourceCode,
        language,
        stdin: tc.input || "",
        cpuTimeLimit: cpuLimit,
        memoryLimit,
      });

      const stdStatus = mapJudge0Status(execResult.statusId, execResult.statusDescription);
      const expectedOut = tc.expectedOutput ?? tc.expected ?? tc.output ?? "";
      const isPassed =
        execResult.status === "success" &&
        compareOutput(execResult.stdout, expectedOut, comparisonMode);

      if (isPassed) passedCount++;

      testResults.push({
        index: i + 1,
        isSample: true,
        input: String(tc.input || ""),
        expected: String(expectedOut),
        actual: String(execResult.stdout || ""),
        error: isPassed ? "" : execResult.compileOutput || execResult.stderr || execResult.output || "",
        status: isPassed ? STATUS_CODES.ACCEPTED : stdStatus,
        timeMs: execResult.timeMs || 0,
      });

      // If compilation error, halt remaining sample tests
      if (stdStatus === STATUS_CODES.COMPILATION_ERROR) {
        break;
      }
    }

    res.json({
      success: true,
      data: {
        status: passedCount === sampleTestCases.length ? STATUS_CODES.ACCEPTED : "SAMPLE_FAILED",
        passedCount,
        totalCount: sampleTestCases.length,
        results: testResults,
      },
    });
  } catch (error) {
    console.error("runSampleTests error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to run sample tests." });
  }
};

/* ==========================================================================
   5. RUN CUSTOM INPUT (SANDBOX ONLY - NEVER MODIFIES SCORES)
   ========================================================================== */

export const runCustomInput = async (req, res) => {
  try {
    const { language = "python", sourceCode = "", customInput = "" } = req.body;

    if (!sourceCode) {
      return res.status(400).json({ success: false, message: "Source code is required." });
    }

    if (customInput.length > MAX_CUSTOM_INPUT_LENGTH) {
      return res.status(400).json({
        success: false,
        message: "Custom input exceeds the maximum allowed size of 10 KB.",
      });
    }

    const execResult = await executeJudge0({
      sourceCode,
      language,
      stdin: customInput,
      cpuTimeLimit: 3.0,
      memoryLimit: 128000,
    });

    const status = mapJudge0Status(execResult.statusId, execResult.statusDescription);

    res.json({
      success: true,
      data: {
        status,
        stdout: execResult.stdout || "",
        stderr: execResult.stderr || "",
        compileOutput: execResult.compileOutput || "",
        output: execResult.output || execResult.stdout || "",
        timeMs: execResult.timeMs || 0,
        memoryKB: execResult.memoryKB || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Custom execution failed." });
  }
};

/* ==========================================================================
   6. SUBMIT SOLUTION (EVALUATES AGAINST HIDDEN + SAMPLE TEST CASES)
   ========================================================================== */

export const submitSolution = async (req, res) => {
  try {
    const candidateId = req.user?._id || req.user?.id;
    const { attemptId, questionId, language = "python", sourceCode = "", timeTakenMs = 0 } = req.body;

    if (!questionId || !sourceCode) {
      return res.status(400).json({ success: false, message: "Question ID and source code are required." });
    }

    // Verify attempt ownership and state if attemptId provided
    let attempt = null;
    let questionMaxMarks = 10;

    if (attemptId) {
      attempt = await CodingAttempt.findOne({ _id: attemptId, candidateId });
      if (!attempt) {
        return res.status(404).json({ success: false, message: "Assessment attempt not found." });
      }

      if (attempt.status !== "IN_PROGRESS") {
        return res.status(400).json({
          success: false,
          message: "Assessment is no longer in progress.",
        });
      }

      if (new Date(attempt.expiresAt) <= new Date()) {
        attempt.status = "AUTO_SUBMITTED";
        attempt.submittedAt = attempt.expiresAt;
        await attempt.save();
        return res.status(400).json({
          success: false,
          message: "Assessment timer expired. Test automatically submitted.",
        });
      }

      const qProg = (attempt.questionProgress || []).find((qp) => String(qp.questionId) === String(questionId));
      if (qProg) {
        questionMaxMarks = qProg.maxMarks || 10;
      }
    }

    // Retrieve official question and all test cases from MongoDB
    const question = await CodingQuestion.findById(questionId).lean();
    if (!question) {
      return res.status(404).json({ success: false, message: "Question not found." });
    }

    if (!attemptId) {
      questionMaxMarks = question.marks || 10;
    }

    // Fetch all official test cases (Sample + Hidden)
    let allTestCases = await CodingTestCase.find({ questionId }).lean();
    if (allTestCases.length === 0) {
      allTestCases = (question.testCases || []).map((tc) => ({
        input: tc.input,
        expectedOutput: tc.expected || tc.expectedOutput || "",
        isHidden: Boolean(tc.isHidden),
        isSample: !tc.isHidden,
        weight: 1,
      }));
    }

    if (allTestCases.length === 0 && question.examples?.length > 0) {
      allTestCases = question.examples.map((ex) => ({
        input: ex.input,
        expectedOutput: ex.output,
        isHidden: false,
        isSample: true,
        weight: 1,
      }));
    }

    const comparisonMode = question.outputComparison?.mode || "trimmed";
    const cpuLimit = Number(question.timeLimit) || 2.0;
    const memoryLimit = (Number(question.memoryLimit) || 256) * 1024;

    const detailedResults = [];
    let passedCount = 0;
    let totalTimeMs = 0;
    let compileErrorOutput = "";
    let globalStatus = STATUS_CODES.ACCEPTED;

    for (let i = 0; i < allTestCases.length; i++) {
      const tc = allTestCases[i];
      const isHidden = Boolean(tc.isHidden);

      const execResult = await executeJudge0({
        sourceCode,
        language,
        stdin: tc.input || "",
        cpuTimeLimit: cpuLimit,
        memoryLimit,
      });

      totalTimeMs += execResult.timeMs || 0;
      const stdStatus = mapJudge0Status(execResult.statusId, execResult.statusDescription);

      if (stdStatus === STATUS_CODES.COMPILATION_ERROR) {
        compileErrorOutput = execResult.compileOutput || execResult.stderr || "Compilation Error";
        globalStatus = STATUS_CODES.COMPILATION_ERROR;
        break;
      }

      const expectedOut = tc.expectedOutput ?? tc.expected ?? tc.output ?? "";
      const passed =
        execResult.status === "success" &&
        compareOutput(execResult.stdout, expectedOut, comparisonMode);

      if (passed) {
        passedCount++;
      } else if (globalStatus === STATUS_CODES.ACCEPTED) {
        globalStatus = stdStatus;
      }

      // Security: Hidden tests NEVER leak input/expected to client response!
      detailedResults.push({
        index: i + 1,
        passed,
        isHidden,
        input: isHidden ? "" : String(tc.input || ""),
        expected: isHidden ? "" : String(tc.expectedOutput || tc.expected || ""),
        actual: isHidden ? "" : String(execResult.stdout || ""),
        error: isHidden ? "" : passed ? "" : execResult.stderr || "",
        status: passed ? STATUS_CODES.ACCEPTED : stdStatus,
        timeMs: execResult.timeMs || 0,
      });
    }

    const totalCount = allTestCases.length || 1;
    // Score Calculation: 20 * (7 / 10) capped at questionMaxMarks (Rule 25)
    const earnedScore = Math.min(
      questionMaxMarks,
      Math.round((questionMaxMarks * (passedCount / totalCount)) * 100) / 100
    );

    const isFullySolved = passedCount === totalCount && totalCount > 0;
    const submissionStatus = isFullySolved
      ? STATUS_CODES.ACCEPTED
      : compileErrorOutput
      ? STATUS_CODES.COMPILATION_ERROR
      : passedCount > 0
      ? "PARTIALLY_ACCEPTED"
      : STATUS_CODES.WRONG_ANSWER;

    // Save official Submission in MongoDB
    const submission = await CodingSubmission.create({
      candidateId,
      userId: candidateId,
      attemptId: attempt?._id || null,
      questionId,
      title: question.title,
      language,
      code: sourceCode,
      sourceCode,
      status: submissionStatus,
      passedTests: passedCount,
      totalTests: totalCount,
      passedCount,
      totalCount,
      score: earnedScore,
      executionTime: totalTimeMs / 1000,
      compileOutput: compileErrorOutput,
      results: detailedResults,
      timeTakenMs: Number(timeTakenMs) || 0,
      submittedAt: new Date(),
    });

    // Update Attempt Progress in MongoDB
    if (attempt) {
      let totalObtained = 0;
      attempt.questionProgress = (attempt.questionProgress || []).map((qp) => {
        if (String(qp.questionId) === String(questionId)) {
          qp.status = isFullySolved ? "SOLVED" : passedCount > 0 ? "PARTIAL" : "FAILED";
          qp.passedTests = passedCount;
          qp.totalTests = totalCount;
          qp.marks = earnedScore;
          qp.language = language;
          qp.lastSavedCode = sourceCode;
          qp.submittedAt = new Date();
        }
        totalObtained += Number(qp.marks) || 0;
        return qp;
      });

      attempt.obtainedMarks = Math.min(attempt.totalMarks || 100, Math.round(totalObtained * 100) / 100);
      attempt.percentage = attempt.totalMarks > 0 ? Math.round((attempt.obtainedMarks / attempt.totalMarks) * 100) : 0;
      await attempt.save();
    }

    res.json({
      success: true,
      data: {
        submissionId: submission._id,
        status: submissionStatus,
        passedTests: passedCount,
        totalTests: totalCount,
        score: earnedScore,
        maxMarks: questionMaxMarks,
        compileOutput: compileErrorOutput,
        executionTime: (totalTimeMs / 1000).toFixed(2),
        // Sanitized results: Candidate only sees sample details; hidden tests only report count (Rule 22)
        results: detailedResults.map((r) => ({
          index: r.index,
          passed: r.passed,
          isHidden: r.isHidden,
          input: r.isHidden ? "[Hidden Test Case]" : r.input,
          expected: r.isHidden ? "[Hidden Test Case]" : r.expected,
          actual: r.isHidden ? (r.passed ? "Passed" : "Hidden Output") : r.actual,
          status: r.status,
          timeMs: r.timeMs,
        })),
        hiddenTestSummary: {
          passed: detailedResults.filter((r) => r.isHidden && r.passed).length,
          total: detailedResults.filter((r) => r.isHidden).length,
        },
      },
    });
  } catch (error) {
    console.error("submitSolution error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to submit solution." });
  }
};

/* ==========================================================================
   7. AUTOSAVE CODE PERIODICALLY (RESTORE ON REFRESH)
   ========================================================================== */

export const autosaveCode = async (req, res) => {
  try {
    const candidateId = req.user?._id || req.user?.id;
    const { attemptId, questionId, language = "python", sourceCode = "" } = req.body;

    if (!attemptId || !questionId) {
      return res.status(400).json({ success: false, message: "attemptId and questionId are required." });
    }

    await CodingAutosave.findOneAndUpdate(
      { attemptId, questionId, language },
      { candidateId, sourceCode, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: "Code autosaved successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to autosave code." });
  }
};

/* ==========================================================================
   8. COMPLETE ASSESSMENT & COMPUTE FINAL RESULTS
   ========================================================================== */

export const completeAssessment = async (req, res) => {
  try {
    const candidateId = req.user?._id || req.user?.id;
    const { id: attemptId } = req.params;
    const { autoSubmitted = false } = req.body;

    const attempt = await CodingAttempt.findOne({ _id: attemptId, candidateId }).populate("assessmentId");
    if (!attempt) {
      return res.status(404).json({ success: false, message: "Attempt not found." });
    }

    if (["SUBMITTED", "AUTO_SUBMITTED"].includes(attempt.status)) {
      return res.json({ success: true, message: "Assessment already completed.", data: attempt });
    }

    const finalStatus = autoSubmitted ? "AUTO_SUBMITTED" : "SUBMITTED";
    attempt.status = finalStatus;
    attempt.submittedAt = new Date();

    // Sum up obtained marks from questionProgress
    let totalObtained = 0;
    (attempt.questionProgress || []).forEach((qp) => {
      totalObtained += Number(qp.marks) || 0;
    });

    attempt.obtainedMarks = Math.min(attempt.totalMarks || 100, Math.round(totalObtained * 100) / 100);
    attempt.percentage = attempt.totalMarks > 0 ? Math.round((attempt.obtainedMarks / attempt.totalMarks) * 100) : 0;
    await attempt.save();

    res.json({
      success: true,
      message: "Assessment completed successfully.",
      data: attempt,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to complete assessment." });
  }
};

export const getAssessmentResult = async (req, res) => {
  try {
    const candidateId = req.user?.id || req.user?._id;
    const { id: attemptId } = req.params;

    const query = { _id: attemptId };
    if (req.user?.role !== "admin") {
      const candidateObjId = mongoose.Types.ObjectId.isValid(candidateId)
        ? new mongoose.Types.ObjectId(candidateId)
        : null;
      query.$or = candidateObjId
        ? [{ candidateId: candidateObjId }, { candidateId: String(candidateId) }]
        : [{ candidateId }];
    }

    const attempt = await CodingAttempt.findOne(query)
      .populate("assessmentId", "title description durationMinutes totalMarks")
      .populate("questionProgress.questionId", "title difficulty category tags marks")
      .lean();

    if (!attempt) {
      return res.status(404).json({ success: false, message: "Result not found." });
    }

    // Retrieve submissions for each question
    const submissions = await CodingSubmission.find({ attemptId })
      .sort({ createdAt: -1 })
      .lean();

    const subMap = {};
    submissions.forEach((s) => {
      const qKey = String(s.questionId);
      if (!subMap[qKey] || new Date(s.createdAt) > new Date(subMap[qKey].createdAt)) {
        subMap[qKey] = s;
      }
    });

    const progress = attempt.questionProgress || [];
    const totalQuestions = progress.length;
    const attemptedQuestions = progress.filter((p) => p.status !== "NOT_VISITED").length;
    const solvedQuestions = progress.filter((p) => p.status === "SOLVED").length;

    let totalTests = 0;
    let passedTests = 0;
    progress.forEach((p) => {
      totalTests += p.totalTests || 0;
      passedTests += p.passedTests || 0;
    });

    const durationSeconds = Math.max(
      0,
      Math.floor(((attempt.submittedAt || new Date()).getTime() - new Date(attempt.startedAt).getTime()) / 1000)
    );

    const breakdown = progress.map((p, idx) => {
      const q = p.questionId;
      const sub = subMap[String(q?._id || p.questionId)];
      return {
        order: idx + 1,
        questionId: q?._id,
        title: q?.title || `Question ${idx + 1}`,
        difficulty: q?.difficulty || "Medium",
        category: q?.category || "General",
        status: p.status,
        passedTests: p.passedTests,
        totalTests: p.totalTests,
        marksObtained: p.marks,
        maxMarks: p.maxMarks,
        language: p.language || sub?.language || "python",
        submittedAt: p.submittedAt || sub?.submittedAt,
        code: sub?.code || sub?.sourceCode || p.lastSavedCode || "",
      };
    });

    res.json({
      success: true,
      data: {
        attemptId: attempt._id,
        assessmentTitle: attempt.assessmentId?.title || "Coding Assessment",
        status: attempt.status,
        totalQuestions,
        attemptedQuestions,
        solvedQuestions,
        totalTestCases: totalTests,
        passedTestCases: passedTests,
        totalMarks: attempt.totalMarks,
        obtainedMarks: attempt.obtainedMarks,
        percentage: attempt.percentage,
        timeUsedSeconds: durationSeconds,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        breakdown,
        aiFeedback: attempt.aiFeedback || null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch assessment result." });
  }
};

/* ==========================================================================
   9. STUDENT ASSESSMENT HISTORY
   ========================================================================== */

export const getStudentAssessmentHistory = async (req, res) => {
  try {
    const candidateId = req.user?.id || req.user?._id;
    if (!candidateId) {
      return res.status(401).json({ success: false, message: "User not authenticated." });
    }

    const candidateObjId = mongoose.Types.ObjectId.isValid(candidateId)
      ? new mongoose.Types.ObjectId(candidateId)
      : null;

    const query = candidateObjId
      ? { $or: [{ candidateId: candidateObjId }, { candidateId: String(candidateId) }] }
      : { candidateId };

    const rawAttempts = await CodingAttempt.find(query)
      .populate("assessmentId", "title durationMinutes totalMarks")
      .sort({ createdAt: -1 })
      .lean();

    const attempts = (rawAttempts || []).map((att) => {
      const assessment = att.assessmentId && typeof att.assessmentId === "object" ? att.assessmentId : {};
      const assessmentIdStr = assessment._id ? String(assessment._id) : String(att.assessmentId || "");
      const progress = att.questionProgress || [];
      const questionsCount = progress.length || 0;
      const solvedCount = progress.filter(
        (p) => p.status === "SOLVED" || (p.marks > 0 && p.passedTests === p.totalTests && p.totalTests > 0)
      ).length;

      return {
        ...att,
        _id: att._id,
        id: String(att._id),
        assessmentId: assessmentIdStr,
        assessmentTitle: assessment.title || "Coding Assessment",
        durationMinutes: assessment.durationMinutes || 60,
        status: att.status,
        startedAt: att.startedAt,
        submittedAt: att.submittedAt,
        obtainedMarks: att.obtainedMarks ?? 0,
        totalMarks: att.totalMarks || assessment.totalMarks || 100,
        percentage: att.percentage ?? 0,
        solvedCount,
        questionsCount,
        questionProgress: progress,
        tabSwitches: att.tabSwitches || 0,
      };
    });

    res.json({
      success: true,
      data: {
        attempts,
      },
      attempts,
    });
  } catch (error) {
    console.error("getStudentAssessmentHistory error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch assessment history." });
  }
};

/* ==========================================================================
   10. OPTIONAL AI POST-ASSESSMENT FEEDBACK (RULE 44: NEVER CHANGES SCORE)
   ========================================================================== */

export const generateAIPostAssessmentFeedback = async (req, res) => {
  try {
    const candidateId = req.user?._id || req.user?.id;
    const { id: attemptId } = req.params;

    const attempt = await CodingAttempt.findOne({ _id: attemptId, candidateId }).populate("assessmentId");
    if (!attempt) {
      return res.status(404).json({ success: false, message: "Attempt not found." });
    }

    if (!["SUBMITTED", "AUTO_SUBMITTED"].includes(attempt.status)) {
      return res.status(400).json({ success: false, message: "Assessment must be completed before generating feedback." });
    }

    if (attempt.aiFeedback) {
      return res.json({ success: true, data: attempt.aiFeedback });
    }

    // Load candidate's latest submissions
    const submissions = await CodingSubmission.find({ attemptId }).lean();
    const subSnippets = submissions.map((s) => ({
      title: s.title,
      language: s.language,
      passed: `${s.passedTests}/${s.totalTests}`,
      status: s.status,
      codePreview: (s.code || "").slice(0, 300),
    }));

    let feedback = {
      summary: "You demonstrated solid algorithmic logic. Keep practicing optimization of time and space complexity.",
      strengths: ["Clean syntax and structured solution formatting", "Passed critical baseline test cases"],
      areasForImprovement: ["Edge-case handling for boundary constraints", "Optimizing inner loops to achieve O(N log N) or O(N)"],
      overallRating: attempt.percentage >= 80 ? "Excellent" : attempt.percentage >= 50 ? "Competent" : "Needs Practice",
    };

    // Attempt Gemini call if API key is present
    try {
      if (process.env.GEMINI_API_KEY) {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `
You are an expert technical interviewer evaluating a coding assessment.
Assessment Score: ${attempt.obtainedMarks}/${attempt.totalMarks} (${attempt.percentage}%).
Submissions: ${JSON.stringify(subSnippets)}

Provide constructive, professional feedback formatted as JSON with keys:
- "summary": string (2-3 sentences overview of candidate's coding skills)
- "strengths": array of 2-3 specific positive observations
- "areasForImprovement": array of 2-3 actionable algorithmic improvements
- "overallRating": string ("Excellent" | "Proficient" | "Developing" | "Needs Practice")
Return ONLY valid JSON.
`;
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });

        const text = response?.text || "";
        const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanJson);
        if (parsed.summary) {
          feedback = parsed;
        }
      }
    } catch (aiErr) {
      console.warn("AI post-assessment feedback warning:", aiErr.message);
    }

    attempt.aiFeedback = feedback;
    await attempt.save();

    res.json({ success: true, data: feedback });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to generate AI feedback." });
  }
};
