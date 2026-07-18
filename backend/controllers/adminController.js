import User from "../models/User.js";
import Interview from "../models/Interview.js";
import Answer from "../models/Answer.js";
import Result from "../models/Result.js";
import Company from "../models/Company.js";
import { generateStudentPDF } from "../utils/pdfGenerator.js";
import { sendReportEmail } from "../utils/emailSender.js";
import { exportSingleStudentCSV, exportAllStudentsCSV } from "../utils/reportExporter.js";

/**
 * Get dashboard overview metrics and charts.
 */
export const getStats = async (req, res) => {
  try {
    const totalStudents = await User.countDocuments();
    const totalPracticeInterviews = await Interview.countDocuments({ interviewType: "practice" });
    const totalRealInterviews = await Interview.countDocuments({ interviewType: "real" });
    const totalResumes = await User.countDocuments({ resumeFileName: { $ne: "" } });

    // Average Score
    const results = await Result.find();
    const totalResults = results.length;
    const avgScore = totalResults > 0 
      ? Math.round(results.reduce((sum, r) => sum + (r.overallScore || 0), 0) / totalResults) 
      : 0;

    // Top Performer
    let topPerformer = { name: "N/A", score: 0 };
    if (totalResults > 0) {
      const topResult = await Result.findOne().sort({ overallScore: -1 }).populate("userId");
      if (topResult && topResult.userId) {
        topPerformer = {
          name: topResult.userId.name,
          score: topResult.overallScore,
        };
      }
    }

    // Recent Activity (combine recent student signups and recent completed interviews)
    const recentStudents = await User.find().sort({ createdAt: -1 }).limit(5).lean();
    const recentInterviews = await Interview.find({ status: "completed" })
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate("userId")
      .lean();

    const activityFeed = [];
    recentStudents.forEach((student) => {
      activityFeed.push({
        type: "signup",
        message: `New student ${student.name} registered`,
        timestamp: student.createdAt,
        id: student._id,
      });
    });

    recentInterviews.forEach((interview) => {
      if (interview.userId) {
        activityFeed.push({
          type: "interview",
          message: `${interview.userId.name} completed a ${interview.interviewType} interview`,
          timestamp: interview.updatedAt,
          id: interview._id,
          score: interview.overallScore,
        });
      }
    });

    activityFeed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const recentActivities = activityFeed.slice(0, 7);

    // Chart Data 1: Score Distribution
    const scores = results.map(r => r.overallScore || 0);
    const scoreDistribution = {
      excellent: scores.filter(s => s >= 85).length, // 85-100
      good: scores.filter(s => s >= 70 && s < 85).length, // 70-84
      average: scores.filter(s => s >= 50 && s < 70).length, // 50-69
      poor: scores.filter(s => s < 50).length, // <50
    };

    // Chart Data 2: Activity Over Last 7 Days
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split("T")[0];
    }).reverse();

    const activityChart = await Promise.all(last7Days.map(async (dateStr) => {
      const startOfDay = new Date(dateStr);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateStr);
      endOfDay.setHours(23, 59, 59, 999);

      const count = await Interview.countDocuments({
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      });

      return {
        date: new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        attempts: count,
      };
    }));

    // Chart Data 3: Department Breakdown
    const departments = await User.aggregate([
      { $group: { _id: "$department", count: { $sum: 1 } } }
    ]);
    const deptBreakdown = departments.map(d => ({
      name: d._id || "Other",
      value: d.count,
    }));

    res.json({
      metrics: {
        totalStudents,
        totalPracticeInterviews,
        totalRealInterviews,
        totalResumes,
        avgScore,
        topPerformer,
      },
      recentActivities,
      charts: {
        scoreDistribution,
        activityChart,
        deptBreakdown,
      }
    });
  } catch (error) {
    console.error("Get Admin Stats Error:", error.message);
    res.status(500).json({ message: "Server error generating dashboard statistics" });
  }
};

/**
 * Get paginated, searchable list of students.
 */
export const getStudents = async (req, res) => {
  try {
    const { search, department, year, page = 1, limit = 10 } = req.query;

    const query = {};

    // Apply filters
    if (department) {
      query.department = department;
    }
    if (year) {
      query.year = year;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skipCount = (Number(page) - 1) * Number(limit);
    const total = await User.countDocuments(query);
    const students = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skipCount)
      .limit(Number(limit))
      .lean();

    // Map attempts and averages for each student
    const studentList = await Promise.all(students.map(async (student) => {
      const studentId = student._id.toString();
      const attempts = await Interview.countDocuments({ userId: studentId });
      const studentResults = await Result.find({ userId: studentId });
      const scores = studentResults.map(r => r.overallScore).filter(s => s !== undefined);
      
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const highestScore = scores.length > 0 ? Math.max(...scores) : 0;

      return {
        ...student,
        attempts,
        avgScore,
        highestScore,
      };
    }));

    res.json({
      students: studentList,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      }
    });
  } catch (error) {
    console.error("Get Admin Students Error:", error.message);
    res.status(500).json({ message: "Server error retrieving student list" });
  }
};

/**
 * Get detailed student profile, resume, and interview history.
 */
export const getStudentDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await User.findById(id).select("-password").lean();
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Get interviews and results
    const interviews = await Interview.find({ userId: id }).sort({ createdAt: -1 }).lean();
    const results = await Result.find({ userId: id }).lean();

    // Attach individual Q&As to each interview session
    const interviewHistory = await Promise.all(interviews.map(async (interview) => {
      const answers = await Answer.find({ interviewId: interview._id }).lean();
      const resultObj = results.find(r => r.interviewId.toString() === interview._id.toString());
      return {
        ...interview,
        result: resultObj || null,
        answers,
      };
    }));

    // Company Wise Analytics for this student
    const companyAnalytics = [];
    const companies = await Company.find().lean();
    const practiceRuns = interviews.filter(i => i.interviewType === "practice");

    // Group practice runs by company
    const groupMap = {};
    practiceRuns.forEach((run) => {
      if (run.companyId) {
        if (!groupMap[run.companyId]) groupMap[run.companyId] = [];
        groupMap[run.companyId].push(run);
      }
    });

    Object.entries(groupMap).forEach(([companyId, runs]) => {
      const compInfo = companies.find(c => c.id === companyId) || { name: companyId };
      const attempts = runs.length;
      const scores = runs.map(r => r.overallScore || 0);
      const bestScore = Math.max(...scores);
      const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / attempts);
      const latestScore = runs[0].overallScore || 0;
      const dates = runs.map(r => r.createdAt);

      companyAnalytics.push({
        companyId,
        companyName: compInfo.name,
        color: compInfo.color || "#2563EB",
        attempts,
        bestScore,
        averageScore,
        latestScore,
        interviewDates: dates,
      });
    });

    res.json({
      student,
      interviewHistory,
      companyAnalytics,
    });
  } catch (error) {
    console.error("Get Student Details Error:", error.message);
    res.status(500).json({ message: "Server error retrieving student details" });
  }
};

/**
 * Edit student details.
 */
export const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, department, year, phone, portfolio, github, linkedin, skills, atsScore } = req.body;

    const student = await User.findById(id);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    if (name) student.name = name;
    if (department) student.department = department;
    if (year) student.year = year;
    if (phone !== undefined) student.phone = phone;
    if (portfolio !== undefined) student.portfolio = portfolio;
    if (github !== undefined) student.github = github;
    if (linkedin !== undefined) student.linkedin = linkedin;
    if (skills !== undefined) student.skills = skills;
    if (atsScore !== undefined) student.atsScore = Number(atsScore);

    await student.save();

    res.json({ message: "Student profile updated successfully", student });
  } catch (error) {
    console.error("Admin Update Student Error:", error.message);
    res.status(500).json({ message: "Server error updating student profile" });
  }
};

/**
 * Delete a student and cascade clear interviews, results, answers.
 */
export const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await User.findById(id);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Cascade delete
    await Answer.deleteMany({ userId: id });
    await Result.deleteMany({ userId: id });
    await Interview.deleteMany({ userId: id });
    await User.findByIdAndDelete(id);

    res.json({ message: "Student and all associated records deleted successfully" });
  } catch (error) {
    console.error("Delete Student Error:", error.message);
    res.status(500).json({ message: "Server error deleting student records" });
  }
};

/**
 * Generate PDF & CSV reports, and email them to the student's registered address.
 */
export const emailReport = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await User.findById(id);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const interviews = await Interview.find({ userId: id }).sort({ createdAt: -1 });
    const results = await Result.find({ userId: id });

    // Generate files in memory
    const pdfBuffer = await generateStudentPDF(student, interviews, results);
    const csvContent = exportSingleStudentCSV(student, interviews, results);
    const csvBuffer = Buffer.from(csvContent, "utf-8");

    // Email content
    const subject = "Your AI Mock Interview Performance Report";
    const text = `Hello ${student.name},\n\nPlease find attached your comprehensive AI Interview performance report, including profile metrics, resume ATS scores, and evaluations of your mock interview attempts.\n\nBest regards,\nPlacement Cell`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #2563eb;">AI Interview Performance Report</h2>
        <p>Hello <strong>${student.name}</strong>,</p>
        <p>Your placement preparation review is complete. We have generated your consolidated analysis report.</p>
        <p><strong>Summary of Metrics:</strong></p>
        <ul>
          <li>Resume ATS Score: <strong>${student.atsScore || 0}%</strong></li>
          <li>Total Interviews Taken: <strong>${interviews.length}</strong></li>
        </ul>
        <p>Please find the detailed PDF & Excel/CSV logs attached to this email.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #475569;">Generated automatically by Sanjivani AI Interview Platform.</p>
      </div>
    `;

    const attachments = [
      {
        filename: `${student.name.replace(/\s+/g, "_")}_Performance_Report.pdf`,
        content: pdfBuffer,
      },
      {
        filename: `${student.name.replace(/\s+/g, "_")}_Logs.csv`,
        content: csvBuffer,
      }
    ];

    const mailStatus = await sendReportEmail(student.email, subject, text, html, attachments);

    res.json({
      message: mailStatus.simulated
        ? "Email simulated successfully. Reports exported to server storage folder."
        : "Performance report email dispatched to the student successfully.",
      status: mailStatus,
    });
  } catch (error) {
    console.error("Email Report Error:", error.message);
    res.status(500).json({ message: "Failed to compile or email reports", error: error.message });
  }
};

/**
 * Export CSV/Excel of all students.
 */
export const exportAllReport = async (req, res) => {
  try {
    const students = await User.find().select("-password").lean();
    const interviews = await Interview.find().lean();
    const results = await Result.find().lean();

    const csvContent = exportAllStudentsCSV(students, interviews, results);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=all_students_report.csv");
    res.status(200).send(csvContent);
  } catch (error) {
    console.error("Export All CSV Error:", error.message);
    res.status(500).json({ message: "Failed to generate CSV download" });
  }
};

/**
 * Export CSV/Excel of a single student.
 */
export const exportSingleReport = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await User.findById(id).lean();
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const interviews = await Interview.find({ userId: id }).lean();
    const results = await Result.find({ userId: id }).lean();

    const csvContent = exportSingleStudentCSV(student, interviews, results);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=${student.name.replace(/\s+/g, "_")}_report.csv`);
    res.status(200).send(csvContent);
  } catch (error) {
    console.error("Export Single CSV Error:", error.message);
    res.status(500).json({ message: "Failed to generate CSV download" });
  }
};

/**
 * Download single student PDF directly.
 */
export const downloadSinglePDF = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await User.findById(id);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const interviews = await Interview.find({ userId: id }).sort({ createdAt: -1 });
    const results = await Result.find({ userId: id });

    const pdfBuffer = await generateStudentPDF(student, interviews, results);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${student.name.replace(/\s+/g, "_")}_report.pdf`);
    res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error("Download PDF Error:", error.message);
    res.status(500).json({ message: "Failed to generate PDF download" });
  }
};

/* ====================================================
   COMPANY MANAGEMENT (CRUD)
   ==================================================== */

export const getCompanies = async (req, res) => {
  try {
    const list = await Company.find().sort({ name: 1 });
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: "Error fetching company list" });
  }
};

export const addCompany = async (req, res) => {
  try {
    const { name, color, technical, coding, hr, difficulty } = req.body;

    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const exists = await Company.findOne({ id });
    if (exists) {
      return res.status(400).json({ message: "A company with this name already exists" });
    }

    const company = await Company.create({
      id,
      name,
      color: color || "#2563EB",
      technical: Number(technical) || 0,
      coding: Number(coding) || 0,
      hr: Number(hr) || 0,
      difficulty: difficulty || "Medium",
    });

    res.status(201).json({ message: "Company added successfully", company });
  } catch (error) {
    res.status(500).json({ message: "Error creating company profile" });
  }
};

export const updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, technical, coding, hr, difficulty } = req.body;

    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({ message: "Company profile not found" });
    }

    if (name) company.name = name;
    if (color) company.color = color;
    if (technical !== undefined) company.technical = Number(technical);
    if (coding !== undefined) company.coding = Number(coding);
    if (hr !== undefined) company.hr = Number(hr);
    if (difficulty) company.difficulty = difficulty;

    await company.save();

    res.json({ message: "Company updated successfully", company });
  } catch (error) {
    res.status(500).json({ message: "Error editing company profile" });
  }
};

export const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({ message: "Company profile not found" });
    }

    await Company.findByIdAndDelete(id);
    res.json({ message: "Company profile deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting company" });
  }
};

export const getCompanyAnalytics = async (req, res) => {
  try {
    const companies = await Company.find().lean();
    const interviews = await Interview.find({ interviewType: "practice" }).lean();

    const analytics = await Promise.all(companies.map(async (company) => {
      const runs = interviews.filter(i => i.companyId === company.id);
      const attempts = runs.length;
      
      const scores = runs.map(r => r.overallScore || 0);
      const bestScore = attempts > 0 ? Math.max(...scores) : 0;
      const averageScore = attempts > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / attempts) : 0;
      const latestScore = attempts > 0 ? (runs[runs.length - 1].overallScore || 0) : 0;
      const latestDate = attempts > 0 ? runs[runs.length - 1].createdAt : null;

      return {
        companyId: company.id,
        name: company.name,
        color: company.color,
        difficulty: company.difficulty,
        attempts,
        bestScore,
        averageScore,
        latestScore,
        latestDate,
      };
    }));

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: "Error loading company analytics stats" });
  }
};

/**
 * Retrieves aggregate reports of practice & real interviews.
 */
export const getInterviewsReport = async (req, res) => {
  try {
    const interviews = await Interview.find()
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .lean();

    const results = await Result.find().lean();
    const companies = await Company.find().lean();

    const formattedPractice = [];
    const formattedReal = [];

    interviews.forEach((interview) => {
      if (!interview.userId) return;

      const durationMs = interview.completedAt && interview.startedAt
        ? new Date(interview.completedAt) - new Date(interview.startedAt)
        : 0;
      
      // Calculate minutes and seconds string
      let durationStr = "N/A";
      if (durationMs > 0) {
        const totalSecs = Math.round(durationMs / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        durationStr = `${mins}m ${secs}s`;
      }

      if (interview.interviewType === "practice") {
        const comp = companies.find(c => c.id === interview.companyId) || {};
        formattedPractice.push({
          _id: interview._id,
          studentName: interview.userId.name,
          studentEmail: interview.userId.email,
          companyId: interview.companyId,
          companyName: comp.name || interview.companyId || "General",
          color: comp.color || "#2563EB",
          difficulty: comp.difficulty || "Medium",
          score: interview.overallScore || 0,
          duration: durationStr,
          createdAt: interview.createdAt,
        });
      } else {
        const resObj = results.find(r => r.interviewId.toString() === interview._id.toString()) || {};
        formattedReal.push({
          _id: interview._id,
          studentName: interview.userId.name,
          studentEmail: interview.userId.email,
          status: interview.status,
          score: interview.overallScore || 0,
          resumeScore: resObj.resumeScore || 0,
          technicalScore: resObj.technicalScore || 0,
          codingScore: resObj.codingScore || 0,
          feedback: resObj.recommendation || "Completed successfully.",
          createdAt: interview.createdAt,
        });
      }
    });

    res.json({
      practice: formattedPractice,
      real: formattedReal,
    });
  } catch (error) {
    console.error("Get Interviews Report Error:", error.message);
    res.status(500).json({ message: "Server error retrieving interviews report" });
  }
};
