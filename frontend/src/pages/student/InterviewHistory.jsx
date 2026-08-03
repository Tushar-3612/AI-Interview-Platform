import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { History, Calendar, Briefcase, Loader2, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import api from "../../utils/api";

const STATUS_CONFIG = {
  completed: { label: "Completed", icon: CheckCircle2, color: "var(--success)" },
  in_progress: { label: "In Progress", icon: Clock, color: "var(--primary)" },
  pending: { label: "Pending", icon: AlertCircle, color: "var(--warning, #f59e0b)" },
};

function formatDate(dateString) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Interview History — real past interview sessions from the backend.
 */
function InterviewHistory() {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data } = await api.get("/api/interview/user/history");
        setHistory(data);
      } catch (err) {
        console.error("Failed to fetch interview history:", err);
        setError("Could not load interview history. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: "var(--primary)" }} />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Loading your interview history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--error)" }} />
        <p style={{ color: "var(--text-secondary)" }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Interview History
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
          Your past mock interview sessions.
        </p>

        {history.length === 0 ? (
          <div className="student-card p-12 text-center">
            <History className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p style={{ color: "var(--text-secondary)" }}>
              No interviews yet. Start your first interview from the home page.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item, i) => {
              const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
              const StatusIcon = statusCfg.icon;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="student-card p-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* Left — icon + info */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }}
                      >
                        <Briefcase className="w-5 h-5" style={{ color: "var(--primary)" }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>
                          {item.candidateName || "AI Interview"}
                        </p>
                        <p
                          className="text-xs flex items-center gap-1 mt-0.5"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <Calendar className="w-3 h-3 shrink-0" />
                          {formatDate(item.startedAt || item.createdAt)}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <StatusIcon className="w-3.5 h-3.5" style={{ color: statusCfg.color }} />
                          <span className="text-xs font-medium" style={{ color: statusCfg.color }}>
                            {statusCfg.label}
                          </span>
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            &nbsp;·&nbsp;{item.questionsAnswered}/{item.totalQuestions} answered
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right — score */}
                    <div className="text-right shrink-0">
                      {item.overallScore !== null ? (
                        <>
                          <p className="text-lg font-bold" style={{ color: item.overallScore >= 70 ? "var(--success)" : "var(--error)" }}>
                            {item.overallScore}%
                          </p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {item.recommendation || ""}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {item.status === "completed" ? "No score" : "In progress"}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default InterviewHistory;
