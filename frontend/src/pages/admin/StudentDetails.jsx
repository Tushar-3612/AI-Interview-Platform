import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  GraduationCap,
  Globe,
  FileText,
  Download,
  Trash2,
  Cpu,
  Code2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  History,
  TrendingUp,
  Bookmark,
} from "lucide-react";

const GithubIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const LinkedinIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

function StudentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = getAuthToken();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("resume");
  const [expandedInterviewId, setExpandedInterviewId] = useState(null);

  const fetchStudentDetails = useCallback(async () => {
    setLoading(true);
    try {
      const { data: details } = await api.get(`/api/admin/students/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(details);
    } catch (error) {
      console.error("Error retrieving student details", error);
      toast.error("Failed to load student folder");
      navigate("/admin/students");
    } finally {
      setLoading(false);
    }
  }, [id, token, navigate]);

  useEffect(() => {
    fetchStudentDetails();
  }, [fetchStudentDetails]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Compiling student file...
        </p>
      </div>
    );
  }

  const { student = {}, interviewHistory = [], companyAnalytics = [] } = data || {};

  const handleDeleteResume = async () => {
    if (!window.confirm("Are you sure you want to delete this student's uploaded resume? This clears their ATS score and skills list.")) return;
    try {
      await api.put(`/api/admin/students/${id}`, {
        resumeFileName: "",
        resumeUploadedAt: null,
        resumeBase64: "",
        atsScore: 0,
        skills: [],
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Resume data cleared");
      fetchStudentDetails();
    } catch (error) {
      console.error("Error deleting resume", error);
      toast.error("Failed to clear resume file");
    }
  };

  const handleDownloadResume = () => {
    if (!student.resumeBase64) return;
    
    // Create download link for PDF
    const linkSource = `data:application/pdf;base64,${student.resumeBase64}`;
    const downloadLink = document.createElement("a");
    downloadLink.href = linkSource;
    downloadLink.download = student.resumeFileName || "resume.pdf";
    downloadLink.click();
    toast.success("Resume download started");
  };

  const toggleInterviewExpand = (id) => {
    setExpandedInterviewId(expandedInterviewId === id ? null : id);
  };

  // Group practice vs real
  const practiceInterviews = interviewHistory.filter((i) => i.interviewType === "practice");
  const realInterviews = interviewHistory.filter((i) => i.interviewType === "real");

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Back Button */}
      <button
        type="button"
        onClick={() => navigate("/admin/students")}
        className="flex items-center gap-2 text-sm font-medium cursor-pointer hover:opacity-85"
        style={{ color: "var(--text-secondary)" }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Students List
      </button>

      {/* Main Profile Header Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side: Avatar & Bio */}
        <div className="student-card p-6 md:col-span-2 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <div className="w-20 h-20 rounded-2xl bg-[var(--primary)] text-white flex items-center justify-center font-bold text-3xl shrink-0 shadow-lg">
              {student.name?.[0]?.toUpperCase()}
            </div>
            <div className="text-center sm:text-left min-w-0 space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                {student.name}
              </h2>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                <span className="flex items-center justify-center sm:justify-start gap-1">
                  <Mail className="w-3.5 h-3.5 text-[var(--primary)]" /> {student.email}
                </span>
                <span className="hidden sm:inline">•</span>
                <span className="flex items-center justify-center sm:justify-start gap-1">
                  <Phone className="w-3.5 h-3.5 text-[var(--primary)]" /> {student.phone || "No Phone"}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                <span className="flex items-center justify-center sm:justify-start gap-1 font-semibold">
                  <Building2 className="w-3.5 h-3.5" /> {student.department}
                </span>
                <span className="hidden sm:inline">•</span>
                <span className="flex items-center justify-center sm:justify-start gap-1 font-medium">
                  <GraduationCap className="w-3.5 h-3.5" /> {student.year}
                </span>
              </div>
            </div>
          </div>

          {/* Social Profiles */}
          <div className="flex flex-wrap gap-2.5 mt-6 border-t pt-4" style={{ borderColor: "var(--border)" }}>
            {student.portfolio && (
              <a
                href={student.portfolio.startsWith("http") ? student.portfolio : `https://${student.portfolio}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                <Globe className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} /> Portfolio
              </a>
            )}
            {student.github && (
              <a
                href={student.github.startsWith("http") ? student.github : `https://${student.github}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                <GithubIcon className="w-3.5 h-3.5" /> GitHub
              </a>
            )}
            {student.linkedin && (
              <a
                href={student.linkedin.startsWith("http") ? student.linkedin : `https://${student.linkedin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                <LinkedinIcon className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} /> LinkedIn
              </a>
            )}
          </div>
        </div>

        {/* Right Side: ATS Score Circular Indicator */}
        <div className="student-card p-6 flex flex-col items-center justify-center text-center">
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
            ATS Match Score
          </p>
          <div className="relative w-28 h-28 flex items-center justify-center">
            {/* SVG circular progress */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="56"
                cy="56"
                r="46"
                strokeWidth="8"
                stroke="var(--border)"
                fill="transparent"
              />
              <circle
                cx="56"
                cy="56"
                r="46"
                strokeWidth="8"
                stroke={student.atsScore >= 75 ? "var(--success)" : "var(--primary)"}
                fill="transparent"
                strokeDasharray="289"
                strokeDashoffset={289 - (289 * (student.atsScore || 0)) / 100}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                {student.atsScore || 0}%
              </span>
              <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                Match Accuracy
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
        {[
          { id: "resume", label: "Resume & Skills" },
          { id: "real", label: "Real Interviews" },
          { id: "practice", label: "Practice Runs" },
          { id: "companies", label: "Company Analytics" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className="px-5 py-3 text-xs font-semibold border-b-2 -mb-[2px] transition-all cursor-pointer"
            style={{
              borderColor: activeTab === tab.id ? "var(--primary)" : "transparent",
              color: activeTab === tab.id ? "var(--primary)" : "var(--text-muted)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="space-y-6">
        {/* Tab 1: Resume & Skills */}
        {activeTab === "resume" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="student-card p-6 md:col-span-2 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Resume Management
              </h3>
              {student.resumeFileName ? (
                <div className="flex items-center justify-between p-4 rounded-xl border bg-slate-50 dark:bg-zinc-900/50" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-7 h-7 text-[var(--primary)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate max-w-[200px]" style={{ color: "var(--text-primary)" }}>
                        {student.resumeFileName}
                      </p>
                      {student.resumeUploadedAt && (
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          Uploaded {new Date(student.resumeUploadedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadResume}
                      className="p-2 border rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                      style={{ borderColor: "var(--border)", color: "var(--primary)" }}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteResume}
                      className="p-2 border rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
                      style={{ borderColor: "var(--border)", color: "var(--error)" }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 border-2 border-dashed rounded-xl" style={{ borderColor: "var(--border)" }}>
                  <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    No resume document uploaded by student.
                  </p>
                </div>
              )}
            </div>

            {/* Right block: Skills Badges */}
            <div className="student-card p-6 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Indexed Skills
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {student.skills && student.skills.length > 0 ? (
                  student.skills.map((skill) => (
                    <span
                      key={skill}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg"
                      style={{ background: "color-mix(in srgb, var(--primary) 7%, transparent)", color: "var(--text-primary)" }}
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <p className="text-xs py-4" style={{ color: "var(--text-muted)" }}>
                    No skills cataloged.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Real AI Interviews List */}
        {activeTab === "real" && (
          <div className="space-y-4">
            {realInterviews.length === 0 ? (
              <div className="student-card p-12 text-center">
                <History className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No real mock interviews taken yet.</p>
              </div>
            ) : (
              realInterviews.map((interview) => {
                const res = interview.result;
                const isExpanded = expandedInterviewId === interview._id;
                return (
                  <div key={interview._id} className="student-card overflow-hidden">
                    {/* Header Row */}
                    <div
                      onClick={() => toggleInterviewExpand(interview._id)}
                      className="p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-zinc-900/10 select-none"
                    >
                      <div>
                        <h4 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                          AI Real Interview — Status: {interview.status.toUpperCase()}
                        </h4>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          Taken {new Date(interview.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        {res && (
                          <span className="text-sm font-extrabold px-3 py-1 rounded-full bg-[var(--primary)] text-white shadow-sm">
                            Score: {res.overallScore}%
                          </span>
                        )}
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>

                    {/* Accordion Content */}
                    {isExpanded && (
                      <div className="p-5 border-t bg-slate-50/50 dark:bg-zinc-900/10 space-y-6" style={{ borderColor: "var(--border)" }}>
                        {/* Grades Breakdowns */}
                        {res && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-3.5 border rounded-xl" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
                              <p className="text-[10px] font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Resume Score</p>
                              <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{res.resumeScore || 0}%</p>
                            </div>
                            <div className="p-3.5 border rounded-xl" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
                              <p className="text-[10px] font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Technical Score</p>
                              <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{res.technicalScore || 0}%</p>
                            </div>
                            <div className="p-3.5 border rounded-xl" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
                              <p className="text-[10px] font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Coding Score</p>
                              <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{res.codingScore || 0}%</p>
                            </div>
                          </div>
                        )}

                        {/* Strengths / Weaknesses */}
                        {res && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 border rounded-xl bg-emerald-50/20 dark:bg-emerald-950/5" style={{ borderColor: "color-mix(in srgb, var(--success) 20%, var(--border))" }}>
                              <h5 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">Strengths</h5>
                              <ul className="list-disc pl-4 text-xs space-y-1" style={{ color: "var(--text-secondary)" }}>
                                {res.strengths?.map((s, idx) => <li key={idx}>{s}</li>)}
                              </ul>
                            </div>
                            <div className="p-4 border rounded-xl bg-red-50/10 dark:bg-red-950/5" style={{ borderColor: "color-mix(in srgb, var(--error) 20%, var(--border))" }}>
                              <h5 className="text-xs font-bold text-red-500 dark:text-red-400 uppercase tracking-wider mb-2">Areas for Improvement</h5>
                              <ul className="list-disc pl-4 text-xs space-y-1" style={{ color: "var(--text-secondary)" }}>
                                {res.weaknesses?.map((w, idx) => <li key={idx}>{w}</li>)}
                              </ul>
                            </div>
                          </div>
                        )}

                        {/* Advisor Recommendation */}
                        {res && (
                          <div className="p-4 border rounded-xl" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
                            <h5 className="text-xs font-semibold uppercase text-zinc-500 tracking-wider mb-1">Recruitment Feedback Advice</h5>
                            <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{res.recommendation}</p>
                          </div>
                        )}

                        {/* Individual Chat dialogue / answers detail */}
                        <div className="space-y-4">
                          <h5 className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">Question & Answer Logs</h5>
                          {interview.answers && interview.answers.length > 0 ? (
                            interview.answers.map((ans, qIdx) => (
                              <div key={ans._id} className="p-4 rounded-xl border space-y-3" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
                                <div className="flex justify-between items-start gap-4">
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded uppercase" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>
                                    Q{qIdx + 1} • {ans.questionType}
                                  </span>
                                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                    Grade: {ans.score}%
                                  </span>
                                </div>
                                <p className="text-xs font-semibold leading-relaxed" style={{ color: "var(--text-primary)" }}>{ans.question}</p>
                                <div className="pl-3 border-l-2 py-0.5" style={{ borderColor: "var(--border)" }}>
                                  <p className="text-xs italic" style={{ color: "var(--text-secondary)" }}>{ans.answer || "[Question Skipped]"}</p>
                                </div>
                                {ans.feedback && (
                                  <div className="p-2.5 rounded-lg text-[10px]" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>
                                    <strong>AI Feedback:</strong> {ans.feedback}
                                  </div>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>No question answers logged for this session.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 3: Practice Runs */}
        {activeTab === "practice" && (
          <div className="space-y-4">
            {practiceInterviews.length === 0 ? (
              <div className="student-card p-12 text-center">
                <History className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No practice sessions logged yet.</p>
              </div>
            ) : (
              practiceInterviews.map((interview) => (
                <div key={interview._id} className="student-card p-5 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm uppercase" style={{ color: "var(--text-primary)" }}>
                      Practice Attempt — {interview.companyId || "General"}
                    </h4>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      Completed on {new Date(interview.createdAt).toLocaleString()}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                      Answered: {interview.questionsAnswered} / {interview.totalQuestions}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold px-3 py-1 rounded-full bg-[var(--primary)] text-white shadow-sm">
                      Score: {interview.overallScore}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 4: Company wise analytics */}
        {activeTab === "companies" && (
          <div className="space-y-4">
            {companyAnalytics.length === 0 ? (
              <div className="student-card p-12 text-center">
                <TrendingUp className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No company analytics recorded yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {companyAnalytics.map((c) => (
                  <div key={c.companyId} className="student-card p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ bg: c.color || "#2563EB" }}>
                        {c.companyName[0]}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{c.companyName}</h4>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{c.attempts} Practice Attempts</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 text-center border-t pt-3" style={{ borderColor: "var(--border)" }}>
                      <div>
                        <p className="text-[9px] font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Best</p>
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{c.bestScore}%</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Average</p>
                        <p className="text-sm font-bold" style={{ color: "var(--primary)" }}>{c.averageScore}%</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Latest</p>
                        <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{c.latestScore}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentDetails;
