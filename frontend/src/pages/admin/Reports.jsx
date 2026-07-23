import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  FileDown,
  Download,
  Mail,
  Search,
  FileText,
  FileSpreadsheet,
  AlertTriangle,
  Loader,
  UserCheck,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

function Reports() {
  const token = getAuthToken();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sendingEmailId, setSendingEmailId] = useState(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/admin/students", {
        params: { limit: 100 },
        headers: { Authorization: `Bearer ${token}` },
      });
      setStudents(data.students || []);
    } catch (error) {
      console.error("Error fetching students", error);
      toast.error("Failed to load student list");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleDownloadPDF = (studentId) => {
    window.open(`http://localhost:5000/api/admin/students/${studentId}/pdf?token=${token}`, "_blank");
    toast.success("Downloading PDF report");
  };

  const handleDownloadCSV = (studentId) => {
    window.open(`http://localhost:5000/api/admin/students/${studentId}/csv?token=${token}`, "_blank");
    toast.success("Downloading CSV report");
  };

  const handleExportAll = () => {
    window.open(`http://localhost:5000/api/admin/reports/export-all?token=${token}`, "_blank");
    toast.success("Downloading all students report");
  };

  const handleSendEmail = async (studentId) => {
    setSendingEmailId(studentId);
    try {
      const { data } = await api.post(`/api/admin/students/${studentId}/email-report`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(data.message || "Report emailed successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to email report");
    } finally {
      setSendingEmailId(null);
    }
  };

  const filtered = students.filter((s) =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Reports
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Generate and download PDF, Excel, or CSV reports for students.
        </p>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none"
            style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
          />
        </div>
        <button
          type="button"
          onClick={handleExportAll}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white btn-gradient cursor-pointer"
        >
          <FileDown className="w-4 h-4" />
          Export All (CSV)
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Loading student data...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 student-card">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>No students found.</p>
        </div>
      ) : (
        <div className="student-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b text-xs font-semibold uppercase tracking-wider bg-slate-50 dark:bg-zinc-900/50" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Year</th>
                  <th className="px-6 py-4">ATS Score</th>
                  <th className="px-6 py-4">Avg Score</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                {filtered.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/10 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-bold text-sm shrink-0">
                          {s.name?.[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate max-w-[150px]">{s.name}</p>
                          <p className="text-xs truncate max-w-[150px]" style={{ color: "var(--text-muted)" }}>{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs">{s.department}</td>
                    <td className="px-6 py-4 text-xs">{s.year}</td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-xs" style={{ color: s.atsScore >= 75 ? "var(--success)" : "var(--primary)" }}>
                        {s.atsScore || 0}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-xs" style={{ color: s.avgScore >= 75 ? "var(--success)" : s.avgScore >= 50 ? "var(--primary)" : "var(--error)" }}>
                        {s.avgScore ? `${s.avgScore}%` : "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadPDF(s._id)}
                          title="Download PDF"
                          className="p-1.5 rounded-lg border hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                          style={{ borderColor: "var(--border)", color: "var(--error)" }}
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadCSV(s._id)}
                          title="Download CSV"
                          className="p-1.5 rounded-lg border hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                          style={{ borderColor: "var(--border)", color: "var(--success)" }}
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={sendingEmailId === s._id}
                          onClick={() => handleSendEmail(s._id)}
                          title="Email Report"
                          className="p-1.5 rounded-lg border hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
                          style={{ borderColor: "var(--border)", color: "var(--primary)" }}
                        >
                          {sendingEmailId === s._id ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <Mail className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reports;
