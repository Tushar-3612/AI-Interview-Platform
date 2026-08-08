import AptitudeQuestion from "../models/AptitudeQuestion.js";
import Company from "../models/Company.js";
import SystemConfig from "../models/SystemConfig.js";
import { syncAptitudeQuestionToBank } from "../utils/seedDefaults.js";
import { deactivateBankQuestion } from "../services/questionBank.js";
import { createNotification } from "../services/notificationService.js";

const TRASH_RETENTION_DAYS = 30;

async function touchCompany(companyId) {
  if (!companyId) return;
  await Company.updateOne({ id: companyId }, { lastUpdated: new Date() });
}

export const cleanupExpiredTrash = async () => {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await AptitudeQuestion.deleteMany({ isDeleted: true, deletedAt: { $lt: cutoff } });
  if (result.deletedCount > 0) console.log(`🗑️ Auto-purged ${result.deletedCount} aptitude questions older than ${TRASH_RETENTION_DAYS} days`);
};

export const seedAptitudeQuestions = async (req, res) => {
  try {
    const { questions, companyId } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "Questions array is required" });
    }
    const enriched = questions.map((q, i) => {
      let difficulty = "easy";
      if (i >= Math.floor(questions.length / 3) * 2) difficulty = "hard";
      else if (i >= Math.floor(questions.length / 3)) difficulty = "medium";
      return {
        questionId: q.id,
        category: q.category || "General",
        question: q.question,
        options: q.options,
        correctAnswer: q.answer,
        difficulty,
        explanation: q.explanation || "",
        companyId: companyId || "",
      };
    });
    await AptitudeQuestion.insertMany(enriched);
    await createNotification({
      role: "all",
      type: "success",
      title: "New aptitude questions added",
      message: `${enriched.length} aptitude questions were added for practice.`,
      link: "/interview-practice",
    });
    res.json({ message: `Seeded ${enriched.length} aptitude questions`, count: enriched.length });
  } catch (error) {
    res.status(500).json({ message: "Failed to seed questions", error: error.message });
  }
};

export const getAptitudeQuestions = async (req, res) => {
  try {
    const { difficulty, category, companyId, page = 1, limit = 50, search, tags } = req.query;
    const filter = { isDeleted: false };
    if (difficulty) filter.difficulty = difficulty.toLowerCase();
    if (category) filter.category = category;
    if (companyId) filter.companyId = companyId;
    if (tags) {
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
      filter.$or = [...(filter.$or || []), { category: { $in: tagList } }];
    }
    if (search) {
      filter.$or = [
        ...(filter.$or || []),
        { question: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { questionId: { $regex: search, $options: "i" } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [questions, total] = await Promise.all([
      AptitudeQuestion.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      AptitudeQuestion.countDocuments(filter),
    ]);
    res.json({ questions, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch questions", error: error.message });
  }
};

export const getTrashedAptitudeQuestions = async (req, res) => {
  try {
    const questions = await AptitudeQuestion.find({ isDeleted: true }).sort({ deletedAt: -1 }).limit(500).lean();
    res.json({ questions, total: questions.length });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch trash", error: error.message });
  }
};

export const restoreAptitudeQuestion = async (req, res) => {
  try {
    const question = await AptitudeQuestion.findByIdAndUpdate(
      req.params.id,
      { isDeleted: false, deletedAt: null, lastEditedAt: new Date(), lastEditedBy: req.user?._id || req.user?.id || null },
      { new: true }
    );
    if (!question) return res.status(404).json({ message: "Question not found" });
    await syncAptitudeQuestionToBank(question);
    res.json({ message: "Question restored", question });
  } catch (error) {
    res.status(500).json({ message: "Failed to restore question", error: error.message });
  }
};

export const hardDeleteAptitudeQuestion = async (req, res) => {
  try {
    const question = await AptitudeQuestion.findByIdAndDelete(req.params.id);
    if (!question) return res.status(404).json({ message: "Question not found" });
    deactivateBankQuestion(question.questionId);
    res.json({ message: "Question permanently deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to permanently delete", error: error.message });
  }
};

export const bulkRestoreAptitudeQuestions = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids array is required" });
    const questions = await AptitudeQuestion.find({ _id: { $in: ids } });
    await AptitudeQuestion.updateMany({ _id: { $in: ids } }, { isDeleted: false, deletedAt: null });
    questions.forEach((q) => syncAptitudeQuestionToBank(q));
    res.json({ message: `Restored ${ids.length} questions`, count: ids.length });
  } catch (error) {
    res.status(500).json({ message: "Failed to bulk restore", error: error.message });
  }
};

export const bulkHardDeleteAptitudeQuestions = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids array is required" });
    const questions = await AptitudeQuestion.find({ _id: { $in: ids } });
    questions.forEach((q) => deactivateBankQuestion(q.questionId));
    await AptitudeQuestion.deleteMany({ _id: { $in: ids } });
    res.json({ message: `Permanently deleted ${ids.length} questions`, count: ids.length });
  } catch (error) {
    res.status(500).json({ message: "Failed to bulk delete", error: error.message });
  }
};

export const bulkImportAptitudeQuestions = async (req, res) => {
  try {
    const { questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "questions array is required" });
    }
    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const raw of questions) {
      if (!raw || !raw.question || !Array.isArray(raw.options) || raw.options.length === 0) {
        skipped++;
        continue;
      }
      const last = await AptitudeQuestion.findOne().sort({ createdAt: -1 });
      let num = 1;
      if (last && last.questionId) {
        const match = last.questionId.match(/\d+$/);
        num = match ? parseInt(match[0]) + 1 : 1;
      }
      const questionId = raw.questionId || raw.id || `AQ${String(num).padStart(4, "0")}`;
      const existing = await AptitudeQuestion.findOne({ questionId });
      const doc = {
        questionId,
        category: raw.category || "General",
        question: raw.question,
        options: raw.options.map(String),
        correctAnswer: String(raw.answer ?? raw.correctAnswer ?? ""),
        difficulty: String(raw.difficulty || "easy").toLowerCase(),
        explanation: raw.explanation || "",
        marks: Number(raw.marks) || 1,
        companyId: raw.companyId || "",
        companyName: raw.companyName || "",
        isActive: raw.isActive !== false,
        isDeleted: false,
      };
      if (existing) {
        await AptitudeQuestion.updateOne({ _id: existing._id }, doc);
        const updatedDoc = await AptitudeQuestion.findById(existing._id);
        await syncAptitudeQuestionToBank(updatedDoc);
        updated++;
      } else {
        const createdDoc = await AptitudeQuestion.create(doc);
        await syncAptitudeQuestionToBank(createdDoc);
        created++;
      }
    }
    if (created > 0) {
      await createNotification({
        role: "all",
        type: "success",
        title: "New aptitude questions added",
        message: `${created} new aptitude questions were added for practice.`,
        link: "/interview-practice",
      });
    }
    res.json({ message: `Import complete: ${created} created, ${updated} updated, ${skipped} skipped`, created, updated, skipped });
  } catch (error) {
    res.status(500).json({ message: "Failed to import questions", error: error.message });
  }
};

export const bulkAssignAptitudeQuestions = async (req, res) => {
  try {
    const { ids, companyId = "", difficulty = "", category = "", marks = null, explanation = "" } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids array is required" });
    const patch = {};
    if (companyId) {
      const company = await Company.findOne({ id: companyId }).lean();
      patch.companyId = companyId;
      patch.companyName = company?.name || "";
    }
    if (difficulty) patch.difficulty = difficulty.toLowerCase();
    if (category) patch.category = category;
    if (marks != null) patch.marks = Number(marks);
    if (explanation !== undefined) patch.explanation = explanation;
    patch.lastEditedAt = new Date();
    patch.lastEditedBy = req.user?._id || req.user?.id || null;
    const questions = await AptitudeQuestion.find({ _id: { $in: ids } });
    await AptitudeQuestion.updateMany({ _id: { $in: ids } }, patch);
    questions.forEach((q) => {
      q.set(patch);
      syncAptitudeQuestionToBank(q);
    });
    if (companyId) await touchCompany(companyId);
    res.json({ message: `Assigned to ${ids.length} questions`, count: ids.length });
  } catch (error) {
    res.status(500).json({ message: "Failed to bulk assign", error: error.message });
  }
};

export const getAptitudeQuestionById = async (req, res) => {
  try {
    const question = await AptitudeQuestion.findById(req.params.id);
    if (!question) return res.status(404).json({ message: "Question not found" });
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch question", error: error.message });
  }
};

export const createAptitudeQuestion = async (req, res) => {
  try {
    const last = await AptitudeQuestion.findOne().sort({ createdAt: -1 });
    let num = 1;
    if (last && last.questionId) {
      const match = last.questionId.match(/\d+$/);
      num = match ? parseInt(match[0]) + 1 : 1;
    }
    const questionId = `AQ${String(num).padStart(4, "0")}`;
    const question = await AptitudeQuestion.create({
      ...req.body,
      questionId,
      lastEditedBy: req.user?._id || req.user?.id || null,
      lastEditedAt: new Date(),
    });
    await syncAptitudeQuestionToBank(question);
    await touchCompany(question.companyId);
    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ message: "Failed to create question", error: error.message });
  }
};

export const updateAptitudeQuestion = async (req, res) => {
  try {
    const question = await AptitudeQuestion.findByIdAndUpdate(
      req.params.id,
      { ...req.body, lastEditedBy: req.user?._id || req.user?.id || null, lastEditedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!question) return res.status(404).json({ message: "Question not found" });
    await syncAptitudeQuestionToBank(question);
    if (req.body.companyId) await touchCompany(req.body.companyId);
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: "Failed to update question", error: error.message });
  }
};

export const deleteAptitudeQuestion = async (req, res) => {
  try {
    const question = await AptitudeQuestion.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );
    if (!question) return res.status(404).json({ message: "Question not found" });
    deactivateBankQuestion(question.questionId);
    res.json({ message: "Question moved to trash" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete question", error: error.message });
  }
};

export const bulkDeleteAptitudeQuestions = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "ids array is required" });
    }
    await AptitudeQuestion.updateMany(
      { _id: { $in: ids } },
      { isDeleted: true, deletedAt: new Date() }
    );
    const questions = await AptitudeQuestion.find({ _id: { $in: ids } });
    questions.forEach((q) => deactivateBankQuestion(q.questionId));
    res.json({ message: `Moved ${ids.length} questions to trash`, count: ids.length });
  } catch (error) {
    res.status(500).json({ message: "Failed to bulk delete", error: error.message });
  }
};

export const toggleAptitudeQuestion = async (req, res) => {
  try {
    const question = await AptitudeQuestion.findById(req.params.id);
    if (!question) return res.status(404).json({ message: "Question not found" });
    question.isActive = !question.isActive;
    question.lastEditedBy = req.user?._id || req.user?.id || null;
    question.lastEditedAt = new Date();
    await question.save();
    await syncAptitudeQuestionToBank(question);
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: "Failed to toggle question", error: error.message });
  }
};

export const getRandomAptitudeQuestions = async (req, res) => {
  try {
    const { easy = 10, medium = 10, hard = 10, companyId } = req.query;
    const baseFilter = { isActive: true, isDeleted: false };
    if (companyId) baseFilter.companyId = companyId;

    const getRandom = async (difficulty, count) => {
      const matchFilter = { ...baseFilter, difficulty };
      const total = await AptitudeQuestion.countDocuments(matchFilter);
      const actualCount = Math.min(count, total);
      if (actualCount === 0) return [];
      const results = await AptitudeQuestion.aggregate([
        { $match: matchFilter },
        { $sample: { size: actualCount } },
      ]);
      return results;
    };

    const [easyQuestions, mediumQuestions, hardQuestions] = await Promise.all([
      getRandom("easy", parseInt(easy)),
      getRandom("medium", parseInt(medium)),
      getRandom("hard", parseInt(hard)),
    ]);

    const allQuestions = [...easyQuestions, ...mediumQuestions, ...hardQuestions];
    const shuffleArray = (arr) => {
      const shuffled = [...arr];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    const shuffled = shuffleArray(allQuestions);
    const result = shuffled.map((q) => {
      const shuffledOptions = shuffleArray(q.options);
      return {
        _id: q._id,
        questionId: q.questionId,
        category: q.category,
        question: q.question,
        options: shuffledOptions,
        difficulty: q.difficulty,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        marks: q.marks,
      };
    });

    res.json({ questions: result, total: result.length });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch random questions", error: error.message });
  }
};

export const getAptitudeStats = async (req, res) => {
  try {
    const filter = { isDeleted: false };
    const total = await AptitudeQuestion.countDocuments(filter);
    const byDifficulty = await AptitudeQuestion.aggregate([
      { $match: filter },
      { $group: { _id: "$difficulty", count: { $sum: 1 } } },
    ]);
    const byCategory = await AptitudeQuestion.aggregate([
      { $match: filter },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);
    const byCompany = await AptitudeQuestion.aggregate([
      { $match: filter },
      { $group: { _id: "$companyName", count: { $sum: 1 } } },
    ]);
    const activeCount = await AptitudeQuestion.countDocuments({ ...filter, isActive: true });
    const deletedCount = await AptitudeQuestion.countDocuments({ isDeleted: true });
    res.json({ total, active: activeCount, deleted: deletedCount, byDifficulty, byCategory, byCompany });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch stats", error: error.message });
  }
};
