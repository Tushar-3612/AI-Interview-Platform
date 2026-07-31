import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, CheckCircle2, XCircle, HelpCircle, BarChart3, Clock,
  ChevronLeft, ChevronRight, BrainCircuit, Eye, History, Search,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import { SkeletonAttemptHistory, ErrorState } from "../../components/ui/Skeleton";
import { timeAgo, formatTime } from "../../utils/dateUtils";

const DIFFICULTY_COLORS = { easy: "#22c55e", medium: "#eab308", hard: "#ef4444" };

function AttemptDetail({ attempt, onClose }) {
  return (
    <div className="mt-4 border-t pt-4 space-y-3" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Answer Review</p>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold cursor-pointer hover:opacity-80"
          style={{ color: "var(--primary)" }}
        >
          Close Review
        </button>
      </div>
      {attempt.questions?.map((q, idx) => {
        const isCorrect = q.isCorrect;
        const isSkipped = !q.userAnswer;
        return (
          <div key={q.questionId || idx} className="p-3 rounded-xl" style={{ background: "var(--input-bg)" }}>
            <div className="flex items-start gap-2">
              <div className="mt-0.5 shrink-0">
                {isCorrect ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : isSkipped ? (
                  <HelpCircle className="w-4 h-4 text-yellow-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>
                    Q{idx + 1}
                  </span>
                  {q.difficulty && (
                    <span
                      className="text-[11px] font-semibold px-1.5 py-0.5 rounded capitalize"
                      style={{ background: `${DIFFICULTY_COLORS[q.difficulty]}15`, color: DIFFICULTY_COLORS[q.difficulty] }}
                    >
                      {q.difficulty}
                    </span>
                  )}
                  {q.category && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: "rgba(139,92,246,0.1)", color: "#8b5cf6" }}>
                      {q.category}
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>{q.question}</p>
                <div className="space-y-1">
                  {(q.options || []).map((opt, oi) => {
                    const isUser = q.userAnswer === opt;
                    const isRight = q.correctAnswer === opt;
                    let style = { color: "var(--text-secondary)" };
                    if (isRight) style = { color: "#22c55e", fontWeight: 600 };
                    else if (isUser) style = { color: "#ef4444", fontWeight: 600 };
                    return (
                      <div key={oi} className="text-[11px]" style={style}>
                        {opt}
                        {isRight && " ✓"}
                        {isUser && !isRight && " (your answer)"}
                      </div>
                    );
                  })}
                </div>
                {q.explanation && (
                  <p className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                    <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Explanation: </span>
                    {q.explanation}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AptitudeHistory() {
  const token = getAuthToken();
  const headers = { Authorization: `Bearer ${token}` };
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");

  const fetchHistory = useCallback(async (pg = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/practice/aptitude/history", { headers, params: { page: pg, limit: 10 } });
      setAttempts(res.data?.attempts || []);
      setTotal(res.data?.total || 0);
      setPages(res.data?.pages || 0);
      setPage(pg);
    } catch (err) {
      setError(err.response?.status || "network_failure");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(1);
  }, [fetchHistory]);

  const toggleDetail = async (attempt) => {
    if (expandedId === attempt._id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(attempt._id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await api.get(`/api/practice/aptitude/history/${attempt._id}`, { headers });
      setDetail(res.data);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredAttempts = useMemo(() => {
    return attempts.filter((attempt) => {
      const matchesSearch = (attempt.companyName || attempt.companyId || "Practice")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesDifficulty = difficultyFilter
        ? attempt.difficulty?.toLowerCase() === difficultyFilter.toLowerCase()
        : true;
      return matchesSearch && matchesDifficulty;
    });
  }, [attempts, searchTerm, difficultyFilter]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm font-medium mb-6 cursor-pointer hover:opacity-80"
        style={{ color: "var(--text-secondary)" }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(99,102,241,0.12)" }}>
          <History className="w-6 h-6" style={{ color: "#6366f1" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Aptitude Attempt History</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {total} attempt{total === 1 ? "" : "s"} · review answers and explanations
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by company name..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border text-xs outline-none"
            style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
          />
        </div>
        <div className="relative min-w-[130px]">
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="w-full pl-3 pr-8 py-2 rounded-xl border text-xs font-medium outline-none bg-[var(--input-bg)] cursor-pointer text-[var(--text-secondary)] select"
            style={{ borderColor: "var(--border)" }}
          >
            <option value="">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      {loading ? (
        <SkeletonAttemptHistory count={3} />
      ) : error ? (
        <ErrorState statusCode={error} message="Could not load your attempt history." onRetry={() => fetchHistory(page)} />
      ) : attempts.length === 0 ? (
        <div className="student-card p-10 text-center">
          <BrainCircuit className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No attempts yet</p>
          <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
            Practice an aptitude round and your results will appear here.
          </p>
          <Link
            to="/interview-practice"
            className="inline-block px-5 py-2 rounded-xl text-xs font-semibold text-white"
            style={{ background: "#6366f1" }}
          >
            Browse Companies
          </Link>
        </div>
      ) : filteredAttempts.length === 0 ? (
        <div className="student-card p-10 text-center bg-[var(--card-bg)]">
          <Search className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)]" />
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No matching attempts</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Try clearing filters or search to view your attempts.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {filteredAttempts.map((attempt, idx) => (
              <motion.div key={attempt._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                <div className="student-card p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>
                          {attempt.companyName || attempt.companyId || "Practice"}
                        </p>
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded capitalize"
                          style={{
                            background: `${DIFFICULTY_COLORS[attempt.difficulty] || "#6366f1"}15`,
                            color: DIFFICULTY_COLORS[attempt.difficulty] || "#6366f1",
                          }}
                        >
                          {attempt.difficulty || "mixed"}
                        </span>
                      </div>
                      <p className="text-xs flex items-center gap-3 flex-wrap" style={{ color: "var(--text-muted)" }}>
                        <span>{timeAgo(attempt.createdAt)}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(attempt.timeTaken)}</span>
                        <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" />{attempt.questionCount} questions</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold" style={{ color: attempt.percentage >= 60 ? "#22c55e" : "#ef4444" }}>
                        {attempt.percentage}%
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {attempt.score}/{attempt.questionCount} · C {attempt.correct} W {attempt.wrong} S {attempt.skipped}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleDetail(attempt)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer hover:opacity-80"
                      style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {expandedId === attempt._id ? "Hide Review" : "Review Answers"}
                    </button>
                  </div>
                  {expandedId === attempt._id && (
                    detailLoading ? (
                      <div className="mt-4"><SkeletonCard /></div>
                    ) : detail ? (
                      <AttemptDetail attempt={detail} onClose={() => setExpandedId(null)} />
                    ) : (
                      <p className="text-xs mt-4" style={{ color: "#ef4444" }}>Failed to load details.</p>
                    )
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => fetchHistory(page - 1)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer hover:opacity-80 disabled:opacity-40"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Page {page} of {pages}
              </span>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => fetchHistory(page + 1)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer hover:opacity-80 disabled:opacity-40"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AptitudeHistory;
