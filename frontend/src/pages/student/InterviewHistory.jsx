import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  History,
  Calendar,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Award,
  BrainCircuit,
  Loader2,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";

function InterviewHistory() {
  const token = getAuthToken();
  const [interviews, setInterviews] = useState([]);
  const [results, setResults] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [interviewsRes, resultsRes] = await Promise.all([
          api.get("/api/student/interviews", { headers }),
          api.get("/api/student/results", { headers }),
        ]);
        setInterviews(interviewsRes.data || []);
        setResults(resultsRes.data || []);
      } catch {
        // data stays empty
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getResultForInterview = (interviewId) => {
    return results.find((r) => r.interviewId === interviewId);
  };

  const formatDate = (d) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const completedInterviews = interviews.filter((i) => i.status === "completed");

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Interview History
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Your past mock placement practice sessions and evaluations.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
          </div>
        ) : completedInterviews.length === 0 ? (
          <div className="student-card p-12 text-center">
            <History className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p style={{ color: "var(--text-secondary)" }}>No interviews yet. Start your first practice from the Practice page.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {completedInterviews.map((item, i) => {
              const isExpanded = expandedId === item._id;
              const result = getResultForInterview(item._id);
              const hasPassed = result && (result.overallScore || 0) >= 70;

              return (
                <motion.div
                  key={item._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="student-card overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpand(item._id)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-neutral-800/10 transition"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          background: result
                            ? "color-mix(in srgb, var(--success) 10%, transparent)"
                            : "color-mix(in srgb, var(--text-muted) 10%, transparent)",
                        }}
                      >
                        <Briefcase
                          className="w-5 h-5"
                          style={{
                            color: result ? "var(--success)" : "var(--text-muted)",
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>
                          Interview #{item._id?.slice(-6)}
                        </p>
                        <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: "var(--text-muted)" }}>
                          <Calendar className="w-3.5 h-3.5" /> {item.createdAt ? formatDate(item.createdAt) : "Unknown date"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold" style={{ color: result ? (hasPassed ? "var(--success)" : "var(--error)") : "var(--text-muted)" }}>
                          {result ? `${result.overallScore || 0}%` : "No result"}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {result ? (hasPassed ? "PASSED" : "FAILED") : "PENDING"}
                        </p>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && result && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t px-6 py-5 space-y-4"
                        style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}
                      >
                        <div className="grid grid-cols-3 gap-2 text-center border-b pb-4" style={{ borderColor: "var(--border)" }}>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-neutral-400">Technical</p>
                            <p className="text-sm font-semibold text-neutral-200 mt-0.5">{result.technicalScore ?? "--"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-neutral-400">Resume</p>
                            <p className="text-sm font-semibold text-neutral-200 mt-0.5">{result.resumeScore ?? "--"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-neutral-400">Coding</p>
                            <p className="text-sm font-semibold text-neutral-200 mt-0.5">{result.codingScore ?? "--"}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div className="space-y-1.5">
                            <h4 className="text-xs font-bold text-neutral-400 flex items-center gap-1.5">
                              <Award className="w-3.5 h-3.5 text-green-500" />
                              Strengths
                            </h4>
                            <ul className="text-xs space-y-1 list-disc pl-4 text-neutral-300">
                              {(result.strengths || []).length > 0
                                ? result.strengths.map((s, idx) => <li key={idx}>{s}</li>)
                                : <li>No strengths recorded</li>}
                            </ul>
                          </div>

                          <div className="space-y-1.5">
                            <h4 className="text-xs font-bold text-neutral-400 flex items-center gap-1.5">
                              <BrainCircuit className="w-3.5 h-3.5 text-red-400" />
                              Areas to Improve
                            </h4>
                            <ul className="text-xs space-y-1 list-disc pl-4 text-neutral-300">
                              {(result.weaknesses || []).length > 0
                                ? result.weaknesses.map((w, idx) => <li key={idx}>{w}</li>)
                                : <li>No improvement areas recorded</li>}
                            </ul>
                          </div>
                        </div>

                        {result.recommendation && (
                          <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Recommendation</p>
                            <p className="text-xs text-neutral-300 italic">{result.recommendation}</p>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {isExpanded && !result && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t px-6 py-5"
                        style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}
                      >
                        <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                          No evaluation result available for this session yet.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
