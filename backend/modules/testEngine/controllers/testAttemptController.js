import Test from "../models/Test.js";
import TestAssignment from "../models/TestAssignment.js";
import TestAttempt from "../models/TestAttempt.js";
import TestResult from "../models/TestResult.js";
import User from "../../auth/models/User.js";
import { processResult } from "../services/resultProcessor.js";
import { computePassingMarks, calculatePassFail } from "../utils/gradeCalculator.js";
import { withInFlightLock } from "../../realInterview/services/inFlightLock.js";

const testCache = new Map();
const TEST_CACHE_TTL_MS = 60000; // 60s cache for static test metadata during active tests

export function sanitizeTestForStudent(testDoc) {
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

export async function getCachedTest(testId) {
  const key = testId.toString();
  const cached = testCache.get(key);
  if (cached && (Date.now() - cached.timestamp < TEST_CACHE_TTL_MS)) {
    return cached;
  }
  const raw = await Test.findById(testId).lean();
  if (!raw) return null;
  const sanitized = sanitizeTestForStudent(raw);
  const cacheEntry = { raw, sanitized, timestamp: Date.now() };
  testCache.set(key, cacheEntry);
  return cacheEntry;
}

export const getAssignedTests = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select("_id").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const assignments = await TestAssignment.find({
      studentIds: userId,
      status: { $nin: ["archived"] },
    })
      .populate("testId", "title description companyId testType difficulty duration passingMarks attemptLimit subjects status scheduledAt startAt endAt closedAt questions.marks createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const attempts = await TestAttempt.find({ userId }).select("testId status attemptCount").lean();
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
        const attemptLimit = test.attemptLimit || 1;
        const attemptsUsed = (attempt?.status === "completed" || attempt?.status === "auto_submitted")
          ? (attempt.attemptCount || 1)
          : (attempt?.status === "started" ? (attempt.attemptCount || 1) : 0);
        const canRetake = (attempt?.status === "completed" || attempt?.status === "auto_submitted") && attemptsUsed < attemptLimit;

        let testStatus = "available";

        if (attempt?.status === "started") {
          testStatus = "started";
        } else if (attempt?.status === "completed" || attempt?.status === "auto_submitted") {
          testStatus = "completed";
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
          attemptLimit,
          attemptCount: attemptsUsed,
          canRetake,
          attemptsRemaining: Math.max(0, attemptLimit - attemptsUsed),
          subjects: test.subjects,
          totalQuestions: test.questions?.length || 0,
          totalMarks: test.questions?.reduce((s, q) => s + (q.marks || 0), 0) || 0,
          status: test.status,
          testStatus,
          scheduledAt: test.scheduledAt,
          startAt: test.startAt,
          endAt: test.endAt,
          assignedAt: a.createdAt,
          createdAt: test.createdAt,
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
  const { testId } = req.params;
  const userId = req.user.id;
  const lockKey = `test_start:${userId}:${testId}`;

  try {
    const responsePayload = await withInFlightLock(lockKey, async () => {
      const cached = await getCachedTest(testId);
      if (!cached || !cached.raw) {
        return { statusCode: 404, data: { message: "Test not found" } };
      }
      const test = cached.raw;
      const sanitizedTest = cached.sanitized;

      if (test.status !== "live" && test.status !== "scheduled") {
        return { statusCode: 400, data: { message: "Test is not available" } };
      }

      const assignment = await TestAssignment.findOne({
        testId,
        studentIds: userId,
        status: { $nin: ["archived"] },
      }).select("_id").lean();
      if (!assignment) {
        return { statusCode: 403, data: { message: "Test not assigned to you" } };
      }

      const now = new Date();
      if (test.startAt && now < new Date(test.startAt)) {
        return {
          statusCode: 403,
          data: {
            message: `This test has not started yet. It will be available from ${new Date(test.startAt).toLocaleString()}.`,
            status: "UPCOMING",
          },
        };
      }
      if (test.endAt && now >= new Date(test.endAt)) {
        return {
          statusCode: 403,
          data: {
            message: `This test has ended. The test window closed on ${new Date(test.endAt).toLocaleString()}.`,
            status: "EXPIRED",
          },
        };
      }

      const computeEndTime = () => {
        const base = new Date(now.getTime() + test.duration * 60000);
        if (test.endAt && new Date(test.endAt) < base) return new Date(test.endAt);
        return base;
      };

      let attempt = await TestAttempt.findOne({ testId, userId });
      if (attempt) {
        if (attempt.status === "completed" || attempt.status === "auto_submitted") {
          const attemptLimit = test.attemptLimit || 1;
          const currentCount = attempt.attemptCount || 1;
          if (currentCount >= attemptLimit) {
            return { statusCode: 400, data: { message: `Attempt limit reached (${currentCount}/${attemptLimit} attempts used)` } };
          }

          // Retake: reset attempt fields for new attempt session
          attempt.status = "started";
          attempt.attemptCount = currentCount + 1;
          attempt.startTime = now;
          attempt.endTime = computeEndTime();
          attempt.lastHeartbeatAt = now;
          attempt.currentQuestionIndex = 0;
          attempt.tabSwitchCount = 0;
          attempt.tabSwitches = [];
          attempt.integrityEvents = [];
          attempt.totalAwayTimeSeconds = 0;
          attempt.browserCloseDetected = false;
          attempt.networkFailureDetected = false;
          attempt.totalScore = 0;
          attempt.autoSubmitReason = "";
          attempt.submittedAt = null;
          attempt.answers = test.questions.map((q, idx) => ({
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
          }));
          await attempt.save();

          await TestAssignment.findByIdAndUpdate(assignment._id, {
            $inc: { startedCount: 1 },
          });

          return { statusCode: 200, data: { attempt, test: sanitizedTest } };
        }

        // Resume existing in-progress attempt without resetting timer
        if (attempt.endTime && now.getTime() > new Date(attempt.endTime).getTime()) {
          attempt.status = "auto_submitted";
          attempt.autoSubmitReason = "Time expired";
          attempt.submittedAt = now;
          await attempt.save();
          return { statusCode: 400, data: { message: "Test time has expired", attempt } };
        }
        return { statusCode: 200, data: { attempt, test: sanitizedTest } };
      }

      try {
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

        return { statusCode: 201, data: { attempt, test: sanitizedTest } };
      } catch (createErr) {
        if (createErr.code === 11000) {
          const existingAttempt = await TestAttempt.findOne({ testId, userId });
          return { statusCode: 200, data: { attempt: existingAttempt, test: sanitizedTest } };
        }
        throw createErr;
      }
    });

    return res.status(responsePayload.statusCode).json(responsePayload.data);
  } catch (error) {
    console.error("Start Test Error:", error.message);
    res.status(500).json({ message: "Failed to start test" });
  }
};

export const saveAnswer = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const {
      questionIndex,
      answer,
      code,
      language,
      status,
      codingScore,
      passedCount,
      totalCount,
      executionStatus,
      scoredMarks,
    } = req.body;
    const userId = req.user.id;

    const updateFields = {};
    if (answer !== undefined) updateFields["answers.$.answer"] = answer;
    if (code !== undefined) updateFields["answers.$.code"] = code;
    if (language !== undefined) updateFields["answers.$.language"] = language;
    if (status) updateFields["answers.$.status"] = status;
    if (codingScore !== undefined) updateFields["answers.$.codingScore"] = codingScore;
    if (passedCount !== undefined) updateFields["answers.$.passedCount"] = passedCount;
    if (totalCount !== undefined) updateFields["answers.$.totalCount"] = totalCount;
    if (executionStatus !== undefined) updateFields["answers.$.executionStatus"] = executionStatus;
    if (scoredMarks !== undefined) updateFields["answers.$.scoredMarks"] = scoredMarks;

    const result = await TestAttempt.updateOne(
      {
        _id: attemptId,
        userId,
        status: "started",
        "answers.questionIndex": questionIndex,
      },
      { $set: updateFields }
    );

    if (result.matchedCount > 0) {
      return res.json({ message: "Answer saved" });
    }

    // Fallback: Check if attempt exists / ended / expired
    const attempt = await TestAttempt.findOne({ _id: attemptId, userId });
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });
    if (attempt.status === "completed" || attempt.status === "auto_submitted") {
      return res.status(400).json({ message: "Test already submitted" });
    }

    const now = new Date();
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
      if (codingScore !== undefined) ans.codingScore = codingScore;
      if (passedCount !== undefined) ans.passedCount = passedCount;
      if (totalCount !== undefined) ans.totalCount = totalCount;
      if (executionStatus !== undefined) ans.executionStatus = executionStatus;
      if (scoredMarks !== undefined) ans.scoredMarks = scoredMarks;
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
      // Coalesce rapid duplicate triggers for the same incident (within 2000ms)
      const lastSwitchTime = attempt.tabSwitches && attempt.tabSwitches.length > 0
        ? new Date(attempt.tabSwitches[attempt.tabSwitches.length - 1].timestamp).getTime()
        : 0;
      const isDuplicateIncident = (Date.now() - lastSwitchTime) < 2000;

      if (!isDuplicateIncident) {
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
    const now = new Date();

    const attempt = await TestAttempt.findOne({ _id: attemptId, userId })
      .select("status endTime lastHeartbeatAt tabSwitchCount totalAwayTimeSeconds assignmentId")
      .lean();
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });

    let autoSubmit = attempt.status === "auto_submitted";

    if (attempt.status === "started" && attempt.endTime && now.getTime() > new Date(attempt.endTime).getTime() + 60000) {
      await TestAttempt.updateOne(
        { _id: attemptId, userId, status: "started" },
        { $set: { status: "auto_submitted", autoSubmitReason: "Time expired", submittedAt: now } }
      );
      if (attempt.assignmentId) {
        await TestAssignment.findByIdAndUpdate(attempt.assignmentId, {
          $inc: { completedCount: 1, autoSubmittedCount: 1 },
        });
      }
      autoSubmit = true;
    } else if (attempt.status === "started") {
      let extraAwayTime = 0;
      if (attempt.lastHeartbeatAt) {
        const gapSec = Math.round((now.getTime() - new Date(attempt.lastHeartbeatAt).getTime()) / 1000);
        if (gapSec > 45) {
          extraAwayTime = gapSec;
        }
      }

      if (extraAwayTime > 0) {
        await TestAttempt.updateOne(
          { _id: attemptId, userId },
          {
            $set: { lastHeartbeatAt: now },
            $inc: { totalAwayTimeSeconds: extraAwayTime },
            $push: {
              integrityEvents: {
                eventType: "heartbeat_gap",
                timestamp: now,
                durationSeconds: extraAwayTime,
                details: { gapSeconds: extraAwayTime },
              },
            },
          }
        );
      } else {
        await TestAttempt.updateOne(
          { _id: attemptId, userId },
          { $set: { lastHeartbeatAt: now } }
        );
      }
    }

    res.json({
      success: true,
      serverTime: now.toISOString(),
      status: autoSubmit ? "auto_submitted" : attempt.status,
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
    const userId = (req.user._id || req.user.id)?.toString();
    const { forceSubmit } = req.body;

    const now = new Date();
    let attempt = await TestAttempt.findOne({ _id: attemptId, userId }).populate("testId");

    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    if (attempt.status === "completed" || attempt.status === "auto_submitted") {
      let testResult = await TestResult.findOne({ attemptId }).lean();
      if (!testResult) {
        const proc = await processResult(attempt._id);
        testResult = proc?.result;
      }
      const existingTest = attempt.testId;
      const totalM = existingTest?.questions?.reduce((s, q) => s + (q.marks || 0), 0) || 0;
      return res.json({
        message: "Test already submitted",
        attempt: {
          _id: attempt._id,
          status: attempt.status,
          totalScore: testResult ? testResult.obtainedMarks : attempt.totalScore,
          totalMarks: totalM,
          submittedAt: attempt.submittedAt,
        },
        resultProcessed: true,
        resultId: testResult?._id || null,
      });
    }

    const test = attempt.testId;
    const isPastDeadline = attempt.endTime && now.getTime() > new Date(attempt.endTime).getTime() + 60000;
    const finalStatus = (forceSubmit === "auto" || isPastDeadline) ? "auto_submitted" : "completed";
    let autoReason = "";

    if (forceSubmit === "auto") {
      autoReason = attempt.autoSubmitReason || "Time expired";
    } else if (isPastDeadline) {
      autoReason = "Submitted after deadline";
    }

    attempt.status = finalStatus;
    if (autoReason) attempt.autoSubmitReason = autoReason;
    attempt.submittedAt = now;
    attempt.endTime = now;
    await attempt.save();

    // Process result synchronously so result is ready and authoritative immediately
    let finalTotalScore = 0;
    let testResult = null;
    try {
      const processed = await processResult(attempt._id);
      testResult = processed?.result;
      if (testResult) {
        finalTotalScore = testResult.obtainedMarks || 0;
      }
    } catch (procErr) {
      console.error("Result processor error in submitTest:", procErr);
      throw new Error(`Failed to process assessment result: ${procErr.message}`);
    }

    await TestAttempt.updateOne(
      { _id: attempt._id },
      { $set: { totalScore: finalTotalScore } }
    );

    if (attempt.assignmentId) {
      try {
        await TestAssignment.findByIdAndUpdate(attempt.assignmentId, {
          $inc: { completedCount: 1, ...(finalStatus === "auto_submitted" ? { autoSubmittedCount: 1 } : {}) },
          averageScore: finalTotalScore,
        });
      } catch (assignErr) {
        console.warn("Assignment update warning:", assignErr.message);
      }
    }

    res.json({
      message: "Test submitted",
      attempt: {
        _id: attempt._id,
        status: finalStatus,
        totalScore: finalTotalScore,
        totalMarks: test.questions.reduce((s, q) => s + (q.marks || 0), 0),
        submittedAt: attempt.submittedAt,
      },
      resultProcessed: true,
      resultId: testResult?._id || null,
    });
  } catch (error) {
    console.error("Submit Test Error:", error);
    res.status(500).json({ message: error.message || "Failed to submit test" });
  }
};

export const getTestResult = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const userId = (req.user._id || req.user.id)?.toString();
    const attempt = await TestAttempt.findOne({ _id: attemptId, userId })
      .populate("testId")
      .lean();
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });

    // Single source of truth: Load or generate TestResult
    let testResult = await TestResult.findOne({ attemptId }).lean();
    if (!testResult && (attempt.status === "completed" || attempt.status === "auto_submitted")) {
      const proc = await processResult(attemptId);
      testResult = proc?.result;
    }

    const test = attempt.testId;
    const totalMarks = testResult ? testResult.totalMarks : test.questions.reduce((s, q) => s + (q.marks || 0), 0);
    const obtainedScore = testResult ? testResult.obtainedMarks : attempt.totalScore;
    const answered = testResult ? testResult.attempted : attempt.answers.filter(a => a.status === "answered").length;
    const skipped = testResult ? testResult.skipped : attempt.answers.filter(a => a.status === "skipped").length;
    const marked = attempt.answers.filter(a => a.status === "marked").length;
    const notVisited = testResult ? testResult.notVisited : attempt.answers.filter(a => a.status === "not_visited").length;
    const percentage = testResult ? testResult.percentage : (totalMarks > 0 ? Math.round((obtainedScore / totalMarks) * 100) : 0);
    const passingPercentage = Number(test.passingMarks) || 0;
    const passingMarks = computePassingMarks(totalMarks, passingPercentage);
    const passed = testResult ? testResult.passed : calculatePassFail(obtainedScore, passingMarks);

    res.json({
      attempt: {
        _id: attempt._id,
        status: attempt.status,
        totalScore: obtainedScore,
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
        attemptCount: attempt.attemptCount || 1,
      },
      test: {
        _id: test._id,
        title: test.title,
        companyId: test.companyId,
        testType: test.testType,
        difficulty: test.difficulty,
        duration: test.duration,
        passingMarks: test.passingMarks,
        attemptLimit: test.attemptLimit || 1,
      },
      sections: testResult?.sections || [],
      questions: testResult?.questions || [],
      ranking: testResult?.ranking || null,
      canRetake: (attempt.attemptCount || 1) < (test.attemptLimit || 1),
      attemptsRemaining: Math.max(0, (test.attemptLimit || 1) - (attempt.attemptCount || 1)),
    });
  } catch (error) {
    console.error("Get Result Error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch result" });
  }
};
