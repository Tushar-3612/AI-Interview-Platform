import User from "../models/User.js";
import Interview from "../models/Interview.js";
import CompanyMockAttempt from "../models/CompanyMockAttempt.js";
import Result from "../models/Result.js";
import TestAttempt from "../models/TestAttempt.js";
import Company from "../models/Company.js";
import { normalizeDepartment } from "../utils/academicConfig.js";

/**
 * 1. Summary Cards Overview (Real Data Only)
 */
export const getAnalyticsOverview = async (req, res) => {
  try {
    // Total Students
    const totalStudents = await User.countDocuments({ role: { $ne: "admin" } });

    // Active Students (students with at least 1 mock or test attempt or interview)
    const activeMockUserIds = await CompanyMockAttempt.distinct("userId");
    const activeInterviewUserIds = await Interview.distinct("userId");
    const activeTestUserIds = await TestAttempt.distinct("userId");

    const allActiveUserIds = new Set([
      ...activeMockUserIds.map((id) => String(id)),
      ...activeInterviewUserIds.map((id) => String(id)),
      ...activeTestUserIds.map((id) => String(id)),
    ]);
    const activeStudents = allActiveUserIds.size;

    // Total Assessments
    const totalMockAttempts = await CompanyMockAttempt.countDocuments();
    const totalRealInterviews = await Interview.countDocuments({
      interviewType: { $in: ["actual", "real"] },
    });
    const totalTestAttempts = await TestAttempt.countDocuments();
    const totalAssessments = totalMockAttempts + totalRealInterviews + totalTestAttempts;

    // Completed Assessments
    const completedMocks = await CompanyMockAttempt.countDocuments({ status: "completed" });
    const completedInterviews = await Interview.countDocuments({ status: "completed" });
    const completedTests = await TestAttempt.countDocuments({ status: "completed" });
    const completedAssessments = completedMocks + completedInterviews + completedTests;

    // Calculate Average Score across completed Company Mocks & Results
    const completedMockDocs = await CompanyMockAttempt.find({ status: "completed" }).select("scores");
    const completedResultDocs = await Result.find().select("overallScore overall");

    let totalScoreSum = 0;
    let scoreCount = 0;

    for (const doc of completedMockDocs) {
      if (doc.scores && typeof doc.scores.percentage === "number") {
        totalScoreSum += doc.scores.percentage;
        scoreCount++;
      }
    }

    for (const doc of completedResultDocs) {
      const p = doc.overall?.percentage || doc.overallScore;
      if (typeof p === "number" && !isNaN(p)) {
        totalScoreSum += p;
        scoreCount++;
      }
    }

    const averageScore = scoreCount > 0 ? Math.round((totalScoreSum / scoreCount) * 10) / 10 : 0;

    // Success Rate (Percentage of completed assessments with score >= 60%)
    let passingCount = 0;
    for (const doc of completedMockDocs) {
      if (doc.scores && doc.scores.percentage >= 60) passingCount++;
    }
    for (const doc of completedResultDocs) {
      const p = doc.overall?.percentage || doc.overallScore;
      if (p >= 60) passingCount++;
    }

    const overallSuccessRate = scoreCount > 0 ? Math.round((passingCount / scoreCount) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalStudents,
        activeStudents,
        totalAssessments,
        completedAssessments,
        totalMockAttempts,
        totalRealInterviews,
        totalTestAttempts,
        averageScore,
        overallSuccessRate,
      },
    });
  } catch (error) {
    console.error("[ADMIN ANALYTICS] getAnalyticsOverview error:", error);
    res.status(500).json({ message: "Failed to load analytics overview" });
  }
};

/**
 * 2. Department-Wise Student Analytics (Dynamic Departments from DB)
 */
export const getDepartmentAnalytics = async (req, res) => {
  try {
    const { department, year, section, startDate, endDate } = req.query;

    const userMatch = { role: { $ne: "admin" } };
    if (department) userMatch.department = normalizeDepartment(department);
    if (year) userMatch.year = String(year).trim();
    if (section) userMatch.section = String(section).trim();

    const students = await User.find(userMatch).select("_id name email department year section").lean();

    // Group students by department
    const deptMap = new Map();
    const studentToDept = new Map();

    for (const s of students) {
      const d = s.department || "Unassigned";
      studentToDept.set(String(s._id), d);
      if (!deptMap.has(d)) {
        deptMap.set(d, {
          department: d,
          totalStudents: 0,
          studentIds: new Set(),
          attemptingStudentIds: new Set(),
          completedStudentIds: new Set(),
          totalAttempts: 0,
          completedAttempts: 0,
          scores: [],
          highestScore: 0,
          lowestScore: 100,
        });
      }
      const entry = deptMap.get(d);
      entry.totalStudents++;
      entry.studentIds.add(String(s._id));
    }

    // Build Date Filter for attempts
    const dateMatch = {};
    if (startDate) dateMatch.$gte = new Date(startDate);
    if (endDate) dateMatch.$lte = new Date(endDate);

    const attemptMatch = {};
    if (Object.keys(dateMatch).length > 0) {
      attemptMatch.createdAt = dateMatch;
    }

    const mockAttempts = await CompanyMockAttempt.find(attemptMatch).select("userId status scores createdAt").lean();
    for (const att of mockAttempts) {
      const uid = String(att.userId);
      const dept = studentToDept.get(uid);
      if (dept && deptMap.has(dept)) {
        const entry = deptMap.get(dept);
        entry.attemptingStudentIds.add(uid);
        entry.totalAttempts++;

        if (att.status === "completed") {
          entry.completedStudentIds.add(uid);
          entry.completedAttempts++;
          const p = att.scores?.percentage;
          if (typeof p === "number" && !isNaN(p)) {
            entry.scores.push(p);
            if (p > entry.highestScore) entry.highestScore = p;
            if (p < entry.lowestScore) entry.lowestScore = p;
          }
        }
      }
    }

    const result = Array.from(deptMap.values()).map((entry) => {
      const avgScore = entry.scores.length > 0
        ? Math.round((entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length) * 10) / 10
        : 0;
      const passCount = entry.scores.filter((s) => s >= 60).length;
      const passRate = entry.scores.length > 0 ? Math.round((passCount / entry.scores.length) * 100) : 0;

      return {
        department: entry.department,
        totalStudents: entry.totalStudents,
        studentsAttempted: entry.attemptingStudentIds.size,
        studentsCompleted: entry.completedStudentIds.size,
        totalAttempts: entry.totalAttempts,
        completedAttempts: entry.completedAttempts,
        averageScore: avgScore,
        averagePercentage: avgScore,
        highestScore: entry.scores.length > 0 ? Math.round(entry.highestScore) : 0,
        lowestScore: entry.scores.length > 0 ? Math.round(entry.lowestScore) : 0,
        passRate,
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("[ADMIN ANALYTICS] getDepartmentAnalytics error:", error);
    res.status(500).json({ message: "Failed to load department analytics" });
  }
};

/**
 * 3. Student Performance Analytics (Real Database Records with Search & Filter)
 */
export const getStudentPerformanceAnalytics = async (req, res) => {
  try {
    const { search, department, year, section, page = 1, limit = 15 } = req.query;

    const userMatch = { role: { $ne: "admin" } };
    if (department) userMatch.department = normalizeDepartment(department);
    if (year) userMatch.year = String(year).trim();
    if (section) userMatch.section = String(section).trim();
    if (search) {
      userMatch.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const totalStudents = await User.countDocuments(userMatch);
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const students = await User.find(userMatch)
      .select("_id name email department year section createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const studentIds = students.map((s) => s._id);

    const mockAttempts = await CompanyMockAttempt.find({ userId: { $in: studentIds } })
      .select("userId status scores companyName submittedAt createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const studentPerfMap = new Map();
    for (const s of students) {
      studentPerfMap.set(String(s._id), {
        studentId: s._id,
        name: s.name,
        email: s.email,
        department: s.department || "N/A",
        year: s.year || "N/A",
        section: s.section || "N/A",
        totalAttempts: 0,
        completedAttempts: 0,
        scores: [],
        bestScore: 0,
        latestAssessment: null,
      });
    }

    for (const att of mockAttempts) {
      const uid = String(att.userId);
      if (studentPerfMap.has(uid)) {
        const perf = studentPerfMap.get(uid);
        perf.totalAttempts++;

        if (!perf.latestAssessment) {
          perf.latestAssessment = {
            title: `${att.companyName || "Company"} Mock`,
            date: att.submittedAt || att.createdAt,
            status: att.status,
          };
        }

        if (att.status === "completed") {
          perf.completedAttempts++;
          const p = att.scores?.percentage;
          if (typeof p === "number" && !isNaN(p)) {
            perf.scores.push(p);
            if (p > perf.bestScore) perf.bestScore = p;
          }
        }
      }
    }

    const data = Array.from(studentPerfMap.values()).map((p) => {
      const avg = p.scores.length > 0
        ? Math.round((p.scores.reduce((a, b) => a + b, 0) / p.scores.length) * 10) / 10
        : 0;
      return {
        studentId: p.studentId,
        name: p.name,
        email: p.email,
        department: p.department,
        year: p.year,
        section: p.section,
        totalAttempts: p.totalAttempts,
        completedAttempts: p.completedAttempts,
        averageScore: avg,
        averagePercentage: avg,
        bestScore: Math.round(p.bestScore),
        latestAssessment: p.latestAssessment,
      };
    });

    res.json({
      success: true,
      data,
      pagination: {
        total: totalStudents,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalStudents / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("[ADMIN ANALYTICS] getStudentPerformanceAnalytics error:", error);
    res.status(500).json({ message: "Failed to load student performance analytics" });
  }
};

/**
 * 4. Real Interview Analytics (READ-ONLY)
 */
export const getRealInterviewAnalytics = async (req, res) => {
  try {
    const interviews = await Interview.find({ interviewType: { $in: ["actual", "real"] } }).lean();
    const results = await Result.find().lean();

    const totalSessions = interviews.length;
    const completedInterviews = interviews.filter((i) => i.status === "completed").length;
    const incompleteInterviews = totalSessions - completedInterviews;
    const completionRate = totalSessions > 0 ? Math.round((completedInterviews / totalSessions) * 100) : 0;

    let overallScoreSum = 0;
    let evalScoreSum = 0;
    let scoreCount = 0;

    for (const r of results) {
      const s = r.overallScore || r.overall?.obtainedMarks;
      if (typeof s === "number" && !isNaN(s)) {
        overallScoreSum += s;
        scoreCount++;
      }
    }

    const averageInterviewScore = scoreCount > 0 ? Math.round((overallScoreSum / scoreCount) * 10) / 10 : 0;

    // Performance by Department for Real Interview
    const userIds = interviews.map((i) => i.userId);
    const users = await User.find({ _id: { $in: userIds } }).select("_id department").lean();
    const userDeptMap = new Map(users.map((u) => [String(u._id), u.department]));

    const deptScoreMap = new Map();
    for (const r of results) {
      const interview = interviews.find((i) => String(i._id) === String(r.interviewId));
      if (interview) {
        const dept = userDeptMap.get(String(interview.userId)) || "Other";
        if (!deptScoreMap.has(dept)) {
          deptScoreMap.set(dept, { department: dept, total: 0, sum: 0 });
        }
        const entry = deptScoreMap.get(dept);
        entry.total++;
        entry.sum += r.overallScore || 0;
      }
    }

    const performanceByDepartment = Array.from(deptScoreMap.values()).map((d) => ({
      department: d.department,
      avgScore: d.total > 0 ? Math.round((d.sum / d.total) * 10) / 10 : 0,
      totalInterviews: d.total,
    }));

    res.json({
      success: true,
      data: {
        totalSessions,
        completedInterviews,
        incompleteInterviews,
        completionRate,
        averageInterviewScore,
        averageEvaluationScore: averageInterviewScore,
        performanceByDepartment,
      },
    });
  } catch (error) {
    console.error("[ADMIN ANALYTICS] getRealInterviewAnalytics error:", error);
    res.status(500).json({ message: "Failed to load real interview analytics" });
  }
};

/**
 * 5. Company Mock Analytics & Comparison Table (All 9 Companies)
 */
export const getCompanyMockAnalytics = async (req, res) => {
  try {
    const supportedCompanies = [
      { id: "celebal", name: "Celebal" },
      { id: "tcs", name: "TCS" },
      { id: "wipro", name: "Wipro" },
      { id: "accenture", name: "Accenture" },
      { id: "benchmark", name: "Benchmark IT Solutions" },
      { id: "capgemini", name: "Capgemini" },
      { id: "cognizant", name: "Cognizant" },
      { id: "deloitte", name: "Deloitte" },
      { id: "infosys", name: "Infosys" },
    ];

    const attempts = await CompanyMockAttempt.find().select("companyId companyName status scores userId").lean();

    const companyStatsMap = new Map();
    for (const c of supportedCompanies) {
      companyStatsMap.set(c.id, {
        companyId: c.id,
        companyName: c.name,
        totalAttempts: 0,
        completedAttempts: 0,
        scores: [],
        highestScore: 0,
        lowestScore: 100,
        attemptingUserIds: new Set(),
      });
    }

    for (const att of attempts) {
      const cid = String(att.companyId || "").toLowerCase();
      let stat = companyStatsMap.get(cid);
      if (!stat) {
        // Fallback matching by name
        const match = supportedCompanies.find((sc) => sc.name.toLowerCase() === (att.companyName || "").toLowerCase());
        if (match) stat = companyStatsMap.get(match.id);
      }

      if (stat) {
        stat.totalAttempts++;
        stat.attemptingUserIds.add(String(att.userId));

        if (att.status === "completed") {
          stat.completedAttempts++;
          const p = att.scores?.percentage;
          if (typeof p === "number" && !isNaN(p)) {
            stat.scores.push(p);
            if (p > stat.highestScore) stat.highestScore = p;
            if (p < stat.lowestScore) stat.lowestScore = p;
          }
        }
      }
    }

    const companyComparison = Array.from(companyStatsMap.values()).map((s) => {
      const avg = s.scores.length > 0
        ? Math.round((s.scores.reduce((a, b) => a + b, 0) / s.scores.length) * 10) / 10
        : 0;
      const completionRate = s.totalAttempts > 0
        ? Math.round((s.completedAttempts / s.totalAttempts) * 100)
        : 0;

      return {
        companyId: s.companyId,
        companyName: s.companyName,
        studentsCount: s.attemptingUserIds.size,
        totalAttempts: s.totalAttempts,
        completedAttempts: s.completedAttempts,
        averagePercentage: avg,
        highestPercentage: s.scores.length > 0 ? Math.round(s.highestScore) : 0,
        lowestPercentage: s.scores.length > 0 ? Math.round(s.lowestScore) : 0,
        completionRate,
      };
    });

    res.json({
      success: true,
      data: {
        companies: companyComparison,
      },
    });
  } catch (error) {
    console.error("[ADMIN ANALYTICS] getCompanyMockAnalytics error:", error);
    res.status(500).json({ message: "Failed to load company mock analytics" });
  }
};

/**
 * 6. Mock Section Analytics (Aptitude, Technical, Coding)
 */
export const getMockSectionAnalytics = async (req, res) => {
  try {
    const attempts = await CompanyMockAttempt.find({ status: "completed" }).select("scores").lean();

    let aptScores = [], techScores = [], codingScores = [];

    for (const a of attempts) {
      if (a.scores) {
        if (typeof a.scores.aptitude === "number") aptScores.push(a.scores.aptitude);
        if (typeof a.scores.technical === "number") techScores.push(a.scores.technical);
        if (typeof a.scores.coding === "number") codingScores.push(a.scores.coding);
      }
    }

    const calcAvg = (arr) => arr.length > 0 ? Math.round((arr.reduce((x, y) => x + y, 0) / arr.length) * 10) / 10 : 0;

    const sections = [
      { name: "Aptitude", attempts: aptScores.length, averageScore: calcAvg(aptScores) },
      { name: "Technical", attempts: techScores.length, averageScore: calcAvg(techScores) },
      { name: "Coding", attempts: codingScores.length, averageScore: calcAvg(codingScores) },
    ];

    res.json({ success: true, data: sections });
  } catch (error) {
    console.error("[ADMIN ANALYTICS] getMockSectionAnalytics error:", error);
    res.status(500).json({ message: "Failed to load mock section analytics" });
  }
};

/**
 * 7. Performance Distribution (0-20%, 21-40%, 41-60%, 61-80%, 81-100%)
 */
export const getPerformanceDistribution = async (req, res) => {
  try {
    const attempts = await CompanyMockAttempt.find({ status: "completed" }).select("scores").lean();

    const buckets = {
      "0–20%": 0,
      "21–40%": 0,
      "41–60%": 0,
      "61–80%": 0,
      "81–100%": 0,
    };

    for (const a of attempts) {
      const p = a.scores?.percentage;
      if (typeof p === "number" && !isNaN(p)) {
        if (p <= 20) buckets["0–20%"]++;
        else if (p <= 40) buckets["21–40%"]++;
        else if (p <= 60) buckets["41–60%"]++;
        else if (p <= 80) buckets["61–80%"]++;
        else buckets["81–100%"]++;
      }
    }

    const distribution = Object.keys(buckets).map((range) => ({
      range,
      count: buckets[range],
    }));

    res.json({ success: true, data: distribution });
  } catch (error) {
    console.error("[ADMIN ANALYTICS] getPerformanceDistribution error:", error);
    res.status(500).json({ message: "Failed to load performance distribution" });
  }
};

/**
 * 8. Time-Based Analytics (Daily/Weekly Attempts over Time)
 */
export const getTimeBasedAnalytics = async (req, res) => {
  try {
    const attempts = await CompanyMockAttempt.find()
      .select("createdAt status")
      .sort({ createdAt: 1 })
      .lean();

    const timeMap = new Map();
    for (const a of attempts) {
      if (a.createdAt) {
        const dateStr = new Date(a.createdAt).toISOString().split("T")[0];
        if (!timeMap.has(dateStr)) {
          timeMap.set(dateStr, { date: dateStr, total: 0, completed: 0 });
        }
        const entry = timeMap.get(dateStr);
        entry.total++;
        if (a.status === "completed") entry.completed++;
      }
    }

    const trend = Array.from(timeMap.values());
    res.json({ success: true, data: trend });
  } catch (error) {
    console.error("[ADMIN ANALYTICS] getTimeBasedAnalytics error:", error);
    res.status(500).json({ message: "Failed to load time-based analytics" });
  }
};
