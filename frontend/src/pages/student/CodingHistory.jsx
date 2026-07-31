import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Code2, Clock,
  ChevronLeft, ChevronRight, Eye, History,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import { SkeletonCard, ErrorState } from "../../components/ui/Skeleton";
import { timeAgo } from "../../utils/dateUtils";

const STATUS_META = {
  accepted: { label: "Accepted", color: "#22c55e", icon: CheckCircle2 },
  failed: { label: "Failed", color: "#ef4444", icon: XCircle },
  error: { label: "Error", color: "#eab308", icon: AlertTriangle },
  unsupported: { label: "Unsupported", color: "#94a3b8", icon: AlertTriangle },
};

function SubmissionDetail({ submission, onClose }) {
  return (
    <div className="mt-4 border-t pt-4 space-y-3" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Submission Detail</p>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold cursor-pointer hover:opacity-80"
          style={{ color: "var(--primary)" }}
        >
          Close
        </button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {submission.language && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded capitalize" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>
            {submission.language}
          </span>
        )}
        <span className="text-[11px] px-2 py-0.5 rounded" style={{ background: "var(--input-bg)", color: "var(--text-muted)" }}>
          {submission.timeTakenMs >= 1000 ? `${(submission.timeTakenMs / 1000).toFixed(1)}s` : `${submission.timeTakenMs}ms`} taken
        </span>
      </div>
      <pre
        className="p-3 rounded-xl text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-56 overflow-y-auto"
        style={{ background: "var(--code-bg, #0d0d0d)", color: "var(--text-primary)" }}
      >
        {submission.code}
      </pre>
      {(submission.results || []).map((tc, idx) => (
        <div
          key={idx}
          className="text-xs rounded-lg p-2.5"
          style={{
            background: tc.passed ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)",
            color: tc.passed ? "#22c55e" : "#ef4444",
          }}
        >
          <span className="font-semibold">Test {idx + 1} {tc.isHidden ? "(Hidden)" : ""} · {tc.passed ? "Passed" : "Failed"}{tc.timeMs > 0 ? ` · ${tc.timeMs}ms` : ""}</span>
          {!tc.passed && (
            <div className="mt-1 font-mono whitespace-pre-wrap opacity-90">
              {tc.error ? (
                <span>{tc.error}</span>
              ) : (
                <>
                  <div>Input: {tc.input}</div>
                  <div>Expected: {tc.expected}</div>
                  <div>Got: {tc.actual}</div>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CodingHistory() {
  const token = getAuthToken();
  const headers = { Authorization: `Bearer ${token}` };
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchHistory = useCallback(async (pg = 1) => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get("/api/practice/coding/history", { headers, params: { page: pg, limit: 10 } });
      setSubmissions(res.data?.submissions || []);
      setTotal(res.data?.total || 0);
      setPages(res.data?.pages || 0);
      setPage(pg);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(1);
  }, [fetchHistory]);

  const toggleDetail = async (submission) => {
    if (expandedId === submission._id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(submission._id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await api.get(`/api/practice/coding/history/${submission._id}`, { headers });
      setDetail(res.data);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

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
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(139,92,246,0.12)" }}>
          <Code2 className="w-6 h-6" style={{ color: "#8b5cf6" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Coding Submission History</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {total} submission{total === 1 ? "" : "s"} · code and test results
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <ErrorState message="Could not load your coding submissions." onRetry={() => fetchHistory(page)} />
      ) : submissions.length === 0 ? (
        <div className="student-card p-10 text-center">
          <Code2 className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No submissions yet</p>
          <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
            Solve a coding round and your submissions will appear here.
          </p>
          <Link
            to="/interview-practice"
            className="inline-block px-5 py-2 rounded-xl text-xs font-semibold text-white"
            style={{ background: "#6366f1" }}
          >
            Browse Companies
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {submissions.map((sub, idx) => {
              const meta = STATUS_META[sub.status] || STATUS_META.error;
              const StatusIcon = meta.icon;
              return (
                <motion.div key={sub._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                  <div className="student-card p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>
                            {sub.title || "Coding Problem"}
                          </p>
                          {sub.companyName && (
                            <span className="text-[11px] px-2 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>
                              {sub.companyName}
                            </span>
                          )}
                        </div>
                        <p className="text-xs flex items-center gap-3 flex-wrap" style={{ color: "var(--text-muted)" }}>
                          <span>{timeAgo(sub.createdAt)}</span>
                          {sub.language && <span className="capitalize">{sub.language}</span>}
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{(sub.timeTakenMs / 1000).toFixed(1)}s</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold flex items-center gap-1.5 justify-end" style={{ color: meta.color }}>
                          <StatusIcon className="w-4 h-4" />
                          {meta.label}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {sub.passedCount}/{sub.totalCount} tests
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => toggleDetail(sub)}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer hover:opacity-80"
                        style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {expandedId === sub._id ? "Hide Detail" : "View Submission"}
                      </button>
                    </div>
                    {expandedId === sub._id && (
                      detailLoading ? (
                        <div className="mt-4"><SkeletonCard /></div>
                      ) : detail ? (
                        <SubmissionDetail submission={detail} onClose={() => setExpandedId(null)} />
                      ) : (
                        <p className="text-xs mt-4" style={{ color: "#ef4444" }}>Failed to load details.</p>
                      )
                    )}
                  </div>
                </motion.div>
              );
            })}
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

export default CodingHistory;
