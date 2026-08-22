/**
 * Placement Intelligence Engine
 * ---------------------------------------------------------------
 * Pure computation layer that derives all placement intelligence
 * (readiness, company readiness, weak topics, recommendations,
 * streaks, heatmap, achievements, prediction, roadmap, leaderboard,
 * question analytics, admin question quality) from the existing
 * MongoDB collections. No schema redesign, no new data sources.
 */
import mongoose from "mongoose";
import Company from "../models/Company.js";
import User from "../models/User.js";
import PracticeAttempt from "../models/PracticeAttempt.js";
import CodingSubmission from "../models/CodingSubmission.js";
import CodingQuestion from "../models/CodingQuestion.js";
import AptitudeQuestion from "../models/AptitudeQuestion.js";
import Result from "../models/Result.js";
import StudentPreference from "../models/StudentPreference.js";
import MockOAAttempt from "../models/MockOAAttempt.js";
import AchievementUnlock from "../models/AchievementUnlock.js";
import { yearQuery } from "../utils/academicConfig.js";
import Notification from "../models/Notification.js";
import { getCache, setCache, deleteCacheByPrefix } from "./cacheService.js";
import { createNotification } from "./notificationService.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/* ───────────────────────── helpers ───────────────────────── */

export function dateKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function round(value) {
  return Math.round(Number(value) || 0);
}

function weightedAverage(entries) {
  const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
  if (totalWeight <= 0) return 0;
  return entries.reduce((s, e) => s + e.value * e.weight, 0) / totalWeight;
}

function readinessLabel(score) {
  if (score >= 85) return "Ready";
  if (score >= 70) return "Needs Practice";
  if (score >= 50) return "Needs Improvement";
  return "Critical";
}

function overallLabel(score) {
  if (score >= 85) return "Placement Ready";
  if (score >= 70) return "Good Progress";
  if (score >= 50) return "Needs Practice";
  return "Getting Started";
}

function diffMultiplier(difficulty) {
  const d = String(difficulty || "").toLowerCase();
  if (d === "hard") return 1.25;
  if (d === "medium") return 1.1;
  return 1;
}

export function buildMixedCodingQuestionQuery(idList) {
  const ids = [...new Set((idList || []).map(String).filter(Boolean))];
  if (ids.length === 0) return { _id: { $in: [] } };
  const objIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const or = [];
  if (objIds.length > 0) or.push({ _id: { $in: objIds } });
  or.push({ questionId: { $in: ids } });
  return or.length === 1 ? or[0] : { $or: or };
}

/* ───────────────────────── streaks & heatmap ───────────────────────── */

function computeStreaks(activeDays) {
  const keys = [...activeDays].sort();
  const set = new Set(keys);

  let current = 0;
  if (keys.length > 0) {
    let cursor = startOfDay();
    if (!set.has(dateKey(cursor))) cursor = addDays(cursor, -1);
    while (set.has(dateKey(cursor))) {
      current++;
      cursor = addDays(cursor, -1);
    }
  }

  let best = 0;
  let run = 0;
  let prev = null;
  for (const k of keys) {
    const d = new Date(`${k}T00:00:00`);
    if (prev && d - prev === DAY_MS) run++;
    else run = 1;
    best = Math.max(best, run);
    prev = d;
  }

  const missedDays = [];
  for (let i = 29; i >= 1; i--) {
    const k = dateKey(addDays(startOfDay(), -i));
    if (!set.has(k)) missedDays.push(k);
  }

  const weekly = [];
  const monthly = [];
  const weeklyCount = {};
  const monthlyCount = {};
  for (let i = 6; i >= 0; i--) {
    const k = dateKey(addDays(startOfDay(), -i));
    weeklyCount[k] = 0;
  }
  for (let i = 29; i >= 0; i--) {
    const k = dateKey(addDays(startOfDay(), -i));
    monthlyCount[k] = 0;
  }
  for (const k of keys) {
    if (weeklyCount[k] !== undefined) weeklyCount[k]++;
    if (monthlyCount[k] !== undefined) monthlyCount[k]++;
  }
  for (const [k, count] of Object.entries(weeklyCount)) {
    weekly.push({ date: k, label: new Date(`${k}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" }), count });
  }
  for (const [k, count] of Object.entries(monthlyCount)) {
    monthly.push({ date: k, count });
  }

  return { current, best, missedDays, weekly, monthly, activeDays30: monthly.filter((m) => m.count > 0).length };
}

function buildHeatmap(activeDays) {
  const weeks = 26;
  const days = [];
  const today = startOfDay();
  const end = addDays(today, 6 - today.getDay());
  const start = addDays(end, -(weeks * 7 - 1));

  const counts = {};
  for (const k of activeDays) counts[k] = (counts[k] || 0) + 1;

  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i);
    const k = dateKey(d);
    const count = counts[k] || 0;
    let level = 0;
    if (count > 0) level = count >= 10 ? 4 : count >= 6 ? 3 : count >= 3 ? 2 : 1;
    days.push({ date: k, count, level, day: d.getDay(), month: d.toLocaleDateString("en-US", { month: "short" }) });
  }
  return days;
}

async function getActivityDays(userId) {
  const oid = new mongoose.Types.ObjectId(userId);
  const days = new Set();
  const [attempts, submissions, results, mockOAs] = await Promise.all([
    PracticeAttempt.find({ userId: oid }).select("createdAt").lean(),
    CodingSubmission.find({ userId: oid }).select("createdAt").lean(),
    Result.find({ userId: oid }).select("createdAt").lean(),
    MockOAAttempt.find({ userId: oid }).select("createdAt").lean(),
  ]);
  for (const docs of [attempts, submissions, results, mockOAs]) {
    for (const d of docs) days.add(dateKey(d.createdAt));
  }
  return days;
}

/* ───────────────────────── core student scores ───────────────────────── */

async function computeScores(userId) {
  const oid = new mongoose.Types.ObjectId(userId);
  const [attempts, submissions, results, mockOAs, user] = await Promise.all([
    PracticeAttempt.find({ userId: oid }).lean(),
    CodingSubmission.find({ userId: oid, status: { $ne: "unsupported" } }).lean(),
    Result.find({ userId: oid }).select("overallScore").lean(),
    MockOAAttempt.find({ userId: oid }).select("overallScore").lean(),
    User.findById(userId).select("name department year atsScore").lean(),
  ]);

  // Aptitude score — attempt percentages weighted by question count
  const aptitudeAttempts = attempts.length;
  const totalQ = attempts.reduce((s, a) => s + (a.questionCount || 0), 0);
  const aptitudeScore = totalQ > 0 ? round(attempts.reduce((s, a) => s + (a.percentage || 0) * (a.questionCount || 0), 0) / totalQ) : 0;

  // Coding score — per-question, latest submission, difficulty weighted
  const questionDifficulty = new Map();
  const codingQuestionIds = submissions.map((s) => s.questionId).filter(Boolean);
  if (codingQuestionIds.length > 0) {
    const qs = await CodingQuestion.find(buildMixedCodingQuestionQuery(codingQuestionIds)).select("difficulty questionId").lean();
    for (const q of qs) {
      questionDifficulty.set(String(q._id), q.difficulty);
      if (q.questionId) questionDifficulty.set(String(q.questionId), q.difficulty);
    }
  }
  const latestByQuestion = new Map();
  for (const s of submissions) {
    const key = String(s.questionId || "");
    const prev = latestByQuestion.get(key);
    if (!prev || new Date(s.createdAt) > new Date(prev.createdAt)) latestByQuestion.set(key, s);
  }
  let codingScore = 0;
  if (latestByQuestion.size > 0) {
    let sum = 0;
    for (const s of latestByQuestion.values()) {
      const passRate = s.totalCount > 0 ? s.passedCount / s.totalCount : 0;
      const base = s.status === "accepted" ? passRate : passRate * 0.5;
      const bonus = diffMultiplier(questionDifficulty.get(String(s.questionId)));
      sum += Math.min(1, base * bonus) * 100;
    }
    codingScore = round(sum / latestByQuestion.size);
  }

  // Problem solving — difficulty-wise mastery across aptitude + coding
  const diffStats = { easy: { attempted: 0, correct: 0 }, medium: { attempted: 0, correct: 0 }, hard: { attempted: 0, correct: 0 } };
  const aptitudeCorrect = { correct: 0, wrong: 0 };
  let fastAttempts = 0;
  let perfectAttempts = 0;
  for (const a of attempts) {
    const perQSec = a.questionCount > 0 ? (a.timeTaken || 0) / a.questionCount : 0;
    if (perQSec > 0 && perQSec <= 30) fastAttempts++;
    if (a.percentage === 100) perfectAttempts++;
    for (const q of a.questions || []) {
      const key = diffStats[String(q.difficulty).toLowerCase()] ? String(q.difficulty).toLowerCase() : "easy";
      diffStats[key].attempted++;
      if (q.isCorrect) { diffStats[key].correct++; aptitudeCorrect.correct++; }
      else aptitudeCorrect.wrong++;
    }
  }
  const codingDiffAttempts = { easy: 0, medium: 0, hard: 0 };
  for (const s of latestByQuestion.values()) {
    const d = String(questionDifficulty.get(String(s.questionId)) || "Easy").toLowerCase();
    const key = codingDiffAttempts[d] !== undefined ? d : "easy";
    codingDiffAttempts[key]++;
    if (s.status === "accepted") diffStats[key].correct++;
  }
  let hasDiffData = false;
  const accByDiff = {};
  for (const d of Object.keys(diffStats)) {
    const total = diffStats[d].attempted + (codingDiffAttempts[d] || 0);
    if (total > 0) {
      hasDiffData = true;
      accByDiff[d] = (diffStats[d].correct / total) * 100;
    }
  }
  const problemSolving = hasDiffData
    ? round((accByDiff.easy ?? 0) * 0.25 + (accByDiff.medium ?? 0) * 0.4 + (accByDiff.hard ?? 0) * 0.35)
    : 0;

  // Mock interview score
  const allMockScores = [...results.map((r) => r.overallScore), ...mockOAs.map((m) => m.overallScore)].filter((v) => v != null);
  const mockInterview = allMockScores.length > 0 ? round(allMockScores.reduce((s, v) => s + v, 0) / allMockScores.length) : 0;

  // Consistency
  const activeDays = await getActivityDays(userId);
  const streaks = computeStreaks(activeDays);
  const consistency = streaks.activeDays30 > 0 || streaks.current > 0
    ? round((streaks.activeDays30 / 30) * 60 + (Math.min(streaks.current, 30) / 30) * 40)
    : 0;

  const resumeScore = Number(user?.atsScore) || 0;

  // Overall readiness — weighted, renormalized when components absent
  const components = [
    { value: codingScore, weight: 0.25 },
    { value: aptitudeScore, weight: 0.25 },
    { value: problemSolving, weight: 0.15 },
    { value: consistency, weight: 0.15 },
    { value: mockInterview, weight: 0.15 },
  ];
  if (resumeScore > 0) components.push({ value: resumeScore, weight: 0.05 });
  const overall = round(weightedAverage(components));

  const bookmarks = await StudentPreference.countDocuments({ userId: oid, type: "bookmark" });

  return {
    scores: {
      overall,
      label: overallLabel(overall),
      coding: codingScore,
      aptitude: aptitudeScore,
      problemSolving,
      consistency,
      mockInterview,
      resume: resumeScore,
    },
    activity: {
      aptitudeAttempts,
      aptitudeCorrect: aptitudeCorrect.correct,
      aptitudeWrong: aptitudeCorrect.wrong,
      codingSubmissions: submissions.length,
      acceptedQuestions: latestByQuestion.size,
      bookmarks,
      fastAttempts,
      perfectAttempts,
      hasActivity: attempts.length + submissions.length > 0,
    },
    streaks,
    heatmap: buildHeatmap(activeDays),
    activeDays,
  };
}

/* ───────────────────────── company readiness ───────────────────────── */

async function computeCompanyReadiness(userId, userMockOAs) {
  const oid = new mongoose.Types.ObjectId(userId);
  const companies = await Company.find({ isDeleted: { $ne: true }, status: "active" }).sort({ name: 1 }).lean();
  const companyIds = companies.map((c) => c.id);

  const [aptAgg, codAgg] = await Promise.all([
    PracticeAttempt.aggregate([
      { $match: { userId: oid, companyId: { $in: companyIds } } },
      { $project: { companyId: 1, percentage: 1, questionCount: 1, timeTaken: 1, questions: 1, createdAt: 1 } },
      { $sort: { createdAt: -1 } },
    ]),
    CodingSubmission.aggregate([
      { $match: { userId: oid, companyId: { $in: companyIds }, status: { $ne: "unsupported" } } },
      { $project: { companyId: 1, status: 1, passedCount: 1, totalCount: 1, timeTakenMs: 1, questionId: 1, createdAt: 1 } },
      { $sort: { createdAt: -1 } },
    ]),
  ]);

  const perCompany = new Map(companies.map((c) => [c.id, { attempts: [], submissions: [] }]));
  for (const a of aptAgg) perCompany.get(a.companyId)?.attempts.push(a);
  for (const s of codAgg) perCompany.get(s.companyId)?.submissions.push(s);

  const codQIds = [...new Set(codAgg.map((s) => String(s.questionId)).filter(Boolean))];
  const codQMeta = new Map();
  if (codQIds.length > 0) {
    const qs = await CodingQuestion.find(buildMixedCodingQuestionQuery(codQIds)).select("difficulty tags category questionId").lean();
    for (const q of qs) {
      codQMeta.set(String(q._id), q);
      if (q.questionId) codQMeta.set(String(q.questionId), q);
    }
  }

  return companies.map((c) => {
    const { attempts, submissions } = perCompany.get(c.id);

    const totalQ = attempts.reduce((s, a) => s + (a.questionCount || 0), 0);
    const aptitude = totalQ > 0 ? round(attempts.reduce((s, a) => s + (a.percentage || 0) * (a.questionCount || 0), 0) / totalQ) : 0;

    let aptitudeAnswered = 0;
    let aptitudeCorrect = 0;
    const diffAnswered = { medium: 0, hard: 0 };
    const diffCorrect = { medium: 0, hard: 0 };
    const topicStats = new Map();
    const lastAttempt = attempts[0] || null;
    for (const a of attempts) {
      for (const q of a.questions || []) {
        if (q.userAnswer != null) aptitudeAnswered++;
        if (q.isCorrect) aptitudeCorrect++;
        const d = String(q.difficulty || "easy").toLowerCase();
        if (d === "medium" || d === "hard") {
          diffAnswered[d]++;
          if (q.isCorrect) diffCorrect[d]++;
        }
        const topic = q.category || "General";
        const st = topicStats.get(topic) || { attempted: 0, correct: 0 };
        st.attempted++;
        if (q.isCorrect) st.correct++;
        topicStats.set(topic, st);
      }
    }

    const latest = new Map();
    for (const s of submissions) {
      const key = String(s.questionId || "");
      const prev = latest.get(key);
      if (!prev || new Date(s.createdAt) > new Date(prev.createdAt)) latest.set(key, s);
    }
    let codingSum = 0;
    let codingAccepted = 0;
    let codTimeMsSum = 0;
    let codTimeCount = 0;
    for (const s of latest.values()) {
      const meta = s.questionId ? codQMeta.get(String(s.questionId)) : null;
      const passRate = s.totalCount > 0 ? s.passedCount / s.totalCount : 0;
      const base = s.status === "accepted" ? passRate : passRate * 0.5;
      codingSum += Math.min(1, base * diffMultiplier(meta?.difficulty)) * 100;
      if (s.status === "accepted") codingAccepted++;
      if (s.timeTakenMs) { codTimeMsSum += s.timeTakenMs; codTimeCount++; }
    }
    const coding = latest.size > 0 ? round(codingSum / latest.size) : 0;

    const accuracy = aptitudeAnswered > 0
      ? round((aptitudeCorrect / aptitudeAnswered) * 100)
      : latest.size > 0
        ? round((codingAccepted / latest.size) * 100)
        : 0;

    const aptTimeSec = attempts.length > 0 ? attempts.reduce((s, a) => s + (a.timeTaken || 0), 0) / attempts.length : 0;
    const codTimeSec = codTimeCount > 0 ? codTimeMsSum / codTimeCount / 1000 : 0;
    const expectedSec = totalQ * 75 + latest.size * 600;
    const actualSec = aptTimeSec + codTimeSec;
    const timeScore = expectedSec > 0 ? clamp(round((expectedSec / (expectedSec + actualSec)) * 100), 20, 100) : 0;

    const diffTotal = diffAnswered.medium + diffAnswered.hard;
    const difficultySolved = diffTotal > 0 ? round(((diffCorrect.medium + diffCorrect.hard) / diffTotal) * 100) : 0;

    const mock = userMockOAs.filter((m) => m.companyId === c.id).map((m) => m.overallScore).filter((v) => v != null);
    const companyMock = mock.length > 0 ? round(mock.reduce((s, v) => s + v, 0) / mock.length) : 0;

    const components = [
      { value: aptitude, weight: 0.25 },
      { value: coding, weight: 0.3 },
      { value: accuracy, weight: 0.15 },
      { value: timeScore, weight: 0.1 },
      { value: difficultySolved, weight: 0.1 },
    ];
    if (companyMock > 0) components.push({ value: companyMock, weight: 0.1 });
    const ready = round(weightedAverage(components));

    const weakTopics = [...topicStats.entries()]
      .map(([topic, st]) => ({ topic, attempted: st.attempted, accuracy: round((st.correct / st.attempted) * 100) }))
      .filter((t) => t.attempted >= 1 && t.accuracy < 70)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 3);

    return {
      companyId: c.id,
      companyName: c.name,
      color: c.color,
      readiness: ready,
      label: readinessLabel(ready),
      breakdown: { aptitude, coding, accuracy, timeScore, difficultySolved, mock: companyMock },
      questionsSolved: totalQ + latest.size,
      aptitudeQuestions: totalQ,
      codingQuestions: latest.size,
      averageTimeSec: round(actualSec),
      lastAttempt: lastAttempt ? { percentage: lastAttempt.percentage, createdAt: lastAttempt.createdAt } : null,
      weakTopics,
    };
  });
}

/* ───────────────────────── weak topics & recommendations ───────────────────────── */

async function computeWeakTopicsAndRecommendations(userId, scores, activity) {
  const oid = new mongoose.Types.ObjectId(userId);
  const [attempts, submissions] = await Promise.all([
    PracticeAttempt.find({ userId: oid }).select("questions").lean(),
    CodingSubmission.find({ userId: oid, status: { $ne: "unsupported" } }).select("questionId status createdAt").lean(),
  ]);

  const aptitudeTopics = new Map();
  for (const a of attempts) {
    for (const q of a.questions || []) {
      const topic = q.category || "General";
      const st = aptitudeTopics.get(topic) || { attempted: 0, correct: 0 };
      st.attempted++;
      if (q.isCorrect) st.correct++;
      aptitudeTopics.set(topic, st);
    }
  }

  const weakAptitude = [...aptitudeTopics.entries()]
    .map(([topic, st]) => ({ topic, kind: "aptitude", attempted: st.attempted, accuracy: round((st.correct / st.attempted) * 100) }))
    .filter((t) => t.attempted >= 1 && t.accuracy < 70)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 4);

  const codingTopics = new Map();
  const subQIds = submissions.map((s) => String(s.questionId)).filter(Boolean);
  const qMeta = new Map();
  if (subQIds.length > 0) {
    const qs = await CodingQuestion.find(buildMixedCodingQuestionQuery(subQIds)).select("tags questionId").lean();
    for (const q of qs) {
      qMeta.set(String(q._id), q.tags || []);
      if (q.questionId) qMeta.set(String(q.questionId), q.tags || []);
    }
  }
  const latestByQuestion = new Map();
  for (const s of submissions) {
    const key = String(s.questionId || "");
    const prev = latestByQuestion.get(key);
    if (!prev || new Date(s.createdAt) > new Date(prev.createdAt)) latestByQuestion.set(key, s);
  }
  for (const s of latestByQuestion.values()) {
    const tags = qMeta.get(String(s.questionId)) || ["General"];
    for (const tag of tags) {
      const st = codingTopics.get(tag) || { attempted: 0, correct: 0 };
      st.attempted++;
      if (s.status === "accepted") st.correct++;
      codingTopics.set(tag, st);
    }
  }
  const weakCoding = [...codingTopics.entries()]
    .map(([topic, st]) => ({ topic, kind: "coding", attempted: st.attempted, accuracy: round((st.correct / st.attempted) * 100) }))
    .filter((t) => t.attempted >= 1 && t.accuracy < 70)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 4);

  const weakTopics = [...weakAptitude, ...weakCoding];
  const recommendations = [];

  if (!activity.hasActivity) {
    recommendations.push({
      type: "onboarding",
      title: "Start your placement journey",
      detail: "Attempt your first aptitude test and coding problem to generate insights.",
      action: "Start Practicing",
      link: "/interview-practice",
      priority: 1,
    });
    return { weakTopics, recommendations };
  }

  for (const t of weakAptitude.slice(0, 3)) {
    recommendations.push({
      type: "aptitude",
      title: `Practice ${t.topic}`,
      detail: `Practice 10 ${t.topic} questions to push accuracy above 70%.`,
      action: "Practice Now",
      link: `/interview-practice?focus=${encodeURIComponent(t.topic)}`,
      priority: 1,
    });
  }
  for (const t of weakCoding.slice(0, 3)) {
    recommendations.push({
      type: "coding",
      title: `Solve ${t.topic} problems`,
      detail: `Solve 5 ${t.topic} problems to strengthen this area.`,
      action: "Open Coding",
      link: "/interview-practice",
      priority: 2,
    });
  }
  if (scores.coding > 0 && scores.coding < 40) {
    recommendations.push({
      type: "coding",
      title: "Start with easier coding problems",
      detail: "Build confidence with Easy problems before attempting Medium and Hard.",
      action: "Browse Easy Problems",
      link: "/interview-practice",
      priority: 3,
    });
  }
  if (scores.mockInterview === 0) {
    recommendations.push({
      type: "mock",
      title: "Attempt a Mock OA",
      detail: "Take a timed mock OA to experience the real exam format.",
      action: "Take Mock OA",
      link: "/placement/mock-oa",
      priority: 4,
    });
  } else if (scores.mockInterview < 60) {
    recommendations.push({
      type: "mock",
      title: "Improve your mock performance",
      detail: "Review past mock OAs and retry with a stronger strategy.",
      action: "Retry Mock OA",
      link: "/placement/mock-oa",
      priority: 4,
    });
  }
  return { weakTopics, recommendations };
}

/* ───────────────────────── daily goals ───────────────────────── */

async function computeDailyGoals(userId) {
  const oid = new mongoose.Types.ObjectId(userId);
  const today = startOfDay();
  const tomorrow = addDays(today, 1);

  const [aptQToday, codToday, mockToday] = await Promise.all([
    PracticeAttempt.aggregate([
      { $match: { userId: oid, createdAt: { $gte: today, $lt: tomorrow } } },
      { $group: { _id: null, q: { $sum: "$questionCount" } } },
    ]),
    CodingSubmission.countDocuments({ userId: oid, createdAt: { $gte: today, $lt: tomorrow } }),
    MockOAAttempt.countDocuments({ userId: oid, createdAt: { $gte: today, $lt: tomorrow } }),
  ]);

  const targets = { aptitude: 10, coding: 2, mock: 1, minutes: 30 };
  const aptQ = aptQToday[0]?.q || 0;
  const minutes = Math.min(targets.minutes, round(aptQ * 1.5 + codToday * 8));

  const goals = [
    { key: "aptitude", label: "Aptitude Questions", target: targets.aptitude, done: aptQ >= targets.aptitude, progress: aptQ },
    { key: "coding", label: "Coding Problems", target: targets.coding, done: codToday >= targets.coding, progress: codToday },
    { key: "mock", label: "Mock Test", target: targets.mock, done: mockToday >= targets.mock, progress: mockToday },
    { key: "minutes", label: "Practice Minutes", target: targets.minutes, done: minutes >= targets.minutes, progress: minutes },
  ];
  const completed = goals.filter((g) => g.done).length;
  const progressToday = aptQ + codToday + mockToday;
  return { goals, completed, total: goals.length, progressToday, date: dateKey(today) };
}

/* ───────────────────────── achievements ───────────────────────── */

const ACHIEVEMENT_DEFS = [
  { key: "first-step", title: "First Steps", description: "Complete your first aptitude test", icon: "🚀" },
  { key: "apt-10", title: "Aptitude Rookie", description: "Solve 10 aptitude questions", icon: "🎯" },
  { key: "apt-100", title: "Aptitude Centurion", description: "Solve 100 aptitude questions", icon: "🧠" },
  { key: "first-code", title: "First Code", description: "Submit your first coding solution", icon: "💻" },
  { key: "code-50", title: "Coding Crusader", description: "Submit 50 coding solutions", icon: "⚡" },
  { key: "streak-7", title: "7 Day Streak", description: "Practice for 7 days in a row", icon: "🔥" },
  { key: "streak-30", title: "Consistency Warrior", description: "Achieve a 30 day streak", icon: "🏆" },
  { key: "perfect", title: "Perfect Score", description: "Score 100% on an aptitude test", icon: "💯" },
  { key: "fast-solver", title: "Fast Solver", description: "Finish 3 tests in under 30s per question", icon: "🚄" },
  { key: "consistency-master", title: "Consistency Master", description: "Stay active for 20 days in 30", icon: "📅" },
  { key: "explorer", title: "Company Explorer", description: "Practice with 3 different companies", icon: "🗺️" },
  { key: "curator", title: "Curator", description: "Bookmark 10 questions", icon: "📌" },
];

function evaluateAchievements(activity, streaks) {
  return {
    "first-step": activity.hasActivity,
    "apt-10": activity.aptitudeAttempts >= 10,
    "apt-100": activity.aptitudeAttempts >= 100,
    "first-code": activity.codingSubmissions >= 1,
    "code-50": activity.codingSubmissions >= 50,
    "streak-7": streaks.best >= 7,
    "streak-30": streaks.best >= 30,
    "perfect": activity.perfectAttempts >= 1,
    "fast-solver": activity.fastAttempts >= 3,
    "consistency-master": streaks.activeDays30 >= 20,
    "explorer": activity.companiesPracticed >= 3,
    "curator": activity.bookmarks >= 10,
  };
}

async function syncAchievements(userId, evaluation) {
  const oid = new mongoose.Types.ObjectId(userId);
  const existing = await AchievementUnlock.find({ userId: oid }).select("key").lean();
  const existingKeys = new Set(existing.map((e) => e.key));
  const newly = [];
  for (const def of ACHIEVEMENT_DEFS) {
    if (evaluation[def.key] && !existingKeys.has(def.key)) {
      try {
        await AchievementUnlock.create({ userId: oid, key: def.key, unlockedAt: new Date() });
      } catch (err) {
        if (!/duplicate/i.test(String(err.message))) throw err;
      }
      newly.push(def);
    }
  }
  return newly;
}

/* ───────────────────────── prediction & roadmap ───────────────────────── */

function computePrediction(scores, companyReadiness) {
  const practiced = companyReadiness.filter((c) => c.breakdown.aptitude > 0 || c.breakdown.coding > 0);
  const accuracy = practiced.length > 0 ? round(practiced.reduce((s, c) => s + c.breakdown.accuracy, 0) / practiced.length) : 0;
  const timeScore = practiced.length > 0 ? round(practiced.reduce((s, c) => s + c.breakdown.timeScore, 0) / practiced.length) : 0;

  let chance;
  if (practiced.length === 0) {
    chance = 0;
  } else {
    chance = round(
      scores.coding * 0.22 +
      scores.aptitude * 0.22 +
      scores.consistency * 0.18 +
      accuracy * 0.22 +
      timeScore * 0.16
    );
  }
  const status = chance >= 80 ? "High" : chance >= 60 ? "Moderate" : chance >= 40 ? "Low" : "Critical";
  const likely = companyReadiness.filter((c) => c.readiness >= 80).sort((a, b) => b.readiness - a.readiness).slice(0, 3);
  const needs = companyReadiness.filter((c) => c.readiness >= 60 && c.readiness < 80).sort((a, b) => a.readiness - b.readiness).slice(0, 3);
  return {
    chance,
    status,
    likelyCompanies: likely.map((c) => ({ companyId: c.companyId, companyName: c.companyName, readiness: c.readiness })),
    needsImprovement: needs.map((c) => ({ companyId: c.companyId, companyName: c.companyName, readiness: c.readiness })),
  };
}

function computeRoadmap(weakTopics, companyReadiness) {
  const topics = weakTopics.filter((t) => t.kind === "aptitude").map((t) => t.topic);
  const codingTopics = weakTopics.filter((t) => t.kind === "coding").map((t) => t.topic);
  const bestCompany = [...companyReadiness].sort((a, b) => b.readiness - a.readiness)[0];
  const mockCompany = bestCompany?.companyName || "TCS";

  const plan = [];
  const today = startOfDay();
  const add = (i, title, subtitle, kind, link) => plan.push({
    date: dateKey(addDays(today, i)),
    day: i === 0 ? "Today" : i === 1 ? "Tomorrow" : new Date(addDays(today, i)).toLocaleDateString("en-US", { weekday: "long" }),
    title,
    subtitle,
    kind,
    link,
  });

  if (topics.length > 0) add(0, `Aptitude — ${topics[0]}`, "Practice 10 questions and review explanations", "aptitude", "/interview-practice");
  else add(0, "Mixed Aptitude Practice", "Attempt one full aptitude test", "aptitude", "/interview-practice");

  if (codingTopics.length > 0) add(1, `Coding — ${codingTopics[0]}`, "Solve 5 problems on this topic", "coding", "/interview-practice");
  else if (topics.length > 1) add(1, `Aptitude — ${topics[1]}`, "Practice 10 questions on this topic", "aptitude", "/interview-practice");
  else add(1, "Coding Fundamentals", "Solve 3 Easy problems", "coding", "/interview-practice");

  add(2, "Company Mock OA", `Attempt the ${mockCompany} mock OA under timed conditions`, "mock", "/placement/mock-oa");
  add(3, "Mixed Aptitude Test", "Full 15-question test — aim for 70%+", "aptitude", "/interview-practice");
  add(4, "Coding Contest", "Solve 5 Medium problems within 90 minutes", "coding", "/interview-practice");
  add(5, "Hard Problem Challenge", "Attempt 2 Hard problems and review editorial approaches", "coding", "/interview-practice");
  add(6, "Weekly Mock Interview", "Full AI mock interview and review the report", "interview", "/interview-practice");

  return plan;
}

/* ───────────────────────── question analytics ───────────────────────── */

async function computeQuestionAnalytics(userId) {
  const oid = new mongoose.Types.ObjectId(userId);
  const [attempts, bookmarks] = await Promise.all([
    PracticeAttempt.find({ userId: oid }).select("questions timeTaken questionCount").lean(),
    StudentPreference.countDocuments({ userId: oid, type: "bookmark" }),
  ]);

  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  const diffCounts = { easy: { total: 0, correct: 0 }, medium: { total: 0, correct: 0 }, hard: { total: 0, correct: 0 } };
  let timeSum = 0;
  for (const a of attempts) {
    timeSum += a.timeTaken || 0;
    for (const q of a.questions || []) {
      if (q.userAnswer == null) skipped++;
      else if (q.isCorrect) correct++;
      else wrong++;
      const d = diffCounts[String(q.difficulty).toLowerCase()] ? String(q.difficulty).toLowerCase() : "easy";
      diffCounts[d].total++;
      if (q.isCorrect) diffCounts[d].correct++;
    }
  }

  const [coding, codingByDiff] = await Promise.all([
    CodingSubmission.aggregate([
      { $match: { userId: oid, status: { $ne: "unsupported" } } },
      { $group: { _id: null, total: { $sum: 1 }, accepted: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } }, time: { $avg: "$timeTakenMs" } } },
    ]),
    CodingSubmission.aggregate([
      { $match: { userId: oid, status: { $ne: "unsupported" } } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
  ]);

  return {
    aptitude: {
      attempted: correct + wrong + skipped,
      correct,
      wrong,
      skipped,
      bookmarked: bookmarks,
      averageTimeSec: attempts.length > 0 ? round(timeSum / attempts.length) : 0,
      attempts: attempts.length,
      byDifficulty: Object.entries(diffCounts).map(([difficulty, d]) => ({ difficulty, total: d.total, correct: d.correct })),
    },
    coding: {
      total: coding[0]?.total || 0,
      accepted: coding[0]?.accepted || 0,
      averageTimeMs: round(coding[0]?.time || 0),
      byStatus: codingByDiff,
    },
  };
}

/* ───────────────────────── performance chart data ───────────────────────── */

async function computePerformanceData(userId) {
  const oid = new mongoose.Types.ObjectId(userId);
  const monthAgo = addDays(startOfDay(), -29);

  const [attempts, submissions, mockOAs] = await Promise.all([
    PracticeAttempt.find({ userId: oid, createdAt: { $gte: monthAgo } }).select("percentage timeTaken createdAt companyId companyName").lean(),
    CodingSubmission.find({ userId: oid, status: { $ne: "unsupported" }, createdAt: { $gte: monthAgo } }).select("status passedCount totalCount timeTakenMs createdAt companyId companyName").lean(),
    MockOAAttempt.find({ userId: oid, createdAt: { $gte: monthAgo } }).select("overallScore createdAt companyName").lean(),
  ]);

  const weekly = [];
  for (let i = 0; i < 7; i++) {
    const d = dateKey(addDays(monthAgo, i + 23));
    const apt = attempts.filter((a) => dateKey(a.createdAt) === d);
    const cod = submissions.filter((s) => dateKey(s.createdAt) === d);
    const score = apt.length + cod.length > 0
      ? round((apt.reduce((s, a) => s + a.percentage, 0) + cod.reduce((s, c) => s + (c.status === "accepted" ? 100 : 0), 0)) / (apt.length + cod.length))
      : 0;
    weekly.push({ date: d, label: new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" }), score, activity: apt.length + cod.length });
  }

  const monthly = [];
  for (let i = 0; i < 30; i++) {
    const d = dateKey(addDays(monthAgo, i));
    const apt = attempts.filter((a) => dateKey(a.createdAt) === d);
    const cod = submissions.filter((s) => dateKey(s.createdAt) === d);
    const score = apt.length + cod.length > 0
      ? round((apt.reduce((s, a) => s + a.percentage, 0) + cod.reduce((s, c) => s + (c.status === "accepted" ? 100 : 0), 0)) / (apt.length + cod.length))
      : 0;
    monthly.push({ date: d, label: String(new Date(`${d}T00:00:00`).getDate()), score, activity: apt.length + cod.length });
  }

  const companies = new Map();
  for (const a of attempts) {
    const key = a.companyName || "General";
    const st = companies.get(key) || { aptitude: [], coding: [], time: [] };
    st.aptitude.push(a.percentage);
    st.time.push(a.timeTaken || 0);
    companies.set(key, st);
  }
  for (const s of submissions) {
    const key = s.companyName || "General";
    const st = companies.get(key) || { aptitude: [], coding: [], time: [] };
    st.coding.push(s.status === "accepted" ? 100 : s.totalCount > 0 ? round((s.passedCount / s.totalCount) * 100) : 0);
    companies.set(key, st);
  }
  const companyWise = [...companies.entries()].map(([name, st]) => ({
    company: name,
    aptitude: st.aptitude.length ? round(st.aptitude.reduce((s, v) => s + v, 0) / st.aptitude.length) : 0,
    coding: st.coding.length ? round(st.coding.reduce((s, v) => s + v, 0) / st.coding.length) : 0,
    avgTimeSec: st.time.length ? round(st.time.reduce((s, v) => s + v, 0) / st.time.length) : 0,
  }));

  const mock = mockOAs.map((m) => ({ score: m.overallScore, company: m.companyName, date: m.createdAt }));

  return { weekly, monthly, companyWise, mock };
}

/* ───────────────────────── leaderboard ───────────────────────── */

async function computeLeaderboard({ type = "overall", period = "overall", department = "", year = "", limit = 50 }) {
  const typeMap = {
    overall: (s) => s.placement,
    placement: (s) => s.placement,
    coding: (s) => s.coding,
    aptitude: (s) => s.aptitude,
  };
  const scorePicker = typeMap[String(type).toLowerCase()] || typeMap.overall;

  const match = {};
  if (department) match.department = department;
  if (year) match.year = yearQuery(year);

  const users = await User.find(match).select("name department year").lean();
  if (users.length === 0) return { leaderboard: [], filters: { type, period, department, year } };

  const since = period === "weekly" ? addDays(startOfDay(), -6) : period === "monthly" ? addDays(startOfDay(), -29) : null;
  const timeMatch = since ? { createdAt: { $gte: since } } : {};

  const [aptAgg, codAgg, mockAgg, resultAgg, activityAgg] = await Promise.all([
    PracticeAttempt.aggregate([
      { $match: timeMatch },
      { $group: { _id: "$userId", attempts: { $sum: 1 }, avgPct: { $avg: "$percentage" }, correct: { $sum: "$correct" }, answered: { $sum: { $add: ["$correct", "$wrong"] } } } },
    ]),
    CodingSubmission.aggregate([
      { $match: { status: { $ne: "unsupported" }, ...timeMatch } },
      { $group: { _id: "$userId", subs: { $sum: 1 }, accepted: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } } } },
    ]),
    MockOAAttempt.aggregate([
      { $match: timeMatch },
      { $group: { _id: "$userId", count: { $sum: 1 }, avgScore: { $avg: "$overallScore" } } },
    ]),
    Result.aggregate([
      { $match: timeMatch },
      { $group: { _id: "$userId", count: { $sum: 1 }, avgScore: { $avg: "$overallScore" } } },
    ]),
    (async () => {
      const [a, b, c, d] = await Promise.all([
        PracticeAttempt.aggregate([{ $match: timeMatch }, { $group: { _id: "$userId", n: { $sum: 1 } } }]),
        CodingSubmission.aggregate([{ $match: { status: { $ne: "unsupported" }, ...timeMatch } }, { $group: { _id: "$userId", n: { $sum: 1 } } }]),
        MockOAAttempt.aggregate([{ $match: timeMatch }, { $group: { _id: "$userId", n: { $sum: 1 } } }]),
        Result.aggregate([{ $match: timeMatch }, { $group: { _id: "$userId", n: { $sum: 1 } } }]),
      ]);
      const map = new Map();
      for (const g of [a, b, c, d]) for (const x of g) map.set(String(x._id), (map.get(String(x._id)) || 0) + x.n);
      return [...map.entries()].map(([id, n]) => ({ _id: id, n }));
    })(),
  ]);

  const aptMap = new Map(aptAgg.map((x) => [String(x._id), x]));
  const codMap = new Map(codAgg.map((x) => [String(x._id), x]));
  const mockMap = new Map(mockAgg.map((x) => [String(x._id), x]));
  const resultMap = new Map(resultAgg.map((x) => [String(x._id), x]));
  const activityMap = new Map(activityAgg.map((x) => [String(x._id), x.n]));

  const rows = users
    .map((u) => {
      const apt = aptMap.get(String(u._id));
      const cod = codMap.get(String(u._id));
      const aptitude = apt?.avgPct ? round(apt.avgPct) : 0;
      const coding = cod?.subs ? round((cod.accepted / cod.subs) * 100) : 0;
      const accuracy = apt?.answered ? round((apt.correct / apt.answered) * 100) : 0;
      const mock = [mockMap.get(String(u._id))?.avgScore, resultMap.get(String(u._id))?.avgScore].filter((v) => v != null);
      const mockScore = mock.length ? round(mock.reduce((s, v) => s + v, 0) / mock.length) : 0;
      const activity = activityMap.get(String(u._id)) || 0;
      const consistency = round(Math.min(activity, 100));
      const placement = round(coding * 0.25 + aptitude * 0.25 + accuracy * 0.2 + consistency * 0.2 + mockScore * 0.1);
      return { userId: u._id, name: u.name, department: u.department, year: u.year, aptitude, coding, accuracy, consistency, mock: mockScore, placement, activity };
    })
    .filter((r) => r.activity > 0)
    .sort((a, b) => scorePicker(b) - scorePicker(a))
    .slice(0, Math.min(limit, 100))
    .map((r, i) => ({ ...r, rank: i + 1, score: round(scorePicker(r)) }));

  return { leaderboard: rows, filters: { type, period, department, year } };
}

/* ───────────────────────── admin analytics ───────────────────────── */

async function computeAdminQuestionQuality() {
  const [aptUnwind, codAgg, aptDocs, codDocs] = await Promise.all([
    PracticeAttempt.aggregate([
      { $unwind: "$questions" },
      { $group: {
        _id: "$questions.questionId",
        attempted: { $sum: 1 },
        correct: { $sum: { $cond: [{ $eq: ["$questions.isCorrect", true] }, 1, 0] } },
        answered: { $sum: { $cond: [{ $ne: ["$questions.userAnswer", null] }, 1, 0] } },
        users: { $addToSet: "$userId" },
        timePerQ: { $avg: { $divide: ["$timeTaken", { $max: [1, "$questionCount"] }] } },
      } },
    ]),
    CodingSubmission.aggregate([
      { $match: { status: { $ne: "unsupported" } } },
      { $group: {
        _id: "$questionId",
        attempted: { $sum: 1 },
        accepted: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } },
        users: { $addToSet: "$userId" },
        timeMs: { $avg: "$timeTakenMs" },
      } },
    ]),
    AptitudeQuestion.find({ isDeleted: false }).select("questionId question category difficulty companyId companyName").lean(),
    CodingQuestion.find({ isDeleted: { $ne: true } }).select("title category difficulty companyId companyName").lean(),
  ]);

  const aptMap = new Map(aptDocs.map((q) => [String(q.questionId), q]));
  const aptRows = aptUnwind
    .map((g) => {
      const meta = aptMap.get(String(g._id));
      const correctPct = g.attempted > 0 ? round((g.correct / g.attempted) * 100) : 0;
      return {
        type: "aptitude",
        questionId: String(g._id),
        title: meta?.question ? String(meta.question).slice(0, 80) : "Unknown question",
        category: meta?.category || "General",
        difficulty: meta?.difficulty || "easy",
        companyName: meta?.companyName || "",
        attempted: g.attempted,
        studentsAttempted: g.users.length,
        correct: g.correct,
        correctPct,
        wrongPct: round(100 - correctPct),
        averageTimeSec: round(g.timePerQ || 0),
        difficultyRating: g.attempted > 0 ? clamp(round((1 - correctPct / 100) * 10) + 1, 1, 10) : 0,
        health: g.attempted > 0 ? round(correctPct * 0.6 + Math.min(100, g.attempted * 5) * 0.4) : 0,
      };
    })
    .sort((a, b) => b.attempted - a.attempted);

  const codDocMap = new Map(codDocs.map((q) => [String(q._id), q]));
  const codRows = codAgg
    .filter((g) => g._id)
    .map((g) => {
      const meta = codDocMap.get(String(g._id));
      const correctPct = g.attempted > 0 ? round((g.accepted / g.attempted) * 100) : 0;
      return {
        type: "coding",
        questionId: String(g._id),
        title: meta?.title || "Unknown question",
        category: meta?.category || "",
        difficulty: meta?.difficulty || "Easy",
        companyName: meta?.companyName || "",
        attempted: g.attempted,
        studentsAttempted: g.users.length,
        correct: g.accepted,
        correctPct,
        wrongPct: round(100 - correctPct),
        averageTimeSec: round((g.timeMs || 0) / 1000),
        difficultyRating: g.attempted > 0 ? clamp(round((1 - correctPct / 100) * 10) + 1, 1, 10) : 0,
        health: g.attempted > 0 ? round(correctPct * 0.6 + Math.min(100, g.attempted * 5) * 0.4) : 0,
      };
    })
    .sort((a, b) => b.attempted - a.attempted);

  const rows = [...aptRows, ...codRows].sort((a, b) => b.attempted - a.attempted);
  const withAttempts = rows.filter((r) => r.attempted > 0);

  const best = (fn) => (withAttempts.length ? [...withAttempts].sort(fn)[0] : null);
  const mostSolved = best((a, b) => b.attempted - a.attempted);
  const leastSolved = best((a, b) => a.attempted - b.attempted);
  const hardest = best((a, b) => b.difficultyRating - a.difficultyRating);
  const highestAccuracy = best((a, b) => b.correctPct - a.correctPct);
  const lowestAccuracy = best((a, b) => a.correctPct - b.correctPct);

  const [companyAgg, codCompanyAgg, activeStudents, completion] = await Promise.all([
    PracticeAttempt.aggregate([
      { $match: { companyName: { $ne: "" } } },
      { $group: { _id: "$companyName", attempts: { $sum: 1 }, avgPct: { $avg: "$percentage" } } },
      { $sort: { avgPct: -1 } },
    ]),
    CodingSubmission.aggregate([
      { $match: { status: { $ne: "unsupported" }, companyName: { $ne: "" } } },
      { $group: { _id: "$companyName", subs: { $sum: 1 }, accepted: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } } } },
    ]),
    PracticeAttempt.aggregate([
      { $match: { createdAt: { $gte: addDays(new Date(), -29) } } },
      { $group: { _id: "$userId", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 10 },
    ]),
    PracticeAttempt.aggregate([
      { $match: { questionCount: { $gt: 0 } } },
      { $group: { _id: null, avgCompletion: { $avg: { $divide: [{ $add: ["$correct", "$wrong", "$skipped"] }, "$questionCount"] } } } },
    ]),
  ]);
  const codCompanyMap = new Map(codCompanyAgg.map((c) => [c._id, c]));
  const companyWiseSuccess = companyAgg.map((c) => {
    const cod = codCompanyMap.get(c._id);
    return {
      company: c._id,
      attempts: c.attempts,
      avgPercentage: round(c.avgPct),
      codingAccepted: cod?.accepted || 0,
      codingSubmissions: cod?.subs || 0,
    };
  });

  const activeUserIds = activeStudents.map((a) => a._id);
  const activeUsers = activeUserIds.length > 0 ? await User.find({ _id: { $in: activeUserIds } }).select("name department year").lean() : [];
  const activeUserMap = new Map(activeUsers.map((u) => [String(u._id), u]));
  const mostActiveStudents = activeStudents.map((a, i) => ({
    rank: i + 1,
    name: activeUserMap.get(String(a._id))?.name || "Student",
    department: activeUserMap.get(String(a._id))?.department || "",
    year: activeUserMap.get(String(a._id))?.year || "",
    attempts: a.n,
  }));

  const deptCounts = new Map();
  for (const a of activeStudents) {
    const u = activeUserMap.get(String(a._id));
    if (!u?.department) continue;
    deptCounts.set(u.department, (deptCounts.get(u.department) || 0) + a.n);
  }
  const mostActiveDepartment = deptCounts.size ? [...deptCounts.entries()].sort((a, b) => b[1] - a[1])[0] : null;

  return {
    summary: {
      mostSolved,
      leastSolved,
      hardest,
      highestAccuracy,
      lowestAccuracy,
      averageCompletion: completion[0] ? round(completion[0].avgCompletion * 100) : 0,
      mostActiveStudents,
      mostActiveDepartment: mostActiveDepartment ? { department: mostActiveDepartment[0], attempts: mostActiveDepartment[1] } : null,
      companyWiseSuccess,
      totalQuestionsTracked: rows.length,
      totalAttempts: rows.reduce((s, r) => s + r.attempted, 0),
    },
    questions: rows.slice(0, 300),
  };
}

/* ───────────────────────── notifications (lazy, deduped) ───────────────────────── */

async function ensurePlacementNotifications(userId, streaks, goals) {
  const oid = new mongoose.Types.ObjectId(userId);
  const existsToday = async (title) =>
    (await Notification.countDocuments({ userId: oid, title, createdAt: { $gte: startOfDay() } })) > 0;

  if (streaks.current >= 1 && goals.progressToday === 0) {
    if (!(await existsToday("Streak about to break"))) {
      await createNotification({
        userId: oid,
        type: "warning",
        title: "Streak about to break",
        message: `Practice today to keep your ${streaks.current} day streak alive!`,
        link: "/placement-dashboard",
      });
    }
  }

  const pending = goals.goals.filter((g) => !g.done).length;
  if (pending > 0 && goals.progressToday > 0) {
    if (!(await existsToday("Daily goal pending"))) {
      await createNotification({
        userId: oid,
        type: "info",
        title: "Daily goal pending",
        message: `${pending} of ${goals.total} daily goals remaining for today.`,
        link: "/placement-dashboard",
      });
    }
  }

  const recentMock = await MockOAAttempt.countDocuments({ userId: oid, createdAt: { $gte: addDays(new Date(), -7) } });
  if (recentMock === 0 && streaks.activeDays30 > 0) {
    if (!(await existsToday("Mock OA available"))) {
      await createNotification({
        userId: oid,
        type: "success",
        title: "Mock OA available",
        message: "A realistic timed mock OA is ready for you. Try it before the real drive!",
        link: "/placement/mock-oa",
      });
    }
  }
}

/* ───────────────────────── public API ───────────────────────── */

export async function getStudentPlacementData(userId) {
  const cacheKey = `placement:${userId}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const oid = new mongoose.Types.ObjectId(userId);
  const userMockOAs = await MockOAAttempt.find({ userId: oid }).select("companyId overallScore").lean();

  const scoresBundle = await computeScores(userId);
  const [companyReadiness, weakBundle] = await Promise.all([
    computeCompanyReadiness(userId, userMockOAs),
    computeWeakTopicsAndRecommendations(userId, scoresBundle.scores, scoresBundle.activity),
  ]);

  const companiesPracticed = companyReadiness.filter((c) => c.breakdown.aptitude > 0 || c.breakdown.coding > 0).length;
  const activity = { ...scoresBundle.activity, companiesPracticed };

  const goals = await computeDailyGoals(userId);
  const evaluation = evaluateAchievements(activity, scoresBundle.streaks);
  const newlyUnlocked = await syncAchievements(userId, evaluation);
  const unlocked = await AchievementUnlock.find({ userId: oid }).sort({ unlockedAt: 1 }).lean();
  const unlockedKeys = new Set(unlocked.map((u) => u.key));

  const prediction = computePrediction(scoresBundle.scores, companyReadiness);
  const roadmap = computeRoadmap(weakBundle.weakTopics, companyReadiness);

  await ensurePlacementNotifications(userId, scoresBundle.streaks, goals);

  const payload = {
    scores: scoresBundle.scores,
    companyReadiness,
    weakTopics: weakBundle.weakTopics,
    recommendations: weakBundle.recommendations,
    dailyGoals: goals,
    streak: {
      current: scoresBundle.streaks.current,
      best: scoresBundle.streaks.best,
      missedDays: scoresBundle.streaks.missedDays,
      weekly: scoresBundle.streaks.weekly,
      monthly: scoresBundle.streaks.monthly,
    },
    heatmap: scoresBundle.heatmap,
    achievements: {
      unlocked: ACHIEVEMENT_DEFS.filter((d) => unlockedKeys.has(d.key)).map((d) => ({
        ...d,
        unlockedAt: unlocked.find((u) => u.key === d.key)?.unlockedAt,
      })),
      locked: ACHIEVEMENT_DEFS.filter((d) => !unlockedKeys.has(d.key)),
      newlyUnlocked,
    },
    prediction,
    roadmap,
    generatedAt: new Date().toISOString(),
  };

  return setCache(cacheKey, payload, 60 * 1000);
}

export function invalidateStudentPlacement(userId) {
  deleteCacheByPrefix(`placement:${userId}`);
  deleteCacheByPrefix("leaderboard:");
  deleteCacheByPrefix("admin:quality");
}

export {
  computeLeaderboard,
  computeAdminQuestionQuality,
  computeQuestionAnalytics,
  computePerformanceData,
  ACHIEVEMENT_DEFS,
};
