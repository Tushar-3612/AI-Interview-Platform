import React, { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, XCircle, ChevronDown, ChevronUp, Filter } from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";

/**
 * Single authoritative normalization helper for Real Interview Results.
 * Maps backend payload structures into canonical UI shape.
 */
export function normalizeRealInterviewResult(rawPayload) {
  if (!rawPayload) return null;

  let doc = rawPayload;
  if (rawPayload.result && typeof rawPayload.result === "object") {
    doc = rawPayload.result;
  } else if (rawPayload.data && typeof rawPayload.data === "object" && rawPayload.data.totalObtained !== undefined) {
    doc = rawPayload.data;
  }

  const totalObtained = Number(doc.totalObtained ?? doc.overallScore ?? doc.totalScore ?? 0);
  const maxScore = Number(doc.maximumMarks ?? doc.maxScore ?? doc.maximum ?? 450);
  const percentage = typeof doc.percentage === "number"
    ? doc.percentage
    : maxScore > 0
    ? Number(((totalObtained / maxScore) * 100).toFixed(2))
    : 0;

  const rounds = doc.rounds || {};
  const roundScores = doc.roundScores || {};

  const aptitudeScore = Number(rounds.aptitude?.obtained ?? roundScores.aptitude?.score ?? 0);
  const aptitudeMax = Number(rounds.aptitude?.maximum ?? roundScores.aptitude?.maxScore ?? 50);

  const technicalScore = Number(rounds.technical?.obtained ?? roundScores.technical?.score ?? 0);
  const technicalMax = Number(rounds.technical?.maximum ?? roundScores.technical?.maxScore ?? 100);

  const projectScore = Number(rounds.project?.obtained ?? roundScores.project?.score ?? 0);
  const projectMax = Number(rounds.project?.maximum ?? roundScores.project?.maxScore ?? 100);

  const hrScore = Number(rounds.hr?.obtained ?? roundScores.hr?.score ?? 0);
  const hrMax = Number(rounds.hr?.maximum ?? roundScores.hr?.maxScore ?? 100);

  const codingScore = Number(rounds.coding?.obtained ?? roundScores.coding?.score ?? 0);
  const codingMax = Number(rounds.coding?.maximum ?? roundScores.coding?.maxScore ?? 100);

  const questionResults = Array.isArray(doc.questionResults) ? doc.questionResults : [];
  const attemptedCount = typeof doc.attemptedQuestionsCount === "number"
    ? doc.attemptedQuestionsCount
    : questionResults.filter(q => q.status !== "NOT_ATTEMPTED" && q.candidateAnswer !== "Not Answered" && q.candidateAnswer !== "Not Submitted").length;

  const totalCount = typeof doc.totalQuestionsCount === "number"
    ? doc.totalQuestionsCount
    : (questionResults.length > 0 ? questionResults.length : 53);

  const unattemptedCount = typeof doc.unattemptedQuestionsCount === "number"
    ? doc.unattemptedQuestionsCount
    : Math.max(0, totalCount - attemptedCount);

  return {
    sessionId: doc.sessionId || "",
    status: doc.status || "COMPLETED",
    totalObtained,
    maxScore,
    percentage,
    rounds: {
      aptitude: { score: aptitudeScore, maxScore: aptitudeMax },
      technical: { score: technicalScore, maxScore: technicalMax },
      project: { score: projectScore, maxScore: projectMax },
      hr: { score: hrScore, maxScore: hrMax },
      coding: { score: codingScore, maxScore: codingMax },
    },
    attemptedCount,
    unattemptedCount,
    totalCount,
    questionResults,
  };
}

export default function Results({ sessionId: propSessionId, initialResultData }) {
  const token = getAuthToken();
  const { interviewId, sessionId: paramSessionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeId =
    propSessionId ||
    paramSessionId ||
    interviewId ||
    searchParams.get("session") ||
    searchParams.get("interviewId") ||
    searchParams.get("id");

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evalFailed, setEvalFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");
  const [roundFilter, setRoundFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expandedItems, setExpandedItems] = useState({});

  useEffect(() => {
    let isCancelled = false;

    const fetchResult = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };

        if (initialResultData && initialResultData.status === "COMPLETED" && initialResultData.totalObtained !== undefined) {
          const norm = normalizeRealInterviewResult(initialResultData);
          if (norm && !isCancelled) {
            console.log(`[RESULT-FRONTEND] sessionId=${activeId || norm.sessionId}`);
            console.log(`[RESULT-FRONTEND] using initialResultData`);
            console.log(`[RESULT-FRONTEND] totalObtained=${norm.totalObtained}`);
            console.log(`[RESULT-FRONTEND] maxScore=${norm.maxScore}`);
            console.log(`[RESULT-FRONTEND] percentage=${norm.percentage}`);
            setResult(norm);
            setLoading(false);
            return;
          }
        }

        if (activeId) {
          console.log(`[RESULT-FRONTEND] sessionId=${activeId}`);
          console.log(`[RESULT-FRONTEND] request=/api/real-interview/result/${activeId}`);

          const res = await api.get(`/api/real-interview/result/${activeId}`, { headers }).catch((err) => {
            console.warn(`[RESULT-FRONTEND] fetch warning:`, err.message);
            return { status: err.response?.status || 500, data: null };
          });

          if (isCancelled) return;

          console.log(`[RESULT-FRONTEND] responseStatus=${res.status}`);
          console.log(`[RESULT-FRONTEND] rawResponse=`, res.data);

          if (res.data?.status === "EVALUATION_FAILED") {
            setEvalFailed(true);
            setLoading(false);
            return;
          }

          if (res.data?.success && res.data?.result) {
            const norm = normalizeRealInterviewResult(res.data);
            if (norm) {
              console.log(`[RESULT-FRONTEND] totalObtained=${norm.totalObtained}`);
              console.log(`[RESULT-FRONTEND] maxScore=${norm.maxScore}`);
              console.log(`[RESULT-FRONTEND] percentage=${norm.percentage}`);
              setResult(norm);
              setLoading(false);
              return;
            }
          }

          // Status check fallback if result doc is not directly accessible
          const { data: statusData } = await api.get(`/api/real-interview/result/${activeId}/status`, { headers }).catch(() => ({ data: null }));
          if (isCancelled) return;

          if (statusData && statusData.status === "EVALUATION_FAILED") {
            setEvalFailed(true);
            setLoading(false);
            return;
          }

          if (statusData && statusData.status === "COMPLETED") {
            const retryRes = await api.get(`/api/real-interview/result/${activeId}`, { headers }).catch(() => null);
            if (!isCancelled && retryRes?.data?.success && retryRes?.data?.result) {
              const norm = normalizeRealInterviewResult(retryRes.data);
              console.log(`[RESULT-FRONTEND] totalObtained=${norm.totalObtained}`);
              console.log(`[RESULT-FRONTEND] maxScore=${norm.maxScore}`);
              console.log(`[RESULT-FRONTEND] percentage=${norm.percentage}`);
              setResult(norm);
              setLoading(false);
              return;
            }
          }

          setError("Real interview result not available yet for session: " + activeId);
          setLoading(false);
          return;
        }

        setError("No active interview session ID provided.");
        setLoading(false);
      } catch (err) {
        if (!isCancelled) setError(err.message || "Failed to load result.");
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchResult();

    return () => {
      isCancelled = true;
    };
  }, [activeId, initialResultData, token]);

  const handleTryAgain = async () => {
    if (!activeId) return;
    setRetrying(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await api.post(`/api/real-interview/result/${activeId}/retry`, {}, { headers });
      if (data.success && data.result) {
        const norm = normalizeRealInterviewResult(data);
        setResult(norm);
        setEvalFailed(false);
      } else if (data.status === "EVALUATION_FAILED") {
        setEvalFailed(true);
      }
    } catch (err) {
      console.error("[Results] Retry evaluation failed:", err.message);
      setEvalFailed(true);
    } finally {
      setRetrying(false);
    }
  };

  const toggleExpand = (qId) => {
    setExpandedItems((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

  const totalObtained = useMemo(() => {
    if (!result) return 0;
    return result.totalObtained ?? result.overallScore ?? 0;
  }, [result]);

  const maxScore = useMemo(() => {
    if (!result) return 450;
    return result.maximumMarks ?? result.maxScore ?? 450;
  }, [result]);

  const percentage = useMemo(() => {
    if (!result) return 0;
    if (typeof result.percentage === "number") return result.percentage;
    return maxScore > 0 ? Number(((totalObtained / maxScore) * 100).toFixed(2)) : 0;
  }, [result, totalObtained, maxScore]);

  const aptitudeScore = useMemo(() => result?.rounds?.aptitude?.score ?? result?.rounds?.aptitude?.obtained ?? result?.roundScores?.aptitude?.score ?? 0, [result]);
  const aptitudeMax = useMemo(() => result?.rounds?.aptitude?.maxScore ?? result?.rounds?.aptitude?.maximum ?? result?.roundScores?.aptitude?.maxScore ?? 50, [result]);

  const technicalScore = useMemo(() => result?.rounds?.technical?.score ?? result?.rounds?.technical?.obtained ?? result?.roundScores?.technical?.score ?? 0, [result]);
  const technicalMax = useMemo(() => result?.rounds?.technical?.maxScore ?? result?.rounds?.technical?.maximum ?? result?.roundScores?.technical?.maxScore ?? 100, [result]);

  const projectScore = useMemo(() => result?.rounds?.project?.score ?? result?.rounds?.project?.obtained ?? result?.roundScores?.project?.score ?? 0, [result]);
  const projectMax = useMemo(() => result?.rounds?.project?.maxScore ?? result?.rounds?.project?.maximum ?? result?.roundScores?.project?.maxScore ?? 100, [result]);

  const hrScore = useMemo(() => result?.rounds?.hr?.score ?? result?.rounds?.hr?.obtained ?? result?.roundScores?.hr?.score ?? 0, [result]);
  const hrMax = useMemo(() => result?.rounds?.hr?.maxScore ?? result?.rounds?.hr?.maximum ?? result?.roundScores?.hr?.maxScore ?? 100, [result]);

  const codingScore = useMemo(() => result?.rounds?.coding?.score ?? result?.rounds?.coding?.obtained ?? result?.roundScores?.coding?.score ?? 0, [result]);
  const codingMax = useMemo(() => result?.rounds?.coding?.maxScore ?? result?.rounds?.coding?.maximum ?? result?.roundScores?.coding?.maxScore ?? 100, [result]);


  const questionResults = useMemo(() => result?.questionResults || [], [result]);

  const attemptedCount = useMemo(() => {
    if (!result) return 0;
    if (typeof result.attemptedQuestionsCount === "number") return result.attemptedQuestionsCount;
    return questionResults.filter((q) => q.status !== "NOT_ATTEMPTED" && q.candidateAnswer !== "Not Answered" && q.candidateAnswer !== "Not Submitted").length;
  }, [result, questionResults]);

  const totalCount = useMemo(() => result?.totalQuestionsCount ?? (questionResults.length > 0 ? questionResults.length : 53), [result, questionResults]);
  const unattemptedCount = useMemo(() => Math.max(0, totalCount - attemptedCount), [totalCount, attemptedCount]);

  const filteredQuestions = useMemo(() => {
    return questionResults.filter((item) => {
      const matchRound = roundFilter === "ALL" || item.roundType === roundFilter;
      const isNotAtt = item.status === "NOT_ATTEMPTED" || item.candidateAnswer === "Not Answered" || item.candidateAnswer === "Not Submitted";
      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "CORRECT" && item.status === "CORRECT") ||
        (statusFilter === "PARTIAL" && (item.status === "PARTIALLY_CORRECT" || item.status === "PARTIAL")) ||
        (statusFilter === "INCORRECT" && item.status === "INCORRECT") ||
        (statusFilter === "NOT_ATTEMPTED" && isNotAtt);

      return matchRound && matchStatus;
    });
  }, [questionResults, roundFilter, statusFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050609] text-white flex items-center justify-center p-6 font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          <p className="text-sm font-medium text-slate-400">Fetching Interview Result...</p>
        </div>
      </div>
    );
  }

  if (evalFailed) {
    return (
      <div className="min-h-screen bg-[#050609] text-white flex items-center justify-center p-6 font-sans select-none">
        <div className="max-w-lg w-full bg-slate-900 border border-amber-500/20 rounded-3xl p-8 sm:p-10 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-black text-white uppercase tracking-wider">AI Evaluation Service Unavailable</h2>
            <p className="text-sm text-slate-300 font-medium leading-relaxed">
              Your interview was completed successfully, but we couldn't generate your result right now.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your answers are safely saved. The AI evaluation service is temporarily unavailable. Please try again later.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleTryAgain}
              disabled={retrying}
              className="flex-1 py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition shadow-lg"
            >
              {retrying && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{retrying ? "Evaluating..." : "Try Again"}</span>
            </button>

            <button
              onClick={() => navigate("/dashboard")}
              className="flex-1 py-3.5 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider cursor-pointer transition border border-white/10"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-[#050609] text-white flex items-center justify-center p-6 font-sans select-none">
        <div className="max-w-md w-full bg-slate-900 border border-white/10 rounded-3xl p-8 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">No Result Available</h2>
          <p className="text-xs text-slate-400">{error || "Please submit your interview to generate a result."}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050609] text-white p-4 sm:p-8 font-sans select-none">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl font-black uppercase tracking-wider text-white">REAL INTERVIEW RESULT</h1>
              <p className="text-xs text-slate-400 font-mono">Session ID: {result.sessionId || activeId}</p>
            </div>
          </div>
        </div>

        {/* 1. OVERALL SCORE CARD */}
        <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 sm:p-8 text-center space-y-3 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Overall Score</p>
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-5xl sm:text-6xl font-black font-mono text-emerald-400">
              {totalObtained}
            </span>
            <span className="text-2xl font-bold text-slate-500 font-mono">/ {maxScore}</span>
          </div>
          <div className="inline-block px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-bold font-mono">
            {percentage}%
          </div>
        </div>

        {/* 2. ROUND PERFORMANCE */}
        <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Round Performance</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-slate-300">Aptitude</p>
                <p className="text-[10px] text-slate-500">15 Questions</p>
              </div>
              <span className="font-mono text-sm font-black text-amber-400">{aptitudeScore} <span className="text-xs text-slate-500 font-normal">/ {aptitudeMax}</span></span>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-slate-300">Technical</p>
                <p className="text-[10px] text-slate-500">20 Questions</p>
              </div>
              <span className="font-mono text-sm font-black text-blue-400">{technicalScore} <span className="text-xs text-slate-500 font-normal">/ {technicalMax}</span></span>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-slate-300">Project</p>
                <p className="text-[10px] text-slate-500">10 Questions</p>
              </div>
              <span className="font-mono text-sm font-black text-cyan-400">{projectScore} <span className="text-xs text-slate-500 font-normal">/ {projectMax}</span></span>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-slate-300">HR Behavioral</p>
                <p className="text-[10px] text-slate-500">5 Questions</p>
              </div>
              <span className="font-mono text-sm font-black text-purple-400">{hrScore} <span className="text-xs text-slate-500 font-normal">/ {hrMax}</span></span>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-slate-300">Coding</p>
                <p className="text-[10px] text-slate-500">3 Questions</p>
              </div>
              <span className="font-mono text-sm font-black text-emerald-400">{codingScore} <span className="text-xs text-slate-500 font-normal">/ {codingMax}</span></span>
            </div>
          </div>
        </div>

        {/* 3. PERFORMANCE SUMMARY */}
        <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Performance Summary</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-center space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Questions Attempted</p>
              <p className="text-2xl font-black text-emerald-400 font-mono">{attemptedCount} <span className="text-sm font-normal text-slate-500">/ {totalCount}</span></p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-white/10 text-center space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Questions Not Attempted</p>
              <p className="text-2xl font-black text-slate-400 font-mono">{unattemptedCount} <span className="text-sm font-normal text-slate-500">/ {totalCount}</span></p>
            </div>
          </div>
        </div>

        {/* 4. QUESTION-WISE REVIEW */}
        {questionResults.length > 0 && (
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Question-wise Review</h2>

              {/* Filters */}
              <div className="flex flex-wrap gap-2 text-xs">
                <select
                  value={roundFilter}
                  onChange={(e) => setRoundFilter(e.target.value)}
                  className="bg-slate-950 border border-white/10 rounded-xl px-3 py-1 text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Rounds</option>
                  <option value="APTITUDE">Aptitude</option>
                  <option value="TECHNICAL">Technical</option>
                  <option value="RESUME_PROJECT">Project</option>
                  <option value="HR">HR</option>
                  <option value="CODING">Coding</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-white/10 rounded-xl px-3 py-1 text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="CORRECT">Correct</option>
                  <option value="PARTIAL">Partially Correct</option>
                  <option value="INCORRECT">Incorrect</option>
                  <option value="NOT_ATTEMPTED">Not Attempted</option>
                </select>
              </div>
            </div>

            {/* QUESTIONS LIST */}
            <div className="space-y-3">
              {filteredQuestions.map((item, idx) => {
                const qId = item.questionId || `q_${idx}`;
                const isExpanded = Boolean(expandedItems[qId]);
                const isNotAttempted = item.status === "NOT_ATTEMPTED" || item.candidateAnswer === "Not Answered" || item.candidateAnswer === "Not Submitted";
                const isCorrect = item.status === "CORRECT";
                const isPartial = item.status === "PARTIALLY_CORRECT";

                return (
                  <div
                    key={qId}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isNotAttempted
                        ? "bg-slate-950/60 border-white/5"
                        : isCorrect
                        ? "bg-emerald-500/[0.02] border-emerald-500/20"
                        : isPartial
                        ? "bg-blue-500/[0.02] border-blue-500/20"
                        : "bg-red-500/[0.02] border-red-500/20"
                    }`}
                  >
                    <button
                      onClick={() => toggleExpand(qId)}
                      className="w-full p-4 flex items-start justify-between gap-3 text-left cursor-pointer hover:bg-white/[0.02] transition"
                    >
                      <div className="flex items-start gap-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-white/10 text-slate-300 shrink-0 mt-0.5">
                          {item.roundType}
                        </span>

                        <div>
                          <p className="text-xs font-semibold text-white leading-snug">
                            Q{idx + 1}. {item.question}
                          </p>

                          <div className="flex items-center gap-2 mt-1.5">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                isNotAttempted
                                  ? "bg-slate-800 text-slate-400"
                                  : isCorrect
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : isPartial
                                  ? "bg-blue-500/20 text-blue-400"
                                  : "bg-red-500/20 text-red-400"
                              }`}
                            >
                              {isNotAttempted ? "NOT ATTEMPTED" : isCorrect ? "CORRECT" : isPartial ? "PARTIAL" : "INCORRECT"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-sm font-black text-white">
                          {item.score} <span className="text-xs text-slate-500 font-normal">/ {item.maxScore}</span>
                        </span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-white/5 space-y-3 pt-3 text-xs">
                        <div className="p-3 rounded-xl bg-slate-950 border border-white/10 space-y-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Your Answer:</span>
                          <p className="font-mono text-slate-200 whitespace-pre-wrap">{item.candidateAnswer || "Not Answered"}</p>
                        </div>

                        {item.correctAnswer && (
                          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Reference / Correct Answer:</span>
                            <p className="text-slate-300">{item.correctAnswer}</p>
                          </div>
                        )}

                        {item.feedback && (
                          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">Feedback:</span>
                            <p className="text-slate-300">{item.feedback}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. ACTIONS */}
        <div className="flex justify-center pt-2">
          <button
            onClick={() => navigate("/dashboard")}
            className="py-3 px-8 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-lg"
          >
            Back to Dashboard
          </button>
        </div>

      </div>
    </div>
  );
}
