import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Code2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Award,
  ChevronRight,
  RotateCcw,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import { useTheme } from "../../hooks/useTheme";
import toast from "react-hot-toast";

export default function CodingAssessmentHistory() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const token = getAuthToken();

  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/coding/history", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) {
        const list =
          res.data.data?.attempts ||
          res.data.attempts ||
          (Array.isArray(res.data.data) ? res.data.data : []);
        setHistory(list);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load assessment history");
    } finally {
      setLoading(false);
    }
  };

  const totalAttempts = history.length;
  const completedAttempts = history.filter(
    (h) => h.status === "SUBMITTED" || h.status === "AUTO_SUBMITTED"
  );
  const avgScore =
    completedAttempts.length > 0
      ? Math.round(
          completedAttempts.reduce((acc, h) => acc + (h.percentage || 0), 0) /
            completedAttempts.length
        )
      : 0;
  const totalSolved = history.reduce((acc, h) => {
    const solved =
      h.solvedCount ??
      (h.questionProgress || []).filter(
        (q) => q.status === "SOLVED" || (q.marks > 0 && q.passedTests === q.totalTests && q.totalTests > 0)
      ).length;
    return acc + solved;
  }, 0);

  const getStatusBadge = (status) => {
    switch (status) {
      case "SUBMITTED":
        return { label: "Completed", bg: "rgba(16,185,129,0.12)", color: "#10b981", border: "rgba(16,185,129,0.3)" };
      case "AUTO_SUBMITTED":
        return { label: "Auto Submitted", bg: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "rgba(245,158,11,0.3)" };
      case "EXPIRED":
        return { label: "Expired", bg: "rgba(239,68,68,0.12)", color: "#ef4444", border: "rgba(239,68,68,0.3)" };
      default:
        return { label: "In Progress", bg: "rgba(99,102,241,0.12)", color: "#6366f1", border: "rgba(99,102,241,0.3)" };
    }
  };

  return (
    <div
      className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
      style={{ color: "var(--text-primary)" }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/coding-assessments"
              className="text-xs font-semibold flex items-center gap-1 hover:underline"
              style={{ color: "var(--primary)" }}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Assessments
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
            <Code2 className="w-8 h-8 text-indigo-500" />
            Coding Assessment History
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Review your past coding evaluations, test-case scores, and AI recommendations
          </p>
        </div>

        <button
          onClick={fetchHistory}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer border hover:opacity-80"
          style={{
            background: "var(--card-bg)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div
          className="p-5 rounded-2xl border"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Total Assessments
            </span>
            <Award className="w-5 h-5 text-indigo-500" />
          </div>
          <p className="text-3xl font-black mt-2">{totalAttempts}</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {completedAttempts.length} completed
          </p>
        </div>

        <div
          className="p-5 rounded-2xl border"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Avg. Score Percentage
            </span>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-3xl font-black mt-2 text-emerald-500">{avgScore}%</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Across evaluated attempts
          </p>
        </div>

        <div
          className="p-5 rounded-2xl border"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Problems Solved
            </span>
            <CheckCircle2 className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-3xl font-black mt-2">{totalSolved}</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Fully accepted test cases
          </p>
        </div>
      </div>

      {/* Attempts List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-6 rounded-2xl border animate-pulse h-28"
              style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
            />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div
          className="text-center py-16 px-4 rounded-3xl border"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          <Code2 className="w-16 h-16 mx-auto mb-4 opacity-30 text-indigo-500" />
          <h3 className="text-lg font-bold">No Assessment History Found</h3>
          <p className="text-sm mt-1 max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
            You haven't attempted any official coding assessments yet. Take an assessment to evaluate your problem-solving skills!
          </p>
          <Link
            to="/coding-assessments"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl font-bold text-white text-sm shadow-lg shadow-indigo-500/20"
            style={{ background: "var(--primary)" }}
          >
            Explore Coding Assessments
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((attempt) => {
            const attemptId = attempt.id || attempt._id;
            const assessmentId =
              typeof attempt.assessmentId === "object"
                ? attempt.assessmentId?._id
                : attempt.assessmentId;
            const title =
              attempt.assessmentTitle ||
              attempt.assessmentId?.title ||
              "Coding Assessment";
            const duration =
              attempt.durationMinutes || attempt.assessmentId?.durationMinutes || 60;
            const solved =
              attempt.solvedCount ??
              (attempt.questionProgress || []).filter(
                (q) => q.status === "SOLVED" || (q.marks > 0 && q.passedTests === q.totalTests && q.totalTests > 0)
              ).length;
            const questionsCount =
              attempt.questionsCount ?? (attempt.questionProgress || []).length;

            const badge = getStatusBadge(attempt.status);
            const dateStr = attempt.submittedAt || attempt.startedAt;
            const formattedDate = dateStr
              ? new Date(dateStr).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "N/A";

            return (
              <motion.div
                key={attemptId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-2xl border transition-all hover:shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
                style={{
                  background: "var(--card-bg)",
                  borderColor: "var(--border)",
                }}
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-lg font-bold tracking-tight">
                      {title}
                    </h3>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                      style={{
                        background: badge.bg,
                        color: badge.color,
                        borderColor: badge.border,
                      }}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-5 text-xs flex-wrap" style={{ color: "var(--text-muted)" }}>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {formattedDate}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {duration} mins allocated
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Code2 className="w-3.5 h-3.5" />
                      {solved} / {questionsCount} Problems Solved
                    </span>
                  </div>
                </div>

                {/* Score & Actions */}
                <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0" style={{ borderColor: "var(--border)" }}>
                  <div className="text-right">
                    <div className="text-2xl font-black text-indigo-500">
                      {attempt.obtainedMarks ?? 0}
                      <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                        {" "}/ {attempt.totalMarks ?? 0}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-emerald-500">
                      {attempt.percentage ?? 0}% Score
                    </div>
                  </div>

                  {attempt.status === "IN_PROGRESS" ? (
                    <button
                      onClick={() => navigate(`/coding-assessment/${assessmentId}`)}
                      className="px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-md flex items-center gap-2 cursor-pointer transition hover:scale-105"
                      style={{ background: "var(--primary)" }}
                    >
                      Resume Test
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate(`/coding-assessment/result/${attemptId}`)}
                      className="px-5 py-2.5 rounded-xl font-bold text-xs border flex items-center gap-2 cursor-pointer transition hover:opacity-80"
                      style={{
                        background: "rgba(99,102,241,0.08)",
                        borderColor: "rgba(99,102,241,0.3)",
                        color: "#6366f1",
                      }}
                    >
                      View Report
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
