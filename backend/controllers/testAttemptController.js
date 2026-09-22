import Test from "../models/Test.js";
import TestAssignment from "../models/TestAssignment.js";
import TestAttempt from "../models/TestAttempt.js";
import User from "../models/User.js";
import { processResult } from "../services/resultProcessor.js";
import { computePassingMarks, calculatePassFail } from "../utils/gradeCalculator.js";

function sanitizeTestForStudent(testDoc) {
  if (!testDoc) return null;
  const t = typeof testDoc.toObject === "function" ? testDoc.toObject() : JSON.parse(JSON.stringify(testDoc));
  if (Array.isArray(t.questions)) {
    t.questions = t.questions.map((q) => {
      const { correctAnswer, explanation, ...safeQ } = q;
      if (Array.isArray(safeQ.testCases)) {
        safeQ.testCases = safeQ.testCases.filter((tc) => !tc.isHidden);
      }
      return safeQ;
    });
  }
  return t;
}

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

    const now = new Date();
    if (test.startAt && now < new Date(test.startAt)) {
      return res.status(403).json({
        message: `This test has not started yet. It will be available from ${new Date(test.startAt).toLocaleString()}.`,
        status: "UPCOMING",
      });
    }
    if (test.endAt && now >= new Date(test.endAt)) {
      return res.status(403).json({
        message: `This test has ended. The test window closed on ${new Date(test.endAt).toLocaleString()}.`,
        status: "EXPIRED",
      });
    }

    const computeEndTime = () => {
      const base = new Date(now.getTime() + test.duration * 60000);
      if (test.endAt && new Date(test.endAt) < base) return new Date(test.endAt);
      return base;
    };

    let attempt = await TestAttempt.findOne({ testId, userId });
    if (attempt) {
      if (attempt.status === "completed" || attempt.status === "auto_submitted") {
        return res.status(400).json({ message: "Test already completed" });
      }
      // Resume existing in-progress attempt without resetting timer
      if (attempt.endTime && now.getTime() > new Date(attempt.endTime).getTime()) {
        attempt.status = "auto_submitted";
        attempt.autoSubmitReason = "Time expired";
        attempt.submittedAt = now;
        await attempt.save();
        return res.status(400).json({ message: "Test time has expired", attempt });
      }
      return res.json({ attempt, test: sanitizeTestForStudent(test) });
    }

    attempt = await TestAttempt.create({
      testId,
      assignmentId: assignment._id,
      userId,
      status: "started",
      startTime: now,
      endTime: computeEndTime(),
      lastHeartbeatAt: now,
      answers: test.questions.map((q, idx) => ({
        questionIndex: idx,
        questionId: q._id?.toString() || "",
        type: q.type === "Coding" || q.problemTitle || (q.testCases && q.testCases.length > 0)
          ? "Coding"
          : q.options?.length
            ? "MCQ"
            : "Descriptive",
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

    res.status(201).json({ attempt, test: sanitizeTestForStudent(test) });
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

    const now = new Date();
    // Enforce server deadline with a 60-second grace period for latency
    if (attempt.endTime && now.getTime() > new Date(attempt.endTime).getTime() + 60000) {
      attempt.status = "auto_submitted";
      attempt.autoSubmitReason = "Time expired";
      attempt.submittedAt = now;
      await attempt.save();
      return res.status(403).json({ message: "Test time has expired. Your test has been auto-submitted." });
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
    if (attempt.testId) {
      attempt.testId = sanitizeTestForStudent(attempt.testId);
    }
    res.json(attempt);
  } catch (error) {
    console.error("Get Attempt Error:", error.message);
    res.status(500).json({ message: "Failed to fetch attempt" });
  }
};

export const recordIntegrityEvent = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { eventType = "tab_switch", durationSeconds = 0, details = {} } = req.body;
    const userId = req.user.id;

    const attempt = await TestAttempt.findOne({ _id: attemptId, userId });
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });

    if (attempt.status === "completed" || attempt.status === "auto_submitted") {
      return res.json({ message: "Test already ended", autoSubmitted: true });
    }

    const duration = Math.max(0, Number(durationSeconds) || 0);
    const validEvent = ["tab_switch", "window_blur", "fullscreen_exit", "paste_burst", "heartbeat_gap"].includes(eventType)
      ? eventType
      : "tab_switch";

    attempt.integrityEvents = attempt.integrityEvents || [];
    attempt.integrityEvents.push({
      eventType: validEvent,
      timestamp: new Date(),
      durationSeconds: duration,
      details,
    });

    if (duration > 0) {
      attempt.totalAwayTimeSeconds = (attempt.totalAwayTimeSeconds || 0) + duration;
    }

    let autoSubmit = false;

    // Track tab switches / window blurs / fullscreen exits towards 3-strike limit
    if (["tab_switch", "fullscreen_exit", "window_blur"].includes(validEvent)) {
      attempt.tabSwitchCount = (attempt.tabSwitchCount || 0) + 1;
      attempt.tabSwitches = attempt.tabSwitches || [];
      attempt.tabSwitches.push({ count: attempt.tabSwitchCount, timestamp: new Date() });

      if (attempt.tabSwitchCount >= 3) {
        attempt.status = "auto_submitted";
        attempt.autoSubmitReason = `Exceeded window switch / minimization limit (3 violations - last: ${validEvent})`;
        attempt.submittedAt = new Date();
        attempt.endTime = new Date();
        autoSubmit = true;

        if (attempt.assignmentId) {
          await TestAssignment.findByIdAndUpdate(attempt.assignmentId, {
            $inc: { completedCount: 1, autoSubmittedCount: 1 },
          });
        }
      }
    }

    await attempt.save();
    res.json({
      success: true,
      tabSwitchCount: attempt.tabSwitchCount,
      totalAwayTimeSeconds: attempt.totalAwayTimeSeconds,
      autoSubmitted: autoSubmit,
      remainingAllowed: Math.max(0, 3 - attempt.tabSwitchCount),
    });
  } catch (error) {
    console.error("Integrity Event Error:", error.message);
    res.status(500).json({ message: "Failed to record integrity event" });
  }
};

export const recordTabSwitch = async (req, res) => {
  return recordIntegrityEvent(req, res);
};

export const recordHeartbeat = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const userId = req.user.id;

    const attempt = await TestAttempt.findOne({ _id: attemptId, userId });
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });

    const now = new Date();
    let autoSubmit = attempt.status === "auto_submitted";

    // Detect if client was absent / frozen (> 45s gap between heartbeats)
    if (attempt.lastHeartbeatAt) {
      const gapSec = Math.round((now.getTime() - new Date(attempt.lastHeartbeatAt).getTime()) / 1000);
      if (gapSec > 45 && attempt.status === "started") {
        attempt.integrityEvents = attempt.integrityEvents || [];
        attempt.integrityEvents.push({
          eventType: "heartbeat_gap",
          timestamp: now,
          durationSeconds: gapSec,
          details: { gapSeconds: gapSec },
        });
        attempt.totalAwayTimeSeconds = (attempt.totalAwayTimeSeconds || 0) + gapSec;
      }
    }

    attempt.lastHeartbeatAt = now;

    // Check if test deadline expired on server
    if (attempt.status === "started" && attempt.endTime && now.getTime() > new Date(attempt.endTime).getTime() + 60000) {
      attempt.status = "auto_submitted";
      attempt.autoSubmitReason = "Time expired";
      attempt.submittedAt = now;
      autoSubmit = true;

      if (attempt.assignmentId) {
        await TestAssignment.findByIdAndUpdate(attempt.assignmentId, {
          $inc: { completedCount: 1, autoSubmittedCount: 1 },
        });
      }
    }

    await attempt.save();

    res.json({
      success: true,
      serverTime: now.toISOString(),
      status: attempt.status,
      autoSubmitted: autoSubmit,
      tabSwitchCount: attempt.tabSwitchCount || 0,
      totalAwayTimeSeconds: attempt.totalAwayTimeSeconds || 0,
    });
  } catch (error) {
    console.error("Heartbeat Error:", error.message);
    res.status(500).json({ message: "Failed to record heartbeat" });
  }
};

export const submitTest = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const userId = req.user.id;
    const { forceSubmit } = req.body;

    // Atomic findOneAndUpdate from "started" to "submitting" to prevent race condition duplicate submissions
    const attempt = await TestAttempt.findOneAndUpdate(
      { _id: attemptId, userId, status: "started" },
      { $set: { status: "submitting" } },
      { new: true }
    ).populate("testId");

    if (!attempt) {
      const existing = await TestAttempt.findOne({ _id: attemptId, userId });
      if (existing && (existing.status === "completed" || existing.status === "auto_submitted")) {
        return res.status(400).json({ message: "Test already submitted" });
      }
      return res.status(404).json({ message: "Attempt not found or invalid status" });
    }

    const test = attempt.testId;
    const now = new Date();
    const isPastDeadline = attempt.endTime && now.getTime() > new Date(attempt.endTime).getTime() + 60000;
    const finalStatus = (forceSubmit === "auto" || isPastDeadline) ? "auto_submitted" : "completed";
    let autoReason = "";

    if (forceSubmit === "auto") {
      autoReason = attempt.autoSubmitReason || "Time expired";
    } else if (isPastDeadline) {
      autoReason = "Submitted after deadline";
    }

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
    attempt.status = finalStatus;
    if (autoReason) attempt.autoSubmitReason = autoReason;
    attempt.submittedAt = now;
    attempt.endTime = now;

    await attempt.save();

    await TestAssignment.findByIdAndUpdate(attempt.assignmentId, {
      $inc: { completedCount: 1, ...(finalStatus === "auto_submitted" ? { autoSubmittedCount: 1 } : {}) },
      averageScore: totalScore,
    });

    let result = null;
    try {
      const processed = await processResult(attempt._id);
      result = processed.result;

      if (result && result.questions) {
        let recalculatedScore = 0;
        for (const qr of result.questions) {
          recalculatedScore += qr.obtainedMarks || 0;
        }
        attempt.totalScore = Math.max(0, recalculatedScore);
        await attempt.save();
      }
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
    const passingPercentage = Number(test.passingMarks) || 0;
    const passingMarks = computePassingMarks(totalMarks, passingPercentage);
    const passed = calculatePassFail(attempt.totalScore, passingMarks);

    res.json({
      attempt: {
        _id: attempt._id,
        status: attempt.status,
        totalScore: attempt.totalScore,
        totalMarks,
        percentage,
        passingMarks,
        passingPercentage,
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
