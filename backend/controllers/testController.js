import multer from "multer";
import Test from "../models/Test.js";
import TestAssignment from "../models/TestAssignment.js";
import User from "../models/User.js";
import Result from "../models/Result.js";
import { parseQuestions, removeDuplicates, validateQuestions } from "../utils/questionParser.js";

const upload = multer({ storage: multer.memoryStorage() });

export const createTest = async (req, res) => {
  try {
    const {
      title, description, testType, companyId, difficulty,
      duration, passingMarks, attemptLimit, questionSource,
      subjects, codingLanguages, questions, status, scheduledAt,
    } = req.body;

    const test = await Test.create({
      title, description, testType, companyId, difficulty,
      duration, passingMarks, attemptLimit, questionSource: questionSource || "manual",
      subjects: subjects || [],
      codingLanguages: codingLanguages || [],
      questions: questions || [],
      status: status || "draft",
      scheduledAt,
      createdBy: req.user.id,
    });

    res.status(201).json({ message: "Test created", test });
  } catch (error) {
    console.error("Create Test Error:", error.message);
    res.status(500).json({ message: "Failed to create test" });
  }
};

export const getTests = async (req, res) => {
  try {
    const tests = await Test.find().sort({ createdAt: -1 }).lean();
    res.json(tests);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch tests" });
  }
};

export const getTestById = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).lean();
    if (!test) return res.status(404).json({ message: "Test not found" });
    res.json(test);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch test" });
  }
};

export const updateTest = async (req, res) => {
  try {
    const test = await Test.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!test) return res.status(404).json({ message: "Test not found" });
    res.json({ message: "Test updated", test });
  } catch (error) {
    res.status(500).json({ message: "Failed to update test" });
  }
};

export const deleteTest = async (req, res) => {
  try {
    await TestAssignment.deleteMany({ testId: req.params.id });
    await Test.findByIdAndDelete(req.params.id);
    res.json({ message: "Test deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete test" });
  }
};

export const addQuestion = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ message: "Test not found" });
    test.questions.push(req.body);
    await test.save();
    res.json({ message: "Question added", test });
  } catch (error) {
    res.status(500).json({ message: "Failed to add question" });
  }
};

export const updateQuestion = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ message: "Test not found" });
    const q = test.questions.id(req.params.questionId);
    if (!q) return res.status(404).json({ message: "Question not found" });
    Object.assign(q, req.body);
    await test.save();
    res.json({ message: "Question updated", test });
  } catch (error) {
    res.status(500).json({ message: "Failed to update question" });
  }
};

export const deleteQuestion = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ message: "Test not found" });
    test.questions.pull(req.params.questionId);
    await test.save();
    res.json({ message: "Question deleted", test });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete question" });
  }
};

export const assignTest = async (req, res) => {
  try {
    const { testId, assignType, assignValue, studentIds } = req.body;

    const test = await Test.findById(testId);
    if (!test) return res.status(404).json({ message: "Test not found" });

    let targetStudents = [];

    if (assignType === "all") {
      targetStudents = await User.find().select("_id");
    } else if (assignType === "department") {
      targetStudents = await User.find({ department: assignValue }).select("_id");
    } else if (assignType === "year") {
      targetStudents = await User.find({ year: assignValue }).select("_id");
    } else if (assignType === "section") {
      targetStudents = await User.find({ department: assignValue }).select("_id");
    } else if (assignType === "individual" || assignType === "multiple") {
      targetStudents = (studentIds || []).map(id => ({ _id: id }));
    }

    const ids = targetStudents.map(s => s._id);

    const existing = await TestAssignment.findOne({
      testId,
      assignType,
      assignValue: ["department", "year", "section"].includes(assignType) ? assignValue : "",
    });

    if (existing) {
      const merged = [...new Set([...existing.studentIds.map(s => s.toString()), ...ids.map(s => s.toString())])];
      existing.studentIds = merged;
      existing.notAttemptedCount = merged.length - existing.completedCount - existing.autoSubmittedCount;
      await existing.save();
      return res.json({ message: "Assignment updated", assignment: existing });
    }

    const assignment = await TestAssignment.create({
      testId,
      assignType,
      assignValue: ["department", "year", "section"].includes(assignType) ? assignValue : "",
      studentIds: ids,
      notAttemptedCount: ids.length,
      assignedBy: req.user.id,
    });

    res.status(201).json({ message: "Test assigned", assignment });
  } catch (error) {
    console.error("Assign Test Error:", error.message);
    res.status(500).json({ message: "Failed to assign test" });
  }
};

export const getAssignedTests = async (req, res) => {
  try {
    const assignments = await TestAssignment.find()
      .populate("testId")
      .populate("studentIds", "name email department year")
      .sort({ createdAt: -1 })
      .lean();

    const enriched = assignments.map(a => ({
      ...a,
      totalStudents: a.studentIds?.length || 0,
      pendingCount: Math.max(0, (a.studentIds?.length || 0) - (a.completedCount || 0) - (a.autoSubmittedCount || 0)),
    }));

    res.json(enriched);
  } catch (error) {
    console.error("Get Assigned Tests Error:", error.message);
    res.status(500).json({ message: "Failed to fetch assignments" });
  }
};

export const getAssignmentById = async (req, res) => {
  try {
    const assignment = await TestAssignment.findById(req.params.id)
      .populate("testId")
      .populate("studentIds", "name email department year")
      .lean();
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch assignment" });
  }
};

export const deleteAssignment = async (req, res) => {
  try {
    await TestAssignment.findByIdAndDelete(req.params.id);
    res.json({ message: "Assignment removed" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete assignment" });
  }
};

export const uploadQuestions = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const supported = ["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/pdf"];
    const isSupported = supported.some(t => req.file.mimetype.includes(t));
    if (!isSupported) return res.status(400).json({ message: `Unsupported file type: ${req.file.mimetype}. Please upload CSV, Excel, or PDF files.` });

    const questions = await parseQuestions(
      req.file.buffer,
      req.file.mimetype
    );
    const deduped = removeDuplicates(questions);
    const { errors, warnings } = validateQuestions(deduped);
    res.json({
  success: true,
  questions: deduped,
  errors,
  warnings,
  total: deduped.length,
  duplicates: questions.length - deduped.length,
});
    
  } catch (error) {
    const clientErrors = ["Unsupported file type", "CSV must have", "Excel file is empty"];
    if (clientErrors.some(msg => error.message.startsWith(msg))) {
      return res.status(400).json({ message: error.message });
    }
    console.error("Upload Questions Error:");
console.error(error);
console.error(error.stack);
    res.status(500).json({
    success: false,
    message: error.message,
});
  }
};

export const uploadMiddleware = upload.single("file");

export const updateAssignmentStatus = async (req, res) => {
  try {
    const { status, startedCount, completedCount, notAttemptedCount, autoSubmittedCount, averageScore } = req.body;
    const assignment = await TestAssignment.findByIdAndUpdate(
      req.params.id,
      { status, startedCount, completedCount, notAttemptedCount, autoSubmittedCount, averageScore },
      { new: true }
    );
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    res.json({ message: "Assignment updated", assignment });
  } catch (error) {
    res.status(500).json({ message: "Failed to update assignment" });
  }
};
