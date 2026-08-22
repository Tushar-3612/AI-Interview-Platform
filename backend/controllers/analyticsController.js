import mongoose from "mongoose";
import path from "path";
import XLSX from "xlsx";
import User from "../models/User.js";
import CodingSubmission from "../models/CodingSubmission.js";
import PracticeAttempt from "../models/PracticeAttempt.js";
import MockOAAttempt from "../models/MockOAAttempt.js";
import Interview from "../models/Interview.js";
import CodingQuestion from "../models/CodingQuestion.js";
import { generatePlacementPDF } from "../utils/pdfGeneratorPlacement.js";

const isSolvedCoding = (s) =>
  s.status === "accepted" ||
  (s.totalCount > 0 && s.passedCount === s.totalCount);

const isCompletedInterview = (i) =>
  (i.status && /complet/i.test(i.status)) || Boolean(i.completedAt);

const companyKey = (companyId, companyName) => {
  const id = (companyId || "").toString().trim();
  const name = (companyName || "").toString().trim();
  if (id && id !== "undefined" && id !== "null") return id;
  if (name) return name;
  return "";
};

export const computePlacementAnalytics = async (filters) => {
  const { studentId, department, year, section, company, from, to } = filters;

    // Resolve user scope
    let userIds = null;
    const userMatch = {};
    if (studentId) userMatch._id = studentId;
    if (department) userMatch.department = department;
    if (year) userMatch.year = year;
    if (section) userMatch.section = section;

    if (Object.keys(userMatch).length) {
      const users = await User.find(userMatch).select("_id").lean();
      userIds = users.map((u) => u._id);
    }

    const dateFilter = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) dateFilter.createdAt.$gte = new Date(from);
      if (to) dateFilter.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
    }

    const recordMatch = {};
    if (userIds) recordMatch.userId = { $in: userIds };
    if (company) {
      const companyName = company;
      recordMatch.$or = [
        { companyId: company },
        { companyName: companyName },
      ];
    }

    const attachDate = (match) => {
      if (Object.keys(dateFilter).length) match.createdAt = dateFilter.createdAt;
      return match;
    };

    // ---- Fetch raw records (only placement-prep data; no assigned tests) ----
    const codingDocs = await CodingSubmission.find(
      attachDate({ ...recordMatch, interviewId: { $in: [null, ""] } })
    ).lean();

    const aptDocs = await PracticeAttempt.find(attachDate({ ...recordMatch })).lean();
    const moaDocs = await MockOAAttempt.find(attachDate({ ...recordMatch })).lean();
    const intDocs = await Interview.find(attachDate({ ...recordMatch })).lean();

    // ---- User map for names ----
    const allUserIds = new Set();
    [codingDocs, aptDocs, moaDocs, intDocs].forEach((docs) =>
      docs.forEach((d) => {
        if (d.userId) allUserIds.add(String(d.userId));
      })
    );
    let userMap = {};
    if (allUserIds.size) {
      const u = await User.find({ _id: { $in: [...allUserIds] } })
        .select("name department year")
        .lean();
      u.forEach((x) => (userMap[String(x._id)] = x));
    }

    // ---- Coding difficulty / topic enrichment ----
    const qIds = [
      ...new Set(
        codingDocs
          .map((s) => s.questionId)
          .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
      ),
    ];
    let qMap = {};
    if (qIds.length) {
      const qs = await CodingQuestion.find({ _id: { $in: qIds } })
        .select("difficulty category")
        .lean();
      qs.forEach((q) => (qMap[String(q._id)] = q));
    }

    // ---- Coding aggregates ----
    const byLanguage = {};
    const byDifficulty = { Easy: 0, Medium: 0, Hard: 0 };
    const byTopic = {};

    codingDocs.forEach((s) => {
      const lang = s.language || "Unknown";
      byLanguage[lang] = byLanguage[lang] || { attempted: 0, solved: 0 };
      byLanguage[lang].attempted += 1;
      if (isSolvedCoding(s)) byLanguage[lang].solved += 1;

      const q = qMap[String(s.questionId)];
      if (q) {
        if (byDifficulty[q.difficulty] !== undefined) byDifficulty[q.difficulty] += 1;
        const topic = q.category || "Uncategorized";
        byTopic[topic] = byTopic[topic] || { attempted: 0, solved: 0 };
        byTopic[topic].attempted += 1;
        if (isSolvedCoding(s)) byTopic[topic].solved += 1;
      }
    });

    let codingAttempted = codingDocs.length;
    let codingSolved = codingDocs.filter(isSolvedCoding).length;
    // Fold Mock OA coding into totals
    moaDocs.forEach((m) => {
      codingAttempted += m.coding?.attempted || 0;
      codingSolved += m.coding?.accepted || 0;
    });
    const codingFailed = codingAttempted - codingSolved;
    const codingAccuracy = codingAttempted
      ? Math.round((codingSolved / codingAttempted) * 1000) / 10
      : 0;

    // ---- Aptitude aggregates ----
    let aptSessions = aptDocs.length;
    let aptAttempted = 0;
    let aptCorrect = 0;
    let aptWrong = 0;
    let aptSkipped = 0;
    const aptByTopic = {};
    const aptByDifficulty = { easy: 0, medium: 0, hard: 0, mixed: 0 };

    aptDocs.forEach((a) => {
      const qCount = a.questions?.length || 0;
      aptAttempted += qCount;
      aptCorrect += a.correct || 0;
      aptWrong += a.wrong || 0;
      aptSkipped += a.skipped || 0;

      const diff = (a.difficulty || "").toLowerCase();
      if (aptByDifficulty[diff] !== undefined) aptByDifficulty[diff] += 1;

      (a.questions || []).forEach((q) => {
        const topic = q.category || q.topic || "Uncategorized";
        aptByTopic[topic] = aptByTopic[topic] || { attempted: 0, correct: 0 };
        aptByTopic[topic].attempted += 1;
        if (q.isCorrect) aptByTopic[topic].correct += 1;
      });
    });

    moaDocs.forEach((m) => {
      aptSessions += 1;
      aptAttempted += m.aptitude?.total || 0;
      aptCorrect += m.aptitude?.correct || 0;
      aptWrong += m.aptitude?.wrong || 0;
      aptSkipped += m.aptitude?.skipped || 0;
    });

    const aptAccuracy = aptAttempted
      ? Math.round((aptCorrect / aptAttempted) * 1000) / 10
      : 0;

    // ---- Mock interview aggregates ----
    const mockAttempted = intDocs.length;
    const mockCompleted = intDocs.filter(isCompletedInterview).length;
    const scored = intDocs
      .map((i) => (typeof i.overallScore === "number" ? i.overallScore : null))
      .filter((v) => v !== null);
    const mockAvgOverall = scored.length
      ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10
      : null;

    const pickAvg = (field) => {
      const vals = intDocs
        .map((i) => (typeof i[field] === "number" ? i[field] : null))
        .filter((v) => v !== null);
      return vals.length
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
        : null;
    };
    const mockScores = {
      technical: pickAvg("technicalScore"),
      hr: pickAvg("hrScore"),
      communication: pickAvg("communicationScore"),
      confidence: pickAvg("confidenceScore"),
    };
    const mockByType = {};
    intDocs.forEach((i) => {
      const t = i.interviewType || "mock";
      mockByType[t] = (mockByType[t] || 0) + 1;
    });

    // ---- Companies aggregation ----
    const companiesMap = {};
    const addCompany = (key) => {
      if (!key) return null;
      if (!companiesMap[key]) {
        companiesMap[key] = {
          id: key,
          name: key,
          codingAttempted: 0,
          codingSolved: 0,
          aptitudeAttempted: 0,
          aptitudeCorrect: 0,
          mockAttempted: 0,
          mockCompleted: 0,
        };
      }
      return companiesMap[key];
    };

    codingDocs.forEach((s) => {
      const key = companyKey(s.companyId, s.companyName);
      const c = addCompany(key);
      if (c) {
        c.name = s.companyName || s.companyId || key;
        c.codingAttempted += 1;
        if (isSolvedCoding(s)) c.codingSolved += 1;
      }
    });
    aptDocs.forEach((a) => {
      const key = companyKey(a.companyId, a.companyName);
      const c = addCompany(key);
      if (c) {
        c.name = a.companyName || a.companyId || key;
        c.aptitudeAttempted += a.questions?.length || 0;
        c.aptitudeCorrect += a.correct || 0;
      }
    });
    moaDocs.forEach((m) => {
      const key = companyKey(m.companyId, m.companyName);
      const c = addCompany(key);
      if (c) {
        c.name = m.companyName || m.companyId || key;
        c.aptitudeAttempted += m.aptitude?.total || 0;
        c.aptitudeCorrect += m.aptitude?.correct || 0;
        c.codingAttempted += m.coding?.attempted || 0;
        c.codingSolved += m.coding?.accepted || 0;
      }
    });
    intDocs.forEach((i) => {
      const key = companyKey(i.companyId, null);
      const c = addCompany(key);
      if (c) {
        c.mockAttempted += 1;
        if (isCompletedInterview(i)) c.mockCompleted += 1;
      }
    });

    const companies = Object.values(companiesMap)
      .map((c) => ({
        ...c,
        activity:
          c.codingAttempted + c.aptitudeAttempted + c.mockAttempted,
      }))
      .sort((a, b) => b.activity - a.activity);

    // ---- Recent activity ----
    const activity = [];
    const pushActivity = (type, date, userId, detail) => {
      if (!date) return;
      activity.push({
        type,
        date,
        userId: String(userId),
        student: userMap[String(userId)]?.name || "Unknown",
        detail,
      });
    };
    codingDocs.slice(0, 6).forEach((s) =>
      pushActivity(
        "Coding Submission",
        s.createdAt,
        s.userId,
        `${s.title || "Coding"} · ${s.language || ""}`
      )
    );
    aptDocs.slice(0, 6).forEach((a) =>
      pushActivity(
        "Aptitude Practice",
        a.createdAt,
        a.userId,
        `${a.companyName || "Practice"} · ${a.percentage || 0}%`
      )
    );
    moaDocs.slice(0, 6).forEach((m) =>
      pushActivity(
        "Mock OA",
        m.createdAt,
        m.userId,
        `${m.companyName || ""} · overall ${m.overallScore || 0}`
      )
    );
    intDocs.slice(0, 6).forEach((i) =>
      pushActivity(
        "Mock Interview",
        i.createdAt,
        i.userId,
        `${i.interviewType || "mock"} · ${i.overallScore != null ? i.overallScore : "—"}`
      )
    );
    activity.sort((a, b) => new Date(b.date) - new Date(a.date));
    const recentActivity = activity.slice(0, 15);

    // ---- Mock interview history (completed only) ----
    const mockHistory = intDocs
      .filter(isCompletedInterview)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20)
      .map((i) => ({
        date: i.createdAt,
        type: i.interviewType || "mock",
        company: i.companyId || "General",
        overallScore: i.overallScore,
        student: userMap[String(i.userId)]?.name || "Unknown",
        targetRound: i.targetRound || "all",
      }));

    // ---- Total students ----
    let totalStudents;
    if (studentId) totalStudents = 1;
    else if (department || year || section)
      totalStudents = await User.countDocuments(userMatch);
    else totalStudents = await User.countDocuments({});

    // ---- Filter options ----
    const [departments, years, sections] = await Promise.all([
      User.distinct("department"),
      User.distinct("year"),
      User.distinct("section"),
    ]);

    const overview = {
      totalStudents,
      codingSolved,
      codingAttempted,
      aptitudeAttempted: aptAttempted,
      aptitudeCorrect: aptCorrect,
      mockCompleted,
      mockAttempted,
    };

    res.json({
      overview,
      coding: {
        attempted: codingAttempted,
        solved: codingSolved,
        failed: codingFailed,
        accuracy: codingAccuracy,
        byLanguage: Object.entries(byLanguage)
          .map(([language, v]) => ({
            language,
            attempted: v.attempted,
            solved: v.solved,
            accuracy: v.attempted
              ? Math.round((v.solved / v.attempted) * 1000) / 10
              : 0,
          }))
          .sort((a, b) => b.attempted - a.attempted),
        byDifficulty,
        byTopic: Object.entries(byTopic)
          .map(([topic, v]) => ({
            topic,
            attempted: v.attempted,
            solved: v.solved,
            accuracy: v.attempted
              ? Math.round((v.solved / v.attempted) * 1000) / 10
              : 0,
          }))
          .sort((a, b) => b.attempted - a.attempted),
      },
      aptitude: {
        sessions: aptSessions,
        attempted: aptAttempted,
        correct: aptCorrect,
        wrong: aptWrong,
        skipped: aptSkipped,
        accuracy: aptAccuracy,
        byTopic: Object.entries(aptByTopic)
          .map(([topic, v]) => ({
            topic,
            attempted: v.attempted,
            correct: v.correct,
            accuracy: v.attempted
              ? Math.round((v.correct / v.attempted) * 1000) / 10
              : 0,
          }))
          .sort((a, b) => b.attempted - a.attempted),
        byDifficulty: Object.entries(aptByDifficulty)
          .map(([difficulty, count]) => ({ difficulty, count }))
          .filter((d) => d.count > 0),
      },
      mock: {
        attempted: mockAttempted,
        completed: mockCompleted,
        avgOverall: mockAvgOverall,
        scores: mockScores,
        byType: Object.entries(mockByType).map(([type, count]) => ({
          type,
          count,
        })),
        history: mockHistory,
      },
      companies,
      recentActivity,
      filterOptions: {
        departments: departments.filter(Boolean).sort(),
        years: years.filter(Boolean).sort(),
        sections: sections.filter(Boolean).sort(),
        companies: companies.map((c) => ({ id: c.id, name: c.name })),
      },
    });
};

export const getPlacementAnalytics = async (req, res) => {
  try {
    const data = await computePlacementAnalytics(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Failed to generate placement analytics" });
  }
};

export const downloadPlacementPDF = async (req, res) => {
  try {
    const data = await computePlacementAnalytics(req.query);
    const { studentId, company, department, year, section, from, to } = req.query;

    let student = null;
    let reportType = "overview";
    let scopeLabel = "All Students";

    if (studentId) {
      const u = await User.findById(studentId).lean();
      if (u) {
        student = {
          name: u.name,
          department: u.department,
          year: u.year,
          section: u.section || "N/A",
          atsScore: u.atsScore != null ? u.atsScore : "N/A",
        };
      }
      reportType = "student";
      scopeLabel = student ? `Student: ${student.name}` : "Student";
    } else if (company) {
      reportType = "company";
      const c = data.companies.find((x) => x.id === company);
      scopeLabel = `Company: ${c ? c.name : company}`;
    } else {
      const parts = [];
      if (department) parts.push(department);
      if (year) parts.push(year);
      if (section) parts.push(section);
      if (from || to) parts.push(`${from || "…"} → ${to || "…"}`);
      if (parts.length) scopeLabel = parts.join(" · ");
    }

    const fileName = `placement_report_${reportType}_${Date.now()}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    generatePlacementPDF(res, { data, student, reportType, scopeLabel });
  } catch (error) {
    console.error("Placement PDF Error:", error.message);
    if (!res.headersSent) res.status(500).json({ message: "Failed to generate PDF" });
  }
};

export const exportPlacementExcel = async (req, res) => {
  try {
    const { studentId, department, year, section, company, from, to } = req.query;

    let studentList = [];
    if (studentId) {
      studentList = [{ _id: studentId }];
    } else {
      const userMatch = {};
      if (department) userMatch.department = department;
      if (year) userMatch.year = year;
      if (section) userMatch.section = section;
      studentList = await User.find(userMatch).select("_id name department year section atsScore").lean();
    }

    const rows = [];
    for (const stu of studentList) {
      const d = await computePlacementAnalytics({
        studentId: String(stu._id),
        company,
        from,
        to,
      });
      rows.push({
        "Student Name": stu.name || "Unknown",
        Department: stu.department || "",
        "Academic Year": stu.year || "",
        Section: stu.section || "",
        "Coding Problems Solved": d.overview.codingSolved,
        "Coding Problems Attempted": d.overview.codingAttempted,
        "Aptitude Questions Attempted": d.overview.aptitudeAttempted,
        "Aptitude Correct": d.overview.aptitudeCorrect,
        "Mock Interviews Completed": d.overview.mockCompleted,
        "Mock Interviews Attempted": d.overview.mockAttempted,
        "Companies Practiced": d.companies.length,
        "ATS Score": stu.atsScore != null ? stu.atsScore : "",
      });
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 22 }, { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 14 },
      { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Student Performance");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const fileName = `student_performance_${Date.now()}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(buf);
  } catch (error) {
    console.error("Placement Excel Error:", error.message);
    if (!res.headersSent) res.status(500).json({ message: "Failed to export Excel" });
  }
};

