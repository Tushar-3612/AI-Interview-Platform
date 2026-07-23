import User from "../models/User.js";
import Test from "../models/Test.js";
import ReportHistory from "../models/ReportHistory.js";
import {
  getStudentReport,
  getBatchReport,
  getCompanyReport,
  getPracticeReport,
  searchReports,
  getReportExportData,
} from "../services/reportService.js";
import { generateStudentReportPDF, generateStudentReportBuffer, generateBatchReportPDF } from "../utils/pdfGenerator.js";
import { generateReportExcel, generateFullReportExcel } from "../utils/excelGenerator.js";
import { sendReportEmail } from "../utils/emailService.js";

export const getStudentReportHandler = async (req, res) => {
  try {
    const { studentId } = req.params;
    const report = await getStudentReport(studentId);
    res.json(report);
  } catch (error) {
    console.error("Student Report Error:", error.message);
    if (error.message === "Student not found") {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: "Failed to generate student report" });
  }
};

export const downloadStudentPDF = async (req, res) => {
  try {
    const { studentId } = req.params;
    const report = await getStudentReport(studentId);
    generateStudentReportPDF(report, res);

    await logReportHistory(req, "student", { studentId }, "pdf");
  } catch (error) {
    console.error("Student PDF Error:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  }
};

export const downloadStudentCSV = async (req, res) => {
  try {
    const { studentId } = req.params;
    const report = await getStudentReport(studentId);
    const rows = [];

    for (const tr of report.testResults) {
      for (const sec of tr.sections || []) {
        rows.push({
          "Test": tr.testTitle,
          "Type": tr.testType,
          "Section": sec.section,
          "Correct": sec.correct,
          "Wrong": sec.wrong,
          "Skipped": sec.skipped,
          "Marks": `${sec.obtainedMarks}/${sec.totalMarks}`,
          "Percentage": `${sec.percentage}%`,
        });
      }
    }

    const headers = ["Test", "Type", "Section", "Correct", "Wrong", "Skipped", "Marks", "Percentage"];
    const csvLines = [headers.join(",")];
    for (const row of rows) {
      csvLines.push(headers.map(h => {
        const val = String(row[h] ?? "");
        return val.includes(",") ? `"${val}"` : val;
      }).join(","));
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="report_${report.profile.name.replace(/\s+/g, "_")}.csv"`);
    res.send(csvLines.join("\n"));

    await logReportHistory(req, "student", { studentId }, "csv");
  } catch (error) {
    console.error("Student CSV Error:", error.message);
    res.status(500).json({ message: "Failed to generate CSV" });
  }
};

export const emailStudentReport = async (req, res) => {
  try {
    const { studentId } = req.params;
    const user = await User.findById(studentId).lean();
    if (!user) return res.status(404).json({ message: "Student not found" });

    const report = await getStudentReport(studentId);
    const pdfBuffer = await generateStudentReportBuffer(report);

    try {
      const emailResult = await sendReportEmail({
        to: user.email,
        subject: `Your Performance Report - AI Interview Platform`,
        text: `Dear ${user.name},\n\nPlease find attached your performance report from AI Interview Platform.\n\nBest regards,\nAI Interview Platform Team`,
        pdfBuffer,
        filename: `report_${user.name.replace(/\s+/g, "_")}.pdf`,
      });

      if (emailResult.simulated) {
        return res.json({ message: emailResult.message, simulated: true });
      }

      await logReportHistory(req, "student", { studentId }, "pdf", user.email);
      res.json({ message: "Report emailed successfully", to: user.email });
    } catch (emailErr) {
      res.status(500).json({ message: emailErr.message });
    }
  } catch (error) {
    console.error("Email Report Error:", error.message);
    res.status(500).json({ message: "Failed to email report" });
  }
};

export const getBatchReportHandler = async (req, res) => {
  try {
    const { department, year } = req.query;
    const report = await getBatchReport(department, year);
    res.json(report);
  } catch (error) {
    console.error("Batch Report Error:", error.message);
    if (error.message === "No students found") {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: "Failed to generate batch report" });
  }
};

export const downloadBatchPDF = async (req, res) => {
  try {
    const { department, year } = req.query;
    const report = await getBatchReport(department, year);
    generateBatchReportPDF(report, res);

    await logReportHistory(req, "batch", { department, year }, "pdf");
  } catch (error) {
    console.error("Batch PDF Error:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to generate batch PDF" });
    }
  }
};

export const getCompanyReportHandler = async (req, res) => {
  try {
    const { companyId } = req.params;
    const report = await getCompanyReport(companyId);
    res.json(report);
  } catch (error) {
    console.error("Company Report Error:", error.message);
    res.status(500).json({ message: "Failed to generate company report" });
  }
};

export const getPracticeReportHandler = async (req, res) => {
  try {
    const report = await getPracticeReport();
    res.json(report);
  } catch (error) {
    console.error("Practice Report Error:", error.message);
    res.status(500).json({ message: "Failed to generate practice report" });
  }
};

export const exportAllCSV = async (req, res) => {
  try {
    const { department, year } = req.query;
    const data = await getReportExportData({ department, year });

    const headers = [
      "Student Name", "Department", "Academic Year", "Company", "Test Type",
      "Technical Marks", "Aptitude Marks", "Coding Marks", "Overall Marks", "Percentage", "Status",
    ];
    const csvLines = [headers.join(",")];
    for (const row of data) {
      csvLines.push(headers.map(h => {
        const key = h.toLowerCase().replace(/\s+/g, "");
        const val = String(row[key] ?? row[h] ?? "");
        return val.includes(",") ? `"${val}"` : val;
      }).join(","));
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="all_students_report.csv"`);
    res.send(csvLines.join("\n"));

    await logReportHistory(req, "full", { department, year }, "csv");
  } catch (error) {
    console.error("Export CSV Error:", error.message);
    res.status(500).json({ message: "Failed to export CSV" });
  }
};

export const exportAllExcel = async (req, res) => {
  try {
    const { department, year } = req.query;
    const data = await getReportExportData({ department, year });
    await generateReportExcel(data, res);

    await logReportHistory(req, "full", { department, year }, "excel");
  } catch (error) {
    console.error("Export Excel Error:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to export Excel" });
    }
  }
};

export const exportFullExcel = async (req, res) => {
  try {
    const { department, year } = req.query;
    const batchReport = await getBatchReport(department, year);
    await generateFullReportExcel(batchReport, res);

    await logReportHistory(req, "full", { department, year }, "excel");
  } catch (error) {
    console.error("Full Excel Error:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to generate full Excel report" });
    }
  }
};

export const searchReportsHandler = async (req, res) => {
  try {
    const { q, department, year, company, dateFrom, dateTo, page, limit } = req.query;
    const result = await searchReports({
      query: q,
      department,
      year,
      company,
      dateFrom,
      dateTo,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });
    res.json(result);
  } catch (error) {
    console.error("Search Reports Error:", error.message);
    res.status(500).json({ message: "Failed to search reports" });
  }
};

export const getReportHistory = async (req, res) => {
  try {
    const history = await ReportHistory.find({ generatedBy: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(history);
  } catch (error) {
    console.error("Report History Error:", error.message);
    res.status(500).json({ message: "Failed to fetch report history" });
  }
};

export const getCompaniesList = async (req, res) => {
  try {
    const companies = await Test.distinct("companyId", { companyId: { $ne: "" } });
    res.json(companies.filter(Boolean));
  } catch (error) {
    console.error("Companies List Error:", error.message);
    res.status(500).json({ message: "Failed to fetch companies" });
  }
};

async function logReportHistory(req, reportType, filters, format, emailedTo) {
  try {
    await ReportHistory.create({
      reportType,
      generatedBy: req.user.id,
      filters,
      downloadFormat: format,
      emailedTo,
      emailedAt: emailedTo ? new Date() : undefined,
      status: emailedTo ? "emailed" : "generated",
    });
  } catch (err) {
    console.error("Failed to log report history:", err.message);
  }
}
