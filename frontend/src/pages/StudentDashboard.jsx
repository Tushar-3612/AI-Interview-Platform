import { useState, useEffect, useCallback } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Briefcase,
  ArrowUpRight,
  ArrowRight,
  Code2,
  Flame,
  Building2,
  Trophy,
  Clock,
  BrainCircuit,
  CheckCircle,
  X,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../utils/api";
import { getAuthToken } from "../hooks/useStudentProfile";
import { SkeletonStudentDashboard, ErrorState } from "../components/ui/Skeleton";
import AnimatedProgressBar from "../components/ui/AnimatedProgressBar";
import { CAREER_QUOTES } from "../data/careerQuotes";

/**
 * Circular progress ring component for Placement Readiness.
 */
function CircularProgress({ value = 85, size = 135, stroke = 12, color = "#FF6B35" }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - ((value || 0) / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center select-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--border)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
          style={{
            transition: "stroke 250ms ease, stroke-dashoffset 250ms ease",
            filter: `drop-shadow(0 0 6px ${color}44)`,
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-black tracking-tight" style={{ color: value != null ? color : "var(--text-primary)", transition: "color 250ms ease" }}>
          {value != null ? `${value}%` : "--"}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "var(--text-muted)" }}>
          Readiness
        </span>
      </div>
    </div>
  );
}

function StudentDashboard() {
  const { profile, openInterviewModal } = useOutletContext();
  const navigate = useNavigate();
  const token = getAuthToken();

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [placementData, setPlacementData] = useState(null);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [assignedTests, setAssignedTests] = useState([]);

  // 10-second Quote Auto-Rotator (50 messages, smooth opacity fade only)
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % CAREER_QUOTES.length);
    }, 10000); // Exactly 10 seconds
    return () => clearInterval(timer);
  }, []);

  const currentQuote = CAREER_QUOTES[quoteIndex] || CAREER_QUOTES[0];

  const fetchData = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [resultsRes, analyticsRes, placementRes, statsRes, testsRes] = await Promise.all([
        api.get("/api/student/results", { headers }).catch(() => ({ data: [] })),
        api.get("/api/practice/analytics/student", { headers }).catch(() => null),
        api.get("/api/placement/overview", { headers }).catch(() => null),
        api.get("/api/student/dashboard-stats", { headers }).catch(() => null),
        api.get("/api/student/tests", { headers }).catch(() => ({ data: [] })),
      ]);
      setResults(resultsRes.data || []);
      setAnalytics(analyticsRes?.data || null);
      setPlacementData(placementRes?.data || null);
      setDashboardStats(statsRes?.data || null);
      setAssignedTests(testsRes.data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.status || "network_failure");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  // Real data from dashboard stats API
  const interviewsCompleted = dashboardStats?.interviewsCompleted ?? null;
  const mockInterviewsCompleted = dashboardStats?.mockInterviewsCompleted ?? null;
  const mockInterviewsInProgress = dashboardStats?.mockInterviewsInProgress ?? null;
  const codingProblemsSolved = dashboardStats?.codingProblemsSolved ?? null;
  const currentStreakDays = dashboardStats?.currentStreak ?? null;
  const userRank = dashboardStats?.rank ?? null;
  const targetCompany = dashboardStats?.targetCompany || null;
  const companies = dashboardStats?.companies || [];
  const companyMock = dashboardStats?.companyMock || null;
  
  // Target company modal state
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [isUpdatingCompany, setIsUpdatingCompany] = useState(false);

  const realAverageScore =
    results.length > 0
      ? (results.reduce((acc, r) => acc + (r.overallScore || 0), 0) / results.length).toFixed(0) + "%"
      : null;

  // 6 Dashboard Metric Cards
  const metricCards = [
    {
      id: "interviews",
      title: "Interviews Completed",
      value: interviewsCompleted !== null ? interviewsCompleted : "--",
      subtext: interviewsCompleted !== null ? "Actual interviews completed" : "No Data",
      color: "#FF6B35",
      icon: Briefcase,
      onClick: () => navigate("/interview-history?tab=actual"),
    },
    {
      id: "mock-interviews",
      title: "Mock Interviews",
      value: mockInterviewsCompleted !== null ? mockInterviewsCompleted : "--",
      subtext: mockInterviewsInProgress !== null 
        ? `${mockInterviewsCompleted || 0} completed • ${mockInterviewsInProgress} in progress`
        : (mockInterviewsCompleted !== null ? `${mockInterviewsCompleted} completed` : "No Data"),
      color: "#8B5CF6",
      icon: BrainCircuit,
      onClick: () => navigate("/company-mock"),
    },
    {
      id: "coding",
      title: "Coding Problems Solved",
      value: codingProblemsSolved !== null ? codingProblemsSolved : "--",
      subtext: codingProblemsSolved !== null ? "Problems accepted" : "No Data",
      color: "#10B981",
      icon: Code2,
    },
    {
      id: "streak",
      title: "Current Streak",
      value: currentStreakDays !== null ? `${currentStreakDays} Days` : "--",
      subtext: currentStreakDays !== null ? "Daily practice" : "No Data",
      color: "#F59E0B",
      icon: Flame,
    },
    {
      id: "rank",
      title: "Rank",
      value: userRank !== null ? `#${userRank}` : "--",
      subtext: userRank !== null ? "Global rank" : "No Data",
      color: "#EC4899",
      icon: Trophy,
    },
    {
      id: "target",
      title: "Target Company",
      value: targetCompany || "Not Set",
      subtext: targetCompany ? "Your goal" : "Click to set",
      color: "#38BDF8",
      icon: Building2,
      onClick: () => setShowCompanyModal(true),
    },
  ];

  const formatDate = (d) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getScoreColor = (score) => {
    if (score == null || score === "--") return "var(--text-primary)";
    const n = Number(score);
    if (n >= 80) return "#16A34A";
    if (n >= 60) return "#F59E0B";
    if (n >= 45) return "#F97316";
    return "#E73F1E";
  };

  const getReadinessStatus = (score) => {
    if (score == null || score === "--") return null;
    const n = Number(score);
    if (n >= 85) return "Placement Ready";
    if (n >= 70) return "Good Progress";
    if (n >= 50) return "Needs Practice";
    return "Getting Started";
  };

  const handleUpdateTargetCompany = async (companyId) => {
    setIsUpdatingCompany(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await api.put("/api/student/target-company", { targetCompany: companyId }, { headers });
      // Refresh dashboard stats
      const statsRes = await api.get("/api/student/dashboard-stats", { headers });
      setDashboardStats(statsRes?.data || null);
      setShowCompanyModal(false);
    } catch (error) {
      console.error("Update target company error:", error);
    } finally {
      setIsUpdatingCompany(false);
    }
  };

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(companySearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300">
      <div className="p-8 max-w-[1440px] mx-auto w-full space-y-6">

        {/* ── HERO SECTION — 40% text / 25% mountain / 35% card ── */}
        <section className="relative bg-[var(--card-bg)] border border-[var(--border)] rounded-[24px] p-6 sm:p-8 lg:px-10 lg:py-12 shadow-[var(--shadow-card)] overflow-hidden min-h-[400px]">
          
          {/* Mountain illustration — CENTERED between text and card */}
         <div
    className="absolute inset-0 pointer-events-none overflow-hidden"
    style={{ zIndex: 0 }}
>

    {/* Light Theme */}
    <img
        src="/images/light.png"
        alt=""
        className="mountain-light absolute transition-opacity duration-300"
        style={{
            left: "29%",
            bottom: "0",
            width: "52%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center bottom",
            opacity: 0.92,
            userSelect: "none",
            filter: "brightness(1.02) contrast(1.08) saturate(1.1)",
        }}
    />

    {/* Light Theme — left-to-center text readability gradient */}
    <div className="hero-light-text-gradient" />

    {/* Light Theme — right-side card readability gradient */}
    <div className="hero-light-card-gradient" />

    {/* Dark Theme */}
    <img
        src="/images/dark.png"
        alt=""
        className="mountain-dark absolute transition-opacity duration-300"
        style={{
            left: "29%",
            bottom: "0",
            width: "52%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center bottom",
            opacity: 0.90,
            userSelect: "none",
            filter: "brightness(0.85) contrast(1.15) saturate(1.2)",
        }}
    />

    {/* Dark Theme — left-to-center text readability gradient */}
    <div className="hero-dark-text-gradient" />

    {/* Dark Theme — right-side card readability gradient */}
    <div className="hero-dark-card-gradient" />

</div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center h-full">
            
            {/* LEFT — Text Content (~40%) */}
            <div className="lg:col-span-5 flex flex-col justify-between" style={{ minHeight: "320px" }}>
              
              {/* Quote block — fixed height to prevent CTA button shift */}
              <div style={{ minHeight: "200px" }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentQuote.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                    className="space-y-4"
                  >
                    <h1 
                      className="text-3xl sm:text-4xl lg:text-[44px] font-black tracking-tight leading-[1.15]"
                      style={{ color: "var(--text-primary)", maxWidth: "540px" }}
                    >
                      {currentQuote.highlight
                        ? currentQuote.heading.split(currentQuote.highlight).map((part, i, arr) => (
                            <span key={i}>
                              {part}
                              {i < arr.length - 1 && (
                                <span style={{ color: "#FF9800" }}>{currentQuote.highlight}</span>
                              )}
                            </span>
                          ))
                        : currentQuote.heading}
                    </h1>
                    <p 
                      className="text-sm sm:text-base font-normal leading-relaxed line-clamp-2" 
                      style={{ color: "var(--text-secondary)", maxWidth: "480px" }}
                    >
                      {currentQuote.subtext}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* CTA Buttons — pinned to bottom of left column */}
              <div className="flex flex-wrap items-center gap-4 mt-auto">
                <motion.button
                  onClick={async () => {
                    const toastId = toast.loading("Creating Real Interview Session...");
                    try {
                      const { data } = await api.post(
                        "/api/interview/start",
                        { interviewType: "actual" },
                        { headers: { Authorization: `Bearer ${token}` } }
                      );
                      const sessionId = data.sessionId || data.interviewId;
                      if (sessionId) {
                        toast.success("Interview Session created!", { id: toastId });
                        window.open(`/interview/${sessionId}`, "_blank");
                      } else {
                        throw new Error("No session ID returned");
                      }
                    } catch (err) {
                      console.error("Start interview error:", err);
                      toast.error(err.response?.data?.message || "Failed to start interview session", { id: toastId });
                    }
                  }}
                  className="px-6 py-3.5 rounded-2xl text-sm font-bold text-white cursor-pointer shadow-md flex items-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)",
                    boxShadow: "0 6px 20px rgba(255, 107, 53, 0.3)",
                    transition: "all 220ms ease",
                  }}
                  whileHover={{ y: -2, boxShadow: "0 8px 28px rgba(255, 107, 53, 0.45)" }}
                  whileTap={{ y: 0 }}
                >
                  <span>Start Interview</span>
                  <ArrowRight className="w-4 h-4" />
                </motion.button>

                <motion.button
                  onClick={() => navigate("/company-mock")}
                  className="px-6 py-3.5 rounded-2xl text-sm font-bold cursor-pointer flex items-center gap-2"
                  style={{
                    borderColor: "#8B5CF6",
                    color: "#8B5CF6",
                    background: "transparent",
                    border: "1px solid #8B5CF6",
                    transition: "all 220ms ease",
                  }}
                  whileHover={{
                    y: -2,
                    backgroundColor: "rgba(139, 92, 246, 0.10)",
                    boxShadow: "0 4px 16px rgba(139, 92, 246, 0.20)",
                  }}
                  whileTap={{ y: 0 }}
                >
                  <span>Start Mock Interview</span>
                  <ArrowRight className="w-4 h-4" />
                </motion.button>

                <motion.button
                  onClick={() => navigate("/placement/performance")}
                  className="px-6 py-3.5 rounded-2xl text-sm font-bold cursor-pointer flex items-center gap-2"
                  style={{
                    borderColor: "#E73F1E",
                    color: "#E73F1E",
                    background: "transparent",
                    border: "1px solid #E73F1E",
                    transition: "all 220ms ease",
                  }}
                  whileHover={{
                    y: -2,
                    backgroundColor: "rgba(231, 63, 30, 0.10)",
                    boxShadow: "0 4px 16px rgba(231, 63, 30, 0.20)",
                  }}
                  whileTap={{ y: 0 }}
                >
                  <span>View My Progress</span>
                  <ArrowUpRight className="w-4 h-4" />
                </motion.button>
              </div>
            </div>

            {/* RIGHT — Placement Readiness Card (~35%, overlapping mountain right edge) */}
            <div className="lg:col-span-7 flex lg:justify-end lg:pr-4">
              <div 
                className="w-full max-w-[330px] bg-[var(--card-bg)] border border-[var(--border)] rounded-[24px] p-6 shadow-[var(--shadow-card)] space-y-5 relative z-20"
                style={{ background: "var(--card-bg)" }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                    Placement Readiness
                  </h3>
                </div>

                {/* Circular Progress & Score Breakdown */}
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  <div className="shrink-0">
                    {(() => {
                      const readiness = placementData?.scores?.overall ?? null;
                      const readinessColor = getScoreColor(readiness);
                      const status = getReadinessStatus(readiness);
                      return (
                        <div className="flex flex-col items-center gap-1.5">
                          <CircularProgress value={readiness} size={130} stroke={12} color={readinessColor} />
                          {status && (
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: readinessColor, transition: "background 250ms ease" }} />
                              <span className="text-[11px] font-semibold" style={{ color: readinessColor, transition: "color 250ms ease" }}>{status}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="w-full space-y-2.5 flex-1">
                    {[
                      { label: "Resume Score", value: placementData?.scores?.resume != null ? `${placementData.scores.resume}%` : (profile?.atsScore != null ? `${profile.atsScore}%` : "--"), raw: placementData?.scores?.resume ?? profile?.atsScore },
                      { label: "Coding Score", value: placementData?.scores?.coding != null ? `${placementData.scores.coding}%` : (analytics?.codingAvg != null ? `${analytics.codingAvg}%` : "--"), raw: placementData?.scores?.coding ?? analytics?.codingAvg },
                      { label: "Interview Score", value: realAverageScore || "--", raw: realAverageScore ? parseFloat(realAverageScore) : null },
                      { label: "Aptitude Score", value: placementData?.scores?.aptitude != null ? `${placementData.scores.aptitude}%` : (analytics?.aptitudeAvg != null ? `${analytics.aptitudeAvg}%` : "--"), raw: placementData?.scores?.aptitude ?? analytics?.aptitudeAvg },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center justify-between text-xs font-semibold">
                        <span style={{ color: "var(--text-secondary)" }}>{s.label}</span>
                        <span className="font-bold" style={{ color: getScoreColor(s.raw), transition: "color 250ms ease" }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 6 DASHBOARD STAT CARDS ── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {metricCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                onClick={card.onClick}
                className={`bg-[var(--card-bg)] border border-[var(--border)] rounded-[24px] p-5 shadow-[var(--shadow-sm)] flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-md)] ${card.onClick ? 'cursor-pointer' : ''}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div 
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: `color-mix(in srgb, ${card.color} 12%, transparent)`,
                        color: card.color,
                      }}
                    >
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                  </div>

                  <p className="text-xs font-semibold truncate" style={{ color: "var(--text-secondary)" }}>
                    {card.title}
                  </p>
                  <p className="text-2xl font-black mt-1 tracking-tight" style={{ color: "var(--text-primary)" }}>
                    {card.value}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--border)]">
                  <span className="text-[10px] font-semibold truncate" style={{ color: "var(--text-muted)" }}>
                    {card.subtext}
                  </span>
                </div>
              </div>
            );
          })}
        </section>

        {/* ── COMPANY MOCK INTERVIEWS ── */}
        {companyMock && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  Company Mock Interviews
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Your company-specific mock interview performance
                </p>
              </div>
              <button
                onClick={() => navigate("/company-mock/history")}
                className="text-xs font-bold flex items-center gap-1 cursor-pointer hover:underline"
                style={{ color: "#8B5CF6" }}
              >
                View Mock Results <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: "Completed", value: companyMock.completed, color: "#8B5CF6" },
                { label: "Best Score", value: companyMock.bestScore != null ? `${companyMock.bestScore}%` : "--", color: "#10B981" },
                { label: "Latest Score", value: companyMock.latestScore != null ? `${companyMock.latestScore}%` : "--", color: "#FF6B35" },
                { label: "Questions Solved", value: companyMock.questionsSolved, color: "#38BDF8" },
                { label: "Coding Solved", value: companyMock.codingProblemsSolved, color: "#EC4899" },
                { label: "Latest Company", value: companyMock.latestCompany || "--", color: "#F59E0B" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="bg-[var(--card-bg)] border border-[var(--border)] rounded-[24px] p-5 shadow-[var(--shadow-sm)] flex flex-col justify-between"
                >
                  <p className="text-xs font-semibold truncate" style={{ color: "var(--text-secondary)" }}>
                    {s.label}
                  </p>
                  <p className="text-xl font-black mt-1 tracking-tight truncate" style={{ color: "var(--text-primary)" }}>
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            {companyMock.recent?.length > 0 && (
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-[24px] p-6 shadow-[var(--shadow-card)]">
                <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text-primary)" }}>
                  Recent Mock Interviews
                </h3>
                <div className="space-y-3">
                  {companyMock.recent.map((m) => (
                    <button
                      key={m.attemptId}
                      onClick={() => navigate(`/company-mock?result=${m.attemptId}`)}
                      className="w-full flex items-center justify-between p-4 rounded-2xl border text-left cursor-pointer transition-colors hover:bg-[var(--bg-primary)]"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0"
                          style={{ background: "#8B5CF6" }}
                        >
                          {(m.companyName || "M")[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                            {m.companyName}
                          </p>
                          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {new Date(m.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black" style={{ color: getScoreColor(m.overallScore) }}>
                          {m.overallScore}%
                        </span>
                        <ArrowUpRight className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {loading ? (
          <SkeletonStudentDashboard />
        ) : error ? (
          <ErrorState statusCode={error} onRetry={handleRetry} />
        ) : (
          <>
            {/* ── UPCOMING TESTS ── */}
            <section className="bg-[var(--card-bg)] border border-[var(--border)] rounded-[24px] p-6 shadow-[var(--shadow-card)] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                    Upcoming Tests
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Your scheduled assessments and placement drives
                  </p>
                </div>
                {assignedTests.length > 0 && (
                  <button
                    onClick={() => navigate("/tests")}
                    className="text-xs font-bold hover:underline cursor-pointer flex items-center gap-1"
                    style={{ color: "#FF6B35" }}
                  >
                    View All <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {assignedTests.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Calendar className="w-8 h-8 mx-auto" style={{ color: "var(--text-muted)" }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                    No upcoming tests
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Your scheduled assessments will appear here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {assignedTests.slice(0, 3).map((test) => {
                    const testColor =
                      test.testStatus === "available"
                        ? "#FF6B35"
                        : test.testStatus === "started"
                        ? "#F59E0B"
                        : test.testStatus === "completed"
                        ? "#10B981"
                        : "#6B7280";
                    const statusLabel =
                      test.testStatus === "available"
                        ? "Scheduled"
                        : test.testStatus === "started"
                        ? "In Progress"
                        : test.testStatus === "completed"
                        ? "Completed"
                        : test.testStatus === "upcoming"
                        ? "Upcoming"
                        : "Expired";
                    return (
                      <div
                        key={test._id}
                        className="border border-[var(--border)] rounded-2xl p-4 bg-[var(--bg-primary)] space-y-3 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                              style={{
                                background: `color-mix(in srgb, ${testColor} 12%, transparent)`,
                                color: testColor,
                              }}
                            >
                              {statusLabel}
                            </span>
                            {test.scheduledAt && (
                              <span
                                className="text-[10px] font-medium flex items-center gap-1"
                                style={{ color: "var(--text-muted)" }}
                              >
                                <Clock className="w-3 h-3" />
                                {formatDate(test.scheduledAt)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                            {test.title}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                            {test.testType
                              ? test.testType.charAt(0).toUpperCase() + test.testType.slice(1)
                              : "Mixed"}
                            {test.duration ? ` · ${test.duration} min` : ""}
                          </p>
                        </div>

                        {test.testStatus === "available" && (
                          <button
                            onClick={() => navigate("/tests")}
                            className="w-full py-2 rounded-xl text-xs font-bold text-white cursor-pointer transition-opacity hover:opacity-90"
                            style={{ background: testColor }}
                          >
                            Attempt Test
                          </button>
                        )}
                        {test.testStatus === "started" && (
                          <button
                            onClick={() => navigate("/tests")}
                            className="w-full py-2 rounded-xl text-xs font-bold text-white cursor-pointer transition-opacity hover:opacity-90"
                            style={{ background: testColor }}
                          >
                            Resume Test
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── PROGRESS OVERVIEW ── */}
            <section className="bg-[var(--card-bg)] border border-[var(--border)] rounded-[24px] p-6 shadow-[var(--shadow-card)] space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                    Progress Overview
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Track your preparation and see how close you are to your goals.
                  </p>
                </div>
                <button
                  onClick={() => navigate("/placement/performance")}
                  className="text-xs font-bold flex items-center gap-1 cursor-pointer hover:underline"
                  style={{ color: "#FF6B35" }}
                >
                  Full Analytics <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-5">
                {/* ── Aptitude ── */}
                <div
                  className="border border-[var(--border)] rounded-2xl p-5 bg-[var(--bg-primary)] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                        Aptitude
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        Overall Score
                      </p>
                    </div>
                    <span className="text-sm font-black tabular-nums" style={{ color: "#FF6B35" }}>
                      {placementData?.scores?.aptitude != null
                        ? `${placementData.scores.aptitude} / 100`
                        : analytics?.aptitudeAvg != null
                        ? `${analytics.aptitudeAvg} / 100`
                        : "Not Attempted"}
                    </span>
                  </div>
                  {(placementData?.scores?.aptitude != null || analytics?.aptitudeAvg != null) ? (
                    <AnimatedProgressBar
                      score={placementData?.scores?.aptitude ?? analytics?.aptitudeAvg}
                      color="#FF6B35"
                      height={10}
                    />
                  ) : (
                    <div
                      className="w-full rounded-full overflow-hidden"
                      style={{ height: 10, background: "var(--border)" }}
                    />
                  )}
                </div>

                {/* ── Coding ── */}
                <div
                  className="border border-[var(--border)] rounded-2xl p-5 bg-[var(--bg-primary)] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                        Coding
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        Overall Score
                      </p>
                    </div>
                    <span className="text-sm font-black tabular-nums" style={{ color: "#38BDF8" }}>
                      {placementData?.scores?.coding != null
                        ? `${placementData.scores.coding} / 100`
                        : analytics?.codingAvg != null
                        ? `${analytics.codingAvg} / 100`
                        : "Not Attempted"}
                    </span>
                  </div>
                  {(placementData?.scores?.coding != null || analytics?.codingAvg != null) ? (
                    <AnimatedProgressBar
                      score={placementData?.scores?.coding ?? analytics?.codingAvg}
                      color="#38BDF8"
                      height={10}
                    />
                  ) : (
                    <div
                      className="w-full rounded-full overflow-hidden"
                      style={{ height: 10, background: "var(--border)" }}
                    />
                  )}
                </div>

                {/* ── System Design & Architecture ── */}
                <div
                  className="border border-[var(--border)] rounded-2xl p-5 bg-[var(--bg-primary)] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                        System Design &amp; Architecture
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        Overall Score
                      </p>
                    </div>
                    <span className="text-sm font-black tabular-nums" style={{ color: "#E73F1E" }}>
                      {placementData?.scores?.overall != null
                        ? `${placementData.scores.overall} / 100`
                        : "Not Started"}
                    </span>
                  </div>
                  {placementData?.scores?.overall != null ? (
                    <AnimatedProgressBar
                      score={placementData.scores.overall}
                      color="#E73F1E"
                      height={10}
                    />
                  ) : (
                    <div
                      className="w-full rounded-full overflow-hidden"
                      style={{ height: 10, background: "var(--border)" }}
                    />
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="py-6 border-t border-[var(--border)] bg-[var(--card-bg)] text-center text-xs text-[var(--text-secondary)] mt-12">
        <p>&copy; 2026 AI Placement Platform. Designed for production startup excellence.</p>
      </footer>

      {/* Target Company Modal */}
      <AnimatePresence>
        {showCompanyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => !isUpdatingCompany && setShowCompanyModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
                <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                  <Building2 className="w-5 h-5 text-[#38BDF8]" />
                  Set Target Company
                </h2>
                <button
                  onClick={() => !isUpdatingCompany && setShowCompanyModal(false)}
                  disabled={isUpdatingCompany}
                  className="p-1 rounded-full hover:bg-neutral-800/10 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <X className="w-5 h-5" style={{ color: "var(--text-secondary)" }} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  <input
                    type="text"
                    placeholder="Search company..."
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>

                {/* Company List */}
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {filteredCompanies.length === 0 ? (
                    <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>
                      No companies found
                    </p>
                  ) : (
                    filteredCompanies.map((company) => (
                      <button
                        key={company.id}
                        onClick={() => handleUpdateTargetCompany(company.id)}
                        disabled={isUpdatingCompany}
                        className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-50 ${
                          targetCompany === company.id
                            ? "border-[#38BDF8] bg-[#38BDF8]/10"
                            : "border-[var(--border)] hover:border-[#38BDF8]/50 hover:bg-[#38BDF8]/5"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                            {company.name}
                          </span>
                          {targetCompany === company.id && (
                            <CheckCircle className="w-4 h-4 text-[#38BDF8]" />
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {targetCompany && (
                  <button
                    onClick={() => handleUpdateTargetCompany("")}
                    disabled={isUpdatingCompany}
                    className="w-full py-2.5 rounded-xl border text-sm font-semibold cursor-pointer transition-colors disabled:opacity-50"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Clear Target Company
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default StudentDashboard;
