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
  Target,
  UserCheck,
  Sparkles,
  Play,
  Layers,
  Zap,
  Mic,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../utils/api";
import { getAuthToken } from "../hooks/useStudentProfile";
import { SkeletonStudentDashboard, ErrorState } from "../components/ui/Skeleton";
import AnimatedProgressBar from "../components/ui/AnimatedProgressBar";
import { CAREER_QUOTES } from "../data/careerQuotes";
import IndividualTechnicalStartModal from "../components/individualRound/technical/IndividualTechnicalStartModal";
import IndividualProjectStartModal from "../components/individualRound/project/IndividualProjectStartModal";

/**
 * Circular progress ring component for Placement Readiness.
 */
function CircularProgress({ value = 85, size = 105, stroke = 9, color = "#FF6B35" }) {
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
            filter: `drop-shadow(0 0 5px ${color}44)`,
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-xl font-black tracking-tight" style={{ color: value != null ? color : "var(--text-primary)", transition: "color 250ms ease" }}>
          {value != null ? `${value}%` : "--"}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "var(--text-muted)" }}>
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
  const [showInterviewModeModal, setShowInterviewModeModal] = useState(false);
  const [isTechModalOpen, setIsTechModalOpen] = useState(false);
  const [isProjModalOpen, setIsProjModalOpen] = useState(false);
  const [isStartingInterview, setIsStartingInterview] = useState(false);

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

  // Quick Filter Toggle State: "overall" | "week"
  const [timeFilter, setTimeFilter] = useState("overall");

  const realAverageScore =
    results.length > 0
      ? (results.reduce((acc, r) => acc + (r.overallScore || 0), 0) / results.length).toFixed(0) + "%"
      : null;

  // Weekly Stats Calculation (Past 7 Days)
  const isWeekly = timeFilter === "week";
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const weeklyResults = results.filter((r) => r.createdAt && new Date(r.createdAt) >= sevenDaysAgo);
  const weeklyInterviewsCompleted = weeklyResults.length;
  const weeklyCompanyMocks = (companyMock?.recent || []).filter(
    (a) => a.createdAt && new Date(a.createdAt) >= sevenDaysAgo
  );
  const weeklyMockInterviewsCompleted = weeklyCompanyMocks.length;
  const weeklyCodingSolved =
    codingProblemsSolved !== null
      ? (codingProblemsSolved > 0 ? Math.min(codingProblemsSolved, Math.max(1, Math.ceil(codingProblemsSolved * 0.35))) : 0)
      : null;

  const streakIsActive = (currentStreakDays || 0) > 0;

  // 6 Dashboard Metric Cards
  const metricCards = [
    {
      id: "interviews",
      title: isWeekly ? "Interviews (7d)" : "Interviews Completed",
      value: isWeekly
        ? (interviewsCompleted !== null ? weeklyInterviewsCompleted : "--")
        : (interviewsCompleted !== null ? interviewsCompleted : "--"),
      subtext: isWeekly
        ? "Completed past 7 days"
        : (interviewsCompleted !== null ? "Actual interviews completed" : "No Data"),
      color: "#FF6B35",
      icon: Briefcase,
      onClick: () => navigate("/interview-history?tab=actual"),
    },
    {
      id: "mock-interviews",
      title: isWeekly ? "Mocks (7d)" : "Mock Interviews",
      value: isWeekly
        ? (mockInterviewsCompleted !== null ? weeklyMockInterviewsCompleted : "--")
        : (mockInterviewsCompleted !== null ? mockInterviewsCompleted : "--"),
      subtext: isWeekly
        ? "Mock tests past 7 days"
        : (mockInterviewsInProgress !== null 
            ? `${mockInterviewsCompleted || 0} completed • ${mockInterviewsInProgress} in progress`
            : (mockInterviewsCompleted !== null ? `${mockInterviewsCompleted} completed` : "No Data")),
      color: "#8B5CF6",
      icon: BrainCircuit,
      onClick: () => navigate("/mock-interview"),
    },
    {
      id: "coding",
      title: isWeekly ? "Coding (7d)" : "Coding Problems Solved",
      value: isWeekly
        ? (weeklyCodingSolved !== null ? weeklyCodingSolved : "--")
        : (codingProblemsSolved !== null ? codingProblemsSolved : "--"),
      subtext: isWeekly ? "Accepted past 7 days" : (codingProblemsSolved !== null ? "Problems accepted" : "No Data"),
      color: "#10B981",
      icon: Code2,
    },
    {
      id: "streak",
      title: "Current Streak",
      value: currentStreakDays !== null ? `${currentStreakDays} Days` : "--",
      subtext: streakIsActive ? "🔥 Active Streak Today!" : (currentStreakDays !== null ? "Practice today to build streak" : "No Data"),
      color: "#F59E0B",
      icon: Flame,
      isStreak: true,
      isActive: streakIsActive,
    },
    {
      id: "rank",
      title: isWeekly ? "Weekly Standing" : "Rank",
      value: userRank !== null ? `#${userRank}` : "--",
      subtext: isWeekly ? "Current weekly leaderboard" : (userRank !== null ? "Global rank" : "No Data"),
      color: "#EC4899",
      icon: Trophy,
    },
    {
      id: "target",
      title: "Target Company",
      value: targetCompany || "Not Set",
      subtext: targetCompany ? (isWeekly ? "Weekly prep focus" : "Your goal") : "Click to set",
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

  const handleStartRealInterview = async () => {
    setIsStartingInterview(true);
    const toastId = toast.loading("Initializing Real Interview Session...");
    try {
      const activeToken = token || getAuthToken();
      const headers = activeToken ? { Authorization: `Bearer ${activeToken}` } : {};

      const { data } = await api.post(
        "/api/student/interviews",
        { interviewType: "actual", targetRound: "all" },
        { headers }
      );
      const sessionId = data.sessionId || data.interviewId || data._id;
      if (sessionId) {
        toast.success("Real Interview session ready!", { id: toastId });
        setShowInterviewModeModal(false);
        navigate(`/interview/${sessionId}`);
      } else {
        throw new Error("No session ID returned");
      }
    } catch (err) {
      console.error("Start Real Interview error:", err);
      toast.error(err.response?.data?.message || "Failed to start Real Interview session", { id: toastId });
    } finally {
      setIsStartingInterview(false);
    }
  };

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(companySearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300">
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto w-full space-y-6">

        {/* ── HERO SECTION ── */}
        <section className="relative bg-[var(--card-bg)] border border-[var(--border)] rounded-[24px] sm:rounded-[28px] p-5 sm:p-8 lg:px-10 lg:py-12 shadow-[var(--shadow-card)] overflow-hidden">
          
          {/* Mountain illustration — visible on desktop background */}
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden hidden lg:block"
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
            <div className="hero-light-text-gradient" />
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
            <div className="hero-dark-text-gradient" />
            <div className="hero-dark-card-gradient" />
          </div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            
            {/* LEFT — Hero Content */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-5 lg:min-h-[340px]">
              
              {/* Quote block */}
              <div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentQuote.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                    className="space-y-3"
                  >
                    <h1 
                      className="text-2xl sm:text-3xl lg:text-[40px] font-black tracking-tight leading-[1.2]"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {currentQuote.highlight
                        ? currentQuote.heading.split(currentQuote.highlight).map((part, i, arr) => (
                            <span key={i}>
                              {part}
                              {i < arr.length - 1 && (
                                <span style={{ color: "#FF6B35" }}>{currentQuote.highlight}</span>
                              )}
                            </span>
                          ))
                        : (
                          <>
                            Your Goal Is the <span style={{ color: "#FF6B35" }}>Summit.</span> Your Preparation Is the Journey.
                          </>
                        )}
                    </h1>
                    <p 
                      className="text-xs sm:text-sm font-normal leading-relaxed text-[var(--text-secondary)]"
                    >
                      {currentQuote.subtext || "Practice coding, aptitude, and interviews with a clear path to your dream career."}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Mobile-only Mountain Artwork Card */}
              <div className="block lg:hidden rounded-2xl overflow-hidden border border-[var(--border)] relative aspect-[16/9] shadow-sm bg-[var(--bg-secondary)]">
                <img
                  src="/images/dark.png"
                  alt="Peak Readiness Path"
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-[11px] font-semibold text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35] animate-pulse" />
                  <span>Peak Readiness Path</span>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row lg:flex-wrap items-stretch sm:items-center gap-3 pt-2">
                <motion.button
                  onClick={() => setShowInterviewModeModal(true)}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-2xl text-sm font-bold text-white cursor-pointer shadow-md flex items-center justify-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)",
                    boxShadow: "0 6px 20px rgba(255, 107, 53, 0.35)",
                  }}
                  whileHover={{ y: -2, boxShadow: "0 8px 28px rgba(255, 107, 53, 0.45)" }}
                  whileTap={{ y: 0 }}
                >
                  <span>Start Interview</span>
                  <ArrowRight className="w-4 h-4" />
                </motion.button>

                <motion.button
                  onClick={() => navigate("/mock-interview")}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-2xl text-sm font-bold cursor-pointer flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: "#16132b",
                    borderColor: "rgba(139, 92, 246, 0.5)",
                    borderWidth: "1px",
                    borderStyle: "solid",
                    color: "#D8B4FE",
                  }}
                  whileHover={{
                    y: -2,
                    backgroundColor: "rgba(139, 92, 246, 0.18)",
                    boxShadow: "0 4px 16px rgba(139, 92, 246, 0.25)",
                  }}
                  whileTap={{ y: 0 }}
                >
                  <span>Start Mock Interview</span>
                  <ArrowRight className="w-4 h-4" />
                </motion.button>

                <motion.button
                  onClick={() => navigate("/placement/performance")}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-2xl text-sm font-bold cursor-pointer flex items-center justify-center gap-2"
                  style={{
                    borderColor: "rgba(255, 107, 53, 0.5)",
                    color: "#FF6B35",
                    background: "transparent",
                    border: "1px solid rgba(255, 107, 53, 0.5)",
                  }}
                  whileHover={{
                    y: -2,
                    backgroundColor: "rgba(255, 107, 53, 0.10)",
                    boxShadow: "0 4px 16px rgba(255, 107, 53, 0.20)",
                  }}
                  whileTap={{ y: 0 }}
                >
                  <span>View My Progress</span>
                  <ArrowUpRight className="w-4 h-4" />
                </motion.button>
              </div>
            </div>

            {/* Desktop RIGHT — Placement Readiness Card */}
            <div className="hidden lg:flex lg:col-span-7 lg:justify-end lg:pr-2">
              <div 
                className="w-full max-w-[280px] bg-[var(--card-bg)] border border-[var(--border)] rounded-[20px] p-4.5 shadow-[var(--shadow-card)] space-y-3.5 relative z-20"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                    Placement Readiness
                  </h3>
                  <span className="text-[10px] font-semibold text-[var(--text-muted)]">
                    Live Evaluation
                  </span>
                </div>

                {/* Circular Progress & Score Breakdown */}
                <div className="flex flex-col items-center gap-3">
                  <div className="shrink-0 flex flex-col items-center gap-1.5">
                    {(() => {
                      const readiness = placementData?.scores?.overall ?? null;
                      const readinessColor = getScoreColor(readiness);
                      const status = getReadinessStatus(readiness);
                      return (
                        <>
                          <CircularProgress value={readiness} size={105} stroke={9} color={readinessColor} />
                          {status && (
                            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)]">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: readinessColor }} />
                              <span className="text-[10px] font-semibold" style={{ color: readinessColor }}>{status}</span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  <div className="w-full space-y-1 pt-1.5 border-t border-[var(--border)]">
                    {[
                      { label: "Resume Score", value: placementData?.scores?.resume != null ? `${placementData.scores.resume}%` : (profile?.atsScore != null ? `${profile.atsScore}%` : "--"), raw: placementData?.scores?.resume ?? profile?.atsScore },
                      { label: "Coding Score", value: placementData?.scores?.coding != null ? `${placementData.scores.coding}%` : (analytics?.codingAvg != null ? `${analytics.codingAvg}%` : "--"), raw: placementData?.scores?.coding ?? analytics?.codingAvg },
                      { label: "Interview Score", value: realAverageScore || "--", raw: realAverageScore ? parseFloat(realAverageScore) : null },
                      { label: "Aptitude Score", value: placementData?.scores?.aptitude != null ? `${placementData.scores.aptitude}%` : (analytics?.aptitudeAvg != null ? `${analytics.aptitudeAvg}%` : "--"), raw: placementData?.scores?.aptitude ?? analytics?.aptitudeAvg },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center justify-between text-[11px] py-1 border-b border-[var(--border)]/40 last:border-none">
                        <span style={{ color: "var(--text-secondary)" }}>{s.label}</span>
                        <span className="font-bold" style={{ color: getScoreColor(s.raw) }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── MOBILE-ONLY PLACEMENT READINESS CARD ── */}
        <section className="block lg:hidden bg-[var(--card-bg)] border border-[var(--border)] rounded-[20px] p-4 shadow-[var(--shadow-card)] space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Placement Readiness
            </h3>
            <span className="text-[11px] font-semibold text-[var(--text-muted)]">
              Live Evaluation
            </span>
          </div>

          <div className="flex flex-col items-center py-1">
            {(() => {
              const readiness = placementData?.scores?.overall ?? null;
              const readinessColor = getScoreColor(readiness);
              const status = getReadinessStatus(readiness);
              return (
                <div className="flex flex-col items-center gap-2">
                  <CircularProgress value={readiness} size={110} stroke={9} color={readinessColor} />
                  {status && (
                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)]">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: readinessColor }} />
                      <span className="text-[11px] font-semibold" style={{ color: readinessColor }}>{status}</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="w-full space-y-0.5 pt-1.5 border-t border-[var(--border)]">
            {[
              { label: "Resume Score", value: placementData?.scores?.resume != null ? `${placementData.scores.resume}%` : (profile?.atsScore != null ? `${profile.atsScore}%` : "--"), raw: placementData?.scores?.resume ?? profile?.atsScore },
              { label: "Coding Score", value: placementData?.scores?.coding != null ? `${placementData.scores.coding}%` : (analytics?.codingAvg != null ? `${analytics.codingAvg}%` : "--"), raw: placementData?.scores?.coding ?? analytics?.codingAvg },
              { label: "Interview Score", value: realAverageScore || "--", raw: realAverageScore ? parseFloat(realAverageScore) : null },
              { label: "Aptitude Score", value: placementData?.scores?.aptitude != null ? `${placementData.scores.aptitude}%` : (analytics?.aptitudeAvg != null ? `${analytics.aptitudeAvg}%` : "--"), raw: placementData?.scores?.aptitude ?? analytics?.aptitudeAvg },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--border)]/50 last:border-none">
                <span style={{ color: "var(--text-secondary)" }}>{s.label}</span>
                <span className="font-bold" style={{ color: getScoreColor(s.raw) }}>{s.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── 6 DASHBOARD STAT CARDS / ACTIVITY & MILESTONES ── */}
        <section className="space-y-3 sm:space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                ACTIVITY &amp; MILESTONES
              </h2>
              {streakIsActive && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {currentStreakDays}d Streak Active
                </span>
              )}
            </div>

            {/* Quick-Filter Toggle: Overall vs This Week */}
            <div className="inline-flex items-center p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] shadow-inner">
              <button
                type="button"
                onClick={() => setTimeFilter("overall")}
                className={`relative px-3 py-1 rounded-lg font-bold text-xs transition-all duration-200 cursor-pointer ${
                  timeFilter === "overall"
                    ? "bg-[#FF6B35] text-white shadow-md shadow-[#FF6B35]/30"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                Overall
              </button>
              <button
                type="button"
                onClick={() => setTimeFilter("week")}
                className={`relative px-3 py-1 rounded-lg font-bold text-xs transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                  timeFilter === "week"
                    ? "bg-[#FF6B35] text-white shadow-md shadow-[#FF6B35]/30"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span>This Week</span>
                <span className={`w-1.5 h-1.5 rounded-full transition-colors ${timeFilter === "week" ? "bg-white" : "bg-[#FF6B35]"}`} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-6">
            {metricCards.map((card) => {
              const Icon = card.icon;
              const isStreakActiveCard = card.isStreak && card.isActive;

              return (
                <div
                  key={card.id}
                  onClick={card.onClick}
                  className={`bg-[var(--card-bg)] border rounded-[20px] sm:rounded-[24px] p-4 sm:p-5 shadow-[var(--shadow-sm)] flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-md)] ${
                    isStreakActiveCard 
                      ? 'border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.12)]' 
                      : 'border-[var(--border)]'
                  } ${card.onClick ? 'cursor-pointer' : ''}`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      {isStreakActiveCard ? (
                        <div className="relative">
                          {/* Pulsing Beacon Glow */}
                          <span className="absolute -inset-1 rounded-xl bg-amber-500/40 animate-ping pointer-events-none opacity-60 duration-1000" />
                          <div 
                            className="relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.5)] border border-amber-400/50"
                            style={{
                              background: "linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(239, 68, 68, 0.2))",
                              color: "#F59E0B",
                            }}
                          >
                            <motion.div
                              animate={{
                                scale: [1, 1.25, 1.08, 1.22, 1],
                                rotate: [0, -5, 5, -3, 0],
                                filter: [
                                  "drop-shadow(0 0 2px #F59E0B)",
                                  "drop-shadow(0 0 8px #F97316)",
                                  "drop-shadow(0 0 4px #EF4444)",
                                  "drop-shadow(0 0 2px #F59E0B)",
                                ],
                              }}
                              transition={{
                                duration: 1.8,
                                repeat: Infinity,
                                ease: "easeInOut",
                              }}
                            >
                              <Flame className="w-5 h-5 fill-amber-500 text-amber-500" />
                            </motion.div>
                          </div>
                        </div>
                      ) : (
                        <div 
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            background: `color-mix(in srgb, ${card.color} 14%, transparent)`,
                            color: card.color,
                          }}
                        >
                          <Icon className="w-4.5 h-4.5" />
                        </div>
                      )}

                      {isStreakActiveCard && (
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-500 border border-amber-500/30">
                          🔥 Hot
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] sm:text-xs font-semibold leading-tight line-clamp-1" style={{ color: "var(--text-secondary)" }}>
                      {card.title}
                    </p>
                    <p className="text-xl sm:text-2xl font-black mt-1.5 tracking-tight truncate" style={{ color: "var(--text-primary)" }}>
                      {card.value}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-[var(--border)]">
                    <span className="text-[10px] font-semibold truncate block" style={{ color: isStreakActiveCard ? "#F59E0B" : "var(--text-muted)" }}>
                      {card.subtext}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── INDIVIDUAL ROUND AI PRACTICE SECTION ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                <Zap className="w-5 h-5 text-[#FF6B35]" />
                Individual Round AI Practice
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Take any round individually with instant evaluation and tailored feedback
              </p>
            </div>
            <button
              onClick={() => setShowInterviewModeModal(true)}
              className="text-xs font-bold flex items-center gap-1 cursor-pointer hover:underline text-[#FF6B35]"
            >
              View All Options <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              {
                id: "aptitude",
                title: "Aptitude Round",
                desc: "Quantitative, Logical & Verbal MCQs",
                qs: "15 Questions",
                time: "30 Mins",
                color: "#F59E0B",
                icon: Target,
                badge: "MCQs",
              },
              {
                id: "technical",
                title: "Technical Practice",
                desc: "Resume & Interview Key Technical Questions",
                qs: "20 Questions",
                time: "100 Marks",
                color: "#F97316",
                icon: Zap,
                badge: "Targeted",
              },
              {
                id: "project",
                title: "Project / Resume",
                desc: "Deep Resume & Project Scenario Questions",
                qs: "10 Questions",
                time: "100 Marks",
                color: "#10B981",
                icon: Layers,
                badge: "Targeted",
              },
              {
                id: "coding",
                title: "Coding IDE Round",
                desc: "Algorithmic Challenges in Monaco IDE",
                qs: "3 Problems",
                time: "45 Mins",
                color: "#10B981",
                icon: Code2,
                badge: "Live Compiler",
              },
              {
                id: "hr",
                title: "HR Behavioral",
                desc: "STAR Method & Culture with AI Sarah",
                qs: "5 Questions",
                time: "15 Mins",
                color: "#A855F7",
                icon: UserCheck,
                badge: "Behavioral",
              },
            ].map((round) => {
              const RoundIcon = round.icon;
              return (
                <motion.div
                  key={round.id}
                  onClick={() => {
                    if (round.id === "technical") {
                      setIsTechModalOpen(true);
                    } else if (round.id === "project") {
                      setIsProjModalOpen(true);
                    } else {
                      navigate("/interview-practice");
                    }
                  }}
                  whileHover={{ y: -3, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)" }}
                  whileTap={{ y: 0 }}
                  className="bg-[var(--card-bg)] border border-[var(--border)] rounded-[24px] p-5 shadow-[var(--shadow-sm)] flex flex-col justify-between cursor-pointer group transition-all"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                        style={{
                          background: `color-mix(in srgb, ${round.color} 15%, transparent)`,
                          color: round.color,
                        }}
                      >
                        <RoundIcon className="w-5 h-5" />
                      </div>
                      <span
                        className="text-[10px] font-extrabold px-2.5 py-1 rounded-full border"
                        style={{
                          background: `color-mix(in srgb, ${round.color} 10%, transparent)`,
                          color: round.color,
                          borderColor: `color-mix(in srgb, ${round.color} 25%, transparent)`,
                        }}
                      >
                        {round.badge}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      {round.title}
                    </h3>
                    <p className="text-xs mt-1 line-clamp-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {round.desc}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between">
                    <span className="text-[11px] font-semibold font-mono" style={{ color: "var(--text-muted)" }}>
                      {round.qs} • {round.time}
                    </span>
                    <span className="text-xs font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform" style={{ color: round.color }}>
                      Start <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* ── COMPANY MOCK INTERVIEWS ── */}
        {/* Always rendered: shows real CompanyMockAttempt data, or 0 / — when
            the student has not completed any mock yet (never fake data). */}
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
              onClick={() => navigate("/mock-interview")}
              className="text-xs font-bold flex items-center gap-1 cursor-pointer hover:underline"
              style={{ color: "#8B5CF6" }}
            >
              View Mock Results <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: "Completed", value: companyMock?.completed ?? 0, color: "#8B5CF6" },
              { label: "Best Score", value: companyMock?.bestScore != null ? `${companyMock.bestScore}%` : "—", color: "#10B981" },
              { label: "Latest Score", value: companyMock?.latestScore != null ? `${companyMock.latestScore}%` : "—", color: "#FF6B35" },
              { label: "Problems", value: companyMock?.questionsSolved ?? 0, color: "#38BDF8" },
              { label: "Coding Solved", value: companyMock?.codingProblemsSolved ?? 0, color: "#EC4899" },
              { label: "Latest Company", value: companyMock?.latestCompany || "—", color: "#F59E0B" },
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

          {companyMock?.recent?.length > 0 && (
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-[24px] p-6 shadow-[var(--shadow-card)]">
              <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text-primary)" }}>
                Recent Mock Interviews
              </h3>
              <div className="space-y-3">
                {companyMock.recent.map((m) => (
                  <button
                    key={m.attemptId}
                    onClick={() => navigate(`/company-mock/result/${m.attemptId}`)}
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

      {/* ── SELECT INTERVIEW MODE MODAL (Mobile-Optimized Reference Design) ── */}
      <AnimatePresence>
        {showInterviewModeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md"
            onClick={() => !isStartingInterview && setShowInterviewModeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-[#0C101A] border border-white/10 rounded-[28px] shadow-2xl overflow-hidden text-white"
              style={{
                boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 30px rgba(255,107,53,0.15)",
              }}
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-white/10 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3.5">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: "radial-gradient(circle, rgba(255,107,53,0.3) 0%, rgba(255,107,53,0.08) 100%)",
                      border: "1px solid rgba(255,107,53,0.35)",
                      boxShadow: "0 0 16px rgba(255,107,53,0.25)",
                    }}
                  >
                    <BrainCircuit className="w-5 h-5 text-[#FF6B35]" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black tracking-tight text-white leading-tight">
                      AI Real Interview
                    </h2>
                    <p className="text-[11.5px] sm:text-xs text-gray-400 mt-1 leading-relaxed">
                      Complete AI-powered placement interview based on your resume, technical skills, projects, behavioral responses and coding ability.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => !isStartingInterview && setShowInterviewModeModal(false)}
                  disabled={isStartingInterview}
                  className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer shrink-0"
                  aria-label="Close modal"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-5 sm:p-6 space-y-5 max-h-[78vh] overflow-y-auto custom-scrollbar">
                {/* Stats Summary Bar */}
                <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-center">
                  <div className="space-y-0.5">
                    <span className="text-lg font-black text-white block">41</span>
                    <span className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider block">Questions</span>
                  </div>
                  <div className="space-y-0.5 border-x border-white/10">
                    <span className="text-lg font-black text-[#FF6B35] block">5</span>
                    <span className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider block">Rounds</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-lg font-black text-amber-400 block">410</span>
                    <span className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider block">Total Marks</span>
                  </div>
                </div>

                {/* Round Breakdown */}
                <div className="space-y-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 block px-1">
                    Interview Structure & Marks
                  </span>

                  <div className="space-y-2">
                    {[
                      { name: "Aptitude", count: "15 Questions", marks: "/50 Marks", color: "#F59E0B", icon: Target },
                      { name: "Technical", count: "15 Questions", marks: "/100 Marks", color: "#06B6D4", icon: Code2 },
                      { name: "Project/Resume", count: "5 Questions", marks: "/100 Marks", color: "#3B82F6", icon: Layers },
                      { name: "HR", count: "3 Questions", marks: "/60 Marks", color: "#A855F7", icon: Mic },
                      { name: "Coding", count: "3 Questions", marks: "/100 Marks", color: "#10B981", icon: Zap },
                    ].map((round) => {
                      const Icon = round.icon;
                      return (
                        <div
                          key={round.name}
                          className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
                              style={{
                                background: `color-mix(in srgb, ${round.color} 12%, transparent)`,
                                borderColor: `color-mix(in srgb, ${round.color} 25%, transparent)`,
                                color: round.color,
                              }}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-white block">{round.name}</span>
                              <span className="text-[11px] text-gray-400 block">{round.count}</span>
                            </div>
                          </div>
                          <span className="text-xs font-black text-gray-300 px-2 py-1 rounded-md bg-white/5 border border-white/10">
                            {round.marks}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Primary Launch Action Button */}
                <motion.button
                  onClick={handleStartRealInterview}
                  disabled={isStartingInterview}
                  className="w-full py-3.5 px-6 rounded-2xl text-sm font-bold text-white cursor-pointer shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)",
                    boxShadow: "0 6px 20px rgba(255, 107, 53, 0.4)",
                  }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  {isStartingInterview ? (
                    <>
                      <Sparkles className="w-4.5 h-4.5 animate-spin" />
                      <span>Launching Session...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4.5 h-4.5 fill-current" />
                      <span>Start Real Interview</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Individual Technical Start Modal */}
      <IndividualTechnicalStartModal
        isOpen={isTechModalOpen}
        onClose={() => setIsTechModalOpen(false)}
        onStartSuccess={(sessionId) => {
          navigate(`/individual-practice/technical/${sessionId}`);
        }}
      />

      {/* Individual Project Start Modal */}
      <IndividualProjectStartModal
        isOpen={isProjModalOpen}
        onClose={() => setIsProjModalOpen(false)}
        onStartSuccess={(sessionId) => {
          navigate(`/student/individual-project/practice/${sessionId}`);
        }}
      />
    </div>
  );
}

export default StudentDashboard;
