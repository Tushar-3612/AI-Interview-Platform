import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckCircle, XCircle, AlertCircle, Clock, BarChart, FileText,
  Award, Home, RefreshCw, TrendingUp,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../../../core/api/api.js";
import { getAuthToken } from "../../student/hooks/useStudentProfile.js";

function TestResult() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const token = getAuthToken();

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retaking, setRetaking] = useState(false);

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
      setError(err?.response?.data?.message || err?.message || "Failed to load test result");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (attemptId) {
      fetchResult();
    }
  }, [attemptId, token]);

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
      <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--bg-primary)" }}>
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Calculating & Loading Assessment Results...</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4" style={{ background: "var(--bg-primary)" }}>
        <div className="text-center p-8 max-w-md w-full border admin-border admin-card rounded-2xl shadow-xl space-y-4">
          <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center" style={{ background: "var(--badge-error-bg)" }}>
            <AlertCircle className="w-8 h-8" style={{ color: "var(--badge-error-text)" }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              {error ? "Unable to Load Result" : "Result Not Found"}
            </h2>
            <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {error || "The requested assessment attempt could not be found or has not been completed yet."}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2.5 pt-2">
            <button
              onClick={fetchResult}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border admin-border rounded-xl admin-hover cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Try Again
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="px-4 py-2 text-xs font-semibold text-white rounded-xl cursor-pointer shadow-md hover:opacity-90"
              style={{ background: "var(--primary)" }}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { attempt, test } = result;
  const percentage = attempt.percentage || 0;
  const passed = attempt.passed;
  const canRetake = Boolean(result.canRetake || ((attempt?.attemptCount || 1) < (test?.attemptLimit || 1)));

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-primary)" }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg border admin-border admin-card rounded-2xl overflow-hidden">
        <div className={`p-6 text-center ${passed ? "bg-emerald-50 dark:bg-emerald-950/10" : "bg-red-50 dark:bg-red-950/10"}`}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: passed ? "var(--badge-success-bg)" : "var(--badge-error-bg)" }}>
            {passed
              ? <Award className="w-8 h-8" style={{ color: "var(--badge-success-text)" }} />
              : <XCircle className="w-8 h-8" style={{ color: "var(--badge-error-text)" }} />
            }
          </div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{test?.title}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{test?.companyId || "Assessment"}</p>
          <div className="mt-4">
            <span className={`text-3xl font-bold ${passed ? "text-emerald-600" : "text-red-600"}`}>{percentage}%</span>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {passed ? "Congratulations! You passed." : "You did not pass this time."}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              ["Your Score", `${attempt.totalScore} / ${attempt.totalMarks}`],
              ["Percentage", `${percentage}%`],
              ["Status", passed ? "Passed" : "Completed"],
              ["Answered", attempt.answered],
              ["Skipped", attempt.skipped],
              ["Marked for Review", attempt.marked],
              ["Not Visited", attempt.notVisited],
            ].map(([l, v]) => (
              <div key={l} className="p-3 rounded-xl admin-bg-surface flex justify-between">
                <span style={{ color: "var(--text-muted)" }}>{l}</span>
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Section Scores Breakdown if multiple sections exist */}
          {Array.isArray(result.sections) && result.sections.length > 0 && (
            <div className="space-y-2 pt-2 border-t admin-table-divider">
              <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>
                Section Performance
              </span>
              <div className="grid gap-2">
                {result.sections.map((sec, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl admin-bg-surface flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize" style={{ color: "var(--text-primary)" }}>
                        {sec.section || `Section ${idx + 1}`}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>
                        {sec.totalQuestions} Questions
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                        {sec.obtainedMarks} / {sec.totalMarks} marks
                      </span>
                      <span className="text-[11px] font-bold" style={{ color: sec.percentage >= 50 ? "var(--badge-success-text)" : "var(--text-muted)" }}>
                        ({sec.percentage}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {attempt.status === "auto_submitted" && (
            <div className="p-3 rounded-xl text-xs flex items-center gap-2" style={{ background: "var(--badge-warning-bg)", color: "var(--badge-warning-text)" }}>
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Auto-submitted: {attempt.autoSubmitReason || "Security or timer limit reached"}
            </div>
          )}

          {canRetake && (
            <div className="p-3 rounded-xl text-xs flex items-center justify-between border border-amber-500/30 bg-amber-500/10 text-amber-300">
              <span className="flex items-center gap-1.5 font-bold">
                <RefreshCw className="w-3.5 h-3.5 text-[#FF6B35]" />
                Retake Available (Attempt {attempt.attemptCount || 1} of {test?.attemptLimit || 2} used)
              </span>
              <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                {Math.max(0, (test?.attemptLimit || 2) - (attempt.attemptCount || 1))} left
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button onClick={() => navigate("/dashboard")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border admin-border rounded-xl admin-hover cursor-pointer">
              <Home className="w-3.5 h-3.5" /> Dashboard
            </button>
            <button onClick={() => navigate("/tests")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border admin-border rounded-xl admin-hover cursor-pointer">
              <FileText className="w-3.5 h-3.5" /> All Tests
            </button>
            {canRetake && (
              <button
                onClick={handleRetake}
                disabled={retaking}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-white rounded-xl cursor-pointer shadow-md transition-all active:scale-95 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)" }}
              >
                {retaking ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retake Test</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default TestResult;
