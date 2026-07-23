import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckCircle, XCircle, AlertCircle, Clock, BarChart, FileText,
  Award, Home, RefreshCw, TrendingUp,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";

function TestResult() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const token = getAuthToken();

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get(`/api/student/tests/attempt/${attemptId}/result`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setResult(data);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [attemptId, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-8">
          <XCircle className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--badge-error-text)" }} />
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Result Not Found</h2>
          <button onClick={() => navigate("/dashboard")}
            className="mt-4 px-4 py-2 text-xs font-medium text-white rounded-xl"
            style={{ background: "var(--primary)" }}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const { attempt, test } = result;
  const percentage = attempt.percentage || 0;
  const passed = attempt.passed;

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
              ["Total Score", `${attempt.totalScore} / ${attempt.totalMarks}`],
              ["Percentage", `${percentage}%`],
              ["Passing Marks", `${test?.passingMarks || 40}%`],
              ["Status", passed ? "Passed" : "Failed"],
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

          {attempt.status === "auto_submitted" && (
            <div className="p-3 rounded-xl text-xs flex items-center gap-2" style={{ background: "var(--badge-warning-bg)", color: "var(--badge-warning-text)" }}>
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Auto-submitted: {attempt.autoSubmitReason || "Unknown reason"}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button onClick={() => navigate("/dashboard")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border admin-border rounded-xl admin-hover cursor-pointer">
              <Home className="w-3.5 h-3.5" /> Go to Dashboard
            </button>
            <button onClick={() => navigate("/tests")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-white rounded-xl cursor-pointer"
              style={{ background: "var(--primary)" }}>
              <FileText className="w-3.5 h-3.5" /> View All Tests
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default TestResult;
