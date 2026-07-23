import User from "../models/User.js";
import Test from "../models/Test.js";
import TestResult from "../models/TestResult.js";
import Interview from "../models/Interview.js";
import Result from "../models/Result.js";
import XLSX from "xlsx";
import { syncAllExports } from "../utils/csvExporter.js";
import { createAuditLog } from "../middleware/auditMiddleware.js";

export const backupAllCSV = async (req, res) => {
  try {
    await syncAllExports();
    await createAuditLog({ userId: req.user.id, role: "admin", action: "backup_csv", resource: "Backup", details: { type: "csv" }, ip: req.ip, userAgent: req.headers["user-agent"] });
    res.json({ message: "CSV backup completed" });
  } catch (error) {
    console.error("Backup CSV Error:", error.message);
    res.status(500).json({ message: "Failed to backup CSV" });
  }
};

export const backupExcel = async (req, res) => {
  try {
    const wb = XLSX.utils.book_new();
    const users = await User.find().select("-password").lean();
    const tests = await Test.find().lean();
    const results = await TestResult.find().populate("userId", "name email").lean();
    const interviews = await Interview.find().populate("companyId", "name").lean();

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(users.map(u => ({ Name: u.name, Email: u.email, Department: u.department, Year: u.year, ATS: u.atsScore, Skills: (u.skills || []).join(", ") }))), "Users");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tests.map(t => ({ Title: t.title, Type: t.testType, Difficulty: t.difficulty, Duration: t.duration, Status: t.status }))), "Tests");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(results.map(r => ({ Student: r.userId?.name || "Unknown", Percentage: r.percentage, Grade: r.grade, Passed: r.passed ? "Yes" : "No", Obtained: r.obtainedMarks, Total: r.totalMarks }))), "Results");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(interviews.map(i => ({ Student: i.userId?.toString() || "", Company: i.companyId?.name || "Unknown", Type: i.interviewType, Score: i.overallScore, Status: i.status }))), "Interviews");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const dateStr = new Date().toISOString().split("T")[0];
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="backup_${dateStr}.xlsx"`);
    res.send(buffer);

    await createAuditLog({ userId: req.user.id, role: "admin", action: "backup_excel", resource: "Backup", details: { type: "excel", sheets: ["Users", "Tests", "Results", "Interviews"] }, ip: req.ip, userAgent: req.headers["user-agent"] });
  } catch (error) {
    console.error("Backup Excel Error:", error.message);
    if (!res.headersSent) res.status(500).json({ message: "Failed to backup Excel" });
  }
};

export const getBackupStatus = async (req, res) => {
  try {
    const counts = {
      users: await User.countDocuments(),
      tests: await Test.countDocuments(),
      results: await TestResult.countDocuments(),
      interviews: await Interview.countDocuments(),
    };
    res.json({ counts, lastBackup: null, status: "available" });
  } catch (error) {
    console.error("Backup Status Error:", error.message);
    res.status(500).json({ message: "Failed to get backup status" });
  }
};
