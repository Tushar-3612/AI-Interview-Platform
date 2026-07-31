import vm from "vm";
import mongoose from "mongoose";
import Company from "../models/Company.js";
import AptitudeQuestion from "../models/AptitudeQuestion.js";
import CodingQuestion from "../models/CodingQuestion.js";
import PracticeAttempt from "../models/PracticeAttempt.js";
import CodingSubmission from "../models/CodingSubmission.js";
import StudentPreference from "../models/StudentPreference.js";
import {
  selectRandomQuestions,
  shuffleArray,
  getQuestionById,
  getBankMap,
} from "../services/questionBank.js";

const VALID_DIFFICULTIES = ["easy", "medium", "hard"];
const VALID_COUNTS = [15, 20, 30];
// All UI-visible languages; server-side execution only supports JavaScript
const SUPPORTED_LANGUAGES = ["JavaScript", "Python", "Java", "C", "C++", "C#", "Go", "Rust", "Kotlin", "PHP"];
const SERVER_EXECUTABLE = ["JavaScript"]; // languages that can actually run on the server

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

export const getPracticeHome = async (req, res) => {
  try {
    const userId = req.user.id;
    const [companies, favorites, lastAttempt, lastSubmission] = await Promise.all([
      Company.find({ isDeleted: { $ne: true }, status: "active" }).sort({ name: 1 }).lean(),
      StudentPreference.find({ userId, type: "favoriteCompany" }).select("companyId").lean(),
      PracticeAttempt.findOne({ userId }).sort({ createdAt: -1 }).lean(),
      CodingSubmission.findOne({ userId }).sort({ createdAt: -1 }).lean(),
    ]);
    const favoriteIds = new Set(favorites.map((f) => f.companyId));
    const companyIds = companies.map((c) => c.id);
    const [aptCounts, codCounts] = await Promise.all([
      AptitudeQuestion.aggregate([
        { $match: { isDeleted: false, isActive: true, companyId: { $in: companyIds } } },
        { $group: { _id: "$companyId", count: { $sum: 1 } } },
      ]),
      CodingQuestion.aggregate([
        { $match: { isDeleted: { $ne: true }, isActive: true, companyId: { $in: companyIds } } },
        { $group: { _id: "$companyId", count: { $sum: 1 } } },
      ]),
    ]);
    const aptMap = Object.fromEntries(aptCounts.map((a) => [a._id, a.count]));
    const codMap = Object.fromEntries(codCounts.map((a) => [a._id, a.count]));

    const list = companies.map((c) => ({
      ...c,
      isFavorite: favoriteIds.has(c.id),
      aptitudeCount: aptMap[c.id] || 0,
      codingCount: codMap[c.id] || 0,
      lastUpdated: c.lastUpdated || c.updatedAt,
    }));

    res.json({
      companies: list,
      recent: {
        lastAttempt: lastAttempt
          ? {
              _id: lastAttempt._id,
              companyName: lastAttempt.companyName,
              companyId: lastAttempt.companyId,
              score: lastAttempt.score,
              percentage: lastAttempt.percentage,
              createdAt: lastAttempt.createdAt,
            }
          : null,
        lastSubmission: lastSubmission
          ? {
              _id: lastSubmission._id,
              title: lastSubmission.title,
              companyId: lastSubmission.companyId,
              status: lastSubmission.status,
              passedCount: lastSubmission.passedCount,
              totalCount: lastSubmission.totalCount,
              createdAt: lastSubmission.createdAt,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Get Practice Home Error:", error.message);
    res.status(500).json({ message: "Failed to load practice home" });
  }
};

export const startAptitudePaper = async (req, res) => {
  try {
    const { companyId = "", count = 15, difficulty = "" } = req.query;
    const questionCount = VALID_COUNTS.includes(Number(count)) ? Number(count) : 15;
    const selected = selectRandomQuestions({
      count: questionCount,
      difficulty: VALID_DIFFICULTIES.includes(String(difficulty).toLowerCase()) ? String(difficulty).toLowerCase() : "",
      companyId,
    });
    if (selected.length === 0) {
      return res.status(404).json({ message: "No questions available for this selection" });
    }
    const paper = shuffleArray(selected.map(cleanPaperQuestion)).map((q) => ({
      ...q,
      options: shuffleArray(q.options),
    }));
    res.json({ questions: paper, total: paper.length });
  } catch (error) {
    console.error("Start Aptitude Paper Error:", error.message);
    res.status(500).json({ message: "Failed to generate paper" });
  }
};

export const submitAptitude = async (req, res) => {
  try {
    const userId = req.user.id;
    const { companyId = "", companyName = "", answers = {}, timeTaken = 0, questions: questionList = [], difficulty = "" } = req.body;
    const bankMap = getBankMap();

    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    const details = [];

    const resolveQuestion = (questionId) => {
      const fromBank = getQuestionById(questionId);
      if (fromBank) return fromBank;
      const fromList = questionList.find((q) => String(q.questionId) === String(questionId) || String(q._id) === String(questionId));
      return fromList || null;
    };

    for (const item of questionList) {
      const questionId = String(item.questionId ?? item._id);
      const base = resolveQuestion(questionId);
      const userAnswer = answers[questionId] != null ? String(answers[questionId]) : null;
      const isCorrect = userAnswer != null && base && base.correctAnswer != null && userAnswer === String(base.correctAnswer);
      if (userAnswer == null) skipped++;
      else if (isCorrect) correct++;
      else wrong++;
      details.push({
        questionId,
        category: base?.category || item.category || "General",
        question: base?.question || item.question || "",
        options: base?.options || item.options || [],
        correctAnswer: base?.correctAnswer || "",
        difficulty: base?.difficulty || item.difficulty || "easy",
        explanation: base?.explanation || item.explanation || "",
        marks: Number(base?.marks || item.marks) || 1,
        userAnswer,
        isCorrect,
      });
    }

    const total = details.length;
    const score = correct;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    const attempt = await PracticeAttempt.create({
      userId,
      companyId,
      companyName,
      questionCount: total,
      difficulty: VALID_DIFFICULTIES.includes(String(difficulty).toLowerCase()) ? String(difficulty).toLowerCase() : "",
      questions: details,
      score,
      correct,
      wrong,
      skipped,
      percentage,
      timeTaken: Number(timeTaken) || 0,
    });

    res.status(201).json({
      _id: attempt._id,
      score,
      correct,
      wrong,
      skipped,
      percentage,
      total,
      timeTaken: attempt.timeTaken,
      details,
    });
  } catch (error) {
    console.error("Submit Aptitude Error:", error.message);
    res.status(500).json({ message: "Failed to submit aptitude test" });
  }
};

export const getAptitudeHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [attempts, total] = await Promise.all([
      PracticeAttempt.find({ userId })
        .select("companyId companyName questionCount difficulty score percentage timeTaken createdAt correct wrong skipped")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      PracticeAttempt.countDocuments({ userId }),
    ]);
    res.json({ attempts, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    console.error("Get Aptitude History Error:", error.message);
    res.status(500).json({ message: "Failed to load attempt history" });
  }
};

export const getAptitudeAttempt = async (req, res) => {
  try {
    const userId = req.user.id;
    const attempt = await PracticeAttempt.findOne({ _id: req.params.id, userId }).lean();
    if (!attempt) return res.status(404).json({ message: "Attempt not found" });
    res.json(attempt);
  } catch (error) {
    res.status(500).json({ message: "Failed to load attempt" });
  }
};

function findFunctionName(code) {
  const match = String(code).match(/(?:function\s+|const\s+|let\s+|var\s+)([A-Za-z_$][\w$]*)/);
  return match ? match[1] : "solution";
}

function countFunctionParams(code) {
  const fnName = findFunctionName(code);
  if (!fnName) return -1;
  const name = fnName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp("function\\s+" + name + "\\s*\\(([^)]*)\\)"),
    new RegExp("(?:const|let|var)\\s+" + name + "\\s*=\\s*(?:async\\s*)?\\(([^)]*)\\)\\s*=>"),
    new RegExp("(?:const|let|var)\\s+" + name + "\\s*=\\s*(?:async\\s*)?([A-Za-z_$][\\w$]*)\\s*=>"),
    new RegExp("\\b" + name + "\\s*\\(([^)]*)\\)\\s*\\{"),
  ];
  for (const pattern of patterns) {
    const match = String(code).match(pattern);
    if (match) {
      const params = match[1].split(",").map((p) => p.trim()).filter((p) => p && !p.startsWith("..."));
      return params.length;
    }
  }
  return -1;
}

function splitTopLevelArgs(input) {
  const groups = [];
  let depth = 0;
  let current = "";
  let inString = false;
  let escape = false;
  for (const ch of String(input)) {
    if (inString) {
      current += ch;
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      current += ch;
      continue;
    }
    if (ch === "[" || ch === "(" || ch === "{") depth++;
    if (ch === "]" || ch === ")" || ch === "}") depth--;
    if (ch === "," && depth === 0) {
      groups.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) groups.push(current);
  return groups;
}

function isScalar(value) {
  return value === null || ["number", "string", "boolean"].includes(typeof value);
}

function parseTestArgs(input, code) {
  const cleaned = String(input || "").trim();
  if (!cleaned) return [];
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      const paramCount = code ? countFunctionParams(code) : -1;
      // Single scalar argument ([5] -> 5)
      if (parsed.length === 1 && isScalar(parsed[0])) return parsed;
      // Single-parameter function: pass the array literal as one argument
      if (paramCount === 1) return [parsed];
      return parsed;
    }
    return [parsed];
  } catch {
    // Human-friendly fallback: `[1, 2, 3], 4` or `"a", "b"`
    const groups = splitTopLevelArgs(cleaned);
    if (groups.length === 0) return [];
    return groups.map((group) => {
      try {
        return JSON.parse(group);
      } catch {
        return group.replace(/^["']|["']$/g, "");
      }
    });
  }
}

function executeJavaScript(code, args, timeoutMs) {
  const timeout = Math.min(Number(timeoutMs) || 1000, 3000);
  const fnName = findFunctionName(code);
  const wrapper = `
    ${code}
    if (typeof ${fnName} !== 'function') throw new Error('Function "${fnName}" not found');
    JSON.stringify(${fnName}.apply(null, args));
  `;
  const start = Date.now();
  try {
    const output = vm.runInNewContext(wrapper, { args }, { timeout });
    return { output, timeMs: Date.now() - start, error: null };
  } catch (err) {
    const timedOut = /timed out|TimeoutError/i.test(String(err.message));
    return {
      output: null,
      timeMs: Date.now() - start,
      error: timedOut ? `Time limit exceeded (${timeout}ms)` : String(err.message || "Execution error"),
    };
  }
}

function normalizeOutput(value) {
  if (value == null) return "";
  try {
    return JSON.stringify(JSON.parse(value));
  } catch {
    return String(value).trim();
  }
}

export const runCodingCode = async (req, res) => {
  try {
    const { language = "JavaScript", code = "", input = "" } = req.body;
    if (!code) return res.status(400).json({ message: "Code is required" });
    if (!SERVER_EXECUTABLE.includes(language)) {
      // Return a friendly non-error response for non-JS languages
      return res.json({
        type: "info",
        output: `Language "${language}" noted. Server-side execution currently supports JavaScript only.\nYour code has been saved. Switch to JavaScript to run against test cases.`,
        timeMs: 0,
        language,
      });
    }
    const args = parseTestArgs(input, code);
    const { output, error, timeMs } = executeJavaScript(code, args, 1000);
    if (error) return res.json({ type: "error", output: error });
    res.json({ type: "success", output, timeMs });
  } catch (error) {
    console.error("Run Code Error:", error.message);
    res.status(500).json({ message: "Failed to run code" });
  }
};

export const submitCoding = async (req, res) => {
  try {
    const userId = req.user.id;
    const { questionId, language = "JavaScript", code = "", timeTakenMs = 0 } = req.body;
    if (!code) return res.status(400).json({ message: "Code is required" });
    if (!mongoose.Types.ObjectId.isValid(String(questionId))) {
      return res.status(400).json({ message: "Invalid question id" });
    }
    const question = await CodingQuestion.findOne({ _id: questionId, isDeleted: { $ne: true } }).lean();
    if (!question) return res.status(404).json({ message: "Question not found" });
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      await CodingSubmission.create({
        userId,
        questionId,
        title: question.title,
        companyId: question.companyId,
        companyName: question.companyName,
        language,
        code,
        status: "unsupported",
        passedCount: 0,
        totalCount: question.testCases.length,
        results: [],
        timeTakenMs: Number(timeTakenMs) || 0,
      });
      return res.status(400).json({ message: `Server-side evaluation supports JavaScript only. Choose JavaScript to submit.` });
    }
    const testCases = question.testCases || [];
    const results = [];
    let passedCount = 0;
    for (const tc of testCases) {
      try {
        const args = parseTestArgs(tc.input, code);
        const { output, error, timeMs } = executeJavaScript(code, args, question.timeLimit || 1000);
        if (error) throw new Error(error);
        const passed = normalizeOutput(output) === normalizeOutput(tc.expected);
        if (passed) passedCount++;
        results.push({
          index: results.length + 1,
          passed,
          isHidden: Boolean(tc.isHidden),
          input: tc.isHidden ? "" : String(tc.input),
          expected: tc.isHidden ? "" : String(tc.expected),
          actual: passed ? "" : String(output ?? "No output"),
          error: "",
          timeMs,
        });
      } catch (err) {
        results.push({
          index: results.length + 1,
          passed: false,
          isHidden: Boolean(tc.isHidden),
          input: tc.isHidden ? "" : String(tc.input),
          expected: tc.isHidden ? "" : String(tc.expected),
          actual: "",
          error: String(err.message || "Execution error"),
          timeMs: 0,
        });
      }
    }
    const status = passedCount === testCases.length && testCases.length > 0 ? "accepted" : testCases.length === 0 ? "error" : "failed";
    const submission = await CodingSubmission.create({
      userId,
      questionId,
      title: question.title,
      companyId: question.companyId,
      companyName: question.companyName,
      language,
      code,
      status,
      passedCount,
      totalCount: testCases.length,
      results,
      timeTakenMs: Number(timeTakenMs) || 0,
    });
    res.status(201).json({
      _id: submission._id,
      status,
      passedCount,
      totalCount: testCases.length,
      results,
    });
  } catch (error) {
    console.error("Submit Code Error:", error.message);
    res.status(500).json({ message: "Failed to submit code" });
  }
};

export const getCodingHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, questionId } = req.query;
    const filter = { userId };
    if (questionId) filter.questionId = questionId;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [submissions, total] = await Promise.all([
      CodingSubmission.find(filter)
        .select("title companyId companyName language status passedCount totalCount timeTakenMs createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      CodingSubmission.countDocuments(filter),
    ]);
    res.json({ submissions, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    console.error("Get Coding History Error:", error.message);
    res.status(500).json({ message: "Failed to load submission history" });
  }
};

export const getCodingSubmission = async (req, res) => {
  try {
    const userId = req.user.id;
    const submission = await CodingSubmission.findOne({ _id: req.params.id, userId }).lean();
    if (!submission) return res.status(404).json({ message: "Submission not found" });
    res.json(submission);
  } catch (error) {
    res.status(500).json({ message: "Failed to load submission" });
  }
};

export const saveCodingDraft = async (req, res) => {
  try {
    const userId = req.user.id;
    const { questionId, language = "JavaScript", code = "" } = req.body;
    if (!questionId) return res.status(400).json({ message: "questionId is required" });
    await StudentPreference.findOneAndUpdate(
      { userId, type: "codingDraft", questionId: String(questionId) },
      { language, code },
      { upsert: true, new: true }
    );
    res.json({ message: "Draft saved" });
  } catch (error) {
    res.status(500).json({ message: "Failed to save draft" });
  }
};

export const getCodingDraft = async (req, res) => {
  try {
    const userId = req.user.id;
    const draft = await StudentPreference.findOne({ userId, type: "codingDraft", questionId: req.params.questionId }).lean();
    res.json(draft || { code: "", language: "JavaScript" });
  } catch (error) {
    res.status(500).json({ message: "Failed to load draft" });
  }
};

export const toggleBookmark = async (req, res) => {
  try {
    const userId = req.user.id;
    const { questionId } = req.body;
    if (!questionId) return res.status(400).json({ message: "questionId is required" });
    const existing = await StudentPreference.findOne({ userId, type: "bookmark", questionId: String(questionId) });
    if (existing) {
      await existing.deleteOne();
      return res.json({ bookmarked: false });
    }
    await StudentPreference.create({ userId, type: "bookmark", questionId: String(questionId) });
    res.json({ bookmarked: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to toggle bookmark" });
  }
};

export const getBookmarks = async (req, res) => {
  try {
    const userId = req.user.id;
    const bookmarks = await StudentPreference.find({ userId, type: "bookmark" }).sort({ createdAt: -1 }).lean();
    const bankMap = getBankMap();
    const questions = bookmarks
      .map((b) => {
        const q = bankMap.get(String(b.questionId));
        return q
          ? {
              questionId: q.questionId,
              category: q.category,
              question: q.question,
              options: q.options,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation,
              difficulty: q.difficulty,
              marks: q.marks,
              bookmarkedAt: b.createdAt,
            }
          : null;
      })
      .filter(Boolean);
    res.json({ questions });
  } catch (error) {
    res.status(500).json({ message: "Failed to load bookmarks" });
  }
};

export const toggleFavoriteCompany = async (req, res) => {
  try {
    const userId = req.user.id;
    const { companyId } = req.body;
    if (!companyId) return res.status(400).json({ message: "companyId is required" });
    const existing = await StudentPreference.findOne({ userId, type: "favoriteCompany", companyId: String(companyId) });
    if (existing) {
      await existing.deleteOne();
      return res.json({ favorited: false });
    }
    await StudentPreference.create({ userId, type: "favoriteCompany", companyId: String(companyId) });
    res.json({ favorited: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to toggle favorite" });
  }
};

export const getRecentActivity = async (req, res) => {
  try {
    const userId = req.user.id;
    const [lastAttempt, lastSubmission, companies] = await Promise.all([
      PracticeAttempt.findOne({ userId }).sort({ createdAt: -1 }).lean(),
      CodingSubmission.findOne({ userId }).sort({ createdAt: -1 }).lean(),
      Company.find({ isDeleted: { $ne: true } }).select("id name color").lean(),
    ]);
    res.json({
      lastAttempt: lastAttempt
        ? {
            _id: lastAttempt._id,
            companyId: lastAttempt.companyId,
            companyName: lastAttempt.companyName,
            score: lastAttempt.score,
            percentage: lastAttempt.percentage,
            createdAt: lastAttempt.createdAt,
          }
        : null,
      lastSubmission: lastSubmission
        ? {
            _id: lastSubmission._id,
            companyId: lastSubmission.companyId,
            title: lastSubmission.title,
            status: lastSubmission.status,
            passedCount: lastSubmission.passedCount,
            totalCount: lastSubmission.totalCount,
            createdAt: lastSubmission.createdAt,
          }
        : null,
      companies: companies.map((c) => ({ id: c.id, name: c.name, color: c.color })),
    });
  } catch (error) {
    console.error("Get Recent Activity Error:", error.message);
    res.status(500).json({ message: "Failed to load activity" });
  }
};

export const getStudentAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const [attempts, submissions, solvedQuestions, companyAttempts] = await Promise.all([
      PracticeAttempt.find({ userId }).lean(),
      CodingSubmission.find({ userId, status: { $ne: "unsupported" } }).lean(),
      CodingSubmission.distinct("questionId", { userId, status: "accepted" }),
      PracticeAttempt.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: "$companyName", attempts: { $sum: 1 }, avgPercentage: { $avg: "$percentage" }, avgTime: { $avg: "$timeTaken" } } },
        { $sort: { attempts: -1 } },
      ]),
    ]);

    const aptitudeTotal = attempts.length;
    const aptitudeAvg = aptitudeTotal > 0 ? Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / aptitudeTotal) : 0;
    const codingTotal = submissions.length;
    const accepted = submissions.filter((s) => s.status === "accepted").length;
    const codingAvg = codingTotal > 0 ? Math.round((accepted / codingTotal) * 100) : 0;

    const companyMap = new Map(companyAttempts.map((c) => [c._id, c]));
    let bestCompany = null;
    let weakCompany = null;
    if (companyMap.size > 0) {
      const ranked = [...companyMap.values()].sort((a, b) => b.avgPercentage - a.avgPercentage);
      bestCompany = ranked[0]._id;
      weakCompany = ranked[ranked.length - 1]._id;
    }

    const difficultyProgress = {
      easy: { total: 0, correct: 0 },
      medium: { total: 0, correct: 0 },
      hard: { total: 0, correct: 0 },
    };
    for (const attempt of attempts) {
      for (const q of attempt.questions || []) {
        const key = difficultyProgress[q.difficulty] ? q.difficulty : "easy";
        difficultyProgress[key].total++;
        if (q.isCorrect) difficultyProgress[key].correct++;
      }
    }

    res.json({
      companiesPracticed: companyMap.size,
      bestCompany,
      weakCompany,
      averageScore: aptitudeTotal + codingTotal > 0 ? Math.round((aptitudeAvg * aptitudeTotal + codingAvg * codingTotal) / (aptitudeTotal + codingTotal)) : 0,
      aptitudeAttempts: aptitudeTotal,
      aptitudeAvg,
      codingAttempts: codingTotal,
      codingAccepted: accepted,
      codingAvg,
      solvedQuestions: solvedQuestions.length,
      companyBreakdown: [...companyMap.values()].map((c) => ({ company: c._id, attempts: c.attempts, avgPercentage: Math.round(c.avgPercentage), avgTime: Math.round(c.avgTime) })),
      difficultyProgress,
    });
  } catch (error) {
    console.error("Get Student Analytics Error:", error.message);
    res.status(500).json({ message: "Failed to load analytics" });
  }
};

export const getCompanyPracticeAnalytics = async (req, res) => {
  try {
    const companies = await Company.find({ isDeleted: { $ne: true } }).lean();
    const companyIds = companies.map((c) => c.id);
    const [aptAgg, codAgg, aptAvg, codAvg] = await Promise.all([
      PracticeAttempt.aggregate([
        { $match: { companyId: { $in: companyIds } } },
        { $group: { _id: "$companyId", attempts: { $sum: 1 }, students: { $addToSet: "$userId" }, avgTime: { $avg: "$timeTaken" } } },
      ]),
      CodingSubmission.aggregate([
        { $match: { companyId: { $in: companyIds }, status: { $ne: "unsupported" } } },
        { $group: { _id: "$companyId", attempts: { $sum: 1 }, students: { $addToSet: "$userId" }, accepted: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } } } },
      ]),
      PracticeAttempt.aggregate([
        { $match: { companyId: { $in: companyIds } } },
        { $group: { _id: "$companyId", avgPercentage: { $avg: "$percentage" } } },
      ]),
      CodingSubmission.aggregate([
        { $match: { companyId: { $in: companyIds }, status: { $ne: "unsupported" } } },
        { $group: { _id: "$companyId", avgScore: { $avg: { $cond: [{ $eq: ["$status", "accepted"] }, 100, 0] } } } },
      ]),
    ]);
    const [aptQuestionCounts, codQuestionCounts] = await Promise.all([
      AptitudeQuestion.aggregate([{ $match: { companyId: { $in: companyIds }, isDeleted: false } }, { $group: { _id: "$companyId", count: { $sum: 1 } } }]),
      CodingQuestion.aggregate([{ $match: { companyId: { $in: companyIds }, isDeleted: { $ne: true } } }, { $group: { _id: "$companyId", count: { $sum: 1 } } }]),
    ]);
    const aptMap = Object.fromEntries(aptAgg.map((a) => [a._id, a]));
    const codMap = Object.fromEntries(codAgg.map((a) => [a._id, a]));
    const aptAvgMap = Object.fromEntries(aptAvg.map((a) => [a._id, Math.round(a.avgPercentage)]));
    const codAvgMap = Object.fromEntries(codAvg.map((a) => [a._id, Math.round(a.avgScore)]));
    const aptQMap = Object.fromEntries(aptQuestionCounts.map((a) => [a._id, a.count]));
    const codQMap = Object.fromEntries(codQuestionCounts.map((a) => [a._id, a.count]));

    res.json(
      companies.map((c) => ({
        companyId: c.id,
        companyName: c.name,
        color: c.color,
        studentsAttempted: new Set([...(aptMap[c.id]?.students || []), ...(codMap[c.id]?.students || [])]).size,
        aptitudeAttempts: aptMap[c.id]?.attempts || 0,
        codingAttempts: codMap[c.id]?.attempts || 0,
        averageAptitudeScore: aptAvgMap[c.id] || 0,
        averageCodingScore: codAvgMap[c.id] || 0,
        averageTime: Math.round((aptMap[c.id]?.avgTime || 0)),
        aptitudeQuestionCount: aptQMap[c.id] || 0,
        codingQuestionCount: codQMap[c.id] || 0,
      }))
    );
  } catch (error) {
    console.error("Get Company Analytics Error:", error.message);
    res.status(500).json({ message: "Failed to load company analytics" });
  }
};
