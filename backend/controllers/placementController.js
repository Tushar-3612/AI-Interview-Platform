import mongoose from "mongoose";
import Company from "../models/Company.js";
import User from "../models/User.js";
import CodingQuestion from "../models/CodingQuestion.js";
import PracticeAttempt from "../models/PracticeAttempt.js";
import MockOAAttempt from "../models/MockOAAttempt.js";
import {
  getStudentPlacementData,
  invalidateStudentPlacement,
  computeLeaderboard,
  computeAdminQuestionQuality,
  computeQuestionAnalytics,
  computePerformanceData,
} from "../services/placementEngine.js";
import { selectRandomQuestions, getQuestionById, getBankMap, shuffleArray } from "../services/questionBank.js";
import { getCache, setCache, deleteCacheByPrefix } from "../services/cacheService.js";

function cleanPaperQuestion(q) {
  return {
    questionId: q.questionId,
    category: q.category,
    question: q.question,
    options: q.options,
    difficulty: q.difficulty,
    marks: q.marks,
  };
}

/* ── 1. Overview: readiness + company readiness + recommendations + goals + streaks + heatmap + achievements + prediction + roadmap ── */
export const getPlacementOverview = async (req, res) => {
  try {
    const data = await getStudentPlacementData(req.user.id);
    res.json(data);
  } catch (error) {
    console.error("Placement Overview Error:", error.message);
    res.status(500).json({ message: "Failed to load placement overview" });
  }
};

/* ── 9. Company wise analytics (student) ── */
export const getStudentCompanyAnalytics = async (req, res) => {
  try {
    const overview = await getStudentPlacementData(req.user.id);
    res.json({ companies: overview.companyReadiness });
  } catch (error) {
    console.error("Student Company Analytics Error:", error.message);
    res.status(500).json({ message: "Failed to load company analytics" });
  }
};

/* ── 12. Performance chart data ── */
export const getPerformanceData = async (req, res) => {
  try {
    const cacheKey = `performance:${req.user.id}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);
    const data = await computePerformanceData(req.user.id);
    res.json(setCache(cacheKey, data, 60 * 1000));
  } catch (error) {
    console.error("Performance Data Error:", error.message);
    res.status(500).json({ message: "Failed to load performance data" });
  }
};

/* ── 13. Question analytics ── */
export const getStudentQuestionAnalytics = async (req, res) => {
  try {
    const cacheKey = `qanalytics:${req.user.id}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);
    const data = await computeQuestionAnalytics(req.user.id);
    res.json(setCache(cacheKey, data, 60 * 1000));
  } catch (error) {
    console.error("Question Analytics Error:", error.message);
    res.status(500).json({ message: "Failed to load question analytics" });
  }
};

/* ── 8. Leaderboard ── */
export const getLeaderboard = async (req, res) => {
  try {
    const { type = "overall", period = "overall", department = "", year = "", limit = 50 } = req.query;
    const cacheKey = `leaderboard:${type}:${period}:${department}:${year}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);
    const data = await computeLeaderboard({ type, period, department, year, limit: parseInt(limit) || 50 });
    res.json(setCache(cacheKey, data, 5 * 60 * 1000));
  } catch (error) {
    console.error("Leaderboard Error:", error.message);
    res.status(500).json({ message: "Failed to load leaderboard" });
  }
};

/* ── 17. Mock OA ── */
export const startMockOA = async (req, res) => {
  try {
    const userId = req.user.id;
    const { companyId } = req.params;
    const company = await Company.findOne({ id: companyId, isDeleted: { $ne: true }, status: "active" }).lean();
    if (!company) return res.status(404).json({ message: "Company not found" });

    // Aptitude — 15 mixed questions from the in-memory bank for this company
    const aptitude = shuffleArray(
      selectRandomQuestions({ count: 15, distribution: { easy: 5, medium: 5, hard: 5 }, companyId }).map(cleanPaperQuestion)
    ).map((q) => ({ ...q, options: shuffleArray(q.options) }));

    // Coding — 2 random questions, test cases NEVER exposed to the client
    const codingPool = await CodingQuestion.find({
      companyId,
      isDeleted: { $ne: true },
      isActive: true,
    })
      .select("title difficulty problemStatement description inputFormat outputFormat constraints sampleInput sampleOutput examples starterCode languages timeLimit marks")
      .lean();
    const coding = shuffleArray(codingPool).slice(0, 2);

    const durationMin = 60; // 15 aptitude (90s each) + 2 coding (20min each) + buffer

    res.json({
      companyId: company.id,
      companyName: company.name,
      color: company.color,
      aptitude,
      coding,
      durationMinutes: durationMin,
      instructions: [
        "Attempt all aptitude questions before moving to coding.",
        "You can code in any supported language.",
        "Coding questions are auto-evaluated against hidden test cases.",
        "The timer starts immediately and cannot be paused.",
        "Tab switching is monitored — stay on the exam window.",
      ],
    });
  } catch (error) {
    console.error("Start Mock OA Error:", error.message);
    res.status(500).json({ message: "Failed to start mock OA" });
  }
};

export const submitMockOA = async (req, res) => {
  try {
    const userId = req.user.id;
    const { companyId, companyName = "", answers = {}, aptitudeQuestions = [], codingResults = [], timeTakenSec = 0, durationSec = 0 } = req.body;
    const bankMap = getBankMap();

    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    const details = [];

    for (const item of aptitudeQuestions) {
      const questionId = String(item.questionId ?? item._id);
      const base = getQuestionById(questionId) || item;
      const userAnswer = answers[questionId] != null ? String(answers[questionId]) : null;
      const isCorrect = userAnswer != null && base.correctAnswer != null && userAnswer === String(base.correctAnswer);
      if (userAnswer == null) skipped++;
      else if (isCorrect) correct++;
      else wrong++;
      details.push({
        questionId,
        category: base.category || item.category || "General",
        question: base.question || item.question || "",
        options: base.options || item.options || [],
        correctAnswer: base.correctAnswer || "",
        difficulty: base.difficulty || item.difficulty || "easy",
        explanation: base.explanation || item.explanation || "",
        marks: Number(base.marks || item.marks) || 1,
        userAnswer,
        isCorrect,
      });
    }

    const aptitudeTotal = details.length;
    const aptitudePercentage = aptitudeTotal > 0 ? Math.round((correct / aptitudeTotal) * 100) : 0;

    // Persist aptitude as a regular practice attempt so it feeds all analytics
    if (aptitudeTotal > 0) {
      await PracticeAttempt.create({
        userId,
        companyId,
        companyName,
        questionCount: aptitudeTotal,
        difficulty: "mixed",
        questions: details,
        score: correct,
        correct,
        wrong,
        skipped,
        percentage: aptitudePercentage,
        timeTaken: Number(timeTakenSec) || 0,
      });
    }

    const attempted = (codingResults || []).filter((c) => c.attempted).length;
    const accepted = (codingResults || []).filter((c) => c.status === "accepted").length;
    const codingTotal = (codingResults || []).length;

    const codingScore = codingTotal > 0 ? Math.round((accepted / codingTotal) * 100) : 0;
    const overallScore = aptitudeTotal + codingTotal > 0
      ? Math.round((aptitudePercentage * aptitudeTotal + codingScore * codingTotal) / (aptitudeTotal + codingTotal))
      : 0;

    const attempt = await MockOAAttempt.create({
      userId,
      companyId,
      companyName,
      durationSec: Number(durationSec) || 0,
      timeTakenSec: Number(timeTakenSec) || 0,
      aptitude: { total: aptitudeTotal, correct, wrong, skipped, percentage: aptitudePercentage },
      coding: { attempted, accepted, total: codingTotal },
      overallScore,
    });

    deleteCacheByPrefix(`placement:${userId}`);
    deleteCacheByPrefix(`performance:${userId}`);
    deleteCacheByPrefix("leaderboard:");

    res.status(201).json({
      _id: attempt._id,
      overallScore,
      aptitude: { total: aptitudeTotal, correct, wrong, skipped, percentage: aptitudePercentage },
      coding: { attempted, accepted, total: codingTotal },
      timeTakenSec: attempt.timeTakenSec,
      companyName,
    });
  } catch (error) {
    console.error("Submit Mock OA Error:", error.message);
    res.status(500).json({ message: "Failed to submit mock OA" });
  }
};

export const getMockOAHistory = async (req, res) => {
  try {
    const attempts = await MockOAAttempt.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json({ attempts });
  } catch (error) {
    console.error("Mock OA History Error:", error.message);
    res.status(500).json({ message: "Failed to load mock OA history" });
  }
};

/* ── 14 + 15. Admin analytics & question quality ── */
export const getAdminPlacementAnalytics = async (req, res) => {
  try {
    const cacheKey = "admin:quality";
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);
    const data = await computeAdminQuestionQuality();
    res.json(setCache(cacheKey, data, 5 * 60 * 1000));
  } catch (error) {
    console.error("Admin Placement Analytics Error:", error.message);
    res.status(500).json({ message: "Failed to load placement analytics" });
  }
};

export const getCompanyChoices = async (req, res) => {
  try {
    const companies = await Company.find({ isDeleted: { $ne: true }, status: "active" })
      .select("id name color")
      .sort({ name: 1 })
      .lean();
    res.json({ companies });
  } catch (error) {
    res.status(500).json({ message: "Failed to load companies" });
  }
};

export const getFilterOptions = async (req, res) => {
  try {
    const [departments, years] = await Promise.all([
      User.distinct("department"),
      User.distinct("year"),
    ]);
    res.json({ departments: departments.filter(Boolean), years: years.filter(Boolean) });
  } catch (error) {
    res.status(500).json({ message: "Failed to load filter options" });
  }
};
