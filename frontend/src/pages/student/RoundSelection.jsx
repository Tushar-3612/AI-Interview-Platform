import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, Code2, CheckCircle2, Award, ChevronRight, Clock, History, TrendingUp, Target, Timer } from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";

import { SkeletonCompanyDashboard, ErrorState } from "../../components/ui/Skeleton";
import { timeAgo, formatTime } from "../../utils/dateUtils";

function RoundSelection() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const token = getAuthToken();
  const [company, setCompany] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [codingProgress, setCodingProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [homeRes, historyRes, progressRes] = await Promise.all([
        api.get("/api/practice/home", { headers }),
        api.get("/api/practice/aptitude/history", { headers, params: { limit: 20 } }),
        api.get(`/api/practice/coding/progress/${companyId}`, { headers }).catch(() => ({ data: null })),
      ]);
      const list = homeRes.data?.companies || [];
      const found = list.find((c) => c.id === companyId || c._id === companyId);
      setCompany(found);
      setAttempts((historyRes.data?.attempts || []).filter((a) => a.companyId === companyId));
      setCodingProgress(progressRes.data);
    } catch (err) {
      setError(err.response?.status || "network_failure");
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const formatLastUpdated = (dateVal) => {
    if (!dateVal) return "Updated recently";
    const date = new Date(dateVal);
    if (isNaN(date.getTime())) return "Updated recently";
    
    const now = new Date();
    const dDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = dNow - dDate;
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    
    if (diffDays === 0) return "Updated Today";
    if (diffDays === 1) return "Updated Yesterday";
    if (diffDays > 1 && diffDays < 15) return `Updated ${diffDays} Days Ago`;
    return `Updated ${date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}`;
  };

  if (loading) {
    return <SkeletonCompanyDashboard />;
  }

  if (error || !company) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16" style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
        <ErrorState
          statusCode={error}
          message="Failed to load company details."
          onRetry={fetchData}
          onGoBack={() => navigate("/interview-practice")}
        />
      </div>
    );
  }

  const latestAttempt = attempts[0];
  const bestAttempt = attempts.reduce((best, a) => (!best || a.percentage > best.percentage ? a : best), null);

  const roundsConfig = [
    {
      id: "aptitude",
      title: "Aptitude Round",
      desc: "MCQs testing Quantitative, Logical, and Verbal reasoning. Select count and difficulty.",
      icon: BookOpen,
      path: `/interview-practice/${companyId}/aptitude`,
      attempts: attempts.length,
      bestScore: bestAttempt ? `${bestAttempt.score} / ${bestAttempt.questionCount} (${bestAttempt.percentage}%)` : null,
      accent: "#FF9800",
      accentBg: "rgba(255, 152, 0, 0.08)",
      accentBorder: "rgba(255, 152, 0, 0.2)",
    },
    {
      id: "coding",
      title: "Coding Round",
      desc: "Solve algorithmic problems in multiple languages. Tested against hidden test cases.",
      icon: Code2,
      path: `/interview-practice/${companyId}/coding`,
      completedCount: codingProgress?.completedCount || 0,
      totalCount: codingProgress?.totalCount || company?.codingCount || 0,
      remainingCount: codingProgress?.remainingCount ?? (codingProgress?.totalCount || company?.codingCount || 0),
      accent: "#4DA3FF",
      accentBg: "rgba(77, 163, 255, 0.08)",
      accentBorder: "rgba(77, 163, 255, 0.2)",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12" style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      {/* Back Button */}
      <button
        type="button"
        onClick={() => navigate("/interview-practice")}
        className="flex items-center gap-2 text-sm font-medium mb-6 cursor-pointer transition hover:opacity-80"
        style={{ color: "var(--text-secondary)" }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Companies
      </button>

      {/* ── Company Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 rounded-[20px] border transition-all duration-300"
        style={{
          background: "var(--card-bg)",
          borderColor: company.color ? `${company.color}30` : "var(--border)",
          boxShadow: company.color ? `0 8px 32px ${company.color}12, 0 0 0 1px ${company.color}10` : "var(--shadow-card, 0 4px 20px rgba(0,0,0,0.08))",
        }}
      >
        <div className="flex items-center gap-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl overflow-hidden shrink-0"
            style={{
              background: company.color,
              boxShadow: `0 8px 24px ${company.color}40`,
            }}
          >
            {company.logo ? (
              <img src={company.logo} alt={company.name} className="w-full h-full object-cover" />
            ) : (
              company.name[0]
            )}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
              {company.name} Interview Prep
            </h1>
            <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {company.description || "Complete both assessment rounds to get comprehensive performance feedback."}
            </p>
            <div className="flex items-center gap-3 mt-3 text-xs flex-wrap" style={{ color: "var(--text-muted)" }}>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {formatLastUpdated(company.lastUpdated)}
              </span>
              {company.package && (
                <>
                  <span style={{ color: "var(--border)" }}>·</span>
                  <span>{company.package}</span>
                </>
              )}
              {company.difficulty && (
                <>
                  <span style={{ color: "var(--border)" }}>·</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                    style={{
                      background: company.difficulty === "Easy" ? "rgba(34,197,94,0.1)" : company.difficulty === "Hard" ? "rgba(239,68,68,0.1)" : "rgba(234,179,8,0.1)",
                      color: company.difficulty === "Easy" ? "#22c55e" : company.difficulty === "Hard" ? "#ef4444" : "#eab308",
                    }}
                  >
                    {company.difficulty}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Last Attempt Section ── */}
      {latestAttempt && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 rounded-[20px] border overflow-hidden"
          style={{
            background: "var(--card-bg)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-card, 0 4px 20px rgba(0,0,0,0.06))",
          }}
        >
          {/* Section header */}
          <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
            <TrendingUp className="w-4 h-4" style={{ color: "#FF6B35" }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Last Attempt
            </span>
          </div>

          {/* Score grid */}
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Score */}
              <div className="flex flex-col items-center sm:items-start p-3 rounded-xl" style={{ background: "var(--bg-primary)" }}>
                <span className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Score</span>
                <span className="text-2xl font-black" style={{ color: "#FF6B35" }}>
                  {latestAttempt.percentage}%
                </span>
              </div>

              {/* Correct */}
              <div className="flex flex-col items-center sm:items-start p-3 rounded-xl" style={{ background: "var(--bg-primary)" }}>
                <span className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Correct</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
                    {latestAttempt.score}
                  </span>
                  <span className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
                    / {latestAttempt.questionCount}
                  </span>
                </div>
              </div>

              {/* Time */}
              <div className="flex flex-col items-center sm:items-start p-3 rounded-xl" style={{ background: "var(--bg-primary)" }}>
                <span className="text-[10px] font-semibold uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                  <Timer className="w-3 h-3" /> Time
                </span>
                <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  {formatTime(latestAttempt.timeTaken)}
                </span>
              </div>

              {/* When */}
              <div className="flex flex-col items-center sm:items-start p-3 rounded-xl" style={{ background: "var(--bg-primary)" }}>
                <span className="text-[10px] font-semibold uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                  <Clock className="w-3 h-3" /> When
                </span>
                <span className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                  {timeAgo(latestAttempt.createdAt)}
                </span>
              </div>
            </div>

            {/* Continue Practice button */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => navigate(`/interview-practice/${companyId}/aptitude`)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(135deg, rgb(170, 107, 228), #3B82F6)",
                  boxShadow: "0 4px 16px rgba(170, 107, 228, 0.3)",
                }}
              >
                Continue Practice
                <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Round Selection Cards ── */}
      <div className="space-y-4 mb-8">
        {roundsConfig.map((r, i) => {
          const Icon = r.icon;
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-[20px] border overflow-hidden transition-all duration-300"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-card, 0 4px 20px rgba(0,0,0,0.06))",
              }}
            >
              {/* Accent top strip */}
              <div className="h-1" style={{ background: r.accent }} />

              <div className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                <div className="flex items-start gap-4 min-w-0">
                  {/* Icon */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: r.accentBg, border: `1px solid ${r.accentBorder}` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: r.accent }} />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-bold text-sm sm:text-base" style={{ color: "var(--text-primary)" }}>
                        {r.title}
                      </h3>
                      {((r.id === "aptitude" && r.attempts > 0) || (r.id === "coding" && r.completedCount > 0)) && (
                        <span
                          className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: "rgba(34,197,94,0.1)", color: "#22C55E" }}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Attempted
                        </span>
                      )}
                    </div>

                    <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {r.desc}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 mt-2.5">
                      {/* Progress for coding round */}
                      {r.id === "coding" ? (
                        <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                          <CheckCircle2 className="w-3 h-3" style={{ color: r.completedCount > 0 ? "#22C55E" : undefined }} />
                          {r.completedCount} / {r.totalCount} Completed • {r.remainingCount} Remaining
                        </span>
                      ) : (
                        <>
                          <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                            <History className="w-3 h-3" />
                            {r.attempts} attempt{r.attempts === 1 ? "" : "s"}
                          </span>

                          {/* Best score */}
                          {r.bestScore && (
                            <span
                              className="flex items-center gap-1 text-[11px] font-bold"
                              style={{ color: r.accent }}
                            >
                              <Target className="w-3 h-3" />
                              Best: {r.bestScore}
                            </span>
                          )}
                        </>
                      )}

                      {/* Progress bar if attempts exist for aptitude */}
                      {r.id === "aptitude" && bestAttempt && (
                        <div className="flex items-center gap-2 flex-1 min-w-[120px] max-w-[200px]">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${bestAttempt.percentage}%`,
                                background: `linear-gradient(90deg, ${r.accent}CC, ${r.accent})`,
                                boxShadow: `0 0 6px ${r.accent}44`,
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-bold" style={{ color: r.accent }}>
                            {bestAttempt.percentage}%
                          </span>
                        </div>
                      )}

                      {/* Progress bar for coding round */}
                      {r.id === "coding" && r.totalCount > 0 && (
                        <div className="flex items-center gap-2 flex-1 min-w-[120px] max-w-[200px]">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${Math.round((r.completedCount / r.totalCount) * 100)}%`,
                                background: `linear-gradient(90deg, ${r.accent}CC, ${r.accent})`,
                                boxShadow: `0 0 6px ${r.accent}44`,
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-bold" style={{ color: r.accent }}>
                            {Math.round((r.completedCount / r.totalCount) * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action button */}
                <div className="shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => navigate(r.path)}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                      background: r.id === "aptitude"
                        ? "linear-gradient(135deg, #FF9800, #FF6B35)"
                        : "linear-gradient(135deg, #4DA3FF, #38BDF8)",
                      color: "#FFFFFF",
                      boxShadow: r.id === "aptitude"
                        ? "0 4px 14px rgba(255, 152, 0, 0.3)"
                        : "0 4px 14px rgba(77, 163, 255, 0.3)",
                    }}
                  >
                    {r.id === "coding"
                      ? (r.completedCount > 0 ? "Practice Again" : "Start Round")
                      : (r.attempts > 0 ? "Practice Again" : "Start Round")}
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Keep Going Card ── */}
      {attempts.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 rounded-[20px] border border-dashed flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left"
          style={{
            borderColor: "rgb(170, 107, 228)",
            background: "color-mix(in srgb, rgb(170, 107, 228) 3%, var(--card-bg))",
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(255, 152, 0, 0.1)", border: "1px solid rgba(255, 152, 0, 0.2)" }}
            >
              <Award className="w-6 h-6" style={{ color: "#FF9800" }} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base" style={{ color: "var(--text-primary)" }}>Keep Going!</h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                You have {attempts.length} aptitude attempts for {company.name}. Consistency builds placement readiness.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/practice/aptitude/history")}
            className="flex items-center gap-1.5 text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: "linear-gradient(135deg, rgb(170, 107, 228), #3B82F6)",
              color: "#FFFFFF",
              boxShadow: "0 4px 14px rgba(170, 107, 228, 0.3)",
            }}
          >
            View History
            <ChevronRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </div>
  );
}

export default RoundSelection;
