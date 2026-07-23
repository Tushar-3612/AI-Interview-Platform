import Company from "../models/Company.js";
import Test from "../models/Test.js";
import TestResult from "../models/TestResult.js";
import { createAuditLog } from "../middleware/auditMiddleware.js";

export const getCompanies = async (req, res) => {
  try {
    const companies = await Company.find().sort({ name: 1 }).lean();
    res.json(companies);
  } catch (error) {
    console.error("Get Companies Error:", error.message);
    res.status(500).json({ message: "Failed to fetch companies" });
  }
};

export const getCompanyById = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id).lean();
    if (!company) return res.status(404).json({ message: "Company not found" });
    const tests = await Test.find({ companyId: company.id }).select("title testType difficulty status createdAt").lean();
    const testIds = tests.map(t => t._id);
    const results = await TestResult.find({ testId: { $in: testIds } }).populate("userId", "name email").lean();
    const percentages = results.map(r => r.percentage).filter(p => p != null);
    const sectionSubjectCounts = {};
    for (const r of results) {
      for (const sec of r.sections || []) {
        const key = sec.section;
        if (!sectionSubjectCounts[key]) sectionSubjectCounts[key] = { correct: 0, wrong: 0, total: 0 };
        sectionSubjectCounts[key].correct += sec.correct || 0;
        sectionSubjectCounts[key].wrong += sec.wrong || 0;
        sectionSubjectCounts[key].total++;
      }
    }
    let mostDifficult = null;
    let mostDifficultPct = 100;
    for (const [subject, data] of Object.entries(sectionSubjectCounts)) {
      const pct = data.total > 0 ? (data.correct / (data.correct + data.wrong)) * 100 : 0;
      if (pct < mostDifficultPct && data.total > 0) {
        mostDifficultPct = pct;
        mostDifficult = subject;
      }
    }
    res.json({
      company,
      tests: tests.map(t => ({ _id: t._id, title: t.title, testType: t.testType, difficulty: t.difficulty, status: t.status, createdAt: t.createdAt })),
      stats: {
        totalStudentsAppeared: results.length,
        averageScore: percentages.length ? Math.round(percentages.reduce((s, v) => s + v, 0) / percentages.length) : 0,
        highestScore: percentages.length ? Math.max(...percentages) : 0,
        lowestScore: percentages.length ? Math.min(...percentages) : 0,
        selectedStudents: results.filter(r => r.passed).length,
        rejectedStudents: results.filter(r => !r.passed).length,
        mostDifficultSubject: mostDifficult,
      },
    });
  } catch (error) {
    console.error("Get Company By ID Error:", error.message);
    res.status(500).json({ message: "Failed to fetch company details" });
  }
};

export const addCompany = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Company name is required" });
    const id = name.toLowerCase().replace(/\s+/g, "-");
    const existing = await Company.findOne({ id });
    if (existing) return res.status(400).json({ message: "Company already exists" });
    const company = await Company.create({ ...req.body, id, color: req.body.color || "#2563EB" });
    await createAuditLog({ userId: req.user.id, role: "admin", action: "create_company", resource: "Company", resourceId: company._id.toString(), details: { name }, ip: req.ip, userAgent: req.headers["user-agent"] });
    res.status(201).json(company);
  } catch (error) {
    console.error("Add Company Error:", error.message);
    res.status(500).json({ message: "Failed to add company" });
  }
};

export const updateCompany = async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!company) return res.status(404).json({ message: "Company not found" });
    await createAuditLog({ userId: req.user.id, role: "admin", action: "update_company", resource: "Company", resourceId: company._id.toString(), details: { name: company.name }, ip: req.ip, userAgent: req.headers["user-agent"] });
    res.json(company);
  } catch (error) {
    console.error("Update Company Error:", error.message);
    res.status(500).json({ message: "Failed to update company" });
  }
};

export const deleteCompany = async (req, res) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) return res.status(404).json({ message: "Company not found" });
    await createAuditLog({ userId: req.user.id, role: "admin", action: "delete_company", resource: "Company", resourceId: req.params.id, details: { name: company.name }, ip: req.ip, userAgent: req.headers["user-agent"] });
    res.json({ message: "Company deleted" });
  } catch (error) {
    console.error("Delete Company Error:", error.message);
    res.status(500).json({ message: "Failed to delete company" });
  }
};

export const getCompanyAnalytics = async (req, res) => {
  try {
    const companies = await Company.find().lean();
    const analytics = [];
    for (const company of companies) {
      const tests = await Test.find({ companyId: company.id }).lean();
      const testIds = tests.map(t => t._id);
      const results = await TestResult.find({ testId: { $in: testIds } }).lean();
      const percentages = results.map(r => r.percentage).filter(p => p != null);
      analytics.push({
        companyId: company.id,
        companyName: company.name,
        attempts: results.length,
        averageScore: percentages.length ? Math.round(percentages.reduce((s, v) => s + v, 0) / percentages.length) : 0,
        bestScore: percentages.length ? Math.max(...percentages) : 0,
      });
    }
    res.json(analytics);
  } catch (error) {
    console.error("Company Analytics Error:", error.message);
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
};
