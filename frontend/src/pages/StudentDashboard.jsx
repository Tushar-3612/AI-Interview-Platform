import { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Calendar,
  Briefcase,
  TrendingUp,
  CheckCircle2,
  ArrowUpRight,
  Sparkles,
  Loader2,
} from "lucide-react";
import api from "../utils/api";
import { getAuthToken } from "../hooks/useStudentProfile";

function StudentDashboard() {
  const { profile } = useOutletContext();
  const navigate = useNavigate();
  const token = getAuthToken();

  const [interviews, setInterviews] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [interviewsRes, resultsRes] = await Promise.all([
          api.get("/api/student/interviews", { headers }),
          api.get("/api/student/results", { headers }),
        ]);
        setInterviews(interviewsRes.data || []);
        setResults(resultsRes.data || []);
      } catch {
        // data stays empty
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const completedInterviews = interviews.filter((i) => i.status === "completed");
  const totalCompleted = completedInterviews.length;
  const averageScore =
    results.length > 0
      ? (results.reduce((acc, r) => acc + (r.overallScore || 0), 0) / results.length).toFixed(1)
      : null;

  const formatDate = (d) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const latestResults = results.slice(0, 5);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">

      <div className="flex-1 p-4 sm:p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto w-full">

        {/* Welcome Banner */}
        <section className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-[var(--shadow-lg)]">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-60 h-60 rounded-full bg-white/5 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-20 w-80 h-80 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="max-w-[620px]">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white border border-white/10 text-xs font-semibold mb-4 backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                <span>Student Dashboard</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Welcome back, {profile?.name || "Student"}!
              </h2>
              <p className="mt-2 text-sm text-blue-100/90 leading-relaxed max-w-lg">
                Track your interview progress, review AI feedback, and keep preparing for your
                placement journey.
              </p>
            </div>
            <div className="shrink-0 flex flex-wrap gap-3">
              <button
                onClick={() => navigate("/interview-practice")}
                className="px-5 py-2.5 rounded-xl bg-white text-blue-700 font-bold text-xs hover:bg-blue-50 shadow-sm transition-all duration-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Start New Interview</span>
              </button>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">

              <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 shadow-[var(--shadow-sm)] flex items-center justify-between hover:border-[var(--primary)]/30 transition-all duration-300">
                <div className="space-y-2">
                  <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider block">
                    Interviews Completed
                  </span>
                  <span className="text-3xl font-extrabold tracking-tight">{totalCompleted}</span>
                  <span className="text-[11px] text-[var(--text-secondary)] font-medium">
                    Total mock sessions finished
                  </span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-[var(--primary)] flex items-center justify-center shadow-inner">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 shadow-[var(--shadow-sm)] flex items-center justify-between hover:border-[var(--primary)]/30 transition-all duration-300">
                <div className="space-y-2">
                  <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider block">
                    Average AI Score
                  </span>
                  <div className="flex items-baseline gap-1">
                    {averageScore !== null ? (
                      <>
                        <span className="text-3xl font-extrabold tracking-tight">{averageScore}</span>
                        <span className="text-sm font-semibold text-[var(--text-secondary)]">/ 100</span>
                      </>
                    ) : (
                      <span className="text-lg font-semibold text-[var(--text-secondary)]">--</span>
                    )}
                  </div>
                  <div className="w-24 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                    {averageScore !== null && (
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                        style={{ width: `${Math.min(averageScore, 100)}%` }}
                      />
                    )}
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-inner">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 shadow-[var(--shadow-sm)] flex items-center justify-between hover:border-[var(--primary)]/30 transition-all duration-300">
                <div className="space-y-2">
                  <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider block">
                    ATS Score
                  </span>
                  {profile?.atsScore ? (
                    <>
                      <span className="text-3xl font-extrabold tracking-tight">{profile.atsScore}</span>
                      <span className="text-sm font-semibold text-[var(--text-secondary)]">/ 100</span>
                    </>
                  ) : (
                    <span className="text-lg font-semibold text-[var(--text-secondary)]">--</span>
                  )}
                  <span className="text-[11px] text-[var(--text-secondary)] font-medium">
                    {profile?.atsScore ? "Resume AI score" : "Upload a resume to get scored"}
                  </span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shadow-inner">
                  <Briefcase className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 shadow-[var(--shadow-sm)] flex items-center justify-between hover:border-[var(--primary)]/30 transition-all duration-300">
                <div className="space-y-2">
                  <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider block">
                    Skills Added
                  </span>
                  <span className="text-3xl font-extrabold tracking-tight">
                    {profile?.skills?.length || 0}
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)] font-medium">
                    {profile?.skills?.length ? "Technical skills on profile" : "Add skills in your profile"}
                  </span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shadow-inner">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>

            </section>

            {/* Recent Results */}
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-5 sm:p-6 shadow-[var(--shadow-sm)]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">
                    Recent Interview Results
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    AI-evaluated performance from your latest sessions
                  </p>
                </div>
                {results.length > 0 && (
                  <button
                    onClick={() => navigate("/results")}
                    className="text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    View All
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {latestResults.length === 0 ? (
                <div className="py-16 text-center">
                  <TrendingUp className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                  <p style={{ color: "var(--text-secondary)" }} className="text-sm">
                    No results yet.
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Complete an interview to see your AI-evaluated scores here.
                  </p>
                  <button
                    onClick={() => navigate("/interview-practice")}
                    className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
                    style={{ background: "var(--primary)" }}
                  >
                    Start First Interview
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {latestResults.map((result, idx) => (
                    <motion.div
                      key={result._id || idx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="border border-[var(--border)] rounded-2xl p-4 flex items-center justify-between gap-4 bg-[var(--bg-primary)]/20 hover:bg-[var(--bg-secondary)] transition-all duration-200"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            background:
                              (result.overallScore || 0) >= 70
                                ? "color-mix(in srgb, var(--success) 10%, transparent)"
                                : "color-mix(in srgb, var(--error) 10%, transparent)",
                          }}
                        >
                          <CheckCircle2
                            className="w-5 h-5"
                            style={{
                              color:
                                (result.overallScore || 0) >= 70
                                  ? "var(--success)"
                                  : "var(--error)",
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          <p
                            className="font-semibold text-sm truncate"
                            style={{ color: "var(--text-primary)" }}
                          >
                            Interview #{result.interviewId?.slice(-6) || idx + 1}
                          </p>
                          <p
                            className="text-xs flex items-center gap-1 mt-0.5"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            {result.createdAt ? formatDate(result.createdAt) : "Recently"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-bold" style={{ color: "var(--primary)" }}>
                            {result.overallScore || 0}%
                          </p>
                          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            Overall Score
                          </p>
                        </div>
                        <button
                          onClick={() => navigate("/results")}
                          className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--border)]/30 text-[var(--text-secondary)] cursor-pointer transition-all"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Interviews */}
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-5 sm:p-6 shadow-[var(--shadow-sm)]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">
                    Interview Sessions
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    All your mock interview sessions
                  </p>
                </div>
                {interviews.length > 0 && (
                  <button
                    onClick={() => navigate("/interview-history")}
                    className="text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    View All
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {interviews.length === 0 ? (
                <div className="py-16 text-center">
                  <Briefcase className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                  <p style={{ color: "var(--text-secondary)" }} className="text-sm">
                    No interviews yet.
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Start your first mock interview practice session.
                  </p>
                  <button
                    onClick={() => navigate("/interview-practice")}
                    className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
                    style={{ background: "var(--primary)" }}
                  >
                    Start Interview
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {interviews.map((item, idx) => (
                    <motion.div
                      key={item._id || idx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="border border-[var(--border)] rounded-2xl p-4 flex items-center justify-between gap-4 bg-[var(--bg-primary)]/20 hover:bg-[var(--bg-secondary)] transition-all duration-200"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            background:
                              item.status === "completed"
                                ? "color-mix(in srgb, var(--success) 10%, transparent)"
                                : item.status === "in_progress"
                                  ? "color-mix(in srgb, var(--primary) 10%, transparent)"
                                  : "color-mix(in srgb, var(--text-muted) 10%, transparent)",
                          }}
                        >
                          <Briefcase
                            className="w-5 h-5"
                            style={{
                              color:
                                item.status === "completed"
                                  ? "var(--success)"
                                  : item.status === "in_progress"
                                    ? "var(--primary)"
                                    : "var(--text-muted)",
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          <p
                            className="font-semibold text-sm truncate"
                            style={{ color: "var(--text-primary)" }}
                          >
                            Interview #{item._id?.slice(-6) || idx + 1}
                          </p>
                          <p
                            className="text-xs flex items-center gap-1 mt-0.5"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            {item.createdAt ? formatDate(item.createdAt) : "Recently"}
                            <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase"
                              style={{
                                color:
                                  item.status === "completed"
                                    ? "var(--success)"
                                    : item.status === "in_progress"
                                      ? "var(--primary)"
                                      : "var(--text-muted)",
                                background:
                                  item.status === "completed"
                                    ? "color-mix(in srgb, var(--success) 8%, transparent)"
                                    : item.status === "in_progress"
                                      ? "color-mix(in srgb, var(--primary) 8%, transparent)"
                                      : "transparent",
                              }}
                            >
                              {item.status === "in_progress" ? "In Progress" : item.status}
                            </span>
                          </p>
                        </div>
                      </div>

                      {item.status === "completed" && (
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold" style={{ color: "var(--primary)" }}>
                            {item.overallScore || "--"}
                          </p>
                          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            Score
                          </p>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <footer className="py-6 border-t border-[var(--border)] bg-[var(--bg-secondary)] text-center text-xs text-[var(--text-secondary)] mt-auto">
        <p>&copy; 2026 AI Interview Platform. Designed for premium college placement training.</p>
      </footer>
    </div>
  );
}

export default StudentDashboard;
