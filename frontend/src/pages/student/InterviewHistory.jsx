import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  Mail,
  Filter,
  ArrowUpDown,
  ExternalLink,
  Target,
  Code2,
  UserCheck,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";

function InterviewHistory() {
  const token = getAuthToken();
  const navigate = useNavigate();

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
        const { data } = await api.get("/api/interview/history", { headers });
        setHistoryList(data.history || []);
      } catch (err) {
        console.warn("Fetch history notice:", err.message);
        // Fallback to legacy endpoint if history endpoint is buffering
        try {
          const headers = { Authorization: `Bearer ${token}` };
          const { data: legacyInterviews } = await api.get("/api/student/interviews", { headers });
          const { data: legacyResults } = await api.get("/api/student/results", { headers });
          
          const resultMap = {};
          (legacyResults || []).forEach((r) => { resultMap[r.interviewId] = r; });

          const fallbackList = (legacyInterviews || []).map((item, idx) => ({
            id: item._id,
            interviewId: item._id,
            attemptNumber: legacyInterviews.length - idx,
            startedAt: item.createdAt,
            completedAt: item.completedAt,
            status: item.status,
            isEndedEarly: false,
            overallScore: resultMap[item._id]?.overallScore || 0,
            scores: {
              aptitude: resultMap[item._id]?.aptitudeScore || 0,
              technical: resultMap[item._id]?.technicalScore || 0,
              coding: resultMap[item._id]?.codingScore || 0,
              hr: resultMap[item._id]?.hrScore || 0,
            },
            emailStatus: resultMap[item._id]?.email?.status || "SIMULATED",
            result: resultMap[item._id] || null,
          }));

          setHistoryList(fallbackList);
        } catch (fallbackErr) {
          console.error("Fallback history error:", fallbackErr);
        }
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
    });
  };

  // Filter items
  const filteredList = historyList.filter((item) => {
    if (statusFilter === "COMPLETED") return item.status === "completed";
    if (statusFilter === "IN_PROGRESS") return item.status === "in_progress" || item.status === "IN_PROGRESS";
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black mb-1 text-white">
              Interview History
            </h1>
            <p className="text-xs text-white/50">
              Persistent attempt records and evaluation scorecards.
            </p>
          </div>
        </div>

        {/* Filters & Sorting Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 p-3 rounded-2xl bg-slate-900/80 border border-white/10">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-extrabold uppercase text-white/50">Status:</span>
            <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
              {["ALL", "COMPLETED", "IN_PROGRESS"].map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-extrabold cursor-pointer transition-all ${
                    statusFilter === f
                      ? "bg-blue-600 text-white shadow-md"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  {f === "ALL" ? "All Attempts" : f === "COMPLETED" ? "Completed" : "In Progress"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-extrabold uppercase text-white/50">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-950 border border-white/10 text-white/90 outline-none cursor-pointer"
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
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : sortedList.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-slate-900/60 border border-white/10">
            <History className="w-10 h-10 mx-auto mb-3 text-white/30" />
            <p className="text-white/70 font-bold text-sm">No interview attempts found.</p>
            <p className="text-xs text-white/40 mt-1">
              Start an interview session to build your persistent interview history.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedList.map((item, i) => {
              const isExpanded = expandedId === item.id;
              const isCompleted = item.status === "completed";
              const overallPct = item.overallScore || 0;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-2xl bg-slate-900/90 border border-white/10 overflow-hidden transition-all hover:border-white/20"
                >
                  <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                        style={{
                          backgroundColor: isCompleted ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
                          borderColor: isCompleted ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)",
                        }}
                      >
                        {isCompleted ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <Clock className="w-5 h-5 text-amber-400" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-white">
                            INTERVIEW #{String(item.attemptNumber).padStart(2, "0")}
                          </span>
                          {item.isEndedEarly && (
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              ENDED EARLY
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-medium text-white/40 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {formatDate(item.startedAt)}
                        </p>
                      </div>
                    </div>

                    {/* Scores & Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        {isCompleted ? (
                          <>
                            <p className="text-base font-black font-mono" style={{ color: overallPct >= 70 ? "#34d399" : "#f59e0b" }}>
                              {overallPct}%
                            </p>
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-white/5 text-white/50">
                              COMPLETED
                            </span>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-bold text-amber-400">IN PROGRESS</p>
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-white/5 text-white/50">
                              ACTIVE
                            </span>
                          </>
                        )}
                      </div>

                      {/* View Result button */}
                      {isCompleted && (
                        <button
                          onClick={() => navigate(`/interview-history/${item.id}/result`)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-all shadow-md"
                        >
                          <span>View Result</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}

                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="p-1.5 rounded-lg text-white/40 hover:text-white cursor-pointer hover:bg-white/5 transition"
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
                        className="border-t border-white/10 p-5 bg-slate-950/60 space-y-4"
                      >
                        {/* 4-Round Scores */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                            <div className="flex items-center justify-center gap-1 text-[10px] font-extrabold uppercase text-white/40">
                              <Target className="w-3 h-3 text-amber-400" /> Aptitude
                            </div>
                            <p className="font-mono text-sm font-bold text-white mt-1">{item.scores?.aptitude || 0}%</p>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                            <div className="flex items-center justify-center gap-1 text-[10px] font-extrabold uppercase text-white/40">
                              <BrainCircuit className="w-3 h-3 text-blue-400" /> Technical
                            </div>
                            <p className="font-mono text-sm font-bold text-white mt-1">{item.scores?.technical || 0}%</p>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                            <div className="flex items-center justify-center gap-1 text-[10px] font-extrabold uppercase text-white/40">
                              <Code2 className="w-3 h-3 text-emerald-400" /> Coding
                            </div>
                            <p className="font-mono text-sm font-bold text-white mt-1">{item.scores?.coding || 0}%</p>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                            <div className="flex items-center justify-center gap-1 text-[10px] font-extrabold uppercase text-white/40">
                              <UserCheck className="w-3 h-3 text-purple-400" /> HR
                            </div>
                            <p className="font-mono text-sm font-bold text-white mt-1">{item.scores?.hr || 0}%</p>
                          </div>
                        </div>

                        {/* Email status banner */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-white/60">
                          <span className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-blue-400" />
                            Email Delivery Status: <strong className="text-emerald-400 uppercase">{item.emailStatus || "SIMULATED"}</strong>
                          </span>
                          {isCompleted && (
                            <button
                              onClick={() => navigate(`/interview-history/${item.id}/result`)}
                              className="text-xs font-bold text-blue-400 hover:underline cursor-pointer"
                            >
                              Open Full Scorecard Dashboard →
                            </button>
                          )}
                        </div>
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
