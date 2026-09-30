import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code2,
  ArrowLeft,
  Users,
  Search,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  X,
  FileCode,
  Sparkles,
  Calendar,
  RotateCcw,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

export default function AdminCodingResults() {
  const { id } = useParams();
  const token = getAuthToken();
  const headers = { Authorization: `Bearer ${token}` };

  const [assessment, setAssessment] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Inspect Modal State
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectData, setInspectData] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  useEffect(() => {
    fetchResults();
  }, [id]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/admin/coding/assessments/${id}/results`, { headers });
      if (res.data?.success) {
        setAssessment(res.data.data?.assessment || null);
        setResults(res.data.data?.results || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load candidate results");
    } finally {
      setLoading(false);
    }
  };

  const openCandidateInspector = async (attemptId) => {
    try {
      setInspectLoading(true);
      setInspectModalOpen(true);
      const res = await api.get(`/api/admin/coding/attempts/${attemptId}`, { headers });
      if (res.data?.success) {
        setInspectData(res.data.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load candidate submission details");
      setInspectModalOpen(false);
    } finally {
      setInspectLoading(false);
    }
  };

  const filteredResults = results.filter((r) => {
    const nameMatch = r.candidateName?.toLowerCase().includes(search.toLowerCase());
    const emailMatch = r.candidateEmail?.toLowerCase().includes(search.toLowerCase());
    return nameMatch || emailMatch;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case "SUBMITTED":
        return { label: "Completed", bg: "rgba(16,185,129,0.1)", color: "#10b981", border: "rgba(16,185,129,0.3)" };
      case "AUTO_SUBMITTED":
        return { label: "Auto Submitted", bg: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "rgba(245,158,11,0.3)" };
      case "EXPIRED":
        return { label: "Expired", bg: "rgba(239,68,68,0.1)", color: "#ef4444", border: "rgba(239,68,68,0.3)" };
      default:
        return { label: "In Progress", bg: "rgba(99,102,241,0.1)", color: "#6366f1", border: "rgba(99,102,241,0.3)" };
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" style={{ color: "var(--text-primary)" }}>
      {/* Top Header */}
      <div>
        <Link
          to="/admin/coding-assessments"
          className="inline-flex items-center gap-1.5 text-xs font-semibold mb-2 hover:underline"
          style={{ color: "var(--primary)" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Assessments
        </Link>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
              <Users className="w-7 h-7 text-indigo-500" />
              {assessment?.title || "Assessment"} — Candidate Results
            </h1>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {assessment?.durationMinutes} mins allocated · {assessment?.questions?.length || 0} questions · {assessment?.totalMarks || 0} total marks
            </p>
          </div>

          <button
            onClick={fetchResults}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer hover:opacity-80"
            style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-xl border max-w-md"
        style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
      >
        <Search className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
        <input
          type="text"
          placeholder="Filter candidate by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-transparent text-xs focus:outline-none"
        />
      </div>

      {/* Results Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl border animate-pulse"
              style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
            />
          ))}
        </div>
      ) : filteredResults.length === 0 ? (
        <div
          className="text-center py-16 px-4 rounded-3xl border"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30 text-indigo-500" />
          <h3 className="text-base font-bold">No Candidate Submissions Yet</h3>
          <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: "var(--text-muted)" }}>
            When students attempt this assessment, their deterministic Judge0 scores and code submissions will appear here.
          </p>
        </div>
      ) : (
        <div
          className="rounded-2xl border overflow-x-auto"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          <table className="w-full text-left text-xs">
            <thead
              className="border-b uppercase font-semibold text-[10px] tracking-wider"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "rgba(0,0,0,0.02)" }}
            >
              <tr>
                <th className="py-3 px-4">Candidate</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Score</th>
                <th className="py-3 px-4">Solved</th>
                <th className="py-3 px-4">Time Spent</th>
                <th className="py-3 px-4">Submitted At</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
              {filteredResults.map((r) => {
                const badge = getStatusBadge(r.status);
                const minutesSpent = Math.floor((r.timeSpentSeconds || 0) / 60);
                const secondsSpent = (r.timeSpentSeconds || 0) % 60;
                const formattedTime = `${minutesSpent}m ${secondsSpent}s`;

                const dateStr = r.submittedAt
                  ? new Date(r.submittedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "In Progress";

                return (
                  <tr key={r.attemptId} className="hover:bg-slate-500/5 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold">{r.candidateName}</div>
                      <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {r.candidateEmail}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          borderColor: badge.border,
                        }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-indigo-500">
                        {r.obtainedMarks} / {r.totalMarks}
                      </div>
                      <div className="text-[10px] font-semibold text-emerald-500">
                        {r.percentage}%
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold">
                        {r.solvedQuestions} / {r.totalQuestions} Solved
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-400">{formattedTime}</td>
                    <td className="py-3 px-4 text-slate-400">{dateStr}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openCandidateInspector(r.attemptId)}
                        className="px-3 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-80"
                        style={{
                          background: "rgba(99,102,241,0.08)",
                          borderColor: "rgba(99,102,241,0.25)",
                          color: "#6366f1",
                        }}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect Code
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* INSPECTOR MODAL */}
      <AnimatePresence>
        {inspectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-4xl rounded-2xl border p-6 my-8 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl"
              style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--border)" }}>
                <div>
                  <h2 className="text-base font-bold flex items-center gap-2">
                    <FileCode className="w-5 h-5 text-indigo-500" />
                    Candidate Submission Details
                  </h2>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {inspectData?.attempt?.candidateId?.name} ({inspectData?.attempt?.candidateId?.email}) · Final Score: {inspectData?.attempt?.obtainedMarks} / {inspectData?.attempt?.totalMarks} ({inspectData?.attempt?.percentage}%)
                  </p>
                </div>
                <button
                  onClick={() => setInspectModalOpen(false)}
                  className="p-1 rounded-lg hover:opacity-70 cursor-pointer"
                  style={{ color: "var(--text-muted)" }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {inspectLoading ? (
                <div className="py-16 text-center text-xs animate-pulse">Loading candidate details...</div>
              ) : inspectData ? (
                <div className="space-y-6">
                  {/* AI Feedback if available */}
                  {inspectData.attempt?.aiFeedback && (
                    <div
                      className="p-4 rounded-xl border space-y-2"
                      style={{
                        background: "rgba(99,102,241,0.05)",
                        borderColor: "rgba(99,102,241,0.2)",
                      }}
                    >
                      <h4 className="text-xs font-bold flex items-center gap-1.5 text-indigo-500">
                        <Sparkles className="w-4 h-4" /> AI Evaluation Insights
                      </h4>
                      <p className="text-xs">{inspectData.attempt.aiFeedback.approachSummary}</p>
                      <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                        <div>
                          <span className="font-semibold text-slate-400">Time Complexity: </span>
                          <span className="font-mono text-emerald-500">
                            {inspectData.attempt.aiFeedback.timeComplexity}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-400">Space Complexity: </span>
                          <span className="font-mono text-indigo-500">
                            {inspectData.attempt.aiFeedback.spaceComplexity}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Questions and Code Submissions */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Problem Breakdown & Submitted Source Code
                    </h3>

                    {(inspectData.submissions || []).map((sub, idx) => (
                      <div
                        key={sub._id || idx}
                        className="rounded-xl border p-4 space-y-3"
                        style={{ background: "var(--input-bg)", borderColor: "var(--border)" }}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs">
                              Q{idx + 1}: {sub.questionId?.title || "Coding Problem"}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-500/10 capitalize font-mono">
                              {sub.language}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                sub.status === "ACCEPTED"
                                  ? "bg-emerald-500/10 text-emerald-500"
                                  : "bg-rose-500/10 text-rose-500"
                              }`}
                            >
                              {sub.status}
                            </span>
                            <span className="text-xs font-bold text-indigo-500">
                              Score: {sub.score} pts ({sub.passedTests}/{sub.totalTests} tests)
                            </span>
                          </div>
                        </div>

                        {/* Source code preview */}
                        <div>
                          <div className="text-[10px] font-semibold text-slate-400 mb-1">
                            Source Code:
                          </div>
                          <pre
                            className="p-3 rounded-xl text-xs font-mono whitespace-pre overflow-x-auto max-h-60"
                            style={{ background: "#0d0d0d", color: "#f8fafc" }}
                          >
                            {sub.sourceCode || "// No code submitted"}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
