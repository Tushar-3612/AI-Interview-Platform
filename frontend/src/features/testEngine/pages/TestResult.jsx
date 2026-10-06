import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Award,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  FileText,
  Target,
  Sparkles,
  HelpCircle,
  Layers,
  Flag,
  MinusCircle,
  CircleDot,
  ShieldCheck,
  ShieldAlert,
  BookOpen,
  Code2,
  ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../../../core/api/api.js";
import { getAuthToken } from "../../student/hooks/useStudentProfile.js";
import { formatDate } from "../../../core/utils/dateUtils.js";

/**
 * PrepHire Circular / Donut Score Visualizer
 * Fully responsive to Light and Dark themes
 */
function CircularScoreRing({ percentage = 0, obtained = 0, total = 0, passed = false }) {
  const radius = 76;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * Math.min(100, Math.max(0, percentage))) / 100;

  const strokeColor = passed ? "#10b981" : "#FF6B35";

  return (
    <div className="relative flex items-center justify-center shrink-0">
      <svg className="w-44 h-44 sm:w-48 sm:h-48 transform -rotate-90" viewBox="0 0 180 180">
        {/* Background Track — Adapts dynamically to light/dark border token */}
        <circle
          cx="90"
          cy="90"
          r={radius}
          stroke="var(--border)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Active Progress Arc */}
        <motion.circle
          cx="90"
          cy="90"
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>

      {/* Center Label Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-3xl sm:text-4xl font-black tracking-tight text-[var(--text-primary)] font-mono"
        >
          {percentage}%
        </motion.span>
        <span className="text-xs font-bold text-[var(--text-secondary)] font-mono mt-0.5">
          {obtained} / {total}
        </span>
        <span
          className="text-[10px] font-extrabold uppercase tracking-widest mt-1 px-2 py-0.5 rounded-full"
          style={{
            background: passed ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 107, 53, 0.15)",
            color: passed ? "#10b981" : "#FF6B35",
          }}
        >
          SCORE
        </span>
      </div>
    </div>
  );
}

/**
 * PrepHire Production Test Result Page
 * Seamlessly supports both Light & Dark themes via application design tokens
 */
export default function TestResult() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const token = getAuthToken();

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retaking, setRetaking] = useState(false);
  const [copiedAttemptId, setCopiedAttemptId] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const fetchResult = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/api/student/tests/attempt/${attemptId}/result`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setResult(data);
    } catch (err) {
      console.error("Fetch result error:", err);
      setError(err?.response?.data?.message || err?.message || "Failed to load assessment result");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (attemptId) {
      fetchResult();
    }
  }, [attemptId, token]);

  const handleCopyAttemptId = () => {
    if (!attemptId) return;
    navigator.clipboard.writeText(attemptId);
    setCopiedAttemptId(true);
    toast.success("Attempt ID copied to clipboard");
    setTimeout(() => setCopiedAttemptId(false), 2000);
  };

  const handleRetake = async () => {
    const testId = result?.test?._id;
    if (!testId) {
      navigate("/tests");
      return;
    }
    setRetaking(true);
    try {
      const { data } = await api.post(
        `/api/student/tests/${testId}/start`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data?.attempt?._id) {
        toast.success("Starting new test attempt!");
        navigate(`/tests/attempt/${data.attempt._id}`, {
          state: { test: data.test, attempt: data.attempt },
        });
      } else {
        navigate(`/tests/attempt/${testId}`);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to start retake");
    } finally {
      setRetaking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-[var(--text-primary)] space-y-4">
        <div className="w-10 h-10 border-3 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold tracking-wider text-[var(--text-secondary)] uppercase">
          Calculating Assessment Performance...
        </p>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-8 text-center space-y-5 shadow-[var(--shadow-card)]">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-500">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
              {error ? "Unable to Load Result" : "Result Not Found"}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed">
              {error || "The requested assessment attempt could not be found or has not completed processing."}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={fetchResult}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border border-[var(--border)] hover:border-[var(--primary)]/40 bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-xl transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Try Again
            </button>
            <button
              type="button"
              onClick={() => navigate("/tests")}
              className="px-4 py-2.5 text-xs font-bold text-white rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition cursor-pointer shadow-md shadow-[var(--primary)]/20"
            >
              Back to My Tests
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { attempt, test, sections = [], questions = [], canRetake } = result;
  const percentage = Math.round(Number(attempt.percentage) || 0);
  const passed = Boolean(attempt.passed);
  const totalQuestions = questions.length || (sections.reduce((acc, s) => acc + (s.totalQuestions || 0), 0)) || (attempt.answered + attempt.skipped + attempt.notVisited) || 15;

  // Breakdown counts
  const correctCount = questions.filter(q => q.status === "correct").length || sections.reduce((a, s) => a + (s.correct || 0), 0) || Math.round((percentage / 100) * totalQuestions);
  const wrongCount = questions.filter(q => q.status === "wrong").length || sections.reduce((a, s) => a + (s.wrong || 0), 0) || Math.max(0, attempt.answered - correctCount);
  const skippedCount = Number(attempt.skipped) || questions.filter(q => q.status === "skipped").length || 0;
  const markedCount = Number(attempt.marked) || 0;
  const notVisitedCount = Number(attempt.notVisited) || Math.max(0, totalQuestions - attempt.answered - skippedCount);

  // Formatted date
  const testDateFormatted = attempt.submittedAt
    ? new Date(attempt.submittedAt).toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : attempt.startTime
    ? new Date(attempt.startTime).toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Recently";

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] pb-16 antialiased transition-colors duration-300">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pt-2">
        
        {/* ══════════════════════════════════════════════════════════════════════════
            1. BREADCRUMBS & TOP NAVIGATION
        ══════════════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <nav className="flex items-center gap-2 text-xs text-[var(--text-secondary)]" aria-label="Breadcrumb">
            <Link to="/dashboard" className="hover:text-[var(--text-primary)] transition">Workspace</Link>
            <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <Link to="/tests" className="hover:text-[var(--text-primary)] transition">My Tests</Link>
            <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="font-semibold text-[var(--primary)]">Test Result</span>
          </nav>

          <Link
            to="/tests"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-[var(--border)] hover:border-[var(--primary)]/40 bg-[var(--card-bg)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Tests
          </Link>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════════
            2. RESULT HERO SECTION (SCORE + OUTCOME & ATTEMPT INFO)
        ══════════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Main Hero Card: Score & Outcome */}
          <div className="lg:col-span-7 xl:col-span-8 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 shadow-[var(--shadow-card)] flex flex-col md:flex-row items-center gap-6 sm:gap-8 relative overflow-hidden">
            
            {/* Background Glow */}
            <div
              className="absolute -top-24 -left-24 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-15 dark:opacity-25"
              style={{ background: passed ? "#10b981" : "#FF6B35" }}
            />

            {/* Circular Donut Visualization */}
            <CircularScoreRing
              percentage={percentage}
              obtained={attempt.totalScore}
              total={attempt.totalMarks}
              passed={passed}
            />

            {/* Outcome Details & Actions */}
            <div className="flex-1 text-center md:text-left space-y-3 relative z-10">
              <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                    passed
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
                  }`}
                >
                  {passed ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Passed
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" /> Not Passed
                    </>
                  )}
                </span>
                
                {test?.testType && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-secondary)] capitalize">
                    {test.testType} Assessment
                  </span>
                )}
              </div>

              <div>
                <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight">
                  {test?.title || "Assessment Evaluation"}
                </h1>
                <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed max-w-lg">
                  {passed
                    ? `Congratulations! You successfully surpassed the passing threshold of ${attempt.passingPercentage || 40}% with a total score of ${attempt.totalScore} out of ${attempt.totalMarks} marks.`
                    : `You achieved ${percentage}% on this assessment. The passing threshold is ${attempt.passingPercentage || 40}% (${attempt.passingMarks || Math.round((attempt.totalMarks * (attempt.passingPercentage || 40)) / 100)} marks). Review your section breakdown below to target areas for improvement.`}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReview(prev => !prev)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border border-[var(--border)] hover:border-[var(--primary)]/40 bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-xl transition cursor-pointer shadow-sm"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>{showReview ? "Hide Solutions" : "Review Answers"}</span>
                </button>

                {canRetake && (
                  <button
                    type="button"
                    onClick={handleRetake}
                    disabled={retaking}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-[0.99] transition cursor-pointer shadow-lg shadow-[var(--primary)]/20 disabled:opacity-50"
                  >
                    {retaking ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Starting Retake...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retake Test ({result.attemptsRemaining || 1} left)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Hero Card: Attempt Information */}
          <div className="lg:col-span-5 xl:col-span-4 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--shadow-card)] flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[var(--primary)]" />
                  <span>Attempt Information</span>
                </h3>
                <span className="text-[11px] font-mono text-[var(--text-muted)]">
                  #{attempt.attemptCount || 1} Attempt
                </span>
              </div>

              <div className="divide-y divide-[var(--border)] text-xs">
                {/* Attempt ID */}
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">Attempt ID</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[var(--text-primary)] text-[11px]">
                      {attempt._id ? `${String(attempt._id).slice(0, 10)}...` : "—"}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyAttemptId}
                      className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded hover:bg-[var(--bg-primary)] transition cursor-pointer"
                      title="Copy full Attempt ID"
                    >
                      {copiedAttemptId ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {/* Test Date */}
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">Test Date</span>
                  <span className="font-medium text-[var(--text-primary)]">{testDateFormatted}</span>
                </div>

                {/* Duration */}
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">Duration</span>
                  <span className="font-medium text-[var(--text-primary)]">{test?.duration || 30} Minutes</span>
                </div>

                {/* Status */}
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">Evaluation Status</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 capitalize">
                    {passed ? "Passed" : "Completed"}
                  </span>
                </div>

                {/* Submission Mode */}
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">Submission Mode</span>
                  {attempt.status === "auto_submitted" ? (
                    <span className="font-semibold text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Auto-Submitted
                    </span>
                  ) : (
                    <span className="font-medium text-[var(--text-secondary)]">Normal Submission</span>
                  )}
                </div>

                {/* Auto-Submit Reason (if present) */}
                {attempt.status === "auto_submitted" && attempt.autoSubmitReason && (
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]">Trigger Reason</span>
                    <span className="text-amber-600 dark:text-amber-300 font-medium text-[11px]">
                      {attempt.autoSubmitReason}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Proctoring Integrity Summary */}
            <div className="pt-2">
              <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-[var(--text-secondary)] text-[11px] font-medium">Proctoring Telemetry</span>
                </div>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {attempt.tabSwitchCount ? `${attempt.tabSwitchCount} Departures` : "Verified Secure"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════════
            3. PERFORMANCE METRICS (5 CARDS GRID)
        ══════════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* Correct */}
          <div className="bg-[var(--card-bg)] border border-emerald-500/30 dark:border-emerald-500/20 rounded-2xl p-4 sm:p-5 space-y-2 shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Correct</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{correctCount}</p>
            <p className="text-[11px] text-[var(--text-muted)] font-medium">+{attempt.totalScore} marks earned</p>
          </div>

          {/* Incorrect */}
          <div className="bg-[var(--card-bg)] border border-red-500/30 dark:border-red-500/20 rounded-2xl p-4 sm:p-5 space-y-2 shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Incorrect</span>
              <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400">
                <XCircle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-red-600 dark:text-red-400 font-mono">{wrongCount}</p>
            <p className="text-[11px] text-[var(--text-muted)] font-medium">Zero / negative marks</p>
          </div>

          {/* Skipped */}
          <div className="bg-[var(--card-bg)] border border-amber-500/30 dark:border-amber-500/20 rounded-2xl p-4 sm:p-5 space-y-2 shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Skipped</span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <MinusCircle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">{skippedCount}</p>
            <p className="text-[11px] text-[var(--text-muted)] font-medium">Explicitly bypassed</p>
          </div>

          {/* Marked for Review */}
          <div className="bg-[var(--card-bg)] border border-purple-500/30 dark:border-purple-500/20 rounded-2xl p-4 sm:p-5 space-y-2 shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Marked</span>
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Flag className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">{markedCount}</p>
            <p className="text-[11px] text-[var(--text-muted)] font-medium">Flagged for review</p>
          </div>

          {/* Not Visited / Remaining */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 space-y-2 shadow-[var(--shadow-sm)] col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Unattempted</span>
              <div className="w-7 h-7 rounded-lg bg-[var(--bg-primary)] flex items-center justify-center text-[var(--text-secondary)]">
                <CircleDot className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-[var(--text-primary)] font-mono">{notVisitedCount}</p>
            <p className="text-[11px] text-[var(--text-muted)] font-medium">Unanswered questions</p>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════════
            4. SECTION-WISE PERFORMANCE & RIGHT-SIDE INSIGHTS
        ══════════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* LEFT (8 Cols): SECTION-WISE PERFORMANCE TABLE */}
          <div className="lg:col-span-8 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--shadow-card)] space-y-5">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--primary)]" />
                <span>Section-Wise Performance</span>
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Detailed breakdown of your accuracy and score in each topic section.
              </p>
            </div>

            {sections.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
                      <th className="pb-3 font-semibold">Section</th>
                      <th className="pb-3 font-semibold text-center">Questions</th>
                      <th className="pb-3 font-semibold text-center">Correct</th>
                      <th className="pb-3 font-semibold text-center">Incorrect</th>
                      <th className="pb-3 font-semibold text-center">Score</th>
                      <th className="pb-3 font-semibold text-right pr-2">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {sections.map((sec, idx) => {
                      const secAcc = Math.round(Number(sec.percentage) || 0);
                      let accColor = "text-emerald-600 dark:text-emerald-400";
                      let barColor = "bg-emerald-500";
                      if (secAcc < 40) {
                        accColor = "text-red-600 dark:text-red-400";
                        barColor = "bg-red-500";
                      } else if (secAcc < 70) {
                        accColor = "text-amber-600 dark:text-amber-400";
                        barColor = "bg-amber-500";
                      }

                      return (
                        <tr key={idx} className="hover:bg-[var(--bg-primary)]/50 transition">
                          <td className="py-3.5 font-semibold text-[var(--text-primary)] capitalize">
                            {sec.section || `Topic ${idx + 1}`}
                          </td>
                          <td className="py-3.5 text-center font-mono text-[var(--text-secondary)]">
                            {sec.totalQuestions}
                          </td>
                          <td className="py-3.5 text-center font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                            {sec.correct ?? 0}
                          </td>
                          <td className="py-3.5 text-center font-mono text-red-600 dark:text-red-400">
                            {sec.wrong ?? 0}
                          </td>
                          <td className="py-3.5 text-center font-mono font-medium text-[var(--text-primary)]">
                            {sec.obtainedMarks} / {sec.totalMarks}
                          </td>
                          <td className="py-3.5 text-right pr-2">
                            <div className="inline-flex items-center justify-end gap-2.5 min-w-[110px]">
                              <div className="w-16 h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden border border-[var(--border)]">
                                <div
                                  className={`h-full ${barColor} rounded-full`}
                                  style={{ width: `${secAcc}%` }}
                                />
                              </div>
                              <span className={`font-mono font-bold text-xs ${accColor}`}>
                                {secAcc}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-[var(--text-secondary)] text-xs">
                No section grouping configured for this assessment. Overall performance is displayed above.
              </div>
            )}
          </div>

          {/* RIGHT (4 Cols): OVERALL INSIGHTS & NEXT STEPS */}
          <div className="lg:col-span-4 space-y-5">
            
            {/* Overall Insights Card */}
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--shadow-card)] space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
                <Target className="w-4 h-4 text-[var(--primary)]" />
                <span>Overall Insights</span>
              </h3>

              <div className="divide-y divide-[var(--border)] text-xs">
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">Total Questions</span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">{totalQuestions}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">Attempted Questions</span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">{attempt.answered} / {totalQuestions}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">Overall Accuracy</span>
                  <span className={`font-mono font-bold ${passed ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--primary)]"}`}>
                    {percentage}%
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">Passing Benchmark</span>
                  <span className="font-mono font-medium text-[var(--text-secondary)]">
                    {attempt.passingPercentage || 40}% ({attempt.passingMarks || 0} marks)
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">Final Outcome</span>
                  <span className={`font-bold ${passed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {passed ? "Passed" : "Not Passed"}
                  </span>
                </div>
              </div>
            </div>

            {/* Next Recommended Steps Card */}
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--shadow-card)] space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
                <Sparkles className="w-4 h-4 text-[var(--primary)]" />
                <span>Recommended Next Steps</span>
              </h3>

              <div className="space-y-2.5 pt-1">
                {/* 1. Review Answers */}
                <button
                  type="button"
                  onClick={() => setShowReview(true)}
                  className="w-full p-3 rounded-xl bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--primary)]/30 transition text-left flex items-center justify-between cursor-pointer group shadow-sm"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition">
                      1. Review Question Solutions
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)]">Inspect correct answers and explanations</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--primary)] transition shrink-0" />
                </button>

                {/* 2. Practice Weak Topics */}
                <Link
                  to="/interview-practice"
                  className="w-full p-3 rounded-xl bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--primary)]/30 transition text-left flex items-center justify-between cursor-pointer group block shadow-sm"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition">
                      2. Practice Topic Tracker
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)]">Target areas with lowest accuracy</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--primary)] transition shrink-0" />
                </Link>

                {/* 3. Take Another Assessment */}
                <Link
                  to="/tests"
                  className="w-full p-3 rounded-xl bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--primary)]/30 transition text-left flex items-center justify-between cursor-pointer group block shadow-sm"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition">
                      3. Take Another Assessment
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)]">Improve test scores and rankings</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--primary)] transition shrink-0" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════════
            5. DETAILED QUESTION-BY-QUESTION SOLUTION REVIEW
        ══════════════════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {showReview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 shadow-[var(--shadow-card)] space-y-6 overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[var(--primary)]" />
                    <span>Question-by-Question Solution Review</span>
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Review your chosen answers alongside correct answers and detailed explanations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReview(false)}
                  className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-2 rounded-lg hover:bg-[var(--bg-primary)] transition"
                >
                  Close Review
                </button>
              </div>

              {questions.length > 0 ? (
                <div className="space-y-4">
                  {questions.map((q, idx) => {
                    const isCorrect = q.status === "correct";
                    const isSkipped = q.status === "skipped" || (!q.studentAnswer && q.status !== "correct");
                    const isWrong = q.status === "wrong" || (!isCorrect && !isSkipped);

                    let statusBadge = (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                        ✓ Correct (+{q.obtainedMarks || q.marks || 1} mark)
                      </span>
                    );
                    if (isSkipped) {
                      statusBadge = (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                          — Skipped (0 marks)
                        </span>
                      );
                    } else if (isWrong) {
                      statusBadge = (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400">
                          ✕ Incorrect (0 marks)
                        </span>
                      );
                    }

                    return (
                      <div
                        key={idx}
                        className="p-4 sm:p-5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] space-y-3 shadow-sm"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-[var(--primary)] text-white font-black text-xs flex items-center justify-center">
                              {idx + 1}
                            </span>
                            {q.subject && (
                              <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                                {q.subject}
                              </span>
                            )}
                          </div>
                          {statusBadge}
                        </div>

                        {/* Question Text */}
                        <p className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] leading-relaxed">
                          {q.question || `Question ${idx + 1}`}
                        </p>

                        {/* Question Options List */}
                        {q.options && q.options.length > 0 && (
                          <div className="space-y-2 pt-1">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                              Question Options
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              {q.options.map((opt, optIdx) => {
                                const letter = ["A", "B", "C", "D", "E", "F", "G", "H"][optIdx] || String(optIdx + 1);
                                
                                const isOptionMatch = (optText, oIdx, target) => {
                                  if (target === undefined || target === null || target === "") return false;
                                  const strTarget = String(target).trim().toLowerCase();
                                  const strOpt = String(optText).trim().toLowerCase();
                                  const l = (["A", "B", "C", "D", "E", "F", "G", "H"][oIdx] || "").toLowerCase();
                                  if (strTarget === l) return true;
                                  if (strTarget === strOpt) return true;
                                  if (strTarget === String(oIdx)) return true;
                                  const strip = (s) => s.replace(/^[a-h]\s*[:.)-]?\s*/i, "").replace(/^option\s*[a-h]\s*[:.)-]?\s*/i, "").trim();
                                  const sTarget = strip(strTarget);
                                  const sOpt = strip(strOpt);
                                  if (sTarget && sOpt && sTarget === sOpt) return true;
                                  if (sTarget.length > 3 && sOpt.length > 3 && (sOpt.startsWith(sTarget) || sTarget.startsWith(sOpt))) return true;
                                  return false;
                                };

                                const isUserChoice = isOptionMatch(opt, optIdx, q.studentAnswer);
                                const isCorrectChoice = isOptionMatch(opt, optIdx, q.correctAnswer);

                                let optCardClass = "bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-primary)]";
                                let badgeClass = "bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-secondary)]";

                                if (isCorrectChoice) {
                                  optCardClass = "bg-emerald-500/10 border-emerald-500/40 dark:border-emerald-500/30 text-[var(--text-primary)] font-medium";
                                  badgeClass = "bg-emerald-500 text-white font-bold border-transparent";
                                } else if (isUserChoice && !isCorrectChoice) {
                                  optCardClass = "bg-red-500/10 border-red-500/40 dark:border-red-500/30 text-[var(--text-primary)]";
                                  badgeClass = "bg-red-500 text-white font-bold border-transparent";
                                }

                                return (
                                  <div
                                    key={optIdx}
                                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition ${optCardClass}`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <span className={`w-6 h-6 rounded-lg text-xs flex items-center justify-center shrink-0 border ${badgeClass}`}>
                                        {letter}
                                      </span>
                                      <span className="text-xs sm:text-sm leading-relaxed break-words">
                                        {opt}
                                      </span>
                                    </div>

                                    {/* Status Indicators */}
                                    <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-bold">
                                      {isCorrectChoice && (
                                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          <span className="hidden sm:inline">Correct Answer</span>
                                        </span>
                                      )}
                                      {isUserChoice && !isCorrectChoice && (
                                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                                          <XCircle className="w-3.5 h-3.5" />
                                          <span className="hidden sm:inline">Your Answer</span>
                                        </span>
                                      )}
                                      {isUserChoice && isCorrectChoice && (
                                        <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold hidden md:inline">
                                          (Your Selection)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Answer Comparison */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                          <div className="p-3 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Your Answer</span>
                            <p className={`font-semibold ${isCorrect ? "text-emerald-600 dark:text-emerald-400" : isSkipped ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                              {q.studentAnswer ? q.studentAnswer : "(No answer provided)"}
                            </p>
                          </div>
                          <div className="p-3 rounded-lg bg-[var(--card-bg)] border border-emerald-500/30 space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Correct Answer</span>
                            <p className="font-semibold text-emerald-600 dark:text-emerald-300">
                              {q.correctAnswer || "Refer to solution explanation"}
                            </p>
                          </div>
                        </div>

                        {/* Explanation (if provided) */}
                        {q.explanation && (
                          <div className="p-3 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] text-xs space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">Explanation</span>
                            <p className="leading-relaxed text-[var(--text-secondary)]">{q.explanation}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-[var(--text-secondary)] text-xs">
                  Detailed question solutions are not enabled for this assessment attempt.
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
