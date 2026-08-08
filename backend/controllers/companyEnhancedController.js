import mongoose from "mongoose";
import Company from "../models/Company.js";
import Test from "../models/Test.js";
import TestResult from "../models/TestResult.js";
import AptitudeQuestion from "../models/AptitudeQuestion.js";
import CodingQuestion from "../models/CodingQuestion.js";
import { createAuditLog } from "../middleware/auditMiddleware.js";
import { createNotification } from "../services/notificationService.js";

const TRASH_RETENTION_DAYS = 30;

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value));
}

function companyLookupFilter(id) {
  return isValidObjectId(id) ? { $or: [{ _id: id }, { id }] } : { id };
}

export const cleanupExpiredCompanyTrash = async () => {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await Company.deleteMany({ isDeleted: true, deletedAt: { $lt: cutoff } });
  if (result.deletedCount > 0) console.log(`🗑️ Auto-purged ${result.deletedCount} companies older than ${TRASH_RETENTION_DAYS} days`);
};

export const getCompanies = async (req, res) => {
  try {
    const companies = await Company.find({ isDeleted: { $ne: true } }).sort({ name: 1 }).lean();
    const companyIds = companies.map((c) => c.id);
    const [aptCounts, codCounts] = await Promise.all([
      AptitudeQuestion.aggregate([
        { $match: { isDeleted: false, isActive: true, companyId: { $in: companyIds } } },
        { $group: { _id: "$companyId", count: { $sum: 1 } } },
      ]),
      CodingQuestion.aggregate([
        { $match: { isDeleted: { $ne: true }, isActive: true, companyId: { $in: companyIds } } },
        { $group: { _id: "$companyId", count: { $sum: 1 } } },
      ]),
    ]);
    const aptMap = Object.fromEntries(aptCounts.map((a) => [a._id, a.count]));
    const codMap = Object.fromEntries(codCounts.map((a) => [a._id, a.count]));
    res.json(
      companies.map((c) => ({
        ...c,
        aptitudeCount: aptMap[c.id] || 0,
        codingCount: codMap[c.id] || 0,
        lastUpdated: c.lastUpdated || c.updatedAt,
      }))
    );
  } catch (error) {
    console.error("Get Companies Error:", error.message);
    res.status(500).json({ message: "Failed to fetch companies" });
  }
};

export const getCompanyById = async (req, res) => {
  try {
    const company = await Company.findOne(companyLookupFilter(req.params.id)).lean();
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
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const existing = await Company.findOne({ id });
    if (existing && !existing.isDeleted) return res.status(400).json({ message: "Company already exists" });
    const company = await Company.create({ ...req.body, id, color: req.body.color || "#2563EB", lastUpdated: new Date() });
    await createAuditLog({ userId: req.user.id, role: "admin", action: "create_company", resource: "Company", resourceId: company._id.toString(), details: { name }, ip: req.ip, userAgent: req.headers["user-agent"] });
    await createNotification({
      role: "all",
      type: "success",
      title: "New company added",
      message: `${company.name} is now available for aptitude and coding practice.`,
      link: "/interview-practice",
    });
    res.status(201).json(company);
  } catch (error) {
    console.error("Add Company Error:", error.message);
    res.status(500).json({ message: "Failed to add company" });
  }
};

export const updateCompany = async (req, res) => {
  try {
    const company = await Company.findOneAndUpdate(
      companyLookupFilter(req.params.id),
      { ...req.body, lastUpdated: new Date() },
      { new: true, runValidators: true }
    );
    if (!company) return res.status(404).json({ message: "Company not found" });
    await createAuditLog({ userId: req.user.id, role: "admin", action: "update_company", resource: "Company", resourceId: company._id.toString(), details: { name: company.name }, ip: req.ip, userAgent: req.headers["user-agent"] });
    res.json(company);
  } catch (error) {
    console.error("Update Company Error:", error.message);
    res.status(500).json({ message: "Failed to update company" });
  }
};

export const uploadCompanyLogo = async (req, res) => {
  try {
    const { logo } = req.body;
    if (!logo || typeof logo !== "string") return res.status(400).json({ message: "Logo data URL is required" });
    const company = await Company.findOneAndUpdate(
      companyLookupFilter(req.params.id),
      { logo, lastUpdated: new Date() },
      { new: true }
    );
    if (!company) return res.status(404).json({ message: "Company not found" });
    res.json(company);
  } catch (error) {
    console.error("Upload Company Logo Error:", error.message);
    res.status(500).json({ message: "Failed to upload logo" });
  }
};

export const toggleCompanyStatus = async (req, res) => {
  try {
    const company = await Company.findOne(companyLookupFilter(req.params.id));
    if (!company) return res.status(404).json({ message: "Company not found" });
    company.status = company.status === "active" ? "inactive" : "active";
    company.lastUpdated = new Date();
    await company.save();
    res.json(company);
  } catch (error) {
    console.error("Toggle Company Status Error:", error.message);
    res.status(500).json({ message: "Failed to toggle company" });
  }
};

export const deleteCompany = async (req, res) => {
  try {
    const company = await Company.findOneAndUpdate(
      companyLookupFilter(req.params.id),
      { isDeleted: true, deletedAt: new Date(), status: "inactive", lastUpdated: new Date() },
      { new: true }
    );
    if (!company) return res.status(404).json({ message: "Company not found" });
    await createAuditLog({ userId: req.user.id, role: "admin", action: "delete_company", resource: "Company", resourceId: req.params.id, details: { name: company.name }, ip: req.ip, userAgent: req.headers["user-agent"] });
    res.json({ message: "Company moved to trash" });
  } catch (error) {
    console.error("Delete Company Error:", error.message);
    res.status(500).json({ message: "Failed to delete company" });
  }
};

export const getTrashedCompanies = async (req, res) => {
  try {
    const companies = await Company.find({ isDeleted: true }).sort({ deletedAt: -1 }).lean();
    res.json({ companies });
  } catch (error) {
    console.error("Get Trash Error:", error.message);
    res.status(500).json({ message: "Failed to fetch trash" });
  }
};

export const restoreCompany = async (req, res) => {
  try {
    const company = await Company.findOneAndUpdate(
      companyLookupFilter(req.params.id),
      { isDeleted: false, deletedAt: null, status: "active", lastUpdated: new Date() },
      { new: true }
    );
    if (!company) return res.status(404).json({ message: "Company not found" });
    res.json({ message: "Company restored", company });
  } catch (error) {
    console.error("Restore Company Error:", error.message);
    res.status(500).json({ message: "Failed to restore company" });
  }
};

export const hardDeleteCompany = async (req, res) => {
  try {
    const company = await Company.findOneAndDelete(companyLookupFilter(req.params.id));
    if (!company) return res.status(404).json({ message: "Company not found" });
    res.json({ message: "Company permanently deleted" });
  } catch (error) {
    console.error("Hard Delete Company Error:", error.message);
    res.status(500).json({ message: "Failed to permanently delete company" });
  }
};

export const getCompanyAnalytics = async (req, res) => {
  try {
    const companies = await Company.find({ isDeleted: { $ne: true } }).lean();
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
