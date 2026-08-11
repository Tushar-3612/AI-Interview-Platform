import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";

function InterviewHistory() {
  const token = getAuthToken();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [interviews, setInterviews] = useState([]);
  const [results, setResults] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Tab state - default to "actual" or read from URL
  const activeTab = searchParams.get("tab") || "actual";

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

  // Filter interviews based on tab
  const actualInterviews = interviews.filter(
    (i) => i.interviewType === "actual" && i.status === "completed"
  );
  const mockInterviews = interviews.filter(
    (i) => i.interviewType === "mock"
  );
  
  const completedMockInterviews = mockInterviews.filter((i) => i.status === "completed");
  const inProgressMockInterviews = mockInterviews.filter((i) => i.status === "in_progress");

  const handleTabChange = (tab) => {
    setSearchParams({ tab });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case "in_progress":
        return <Clock className="w-4 h-4 text-amber-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-neutral-400" />;
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Interview History
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Your past interview sessions and evaluations.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 p-1 bg-[var(--bg-primary)] rounded-xl border border-[var(--border)]">
          <button
            onClick={() => handleTabChange("actual")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "actual"
                ? "bg-[var(--card-bg)] shadow-sm text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Briefcase className="w-4 h-4" />
              Actual Interviews
              {actualInterviews.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--primary)] text-white">
                  {actualInterviews.length}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => handleTabChange("mock")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "mock"
                ? "bg-[var(--card-bg)] shadow-sm text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <BrainCircuit className="w-4 h-4" />
              Mock Interviews
              {mockInterviews.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--primary)] text-white">
                  {mockInterviews.length}
                </span>
              )}
            </span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
          </div>
        ) : (
          <>
            {/* Actual Interviews Tab */}
            {activeTab === "actual" && (
              <div className="space-y-4">
                {actualInterviews.length === 0 ? (
                  <div className="student-card p-12 text-center">
                    <History className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                    <p style={{ color: "var(--text-secondary)" }}>No actual interviews yet. Complete a real interview to see it here.</p>
                  </div>
                ) : (
                  actualInterviews.map((item, i) => {
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
                                Interview #{i + 1}
                              </p>
                              <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: "var(--text-muted)" }}>
                                <Calendar className="w-3.5 h-3.5" /> {item.completedAt ? formatDate(item.completedAt) : (item.createdAt ? formatDate(item.createdAt) : "Unknown date")}
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
                  })
                )}
              </div>
            )}

            {/* Mock Interviews Tab */}
            {activeTab === "mock" && (
              <div className="space-y-6">
                {/* Summary */}
                {(completedMockInterviews.length > 0 || inProgressMockInterviews.length > 0) && (
                  <div className="flex gap-4 text-sm">
                    {completedMockInterviews.length > 0 && (
                      <span className="flex items-center gap-1.5 text-emerald-600">
                        <CheckCircle className="w-4 h-4" />
                        {completedMockInterviews.length} Completed
                      </span>
                    )}
                    {inProgressMockInterviews.length > 0 && (
                      <span className="flex items-center gap-1.5 text-amber-600">
                        <Clock className="w-4 h-4" />
                        {inProgressMockInterviews.length} In Progress
                      </span>
                    )}
                  </div>
                )}

                {mockInterviews.length === 0 ? (
                  <div className="student-card p-12 text-center">
                    <History className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                    <p style={{ color: "var(--text-secondary)" }}>No mock interviews yet. Start a practice interview to see it here.</p>
                  </div>
                ) : (
                  mockInterviews.map((item, i) => {
                    const isExpanded = expandedId === item._id;
                    const result = getResultForInterview(item._id);
                    const isCompleted = item.status === "completed";
                    const isInProgress = item.status === "in_progress";

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
                                background: isCompleted
                                  ? "color-mix(in srgb, var(--success) 10%, transparent)"
                                  : isInProgress
                                  ? "color-mix(in srgb, var(--warning) 10%, transparent)"
                                  : "color-mix(in srgb, var(--text-muted) 10%, transparent)",
                              }}
                            >
                              {getStatusIcon(item.status)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>
                                Mock Interview #{i + 1}
                              </p>
                              <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: "var(--text-muted)" }}>
                                <Calendar className="w-3.5 h-3.5" /> {item.createdAt ? formatDate(item.createdAt) : "Unknown date"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              {isCompleted && result ? (
                                <>
                                  <p className="text-sm font-bold" style={{ color: (result.overallScore || 0) >= 70 ? "var(--success)" : "var(--error)" }}>
                                    {result.overallScore || 0}%
                                  </p>
                                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Completed</p>
                                </>
                              ) : isInProgress ? (
                                <>
                                  <p className="text-sm font-bold text-amber-500">In Progress</p>
                                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>No Result Yet</p>
                                </>
                              ) : (
                                <>
                                  <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>--</p>
                                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Not Started</p>
                                </>
                              )}
                            </div>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                          </div>
                        </button>

                        <AnimatePresence>
                          {isExpanded && isCompleted && result && (
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

                          {isExpanded && isInProgress && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t px-6 py-5"
                              style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}
                            >
                              <div className="text-center space-y-3">
                                <Clock className="w-8 h-8 mx-auto text-amber-500" />
                                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                                  This mock interview is in progress
                                </p>
                                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                  Complete the interview to see your results.
                                </p>
                              </div>
                            </motion.div>
                          )}

                          {isExpanded && !isCompleted && !isInProgress && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t px-6 py-5"
                              style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}
                            >
                              <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                                This interview has not been started yet.
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}

export default InterviewHistory;
