import TechnicalQuestion from "../models/TechnicalQuestion.js";
import QuestionExposure from "../models/QuestionExposure.js";

/**
 * GET /api/technical-questions
 * Get all technical questions (admin).
 */
export const getTechnicalQuestions = async (req, res) => {
  try {
    const { companyId, topic, difficulty, isActive, page = 1, limit = 50 } = req.query;

    const query = { isDeleted: { $ne: true } };
    if (companyId) {
      query.$or = [{ companyId }, { companyIds: companyId }];
    }
    if (topic) query.topic = topic;
    if (difficulty) query.difficulty = difficulty;
    if (isActive !== undefined) query.isActive = isActive === "true";

    const total = await TechnicalQuestion.countDocuments(query);
    const questions = await TechnicalQuestion.find(query)
      .sort({ companyId: 1, topic: 1, questionId: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    res.json({ questions, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    console.error("Get Technical Questions Error:", error.message);
    res.status(500).json({ message: "Failed to fetch technical questions" });
  }
};

/**
 * GET /api/technical-questions/stats
 * Get technical question statistics.
 */
export const getTechnicalQuestionStats = async (req, res) => {
  try {
    const { companyId } = req.query;

    const query = { isDeleted: { $ne: true } };
    if (companyId) query.companyId = companyId;

    const total = await TechnicalQuestion.countDocuments(query);
    const active = await TechnicalQuestion.countDocuments({ ...query, isActive: true });

    const byCompany = await TechnicalQuestion.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: "$companyId", total: { $sum: 1 }, active: { $sum: { $cond: ["$isActive", 1, 0] } } } },
      { $sort: { _id: 1 } },
    ]);

    const byTopic = await TechnicalQuestion.aggregate([
      { $match: { isDeleted: { $ne: true }, isActive: true } },
      { $group: { _id: { companyId: "$companyId", topic: "$topic" }, count: { $sum: 1 } } },
      { $sort: { "_id.companyId": 1, "_id.topic": 1 } },
    ]);

    const byDifficulty = await TechnicalQuestion.aggregate([
      { $match: { isDeleted: { $ne: true }, isActive: true } },
      { $group: { _id: { companyId: "$companyId", difficulty: "$difficulty" }, count: { $sum: 1 } } },
    ]);

    // Usage stats
    const usageStats = await TechnicalQuestion.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: "$companyId", totalUsage: { $sum: "$usageCount" } } },
    ]);

    res.json({
      total,
      active,
      byCompany,
      byTopic,
      byDifficulty,
      usageStats,
    });
  } catch (error) {
    console.error("Get Technical Question Stats Error:", error.message);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
};

/**
 * POST /api/technical-questions
 * Create a new technical question.
 */
export const createTechnicalQuestion = async (req, res) => {
  try {
    const {
      companyId,
      companyName,
      topic,
      subtopic,
      difficulty,
      questionType,
      question,
      expectedAnswer,
      explanation,
      marks,
    } = req.body;

    if (!companyId || !question || !expectedAnswer) {
      return res.status(400).json({ message: "Company, question, and expected answer are required" });
    }

    // Generate unique question ID
    const topicPrefix = topic
      ? topic.replace(/[^A-Z0-9]/gi, "").substring(0, 6).toUpperCase()
      : "TECH";
    const count = await TechnicalQuestion.countDocuments({ companyId });
    const questionId = `TECH-${topicPrefix}-${String(count + 1).padStart(3, "0")}`;

    const newQuestion = await TechnicalQuestion.create({
      questionId,
      companyId,
      companyName: companyName || companyId,
      topic: topic || "Other",
      subtopic: subtopic || "",
      difficulty: difficulty || "Medium",
      questionType: questionType || "Conceptual",
      question,
      expectedAnswer,
      explanation: explanation || "",
      marks: marks || 1,
      lastEditedBy: req.user.id,
      lastEditedAt: new Date(),
    });

    res.status(201).json(newQuestion);
  } catch (error) {
    console.error("Create Technical Question Error:", error.message);
    res.status(500).json({ message: "Failed to create technical question" });
  }
};

/**
 * PUT /api/technical-questions/:id
 * Update a technical question.
 */
export const updateTechnicalQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    updates.lastEditedBy = req.user.id;
    updates.lastEditedAt = new Date();

    const question = await TechnicalQuestion.findByIdAndUpdate(id, updates, { new: true });
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    res.json(question);
  } catch (error) {
    console.error("Update Technical Question Error:", error.message);
    res.status(500).json({ message: "Failed to update technical question" });
  }
};

/**
 * DELETE /api/technical-questions/:id
 * Soft delete a technical question.
 */
export const deleteTechnicalQuestion = async (req, res) => {
  try {
    const { id } = req.params;

    const question = await TechnicalQuestion.findByIdAndUpdate(
      id,
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    res.json({ message: "Question deleted" });
  } catch (error) {
    console.error("Delete Technical Question Error:", error.message);
    res.status(500).json({ message: "Failed to delete technical question" });
  }
};

/**
 * POST /api/technical-questions/bulk
 * Bulk create technical questions.
 */
export const bulkCreateTechnicalQuestions = async (req, res) => {
  try {
    const { questions } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "Questions array is required" });
    }

    const created = [];
    const errors = [];

    for (let i = 0; i < questions.length; i++) {
      try {
        const q = questions[i];
        const topicPrefix = q.topic
          ? q.topic.replace(/[^A-Z0-9]/gi, "").substring(0, 6).toUpperCase()
          : "TECH";
        const count = await TechnicalQuestion.countDocuments({ companyId: q.companyId });
        const questionId = q.questionId || `TECH-${topicPrefix}-${String(count + 1).padStart(3, "0")}`;

        const newQ = await TechnicalQuestion.create({
          questionId,
          companyId: q.companyId,
          companyName: q.companyName || q.companyId,
          topic: q.topic || "Other",
          subtopic: q.subtopic || "",
          difficulty: q.difficulty || "Medium",
          questionType: q.questionType || "Conceptual",
          question: q.question,
          expectedAnswer: q.expectedAnswer,
          explanation: q.explanation || "",
          marks: q.marks || 1,
          lastEditedBy: req.user.id,
          lastEditedAt: new Date(),
        });
        created.push(newQ);
      } catch (err) {
        errors.push({ index: i, error: err.message });
      }
    }

    res.json({ created: created.length, errors });
  } catch (error) {
    console.error("Bulk Create Technical Questions Error:", error.message);
    res.status(500).json({ message: "Failed to bulk create questions" });
  }
};

/**
 * GET /api/technical-questions/usage/:questionId
 * Get usage stats for a specific question.
 */
export const getQuestionUsage = async (req, res) => {
  try {
    const { questionId } = req.params;
    const { companyId } = req.query;

    const question = await TechnicalQuestion.findOne({ questionId, isDeleted: { $ne: true } }).lean();
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    // Count total eligible students
    const { default: User } = await import("../models/User.js");
    const totalStudents = await User.countDocuments({ role: "student" });

    // Count students who have seen this question
    const exposedStudents = await QuestionExposure.distinct("studentId", {
      companyId: companyId || question.companyId,
      questionId,
      questionType: "technical",
    });

    res.json({
      questionId,
      usageCount: question.usageCount,
      exposedStudents: exposedStudents.length,
      remainingEligible: totalStudents - exposedStudents.length,
      totalStudents,
    });
  } catch (error) {
    console.error("Get Question Usage Error:", error.message);
    res.status(500).json({ message: "Failed to get usage stats" });
  }
};
