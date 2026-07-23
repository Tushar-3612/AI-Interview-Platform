import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Download,
  Trash2,
  Search,
  AlertTriangle,
  Eye,
  Star,
  Calendar,
  Building2,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

function ResumeManagement() {
  const token = getAuthToken();
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchResumes = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/admin/resumes/list", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setResumes(data || []);
    } catch (error) {
      console.error("Error fetching resumes", error);
      toast.error("Failed to load resumes");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

  const handleDeleteResume = async (studentId, name) => {
    if (!window.confirm(`Delete resume for ${name}?`)) return;
    try {
      await api.put(`/api/admin/students/${studentId}`, {
        resumeFileName: "",
        resumeUploadedAt: null,
        resumeBase64: "",
        atsScore: 0,
        skills: [],
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Resume deleted");
      fetchResumes();
    } catch (error) {
      toast.error("Failed to delete resume");
    }
  };

  const handlePreviewResume = async (studentId) => {
    try {
      const { data } = await api.get(`/api/admin/students/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.student?.resumeBase64) {
        const win = window.open("");
        win.document.write(`<iframe src="data:application/pdf;base64,${data.student.resumeBase64}" style="width:100%;height:100vh;border:none;"></iframe>`);
      } else {
        toast.error("No resume data available for preview");
      }
    } catch (error) {
      toast.error("Failed to load resume");
    }
  };

  const handleDownloadResume = async (studentId, fileName) => {
    try {
      const { data } = await api.get(`/api/admin/students/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.student?.resumeBase64) {
        const linkSource = `data:application/pdf;base64,${data.student.resumeBase64}`;
        const downloadLink = document.createElement("a");
        downloadLink.href = linkSource;
        downloadLink.download = fileName || "resume.pdf";
        downloadLink.click();
        toast.success("Resume downloaded");
      } else {
        toast.error("No resume data available");
      }
    } catch (error) {
      toast.error("Failed to download resume");
    }
  };

  const filtered = resumes.filter((r) =>
    r.studentName?.toLowerCase().includes(search.toLowerCase()) ||
    r.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Resume Management
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          View, preview, and manage all uploaded student resumes ({resumes.length} total).
        </p>
      </motion.div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none"
          style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Loading resumes...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 student-card">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>No resumes found.</p>
        </div>
      ) : (
        <div className="student-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b text-xs font-semibold uppercase tracking-wider bg-slate-50 dark:bg-zinc-900/50" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Resume</th>
                  <th className="px-6 py-4">ATS Score</th>
                  <th className="px-6 py-4">Skills</th>
                  <th className="px-6 py-4">Uploaded</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                {filtered.map((r) => (
                  <tr key={r._id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/10 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-bold text-sm shrink-0">
                          {r.studentName?.[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate max-w-[150px]">{r.studentName}</p>
                          <p className="text-xs truncate max-w-[150px]" style={{ color: "var(--text-muted)" }}>{r.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                        <span className="text-xs">{r.department}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-4 h-4" style={{ color: "var(--primary)" }} />
                        <span className="text-xs font-medium truncate max-w-[120px]">{r.resumeFileName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        r.atsScore >= 75 ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600" :
                        r.atsScore >= 50 ? "bg-blue-50 dark:bg-blue-950/20 text-blue-600" :
                        "bg-red-50 dark:bg-red-950/20 text-red-600"
                      }`}>
                        <Star className="w-3 h-3" />
                        {r.atsScore}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {r.skills?.slice(0, 3).map((skill) => (
                          <span key={skill} className="text-[9px] font-medium px-1.5 py-0.5 rounded" style={{ background: "color-mix(in srgb, var(--primary) 7%, transparent)", color: "var(--text-secondary)" }}>
                            {skill}
                          </span>
                        ))}
                        {r.skills?.length > 3 && (
                          <span className="text-[9px] font-medium" style={{ color: "var(--text-muted)" }}>+{r.skills.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {r.resumeUploadedAt ? new Date(r.resumeUploadedAt).toLocaleDateString() : "N/A"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handlePreviewResume(r._id)}
                          title="Preview"
                          className="p-1.5 rounded-lg border hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                          style={{ borderColor: "var(--border)", color: "var(--primary)" }}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadResume(r._id, r.resumeFileName)}
                          title="Download"
                          className="p-1.5 rounded-lg border hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                          style={{ borderColor: "var(--border)", color: "var(--accent)" }}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteResume(r._id, r.studentName)}
                          title="Delete Resume"
                          className="p-1.5 rounded-lg border hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
                          style={{ borderColor: "var(--border)", color: "var(--error)" }}
                        >
                          <Trash2 className="w-4 h-4" />
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

export default ResumeManagement;
