import multer from "multer";
import mongoose from "mongoose";
import Test from "../models/Test.js";
import TestAssignment from "../models/TestAssignment.js";
import TestAttempt from "../models/TestAttempt.js";
import TestResult from "../models/TestResult.js";
import User from "../models/User.js";
import Result from "../models/Result.js";
import {
  parseQuestions,
  validateQuestions,
  findDuplicates,
  toAppQuestion,
  detectFileKind,
  containsPlaceholder,
} from "../utils/questionParser.js";
import {
  generateCsvTemplate,
  generateDocxTemplate,
  generatePdfTemplate,
} from "../utils/templateGenerator.js";
import { normalizeYear, normalizeDepartment, yearQuery } from "../utils/academicConfig.js";

const upload = multer({ storage: multer.memoryStorage() });

/* ═══════════════════════════════════════════════════════════════
   TEST CRUD
   ═══════════════════════════════════════════════════════════════ */

export const createTest = async (req, res) => {
  try {
    const {
      title, description, testType, companyId, difficulty,
      duration, passingMarks, attemptLimit, questionSource,
      subjects, codingLanguages, questions, status, scheduledAt,
      startAt, endAt, evaluationMethod,
    } = req.body;

    const safeQuestions = (questions || []).map((q) => ({
      ...q,
      question: q.question || q.problemTitle || "",
    }));

    const test = await Test.create({
      title, description, testType, companyId, difficulty,
      duration, passingMarks, attemptLimit, questionSource: questionSource || "manual",
      subjects: subjects || [],
      codingLanguages: codingLanguages || [],
      questions: safeQuestions,
      status: status || "draft",
      scheduledAt: scheduledAt || undefined,
      startAt: startAt || undefined,
      endAt: endAt || undefined,
      evaluationMethod: evaluationMethod || "ai",
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
    await TestAttempt.deleteMany({ testId: req.params.id });
    await Test.findByIdAndDelete(req.params.id);
    res.json({ message: "Test deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete test" });
  }
};

/* ═══════════════════════════════════════════════════════════════
   QUESTION MANAGEMENT
   ═══════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════
   PUBLISH / SCHEDULE / CLOSE TEST
   ═══════════════════════════════════════════════════════════════ */

export const publishTest = async (req, res) => {
  try {
    const { startAt, endAt } = req.body;
    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ message: "Test not found" });

    if (test.status === "completed") {
      return res.status(400).json({ message: "Cannot publish a completed test" });
    }

    if (!test.questions || test.questions.length === 0) {
      return res.status(400).json({ message: "Cannot publish a test with no questions" });
    }

    const existingAssignment = await TestAssignment.findOne({ testId: test._id, status: { $ne: "archived" } });
    if (!existingAssignment) {
      return res.status(400).json({ message: "Assign at least one student before publishing the test." });
    }

    if (!startAt) {
      return res.status(400).json({ message: "Start date and time are required." });
    }
    if (!endAt) {
      return res.status(400).json({ message: "End date and time are required." });
    }

    const s = new Date(startAt);
    const e = new Date(endAt);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e.getTime() <= s.getTime()) {
      return res.status(400).json({ message: "End date and time must be after the start date and time." });
    }

    test.status = "scheduled";
    test.scheduledAt = s;
    test.startAt = s;
    test.endAt = e;
    test.publishedAt = new Date();

    await test.save();
    res.json({ message: "Test published", test });
  } catch (error) {
    console.error("Publish Test Error:", error.message);
    res.status(500).json({ message: "Failed to publish test" });
  }
};

export const scheduleTest = async (req, res) => {
  try {
    const { startAt, endAt } = req.body;
    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ message: "Test not found" });

    if (!startAt) {
      return res.status(400).json({ message: "Start date/time is required" });
    }

    test.status = "scheduled";
    test.startAt = new Date(startAt);
    test.endAt = endAt ? new Date(endAt) : undefined;
    test.scheduledAt = new Date(startAt);
    await test.save();

    res.json({ message: "Test scheduled", test });
  } catch (error) {
    console.error("Schedule Test Error:", error.message);
    res.status(500).json({ message: "Failed to schedule test" });
  }
};

export const rescheduleTest = async (req, res) => {
  try {
    const { startAt, endAt } = req.body;
    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ message: "Test not found" });

    if (startAt) test.startAt = new Date(startAt);
    if (endAt) test.endAt = new Date(endAt);
    if (startAt) test.scheduledAt = new Date(startAt);
    await test.save();

    res.json({ message: "Test rescheduled", test });
  } catch (error) {
    console.error("Reschedule Test Error:", error.message);
    res.status(500).json({ message: "Failed to reschedule test" });
  }
};

export const closeTest = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ message: "Test not found" });

    test.status = "completed";
    test.closedAt = new Date();
    await test.save();

    await TestAssignment.updateMany(
      { testId: test._id, status: "active" },
      { status: "completed" }
    );

    res.json({ message: "Test closed", test });
  } catch (error) {
    console.error("Close Test Error:", error.message);
    res.status(500).json({ message: "Failed to close test" });
  }
};

/* ═══════════════════════════════════════════════════════════════
   ASSIGNMENT MANAGEMENT
   ═══════════════════════════════════════════════════════════════ */

export const assignTest = async (req, res) => {
  try {
    const { testId, assignType, assignValue, studentIds, department, year, section } = req.body;

    if (!testId) {
      return res.status(400).json({ message: "Test identifier is required." });
    }

    const test = await Test.findById(testId);
    if (!test) return res.status(404).json({ message: "Test does not exist." });

    const normalizedDepartment = department ? normalizeDepartment(department) : "";
    const normalizedYear = year ? normalizeYear(year) : "";

    let targetStudents = [];
    let resolvedAssignType = assignType;
    let resolvedAssignValue = assignValue || "";
    let resolvedDepartment = normalizedDepartment;
    let resolvedYear = normalizedYear;
    let resolvedSection = section || "";

    if (assignType === "department_year") {
      resolvedAssignType = "department";
      resolvedAssignValue = normalizedDepartment;
      const query = {};
      if (department) query.department = normalizedDepartment;
      if (year) query.year = yearQuery(year);
      targetStudents = await User.find(query).select("_id");
    } else if (assignType === "all") {
      targetStudents = await User.find().select("_id");
    } else if (assignType === "department") {
      if (!assignValue) {
        return res.status(400).json({ message: "Please select a department." });
      }
      targetStudents = await User.find({ department: normalizeDepartment(assignValue) }).select("_id");
      resolvedDepartment = normalizeDepartment(assignValue);
    } else if (assignType === "year") {
      if (!assignValue) {
        return res.status(400).json({ message: "Please select an academic year." });
      }
      targetStudents = await User.find({ year: yearQuery(assignValue) }).select("_id");
      resolvedYear = normalizeYear(assignValue);
    } else if (assignType === "section") {
      if (!assignValue) {
        return res.status(400).json({ message: "Please select a section." });
      }
      targetStudents = await User.find({ section: assignValue }).select("_id");
      resolvedSection = assignValue;
    } else if (assignType === "individual" || assignType === "multiple") {
      const providedIds = Array.isArray(studentIds) ? studentIds : [];
      if (providedIds.length === 0) {
        return res.status(400).json({ message: "No students were selected." });
      }
      const valid = await User.find({ _id: { $in: providedIds } }).select("_id");
      const validIds = valid.map((u) => u._id.toString());
      const invalidCount = providedIds.length - validIds.length;
      if (validIds.length === 0) {
        return res.status(400).json({ message: "One or more selected students are invalid." });
      }
      if (invalidCount > 0) {
        return res.status(400).json({
          message: "One or more selected students are invalid.",
          validStudentIds: validIds,
        });
      }
      targetStudents = valid;
    } else {
      return res.status(400).json({ message: "Invalid assignment type." });
    }

    const ids = targetStudents.map((s) => s._id);

    if (ids.length === 0) {
      if (assignType === "individual" || assignType === "multiple") {
        return res.status(400).json({ message: "No students were selected." });
      }
      return res.status(400).json({
        message: "No students match the selected criteria. Try a different Department / Year combination.",
      });
    }

    const existingQuery = { testId };
    if (resolvedAssignType === "department" && resolvedDepartment) {
      existingQuery.department = resolvedDepartment;
      if (resolvedYear) existingQuery.year = resolvedYear;
    } else if (resolvedAssignType === "year" && resolvedYear) {
      existingQuery.year = resolvedYear;
    } else if (resolvedAssignType === "section" && resolvedSection) {
      existingQuery.section = resolvedSection;
    } else {
      existingQuery.assignType = resolvedAssignType;
    }

    const existing = await TestAssignment.findOne(existingQuery);

    if (existing) {
      const merged = [...new Set([...existing.studentIds.map((s) => s.toString()), ...ids.map((s) => s.toString())])];
      // Do not create duplicate assignments for students already assigned.
      const alreadyAssigned = existing.studentIds.map((s) => s.toString()).length;
      existing.studentIds = merged;
      existing.notAttemptedCount = merged.length - existing.completedCount - existing.autoSubmittedCount;
      await existing.save();
      const newlyAdded = merged.length - alreadyAssigned;
      return res.json({
        message: newlyAdded > 0 ? "Assignment updated" : "These students are already assigned to this test.",
        assignment: existing,
        alreadyAssigned: newlyAdded === 0,
      });
    }

    const assignment = await TestAssignment.create({
      testId,
      assignType: resolvedAssignType,
      assignValue: resolvedAssignValue,
      department: resolvedDepartment,
      year: resolvedYear,
      section: resolvedSection,
      studentIds: ids,
      notAttemptedCount: ids.length,
      assignedBy: req.user?.id,
    });

    res.status(201).json({ message: "Test assigned", assignment });
  } catch (error) {
    console.error("Assign Test Error:", error.message);
    res.status(500).json({ message: error.message || "Unable to create assignment." });
  }
};

const ATTEMPT_STARTED = ["started", "completed", "auto_submitted"];
const ATTEMPT_SUBMITTED = ["completed", "auto_submitted"];

function computeEffectiveStatus(test, assignment) {
  if (!test) return "draft";
  const now = new Date();
  if (test.status === "draft") return "draft";
  if (assignment?.status === "completed" || test.closedAt) return "completed";
  const start = test.startAt ? new Date(test.startAt) : null;
  const end = test.endAt ? new Date(test.endAt) : null;
  if (start && start > now) return "upcoming";
  if (end && end < now) return "expired";
  return "active";
}

export const getAssignedTests = async (req, res) => {
  try {
    const assignments = await TestAssignment.find()
      .populate("testId")
      .populate("studentIds", "name email department year")
      .sort({ createdAt: -1 })
      .lean();

    const enriched = await Promise.all(assignments.map(async (a) => {
      const test = a.testId || {};
      const testId = test._id;
      const rawStudentIds = (a.studentIds || []).map(s => (s._id ? s._id.toString() : s.toString()));
      const uniqueStudentIds = [...new Set(rawStudentIds)];
      const assigned = uniqueStudentIds.length;

      let started = 0, completed = 0, autoSubmitted = 0;
      let passed = 0, failed = 0, pctSum = 0, pctCount = 0;
      let highestScore = null, lowestScore = null;

      if (testId && assigned > 0) {
        const studentObjIds = uniqueStudentIds.map(id => new mongoose.Types.ObjectId(id));
        const tId = new mongoose.Types.ObjectId(testId);

        const attemptAgg = await TestAttempt.aggregate([
          { $match: { testId: tId, userId: { $in: studentObjIds } } },
          {
            $group: {
              _id: null,
              started: { $sum: { $cond: [{ $in: ["$status", ATTEMPT_STARTED] }, 1, 0] } },
              completed: { $sum: { $cond: [{ $in: ["$status", ATTEMPT_SUBMITTED] }, 1, 0] } },
              autoSubmitted: { $sum: { $cond: [{ $eq: ["$status", "auto_submitted"] }, 1, 0] } },
            },
          },
        ]);
        if (attemptAgg[0]) {
          started = attemptAgg[0].started;
          completed = attemptAgg[0].completed;
          autoSubmitted = attemptAgg[0].autoSubmitted;
        }

        const resultAgg = await TestResult.aggregate([
          { $match: { testId: tId, userId: { $in: studentObjIds } } },
          {
            $group: {
              _id: null,
              passed: { $sum: { $cond: ["$passed", 1, 0] } },
              failed: { $sum: { $cond: ["$passed", 0, 1] } },
              pctSum: { $sum: { $ifNull: ["$percentage", 0] } },
              pctCount: { $sum: 1 },
              highest: { $max: "$percentage" },
              lowest: { $min: "$percentage" },
            },
          },
        ]);
        if (resultAgg[0]) {
          passed = resultAgg[0].passed;
          failed = resultAgg[0].failed;
          pctSum = resultAgg[0].pctSum;
          pctCount = resultAgg[0].pctCount;
          highestScore = pctCount > 0 ? Math.round(resultAgg[0].highest) : null;
          lowestScore = pctCount > 0 ? Math.round(resultAgg[0].lowest) : null;
        }
      }

      const notAttempted = Math.max(0, assigned - started);
      const averageScore = pctCount > 0 ? Math.round(pctSum / pctCount) : 0;

      return {
        ...a,
        totalStudents: assigned,
        startedCount: started,
        completedCount: completed,
        autoSubmittedCount: autoSubmitted,
        notAttemptedCount: notAttempted,
        passedCount: passed,
        failedCount: failed,
        averageScore,
        highestScore,
        lowestScore,
        effectiveStatus: computeEffectiveStatus(test, a),
        pendingCount: Math.max(0, assigned - completed - autoSubmitted),
      };
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

export const closeAssignment = async (req, res) => {
  try {
    const assignment = await TestAssignment.findByIdAndUpdate(
      req.params.id,
      { status: "completed" },
      { new: true }
    );
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    res.json({ message: "Assignment closed", assignment });
  } catch (error) {
    console.error("Close Assignment Error:", error.message);
    res.status(500).json({ message: "Failed to close assignment" });
  }
};

/* ═══════════════════════════════════════════════════════════════
   ASSIGNMENT MONITORING (per-student status + violations)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Shared student-row builder used by both the monitoring endpoint and the
 * Excel export so every surface shows the exact same real data.
 * Status is derived strictly from the actual TestAttempt for THIS test+student.
 */
async function buildAssignmentStudentRows(assignment) {
  const studentIds = (assignment.studentIds || []).map(s => s._id || s);
  const testId = assignment.testId?._id || assignment.testId;

  const [attempts, results] = await Promise.all([
    TestAttempt.find({ testId, userId: { $in: studentIds } }).lean(),
    TestResult.find({ testId, userId: { $in: studentIds } }).lean(),
  ]);

  const attemptMap = {};
  attempts.forEach(a => { attemptMap[a.userId.toString()] = a; });
  const resultMap = {};
  results.forEach(r => { resultMap[r.userId.toString()] = r; });

  return (assignment.studentIds || []).map(student => {
    const sid = (student._id || student).toString();
    const attempt = attemptMap[sid];
    const result = resultMap[sid];

    let status = "Not Started";
    if (attempt?.status === "completed") status = "Completed";
    else if (attempt?.status === "auto_submitted") status = "Auto Submitted";
    else if (attempt?.status === "started") status = "In Progress";

    return {
      _id: student._id || student,
      name: student.name,
      email: student.email,
      department: student.department || "N/A",
      year: student.year || "N/A",
      section: student.section || assignment.section || "N/A",
      status,
      startedAt: attempt?.startTime || null,
      submittedAt: attempt?.submittedAt || null,
      score: result?.obtainedMarks ?? attempt?.totalScore ?? null,
      totalMarks: result?.totalMarks ?? null,
      percentage: result?.percentage ?? null,
      resultPassed: result ? Boolean(result.passed) : null,
      tabSwitchCount: attempt?.tabSwitchCount || 0,
      autoSubmitReason: attempt?.autoSubmitReason || "",
    };
  });
}

export const getAssignmentStudents = async (req, res) => {
  try {
    const assignment = await TestAssignment.findById(req.params.id)
      .populate("testId", "title testType difficulty duration passingMarks questions")
      .populate("studentIds", "name email department year section")
      .lean();

    if (!assignment) return res.status(404).json({ message: "Assignment not found" });

    const studentDetails = await buildAssignmentStudentRows(assignment);

    const stats = {
      total: studentDetails.length,
      notStarted: studentDetails.filter(s => s.status === "Not Started").length,
      inProgress: studentDetails.filter(s => s.status === "In Progress").length,
      completed: studentDetails.filter(s => s.status === "Completed").length,
      autoSubmitted: studentDetails.filter(s => s.status === "Auto Submitted").length,
      totalTabSwitches: studentDetails.reduce((sum, s) => sum + s.tabSwitchCount, 0),
    };

    res.json({ assignment, students: studentDetails, stats });
  } catch (error) {
    console.error("Get Assignment Students Error:", error.message);
    res.status(500).json({ message: "Failed to fetch assignment students" });
  }
};

export const exportAssignmentStudents = async (req, res) => {
  try {
    const XLSX = (await import("xlsx")).default;
    const assignment = await TestAssignment.findById(req.params.id)
      .populate("testId", "title testType companyId")
      .populate("studentIds", "name email department year section")
      .lean();

    if (!assignment) return res.status(404).json({ message: "Assignment not found" });

    const test = assignment.testId || {};
    const students = await buildAssignmentStudentRows(assignment);

    if (students.length === 0) {
      return res.status(404).json({ message: "No students assigned to this test" });
    }

    const title = `${test.title || "Test"} — Student Results`;
    const headers = [
      "Student Name", "Department", "Academic Year", "Section", "Test Name",
      "Status", "Marks", "Percentage", "Result", "Tab Switches",
    ];

    const dataRows = students.map(s => ([
      s.name || "N/A",
      s.department || "N/A",
      s.year || "N/A",
      s.section || "N/A",
      test.title || "N/A",
      s.status,
      s.score != null ? `${s.score} / ${s.totalMarks != null ? s.totalMarks : "N/A"}` : "N/A",
      s.percentage != null ? `${s.percentage}%` : "N/A",
      s.resultPassed === null ? "N/A" : (s.resultPassed ? "PASS" : "FAIL"),
      s.tabSwitchCount || 0,
    ]));

    // Row 0: merged title | Row 1: metadata | Row 2: spacer | Row 3: header | Row 4+: data
    const aoa = [
      [title],
      ["Test Name:", test.title || "N/A", "", "Test Type:", test.testType || "N/A", "", "Total Students:", students.length],
      [""],
      headers,
      ...dataRows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const lastRow = aoa.length; // 1-based last row number

    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }];
    ws["!cols"] = [
      { wch: 22 }, // Student Name
      { wch: 24 }, // Department
      { wch: 14 }, // Academic Year
      { wch: 9 },  // Section
      { wch: 26 }, // Test Name
      { wch: 14 }, // Status
      { wch: 12 }, // Marks
      { wch: 12 }, // Percentage
      { wch: 10 }, // Result
      { wch: 13 }, // Tab Switches
    ];
    ws["!freeze"] = { xSplit: 0, ySplit: 4 };
    ws["!autofilter"] = { ref: `A4:J${lastRow}` };

    const thin = { style: "thin", color: { rgb: "FFD0D0D0" } };
    const border = { top: thin, bottom: thin, left: thin, right: thin };

    // Title styling
    if (ws["A1"]) {
      ws["A1"].s = {
        font: { bold: true, sz: 14, color: { rgb: "FFFFFFFF" } },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: "FF4F46E5" } },
      };
    }

    // Header row (row index 3)
    for (let c = 0; c < 10; c++) {
      const addr = XLSX.utils.encode_cell({ r: 3, c });
      if (!ws[addr]) ws[addr] = { t: "s", v: headers[c] };
      ws[addr].s = {
        font: { bold: true, color: { rgb: "FF1F2937" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        fill: { fgColor: { rgb: "FFEFEFEF" } },
        border,
      };
    }

    // Data rows (row index 4 .. lastRow-1)
    for (let r = 4; r < lastRow; r++) {
      for (let c = 0; c < 10; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (!cell) continue;
        const centered = c >= 6 && c <= 9; // Marks, Percentage, Result, Tab Switches
        const wrap = c === 1 || c === 4;   // Department, Test Name
        cell.s = {
          alignment: { horizontal: centered ? "center" : "left", vertical: "center", wrapText: wrap },
          border,
        };
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Student Results");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const safeName = (test.title || "Test").replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${safeName}_Student_Results.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buf);
  } catch (error) {
    console.error("Export Assignment Students Error:", error.message);
    res.status(500).json({ message: "Failed to export student results" });
  }
};

/* ═══════════════════════════════════════════════════════════════
   FILE UPLOAD
   ═══════════════════════════════════════════════════════════════ */

export const uploadQuestions = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    if (req.file.size > 10 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: "File is too large. Please upload a file smaller than 10MB.",
      });
    }

    const kind = detectFileKind(req.file.originalname, req.file.mimetype);
    if (!kind) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid file type. Please upload a .csv, .docx or .pdf file using the official Technical Questions template.",
      });
    }

    const parsed = await parseQuestions(req.file.buffer, kind);
    if (!parsed || parsed.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "We couldn't find any questions in this file. Please make sure it follows the official template format.",
      });
    }

    if (containsPlaceholder(parsed)) {
      return res.status(400).json({
        success: false,
        message:
          "Please replace the template placeholder values before uploading. Replace the bracketed [Enter ...] text with your own questions.",
      });
    }

    const { valid, invalid } = validateQuestions(parsed);
    const duplicates = findDuplicates(parsed);

    res.json({
      success: true,
      total: parsed.length,
      validCount: valid.length,
      invalidCount: invalid.length,
      validQuestions: valid.map(toAppQuestion),
      invalidQuestions: invalid,
      duplicates,
    });
  } catch (error) {
    console.error("Upload Questions Error:", error.message);
    res.status(400).json({
      success: false,
      message:
        error.message ||
        "We couldn't parse this file. Please download the official template and upload the completed version.",
    });
  }
};

export const downloadTemplate = async (req, res) => {
  const format = (req.params.format || "").toLowerCase();
  try {
    if (format === "csv") {
      const csv = generateCsvTemplate();
      res.setHeader("Content-Disposition", "attachment; filename=technical_questions_template.csv");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      return res.status(200).send(csv);
    }
    if (format === "docx") {
      const buf = generateDocxTemplate();
      res.setHeader("Content-Disposition", "attachment; filename=technical_questions_template.docx");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      return res.status(200).send(buf);
    }
    if (format === "pdf") {
      const buf = await generatePdfTemplate();
      res.setHeader("Content-Disposition", "attachment; filename=technical_questions_template.pdf");
      res.setHeader("Content-Type", "application/pdf");
      return res.status(200).send(buf);
    }
    return res.status(400).json({ message: "Unknown template format" });
  } catch (error) {
    console.error("Download Template Error:", error.message);
    res.status(500).json({ message: "Failed to generate template" });
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
