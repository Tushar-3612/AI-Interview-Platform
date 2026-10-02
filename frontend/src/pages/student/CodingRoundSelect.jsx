import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import {
  Code2,
  Play,
  History,
  Timer,
  ArrowRight,
  CheckCircle2,
  Terminal,
  Cpu,
  Layers,
  Flame,
  Zap,
  Award,
  Clock,
  Filter,
} from "lucide-react";

const DIFFICULTY_CONFIG = [
  {
    id: "Easy",
    name: "Easy Track",
    color: "#10B981",
    bg: "rgba(16, 185, 129, 0.08)",
    border: "rgba(16, 185, 129, 0.25)",
    icon: Zap,
    duration: "30-45 mins",
    target: "Beginner & Freshers",
    description: "Core algorithms, strings, basic math, and linear scans.",
  },
  {
    id: "Medium",
    name: "Medium Track",
    color: "#F59E0B",
    bg: "rgba(245, 158, 11, 0.08)",
    border: "rgba(245, 158, 11, 0.25)",
    icon: Flame,
    duration: "45-60 mins",
    target: "Standard OAs",
    description: "Two pointers, binary search, trees, and hash maps.",
  },
  {
    id: "Hard",
    name: "Hard Track",
    color: "#EF4444",
    bg: "rgba(239, 68, 68, 0.08)",
    border: "rgba(239, 68, 68, 0.25)",
    icon: Cpu,
    duration: "60-90 mins",
    target: "Tier-1 & High CTC",
    description: "Dynamic programming, graph algorithms, and edge cases.",
  },
  {
    id: "All",
    name: "Mixed Track",
    color: "#6366F1",
    bg: "rgba(99, 102, 241, 0.08)",
    border: "rgba(99, 102, 241, 0.25)",
    icon: Layers,
    duration: "60 mins",
    target: "Full OA Simulation",
    description: "Balanced multi-tier test replicating full screening rounds.",
  },
];

const LANGUAGES = [
  { id: "python", label: "Python", ext: "py" },
  { id: "cpp", label: "C++", ext: "cpp" },
  { id: "java", label: "Java", ext: "java" },
  { id: "c", label: "C", ext: "c" },
  { id: "javascript", label: "JavaScript", ext: "js" },
];

const QUESTION_LIMIT_OPTIONS = [
  { id: "3", label: "3 Questions", desc: "Standard Test" },
  { id: "5", label: "5 Questions", desc: "Deep Assessment" },
  { id: "all", label: "All Questions", desc: "Full Practice Bank" },
];

export default function CodingRoundSelect() {
  const navigate = useNavigate();
  const token = getAuthToken();
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [selectedDifficulty, setSelectedDifficulty] = useState("Medium");
  const [selectedLanguage, setSelectedLanguage] = useState("python");
  const [questionLimit, setQuestionLimit] = useState("all");
  const [stats, setStats] = useState({ total: 0, byDifficulty: [] });
  const [loadingStats, setLoadingStats] = useState(true);
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Fetch real statistics from database
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setLoadingStats(true);
      try {
        const [statsRes, historyRes] = await Promise.all([
          api.get("/api/coding-questions/stats", { headers: authHeaders }).catch(() => ({ data: null })),
          api.get("/api/practice/coding/history", { headers: authHeaders, params: { limit: 6 } }).catch(() => ({ data: [] })),
        ]);

        if (isMounted) {
          if (statsRes?.data) {
            setStats(statsRes.data);
          }
          const subs = historyRes.data?.submissions || historyRes.data || [];
          setRecentSubmissions(Array.isArray(subs) ? subs : []);
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (isMounted) {
          setLoadingStats(false);
          setLoadingHistory(false);
        }
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [authHeaders]);

  // Map difficulty question counts
  const countMap = useMemo(() => {
    const map = { Easy: 0, Medium: 0, Hard: 0, All: 0 };
    if (stats.byDifficulty && Array.isArray(stats.byDifficulty)) {
      stats.byDifficulty.forEach((item) => {
        const diff = item._id;
        if (map[diff] !== undefined) {
          map[diff] = item.count;
        }
      });
    }
    map.All = (map.Easy || 0) + (map.Medium || 0) + (map.Hard || 0) || stats.total || 0;
    return map;
  }, [stats]);

  const activeTrack = useMemo(() => {
    return DIFFICULTY_CONFIG.find((d) => d.id === selectedDifficulty) || DIFFICULTY_CONFIG[1];
  }, [selectedDifficulty]);

  const handleStartTest = () => {
    const params = new URLSearchParams();
    params.set("difficulty", selectedDifficulty);
    if (selectedLanguage) params.set("lang", selectedLanguage);
    if (questionLimit && questionLimit !== "all") params.set("limit", questionLimit);

    try {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen().catch(() => {});
      }
    } catch {}

    toast.success(`Starting ${activeTrack.name}...`);
    navigate(`/coding-round/test?${params.toString()}`);
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-7 pb-24 lg:pb-8">
      {/* ── TOP HERO HEADER ── */}
      <section className="bg-[var(--card-bg)] border border-[var(--border)] rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 shadow-[var(--shadow-card)] relative overflow-hidden space-y-6">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#06B6D4] to-transparent opacity-90" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-inner"
              style={{
                background: "rgba(6, 182, 212, 0.12)",
                borderColor: "rgba(6, 182, 212, 0.35)",
                color: "#06B6D4",
              }}
            >
              <Code2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
                  Coding Round Assessment
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 max-w-2xl leading-relaxed">
                Select your desired difficulty level to begin. Write solutions in Python, C++, Java, C, or JavaScript with instant testcase evaluation, runtime profiling, and error diagnostics.
              </p>
            </div>
          </div>
        </div>

        {/* ── DIFFICULTY SELECTOR GRID ── */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Filter className="w-4 h-4 text-cyan-400" />
              Select Coding Difficulty <span className="text-cyan-400">*</span>
            </h2>
            <span className="text-xs text-[var(--text-muted)] hidden sm:inline-block">
              Click a card to choose your assessment difficulty
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {DIFFICULTY_CONFIG.map((diff) => {
              const Icon = diff.icon;
              const isSelected = selectedDifficulty === diff.id;
              const questionCount = countMap[diff.id] ?? 0;

              return (
                <motion.div
                  key={diff.id}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelectedDifficulty(diff.id)}
                  className={`relative p-5 rounded-2xl transition-all cursor-pointer flex flex-col justify-between overflow-hidden ${
                    isSelected
                      ? "border-2 shadow-sm"
                      : "border hover:border-[var(--text-muted)]/40 bg-[var(--card-bg)]"
                  }`}
                  style={{
                    borderColor: isSelected ? diff.color : "var(--border)",
                    background: isSelected
                      ? `color-mix(in srgb, ${diff.color} 4%, var(--card-bg))`
                      : "var(--card-bg)",
                  }}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center border"
                        style={{
                          background: diff.bg,
                          borderColor: diff.border,
                          color: diff.color,
                        }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md border"
                          style={{
                            color: diff.color,
                            borderColor: diff.border,
                            background: diff.bg,
                          }}
                        >
                          {loadingStats ? "..." : `${questionCount} Questions`}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-extrabold text-[var(--text-primary)]">
                        {diff.name}
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                        {diff.description}
                      </p>
                    </div>
                  </div>

                  <div
                    className="pt-3 border-t mt-3 flex items-center justify-between text-[11px]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span className="flex items-center gap-1 text-[var(--text-muted)] font-medium">
                      <Timer className="w-3.5 h-3.5" />
                      {diff.duration}
                    </span>
                    <span
                      className="font-semibold px-2 py-0.5 rounded-md text-[10px]"
                      style={{
                        background: diff.bg,
                        color: diff.color,
                        border: `1px solid ${diff.border}`,
                      }}
                    >
                      {diff.target}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── TEST CUSTOMIZATION & OPTIONS BAR ── */}
        <div className="p-4 sm:p-5 rounded-2xl border bg-[var(--bg-secondary)]/40 space-y-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Preferred Language */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                Default Programming Language:
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => setSelectedLanguage(lang.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      selectedLanguage === lang.id
                        ? "bg-[#06B6D4] text-white border-[#06B6D4] shadow-sm shadow-[#06B6D4]/30"
                        : "bg-[var(--card-bg)] text-[var(--text-secondary)] border-[var(--border)] hover:border-cyan-500/40"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Question Count / Mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                Session Question Set:
              </label>
              <div className="flex items-center gap-1.5">
                {QUESTION_LIMIT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setQuestionLimit(opt.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      questionLimit === opt.id
                        ? "bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]"
                        : "bg-[var(--card-bg)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--text-primary)]/40"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── START TEST LAUNCH ACTION ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">Selected Track:</span>
              <span className="text-sm font-extrabold" style={{ color: activeTrack.color }}>
                {activeTrack.name}
              </span>
              <span className="text-[11px] text-[var(--text-secondary)]">
                ({countMap[selectedDifficulty] || 0} questions available)
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Primary Language: <strong className="text-[var(--text-primary)] uppercase">{selectedLanguage}</strong> • Instant testcase scoring enabled.
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleStartTest}
            className="flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl text-sm font-black text-white shadow-lg cursor-pointer transition-all shrink-0"
            style={{
              background: `linear-gradient(135deg, ${activeTrack.color} 0%, #06B6D4 100%)`,
              boxShadow: `0 8px 25px -4px ${activeTrack.glow}`,
            }}
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Start {activeTrack.name} Test</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </motion.button>
        </div>
      </section>

      {/* ── RECENT CODING SUBMISSIONS SECTION ── */}
      <section className="bg-[var(--card-bg)] border border-[var(--border)] rounded-[24px] p-5 sm:p-7 shadow-[var(--shadow-card)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Recent Coding Activity
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Your recent test executions and testcase evaluation results
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/practice/coding/history")}
            className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer transition"
          >
            View Full History
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loadingHistory ? (
          <div className="py-10 text-center text-xs text-[var(--text-muted)]">
            Loading submission history...
          </div>
        ) : recentSubmissions.length === 0 ? (
          <div className="py-10 text-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-secondary)]/30 space-y-2">
            <Award className="w-8 h-8 mx-auto text-[var(--text-muted)] opacity-60" />
            <p className="text-xs font-semibold text-[var(--text-secondary)]">
              No coding test submissions recorded yet.
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
              Select a difficulty above and run your first code test!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentSubmissions.map((sub, idx) => {
              const isAccepted = sub.status === "accepted";
              const passed = sub.passedCount ?? 0;
              const total = sub.totalCount ?? sub.totalTestCases ?? 0;

              return (
                <div
                  key={sub._id || idx}
                  className="p-3.5 rounded-xl border bg-[var(--bg-secondary)]/40 hover:border-cyan-500/30 transition flex flex-col justify-between gap-2"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-[var(--text-primary)] line-clamp-1">
                        {sub.title || "Coding Challenge"}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[var(--text-muted)]">
                        <span className="uppercase font-mono font-semibold text-[10px] px-1.5 py-0.5 rounded bg-[var(--input-bg)] border border-[var(--border)]">
                          {sub.language || "cpp"}
                        </span>
                        <span>•</span>
                        <span>{sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : "Recent"}</span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full capitalize shrink-0 flex items-center gap-1 ${
                        isAccepted
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {isAccepted ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          Accepted
                        </>
                      ) : (
                        "Failed"
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                    <span className="text-[var(--text-muted)]">
                      Testcases: <strong className="text-[var(--text-primary)]">{passed}/{total}</strong>
                    </span>
                    {sub.score !== undefined && (
                      <span className="font-bold text-cyan-400">Score: {sub.score}%</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
