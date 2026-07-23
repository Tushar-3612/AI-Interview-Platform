import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Mail, Phone, Building2, GraduationCap, Globe, Download,
  FileText, Calendar, Star, ExternalLink, BookOpen,
  TrendingUp, Target, Clock,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

function GithubIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function LinkedinIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function StudentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = getAuthToken();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/api/admin/students/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res);
    } catch {
      toast.error("Failed to load student");
      navigate("/admin/students");
    } finally {
      setLoading(false);
    }
  }, [id, token, navigate]);

  useEffect(() => { fetchDetails(); }, [fetchDetails]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { student = {}, interviewHistory = [] } = data || {};

  const practiceInts = interviewHistory.filter((i) => i.interviewType === "practice");
  const realInts = interviewHistory.filter((i) => i.interviewType === "real");

  const companyPracticeMap = {};
  practiceInts.forEach((i) => {
    const key = i.companyId || "General";
    if (!companyPracticeMap[key]) {
      companyPracticeMap[key] = { company: key, attempts: 0, scores: [] };
    }
    companyPracticeMap[key].attempts++;
    companyPracticeMap[key].scores.push(i.overallScore || 0);
  });

  const handlePreview = () => {
    if (!student.resumeBase64) { toast.error("No resume"); return; }
    const w = window.open("");
    w.document.write(`<iframe src="data:application/pdf;base64,${student.resumeBase64}" style="width:100%;height:100vh;border:none;"></iframe>`);
  };

  const handleDownload = () => {
    if (!student.resumeBase64) { toast.error("No resume"); return; }
    const a = document.createElement("a");
    a.href = `data:application/pdf;base64,${student.resumeBase64}`;
    a.download = student.resumeFileName || "resume.pdf";
    a.click();
    toast.success("Downloading resume");
  };

  const socialLinks = [
    { key: "github", label: "GitHub", icon: GithubIcon, href: student.github, color: "var(--admin-accent)" },
    { key: "linkedin", label: "LinkedIn", icon: LinkedinIcon, href: student.linkedin, color: "#0A66C2" },
    { key: "portfolio", label: "Portfolio", icon: Globe, href: student.portfolio, color: "var(--primary)" },
  ];

  const cardBg = "border admin-border admin-card rounded-xl p-5";

  return (
    <div className="space-y-5 max-w-4xl">
      <button onClick={() => navigate("/admin/students")}
        className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
        style={{ color: "var(--text-secondary)" }}>
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Students
      </button>

      {/* ── Profile Card ── */}
      <div className={cardBg}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold shrink-0"
            style={{ background: "var(--primary)", color: "#fff" }}>
            {student.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{student.name}</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              <span className="inline-flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} /> {student.email}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} /> {student.phone || "—"}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> {student.department}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5" /> {student.year}
              </span>
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t admin-table-divider">
          {socialLinks.map(({ key, label, icon: Icon, href, color }) => (
            href ? (
              <a key={key} href={href.startsWith("http") ? href : `https://${href}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border admin-border admin-hover"
                style={{ color: "var(--text-secondary)" }}>
                <Icon className="w-3.5 h-3.5" style={{ color }} /> {label}
                <ExternalLink className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
              </a>
            ) : (
              <span key={key}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border admin-border"
                style={{ color: "var(--text-muted)" }}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </span>
            )
          ))}
        </div>
      </div>

      {/* ── Three Column Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Resume Card */}
        <div className={cardBg}>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <FileText className="w-4 h-4" style={{ color: "var(--primary)" }} /> Resume
          </h3>
          {student.resumeFileName ? (
            <div className="space-y-3.5">
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--bg-primary)" }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--primary)", color: "#fff" }}>
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{student.resumeFileName}</p>
                  {student.resumeUploadedAt && (
                    <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                      <Calendar className="w-3 h-3" /> {new Date(student.resumeUploadedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handlePreview}
                  className="flex-1 py-2 text-xs font-medium rounded-lg border admin-border admin-hover cursor-pointer"
                  style={{ color: "var(--primary)" }}>Preview</button>
                <button onClick={handleDownload}
                  className="flex-1 inline-flex items-center justify-center gap-1 py-2 text-xs font-medium rounded-lg border admin-border admin-hover cursor-pointer"
                  style={{ color: "var(--badge-success-text)" }}>
                  <Download className="w-3 h-3" />Download
                </button>
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-xl" style={{
                background: student.atsScore >= 75 ? "var(--badge-success-bg)" : student.atsScore >= 50 ? "var(--badge-warning-bg)" : "var(--badge-error-bg)",
              }}>
                <Star className="w-4 h-4 shrink-0" style={{
                  color: student.atsScore >= 75 ? "var(--badge-success-text)" : student.atsScore >= 50 ? "var(--badge-warning-text)" : "var(--badge-error-text)",
                }} />
                <div>
                  <span className="text-xs font-bold" style={{
                    color: student.atsScore >= 75 ? "var(--badge-success-text)" : student.atsScore >= 50 ? "var(--badge-warning-text)" : "var(--badge-error-text)",
                  }}>ATS Score: {student.atsScore || 0}%</span>
                  <p className="text-[10px] mt-0.5" style={{
                    color: student.atsScore >= 75 ? "var(--badge-success-text)" : student.atsScore >= 50 ? "var(--badge-warning-text)" : "var(--badge-error-text)",
                  }}>
                    {student.atsScore >= 75 ? "Well optimized" : student.atsScore >= 50 ? "Room for improvement" : "Needs optimization"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <FileText className="w-8 h-8 mb-2" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No resume uploaded</p>
            </div>
          )}
        </div>

        {/* Practice Interviews Summary */}
        <div className={cardBg}>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <BookOpen className="w-4 h-4" style={{ color: "var(--badge-success-text)" }} /> Practice Interviews
          </h3>
          {Object.keys(companyPracticeMap).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <TrendingUp className="w-8 h-8 mb-2" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No practice sessions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(companyPracticeMap).map(([company, info]) => {
                const best = Math.max(...info.scores);
                const avg = Math.round(info.scores.reduce((a, b) => a + b, 0) / info.scores.length);
                const latest = info.scores[info.scores.length - 1];
                return (
                  <div key={company} className="p-3 rounded-xl border admin-border" style={{ background: "var(--bg-primary)" }}>
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{company}</p>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{
                        background: info.attempts >= 5 ? "var(--badge-success-bg)" : "var(--admin-surface-hover)",
                        color: info.attempts >= 5 ? "var(--badge-success-text)" : "var(--text-secondary)",
                      }}>{info.attempts} attempt{info.attempts !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: "Best", value: `${best}%`, color: "var(--badge-success-text)" },
                        { label: "Average", value: `${avg}%`, color: "var(--primary)" },
                        { label: "Latest", value: `${latest}%`, color: "var(--text-primary)" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="py-1.5 rounded-lg" style={{ background: "var(--card-bg)" }}>
                          <p className="text-[11px] font-bold" style={{ color }}>{value}</p>
                          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Real Interviews Summary */}
        <div className={cardBg}>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Target className="w-4 h-4" style={{ color: "var(--badge-purple-text)" }} /> Real Interviews
          </h3>
          {realInts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Target className="w-8 h-8 mb-2" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No real interviews</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {realInts.map((i) => {
                const res = i.result;
                const score = res?.overallScore || 0;
                return (
                  <div key={i._id} className="flex items-center justify-between p-3 rounded-xl border admin-border" style={{ background: "var(--bg-primary)" }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{i.companyId || "General"}</p>
                      <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                        <Clock className="w-3 h-3" />
                        {new Date(i.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-sm font-bold" style={{ color: score >= 50 ? "var(--badge-success-text)" : "var(--badge-error-text)" }}>{score}%</p>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{
                        background: i.status === "completed" ? "var(--badge-success-bg)" : "var(--badge-warning-bg)",
                        color: i.status === "completed" ? "var(--badge-success-text)" : "var(--badge-warning-text)",
                      }}>{i.status === "completed" ? "Completed" : i.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StudentDetails;
