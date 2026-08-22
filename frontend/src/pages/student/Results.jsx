import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Mail,
  Award,
  Target,
  BrainCircuit,
  Code2,
  UserCheck,
  FileText,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";

function Results() {
  const token = getAuthToken();
  const { interviewId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeId = interviewId || searchParams.get("session") || searchParams.get("interviewId");

  const [result, setResult] = useState(null);
  const [resultsList, setResultsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSectionFilter, setSelectedSectionFilter] = useState("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("ALL");
  const [expandedQuestions, setExpandedQuestions] = useState({});

  useEffect(() => {
    const fetchResultData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };

        if (activeId) {
          try {
            const { data } = await api.get(`/api/interview/${activeId}/result`, { headers });
            setResult(data);
          } catch {
            // Fallback
          }
        }

        const { data: allResults } = await api.get("/api/student/results", { headers });
        setResultsList(allResults || []);
        if (!result && allResults && allResults.length > 0) {
          // If first item has an interviewId, fetch its full result with answerKey
          if (allResults[0].interviewId) {
            try {
              const { data: fullFirstResult } = await api.get(`/api/interview/${allResults[0].interviewId}/result`, { headers });
              setResult(fullFirstResult);
            } catch {
              setResult(allResults[0]);
            }
          } else {
            setResult(allResults[0]);
          }
        }
      } catch {
        // stays empty
      } finally {
        setLoading(false);
      }
    };
    fetchResultData();
  }, [token, activeId]);

  const activeResult = result || (resultsList.length > 0 ? resultsList[0] : null);

  const categories = activeResult
    ? [
        { label: "Aptitude Round", score: activeResult.sections?.aptitude?.percentage ?? activeResult.aptitudeScore ?? 0, total: "25 Qs", icon: Target, color: "#f59e0b" },
        { label: "Technical Stack Round", score: activeResult.sections?.technical?.percentage ?? activeResult.technicalScore ?? 0, total: "25 Qs", icon: BrainCircuit, color: "#3b82f6" },
        { label: "Coding IDE Round", score: activeResult.sections?.coding?.percentage ?? activeResult.codingScore ?? 0, total: "3 Qs", icon: Code2, color: "#10b981" },
        { label: "HR Behavioral Round", score: activeResult.sections?.hr?.percentage ?? activeResult.hrScore ?? 0, total: "5 Qs", icon: UserCheck, color: "#a855f7" },
      ]
    : [];

  const answerKeyList = useMemo(() => {
    if (Array.isArray(activeResult?.answerKey) && activeResult.answerKey.length > 0) {
      return activeResult.answerKey;
    }
    if (Array.isArray(activeResult?.questions) && activeResult.questions.length > 0) {
      return activeResult.questions;
    }
    return [];
  }, [activeResult]);

  const filteredAnswerKey = useMemo(() => {
    return answerKeyList.filter((item) => {
      const matchSection =
        selectedSectionFilter === "ALL" ||
        String(item.section).toUpperCase() === selectedSectionFilter.toUpperCase();

      const matchStatus =
        selectedStatusFilter === "ALL" ||
        (selectedStatusFilter === "CORRECT" && item.status === "correct") ||
        (selectedStatusFilter === "PARTIAL" && item.status === "partially_correct") ||
        (selectedStatusFilter === "INCORRECT" && (item.status === "incorrect" || item.status === "skipped"));

      return matchSection && matchStatus;
    });
  }, [answerKeyList, selectedSectionFilter, selectedStatusFilter]);

  const toggleExpand = (qId) => {
    setExpandedQuestions((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  const expandAll = () => {
    const all = {};
    answerKeyList.forEach((item, idx) => {
      all[item.questionId || idx] = true;
    });
    setExpandedQuestions(all);
  };

  const collapseAll = () => {
    setExpandedQuestions({});
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        
        <div className="flex items-center justify-between gap-4 mb-6">
          <button
            onClick={() => navigate("/placement")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 transition text-white/80 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </button>

          {activeResult?.email?.status && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border bg-white/5 text-white/60 border-white/10">
              <Mail className="w-3 h-3 text-blue-400" />
              Email Status: <span className="text-emerald-400">{activeResult.email.status}</span>
            </span>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-black mb-1 text-white">
          Performance Evaluation Scorecard
        </h1>
        <p className="text-xs text-white/50 mb-8">
          Single Source of Truth Evaluation Report permanently saved in platform database.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : !activeResult ? (
          <div className="p-12 text-center rounded-3xl bg-slate-900/60 border border-white/10">
            <BarChart3 className="w-10 h-10 mx-auto mb-3 text-white/30" />
            <p className="text-white/70 font-bold text-sm">No evaluation result found.</p>
            <p className="text-xs text-white/40 mt-1">
              Complete an interview session to see your permanent evaluation scorecard.
            </p>
          </div>
        ) : (
          <>
            {/* OVERALL SCORECARD HERO */}
            <div className="p-6 rounded-3xl bg-slate-900/90 border border-white/10 text-center mb-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 px-4 py-1 bg-blue-500/10 border-b border-l border-blue-500/20 text-[10px] font-extrabold text-blue-400 uppercase tracking-widest rounded-bl-2xl">
                {activeResult.targetRound && activeResult.targetRound !== "all"
                  ? `${activeResult.targetRound.toUpperCase()} ROUND • ${activeResult.isEndedEarly ? "PARTIAL" : "COMPLETED"}`
                  : (activeResult.isEndedEarly ? "ENDED EARLY" : "COMPLETED")}
              </div>

              <BarChart3 className="w-8 h-8 mx-auto mb-2 text-blue-400" />
              <p className="text-xs font-extrabold uppercase tracking-widest text-white/40">
                {activeResult.targetRound && activeResult.targetRound !== "all"
                  ? `${activeResult.targetRound.toUpperCase()} Round Performance Score`
                  : "Overall Placement Score"}
              </p>
              
              <div className="text-5xl font-black font-mono my-2 text-white" style={{ color: (activeResult.overallScore || 0) >= 70 ? "#34d399" : (activeResult.overallScore || 0) >= 50 ? "#38bdf8" : "#f59e0b" }}>
                {activeResult.overallScore || 0}%
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-white/80">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>{activeResult.recommendation || "Needs Evaluation"}</span>
              </div>
            </div>

            {/* 4 ROUND SCORE BREAKDOWN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {categories.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-white/70" />
                        <span className="text-xs font-extrabold text-white">{item.label}</span>
                      </div>
                      <span className="font-mono text-sm font-black text-amber-400">
                        {item.score}%
                      </span>
                    </div>

                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(Math.max(item.score, 0), 100)}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* STRENGTHS & WEAKNESSES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Key Strengths
                </h3>
                <ul className="space-y-1.5 text-xs text-white/80 list-disc pl-4">
                  {(activeResult.strengths || []).length > 0
                    ? activeResult.strengths.map((s, idx) => <li key={idx}>{s}</li>)
                    : <li>Conceptual understanding & analytical approach</li>}
                </ul>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Recommended Focus Areas
                </h3>
                <ul className="space-y-1.5 text-xs text-white/80 list-disc pl-4">
                  {(activeResult.weaknesses || []).length > 0
                    ? activeResult.weaknesses.map((w, idx) => <li key={idx}>{w}</li>)
                    : <li>Review focus areas in question history</li>}
                </ul>
              </div>
            </div>

            {/* ─── 📋 DETAILED ANSWER KEY & QUESTION ANALYSIS SECTION ─── */}
            {answerKeyList.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-slate-950/90 p-5 sm:p-6 space-y-5 mb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" />
                      Detailed Answer Key & Evaluation
                    </h3>
                    <p className="text-xs text-white/50">
                      Review your responses, correct answers, awarded marks, and AI explanations
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={expandAll}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 transition cursor-pointer"
                    >
                      Expand All
                    </button>
                    <button
                      type="button"
                      onClick={collapseAll}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 transition cursor-pointer"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>

                {/* Filters Bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  {/* Section Filter Tabs */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {["ALL", "APTITUDE", "TECHNICAL", "CODING", "HR"].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setSelectedSectionFilter(sec)}
                        className={`px-3 py-1.5 rounded-xl font-bold uppercase transition cursor-pointer text-[11px] ${
                          selectedSectionFilter === sec
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5"
                        }`}
                      >
                        {sec}
                      </button>
                    ))}
                  </div>

                  {/* Status Filter Tabs */}
                  <div className="flex items-center gap-1.5">
                    {[
                      { id: "ALL", label: "All" },
                      { id: "CORRECT", label: "Correct" },
                      { id: "PARTIAL", label: "Partial" },
                      { id: "INCORRECT", label: "Incorrect / Skipped" },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setSelectedStatusFilter(st.id)}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer text-[11px] ${
                          selectedStatusFilter === st.id
                            ? "bg-white/20 text-white font-bold"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question Breakdown List */}
                <div className="space-y-3.5 pt-2">
                  {filteredAnswerKey.length > 0 ? (
                    filteredAnswerKey.map((item, idx) => {
                      const qKey = item.questionId || idx;
                      const isExpanded = expandedQuestions[qKey] ?? (idx === 0);
                      const isCorrect = item.status === "correct";
                      const isPartial = item.status === "partially_correct";
                      const isSkipped = item.status === "skipped";

                      const statusColor = isCorrect ? "#10b981" : isPartial ? "#f59e0b" : "#ef4444";
                      const statusBadgeBg = isCorrect
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : isPartial
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20";

                      return (
                        <div
                          key={qKey}
                          className="rounded-2xl border transition-all overflow-hidden"
                          style={{
                            borderColor: isCorrect ? "rgba(16,185,129,0.25)" : isPartial ? "rgba(245,158,11,0.25)" : "rgba(239,68,68,0.25)",
                            background: "rgba(255,255,255,0.02)",
                          }}
                        >
                          {/* Collapsible Card Header */}
                          <div
                            onClick={() => toggleExpand(qKey)}
                            className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-white/[0.02] transition select-none"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span
                                className="w-7 h-7 rounded-xl flex items-center justify-center font-mono text-xs font-black shrink-0 border"
                                style={{
                                  borderColor: statusColor,
                                  color: statusColor,
                                  background: `${statusColor}15`,
                                }}
                              >
                                {idx + 1}
                              </span>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300">
                                    {item.section}
                                  </span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${statusBadgeBg}`}>
                                    {isCorrect ? "Correct (+100%)" : isPartial ? "Partial Marks" : isSkipped ? "Skipped (0%)" : "Incorrect (0%)"}
                                  </span>
                                </div>
                                <p className="text-xs font-bold text-white truncate">
                                  {item.questionText}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <span
                                  className="font-mono text-xs font-black"
                                  style={{ color: statusColor }}
                                >
                                  {item.score} / {item.maxScore || 100} Marks
                                </span>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-slate-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                          </div>

                          {/* Expandable Body */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="border-t border-white/5 p-4 sm:p-5 space-y-4 bg-slate-950/60"
                              >
                                {/* Full Question Statement */}
                                <div>
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                                    Question:
                                  </span>
                                  <p className="text-xs font-medium text-slate-200 leading-relaxed whitespace-pre-wrap bg-white/[0.02] p-3 rounded-xl border border-white/5 font-sans">
                                    {item.questionText}
                                  </p>
                                </div>

                                {/* MCQ Options Display (If Options Exist) */}
                                {Array.isArray(item.options) && item.options.length > 0 && (
                                  <div className="space-y-1.5">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                                      Options:
                                    </span>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {item.options.map((opt, optIdx) => {
                                        const isSelectedByUser = String(item.candidateAnswer).trim() === String(opt).trim();
                                        const isTheCorrectAnswer = String(item.correctAnswer).trim() === String(opt).trim();

                                        let optBorder = "border-white/10";
                                        let optBg = "bg-white/[0.02]";
                                        let optText = "text-slate-300";

                                        if (isTheCorrectAnswer) {
                                          optBorder = "border-emerald-500/50";
                                          optBg = "bg-emerald-500/10";
                                          optText = "text-emerald-300 font-bold";
                                        } else if (isSelectedByUser && !isTheCorrectAnswer) {
                                          optBorder = "border-red-500/50";
                                          optBg = "bg-red-500/10";
                                          optText = "text-red-300 line-through";
                                        }

                                        return (
                                          <div
                                            key={optIdx}
                                            className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${optBorder} ${optBg} ${optText}`}
                                          >
                                            <div className="flex items-center gap-2">
                                              <span className="w-5 h-5 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-bold">
                                                {String.fromCharCode(65 + optIdx)}
                                              </span>
                                              <span>{opt}</span>
                                            </div>

                                            <div className="flex items-center gap-1">
                                              {isSelectedByUser && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                                                  Your Pick
                                                </span>
                                              )}
                                              {isTheCorrectAnswer && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 flex items-center gap-1">
                                                  <Check className="w-3 h-3" /> Correct
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Candidate's Answer vs Correct Answer Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                  {/* Candidate's Answer */}
                                  <div
                                    className="p-3.5 rounded-xl border space-y-1.5"
                                    style={{
                                      borderColor: isCorrect ? "rgba(16,185,129,0.3)" : isPartial ? "rgba(245,158,11,0.3)" : "rgba(239,68,68,0.3)",
                                      background: isCorrect ? "rgba(16,185,129,0.04)" : isPartial ? "rgba(245,158,11,0.04)" : "rgba(239,68,68,0.04)",
                                    }}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                                        {isCorrect ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-red-400" />}
                                        Your Response
                                      </span>
                                      <span
                                        className="text-[11px] font-black font-mono"
                                        style={{ color: statusColor }}
                                      >
                                        {item.score} / {item.maxScore || 100} Marks
                                      </span>
                                    </div>
                                    <p className="text-xs text-white/90 whitespace-pre-wrap font-sans">
                                      {item.candidateAnswer || "No answer provided / Skipped"}
                                    </p>
                                  </div>

                                  {/* Correct / Expected Answer */}
                                  <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1.5">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 flex items-center gap-1.5">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Correct / Expected Answer
                                    </span>
                                    <p className="text-xs text-emerald-200 font-medium whitespace-pre-wrap font-sans">
                                      {item.correctAnswer || "Full marks awarded for comprehensive technical explanation"}
                                    </p>
                                  </div>
                                </div>

                                {/* AI Evaluation / Explanation Feedback */}
                                {(item.feedback || item.explanation) && (
                                  <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs text-blue-200 space-y-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                                      <Sparkles className="w-3 h-3" />
                                      AI Evaluation & Solution Feedback:
                                    </span>
                                    <p className="text-xs text-slate-300 leading-relaxed">
                                      {item.feedback || item.explanation}
                                    </p>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-xs text-slate-400">
                      No questions found matching the selected filter.
                    </div>
                  )}
                </div>
              </div>
            )}

          </>
        )}
      </motion.div>
    </div>
  );
}

export default Results;
