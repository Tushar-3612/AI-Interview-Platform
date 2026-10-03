import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import {
  BrainCircuit,
  Calculator,
  Compass,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Play,
  History,
  Award,
  Zap,
  ShieldAlert,
  BarChart3,
  Percent,
  Timer,
  Layers,
  Sparkles,
  FileCheck,
  BookOpen,
} from "lucide-react";
import api from "../../../core/api/api.js";
import { getAuthToken } from "../../student/hooks/useStudentProfile.js";
import { timeAgo, formatTime } from "../../../core/utils/dateUtils.js";

const APTITUDE_TRACKS = [
  {
    id: "general",
    title: "Diagnostic General Assessment",
    badge: "Official Campus Pattern",
    duration: "30 Mins",
    questions: "25 Questions",
    marking: "+1 / -0.25",
    color: "#F59E0B",
    bg: "rgba(245, 158, 11, 0.12)",
    border: "rgba(245, 158, 11, 0.35)",
    glow: "rgba(245, 158, 11, 0.35)",
    gradient: "linear-gradient(135deg, #F59E0B 0%, #EA580C 55%, #FF6B35 100%)",
    desc: "Comprehensive benchmark evaluating Quant, Logical Reasoning, and Verbal Comprehension with standard negative marking.",
    topics: ["Arithmetic", "Series & Sequences", "Logical Deduction", "Vocabulary"],
  },
  {
    id: "quantitative",
    title: "Numerical Ability & Speed Math",
    badge: "High Weightage",
    duration: "25 Mins",
    questions: "20 Questions",
    marking: "+1 / -0.25",
    color: "#10B981",
    bg: "rgba(16, 185, 129, 0.12)",
    border: "rgba(16, 185, 129, 0.35)",
    glow: "rgba(16, 185, 129, 0.35)",
    gradient: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
    desc: "Focused assessment on time-critical mathematics: profit/loss, percentages, ratios, permutations, and time & work.",
    topics: ["Percentages", "Time & Work", "Profit & Loss", "Ratios & Mixtures"],
  },
  {
    id: "logical",
    title: "Logical Reasoning & Puzzles",
    badge: "Analytical Screening",
    duration: "20 Mins",
    questions: "15 Questions",
    marking: "+1 / -0.25",
    color: "#6366F1",
    bg: "rgba(99, 102, 241, 0.12)",
    border: "rgba(99, 102, 241, 0.35)",
    glow: "rgba(99, 102, 241, 0.35)",
    gradient: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 60%, #A855F7 100%)",
    desc: "Tests structural reasoning, blood relations, seating arrangements, syllogisms, and coding-decoding patterns.",
    topics: ["Blood Relations", "Seating Arrangement", "Syllogisms", "Direction Sense"],
  },
  {
    id: "verbal",
    title: "Verbal Ability & Comprehension",
    badge: "Language Fluency",
    duration: "15 Mins",
    questions: "15 Questions",
    marking: "+1 / -0.25",
    color: "#EC4899",
    bg: "rgba(236, 72, 153, 0.12)",
    border: "rgba(236, 72, 153, 0.35)",
    glow: "rgba(236, 72, 153, 0.35)",
    gradient: "linear-gradient(135deg, #EC4899 0%, #DB2777 50%, #9D174D 100%)",
    desc: "Sentence improvement, para-jumbles, critical reading comprehension, idioms, and contextual vocabulary.",
    topics: ["Reading Comprehension", "Para Jumbles", "Error Spotting", "Idioms"],
  },
];

export default function AptitudeHub() {
  const navigate = useNavigate();
  const token = getAuthToken();

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [selectedAssessment, setSelectedAssessment] = useState(APTITUDE_TRACKS[0]);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await api.get("/api/practice/aptitude/history", {
          headers,
          params: { limit: 10 },
        });
        setHistory(res.data?.attempts || []);
      } catch (err) {
        console.error("Failed to load aptitude history:", err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [token]);

  // Aggregate stats from history
  const stats = useMemo(() => {
    if (!history.length) {
      return { totalAttempts: 0, avgPercentage: 0, bestScore: 0, accuracy: 0 };
    }
    const totalAttempts = history.length;
    const avgPercentage = Math.round(
      history.reduce((acc, h) => acc + (h.percentage || 0), 0) / totalAttempts
    );
    const bestScore = Math.max(...history.map((h) => h.percentage || 0));
    return { totalAttempts, avgPercentage, bestScore, accuracy: avgPercentage };
  }, [history]);

  const handleLaunchAssessment = (track) => {
    setSelectedAssessment(track);
    setRulesModalOpen(true);
  };

  const handleConfirmStartAssessment = () => {
    setRulesModalOpen(false);
    navigate(`/aptitude/assessment?track=${selectedAssessment.id}`);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300">
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto w-full space-y-8">
        
        {/* ── TOP HERO HEADER ── */}
        <section className="relative bg-[var(--card-bg)] border border-[var(--border)] rounded-[24px] sm:rounded-[28px] p-6 sm:p-8 lg:p-10 shadow-[var(--shadow-card)] overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <BrainCircuit className="w-3.5 h-3.5" />
                <span>PrepHire Cognitive & Aptitude Module</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">
                Aptitude & Reasoning Suite
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                Build speed, numerical agility, and analytical problem-solving. Practice modular topic drills or test your readiness in full-length proctored campus assessments.
              </p>
            </div>

            {/* Quick KPI Cards */}
            <div className="grid grid-cols-3 gap-3 w-full lg:w-auto shrink-0">
              <div className="p-4 rounded-2xl border bg-[var(--bg-secondary)]/60 text-center" style={{ borderColor: "var(--border)" }}>
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Completed</span>
                <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono mt-0.5 block">{stats.totalAttempts}</span>
                <span className="text-[10px] text-[var(--text-muted)]">Attempts</span>
              </div>
              <div className="p-4 rounded-2xl border bg-[var(--bg-secondary)]/60 text-center" style={{ borderColor: "var(--border)" }}>
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Average</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono mt-0.5 block">{stats.avgPercentage}%</span>
                <span className="text-[10px] text-[var(--text-muted)]">Accuracy</span>
              </div>
              <div className="p-4 rounded-2xl border bg-[var(--bg-secondary)]/60 text-center" style={{ borderColor: "var(--border)" }}>
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Peak Score</span>
                <span className="text-xl sm:text-2xl font-black text-cyan-400 font-mono mt-0.5 block">{stats.bestScore}%</span>
                <span className="text-[10px] text-[var(--text-muted)]">High Score</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── TWO PRIMARY MODES: APTITUDE ROUND vs APTITUDE ASSESSMENT ── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Card 1: Aptitude Round (Practice Mode) */}
          <motion.div
            whileHover={{ y: -3 }}
            className="p-6 sm:p-8 rounded-[24px] border bg-[var(--card-bg)] shadow-[var(--shadow-card)] flex flex-col justify-between relative overflow-hidden group"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Calculator className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 tracking-wider">
                  Self-Paced Practice
                </span>
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-[var(--text-primary)]">
                  Aptitude Round (Practice Mode)
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                  Interactive problem drills tailored for practice. Select your question count and difficulty distribution. Enjoy step-by-step explanations, bookmarking, and untimed learning.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <div className="p-3 rounded-xl border bg-[var(--bg-secondary)]/40 flex items-center gap-2.5" style={{ borderColor: "var(--border)" }}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs text-[var(--text-secondary)] font-medium">Step-by-step solutions</span>
                </div>
                <div className="p-3 rounded-xl border bg-[var(--bg-secondary)]/40 flex items-center gap-2.5" style={{ borderColor: "var(--border)" }}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs text-[var(--text-secondary)] font-medium">15 / 20 / 30 question papers</span>
                </div>
                <div className="p-3 rounded-xl border bg-[var(--bg-secondary)]/40 flex items-center gap-2.5" style={{ borderColor: "var(--border)" }}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs text-[var(--text-secondary)] font-medium">Easy, Med, Hard Mix</span>
                </div>
                <div className="p-3 rounded-xl border bg-[var(--bg-secondary)]/40 flex items-center gap-2.5" style={{ borderColor: "var(--border)" }}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs text-[var(--text-secondary)] font-medium">No negative marks</span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t flex items-center justify-end gap-4" style={{ borderColor: "var(--border)" }}>
              <button
                type="button"
                onClick={() => navigate("/aptitude/practice")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer shadow-md transition-all hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, #F59E0B 0%, #EA580C 55%, #FF6B35 100%)",
                }}
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Start Practice Round</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>

          {/* Card 2: Aptitude Assessment (Exam Mode) */}
          <motion.div
            whileHover={{ y: -3 }}
            className="p-6 sm:p-8 rounded-[24px] border bg-[var(--card-bg)] shadow-[var(--shadow-card)] flex flex-col justify-between relative overflow-hidden group"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 tracking-wider">
                  Proctored Exam
                </span>
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-[var(--text-primary)]">
                  Aptitude Assessment (Timed Test)
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                  Strict campus examination simulation. Fullscreen proctoring, question palette, Mark for Review, standard negative marking (+1 / -0.25), and auto-submission on timer expiry.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <div className="p-3 rounded-xl border bg-[var(--bg-secondary)]/40 flex items-center gap-2.5" style={{ borderColor: "var(--border)" }}>
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-xs text-[var(--text-secondary)] font-medium">Proctoring Telemetry</span>
                </div>
                <div className="p-3 rounded-xl border bg-[var(--bg-secondary)]/40 flex items-center gap-2.5" style={{ borderColor: "var(--border)" }}>
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-xs text-[var(--text-secondary)] font-medium">Negative marking (+1 / -0.25)</span>
                </div>
                <div className="p-3 rounded-xl border bg-[var(--bg-secondary)]/40 flex items-center gap-2.5" style={{ borderColor: "var(--border)" }}>
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-xs text-[var(--text-secondary)] font-medium">Palette & Review Flag</span>
                </div>
                <div className="p-3 rounded-xl border bg-[var(--bg-secondary)]/40 flex items-center gap-2.5" style={{ borderColor: "var(--border)" }}>
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-xs text-[var(--text-secondary)] font-medium">Diagnostic score report</span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t flex items-center justify-end gap-4" style={{ borderColor: "var(--border)" }}>
              <button
                type="button"
                onClick={() => handleLaunchAssessment(APTITUDE_TRACKS[0])}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer shadow-md transition-all hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, #06B6D4 0%, #0284C7 60%, #2563EB 100%)",
                }}
              >
                <Zap className="w-3.5 h-3.5 fill-white" />
                <span>Take Assessment</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        </section>


        {/* ── RECENT APTITUDE ATTEMPTS TABLE ── */}
        <section className="bg-[var(--card-bg)] border border-[var(--border)] rounded-[24px] p-6 sm:p-8 shadow-[var(--shadow-card)] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Recent Aptitude Submissions
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Your recent practice sessions and assessment results
                </p>
              </div>
            </div>

            <Link
              to="/practice/aptitude/history"
              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition"
            >
              <span>View Full History</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loadingHistory ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              Loading recent aptitude submissions...
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-secondary)]/30 space-y-2">
              <Award className="w-8 h-8 mx-auto text-[var(--text-muted)] opacity-60" />
              <p className="text-xs font-semibold text-[var(--text-secondary)]">
                No aptitude attempts recorded yet.
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                Start your first practice round or take a diagnostic assessment above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-[var(--text-muted)] font-semibold uppercase tracking-wider" style={{ borderColor: "var(--border)" }}>
                    <th className="py-3 px-4">Test Title</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Questions</th>
                    <th className="py-3 px-4">Score</th>
                    <th className="py-3 px-4">Accuracy</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {history.slice(0, 5).map((att) => {
                    const isPassed = (att.percentage || 0) >= 60;
                    return (
                      <tr key={att._id} className="hover:bg-[var(--bg-secondary)]/30 transition">
                        <td className="py-3.5 px-4 font-bold text-[var(--text-primary)]">
                          {att.companyName ? `${att.companyName} Aptitude Test` : "General Aptitude Test"}
                        </td>
                        <td className="py-3.5 px-4 text-[var(--text-muted)] font-mono">
                          {timeAgo(att.createdAt)}
                        </td>
                        <td className="py-3.5 px-4 text-[var(--text-secondary)] font-mono">
                          {att.questionCount || 15} Qs
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-[var(--text-primary)]">
                          {att.score} / {att.questionCount}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] font-mono ${
                              isPassed
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/25"
                            }`}
                          >
                            {att.percentage}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => navigate("/practice/aptitude/history")}
                            className="text-xs font-bold text-amber-400 hover:underline cursor-pointer"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── PRE-FLIGHT INSTRUCTION MODAL ── */}
        {rulesModalOpen && selectedAssessment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[var(--card-bg)] border border-[var(--border)] rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl relative"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">
                    {selectedAssessment.title}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Timed Proctoring & Instructions Checklist
                  </p>
                </div>
              </div>

              <div className="space-y-3 p-4 rounded-2xl bg-[var(--bg-secondary)]/60 border text-xs" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[var(--text-muted)]">Duration:</span>
                  <strong className="text-[var(--text-primary)] font-mono">{selectedAssessment.duration}</strong>
                </div>
                <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[var(--text-muted)]">Questions:</span>
                  <strong className="text-[var(--text-primary)] font-mono">{selectedAssessment.questions}</strong>
                </div>
                <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: "var(--border)" }}>
                  <span className="text-[var(--text-muted)]">Marking Scheme:</span>
                  <strong className="text-amber-400 font-mono">+1 mark for correct, -0.25 mark for wrong</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Proctoring:</span>
                  <strong className="text-emerald-400">Fullscreen & Tab Monitoring Active</strong>
                </div>
              </div>

              <div className="space-y-2 text-xs text-[var(--text-secondary)] leading-relaxed">
                <p>• Leaving the fullscreen test window more than 3 times logs an infraction.</p>
                <p>• The test will auto-submit when the countdown reaches 00:00.</p>
                <p>• You can mark questions for review and jump across questions via the palette.</p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRulesModalOpen(false)}
                  className="flex-1 py-3 rounded-xl border text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--border)]/20 cursor-pointer transition"
                  style={{ borderColor: "var(--border)" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmStartAssessment}
                  className="flex-1 py-3 rounded-xl text-xs font-bold text-white shadow-lg cursor-pointer transition hover:opacity-90 flex items-center justify-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, #F59E0B 0%, #EA580C 55%, #FF6B35 100%)",
                  }}
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Start Assessment</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}

      </div>
    </div>
  );
}
