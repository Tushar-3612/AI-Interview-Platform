import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  History,
  Calendar,
  ChevronDown,
  ChevronUp,
  BrainCircuit,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  Filter,
  ArrowUpDown,
  ExternalLink,
  Target,
  Code2,
  UserCheck,
  Layers,
  Sparkles,
  Play,
  ArrowRight,
} from "lucide-react";
import api from "../../../core/api/api.js";
import { getAuthToken } from "../../student/hooks/useStudentProfile.js";

function InterviewHistory() {
  const token = getAuthToken();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [historyList, setHistoryList] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters & Sorting state
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | COMPLETED | IN_PROGRESS
  const [sortBy, setSortBy] = useState("NEWEST"); // NEWEST | OLDEST | HIGHEST | LOWEST

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const res = await api.get("/api/student/interviews", { headers }).catch((err) => {
          console.warn("History fetch warning:", err.message);
          return { data: [] };
        });

        const rawList = res.data || [];

        const historyData = (rawList || []).map((item, idx) => {
          const sId = item._id || item.sessionId || item.id;
          const result = item.result || null;
          const normStatus = String(item.status || "").toLowerCase();
          const isCompleted = normStatus === "completed" || result?.status === "COMPLETED";

          const totalObtained = result?.totalObtained != null
            ? result.totalObtained
            : (item.overallScore != null ? item.overallScore : null);
          const maxMarks = result?.maximumMarks || 100;
          const percentage = result?.percentage != null
            ? result.percentage
            : (totalObtained != null ? Math.round((totalObtained / maxMarks) * 100) : null);

          const rounds = result?.rounds || null;

          return {
            id: sId,
            sessionId: sId,
            interviewId: sId,
            attemptNumber: rawList.length - idx,
            startedAt: item.startedAt || item.createdAt,
            completedAt: item.completedAt || result?.completedAt || null,
            status: isCompleted ? "completed" : (normStatus || "in_progress"),
            overallScore: totalObtained,
            percentage,
            maxMarks,
            targetRound: item.targetRound || "all",
            attemptedQuestionsCount: result?.attemptedQuestionsCount ?? 0,
            totalQuestionsCount: result?.totalQuestionsCount ?? 41,
            rounds: rounds
              ? {
                  aptitude: {
                    obtained: rounds.aptitude?.obtained ?? 0,
                    maximum: rounds.aptitude?.maximum ?? 20,
                    attempted: rounds.aptitude?.attempted ?? 0,
                    total: rounds.aptitude?.totalQuestions ?? 15,
                  },
                  technical: {
                    obtained: rounds.technical?.obtained ?? 0,
                    maximum: rounds.technical?.maximum ?? 35,
                    attempted: rounds.technical?.attempted ?? 0,
                    total: rounds.technical?.totalQuestions ?? 15,
                  },
                  project: {
                    obtained: rounds.project?.obtained ?? 0,
                    maximum: rounds.project?.maximum ?? 20,
                    attempted: rounds.project?.attempted ?? 0,
                    total: rounds.project?.totalQuestions ?? 5,
                  },
                  hr: {
                    obtained: rounds.hr?.obtained ?? 0,
                    maximum: rounds.hr?.maximum ?? 10,
                    attempted: rounds.hr?.attempted ?? 0,
                    total: rounds.hr?.totalQuestions ?? 3,
                  },
                  coding: {
                    obtained: rounds.coding?.obtained ?? 0,
                    maximum: rounds.coding?.maximum ?? 15,
                    attempted: rounds.coding?.attempted ?? 0,
                    total: rounds.coding?.totalQuestions ?? 3,
                  },
                }
              : null,
            result,
          };
        });

        setHistoryList(historyData);
      } catch (err) {
        console.error("History fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [token]);

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const formatDate = (d) => {
    if (!d) return "N/A";
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Filter items safely with normalized case
  const filteredList = historyList.filter((item) => {
    const norm = String(item.status || "").toLowerCase();
    if (statusFilter === "COMPLETED") return norm === "completed";
    if (statusFilter === "IN_PROGRESS") return norm === "in_progress" || norm === "submitted";
    return true;
  });

  // Sort items
  const sortedList = [...filteredList].sort((a, b) => {
    if (sortBy === "NEWEST") return new Date(b.startedAt) - new Date(a.startedAt);
    if (sortBy === "OLDEST") return new Date(a.startedAt) - new Date(b.startedAt);
    if (sortBy === "HIGHEST") return (b.overallScore || 0) - (a.overallScore || 0);
    if (sortBy === "LOWEST") return (a.overallScore || 0) - (b.overallScore || 0);
    return 0;
  });

  return (
    <div className="page-container">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        {/* ── PAGE HERO CONTAINER ── */}
        <section className="page-hero space-y-4 mb-6">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border bg-[#FF6B35]/10 border-[#FF6B35]/30 text-[#FF6B35]">
                <History className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[var(--text-primary)]">
                    Real Interview History
                  </h1>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#FF6B35]/15 text-[#FF6B35] border border-[#FF6B35]/30">
                    Proctored Archive
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 max-w-2xl leading-relaxed">
                  Authoritative persistent attempt records, multi-round scorecards, and AI evaluation summaries.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap shrink-0">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                  background: "var(--bg-secondary)",
                }}
              >
                <span>Back to Dashboard</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/mock-interview/history")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer border border-[#FF6B35]/35 bg-[#FF6B35]/10 hover:bg-[#FF6B35]/20 text-[#FF6B35]"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#FF6B35]" />
                <span>Company Mocks History</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </button>
            </div>
          </div>
        </section>

        {/* Filters & Sorting Bar */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 mb-6 p-3 rounded-2xl border"
          style={{
            background: "var(--card-bg)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#FF6B35]" />
            <span className="text-xs font-extrabold uppercase text-[var(--text-muted)]">Status:</span>
            <div
              className="flex gap-1 p-1 rounded-xl border"
              style={{
                background: "var(--bg-secondary)",
                borderColor: "var(--border)",
              }}
            >
              {["ALL", "COMPLETED", "IN_PROGRESS"].map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-extrabold cursor-pointer transition-all ${
                    statusFilter === f
                      ? "bg-[#FF6B35] text-white shadow-md"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {f === "ALL" ? "All Attempts" : f === "COMPLETED" ? "Completed" : "In Progress"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-extrabold uppercase text-[var(--text-muted)]">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border outline-none cursor-pointer"
              style={{
                background: "var(--bg-secondary)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            >
              <option value="NEWEST">Newest First</option>
              <option value="OLDEST">Oldest First</option>
              <option value="HIGHEST">Highest Score</option>
              <option value="LOWEST">Lowest Score</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF6B35]" />
          </div>
        ) : sortedList.length === 0 ? (
          <div
            className="p-12 text-center rounded-3xl border space-y-4"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--border)",
            }}
          >
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto">
              <History className="w-8 h-8 text-[#FF6B35]/60" />
            </div>
            <div>
              <p className="font-black text-base text-[var(--text-primary)]">No Real Interview Attempts Found</p>
              <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
                {statusFilter === "ALL"
                  ? "Launch an end-to-end 5-round Real Interview to build your persistent evaluation record."
                  : `No ${statusFilter.toLowerCase()} interview attempts found matching current filter.`}
              </p>
            </div>
            {statusFilter === "ALL" && (
              <button
                onClick={() => navigate("/dashboard")}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#FF6B35] to-[#FF8A3D] shadow-lg hover:opacity-90 transition cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Real Interview</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {sortedList.map((item, i) => {
              const isExpanded = expandedId === item.id;
              const isCompleted = item.status === "completed";
              const scoreObtained = item.overallScore;
              const pct = item.percentage;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="rounded-2xl border overflow-hidden transition-all shadow-md"
                  style={{
                    background: "var(--card-bg)",
                    borderColor: "var(--border)",
                  }}
                >
                  <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border"
                        style={{
                          backgroundColor: isCompleted ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
                          borderColor: isCompleted ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)",
                        }}
                      >
                        {isCompleted ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <Clock className="w-5 h-5 text-amber-400" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-sm tracking-tight" style={{ color: "var(--text-primary)" }}>
                            REAL INTERVIEW #{String(item.attemptNumber).padStart(2, "0")}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase border"
                            style={{
                              backgroundColor: isCompleted ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                              color: isCompleted ? "#34d399" : "#fbbf24",
                              borderColor: isCompleted ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)",
                            }}
                          >
                            {isCompleted ? "COMPLETED" : "IN PROGRESS"}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium flex items-center gap-1.5 mt-1" style={{ color: "var(--text-muted)" }}>
                          <Calendar className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                          <span>Started: {formatDate(item.startedAt)}</span>
                          {item.completedAt && (
                            <>
                              <span>•</span>
                              <span>Completed: {formatDate(item.completedAt)}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Scores & Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        {isCompleted && scoreObtained != null ? (
                          <>
                            <p className="text-base sm:text-lg font-black font-mono" style={{ color: "var(--text-primary)" }}>
                              <span style={{ color: (pct || 0) >= 60 ? "#34d399" : "#f59e0b" }}>
                                {scoreObtained}
                              </span>
                              <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}> / 100</span>
                            </p>
                            <span className="text-[10px] font-bold block" style={{ color: "var(--text-secondary)" }}>
                              {pct != null ? `${pct}% score` : "Evaluated"}
                            </span>
                          </>
                        ) : isCompleted ? (
                          <>
                            <p className="text-sm font-bold text-emerald-400">Completed</p>
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded" style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
                              Evaluated
                            </span>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-bold text-amber-400">Active</p>
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded" style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
                              In Progress
                            </span>
                          </>
                        )}
                      </div>

                      {/* View Result button */}
                      {isCompleted && (
                        <button
                          onClick={() => navigate(`/interview-history/${item.id}/result`)}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#FF6B35] hover:bg-[#FF8A3D] text-white cursor-pointer transition-all shadow-md hover:shadow-orange-500/20"
                        >
                          <span>View Result</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="p-2 rounded-xl cursor-pointer hover:bg-white/5 transition border"
                        style={{
                          color: "var(--text-secondary)",
                          borderColor: "var(--border)",
                        }}
                        title={isExpanded ? "Collapse" : "Expand Round Breakdown"}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Breakdown */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t p-5 space-y-4"
                        style={{
                          background: "var(--bg-secondary)",
                          borderColor: "var(--border)",
                        }}
                      >
                        {item.rounds ? (
                          <>
                            {/* 5-Round Scorecard Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-center">
                              {/* Aptitude */}
                              <div
                                className="p-3 rounded-xl border"
                                style={{
                                  background: "var(--card-bg)",
                                  borderColor: "var(--border)",
                                }}
                              >
                                <div className="flex items-center justify-center gap-1 text-[10px] font-extrabold uppercase text-amber-400">
                                  <Target className="w-3.5 h-3.5" /> Aptitude
                                </div>
                                <p className="font-mono text-base font-black mt-1.5" style={{ color: "var(--text-primary)" }}>
                                  {item.rounds.aptitude.obtained}
                                  <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}> / {item.rounds.aptitude.maximum}</span>
                                </p>
                                <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
                                  {item.rounds.aptitude.total} questions
                                </span>
                              </div>

                              {/* Technical */}
                              <div
                                className="p-3 rounded-xl border"
                                style={{
                                  background: "var(--card-bg)",
                                  borderColor: "var(--border)",
                                }}
                              >
                                <div className="flex items-center justify-center gap-1 text-[10px] font-extrabold uppercase text-cyan-400">
                                  <BrainCircuit className="w-3.5 h-3.5" /> Technical
                                </div>
                                <p className="font-mono text-base font-black mt-1.5" style={{ color: "var(--text-primary)" }}>
                                  {item.rounds.technical.obtained}
                                  <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}> / {item.rounds.technical.maximum}</span>
                                </p>
                                <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
                                  {item.rounds.technical.total} questions
                                </span>
                              </div>

                              {/* Project / Resume */}
                              <div
                                className="p-3 rounded-xl border"
                                style={{
                                  background: "var(--card-bg)",
                                  borderColor: "var(--border)",
                                }}
                              >
                                <div className="flex items-center justify-center gap-1 text-[10px] font-extrabold uppercase text-violet-400">
                                  <Layers className="w-3.5 h-3.5" /> Project / Resume
                                </div>
                                <p className="font-mono text-base font-black mt-1.5" style={{ color: "var(--text-primary)" }}>
                                  {item.rounds.project.obtained}
                                  <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}> / {item.rounds.project.maximum}</span>
                                </p>
                                <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
                                  {item.rounds.project.total} questions
                                </span>
                              </div>

                              {/* HR */}
                              <div
                                className="p-3 rounded-xl border"
                                style={{
                                  background: "var(--card-bg)",
                                  borderColor: "var(--border)",
                                }}
                              >
                                <div className="flex items-center justify-center gap-1 text-[10px] font-extrabold uppercase text-purple-400">
                                  <UserCheck className="w-3.5 h-3.5" /> HR / Behavioral
                                </div>
                                <p className="font-mono text-base font-black mt-1.5" style={{ color: "var(--text-primary)" }}>
                                  {item.rounds.hr.obtained}
                                  <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}> / {item.rounds.hr.maximum}</span>
                                </p>
                                <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
                                  {item.rounds.hr.total} questions
                                </span>
                              </div>

                              {/* Coding */}
                              <div
                                className="p-3 rounded-xl border"
                                style={{
                                  background: "var(--card-bg)",
                                  borderColor: "var(--border)",
                                }}
                              >
                                <div className="flex items-center justify-center gap-1 text-[10px] font-extrabold uppercase text-emerald-400">
                                  <Code2 className="w-3.5 h-3.5" /> Coding
                                </div>
                                <p className="font-mono text-base font-black mt-1.5" style={{ color: "var(--text-primary)" }}>
                                  {item.rounds.coding.obtained}
                                  <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}> / {item.rounds.coding.maximum}</span>
                                </p>
                                <span className="text-[10px] mt-0.5 block" style={{ color: "var(--text-muted)" }}>
                                  {item.rounds.coding.total} problems
                                </span>
                              </div>
                            </div>

                            {/* Summary footer */}
                            <div
                              className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t gap-3 text-xs"
                              style={{
                                borderColor: "var(--border)",
                                color: "var(--text-secondary)",
                              }}
                            >
                              <span className="flex items-center gap-1.5">
                                <CheckCircle className="w-4 h-4 text-emerald-400" />
                                <span>
                                  Evaluation completed successfully across all 5 rounds (100 Marks scale).
                                </span>
                              </span>
                              <button
                                onClick={() => navigate(`/interview-history/${item.id}/result`)}
                                className="text-xs font-bold text-[#FF6B35] hover:underline cursor-pointer flex items-center gap-1"
                              >
                                <span>Open Full Scorecard Dashboard</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        ) : isCompleted ? (
                          <div className="flex items-center justify-between py-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                            <span className="flex items-center gap-1.5">
                              <AlertCircle className="w-4 h-4 text-amber-400" />
                              <span>Scorecard details are available in the result view.</span>
                            </span>
                            <button
                              onClick={() => navigate(`/interview-history/${item.id}/result`)}
                              className="text-xs font-bold text-[#FF6B35] hover:underline cursor-pointer flex items-center gap-1"
                            >
                              <span>View Scorecard</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="py-2 text-xs text-center" style={{ color: "var(--text-muted)" }}>
                            <span>Session is currently in progress. Complete all rounds and submit to view full AI evaluation.</span>
                          </div>
                        )}
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

