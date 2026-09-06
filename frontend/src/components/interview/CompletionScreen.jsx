import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Home,
  Target,
  BrainCircuit,
  Code2,
  UserCheck,
  Award,
  Sparkles,
  ChevronDown,
  ChevronUp,
  XCircle,
  HelpCircle,
  Check,
  X,
  FileText,
  Clock,
  Filter,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";

function CompletionScreen({
  interviewId,
  candidateName = "Candidate",
  answeredCount = 0,
  skippedCount = 0,
  timeTakenText = "00:00",
  questions = [],
  savedAnswers = [],
  initialResultData = null,
  onReturnDashboard,
}) {
  const token = getAuthToken();
  const [resultData, setResultData] = useState(initialResultData);
  const [loading, setLoading] = useState(!initialResultData);
  const [selectedSectionFilter, setSelectedSectionFilter] = useState("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("ALL");
  const [expandedQuestions, setExpandedQuestions] = useState({});

  useEffect(() => {
    const fetchResult = async () => {
      if (!interviewId || initialResultData) {
        setLoading(false);
        return;
      }
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const { data } = await api.get(`/api/real-interview/result/${interviewId}`, { headers });
        if (data.success && data.result) {
          setResultData(data.result);
        }
      } catch (err) {
        console.warn("[CompletionScreen] fetch result warning:", err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [interviewId, token, initialResultData]);

  // Read authoritative backend scores
  const totalObtained = resultData?.overallScore ?? 0;
  const maxMarksTotal = resultData?.maxScore ?? 450;
  const percentageScore = typeof resultData?.percentage === "number" ? resultData.percentage : Number(((totalObtained / maxMarksTotal) * 100).toFixed(2));
  const recommendation = resultData?.recommendation || (percentageScore >= 75 ? "Recommended for Placement" : percentageScore >= 55 ? "Borderline — Mentorship Advised" : "Needs Improvement");

  const roundScores = resultData?.roundScores || {};
  const aptitudeScore = roundScores.aptitude?.score ?? 0;
  const aptitudeMax = roundScores.aptitude?.maxScore ?? 50;
  const technicalScore = roundScores.technical?.score ?? 0;
  const technicalMax = roundScores.technical?.maxScore ?? 100;
  const projectScore = roundScores.project?.score ?? 0;
  const projectMax = roundScores.project?.maxScore ?? 100;
  const hrScore = roundScores.hr?.score ?? 0;
  const hrMax = roundScores.hr?.maxScore ?? 100;
  const codingScore = roundScores.coding?.score ?? 0;
  const codingMax = roundScores.coding?.maxScore ?? 100;

  const displayCategories = [
    {
      key: "aptitude",
      label: "Aptitude Round",
      score: aptitudeScore,
      maxScore: aptitudeMax,
      percentage: Math.round((aptitudeScore / aptitudeMax) * 100),
      icon: Target,
      color: "#f59e0b",
    },
    {
      key: "technical",
      label: "Technical Stack Round",
      score: technicalScore,
      maxScore: technicalMax,
      percentage: Math.round((technicalScore / technicalMax) * 100),
      icon: BrainCircuit,
      color: "#3b82f6",
    },
    {
      key: "project",
      label: "Project / Resume Round",
      score: projectScore,
      maxScore: projectMax,
      percentage: Math.round((projectScore / projectMax) * 100),
      icon: Sparkles,
      color: "#ec4899",
    },
    {
      key: "hr",
      label: "HR Behavioral Round",
      score: hrScore,
      maxScore: hrMax,
      percentage: Math.round((hrScore / hrMax) * 100),
      icon: UserCheck,
      color: "#a855f7",
    },
    {
      key: "coding",
      label: "Coding IDE Round",
      score: codingScore,
      maxScore: codingMax,
      percentage: Math.round((codingScore / codingMax) * 100),
      icon: Code2,
      color: "#10b981",
    },
  ];

  const strengths = resultData?.strengths || [
    "Completed all 5 interview rounds under adaptive camera/mic monitoring",
    "Preserved authentic response submission",
  ];

  const weaknesses = resultData?.weaknesses || [
    "Focus on unattempted questions and core domain concepts",
  ];

  // ─── COMPILE QUESTION-WISE LIST FROM STORED RESULT ───
  const answerKeyList = useMemo(() => {
    if (Array.isArray(resultData?.questionResults) && resultData.questionResults.length > 0) {
      return resultData.questionResults.map((item, idx) => {
        const isNotAttempted = item.status === "NOT_ATTEMPTED";
        return {
          questionId: item.questionId || `q_${idx}`,
          questionText: item.question,
          section: item.roundType || "TECHNICAL",
          candidateAnswer: item.candidateAnswer || (item.roundType === "CODING" ? "Not Submitted" : "Not Answered"),
          correctAnswer: item.correctAnswer || item.expectedAnswer || "",
          score: item.score || 0,
          maxScore: item.maxScore || 5,
          status: item.status,
          evaluationMode: item.evaluationMode || "DETERMINISTIC",
          feedback: item.feedback || (isNotAttempted ? "Question was not attempted." : "Evaluated"),
          missingPoints: item.missingPoints || [],
          improvedAnswer: item.improvedAnswer || "",
          submission: item.submission || null,
        };
      });
    }

    // Fallback if resultData not yet populated
    return [];
  }, [resultData]);

  // Filter questions
  const filteredAnswerKey = useMemo(() => {
    return answerKeyList.filter((item) => {
      const matchSection =
        selectedSectionFilter === "ALL" ||
        String(item.section).toUpperCase() === selectedSectionFilter.toUpperCase();

      const matchStatus =
        selectedStatusFilter === "ALL" ||
        (selectedStatusFilter === "CORRECT" && item.status === "CORRECT") ||
        (selectedStatusFilter === "PARTIAL" && item.status === "PARTIALLY_CORRECT") ||
        (selectedStatusFilter === "INCORRECT" && item.status === "INCORRECT") ||
        (selectedStatusFilter === "NOT_ATTEMPTED" && item.status === "NOT_ATTEMPTED");

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
    <div className="min-h-screen bg-[#050609] text-white flex items-center justify-center p-4 sm:p-6 font-sans select-none overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="max-w-4xl w-full bg-slate-900/95 rounded-3xl border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6 my-8"
      >
        {/* TOP BRANDING & HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-white shadow-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-wider uppercase text-white">
                REAL INTERVIEW SCORECARD
              </h2>
              <p className="text-xs text-white/50">
                Authoritative Backend Result • Candidate: {candidateName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              COMPLETED
            </span>
          </div>
        </div>

        {/* HERO SCORE & OVERVIEW CARD */}
        <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border border-white/10 text-center relative overflow-hidden space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
            Overall Interview Score
          </p>
          <div className="flex items-baseline justify-center gap-2 my-1">
            <span
              className="text-5xl sm:text-6xl font-black font-mono tracking-wider"
              style={{ color: percentageScore >= 75 ? "#34d399" : percentageScore >= 55 ? "#38bdf8" : "#f59e0b" }}
            >
              {totalObtained}
            </span>
            <span className="text-2xl font-bold text-white/40 font-mono">/ {maxMarksTotal}</span>
          </div>

          <div className="text-lg font-extrabold text-emerald-400 font-mono">
            {percentageScore}%
          </div>

          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-white/5 border border-white/10 text-white/80">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>{recommendation}</span>
          </div>
        </div>

        {/* 5 ROUND SCORE BREAKDOWN GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {displayCategories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.key}
                className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-white/70" />
                    <span className="text-xs font-bold text-white">{cat.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-sm font-black text-amber-400 block">
                      {cat.score} / {cat.maxScore}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      ({cat.percentage}%)
                    </span>
                  </div>
                </div>

                <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(Math.max(cat.percentage, 0), 100)}%`, backgroundColor: cat.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* STRENGTHS & FOCUS AREAS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-white/10 space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              Key Strengths
            </h4>
            <ul className="space-y-1 text-xs text-white/80 list-disc pl-4">
              {strengths.map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-white/10 space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Recommended Focus Areas
            </h4>
            <ul className="space-y-1 text-xs text-white/80 list-disc pl-4">
              {weaknesses.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* ─── 📋 DETAILED QUESTION-WISE REVIEW SECTION ─── */}
        <div className="rounded-2xl border border-white/10 bg-slate-950/90 p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/10 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                Question-Wise Review ({answerKeyList.length} Questions)
              </h3>
              <p className="text-xs text-white/50">
                Preserved candidate answers, awarded marks out of round maximums, and expected solutions
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
              {["ALL", "APTITUDE", "TECHNICAL", "RESUME_PROJECT", "HR", "CODING"].map((sec) => (
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
                  {sec === "RESUME_PROJECT" ? "PROJECT" : sec}
                </button>
              ))}
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: "ALL", label: "All" },
                { id: "CORRECT", label: "Correct" },
                { id: "PARTIAL", label: "Partial" },
                { id: "INCORRECT", label: "Incorrect" },
                { id: "NOT_ATTEMPTED", label: "Not Attempted" },
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
                const isCorrect = item.status === "CORRECT";
                const isPartial = item.status === "PARTIALLY_CORRECT";
                const isNotAttempted = item.status === "NOT_ATTEMPTED";

                const statusColor = isCorrect ? "#10b981" : isPartial ? "#f59e0b" : isNotAttempted ? "#64748b" : "#ef4444";
                const statusBadgeBg = isCorrect
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : isPartial
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : isNotAttempted
                  ? "bg-slate-500/10 text-slate-400 border-slate-500/20"
                  : "bg-red-500/10 text-red-400 border-red-500/20";

                return (
                  <div
                    key={qKey}
                    className="rounded-2xl border transition-all overflow-hidden"
                    style={{
                      borderColor: isCorrect ? "rgba(16,185,129,0.25)" : isPartial ? "rgba(245,158,11,0.25)" : isNotAttempted ? "rgba(100,116,139,0.25)" : "rgba(239,68,68,0.25)",
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
                              {item.section === "RESUME_PROJECT" ? "PROJECT" : item.section}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${statusBadgeBg}`}>
                              {isCorrect ? "Correct" : isPartial ? "Partial Marks" : isNotAttempted ? "Not Attempted" : "Incorrect"}
                            </span>
                            {item.evaluationMode === "FALLBACK" && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                Fallback
                              </span>
                            )}
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
                            {item.score} / {item.maxScore} Marks
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

                          {/* Candidate's Answer vs Correct Answer Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            {/* Candidate's Answer */}
                            <div
                              className="p-3.5 rounded-xl border space-y-1.5"
                              style={{
                                borderColor: isCorrect ? "rgba(16,185,129,0.3)" : isPartial ? "rgba(245,158,11,0.3)" : isNotAttempted ? "rgba(100,116,139,0.3)" : "rgba(239,68,68,0.3)",
                                background: isCorrect ? "rgba(16,185,129,0.04)" : isPartial ? "rgba(245,158,11,0.04)" : isNotAttempted ? "rgba(100,116,139,0.04)" : "rgba(239,68,68,0.04)",
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
                                  {item.score} / {item.maxScore} Marks
                                </span>
                              </div>
                              <p className="text-xs text-white/90 whitespace-pre-wrap font-mono bg-black/30 p-2.5 rounded-lg border border-white/5">
                                {item.candidateAnswer || (item.section === "CODING" ? "Not Submitted" : "Not Answered")}
                              </p>
                            </div>

                            {/* Correct / Expected Answer */}
                            <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1.5">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {item.section === "APTITUDE" ? "Correct Option / Answer" : "Expected / Ideal Answer"}
                              </span>
                              <p className="text-xs text-emerald-200 font-medium whitespace-pre-wrap font-sans">
                                {item.correctAnswer || "Full marks awarded for comprehensive technical explanation"}
                              </p>
                            </div>
                          </div>

                          {/* Coding Execution Details */}
                          {item.submission && (
                            <div className="p-3 rounded-xl bg-slate-900 border border-white/10 text-xs space-y-1 font-mono">
                              <div className="flex justify-between text-slate-400 text-[10px] font-bold uppercase">
                                <span>Passed Test Cases: {item.submission.passedTests} / {item.submission.totalTests}</span>
                                <span>Execution Status: {item.submission.executionStatus || "Evaluated"}</span>
                              </div>
                            </div>
                          )}

                          {/* Evaluation & Feedback */}
                          {item.feedback && (
                            <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs text-blue-200 space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3" />
                                Evaluation Feedback:
                              </span>
                              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                                {item.feedback}
                              </p>
                            </div>
                          )}

                          {/* Missing Points */}
                          {Array.isArray(item.missingPoints) && item.missingPoints.length > 0 && (
                            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-200 space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                                Missing Points / Suggestions:
                              </span>
                              <ul className="list-disc pl-4 space-y-0.5 text-slate-300">
                                {item.missingPoints.map((mp, mpIdx) => (
                                  <li key={mpIdx}>{mp}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Improved Answer */}
                          {item.improvedAnswer && (
                            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-200 space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                                Recommended / Improved Answer:
                              </span>
                              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                                {item.improvedAnswer}
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

        {/* CLOSE ACTION BUTTON */}
        <button
          onClick={onReturnDashboard}
          className="w-full py-3.5 rounded-2xl text-xs font-extrabold uppercase tracking-widest text-white cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
          style={{
            background: "linear-gradient(135deg, #10b981, #059669)",
            boxShadow: "0 0 20px rgba(16,185,129,0.35)",
            border: "1px solid rgba(52,211,153,0.4)",
          }}
        >
          <Home className="w-4 h-4" />
          <span>Close & Return to Platform</span>
        </button>
      </motion.div>
    </div>
  );
}

export default CompletionScreen;
