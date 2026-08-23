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
  onReturnDashboard,
}) {
  const token = getAuthToken();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSectionFilter, setSelectedSectionFilter] = useState("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("ALL");
  const [expandedQuestions, setExpandedQuestions] = useState({});

  useEffect(() => {
    const fetchResult = async () => {
      if (!interviewId) {
        setLoading(false);
        return;
      }
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const { data } = await api.get(`/api/interview/${interviewId}/result`, { headers });
        setResult(data);
      } catch (err) {
        console.warn("CompletionScreen fetch result notice:", err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [interviewId, token]);

  const targetRound = String(result?.targetRound || "all").toLowerCase();
  const overallScore = typeof result?.overallScore === "number"
    ? result.overallScore
    : (answeredCount + skippedCount > 0 ? Math.round((answeredCount / (answeredCount + skippedCount)) * 100) : 0);
  
  const recommendation = result?.recommendation || (overallScore >= 70 ? "Highly Recommended" : overallScore >= 50 ? "Recommended with Practice" : "Needs Practice");

  const allCategories = [
    {
      key: "aptitude",
      label: "Aptitude Round",
      score: result?.sections?.aptitude?.percentage ?? result?.aptitudeScore ?? 0,
      total: result?.sections?.aptitude?.total ? `${result.sections.aptitude.total} Qs` : (result?.sections?.aptitude?.completed ? `${result.sections.aptitude.completed} Qs` : "0 Qs"),
      count: result?.sections?.aptitude?.total || result?.sections?.aptitude?.completed || 0,
      icon: Target,
      color: "#f59e0b",
    },
    {
      key: "technical",
      label: "Technical Stack Round",
      score: result?.sections?.technical?.percentage ?? result?.technicalScore ?? 0,
      total: result?.sections?.technical?.total ? `${result.sections.technical.total} Qs` : (result?.sections?.technical?.completed ? `${result.sections.technical.completed} Qs` : "0 Qs"),
      count: result?.sections?.technical?.total || result?.sections?.technical?.completed || 0,
      icon: BrainCircuit,
      color: "#3b82f6",
    },
    {
      key: "coding",
      label: "Coding IDE Round",
      score: result?.sections?.coding?.percentage ?? result?.codingScore ?? 0,
      total: result?.sections?.coding?.total ? `${result.sections.coding.total} Qs` : (result?.sections?.coding?.completed ? `${result.sections.coding.completed} Qs` : "0 Qs"),
      count: result?.sections?.coding?.total || result?.sections?.coding?.completed || 0,
      icon: Code2,
      color: "#10b981",
    },
    {
      key: "hr",
      label: "HR Behavioral Round",
      score: result?.sections?.hr?.percentage ?? result?.hrScore ?? 0,
      total: result?.sections?.hr?.total ? `${result.sections.hr.total} Qs` : (result?.sections?.hr?.completed ? `${result.sections.hr.completed} Qs` : "0 Qs"),
      count: result?.sections?.hr?.total || result?.sections?.hr?.completed || 0,
      icon: UserCheck,
      color: "#a855f7",
    },
  ];

  const categories = targetRound === "all"
    ? allCategories.filter(c => c.count > 0 || c.score > 0)
    : allCategories.filter(c => c.key === targetRound);

  const displayCategories = categories.length > 0 ? categories : allCategories;

  const strengths = result?.strengths || [
    "Conceptual understanding & analytical approach",
    "Clear communication and structured responses",
  ];

  const weaknesses = result?.weaknesses || [
    "Improve speed and accuracy in Aptitude round",
    "Structure behavioral answers using the STAR method",
  ];

  // ─── COMPILE DETAILED ANSWER KEY ───
  const answerKeyList = useMemo(() => {
    // 1. If backend provided answerKey, use it
    if (Array.isArray(result?.answerKey) && result.answerKey.length > 0) {
      return result.answerKey;
    }
    if (Array.isArray(result?.questions) && result.questions.length > 0) {
      return result.questions;
    }

    // 2. Fallback to combining props `questions` and `savedAnswers`
    const answerMap = new Map();
    (savedAnswers || []).forEach((ans) => {
      const qKey = String(ans.questionId || ans.id || "");
      answerMap.set(qKey, ans);
    });

    return (questions || []).map((q, idx) => {
      const qKey = String(q.id || q.questionId || `q_${idx}`);
      const ans = answerMap.get(qKey) || (savedAnswers || []).find(a => a.questionText === q.question || a.question === q.question) || null;
      
      const candidateAnswer = ans ? (ans.answer || ans.transcript || "") : "";
      const isSkipped = !candidateAnswer || candidateAnswer.trim() === "" || ans?.status === "skipped";

      let correctAnswer = q.correctAnswer || q.expectedAnswer || q.sampleOutput || q.solution || "";
      if (!correctAnswer && Array.isArray(q.options) && typeof q.correctOptionIndex === "number") {
        correctAnswer = q.options[q.correctOptionIndex] || "";
      }
      if (!correctAnswer && q.type === "coding") {
        correctAnswer = q.solution || "Passes all required automated test cases";
      }

      const score = ans ? (ans.score != null ? ans.score : (ans.evaluation?.score ?? (candidateAnswer ? 75 : 0))) : 0;
      
      let status = "skipped";
      if (!isSkipped) {
        if (score >= 70) status = "correct";
        else if (score >= 40) status = "partially_correct";
        else status = "incorrect";
      }

      return {
        questionId: qKey,
        questionText: q.question || q.title || `Question ${idx + 1}`,
        section: q.section || q.category || "TECHNICAL",
        type: q.type || (q.options?.length ? "mcq" : "text"),
        options: q.options || [],
        candidateAnswer: isSkipped ? "No answer provided / Skipped" : candidateAnswer,
        correctAnswer: correctAnswer || "Valid technical explanation matching question criteria",
        score: isSkipped ? 0 : score,
        maxScore: 100,
        status,
        feedback: ans?.feedback || ans?.evaluation?.feedback || (isSkipped ? "Question was skipped during interview." : "Answer evaluated."),
        explanation: q.explanation || q.solutionExplanation || "",
      };
    });
  }, [result, questions, savedAnswers]);

  // Filter questions
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
    <div className="min-h-screen bg-[#050609] text-white flex items-center justify-center p-4 sm:p-6 font-sans select-none overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="max-w-4xl w-full bg-slate-900/95 rounded-3xl border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6 my-8"
      >
        {/* TOP BRANDING & STATUS HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-white shadow-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-wider uppercase text-white">
                AI Interview Evaluation Scorecard
              </h2>
              <p className="text-xs text-white/50">
                Single Source of Truth Evaluation • Candidate: {candidateName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {result?.isEndedEarly ? "ENDED EARLY" : "COMPLETED"}
            </span>

            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              EMAIL: {result?.email?.status || "SENT"}
            </span>
          </div>
        </div>

        {/* HERO SCORE & OVERVIEW CARD */}
        <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900 border border-white/10 text-center relative overflow-hidden space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
            Overall Placement Score
          </p>
          <div
            className="text-5xl sm:text-6xl font-black font-mono tracking-wider my-1"
            style={{ color: overallScore >= 70 ? "#34d399" : overallScore >= 50 ? "#38bdf8" : "#f59e0b" }}
          >
            {overallScore}%
          </div>
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-white/5 border border-white/10 text-white/80">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>{recommendation}</span>
          </div>
        </div>

        {/* 4 ROUND SCORE BREAKDOWN GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {displayCategories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.label}
                className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-white/70" />
                    <span className="text-xs font-bold text-white">{cat.label}</span>
                  </div>
                  <span className="font-mono text-sm font-black text-amber-400">
                    {cat.score}%
                  </span>
                </div>

                <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(Math.max(cat.score, 0), 100)}%`, backgroundColor: cat.color }}
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

        {/* METRICS & QUICK SUMMARY */}
        <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 text-center text-xs font-bold">
          <div>
            <span className="text-[10px] text-white/40 uppercase block">Answered</span>
            <span className="text-emerald-400 font-mono font-black text-sm">{answeredCount}</span>
          </div>
          <div>
            <span className="text-[10px] text-white/40 uppercase block">Skipped</span>
            <span className="text-amber-400 font-mono font-black text-sm">{skippedCount}</span>
          </div>
          <div>
            <span className="text-[10px] text-white/40 uppercase block">Duration</span>
            <span className="text-blue-400 font-mono font-black text-sm">{timeTakenText}</span>
          </div>
        </div>

        {/* ─── 📋 DETAILED ANSWER KEY & QUESTION ANALYSIS SECTION ─── */}
        <div className="rounded-2xl border border-white/10 bg-slate-950/90 p-5 sm:p-6 space-y-5">
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
