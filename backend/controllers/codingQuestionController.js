import CodingQuestion from "../models/CodingQuestion.js";
import Company from "../models/Company.js";
import {
  syncCodingQuestionsFromJson,
  listCodingSourceFiles,
  loadCodingBank,
  normalizeCodingQuestion,
} from "../services/codingQuestionBank.js";
import { createNotification } from "../services/notificationService.js";

const TRASH_RETENTION_DAYS = 30;

async function touchCompany(companyId) {
  if (!companyId) return;
  await Company.updateOne({ id: companyId }, { lastUpdated: new Date() });
}

export const cleanupExpiredCodingTrash = async () => {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await CodingQuestion.deleteMany({ isDeleted: true, deletedAt: { $lt: cutoff } });
  if (result.deletedCount > 0) console.log(`🗑️ Auto-purged ${result.deletedCount} coding questions older than ${TRASH_RETENTION_DAYS} days`);
};

function stripHiddenTestCases(question, role) {
  if (!question) return question;
  if (role === "admin") return question;
  const doc = question.toObject ? question.toObject() : { ...question };
  doc.testCases = (doc.testCases || []).map((tc) => ({
    ...tc,
    isHidden: Boolean(tc.isHidden),
    input: tc.isHidden ? "" : tc.input,
    expected: tc.isHidden ? "" : tc.expected,
  }));
  return doc;
}

export const createCodingQuestion = async (req, res) => {
  try {
    const last = await CodingQuestion.findOne().sort({ createdAt: -1 });
    let num = 1;
    if (last && last.questionId) {
      const match = last.questionId.match(/\d+$/);
      num = match ? parseInt(match[0]) + 1 : 1;
    }
    const questionId = req.body.questionId || `CQ${String(num).padStart(4, "0")}`;
    const question = await CodingQuestion.create({
      ...req.body,
      questionId,
      createdBy: req.user?._id || req.user?.id || null,
      lastEditedBy: req.user?._id || null,
      lastEditedAt: new Date(),
    });
    await touchCompany(question.companyId);
    await createNotification({
      role: "all",
      type: "success",
      title: "New coding question added",
      message: `"${question.title}" (${question.difficulty}) is now available for practice.`,
      link: "/interview-practice",
    });
    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ message: "Failed to create coding question", error: error.message });
  }
};

export const getCodingQuestions = async (req, res) => {
  try {
    const { companyId, difficulty, tags, page = 1, limit = 20, search, includeDeleted } = req.query;
    const filter = {};
    if (!includeDeleted) filter.isDeleted = { $ne: true };
    if (companyId) filter.companyId = companyId;
    if (difficulty) filter.difficulty = difficulty;
    if (tags) filter.tags = { $in: tags.split(",") };
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { problemStatement: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [questions, total] = await Promise.all([
      CodingQuestion.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      CodingQuestion.countDocuments(filter),
    ]);
    res.json({
      questions: questions.map((q) => stripHiddenTestCases(q, req.user?.role)),
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch coding questions", error: error.message });
  }
};

export const getCodingQuestionById = async (req, res) => {
  try {
    const question = await CodingQuestion.findById(req.params.id);
    if (!question) return res.status(404).json({ message: "Question not found" });
    res.json(stripHiddenTestCases(question, req.user?.role));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch question", error: error.message });
  }
};

export const updateCodingQuestion = async (req, res) => {
  try {
    const question = await CodingQuestion.findByIdAndUpdate(
      req.params.id,
      { ...req.body, lastEditedBy: req.user?._id || null, lastEditedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!question) return res.status(404).json({ message: "Question not found" });
    if (req.body.companyId) await touchCompany(req.body.companyId);
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: "Failed to update question", error: error.message });
  }
};

export const deleteCodingQuestion = async (req, res) => {
  try {
    const question = await CodingQuestion.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );
    if (!question) return res.status(404).json({ message: "Question not found" });
    res.json({ message: "Question moved to trash" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete question", error: error.message });
  }
};

export const hardDeleteCodingQuestion = async (req, res) => {
  try {
    const question = await CodingQuestion.findByIdAndDelete(req.params.id);
    if (!question) return res.status(404).json({ message: "Question not found" });
    res.json({ message: "Question permanently deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to hard delete", error: error.message });
  }
};

export const getTrashedCodingQuestions = async (req, res) => {
  try {
    const questions = await CodingQuestion.find({ isDeleted: true }).sort({ deletedAt: -1 }).limit(500).lean();
    res.json({ questions, total: questions.length });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch trash", error: error.message });
  }
};

export const restoreCodingQuestion = async (req, res) => {
  try {
    const question = await CodingQuestion.findByIdAndUpdate(
      req.params.id,
      { isDeleted: false, deletedAt: null, lastEditedAt: new Date(), lastEditedBy: req.user?._id || null },
      { new: true }
    );
    if (!question) return res.status(404).json({ message: "Question not found" });
    res.json({ message: "Question restored", question });
  } catch (error) {
    res.status(500).json({ message: "Failed to restore question", error: error.message });
  }
};

export const syncCodingQuestionsFromJsonHandler = async (req, res) => {
  try {
    const result = await syncCodingQuestionsFromJson();
    res.json({
      message: `Sync complete: ${result.inserted} created, ${result.updated} updated, ${result.unchanged} unchanged, ${result.skipped} skipped across ${result.files} file(s).`,
      ...result,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to sync questions from JSON files", error: error.message });
  }
};

export const getCodingSourceFiles = async (req, res) => {
  try {
    const sources = loadCodingBank().map((s) => ({
      file: s.file,
      company: s.company,
      questionCount: Array.isArray(s.questions) ? s.questions.length : 0,
    }));
    res.json({ directory: "backend/data/coding/", sources, total: sources.reduce((sum, s) => sum + s.questionCount, 0) });
  } catch (error) {
    res.status(500).json({ message: "Failed to list source files", error: error.message });
  }
};

export const bulkImportCodingQuestions = async (req, res) => {
  try {
    const { questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "questions array is required" });
    }
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const companies = await Company.find().lean();
    const companyMap = Object.fromEntries(companies.flatMap((c) => [[c.id, c.name], [String(c.name).toLowerCase(), c.name]]));
    for (const raw of questions) {
      const doc = normalizeCodingQuestion(raw, { companyMap });
      if (!doc) {
        skipped++;
        continue;
      }
      const query = doc.questionId
        ? { questionId: doc.questionId }
        : { title: doc.title, companyId: doc.companyId };
      let existing = doc.questionId ? await CodingQuestion.findOne(query) : null;
      if (!existing) {
        existing = await CodingQuestion.findOne({ title: doc.title, companyId: doc.companyId });
      }
      if (existing) {
        await CodingQuestion.updateOne(
          { _id: existing._id },
          { ...doc, isDeleted: existing.isDeleted, deletedAt: existing.deletedAt, lastEditedAt: new Date() }
        );
        updated++;
      } else {
        await CodingQuestion.create({ ...doc, isDeleted: false, createdBy: req.user?._id || null });
        created++;
      }
    }
    res.json({ message: `Import complete: ${created} created, ${updated} updated, ${skipped} skipped`, created, updated, skipped });
  } catch (error) {
    res.status(500).json({ message: "Failed to import questions", error: error.message });
  }
};

export const toggleCodingQuestion = async (req, res) => {
  try {
    const question = await CodingQuestion.findById(req.params.id);
    if (!question) return res.status(404).json({ message: "Question not found" });
    question.isActive = !question.isActive;
    question.lastEditedBy = req.user?._id || null;
    question.lastEditedAt = new Date();
    await question.save();
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: "Failed to toggle question", error: error.message });
  }
};export const addTestCase = async (req, res) => {
  try {
    const { input, expected, isHidden } = req.body;
    const question = await CodingQuestion.findById(req.params.id);
    if (!question) return res.status(404).json({ message: "Question not found" });
    question.testCases.push({ input, expected, isHidden: isHidden || false });
    question.lastEditedBy = req.user?._id || null;
    question.lastEditedAt = new Date();
    await question.save();
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: "Failed to add test case", error: error.message });
  }
};

export const updateTestCase = async (req, res) => {
  try {
    const { testCaseId } = req.params;
    const { input, expected, isHidden } = req.body;
    const question = await CodingQuestion.findById(req.params.id);
    if (!question) return res.status(404).json({ message: "Question not found" });
    const tc = question.testCases.id(testCaseId);
    if (!tc) return res.status(404).json({ message: "Test case not found" });
    if (input !== undefined) tc.input = input;
    if (expected !== undefined) tc.expected = expected;
    if (isHidden !== undefined) tc.isHidden = isHidden;
    question.lastEditedBy = req.user?._id || null;
    question.lastEditedAt = new Date();
    await question.save();
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: "Failed to update test case", error: error.message });
  }
};

export const deleteTestCase = async (req, res) => {
  try {
    const { testCaseId } = req.params;
    const question = await CodingQuestion.findById(req.params.id);
    if (!question) return res.status(404).json({ message: "Question not found" });
    question.testCases.pull({ _id: testCaseId });
    question.lastEditedBy = req.user?._id || null;
    question.lastEditedAt = new Date();
    await question.save();
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: "Failed to delete test case", error: error.message });
  }
};

export const getCodingStats = async (req, res) => {
  try {
    const filter = { isDeleted: { $ne: true } };
    const total = await CodingQuestion.countDocuments(filter);
    const active = await CodingQuestion.countDocuments({ ...filter, isActive: true });
    const deleted = await CodingQuestion.countDocuments({ isDeleted: true });
    const byDifficulty = await CodingQuestion.aggregate([
      { $match: filter },
      { $group: { _id: "$difficulty", count: { $sum: 1 } } },
    ]);
    const byCompany = await CodingQuestion.aggregate([
      { $match: filter },
      { $group: { _id: "$companyName", count: { $sum: 1 } } },
    ]);
    res.json({ total, active, deleted, byDifficulty, byCompany });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch stats", error: error.message });
  }
};
