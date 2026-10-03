import TestResult from "../models/TestResult.js";
import Test from "../models/Test.js";
import TestAttempt from "../models/TestAttempt.js";
import { processResult } from "../services/resultProcessor.js";
import { computeAllTestRankings } from "../utils/rankingEngine.js";

export const processTestResult = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { result, isNew } = await processResult(attemptId);
    const status = isNew ? 201 : 200;
    res.status(status).json({
      message: isNew ? "Result processed successfully" : "Result already exists",
      result,
    });
  } catch (error) {
    console.error("Process Result Error:", error.message);
    if (
      error.message.includes("not found") ||
      error.message.includes("not completed")
    ) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Failed to process result" });
  }
};

export const getResultById = async (req, res) => {
  try {
    const { resultId } = req.params;
    const result = await TestResult.findById(resultId)
      .populate("testId", "title description testType difficulty duration passingMarks")
      .lean();
    if (!result) return res.status(404).json({ message: "Result not found" });
    res.json(result);
  } catch (error) {
    console.error("Get Result Error:", error.message);
    res.status(500).json({ message: "Failed to fetch result" });
  }
};

export const getResultsByTest = async (req, res) => {
  try {
    const { testId } = req.params;
    const test = await Test.findById(testId).lean();
    if (!test) return res.status(404).json({ message: "Test not found" });

    const results = await TestResult.find({ testId })
      .populate("userId", "name email department year")
      .sort({ percentage: -1 })
      .lean();

    res.json({
      test: {
        _id: test._id,
        title: test.title,
        testType: test.testType,
        totalStudents: results.length,
      },
      results,
    });
  } catch (error) {
    console.error("Get Results By Test Error:", error.message);
    res.status(500).json({ message: "Failed to fetch results" });
  }
};

export const getStudentResults = async (req, res) => {
  try {
    const userId = req.user.id;
    const results = await TestResult.find({ userId })
      .populate("testId", "title description testType difficulty duration passingMarks")
      .sort({ createdAt: -1 })
      .lean();
    res.json(results);
  } catch (error) {
    console.error("Get Student Results Error:", error.message);
    res.status(500).json({ message: "Failed to fetch results" });
  }
};

export const getStudentResultByAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const userId = req.user.id;

    const result = await TestResult.findOne({ attemptId, userId })
      .populate("testId", "title description testType difficulty duration passingMarks companyId")
      .lean();
    if (!result) {
      const attempt = await TestAttempt.findOne({ _id: attemptId, userId })
        .populate("testId")
        .lean();
      if (!attempt) return res.status(404).json({ message: "Result not found" });
      return res.json({
        message: "Result not yet processed",
        status: "pending",
        attempt: {
          _id: attempt._id,
          status: attempt.status,
          totalScore: attempt.totalScore,
          submittedAt: attempt.submittedAt,
        },
      });
    }
    res.json(result);
  } catch (error) {
    console.error("Get Student Result By Attempt Error:", error.message);
    res.status(500).json({ message: "Failed to fetch result" });
  }
};

export const getTestRankings = async (req, res) => {
  try {
    const { testId } = req.params;
    const results = await TestResult.find({ testId, processedAt: { $ne: null } })
      .populate("userId", "name email department year")
      .sort({ "ranking.testRank": 1 })
      .lean();

    res.json({
      testId,
      totalParticipants: results.length,
      rankings: results.map(r => ({
        rank: r.ranking?.testRank || 0,
        name: r.studentInfo?.name || r.userId?.name || "",
        email: r.studentInfo?.email || r.userId?.email || "",
        department: r.studentInfo?.department || r.userId?.department || "",
        year: r.studentInfo?.year || r.userId?.year || "",
        percentage: r.percentage,
        grade: r.grade,
        passed: r.passed,
        obtainedMarks: r.obtainedMarks,
        totalMarks: r.totalMarks,
      })),
    });
  } catch (error) {
    console.error("Get Rankings Error:", error.message);
    res.status(500).json({ message: "Failed to fetch rankings" });
  }
};

export const recomputeRankings = async (req, res) => {
  try {
    const { testId } = req.params;
    const result = await computeAllTestRankings(testId, TestResult);
    res.json({
      message: "Rankings recomputed",
      ...result,
    });
  } catch (error) {
    console.error("Recompute Rankings Error:", error.message);
    res.status(500).json({ message: "Failed to recompute rankings" });
  }
};

export const getResultStats = async (req, res) => {
  try {
    const { testId } = req.params;
    const results = await TestResult.find({ testId }).lean();
    if (!results.length) {
      return res.json({ message: "No results yet", stats: null });
    }

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const percentages = results.map(r => r.percentage).filter(p => p != null);
    const avgPercentage = percentages.length
      ? Math.round(percentages.reduce((s, p) => s + p, 0) / percentages.length)
      : 0;
    const highest = percentages.length ? Math.max(...percentages) : 0;
    const lowest = percentages.length ? Math.min(...percentages) : 0;

    const gradeDistribution = {};
    for (const r of results) {
      if (r.grade) gradeDistribution[r.grade] = (gradeDistribution[r.grade] || 0) + 1;
    }

    res.json({
      totalProcessed: results.length,
      passed,
      failed,
      passPercentage: results.length ? Math.round((passed / results.length) * 100) : 0,
      avgPercentage,
      highestPercentage: highest,
      lowestPercentage: lowest,
      gradeDistribution,
    });
  } catch (error) {
    console.error("Get Result Stats Error:", error.message);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
};
