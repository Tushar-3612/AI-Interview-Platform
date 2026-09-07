import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FileText,
  Clock,
  BookOpen,
  BarChart,
  Play,
  CheckCircle,
  AlertCircle,
  Calendar,
  Search,
  KeyRound,
  History,
  Bell,
  Lock,
  ArrowRight,
  Check,
  User,
  Loader2,
  RefreshCw,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken, useStudentProfile } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

// Mini circular ring for the Placement Readiness card
function MiniCircularRing({ value = 0, size = 36, stroke = 4, color = "#FF6B35" }) {
  const numericVal = Math.min(100, Math.max(0, Number(value) || 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (numericVal / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center select-none shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.08)"
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
            transition: "stroke 300ms ease, stroke-dashoffset 300ms ease",
            filter: `drop-shadow(0 0 5px ${color}66)`,
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-[9.5px] font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
          {numericVal}%
        </span>
      </div>
    </div>
  );
}

function formatDeadline(test) {
  if (test.endAt) {
    const end = new Date(test.endAt);
    const now = new Date();
    const diffHours = Math.round((end - now) / (1000 * 60 * 60));
    if (diffHours < 0) return `Ended ${end.toLocaleDateString([], { month: "short", day: "numeric" })}`;
    if (diffHours <= 24) return `Due in ${Math.max(1, diffHours)}h`;
    return `Due ${end.toLocaleDateString([], { month: "short", day: "numeric" })}`;
  }
  if (test.startAt && test.testStatus === "upcoming") {
    const start = new Date(test.startAt);
    return `Unlocks ${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (test.scheduledAt && test.testStatus === "upcoming") {
    const sch = new Date(test.scheduledAt);
    return `Scheduled ${sch.toLocaleDateString([], { month: "short", day: "numeric" })}`;
  }
  return null;
}

function getTierLabel(score) {
  if (score >= 75) return "Tier 1";
  if (score >= 50) return "Tier 2";
  if (score >= 25) return "Tier 3";
  return "Tier 3";
}

function TestInstructionsModal({ test, onAgree, onClose, starting }) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#101420] text-white rounded-3xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: "rgba(255, 107, 53, 0.12)", color: "#FF6B35" }}
          >
            <FileText className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">{test.title}</h2>
          <p className="text-xs text-gray-400 mt-1">
            {test.companyId ? `Partner: ${test.companyId}` : "PrepHire Assessment Suite"}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5 text-xs text-center">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-gray-400 text-[11px]">Duration</p>
            <p className="font-bold text-sm mt-0.5 text-white">{test.duration || 30} min</p>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-gray-400 text-[11px]">Questions</p>
            <p className="font-bold text-sm mt-0.5 text-white">{test.totalQuestions || 0}</p>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-gray-400 text-[11px]">Total Marks</p>
            <p className="font-bold text-sm mt-0.5 text-white">{test.totalMarks || 0}</p>
          </div>
        </div>

        <div className="text-xs space-y-2 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200">
          <h4 className="font-bold flex items-center gap-1.5 text-amber-400">
            <AlertCircle className="w-4 h-4" /> Proctored Test Rules
          </h4>
          <ul className="space-y-1 text-[11.5px] leading-relaxed text-amber-200/90">
            <li>• Fullscreen mode is strictly enforced throughout the assessment.</li>
            <li>• Tab switches will trigger automatic warnings and eventual auto-submission.</li>
            <li>• Answers are saved in real-time. Timer cannot be paused once started.</li>
          </ul>
        </div>

        <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="w-4 h-4 rounded mt-0.5 accent-[#FF6B35]"
          />
          <span className="text-xs text-gray-300 leading-snug">
            I understand and agree to the proctoring guidelines and promise to maintain academic integrity.
          </span>
        </label>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 text-xs font-bold rounded-xl border border-white/10 hover:bg-white/5 cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAgree}
            disabled={!agreed || starting}
            className="flex-1 py-3 text-xs font-bold text-white rounded-xl cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg transition-all"
            style={{
              background: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)",
            }}
          >
            {starting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-white" />
            )}
            <span>{starting ? "Starting..." : "Start Test"}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function AvailableTests() {
  const navigate = useNavigate();
  const token = getAuthToken();
  const { profile } = useStudentProfile();

  const [tests, setTests] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [instructions, setInstructions] = useState(null);
  const [starting, setStarting] = useState(null);
  const [inviteCode, setInviteCode] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("due_date");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [testsRes, resultsRes] = await Promise.allSettled([
        api.get("/api/student/tests", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        api.get("/api/student/tests/results", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (testsRes.status === "fulfilled" && Array.isArray(testsRes.value.data)) {
        setTests(testsRes.value.data);
      } else {
        setTests([]);
      }

      if (resultsRes.status === "fulfilled" && Array.isArray(resultsRes.value.data)) {
        setResults(resultsRes.value.data);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error("Error loading tests:", err);
      setTests([]);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleStart = async (testId) => {
    setStarting(testId);
    try {
      const { data } = await api.post(
        `/api/student/tests/${testId}/start`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data?.attempt?._id) {
        navigate(`/tests/attempt/${data.attempt._id}`, {
          state: { test: data.test, attempt: data.attempt },
        });
      } else {
        navigate(`/tests/attempt/${testId}`);
      }
    } catch (err) {
      console.error("Failed to start test:", err);
      toast.error(err?.response?.data?.message || "Failed to start test. Please try again.");
    } finally {
      setStarting(null);
      setInstructions(null);
    }
  };

  const handleJoinInviteCode = (e) => {
    e.preventDefault();
    const code = inviteCode.trim();
    if (!code) {
      toast.error("Please enter a valid test ID or code");
      return;
    }
    const matched = tests.find(
      (t) =>
        t._id?.toString() === code ||
        t.assignmentId?.toString() === code ||
        (t.assignValue && t.assignValue.toLowerCase() === code.toLowerCase())
    );
    if (matched) {
      toast.success(`Found test: "${matched.title}"`);
      setSearchQuery(matched.title);
      setInviteCode("");
    } else {
      toast.error("No test found with this invite code. Please check with your instructor.");
    }
  };

  const handleRemindMe = (testTitle) => {
    toast.success(`Reminder set for "${testTitle}"! We'll notify you when it opens.`, {
      icon: "🔔",
    });
  };

  // Filter & Search Logic
  const filteredTests = useMemo(() => {
    let result = [...tests];

    if (activeTab === "active") {
      result = result.filter(
        (t) => t.testStatus === "available" || t.testStatus === "started"
      );
    } else if (activeTab === "upcoming") {
      result = result.filter((t) => t.testStatus === "upcoming");
    } else if (activeTab === "completed") {
      result = result.filter((t) => t.testStatus === "completed");
    } else if (activeTab === "expired") {
      result = result.filter((t) => t.testStatus === "expired");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          (t.title && t.title.toLowerCase().includes(q)) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.testType && t.testType.toLowerCase().includes(q)) ||
          (t.companyId && t.companyId.toLowerCase().includes(q))
      );
    }

    if (sortBy === "marks") {
      result.sort((a, b) => (b.totalMarks || 0) - (a.totalMarks || 0));
    } else if (sortBy === "duration") {
      result.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    } else if (sortBy === "title") {
      result.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } else if (sortBy === "due_date") {
      result.sort((a, b) => {
        const dateA = a.endAt ? new Date(a.endAt).getTime() : Infinity;
        const dateB = b.endAt ? new Date(b.endAt).getTime() : Infinity;
        return dateA - dateB;
      });
    }

    return result;
  }, [tests, activeTab, searchQuery, sortBy]);

  const tabCounts = useMemo(() => {
    return {
      all: tests.length,
      active: tests.filter(
        (t) => t.testStatus === "available" || t.testStatus === "started"
      ).length,
      upcoming: tests.filter((t) => t.testStatus === "upcoming").length,
      completed: tests.filter((t) => t.testStatus === "completed").length,
      expired: tests.filter((t) => t.testStatus === "expired").length,
    };
  }, [tests]);

  // Derived Performance Metrics from Real Data
  const avgScore = useMemo(() => {
    if (!results || results.length === 0) return null;
    const scored = results.filter((r) => typeof r.percentage === "number");
    if (scored.length === 0) return null;
    const sum = scored.reduce((acc, r) => acc + r.percentage, 0);
    return Math.round(sum / scored.length);
  }, [results]);

  const passedCount = useMemo(() => {
    if (!results || results.length === 0) return 0;
    return results.filter((r) => r.isPassed).length;
  }, [results]);

  const readinessScore = profile?.placementReadiness ?? profile?.atsScore ?? 0;
  const tierLabel = getTierLabel(readinessScore);
  const cohortLabel = profile?.batch || profile?.department || profile?.targetRole || "Active Student";

  // Earliest Active Deadline
  const earliestActiveDeadline = useMemo(() => {
    const activeWithDeadlines = tests.filter(
      (t) => (t.testStatus === "available" || t.testStatus === "started") && t.endAt
    );
    if (activeWithDeadlines.length === 0) return null;
    activeWithDeadlines.sort((a, b) => new Date(a.endAt) - new Date(b.endAt));
    const earliest = activeWithDeadlines[0];
    const diffHours = Math.round((new Date(earliest.endAt) - new Date()) / (1000 * 60 * 60));
    if (diffHours < 0) return "Deadline passed";
    if (diffHours <= 24) return `Earliest deadline in ${Math.max(1, diffHours)} hours`;
    return `Earliest deadline ${new Date(earliest.endAt).toLocaleDateString([], { month: "short", day: "numeric" })}`;
  }, [tests]);

  // Next Upcoming Test
  const nextUpcomingTest = useMemo(() => {
    const upcomingList = tests.filter((t) => t.testStatus === "upcoming");
    if (upcomingList.length === 0) return null;
    upcomingList.sort((a, b) => {
      const timeA = a.startAt || a.scheduledAt || 0;
      const timeB = b.startAt || b.scheduledAt || 0;
      return new Date(timeA) - new Date(timeB);
    });
    return upcomingList[0];
  }, [tests]);

  return (
    <div className="w-full max-w-[1400px] mx-auto px-3.5 sm:px-6 lg:px-8 py-3.5 sm:py-6 space-y-3.5 sm:space-y-6 select-none">
      {/* ═══════════════════════════════════════════════
          DESKTOP HEADER: Title + Subtitle + Invite Code
      ═══════════════════════════════════════════════ */}
      <div className="hidden lg:flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
              My Tests
            </h1>
            <span
              className="text-xs font-bold px-3 py-1 rounded-full border"
              style={{
                background: "rgba(255, 107, 53, 0.10)",
                borderColor: "rgba(255, 107, 53, 0.35)",
                color: "#FF6B35",
              }}
            >
              {cohortLabel}
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Tests and real-time assessments assigned to you by your instructors and hiring partners.
          </p>
        </div>

        {/* Invite Code Input */}
        <form onSubmit={handleJoinInviteCode} className="flex items-center gap-2">
          <div
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          >
            <KeyRound className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Enter invite code or test ID..."
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-56 placeholder:text-gray-500"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer transition-transform active:scale-95 shadow-sm"
            style={{
              background: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)",
            }}
          >
            Join
          </button>
        </form>
      </div>

      {/* ═══════════════════════════════════════════════
          MOBILE TOP INVITE BAR
      ═══════════════════════════════════════════════ */}
      <div className="lg:hidden">
        <form onSubmit={handleJoinInviteCode} className="flex items-center gap-2 w-full">
          <div
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs min-w-0"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          >
            <KeyRound className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Enter invite code or test ID..."
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-full placeholder:text-gray-500 min-w-0"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer active:scale-95 shadow-sm shrink-0"
            style={{
              background: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)",
            }}
          >
            Join
          </button>
        </form>
      </div>

      {/* ═══════════════════════════════════════════════
          MOBILE COMPACT STAT ROW (100% Screen-Fitted, No Scroll)
      ═══════════════════════════════════════════════ */}
      <div
        className="lg:hidden p-2 rounded-2xl border grid grid-cols-4 items-center gap-1 w-full"
        style={{
          background: "var(--card-bg)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {/* Chip 1: Readiness */}
        <div className="flex items-center justify-center gap-1.5 py-0.5 border-r border-white/10 min-w-0 pr-1">
          <MiniCircularRing value={readinessScore} size={34} stroke={3.5} color="#FF6B35" />
          <div className="min-w-0 text-left">
            <p className="text-[8.5px] font-bold uppercase tracking-tight text-gray-400 truncate">
              READINESS
            </p>
            <p className="text-[10px] font-extrabold text-[#FF6B35] flex items-center gap-0.5 truncate">
              <span className="w-1 h-1 rounded-full bg-[#FF6B35] shrink-0" />
              <span className="truncate">{tierLabel}</span>
            </p>
          </div>
        </div>

        {/* Chip 2: Active */}
        <div className="flex flex-col items-center justify-center py-0.5 border-r border-white/10 min-w-0 px-0.5">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]" />
            <span className="text-xs font-black" style={{ color: "var(--text-primary)" }}>
              {tabCounts.active}
            </span>
          </div>
          <span className="text-[8.5px] font-bold text-gray-400 mt-0.5">Active</span>
        </div>

        {/* Chip 3: Upcoming */}
        <div className="flex flex-col items-center justify-center py-0.5 border-r border-white/10 min-w-0 px-0.5">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-cyan-400" />
            <span className="text-xs font-black" style={{ color: "var(--text-primary)" }}>
              {tabCounts.upcoming}
            </span>
          </div>
          <span className="text-[8.5px] font-bold text-gray-400 mt-0.5">Upcoming</span>
        </div>

        {/* Chip 4: Completed / Score */}
        <div className="flex flex-col items-center justify-center py-0.5 min-w-0 pl-0.5">
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-emerald-400" />
            <span className="text-xs font-black text-emerald-400">
              {tabCounts.completed}
            </span>
          </div>
          <span className="text-[8.5px] font-bold text-emerald-400/90 mt-0.5 truncate">
            {avgScore != null ? `${avgScore}% avg` : `${tabCounts.completed} Done`}
          </span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          DESKTOP 4 STAT CARDS ROW
      ═══════════════════════════════════════════════ */}
      <div className="hidden lg:grid grid-cols-4 gap-4">
        {/* Card 1: Active Assessments */}
        <div
          className="p-5 rounded-2xl border flex flex-col justify-between transition-all hover:-translate-y-0.5"
          style={{
            background: "var(--card-bg)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="flex items-center justify-between text-[11px] font-bold tracking-wider uppercase text-gray-400">
            <span>ACTIVE ASSESSMENTS</span>
            {tabCounts.active > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B35] animate-pulse" />
            )}
          </div>
          <div className="my-3 flex items-baseline gap-2">
            <span className="text-3xl font-black" style={{ color: "var(--text-primary)" }}>
              {tabCounts.active}
            </span>
            <span className="text-xs font-bold text-[#FF6B35]">
              {tabCounts.active > 0 ? "Require Attention" : "All Caught Up"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400 truncate">
            <Clock className="w-3.5 h-3.5 text-[#FF6B35] shrink-0" />
            <span className="truncate">
              {earliestActiveDeadline || (tabCounts.active > 0 ? "Ready to begin assessment" : "No active pending tests")}
            </span>
          </div>
        </div>

        {/* Card 2: Upcoming Scheduled */}
        <div
          className="p-5 rounded-2xl border flex flex-col justify-between transition-all hover:-translate-y-0.5"
          style={{
            background: "var(--card-bg)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="flex items-center justify-between text-[11px] font-bold tracking-wider uppercase text-gray-400">
            <span>UPCOMING SCHEDULED</span>
            <Calendar className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="my-3 flex items-baseline gap-2">
            <span className="text-3xl font-black" style={{ color: "var(--text-primary)" }}>
              {tabCounts.upcoming}
            </span>
            <span className="text-xs font-bold text-cyan-400">
              {tabCounts.upcoming > 0 ? "Scheduled Ahead" : "None Scheduled"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400 truncate">
            <Lock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">
              {nextUpcomingTest
                ? `${nextUpcomingTest.title} (${formatDeadline(nextUpcomingTest) || "Scheduled"})`
                : "No tests currently scheduled"}
            </span>
          </div>
        </div>

        {/* Card 3: Completed / Expired */}
        <div
          className="p-5 rounded-2xl border flex flex-col justify-between transition-all hover:-translate-y-0.5"
          style={{
            background: "var(--card-bg)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="flex items-center justify-between text-[11px] font-bold tracking-wider uppercase text-gray-400">
            <span>COMPLETED / EXPIRED</span>
            <History className="w-4 h-4 text-gray-400" />
          </div>
          <div className="my-3 flex items-baseline gap-2">
            <span className="text-3xl font-black" style={{ color: "var(--text-primary)" }}>
              {tabCounts.completed + tabCounts.expired}
            </span>
            <span className="text-xs font-bold text-gray-400">
              {tabCounts.completed} Completed • {tabCounts.expired} Closed
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>
              {avgScore != null ? `Average test score: ${avgScore}%` : `${passedCount} tests passed`}
            </span>
          </div>
        </div>

        {/* Card 4: Placement Readiness */}
        <div
          className="p-5 rounded-2xl border flex items-center gap-4 transition-all hover:-translate-y-0.5"
          style={{
            background: "var(--card-bg)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <MiniCircularRing value={readinessScore} size={54} stroke={6} color="#FF6B35" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              PLACEMENT READINESS
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]" />
              <span className="text-xs font-bold text-[#FF6B35]">{tierLabel}</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1 leading-snug">
              Tests elevate your readiness score
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          FILTER TABS & SEARCH / SORT BAR (Screen-Fitted)
      ═══════════════════════════════════════════════ */}
      <div className="space-y-2.5 pt-1">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {[
            { id: "all", label: `All Tests (${tabCounts.all})` },
            { id: "active", label: `Active (${tabCounts.active})` },
            { id: "upcoming", label: `Upcoming (${tabCounts.upcoming})` },
            { id: "completed", label: `Completed (${tabCounts.completed})` },
            { id: "expired", label: `Expired (${tabCounts.expired})` },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold cursor-pointer whitespace-nowrap transition-all"
                style={{
                  background: isActive
                    ? "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)"
                    : "var(--card-bg)",
                  color: isActive ? "#FFFFFF" : "var(--text-secondary)",
                  border: `1px solid ${
                    isActive ? "#FF6B35" : "var(--border)"
                  }`,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search & Sort Controls */}
        <div className="flex items-center gap-2 w-full">
          {/* Search Input */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs flex-1 min-w-0"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          >
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search tests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-full placeholder:text-gray-500 min-w-0"
            />
          </div>

          {/* Sort Dropdown */}
          <div
            className="flex items-center gap-1 px-2.5 sm:px-3 py-2 rounded-xl border text-xs shrink-0"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          >
            <span className="text-gray-400 text-xs hidden sm:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent border-none outline-none text-xs font-bold cursor-pointer pr-1"
              style={{ color: "var(--text-primary)" }}
            >
              <option value="due_date" className="bg-[#101420]">Due Date</option>
              <option value="marks" className="bg-[#101420]">Marks</option>
              <option value="duration" className="bg-[#101420]">Duration</option>
              <option value="title" className="bg-[#101420]">Title</option>
            </select>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          TEST CARDS LIST (Screen-Fitted)
      ═══════════════════════════════════════════════ */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="p-5 sm:p-6 rounded-2xl border animate-pulse space-y-4"
              style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
            >
              <div className="flex justify-between items-center">
                <div className="h-5 w-28 bg-white/10 rounded-full" />
                <div className="h-4 w-20 bg-white/10 rounded-md" />
              </div>
              <div className="h-6 w-2/3 bg-white/10 rounded-md" />
              <div className="h-4 w-full bg-white/5 rounded-md" />
              <div className="h-16 w-full bg-white/5 rounded-xl" />
              <div className="h-11 w-full bg-white/10 rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTests.map((test, idx) => {
            const deadlineText = formatDeadline(test);
            const isLive = test.testStatus === "available";
            const isInProgress = test.testStatus === "started";
            const isUpcoming = test.testStatus === "upcoming";
            const isCompleted = test.testStatus === "completed";
            const isExpired = test.testStatus === "expired";

            const attemptBadgeText =
              test.attemptLimit === 1
                ? "Single Attempt Only"
                : test.attemptLimit > 1
                ? `${test.attemptLimit} Attempts Allowed`
                : "Proctored Environment";

            const testTypeFormatted = test.testType
              ? test.testType.charAt(0).toUpperCase() + test.testType.slice(1)
              : "Assessment";

            return (
              <motion.div
                key={test._id || idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="p-4 sm:p-6 rounded-2xl border transition-all duration-200"
                style={{
                  background: "var(--card-bg)",
                  borderColor: isLive ? "rgba(255, 107, 53, 0.35)" : "var(--border)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <div className="space-y-3">
                  {/* Top Badges & Status Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isLive && (
                        <span className="px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          Live Assessment
                        </span>
                      )}
                      {isInProgress && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          In Progress
                        </span>
                      )}
                      {isUpcoming && (
                        <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          Scheduled
                        </span>
                      )}
                      {isCompleted && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle className="w-3 h-3 text-emerald-400" />
                          Completed
                        </span>
                      )}
                      {isExpired && (
                        <span className="px-2.5 py-0.5 rounded-full bg-gray-500/10 border border-gray-500/30 text-gray-400 flex items-center gap-1.5">
                          <History className="w-3 h-3" />
                          Expired
                        </span>
                      )}

                      <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-300">
                        {attemptBadgeText}
                      </span>
                    </div>

                    {deadlineText && (
                      <span className="text-gray-400 flex items-center gap-1 font-medium text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-[#FF6B35]" />
                        <span>{deadlineText}</span>
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-base sm:text-xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                    {test.title}
                  </h3>

                  {/* Description */}
                  {test.description && (
                    <p className="text-xs sm:text-sm leading-relaxed line-clamp-2 sm:line-clamp-none" style={{ color: "var(--text-secondary)" }}>
                      {test.description}
                    </p>
                  )}

                  {/* Recessed Metadata Box */}
                  <div
                    className="p-3 sm:p-3.5 rounded-xl border text-xs space-y-2"
                    style={{
                      background: "rgba(0, 0, 0, 0.20)",
                      borderColor: "rgba(255, 255, 255, 0.05)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-medium">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <BookOpen className="w-3.5 h-3.5 text-[#FF6B35] shrink-0" />
                        <span className="truncate">{testTypeFormatted}</span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{test.duration || 30} mins</span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <BarChart className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{test.totalMarks || 0} marks</span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{test.totalQuestions || 0} questions</span>
                      </div>
                    </div>

                    {(test.companyId || test.assignValue) && (
                      <div className="pt-1 border-t border-white/5 flex items-center gap-1.5 text-gray-400 text-[11px]">
                        <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">
                          {test.companyId ? `Partner: ${test.companyId}` : `Assigned to: ${test.assignValue}`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Full-width CTA Button */}
                  <div className="pt-1">
                    {isLive && (
                      <button
                        type="button"
                        onClick={() => setInstructions(test)}
                        disabled={starting === test._id}
                        className="w-full py-3 sm:py-3.5 rounded-xl text-xs sm:text-sm font-extrabold text-white flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md active:scale-98 uppercase tracking-wider"
                        style={{
                          background: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)",
                        }}
                      >
                        {starting === test._id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <span>START ASSESSMENT</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    )}

                    {isInProgress && (
                      <button
                        type="button"
                        onClick={() => handleStart(test._id)}
                        disabled={starting === test._id}
                        className="w-full py-3 sm:py-3.5 rounded-xl text-xs sm:text-sm font-extrabold border cursor-pointer transition-all active:scale-98 flex items-center justify-center gap-2 uppercase tracking-wider"
                        style={{
                          background: "rgba(245, 158, 11, 0.12)",
                          borderColor: "rgba(245, 158, 11, 0.40)",
                          color: "#F59E0B",
                        }}
                      >
                        {starting === test._id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-current" />
                            <span>RESUME TEST</span>
                          </>
                        )}
                      </button>
                    )}

                    {isUpcoming && (
                      <button
                        type="button"
                        onClick={() => handleRemindMe(test.title)}
                        className="w-full py-3 rounded-xl text-xs sm:text-sm font-bold border cursor-pointer transition-all active:scale-98 flex items-center justify-center gap-2"
                        style={{
                          background: "rgba(6, 182, 212, 0.08)",
                          borderColor: "rgba(6, 182, 212, 0.35)",
                          color: "#06B6D4",
                        }}
                      >
                        <Bell className="w-4 h-4" />
                        <span>Set Reminder</span>
                      </button>
                    )}

                    {isCompleted && (
                      <button
                        type="button"
                        onClick={() => navigate(`/tests/result/${test.attemptId || test._id}`)}
                        className="w-full py-3 rounded-xl text-xs sm:text-sm font-bold border cursor-pointer transition-all active:scale-98 flex items-center justify-center gap-2"
                        style={{
                          background: "rgba(16, 185, 129, 0.10)",
                          borderColor: "rgba(16, 185, 129, 0.35)",
                          color: "#10B981",
                        }}
                      >
                        <Check className="w-4 h-4" />
                        <span>View Result</span>
                      </button>
                    )}

                    {isExpired && (
                      <button
                        type="button"
                        onClick={() => {
                          if (test.attemptId) {
                            navigate(`/tests/result/${test.attemptId}`);
                          } else {
                            toast.error("This assessment has concluded and is no longer accepting attempts.");
                          }
                        }}
                        className="w-full py-3 rounded-xl text-xs sm:text-sm font-bold border cursor-pointer transition-all active:scale-98 flex items-center justify-center gap-2"
                        style={{
                          background: "rgba(255, 255, 255, 0.04)",
                          borderColor: "rgba(255, 255, 255, 0.10)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {test.attemptId ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>View Submitted Result</span>
                          </>
                        ) : (
                          <>
                            <History className="w-4 h-4" />
                            <span>Assessment Concluded</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}

          {filteredTests.length === 0 && (
            <div
              className="p-10 text-center rounded-2xl border flex flex-col items-center justify-center"
              style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
            >
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3 text-gray-400">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                {tests.length === 0 ? "No Assessments Assigned" : "No Matching Tests Found"}
              </h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                {tests.length === 0
                  ? "You have no assessments assigned at the moment. As soon as your instructors or hiring partners schedule tests, they will appear here."
                  : "Try adjusting your search query or selecting a different tab."}
              </p>
              {tests.length === 0 && (
                <button
                  type="button"
                  onClick={fetchData}
                  className="mt-4 px-4 py-2 rounded-xl border border-white/10 text-xs font-bold text-gray-300 hover:bg-white/5 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh List</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Test Instructions Modal */}
      {instructions && (
        <TestInstructionsModal
          test={instructions}
          starting={starting === instructions._id}
          onAgree={() => handleStart(instructions._id)}
          onClose={() => setInstructions(null)}
        />
      )}
    </div>
  );
}
