import Test from "../models/Test.js";
import TestAssignment from "../models/TestAssignment.js";
import TestAttempt from "../models/TestAttempt.js";
import User from "../models/User.js";
import { processResult } from "../services/resultProcessor.js";

export const getAssignedTests = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const assignments = await TestAssignment.find({
      studentIds: userId,
      status: { $nin: ["archived"] },
    })
      .populate("testId")
      .lean();

    const attempts = await TestAttempt.find({ userId }).lean();
    const attemptMap = {};
    attempts.forEach(a => { attemptMap[a.testId.toString()] = a; });

    const now = new Date();
    const enriched = assignments
      .filter(a => {
        if (!a.testId) return false;
        const test = a.testId;
        if (test.status === "draft") return false;
        return true;
      })
      .map(a => {
        const test = a.testId;
        const attempt = attemptMap[test._id.toString()];
        let testStatus = "available";

        if (attempt?.status === "completed" || attempt?.status === "auto_submitted") {
          testStatus = "completed";
        } else if (attempt?.status === "started") {
          testStatus = "started";
        } else if (test.status === "completed" || test.closedAt) {
          testStatus = "expired";
        } else if (test.startAt && new Date(test.startAt) > now) {
          testStatus = "upcoming";
        } else if (test.endAt && new Date(test.endAt) < now) {
          testStatus = "expired";
        } else if (test.scheduledAt && new Date(test.scheduledAt) > now) {
          testStatus = "upcoming";
        }

        return {
          _id: test._id,
          assignmentId: a._id,
          attemptId: attempt?._id || null,
          title: test.title,
          description: test.description,
          companyId: test.companyId,
          testType: test.testType,
          difficulty: test.difficulty,
          duration: test.duration,
          passingMarks: test.passingMarks,
          attemptLimit: test.attemptLimit,
          subjects: test.subjects,
          questions: test.questions,
          totalQuestions: test.questions?.length || 0,
          totalMarks: test.questions?.reduce((s, q) => s + (q.marks || 0), 0) || 0,
          status: test.status,
          testStatus,
          scheduledAt: test.scheduledAt,
          startAt: test.startAt,
          endAt: test.endAt,
          assignedAt: a.createdAt,
          assignType: a.assignType,
          assignValue: a.assignValue,
        };
      });

    res.json(enriched);
  } catch (error) {
    console.error("Get Assigned Tests Error:", error.message);
    res.status(500).json({ message: "Failed to fetch tests" });
  }
};

export const startTest = async (req, res) => {
  try {
    const { testId } = req.params;
    const userId = req.user.id;

    const test = await Test.findById(testId).lean();
    if (!test) return res.status(404).json({ message: "Test not found" });
    if (test.status !== "live" && test.status !== "scheduled") {
      return res.status(400).json({ message: "Test is not available" });
    }

    const assignment = await TestAssignment.findOne({
      testId,
      studentIds: userId,
      status: { $nin: ["archived"] },
    }).lean();
    if (!assignment) return res.status(403).json({ message: "Test not assigned to you" });

    let attempt = await TestAttempt.findOne({ testId, userId });
    if (attempt) {
      if (attempt.status === "completed" || attempt.status === "auto_submitted") {
        return res.status(400).json({ message: "Test already completed" });
      }
      attempt.currentQuestionIndex = 0;
      attempt.status = "started";
      attempt.startTime = new Date();
      attempt.endTime = new Date(Date.now() + test.duration * 60000);
      attempt.answers = test.questions.map((q, idx) => ({
        questionIndex: idx,
        questionId: q._id?.toString() || "",
        type: q.type === "Coding" ? "Coding" : q.options?.length ? "MCQ" : "Descriptive",
        answer: "",
        code: "",
        language: "",
        status: "not_visited",
        marks: q.marks || 1,
        scoredMarks: 0,
      }));
      await attempt.save();
      return res.json({ attempt, test });
    }

    attempt = await TestAttempt.create({
      testId,
      assignmentId: assignment._id,
      userId,
      status: "started",
      startTime: new Date(),
      endTime: new Date(Date.now() + test.duration * 60000),
      answers: test.questions.map((q, idx) => ({
        questionIndex: idx,
        questionId: q._id?.toString() || "",
        type: q.type === "Coding" ? "Coding" : q.options?.length ? "MCQ" : "Descriptive",
        answer: "",
        code: "",
        language: "",
        status: "not_visited",
        marks: q.marks || 1,
        scoredMarks: 0,
      })),
    });

    await TestAssignment.findByIdAndUpdate(assignment._id, {
      $inc: { startedCount: 1 },
    });

    res.status(201).json({ attempt, test });
  } catch (error) {
    console.error("Start Test Error:", error.message);
    res.status(500).json({ message: "Failed to start test" });
  }
};

export const saveAnswer = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { questionIndex, answer, code, language, status } = req.body;
    const userId = req.user.id;

    const attempt = await TestAttempt.findOne({ _id: attemptId, userId });
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });
    if (attempt.status === "completed" || attempt.status === "auto_submitted") {
      return res.status(400).json({ message: "Test already submitted" });
    }

    const ans = attempt.answers.find(a => a.questionIndex === questionIndex);
    if (ans) {
      if (answer !== undefined) ans.answer = answer;
      if (code !== undefined) ans.code = code;
      if (language !== undefined) ans.language = language;
      if (status) ans.status = status;
    }

    await attempt.save();
    res.json({ message: "Answer saved" });
  } catch (error) {
    console.error("Save Answer Error:", error.message);
    res.status(500).json({ message: "Failed to save answer" });
  }
};

export const getAttemptState = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const userId = req.user.id;
    const attempt = await TestAttempt.findOne({ _id: attemptId, userId })
      .populate("testId")
      .lean();
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });
    res.json(attempt);
  } catch (error) {
    console.error("Get Attempt Error:", error.message);
    res.status(500).json({ message: "Failed to fetch attempt" });
  }
};

export const recordTabSwitch = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const userId = req.user.id;
    const attempt = await TestAttempt.findOne({ _id: attemptId, userId });
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });

    attempt.tabSwitchCount = (attempt.tabSwitchCount || 0) + 1;
    attempt.tabSwitches.push({ count: attempt.tabSwitchCount, timestamp: new Date() });

    let autoSubmit = false;
    if (attempt.tabSwitchCount >= 3) {
      attempt.status = "auto_submitted";
      attempt.autoSubmitReason = "Exceeded tab switch limit (3 switches)";
      attempt.submittedAt = new Date();
      attempt.endTime = new Date();
      autoSubmit = true;

      await TestAssignment.findByIdAndUpdate(attempt.assignmentId, {
        $inc: { completedCount: 1, autoSubmittedCount: 1 },
      });
    }

    await attempt.save();
    res.json({ tabSwitchCount: attempt.tabSwitchCount, autoSubmitted: autoSubmit });
  } catch (error) {
    console.error("Tab Switch Error:", error.message);
    res.status(500).json({ message: "Failed to record tab switch" });
  }
};

export const submitTest = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const userId = req.user.id;
    const { forceSubmit } = req.body;

    const attempt = await TestAttempt.findOne({ _id: attemptId, userId }).populate("testId");
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });
    if (attempt.status === "completed" || attempt.status === "auto_submitted") {
      return res.status(400).json({ message: "Test already submitted" });
    }

    const test = attempt.testId;
    let totalScore = 0;

    attempt.answers.forEach(ans => {
      const question = test.questions[ans.questionIndex];
      if (!question) return;
      if (ans.status === "answered") {
        if (question.type === "Coding") {
          ans.scoredMarks = 0;
        } else if (question.options?.length > 0) {
          const isCorrect = ans.answer?.toLowerCase().trim() === question.correctAnswer?.toLowerCase().trim();
          ans.scoredMarks = isCorrect ? (question.marks || 1) : -(question.negativeMarks || 0);
        } else {
          ans.scoredMarks = 0;
        }
        totalScore += ans.scoredMarks;
      }
    });

    totalScore = Math.max(0, totalScore);
    attempt.totalScore = totalScore;
    attempt.status = forceSubmit === "auto" ? "auto_submitted" : "completed";
    attempt.submittedAt = new Date();
    attempt.endTime = new Date();

    if (forceSubmit === "auto") {
      attempt.autoSubmitReason = "Time expired";
    }

    await attempt.save();

    await TestAssignment.findByIdAndUpdate(attempt.assignmentId, {
      $inc: { completedCount: 1 },
      averageScore: totalScore,
    });

    let result = null;
    try {
      const processed = await processResult(attempt._id);
      result = processed.result;
    } catch (procErr) {
      console.error("Auto-process result error (non-blocking):", procErr.message);
    }

    res.json({
      message: "Test submitted",
      attempt: {
        _id: attempt._id,
        status: attempt.status,
        totalScore: attempt.totalScore,
        totalMarks: test.questions.reduce((s, q) => s + (q.marks || 0), 0),
        submittedAt: attempt.submittedAt,
      },
      resultProcessed: !!result,
      resultId: result?._id || null,
    });
  } catch (error) {
    console.error("Submit Test Error:", error.message);
    res.status(500).json({ message: "Failed to submit test" });
  }
};

export const getTestResult = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const userId = req.user.id;
    const attempt = await TestAttempt.findOne({ _id: attemptId, userId })
      .populate("testId")
      .lean();
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });

    const test = attempt.testId;
    const totalMarks = test.questions.reduce((s, q) => s + (q.marks || 0), 0);
    const answered = attempt.answers.filter(a => a.status === "answered").length;
    const skipped = attempt.answers.filter(a => a.status === "skipped").length;
    const marked = attempt.answers.filter(a => a.status === "marked").length;
    const notVisited = attempt.answers.filter(a => a.status === "not_visited").length;
    const percentage = totalMarks > 0 ? Math.round((attempt.totalScore / totalMarks) * 100) : 0;
    const passed = percentage >= (test.passingMarks || 40);

    res.json({
      attempt: {
        _id: attempt._id,
        status: attempt.status,
        totalScore: attempt.totalScore,
        totalMarks,
        percentage,
        passed,
        answered,
        skipped,
        marked,
        notVisited,
        startTime: attempt.startTime,
        endTime: attempt.endTime,
        submittedAt: attempt.submittedAt,
        tabSwitchCount: attempt.tabSwitchCount,
        autoSubmitReason: attempt.autoSubmitReason,
      },
      test: {
        title: test.title,
        companyId: test.companyId,
        testType: test.testType,
        difficulty: test.difficulty,
        duration: test.duration,
        passingMarks: test.passingMarks,
      },
    });
  } catch (error) {
    console.error("Get Result Error:", error.message);
    res.status(500).json({ message: "Failed to fetch result" });
  }
};
