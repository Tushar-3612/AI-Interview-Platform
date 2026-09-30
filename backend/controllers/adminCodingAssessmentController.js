import mongoose from "mongoose";
import CodingQuestion from "../models/CodingQuestion.js";
import CodingTestCase from "../models/CodingTestCase.js";
import CodingAssessment from "../models/CodingAssessment.js";
import CodingAttempt from "../models/CodingAttempt.js";
import CodingSubmission from "../models/CodingSubmission.js";
import User from "../models/User.js";

/* ==========================================================================
   1. ADMIN QUESTION MANAGEMENT
   ========================================================================== */

export const createQuestion = async (req, res) => {
  try {
    const {
      title,
      description,
      problemStatement,
      difficulty = "Medium",
      category = "Algorithms",
      tags = [],
      inputFormat = "",
      outputFormat = "",
      constraints = "",
      explanation = "",
      examples = [],
      starterCodeByLanguage = {},
      starterCode = "",
      supportedLanguages = ["python", "cpp", "java", "c", "javascript"],
      timeLimit = 2,
      memoryLimit = 256,
      marks = 10,
      isPublished = true,
      testCases = [],
    } = req.body;

    if (!title || (!description && !problemStatement)) {
      return res.status(400).json({
        success: false,
        message: "Title and description/problem statement are required.",
      });
    }

    const question = await CodingQuestion.create({
      title: title.trim(),
      description: description || problemStatement || "",
      problemStatement: problemStatement || description || "",
      difficulty: ["Easy", "Medium", "Hard"].includes(difficulty) ? difficulty : "Medium",
      category: category.trim(),
      tags: Array.isArray(tags) ? tags : [],
      inputFormat,
      outputFormat,
      constraints,
      explanation,
      examples: Array.isArray(examples) ? examples : [],
      starterCode: starterCode || "function solution() {\n  // Write your code here\n}",
      starterCodeByLanguage,
      supportedLanguages,
      timeLimit: Number(timeLimit) || 2,
      memoryLimit: Number(memoryLimit) || 256,
      marks: Number(marks) || 10,
      isPublished: Boolean(isPublished),
      isActive: true,
      createdBy: req.user?._id || req.user?.id || null,
    });

    // If initial test cases were passed, create in CodingTestCase as well
    if (Array.isArray(testCases) && testCases.length > 0) {
      const tcDocs = testCases.map((tc) => ({
        questionId: question._id,
        input: tc.input || "",
        expectedOutput: tc.expectedOutput || tc.expected || "",
        isSample: Boolean(tc.isSample),
        isHidden: tc.isHidden !== undefined ? Boolean(tc.isHidden) : !tc.isSample,
        weight: Number(tc.weight) || 1,
      }));
      await CodingTestCase.insertMany(tcDocs);
    }

    res.status(201).json({
      success: true,
      data: question,
      message: "Question created successfully.",
    });
  } catch (error) {
    console.error("Admin createQuestion error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create question.",
    });
  }
};

export const getQuestions = async (req, res) => {
  try {
    const {
      search = "",
      difficulty,
      category,
      isPublished,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = { isDeleted: { $ne: true } };

    if (difficulty && difficulty !== "all") {
      filter.difficulty = new RegExp(`^${difficulty}$`, "i");
    }

    if (category && category !== "all") {
      filter.category = new RegExp(`^${category}$`, "i");
    }

    if (isPublished !== undefined && isPublished !== "all") {
      filter.isPublished = isPublished === "true" || isPublished === true;
    }

    if (search.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { problemStatement: { $regex: search.trim(), $options: "i" } },
        { description: { $regex: search.trim(), $options: "i" } },
        { tags: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const [questions, total] = await Promise.all([
      CodingQuestion.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      CodingQuestion.countDocuments(filter),
    ]);

    // Attach test case counts
    const questionIds = questions.map((q) => q._id);
    const testCaseCounts = await CodingTestCase.aggregate([
      { $match: { questionId: { $in: questionIds } } },
      {
        $group: {
          _id: "$questionId",
          sampleCount: { $sum: { $cond: ["$isSample", 1, 0] } },
          hiddenCount: { $sum: { $cond: ["$isHidden", 1, 0] } },
          totalCount: { $sum: 1 },
        },
      },
    ]);

    const countMap = {};
    testCaseCounts.forEach((c) => {
      countMap[String(c._id)] = c;
    });

    const enriched = questions.map((q) => {
      const tc = countMap[String(q._id)] || {
        sampleCount: (q.testCases || []).filter((t) => !t.isHidden).length,
        hiddenCount: (q.testCases || []).filter((t) => t.isHidden).length,
        totalCount: (q.testCases || []).length,
      };
      return {
        ...q,
        testCaseStats: tc,
      };
    });

    res.json({
      success: true,
      data: { questions: enriched },
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error("Admin getQuestions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch questions.",
    });
  }
};

export const getQuestionById = async (req, res) => {
  try {
    const question = await CodingQuestion.findById(req.params.id).lean();
    if (!question) {
      return res.status(404).json({ success: false, message: "Question not found." });
    }

    // Load separate test cases
    const testCases = await CodingTestCase.find({ questionId: question._id }).sort({ isSample: -1, createdAt: 1 }).lean();

    res.json({
      success: true,
      data: {
        ...question,
        testCases: testCases.length > 0 ? testCases : question.testCases || [],
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch question." });
  }
};

export const updateQuestion = async (req, res) => {
  try {
    const question = await CodingQuestion.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        lastEditedBy: req.user?._id || req.user?.id || null,
        lastEditedAt: new Date(),
      },
      { new: true, runValidators: true }
    );

    if (!question) {
      return res.status(404).json({ success: false, message: "Question not found." });
    }

    res.json({
      success: true,
      data: question,
      message: "Question updated successfully.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to update question." });
  }
};

export const deleteQuestion = async (req, res) => {
  try {
    const question = await CodingQuestion.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true, deletedAt: new Date(), isActive: false },
      { new: true }
    );
    if (!question) {
      return res.status(404).json({ success: false, message: "Question not found." });
    }
    res.json({ success: true, message: "Question deleted successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete question." });
  }
};

export const togglePublishQuestion = async (req, res) => {
  try {
    const question = await CodingQuestion.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, message: "Question not found." });
    }
    question.isPublished = !question.isPublished;
    await question.save();
    res.json({
      success: true,
      isPublished: question.isPublished,
      message: `Question ${question.isPublished ? "published" : "unpublished"} successfully.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to toggle status." });
  }
};

export const duplicateQuestion = async (req, res) => {
  try {
    const original = await CodingQuestion.findById(req.params.id).lean();
    if (!original) {
      return res.status(404).json({ success: false, message: "Question not found." });
    }

    const { _id, createdAt, updatedAt, ...rest } = original;
    const duplicated = await CodingQuestion.create({
      ...rest,
      title: `${original.title} (Copy)`,
      questionId: `CQ${Date.now().toString().slice(-4)}`,
      createdBy: req.user?._id || req.user?.id || null,
    });

    // Copy test cases
    const testCases = await CodingTestCase.find({ questionId: _id }).lean();
    if (testCases.length > 0) {
      const tcDocs = testCases.map((tc) => ({
        questionId: duplicated._id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isSample: tc.isSample,
        isHidden: tc.isHidden,
        weight: tc.weight,
      }));
      await CodingTestCase.insertMany(tcDocs);
    }

    res.status(201).json({
      success: true,
      data: duplicated,
      message: "Question duplicated successfully.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to duplicate question." });
  }
};

/* ==========================================================================
   2. TEST CASE MANAGEMENT
   ========================================================================== */

export const addTestCase = async (req, res) => {
  try {
    const { id: questionId } = req.params;
    const { input, expectedOutput, expected, isSample = false, isHidden, weight = 1 } = req.body;

    if (input === undefined || (expectedOutput === undefined && expected === undefined)) {
      return res.status(400).json({
        success: false,
        message: "Input and expectedOutput are required.",
      });
    }

    const testCase = await CodingTestCase.create({
      questionId,
      input: String(input),
      expectedOutput: String(expectedOutput ?? expected ?? ""),
      isSample: Boolean(isSample),
      isHidden: isHidden !== undefined ? Boolean(isHidden) : !isSample,
      weight: Number(weight) || 1,
    });

    // Also sync into embedded testCases for backward compatibility
    await CodingQuestion.findByIdAndUpdate(questionId, {
      $push: {
        testCases: {
          _id: testCase._id,
          input: testCase.input,
          expected: testCase.expectedOutput,
          isHidden: testCase.isHidden,
        },
      },
    });

    res.status(201).json({
      success: true,
      data: testCase,
      message: "Test case added successfully.",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to add test case." });
  }
};

export const getQuestionTestCases = async (req, res) => {
  try {
    const { id: questionId } = req.params;
    const testCases = await CodingTestCase.find({ questionId }).sort({ isSample: -1, createdAt: 1 });
    res.json({ success: true, data: testCases });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch test cases." });
  }
};

export const updateTestCase = async (req, res) => {
  try {
    const { id: testCaseId } = req.params;
    const { input, expectedOutput, expected, isSample, isHidden, weight } = req.body;

    const updateFields = {};
    if (input !== undefined) updateFields.input = String(input);
    if (expectedOutput !== undefined || expected !== undefined) {
      updateFields.expectedOutput = String(expectedOutput ?? expected);
    }
    if (isSample !== undefined) updateFields.isSample = Boolean(isSample);
    if (isHidden !== undefined) updateFields.isHidden = Boolean(isHidden);
    if (weight !== undefined) updateFields.weight = Number(weight) || 1;

    const testCase = await CodingTestCase.findByIdAndUpdate(testCaseId, updateFields, { new: true });
    if (!testCase) {
      return res.status(404).json({ success: false, message: "Test case not found." });
    }

    // Sync embedded question testCase
    if (testCase.questionId) {
      await CodingQuestion.updateOne(
        { _id: testCase.questionId, "testCases._id": testCase._id },
        {
          $set: {
            "testCases.$.input": testCase.input,
            "testCases.$.expected": testCase.expectedOutput,
            "testCases.$.isHidden": testCase.isHidden,
          },
        }
      );
    }

    res.json({ success: true, data: testCase, message: "Test case updated successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update test case." });
  }
};

export const deleteTestCase = async (req, res) => {
  try {
    const { id: testCaseId } = req.params;
    const testCase = await CodingTestCase.findByIdAndDelete(testCaseId);
    if (!testCase) {
      return res.status(404).json({ success: false, message: "Test case not found." });
    }

    // Remove from embedded question testCases
    if (testCase.questionId) {
      await CodingQuestion.findByIdAndUpdate(testCase.questionId, {
        $pull: { testCases: { _id: testCase._id } },
      });
    }

    res.json({ success: true, message: "Test case deleted successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete test case." });
  }
};

/* ==========================================================================
   3. ADMIN ASSESSMENT MANAGEMENT
   ========================================================================== */

export const createAssessment = async (req, res) => {
  try {
    const {
      title,
      description = "",
      durationMinutes = 60,
      questions = [],
      isActive = false,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Assessment title is required." });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one question must be selected for the assessment.",
      });
    }

    // Validate that questions exist in MongoDB Question Bank
    const qIds = questions.map((q) => q.questionId || q.id || q._id);
    const validQuestions = await CodingQuestion.find({
      _id: { $in: qIds },
      isDeleted: { $ne: true },
    }).lean();

    if (validQuestions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid questions found from the admin question bank.",
      });
    }

    let calculatedTotalMarks = 0;
    const formattedQuestions = questions.map((q, idx) => {
      const targetId = q.questionId || q.id || q._id;
      const found = validQuestions.find((vq) => String(vq._id) === String(targetId));
      const marks = Number(q.marks) || found?.marks || 10;
      calculatedTotalMarks += marks;
      return {
        questionId: targetId,
        order: Number(q.order) || idx + 1,
        marks,
      };
    });

    const assessment = await CodingAssessment.create({
      title: title.trim(),
      description,
      durationMinutes: Math.max(5, Number(durationMinutes) || 60),
      questions: formattedQuestions,
      totalMarks: calculatedTotalMarks,
      isActive: Boolean(isActive),
      createdBy: req.user?._id || req.user?.id || null,
    });

    res.status(201).json({
      success: true,
      data: assessment,
      message: "Assessment created successfully.",
    });
  } catch (error) {
    console.error("Admin createAssessment error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to create assessment." });
  }
};

export const getAssessments = async (req, res) => {
  try {
    const assessments = await CodingAssessment.find()
      .populate("questions.questionId", "title difficulty category marks")
      .sort({ createdAt: -1 })
      .lean();

    // Attach attempt stats for each assessment
    const assessmentIds = assessments.map((a) => a._id);
    const attempts = await CodingAttempt.aggregate([
      { $match: { assessmentId: { $in: assessmentIds } } },
      {
        $group: {
          _id: "$assessmentId",
          totalAttempts: { $sum: 1 },
          completedAttempts: {
            $sum: { $cond: [{ $in: ["$status", ["SUBMITTED", "AUTO_SUBMITTED"]] }, 1, 0] },
          },
          avgScore: { $avg: "$percentage" },
        },
      },
    ]);

    const attemptMap = {};
    attempts.forEach((att) => {
      attemptMap[String(att._id)] = att;
    });

    const enriched = assessments.map((a) => ({
      ...a,
      stats: attemptMap[String(a._id)] || { totalAttempts: 0, completedAttempts: 0, avgScore: 0 },
    }));

    res.json({ success: true, data: { assessments: enriched } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch assessments." });
  }
};

export const getAssessmentById = async (req, res) => {
  try {
    const assessment = await CodingAssessment.findById(req.params.id)
      .populate("questions.questionId")
      .lean();

    if (!assessment) {
      return res.status(404).json({ success: false, message: "Assessment not found." });
    }

    res.json({ success: true, data: assessment });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch assessment." });
  }
};

export const updateAssessment = async (req, res) => {
  try {
    const { title, description, durationMinutes, questions, isActive } = req.body;

    const assessment = await CodingAssessment.findById(req.params.id);
    if (!assessment) {
      return res.status(404).json({ success: false, message: "Assessment not found." });
    }

    if (title) assessment.title = title.trim();
    if (description !== undefined) assessment.description = description;
    if (durationMinutes) assessment.durationMinutes = Math.max(5, Number(durationMinutes));
    if (isActive !== undefined) assessment.isActive = Boolean(isActive);

    if (Array.isArray(questions)) {
      let total = 0;
      assessment.questions = questions.map((q, idx) => {
        const marks = Number(q.marks) || 10;
        total += marks;
        return {
          questionId: q.questionId || q.id || q._id,
          order: Number(q.order) || idx + 1,
          marks,
        };
      });
      assessment.totalMarks = total;
    }

    await assessment.save();

    res.json({ success: true, data: assessment, message: "Assessment updated successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to update assessment." });
  }
};

export const deleteAssessment = async (req, res) => {
  try {
    const assessment = await CodingAssessment.findByIdAndDelete(req.params.id);
    if (!assessment) {
      return res.status(404).json({ success: false, message: "Assessment not found." });
    }
    res.json({ success: true, message: "Assessment deleted successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete assessment." });
  }
};

export const toggleActivateAssessment = async (req, res) => {
  try {
    const assessment = await CodingAssessment.findById(req.params.id);
    if (!assessment) {
      return res.status(404).json({ success: false, message: "Assessment not found." });
    }
    assessment.isActive = !assessment.isActive;
    await assessment.save();

    res.json({
      success: true,
      isActive: assessment.isActive,
      message: `Assessment ${assessment.isActive ? "activated" : "deactivated"} successfully.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to toggle assessment status." });
  }
};

export const getAssessmentResults = async (req, res) => {
  try {
    const { id: assessmentId } = req.params;
    const assessment = await CodingAssessment.findById(assessmentId)
      .populate("questions.questionId", "title difficulty marks")
      .lean();

    if (!assessment) {
      return res.status(404).json({ success: false, message: "Assessment not found." });
    }

    const attempts = await CodingAttempt.find({ assessmentId })
      .populate("candidateId", "name email rollNumber department")
      .sort({ createdAt: -1 })
      .lean();

    // Shape attempts into a flat structure the frontend table can consume directly
    const results = attempts.map((attempt) => {
      const candidate = attempt.candidateId || {};
      const solvedCount = (attempt.questionProgress || []).filter(
        (qp) => qp.status === "SOLVED" || qp.passedTests === qp.totalTests
      ).length;

      // Time spent: difference between startedAt and submittedAt (or now for in-progress)
      const endTime = attempt.submittedAt || attempt.completedAt || new Date();
      const startTime = attempt.startedAt || new Date();
      const timeSpentSeconds = Math.max(0, Math.floor((new Date(endTime) - new Date(startTime)) / 1000));

      return {
        attemptId: String(attempt._id),
        candidateName: candidate.name || "Unknown",
        candidateEmail: candidate.email || "—",
        candidateRollNumber: candidate.rollNumber || "—",
        candidateDepartment: candidate.department || "—",
        status: attempt.status || "IN_PROGRESS",
        obtainedMarks: attempt.obtainedMarks ?? 0,
        totalMarks: attempt.totalMarks ?? assessment.totalMarks ?? 0,
        percentage: attempt.percentage ?? 0,
        solvedQuestions: solvedCount,
        totalQuestions: assessment.questions?.length ?? 0,
        timeSpentSeconds,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt || attempt.completedAt || null,
      };
    });

    res.json({
      success: true,
      data: {
        assessment: {
          _id: assessment._id,
          title: assessment.title,
          totalMarks: assessment.totalMarks,
          durationMinutes: assessment.durationMinutes,
          questions: assessment.questions,
        },
        results,
      },
    });
  } catch (error) {
    console.error("getAssessmentResults error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch assessment results." });
  }
};

export const getCandidateAttemptDetail = async (req, res) => {
  try {
    const attempt = await CodingAttempt.findById(req.params.id)
      .populate("candidateId", "name email department rollNumber")
      .populate("assessmentId", "title durationMinutes totalMarks")
      .populate("questionProgress.questionId", "title difficulty category marks")
      .lean();

    if (!attempt) {
      return res.status(404).json({ success: false, message: "Attempt not found." });
    }

    // Retrieve all submissions by this candidate for this attempt
    const submissions = await CodingSubmission.find({ attemptId: attempt._id })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        ...attempt,
        submissions,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch candidate attempt detail." });
  }
};
