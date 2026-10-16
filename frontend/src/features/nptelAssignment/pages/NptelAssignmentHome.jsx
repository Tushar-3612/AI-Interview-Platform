import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Trophy,
  Clock,
  CheckCircle2,
  FileText,
  ArrowRight,
  Target,
  Award,
  Zap,
  ChevronRight,
  Star,
} from "lucide-react";
import api from "../../../core/api/api.js";
import { getAuthToken } from "../../student/hooks/useStudentProfile.js";
import { NPTEL_THEME, getLocalTestProgress, clearLocalDraftAnswers } from "../data/nptelData.js";

export default function NptelAssignmentHome() {
  const navigate = useNavigate();
  const token = getAuthToken();
  const [leaderboardPreview, setLeaderboardPreview] = useState([]);
  const [currentUserRank, setCurrentUserRank] = useState(null);
  const [loadingLB, setLoadingLB] = useState(true);
  const localProgress = getLocalTestProgress();

  useEffect(() => {
    let isMounted = true;
    async function fetchPreview() {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await api.get("/api/nptel/leaderboard", { headers });
        if (isMounted && res.data?.success) {
          setLeaderboardPreview((res.data.leaderboard || []).slice(0, 3));
          setCurrentUserRank(res.data.currentUserRank || null);
        }
      } catch {
        // silent fail – show empty state gracefully
      } finally {
        if (isMounted) setLoadingLB(false);
      }
    }
    fetchPreview();
    return () => { isMounted = false; };
  }, [token]);

  const handleStartTest = () => {
    clearLocalDraftAnswers();
    navigate("/nptel-assignment/test");
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.12, duration: 0.45, ease: "easeOut" } }),
  };

  return (
    <div className="page-container py-3 sm:py-10 max-w-6xl mx-auto px-3 sm:px-6">
      {/* ── PAGE HERO ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-4 sm:mb-10"
      >
        <div
          className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest border mb-2.5 sm:mb-5"
          style={{ background: NPTEL_THEME.bgSubtle, borderColor: NPTEL_THEME.border, color: NPTEL_THEME.primary }}
        >
          <GraduationCap className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span>NPTEL · IIT Madras</span>
        </div>

        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black mb-2 sm:mb-4 tracking-tight" style={{ color: "var(--text-primary)" }}>
          Research Methodology
          <span className="block" style={{ color: NPTEL_THEME.primary }}>Assignment Test</span>
        </h1>
        <p className="text-xs sm:text-base max-w-2xl mx-auto leading-relaxed px-1" style={{ color: "var(--text-secondary)" }}>
          Practice with 120 multiple-choice questions covering the complete NPTEL Foundations of Research curriculum.
        </p>

        {/* Quick Stats Strip */}
        <div className="flex items-center justify-center gap-3 sm:gap-10 mt-3 sm:mt-6 flex-wrap">
          {[
            { icon: FileText, label: "120 MCQs", sub: "Full Syllabus" },
            { icon: Clock, label: "120 Min", sub: "Time Limit" },
            { icon: Target, label: "1 Mark", sub: "Per Question" },
            { icon: Award, label: "40%", sub: "Passing Score" },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="flex items-center gap-1.5 sm:gap-2">
              <div
                className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0"
                style={{ background: NPTEL_THEME.bgSubtle, color: NPTEL_THEME.primary }}
              >
                <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
              </div>
              <div className="text-left">
                <div className="text-[11px] sm:text-xs font-black" style={{ color: "var(--text-primary)" }}>{label}</div>
                <div className="text-[9px] sm:text-[10px] text-gray-500">{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── TWO FEATURE CARDS (Arranged Horizontally Side-by-Side) ── */}
      <div className="grid grid-cols-2 gap-2 sm:gap-6">

        {/* ════════ CARD 1: START TEST ════════ */}
        <motion.div
          custom={0}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="relative flex flex-col rounded-xl sm:rounded-3xl border overflow-hidden group cursor-default"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          {/* Orange top accent stripe */}
          <div className="h-1 w-full" style={{ background: NPTEL_THEME.gradient }} />

          <div className="flex flex-col flex-1 p-2.5 sm:p-6">
            {/* Header: Icon + Badge */}
            <div className="flex items-center justify-between gap-1 mb-1.5 sm:mb-4">
              <div
                className="w-7 h-7 sm:w-12 sm:h-12 rounded-lg sm:rounded-2xl flex items-center justify-center border shadow-sm shrink-0"
                style={{
                  background: NPTEL_THEME.gradient,
                  borderColor: NPTEL_THEME.border,
                  boxShadow: "0 4px 12px rgba(255, 107, 53, 0.25)",
                }}
              >
                <GraduationCap className="w-3.5 h-3.5 sm:w-6 sm:h-6 text-white" />
              </div>
              <span
                className="text-[8px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0"
                style={{ background: NPTEL_THEME.bgSubtle, color: NPTEL_THEME.primary, border: `1px solid ${NPTEL_THEME.border}` }}
              >
                Practice
              </span>
            </div>

            {/* Title & Description */}
            <h2 className="text-xs sm:text-xl font-black mb-1 line-clamp-1" style={{ color: "var(--text-primary)" }}>
              NPTEL Test
            </h2>
            <p className="hidden sm:block text-xs leading-relaxed mb-3 text-gray-400" style={{ color: "var(--text-secondary)" }}>
              Test your knowledge of Foundations of Research with instant score feedback.
            </p>

            {/* Features List */}
            <div className="space-y-1 sm:space-y-2 mb-2 sm:mb-4">
              {[
                { icon: CheckCircle2, text: "120 MCQs · 1 Mark", color: "text-emerald-400" },
                { icon: Zap, text: "Auto-advance", color: "text-amber-400" },
                { icon: Target, text: "Instant Scoring", color: "text-orange-400" },
              ].map(({ icon: Icon, text, color }) => (
                <div key={text} className="flex items-center gap-1 sm:gap-2">
                  <Icon className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${color}`} />
                  <span className="text-[9px] sm:text-xs font-medium truncate" style={{ color: "var(--text-secondary)" }}>{text}</span>
                </div>
              ))}
            </div>

            {/* Previous Attempt Info */}
            {localProgress && (
              <div
                className="flex items-center gap-1.5 p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl border mb-2 sm:mb-4"
                style={{ background: NPTEL_THEME.bgSubtle, borderColor: NPTEL_THEME.border }}
              >
                <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" style={{ color: NPTEL_THEME.primary }} />
                <div className="text-[9px] sm:text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                  <span className="font-bold" style={{ color: NPTEL_THEME.primary }}>
                    Best: {localProgress.bestScore}/{localProgress.maxScore}
                  </span>
                  <span className="hidden sm:inline">{" · "}{localProgress.percentage}%</span>
                </div>
              </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* CTA */}
            <button
              type="button"
              id="nptel-start-test-btn"
              onClick={handleStartTest}
              className="w-full py-2 sm:py-3 rounded-lg sm:rounded-2xl text-[11px] sm:text-sm font-black text-white flex items-center justify-center gap-1 sm:gap-2 cursor-pointer transition hover:opacity-95 active:scale-[0.98] mt-1"
              style={{ background: NPTEL_THEME.gradient, boxShadow: NPTEL_THEME.glow }}
            >
              <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Start Test</span>
              <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          </div>
        </motion.div>

        {/* ════════ CARD 2: LEADERBOARD ════════ */}
        <motion.div
          custom={1}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="relative flex flex-col rounded-xl sm:rounded-3xl border overflow-hidden group cursor-default"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          {/* Amber top accent stripe */}
          <div className="h-1 w-full" style={{ background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)" }} />

          <div className="flex flex-col flex-1 p-2.5 sm:p-6">
            {/* Header: Icon + Badge */}
            <div className="flex items-center justify-between gap-1 mb-1.5 sm:mb-4">
              <div
                className="w-7 h-7 sm:w-12 sm:h-12 rounded-lg sm:rounded-2xl flex items-center justify-center border shadow-sm shrink-0"
                style={{
                  background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                  borderColor: "rgba(245, 158, 11, 0.4)",
                  boxShadow: "0 4px 12px rgba(245, 158, 11, 0.2)",
                }}
              >
                <Trophy className="w-3.5 h-3.5 sm:w-6 sm:h-6 text-white" />
              </div>
              <span
                className="text-[8px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider border shrink-0"
                style={{ background: "rgba(245, 158, 11, 0.1)", color: "#F59E0B", borderColor: "rgba(245, 158, 11, 0.35)" }}
              >
                Rankings
              </span>
            </div>

            {/* Title & Description */}
            <h2 className="text-xs sm:text-xl font-black mb-1 line-clamp-1" style={{ color: "var(--text-primary)" }}>
              Leaderboard
            </h2>
            <p className="hidden sm:block text-xs leading-relaxed mb-3 text-gray-400" style={{ color: "var(--text-secondary)" }}>
              Compare your score &amp; rank against candidates live in real-time.
            </p>

            {/* Your Rank / Preview */}
            {currentUserRank ? (
              <div
                className="flex items-center gap-1.5 p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl border mb-2 sm:mb-4"
                style={{ background: "rgba(16, 185, 129, 0.08)", borderColor: "rgba(16, 185, 129, 0.3)" }}
              >
                <div
                  className="w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg flex items-center justify-center font-black text-white shrink-0 text-[9px] sm:text-xs"
                  style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}
                >
                  #{currentUserRank.rank}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] sm:text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>Your Rank</div>
                  <div className="text-[8px] sm:text-[11px] text-gray-400 truncate">
                    Avg: <b className="text-emerald-400">{currentUserRank.percentage}%</b> ({currentUserRank.attemptsCount || 1} {currentUserRank.attemptsCount === 1 ? "attempt" : "attempts"})
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl border mb-2 sm:mb-4"
                style={{ background: "rgba(245, 158, 11, 0.06)", borderColor: "rgba(245, 158, 11, 0.25)" }}
              >
                <Target className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="text-[9px] sm:text-xs text-gray-400 truncate">Take test to see rank</span>
              </div>
            )}

            {/* Top Candidates Preview */}
            <div className="flex-1 min-h-0 mb-2">
              {loadingLB ? (
                <div className="space-y-1">
                  <div className="h-5 sm:h-6 rounded-md animate-pulse" style={{ background: "var(--bg-secondary)" }} />
                </div>
              ) : leaderboardPreview.length > 0 ? (
                <div className="space-y-1">
                  {leaderboardPreview.slice(0, 2).map((cand, idx) => (
                    <div
                      key={cand.userId}
                      className="flex items-center gap-1.5 py-1 px-1.5 rounded-md sm:rounded-lg border text-[9px] sm:text-xs"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded flex items-center justify-center font-black shrink-0 text-[8px] sm:text-[10px]" style={{ background: idx === 0 ? "rgba(245, 158, 11, 0.2)" : "rgba(148, 163, 184, 0.2)", color: idx === 0 ? "#F59E0B" : "#94A3B8" }}>
                        {idx + 1}
                      </span>
                      <span className="truncate flex-1 font-medium" style={{ color: "var(--text-primary)" }}>{cand.name}</span>
                      <span className="font-black text-[#F59E0B] shrink-0">{cand.percentage}%</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* CTA */}
            <button
              type="button"
              id="nptel-leaderboard-btn"
              onClick={() => navigate("/nptel-assignment/leaderboard")}
              className="w-full py-2 sm:py-3 rounded-lg sm:rounded-2xl text-[11px] sm:text-sm font-black flex items-center justify-center gap-1 sm:gap-2 cursor-pointer transition border hover:bg-[var(--bg-secondary)] mt-1"
              style={{
                color: "#F59E0B",
                borderColor: "rgba(245, 158, 11, 0.4)",
                background: "rgba(245, 158, 11, 0.08)",
              }}
            >
              <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Leaderboard</span>
              <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
