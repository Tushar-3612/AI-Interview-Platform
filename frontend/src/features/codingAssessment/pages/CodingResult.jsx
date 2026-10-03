import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ArrowRight,
  Code2,
  AlertTriangle,
  RotateCcw,
  Bot,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import api from "../../../core/api/api.js";
import { getAuthToken } from "../../student/hooks/useStudentProfile.js";
import toast from "react-hot-toast";

export default function CodingResult() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const token = getAuthToken();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [expandedQuestion, setExpandedQuestion] = useState(null);

  useEffect(() => {
    const fetchResult = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/api/coding/attempts/${attemptId}/result`, { headers });
        const data = res.data?.data;
        setResult(data);
        if (data?.aiFeedback) {
          setAiFeedback(data.aiFeedback);
        }
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load assessment result.");
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [attemptId, headers]);

  const handleGenerateAiFeedback = async () => {
    setGeneratingAi(true);
    try {
      const res = await api.post(`/api/coding/attempts/${attemptId}/ai-feedback`, {}, { headers });
      setAiFeedback(res.data?.data);
      toast.success("AI feedback generated!");
    } catch (err) {
      toast.error("Failed to generate AI feedback.");
    } finally {
      setGeneratingAi(false);
    }
  };

  const formatSeconds = (sec = 0) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-[var(--text-secondary)]">Computing final score & testcase breakdown...</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-[var(--bg-primary)]">
        <div className="max-w-md w-full p-6 rounded-2xl border text-center space-y-3 bg-[var(--card-bg)]" style={{ borderColor: "var(--border)" }}>
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
          <h2 className="text-base font-bold text-[var(--text-primary)]">Result Not Found</h2>
          <p className="text-xs text-[var(--text-secondary)]">{error || "Unable to retrieve assessment result."}</p>
          <button
            type="button"
            onClick={() => navigate("/coding-assessments")}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 text-white cursor-pointer hover:bg-cyan-600 transition"
          >
            Back to Assessments
          </button>
        </div>
      </div>
    );
  }

  const isPassed = result.percentage >= 60;

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 pb-24">
      {/* ── TOP SCORE CARD ── */}
      <section className="bg-[var(--card-bg)] border border-[var(--border)] rounded-[28px] p-6 sm:p-8 shadow-[var(--shadow-card)] relative overflow-hidden space-y-6">
        <div
          className="absolute top-0 left-0 right-0 h-[3px]"
          style={{
            background: isPassed
              ? "linear-gradient(90deg, transparent, #10B981, transparent)"
              : "linear-gradient(90deg, transparent, #F59E0B, transparent)",
          }}
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
              Assessment Completed
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--text-primary)]">
              {result.assessmentTitle}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
              Deterministic evaluation via Judge0 sandbox against official testcases.
            </p>
          </div>

          {/* Big Score Box */}
          <div className="flex items-center gap-4 p-4 rounded-2xl border bg-[var(--bg-secondary)]" style={{ borderColor: "var(--border)" }}>
            <div className="text-center">
              <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Percentage</span>
              <span
                className="text-3xl sm:text-4xl font-black font-mono"
                style={{ color: isPassed ? "#10B981" : "#F59E0B" }}
              >
                {result.percentage}%
              </span>
            </div>
            <div className="h-10 w-px bg-[var(--border)]" />
            <div className="text-center">
              <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Total Score</span>
              <span className="text-xl sm:text-2xl font-black font-mono text-[var(--text-primary)]">
                {result.obtainedMarks} <span className="text-xs text-[var(--text-muted)]">/ {result.totalMarks}</span>
              </span>
            </div>
          </div>
        </div>

        {/* ── METRICS GRID ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 rounded-xl border bg-[var(--bg-secondary)]/50 space-y-0.5 text-center" style={{ borderColor: "var(--border)" }}>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Questions Solved</span>
            <p className="text-base sm:text-lg font-black text-emerald-400 font-mono">
              {result.solvedQuestions} / {result.totalQuestions}
            </p>
          </div>

          <div className="p-3.5 rounded-xl border bg-[var(--bg-secondary)]/50 space-y-0.5 text-center" style={{ borderColor: "var(--border)" }}>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Testcases Passed</span>
            <p className="text-base sm:text-lg font-black text-cyan-400 font-mono">
              {result.passedTestCases} / {result.totalTestCases}
            </p>
          </div>

          <div className="p-3.5 rounded-xl border bg-[var(--bg-secondary)]/50 space-y-0.5 text-center" style={{ borderColor: "var(--border)" }}>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Time Used</span>
            <p className="text-base sm:text-lg font-black text-[var(--text-primary)] font-mono">
              {formatSeconds(result.timeUsedSeconds)}
            </p>
          </div>

          <div className="p-3.5 rounded-xl border bg-[var(--bg-secondary)]/50 space-y-0.5 text-center" style={{ borderColor: "var(--border)" }}>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Status</span>
            <p className="text-xs sm:text-sm font-bold capitalize text-emerald-400">
              {result.status}
            </p>
          </div>
        </div>
      </section>

      {/* ── QUESTION-WISE BREAKDOWN (SECTION 31) ── */}
      <section className="bg-[var(--card-bg)] border border-[var(--border)] rounded-[24px] p-6 shadow-[var(--shadow-card)] space-y-4">
        <h2 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          Question-Wise Evaluation Breakdown
        </h2>

        <div className="space-y-3">
          {(result.breakdown || []).map((q, idx) => {
            const isSolved = q.status === "SOLVED";
            const isPartial = q.status === "PARTIAL";
            const isExpanded = expandedQuestion === idx;

            return (
              <div
                key={idx}
                className="rounded-2xl border transition overflow-hidden"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg-secondary)",
                }}
              >
                <div
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                  onClick={() => setExpandedQuestion(isExpanded ? null : idx)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-mono font-bold text-xs"
                      style={{
                        background: isSolved
                          ? "rgba(16, 185, 129, 0.2)"
                          : isPartial
                          ? "rgba(245, 158, 11, 0.2)"
                          : "rgba(239, 68, 68, 0.2)",
                        color: isSolved ? "#10B981" : isPartial ? "#F59E0B" : "#EF4444",
                      }}
                    >
                      {isSolved ? "✓" : isPartial ? "◑" : "✕"}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-[var(--text-primary)] truncate">
                          {q.title}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded-md bg-[var(--card-bg)] text-[var(--text-muted)] border border-[var(--border)] capitalize">
                          {q.difficulty}
                        </span>
                      </div>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        Testcases: <strong className="text-[var(--text-primary)]">{q.passedTests}/{q.totalTests} Passed</strong> • Language: <span className="uppercase">{q.language}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-sm font-black font-mono text-cyan-400">
                        {q.marksObtained} / {q.maxMarks}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] block">marks</span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
                  </div>
                </div>

                {/* Expanded code viewer */}
                {isExpanded && q.code && (
                  <div className="p-4 border-t bg-[var(--card-bg)] space-y-2" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                      <span className="font-mono font-bold text-[var(--text-secondary)]">Submitted Code:</span>
                      <span className="uppercase">{q.language}</span>
                    </div>
                    <pre className="p-3 rounded-xl border bg-[var(--input-bg)] text-xs font-mono overflow-x-auto whitespace-pre text-[var(--text-primary)]" style={{ borderColor: "var(--border)" }}>
                      {q.code}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── OPTIONAL AI POST-ASSESSMENT FEEDBACK (SECTION 44) ── */}
      <section className="bg-[var(--card-bg)] border border-[var(--border)] rounded-[24px] p-6 shadow-[var(--shadow-card)] space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-400" />
            <div>
              <h2 className="text-base font-extrabold text-[var(--text-primary)]">
                AI Coding Insights & Complexity Feedback
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                AI analysis of your algorithmic approach, code quality, and efficiency. (Does not affect test score)
              </p>
            </div>
          </div>

          {!aiFeedback && (
            <button
              type="button"
              onClick={handleGenerateAiFeedback}
              disabled={generatingAi}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30 hover:bg-purple-500/25 transition cursor-pointer disabled:opacity-50"
            >
              {generatingAi ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Analyzing Code...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Analyze with AI
                </>
              )}
            </button>
          )}
        </div>

        {aiFeedback && (
          <div className="p-4 rounded-2xl border bg-purple-500/5 border-purple-500/20 space-y-3">
            <p className="text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed">
              {aiFeedback.summary}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-1">
                <span className="text-[11px] font-bold text-emerald-400">Observed Strengths:</span>
                <ul className="text-xs text-[var(--text-secondary)] list-disc pl-4 space-y-1">
                  {(aiFeedback.strengths || []).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] space-y-1">
                <span className="text-[11px] font-bold text-amber-400">Areas for Improvement:</span>
                <ul className="text-xs text-[var(--text-secondary)] list-disc pl-4 space-y-1">
                  {(aiFeedback.areasForImprovement || []).map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => navigate("/coding-assessments")}
          className="px-5 py-2.5 rounded-xl border text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-secondary)] transition cursor-pointer"
        >
          Back to Assessments
        </button>
        <button
          type="button"
          onClick={() => navigate("/coding-round")}
          className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 shadow-md shadow-cyan-500/25 transition cursor-pointer"
        >
          <span>Practice More Coding</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
