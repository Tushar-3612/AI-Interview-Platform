import mongoose from "mongoose";
import Interview from "../models/Interview.js";
import CodingSubmission from "../models/CodingSubmission.js";
import PracticeAttempt from "../models/PracticeAttempt.js";
import CompanyMockAttempt from "../models/CompanyMockAttempt.js";
import MockOAAttempt from "../models/MockOAAttempt.js";
import Result from "../models/Result.js";
import User from "../models/User.js";
import Company from "../models/Company.js";
import { dateKey, startOfDay } from "../services/placementEngine.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Compute current consecutive-day streak from a Set of active day keys.
 * Mirrors the logic in placementEngine.js computeStreaks().
 */
function computeCurrentStreak(activeDays) {
  if (activeDays.size === 0) return 0;
  const set = new Set(activeDays);
  let current = 0;
  let cursor = startOfDay();
  if (!set.has(dateKey(cursor))) {
    cursor = addDays(cursor, -1);
  }
  while (set.has(dateKey(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return current;
}

/**
 * Collect all unique activity day keys for a user across practice,
 * coding, interview results, and mock OA attempts.
 */
async function getActiveDays(userId) {
  const oid = new mongoose.Types.ObjectId(userId);
  const [attempts, submissions, results, mockOAs] = await Promise.all([
    PracticeAttempt.find({ userId: oid }).select("createdAt").lean(),
    CodingSubmission.find({ userId: oid }).select("createdAt").lean(),
    Result.find({ userId: oid }).select("createdAt").lean(),
    MockOAAttempt.find({ userId: oid }).select("createdAt").lean(),
  ]);
  const days = new Set();
  for (const docs of [attempts, submissions, results, mockOAs]) {
    for (const d of docs) days.add(dateKey(d.createdAt));
  }
  return days;
}

/**
 * GET /api/student/dashboard-stats
 *
 * Returns all dashboard statistics computed from real data:
 * - interviewsCompleted (actual interviews only)
 * - mockInterviewsCompleted
 * - mockInterviewsInProgress
 * - codingProblemsSolved
 * - currentStreak
 * - rank
 * - targetCompany
 * - companies (for target company selection)
 */
export const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const oid = new mongoose.Types.ObjectId(userId);

    const [
      actualInterviewsCompleted,
      mockInterviewsCompleted,
      mockInterviewsInProgress,
      codingProblemsSolved,
      activeDays,
      user,
      allUsers,
      aptAgg,
      codAgg,
      mockAgg,
      resultAgg,
      activityAgg,
      companies,
      companyMockAttempts,
    ] = await Promise.all([
      // 1. Actual interviews completed (interviewType = "actual" or "real" for backward compatibility)
      Interview.countDocuments({ userId: oid, interviewType: { $in: ["actual", "real"] }, status: "completed" }),

      // 2. Company mock interviews completed
      CompanyMockAttempt.countDocuments({ userId: oid, status: { $in: ["completed", "auto_submitted"] } }),

      // 3. Company mock interviews in progress
      CompanyMockAttempt.countDocuments({ userId: oid, status: "in_progress" }),

      // 4. Coding problems solved (unique questionIds with accepted status)
      CodingSubmission.distinct("questionId", { userId: oid, status: "accepted" }).then((ids) => ids.length),

      // 5. Active days for streak
      getActiveDays(userId),

      // 6. Target company
      User.findById(userId).select("targetCompany").lean(),

      // 7. Rank — need all users for leaderboard computation
      User.find().select("name department year").lean(),

      // Leaderboard aggregation components
      PracticeAttempt.aggregate([
        { $group: { _id: "$userId", attempts: { $sum: 1 }, avgPct: { $avg: "$percentage" }, correct: { $sum: "$correct" }, answered: { $sum: { $add: ["$correct", "$wrong"] } } } },
      ]),
      CodingSubmission.aggregate([
        { $match: { status: { $ne: "unsupported" } } },
        { $group: { _id: "$userId", subs: { $sum: 1 }, accepted: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } } } },
      ]),
      MockOAAttempt.aggregate([
        { $group: { _id: "$userId", count: { $sum: 1 }, avgScore: { $avg: "$overallScore" } } },
      ]),
      Result.aggregate([
        { $group: { _id: "$userId", count: { $sum: 1 }, avgScore: { $avg: "$overallScore" } } },
      ]),
      (async () => {
        const [a, b, c, d] = await Promise.all([
          PracticeAttempt.aggregate([{ $group: { _id: "$userId", n: { $sum: 1 } } }]),
          CodingSubmission.aggregate([{ $match: { status: { $ne: "unsupported" } } }, { $group: { _id: "$userId", n: { $sum: 1 } } }]),
          MockOAAttempt.aggregate([{ $group: { _id: "$userId", n: { $sum: 1 } } }]),
          Result.aggregate([{ $group: { _id: "$userId", n: { $sum: 1 } } }]),
        ]);
        const map = new Map();
        for (const g of [a, b, c, d]) {
          for (const x of g) map.set(String(x._id), (map.get(String(x._id)) || 0) + x.n);
        }
        return [...map.entries()].map(([id, n]) => ({ _id: id, n }));
      })(),

      // 8. Companies for target company selection
      Company.find({ status: "active", isDeleted: false }).select("id name").lean(),

      // 9. Company Mock Interview attempts (completed) for dashboard statistics
      CompanyMockAttempt.find({ userId: oid, status: { $in: ["completed", "auto_submitted"] } })
        .select("companyName scores.overall scores.aptitude.total scores.technical.total scores.coding.accepted scores.coding.total createdAt")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    // 5. Compute current streak
    const currentStreak = computeCurrentStreak(activeDays);

    // 6. Compute rank from leaderboard
    const aptMap = new Map(aptAgg.map((x) => [String(x._id), x]));
    const codMap = new Map(codAgg.map((x) => [String(x._id), x]));
    const mockMap = new Map(mockAgg.map((x) => [String(x._id), x]));
    const resultMap = new Map(resultAgg.map((x) => [String(x._id), x]));
    const activityMap = new Map(activityAgg.map((x) => [String(x._id), x.n]));

    const rows = allUsers
      .map((u) => {
        const apt = aptMap.get(String(u._id));
        const cod = codMap.get(String(u._id));
        const aptitude = apt?.avgPct ? Math.round(apt.avgPct) : 0;
        const coding = cod?.subs ? Math.round((cod.accepted / cod.subs) * 100) : 0;
        const accuracy = apt?.answered ? Math.round((apt.correct / apt.answered) * 100) : 0;
        const mockScores = [
          mockMap.get(String(u._id))?.avgScore,
          resultMap.get(String(u._id))?.avgScore,
        ].filter((v) => v != null);
        const mockScore = mockScores.length
          ? Math.round(mockScores.reduce((s, v) => s + v, 0) / mockScores.length)
          : 0;
        const activity = activityMap.get(String(u._id)) || 0;
        const consistency = Math.round(Math.min(activity, 100));
        const placement = Math.round(
          coding * 0.25 + aptitude * 0.25 + accuracy * 0.2 + consistency * 0.2 + mockScore * 0.1
        );
        return { userId: String(u._id), placement, activity };
      })
      .filter((r) => r.activity > 0)
      .sort((a, b) => b.placement - a.placement);

    const userRankIndex = rows.findIndex((r) => r.userId === String(userId));
    const rank = userRankIndex >= 0 ? userRankIndex + 1 : null;

    // Company Mock Interview dashboard statistics.
    let companyMock = null;
    if (companyMockAttempts && companyMockAttempts.length > 0) {
      const overallScores = companyMockAttempts.map((a) => a.scores?.overall ?? 0);
      const bestScore = Math.max(...overallScores);
      const latestScore = overallScores[0];
      const latestCompany = companyMockAttempts[0].companyName;
      const questionsSolved = companyMockAttempts.reduce(
        (sum, a) =>
          sum +
          (a.scores?.aptitude?.total || 0) +
          (a.scores?.technical?.total || 0) +
          (a.scores?.coding?.total || 0),
        0
      );
      const codingProblemsSolved = companyMockAttempts.reduce(
        (sum, a) => sum + (a.scores?.coding?.accepted || 0),
        0
      );
      const recent = companyMockAttempts.slice(0, 5).map((a) => ({
        companyName: a.companyName,
        companyId: a.companyId,
        overallScore: a.scores?.overall ?? 0,
        createdAt: a.createdAt,
        attemptId: a._id,
      }));
      companyMock = {
        completed: companyMockAttempts.length,
        bestScore,
        latestScore,
        latestCompany,
        questionsSolved,
        codingProblemsSolved,
        recent,
      };
    }

    res.json({
      interviewsCompleted: actualInterviewsCompleted,
      mockInterviewsCompleted,
      mockInterviewsInProgress,
      codingProblemsSolved,
      currentStreak,
      rank,
      targetCompany: user?.targetCompany || "",
      companies: companies.map((c) => ({ id: c.id, name: c.name })),
      companyMock,
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error.message);
    res.status(500).json({ message: "Failed to load dashboard stats" });
  }
};
