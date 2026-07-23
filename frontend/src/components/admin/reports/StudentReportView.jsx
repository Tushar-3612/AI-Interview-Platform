import { useState } from "react";
import { motion } from "framer-motion";
import { Download, FileText, FileSpreadsheet, Mail, ChevronDown, ChevronUp, Award, BarChart3, User } from "lucide-react";
import SectionWiseReport from "./SectionWiseReport";
import AIReportCard from "./AIReportCard";
import toast from "react-hot-toast";
import api from "../../../utils/api";
import { getAuthToken } from "../../../hooks/useStudentProfile";

export default function StudentReportView({ report, onClose }) {
  const [expandedTest, setExpandedTest] = useState(null);
  const [loading, setLoading] = useState(null);
  const headers = { Authorization: `Bearer ${getAuthToken()}` };
  const p = report.profile;

  const handleDownload = async (format) => {
    setLoading(format);
    try {
      if (format === "pdf") {
        window.open(`/api/reports/student/${p._id}/pdf?token=${getAuthToken()}`, "_blank");
      } else if (format === "csv") {
        const { data } = await api.get(`/api/reports/student/${p._id}/csv`, { headers });
        const blob = new Blob([data], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `report_${p.name}.csv`; a.click();
        URL.revokeObjectURL(url);
      }
      toast.success(`${format.toUpperCase()} downloaded`);
    } catch {
      toast.error(`Failed to download ${format}`);
    } finally {
      setLoading(null);
    }
  };

  const handleEmail = async () => {
    setLoading("email");
    try {
      const { data } = await api.post(`/api/reports/student/${p._id}/email`, {}, { headers });
      toast.success(data.simulated ? data.message : `Report sent to ${p.email}`);
    } catch {
      toast.error("Failed to send email");
    } finally {
      setLoading(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[var(--primary)] flex items-center justify-center text-white font-bold text-lg">
            {p.name?.charAt(0) || "?"}
          </div>
          <div>
            <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{p.name}</h3>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{p.email} | {p.department} - {p.year}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl border text-xs cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Student Profile Card */}
      <div className="p-5 rounded-2xl border" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 mb-3">
          <User className="w-4 h-4" style={{ color: "var(--primary)" }} />
          <h4 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Profile</h4>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          {[
            ["Phone", p.phone], ["Department", p.department], ["Year", p.year],
            ["ATS Score", p.atsScore != null ? `${p.atsScore}/100` : "N/A"],
            ["Skills", p.skills?.join(", ") || "N/A"],
            ["GitHub", p.github || "N/A"],
            ["LinkedIn", p.linkedin || "N/A"],
            ["Portfolio", p.portfolio || "N/A"],
            ["Resume", p.resumeFileName || "N/A"],
          ].map(([label, value]) => (
            <div key={label}>
              <span className="font-medium" style={{ color: "var(--text-muted)" }}>{label}: </span>
              <span style={{ color: "var(--text-primary)" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Test Results */}
      {report.testResults?.length > 0 && (
        <div className="p-5 rounded-2xl border" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <h4 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Test Results</h4>
          </div>
          <div className="space-y-3">
            {report.testResults.map((tr, i) => (
              <div key={i} className="border rounded-xl" style={{ borderColor: "var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setExpandedTest(expandedTest === i ? null : i)}
                  className="w-full flex items-center justify-between p-3 cursor-pointer"
                  style={{ background: "transparent" }}
                >
                  <div className="flex items-center gap-3">
                    <Award className="w-4 h-4" style={{ color: tr.passed ? "var(--success, #16a34a)" : "var(--error, #dc2626)" }} />
                    <div className="text-left">
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{tr.testTitle}</p>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {tr.testType} | {tr.grade} | {tr.percentage}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold" style={{ color: tr.passed ? "var(--success, #16a34a)" : "var(--error, #dc2626)" }}>
                      {tr.obtainedMarks}/{tr.totalMarks}
                    </span>
                    {expandedTest === i ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>
                {expandedTest === i && (
                  <div className="px-3 pb-3">
                    <div className="flex gap-4 text-xs mb-3 p-2 rounded-xl" style={{ background: "var(--admin-bg-surface, #f8fafc)" }}>
                      <span style={{ color: "var(--success, #16a34a)" }}>Correct: {tr.correct}</span>
                      <span style={{ color: "var(--error, #dc2626)" }}>Wrong: {tr.wrong}</span>
                      <span style={{ color: "var(--text-muted)" }}>Skipped: {tr.skipped}</span>
                      <span style={{ color: "var(--text-secondary)" }}>Attempted: {tr.attempted}</span>
                    </div>
                    <SectionWiseReport sections={tr.sections} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Practice Summary */}
      {report.practiceSummary?.length > 0 && (
        <div className="p-5 rounded-2xl border" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
          <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Practice Interview Summary</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                  <th className="text-left py-2 px-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Company</th>
                  <th className="text-center py-2 px-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Attempts</th>
                  <th className="text-center py-2 px-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Highest</th>
                  <th className="text-center py-2 px-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Average</th>
                  <th className="text-center py-2 px-3 font-semibold" style={{ color: "var(--text-secondary)" }}>Latest</th>
                </tr>
              </thead>
              <tbody>
                {report.practiceSummary.map((ps, i) => (
                  <tr key={i} className="border-b" style={{ borderColor: "var(--border)" }}>
                    <td className="py-2 px-3 font-medium" style={{ color: "var(--text-primary)" }}>{ps.company}</td>
                    <td className="text-center py-2 px-3" style={{ color: "var(--text-secondary)" }}>{ps.attempts}</td>
                    <td className="text-center py-2 px-3" style={{ color: "var(--success, #16a34a)" }}>{ps.highestScore ?? "-"}</td>
                    <td className="text-center py-2 px-3" style={{ color: "var(--text-secondary)" }}>{ps.averageScore ?? "-"}</td>
                    <td className="text-center py-2 px-3" style={{ color: "var(--text-secondary)" }}>{ps.latestScore ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Evaluation */}
      {report.aiEvaluation && (
        <div className="p-5 rounded-2xl border" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
          <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>AI Evaluation</h4>
          <AIReportCard aiEvaluation={report.aiEvaluation} />
        </div>
      )}

      {/* Download Actions */}
      <div className="flex flex-wrap gap-2 p-4 rounded-2xl border" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
        <button
          type="button"
          onClick={() => handleDownload("pdf")}
          disabled={loading === "pdf"}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer disabled:opacity-50"
          style={{ background: "var(--primary)", color: "white" }}
        >
          <FileText className="w-4 h-4" /> {loading === "pdf" ? "..." : "Download PDF"}
        </button>
        <button
          type="button"
          onClick={() => handleDownload("csv")}
          disabled={loading === "csv"}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border cursor-pointer disabled:opacity-50"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <FileSpreadsheet className="w-4 h-4" /> {loading === "csv" ? "..." : "Download CSV"}
        </button>
        <button
          type="button"
          onClick={handleEmail}
          disabled={loading === "email"}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border cursor-pointer disabled:opacity-50"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <Mail className="w-4 h-4" /> {loading === "email" ? "..." : "Email Report"}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border cursor-pointer"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <Download className="w-4 h-4" /> Print
        </button>
      </div>
    </motion.div>
  );
}
