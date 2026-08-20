import User from "../models/User.js";
import TestResult from "../models/TestResult.js";
import AIEvaluation from "../models/AIEvaluation.js";
import Test from "../models/Test.js";
import Interview from "../models/Interview.js";
import Result from "../models/Result.js";
import Answer from "../models/Answer.js";
import TestAssignment from "../models/TestAssignment.js";
import { yearQuery } from "../utils/academicConfig.js";

export async function getStudentReport(studentId) {
  const user = await User.findById(studentId).select("-password").lean();
  if (!user) throw new Error("Student not found");

  const testResults = await TestResult.find({ userId: studentId })
    .populate("testId", "title testType difficulty duration companyId")
    .sort({ createdAt: -1 })
    .lean();

  const aiEvaluation = await AIEvaluation.findOne({ userId: studentId })
    .sort({ createdAt: -1 })
    .lean();

  const interviews = await Interview.find({ userId: studentId })
    .populate("companyId", "name")
    .sort({ createdAt: -1 })
    .lean();

  const interviewResults = await Result.find({ userId: studentId })
    .populate({
      path: "interviewId",
      populate: { path: "companyId", select: "name" },
    })
    .sort({ createdAt: -1 })
    .lean();

  const practiceInterviews = interviews.filter(i =>
    i.interviewType === "practice" || i.interviewType === "real"
  );
  const realInterviews = interviews.filter(i => i.interviewType === "real");

  const practiceSummary = buildPracticeSummary(practiceInterviews, interviewResults);
  const realInterviewSummary = buildRealInterviewSummary(realInterviews, interviewResults);

  return {
    profile: sanitizeProfile(user),
    testResults: testResults.map(r => buildTestResultSummary(r)),
    aiEvaluation: aiEvaluation ? buildAIEvaluationSummary(aiEvaluation) : null,
    practiceSummary,
    realInterviewSummary,
    generatedAt: new Date(),
  };
}

function sanitizeProfile(user) {
  return {
    _id: user._id,
    name: user.name || "",
    email: user.email || "",
    phone: user.phone || "",
    department: user.department || "",
    year: user.year || "",
    github: user.github || "",
    linkedin: user.linkedin || "",
    portfolio: user.portfolio || "",
    skills: user.skills || [],
    resumeFileName: user.resumeFileName || "",
    atsScore: user.atsScore || 0,
    createdAt: user.createdAt,
  };
}

function buildTestResultSummary(testResult) {
  const test = testResult.testId || {};
  return {
    testTitle: test.title || "Unknown Test",
    testType: test.testType || "unknown",
    difficulty: test.difficulty || "N/A",
    companyId: test.companyId || "",
    submittedAt: testResult.submittedAt || testResult.createdAt,
    percentage: testResult.percentage,
    grade: testResult.grade,
    passed: testResult.passed,
    obtainedMarks: testResult.obtainedMarks,
    totalMarks: testResult.totalMarks,
    totalQuestions: testResult.totalQuestions,
    attempted: testResult.attempted,
    correct: testResult.correct,
    wrong: testResult.wrong,
    skipped: testResult.skipped,
    sections: (testResult.sections || []).map(s => ({
      section: s.section,
      totalQuestions: s.totalQuestions,
      attempted: s.attempted,
      correct: s.correct,
      wrong: s.wrong,
      skipped: s.skipped,
      obtainedMarks: s.obtainedMarks,
      totalMarks: s.totalMarks,
      percentage: s.percentage,
    })),
    ranking: testResult.ranking || null,
  };
}

function buildAIEvaluationSummary(evalDoc) {
  return {
    status: evalDoc.status,
    aptitude: evalDoc.aptitudeEvaluation?.status === "completed"
      ? {
          accuracy: evalDoc.aptitudeEvaluation.accuracy,
          speed: evalDoc.aptitudeEvaluation.speed,
          logicalThinking: evalDoc.aptitudeEvaluation.logicalThinking,
          strengths: evalDoc.aptitudeEvaluation.strengths,
          weaknesses: evalDoc.aptitudeEvaluation.weaknesses,
          suggestions: evalDoc.aptitudeEvaluation.suggestions,
        }
      : null,
    technical: evalDoc.technicalEvaluation?.status === "completed"
      ? {
          strongTopics: evalDoc.technicalEvaluation.strongTopics,
          weakTopics: evalDoc.technicalEvaluation.weakTopics,
          learningSuggestions: evalDoc.technicalEvaluation.learningSuggestions,
        }
      : null,
    coding: evalDoc.codingEvaluation?.status === "completed"
      ? {
          overallFeedback: evalDoc.codingEvaluation.overallFeedback,
          optimizationSuggestions: evalDoc.codingEvaluation.optimizationSuggestions,
        }
      : null,
    resumeMatch: evalDoc.resumeMatch?.status === "completed"
      ? {
          skillGap: evalDoc.resumeMatch.skillGap,
          missingSkills: evalDoc.resumeMatch.missingSkills,
          resumeAccuracy: evalDoc.resumeMatch.resumeAccuracy,
          suggestions: evalDoc.resumeMatch.suggestions,
        }
      : null,
    companyMatch: evalDoc.companyMatch?.status === "completed"
      ? {
          recommendations: (evalDoc.companyMatch.recommendations || [])
            .sort((a, b) => b.matchPercentage - a.matchPercentage),
        }
      : null,
    interviewReadiness: evalDoc.interviewReadiness?.status === "completed"
      ? {
          technicalReadiness: evalDoc.interviewReadiness.technicalReadiness,
          codingReadiness: evalDoc.interviewReadiness.codingReadiness,
          communicationReadiness: evalDoc.interviewReadiness.communicationReadiness,
          overallPlacementReadiness: evalDoc.interviewReadiness.overallPlacementReadiness,
        }
      : null,
    feedback: evalDoc.aiFeedback?.status === "completed"
      ? {
          positivePoints: evalDoc.aiFeedback.positivePoints,
          weakAreas: evalDoc.aiFeedback.weakAreas,
          recommendedSubjects: evalDoc.aiFeedback.recommendedSubjects,
          practiceStrategy: evalDoc.aiFeedback.practiceStrategy,
          nextLearningPath: evalDoc.aiFeedback.nextLearningPath,
        }
      : null,
  };
}

function buildPracticeSummary(interviews, results) {
  const companyMap = {};
  for (const iv of interviews) {
    const companyName = iv.companyId?.name || "Unknown";
    if (!companyMap[companyName]) {
      companyMap[companyName] = { attempts: 0, scores: [], dates: [] };
    }
    companyMap[companyName].attempts++;
    if (iv.overallScore != null) companyMap[companyName].scores.push(iv.overallScore);
    if (iv.completedAt) companyMap[companyName].dates.push(iv.completedAt);
  }
  for (const r of results) {
    const companyName = r.interviewId?.companyId?.name || "Unknown";
    if (!companyMap[companyName]) {
      companyMap[companyName] = { attempts: 0, scores: [], dates: [] };
    }
    companyMap[companyName].attempts++;
    if (r.overallScore != null) companyMap[companyName].scores.push(r.overallScore);
  }
  return Object.entries(companyMap).map(([company, data]) => ({
    company,
    attempts: data.attempts,
    highestScore: data.scores.length ? Math.max(...data.scores) : null,
    averageScore: data.scores.length
      ? Math.round(data.scores.reduce((s, v) => s + v, 0) / data.scores.length)
      : null,
    latestScore: data.scores.length ? data.scores[data.scores.length - 1] : null,
    lastAttemptDate: data.dates.length
      ? new Date(Math.max(...data.dates.map(d => new Date(d)))).toISOString()
      : null,
  }));
}

function buildRealInterviewSummary(interviews, results) {
  const resultMap = {};
  for (const r of results) {
    const ivId = r.interviewId?._id?.toString() || r.interviewId?.toString() || "";
    resultMap[ivId] = r;
  }
  return interviews.map(iv => {
    const result = resultMap[iv._id.toString()];
    return {
      company: iv.companyId?.name || "Unknown",
      interviewDate: iv.completedAt || iv.createdAt,
      marks: result?.overallScore || iv.overallScore || null,
      status: iv.status || "unknown",
      resultId: result?._id || null,
    };
  });
}

export async function getBatchReport(department, year) {
  const filter = {};
  if (department) filter.department = department;
  if (year) filter.year = yearQuery(year);

  const students = await User.find(filter).select("-password").sort({ name: 1 }).lean();
  if (!students.length) throw new Error("No students found");

  const studentIds = students.map(s => s._id);
  const testResults = await TestResult.find({ userId: { $in: studentIds } })
    .populate("testId", "title testType")
    .lean();

  const studentMap = {};
  for (const s of students) {
    studentMap[s._id.toString()] = {
      ...sanitizeProfile(s),
      results: [],
    };
  }
  for (const tr of testResults) {
    const uid = tr.userId.toString();
    if (studentMap[uid]) {
      studentMap[uid].results.push(buildTestResultSummary(tr));
    }
  }

  const reportData = Object.values(studentMap);
  const percentages = reportData
    .flatMap(s => s.results.map(r => r.percentage))
    .filter(p => p != null);

  return {
    department: department || "All",
    year: year || "All",
    totalStudents: reportData.length,
    stats: {
      averageMarks: percentages.length
        ? Math.round(percentages.reduce((s, v) => s + v, 0) / percentages.length)
        : 0,
      highestMarks: percentages.length ? Math.max(...percentages) : 0,
      lowestMarks: percentages.length ? Math.min(...percentages) : 0,
      passPercentage: percentages.length
        ? Math.round((reportData.filter(s => s.results.some(r => r.passed)).length / reportData.length) * 100)
        : 0,
    },
    topStudents: reportData
      .map(s => ({
        name: s.name,
        email: s.email,
        department: s.department,
        year: s.year,
        bestPercentage: s.results.length ? Math.max(...s.results.map(r => r.percentage)) : 0,
        totalTests: s.results.length,
      }))
      .sort((a, b) => b.bestPercentage - a.bestPercentage)
      .slice(0, 10),
    students: reportData,
    generatedAt: new Date(),
  };
}

export async function getCompanyReport(companyId) {
  const tests = await Test.find({ companyId }).lean();
  const testIds = tests.map(t => t._id);
  const testTitles = tests.map(t => t.title);

  if (!testIds.length) {
    return { companyId, tests: 0, students: [] };
  }

  const assignments = await TestAssignment.find({ testId: { $in: testIds } }).lean();
  const allStudentIds = [...new Set(assignments.flatMap(a => a.studentIds.map(id => id.toString())))];

  const testResults = await TestResult.find({ testId: { $in: testIds } })
    .populate("userId", "name email department year")
    .sort({ percentage: -1 })
    .lean();

  const percentages = testResults.map(r => r.percentage).filter(p => p != null);
  const studentScores = {};
  for (const tr of testResults) {
    const uid = tr.userId?._id?.toString() || tr.userId?.toString() || "";
    if (!studentScores[uid]) {
      studentScores[uid] = { scores: [], user: tr.userId };
    }
    studentScores[uid].scores.push(tr.percentage || 0);
  }

  return {
    companyId,
    tests: testTitles,
    totalTests: testIds.length,
    totalStudentsAppeared: testResults.length,
    totalAssigned: allStudentIds.length,
    stats: {
      averageScore: percentages.length
        ? Math.round(percentages.reduce((s, v) => s + v, 0) / percentages.length)
        : 0,
      highestScore: percentages.length ? Math.max(...percentages) : 0,
      lowestScore: percentages.length ? Math.min(...percentages) : 0,
    },
    students: Object.entries(studentScores).map(([uid, data]) => {
      const avg = data.scores.length
        ? Math.round(data.scores.reduce((s, v) => s + v, 0) / data.scores.length)
        : 0;
      return {
        name: data.user?.name || "Unknown",
        email: data.user?.email || "",
        department: data.user?.department || "",
        year: data.user?.year || "",
        averagePercentage: avg,
        bestScore: Math.max(...data.scores),
        selectionReady: avg >= 60,
      };
    }).sort((a, b) => b.bestScore - a.bestScore),
    generatedAt: new Date(),
  };
}

export async function getPracticeReport() {
  const interviews = await Interview.find({ interviewType: { $in: ["practice", "real"] } })
    .populate("companyId", "name")
    .lean();

  const companyStats = {};
  for (const iv of interviews) {
    const company = iv.companyId?.name || "Unknown";
    if (!companyStats[company]) {
      companyStats[company] = { total: 0, scores: [] };
    }
    companyStats[company].total++;
    if (iv.overallScore != null) companyStats[company].scores.push(iv.overallScore);
  }

  const entries = Object.entries(companyStats).map(([company, data]) => ({
    company,
    totalAttempts: data.total,
    averageScore: data.scores.length
      ? Math.round(data.scores.reduce((s, v) => s + v, 0) / data.scores.length)
      : null,
    highestScore: data.scores.length ? Math.max(...data.scores) : null,
    lowestScore: data.scores.length ? Math.min(...data.scores) : null,
  }));

  const allScores = interviews.map(i => i.overallScore).filter(s => s != null);

  return {
    totalPracticeAttempts: interviews.length,
    mostPracticedCompany: entries.length
      ? entries.reduce((a, b) => (a.totalAttempts > b.totalAttempts ? a : b)).company
      : null,
    highestPracticeScore: allScores.length ? Math.max(...allScores) : null,
    lowestPracticeScore: allScores.length ? Math.min(...allScores) : null,
    companyWise: entries.sort((a, b) => b.totalAttempts - a.totalAttempts),
    generatedAt: new Date(),
  };
}

export async function searchReports({ query, department, year, company, dateFrom, dateTo, page = 1, limit = 20 }) {
  const match = {};
  if (query) {
    match.$or = [
      { name: { $regex: query, $options: "i" } },
      { email: { $regex: query, $options: "i" } },
    ];
  }
  if (department) match.department = department;
  if (year) match.year = yearQuery(year);

  const students = await User.find(match)
    .select("-password")
    .sort({ name: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await User.countDocuments(match);
  const studentIds = students.map(s => s._id);

  const testResults = await TestResult.find({ userId: { $in: studentIds } })
    .populate("testId", "title companyId")
    .lean();

  const resultMap = {};
  for (const tr of testResults) {
    const uid = tr.userId.toString();
    if (!resultMap[uid]) resultMap[uid] = [];
    const matchTest = company
      ? tr.testId?.companyId?.toString() === company
      : true;
    if (matchTest) {
      const dateOk = (!dateFrom || new Date(tr.createdAt) >= new Date(dateFrom)) &&
                     (!dateTo || new Date(tr.createdAt) <= new Date(dateTo));
      if (dateOk) resultMap[uid].push(tr);
    }
  }

  return {
    students: students.map(s => ({
      _id: s._id,
      name: s.name,
      email: s.email,
      department: s.department,
      year: s.year,
      atsScore: s.atsScore,
      tests: (resultMap[s._id.toString()] || []).length,
      bestPercentage: (resultMap[s._id.toString()] || []).length
        ? Math.max(...resultMap[s._id.toString()].map(r => r.percentage || 0))
        : null,
    })),
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}

export async function getReportExportData(filters = {}) {
  const match = {};
  if (filters.department) match.department = filters.department;
  if (filters.year) match.year = yearQuery(filters.year);

  const students = await User.find(match).select("-password").sort({ name: 1 }).lean();
  const studentIds = students.map(s => s._id);

  const testResults = await TestResult.find({ userId: { $in: studentIds } })
    .populate("testId", "title testType companyId")
    .lean();

  const resultMap = {};
  for (const tr of testResults) {
    const uid = tr.userId.toString();
    if (!resultMap[uid]) resultMap[uid] = [];
    resultMap[uid].push(tr);
  }

  return students.map(s => {
    const results = resultMap[s._id.toString()] || [];
    const sections = results.flatMap(r => r.sections || []);
    const techSection = sections.find(sec => sec.section?.toLowerCase().includes("techn") || sec.section?.toLowerCase().includes("java"));
    const aptSection = sections.find(sec => sec.section?.toLowerCase().includes("apt") || sec.section?.toLowerCase().includes("logi") || sec.section?.toLowerCase().includes("numer"));
    const codingSection = sections.find(sec => sec.section?.toLowerCase().includes("cod"));

    return {
      studentName: s.name,
      department: s.department,
      academicYear: s.year,
      companyId: results[0]?.testId?.companyId || "",
      testType: results.map(r => r.testId?.testType).filter(Boolean).join(", "),
      technicalMarks: techSection?.obtainedMarks ?? "",
      aptitudeMarks: aptSection?.obtainedMarks ?? "",
      codingMarks: codingSection?.obtainedMarks ?? "",
      overallMarks: results.length ? results.reduce((sum, r) => sum + (r.obtainedMarks || 0), 0) : "",
      percentage: results.length
        ? Math.round(results.reduce((sum, r) => sum + (r.percentage || 0), 0) / results.length)
        : "",
      status: results.some(r => r.passed) ? "Pass" : results.length ? "Fail" : "No Test",
    };
  });
}
