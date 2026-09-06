import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, CheckCircle2, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";

const STAGES = [
  { key: "SUBMITTED", label: "Interview submitted & responses saved", progress: 10 },
  { key: "EVALUATING_APTITUDE", label: "Aptitude responses checked", progress: 25 },
  { key: "EVALUATING_TECHNICAL", label: "Technical responses evaluated", progress: 45 },
  { key: "EVALUATING_PROJECT", label: "Project responses evaluated", progress: 65 },
  { key: "EVALUATING_HR", label: "HR & Behavioral responses evaluated", progress: 80 },
  { key: "EVALUATING_CODING", label: "Coding execution evaluated", progress: 90 },
  { key: "CALCULATING_RESULT", label: "Calculating final score & persisting result", progress: 95 },
  { key: "COMPLETED", label: "Final score calculated and stored", progress: 100 },
];

function EvaluationLoadingScreen({ sessionId, onCompleted }) {
  const token = getAuthToken();
  const [statusState, setStatusState] = useState("SUBMITTED");
  const [stageText, setStageText] = useState("Submitting your interview...");
  const [progressPercent, setProgressPercent] = useState(10);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    let intervalId = null;
    let isCancelled = false;

    const checkStatus = async () => {
      if (!sessionId || isCancelled) return;
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const { data } = await api.get(`/api/real-interview/result/${sessionId}/status`, { headers });

        if (isCancelled) return;

        if (data.status === "COMPLETED") {
          setStatusState("COMPLETED");
          setProgressPercent(100);
          setStageText("Evaluation complete!");
          if (intervalId) clearInterval(intervalId);

          // Fetch stored result and call onCompleted
          const resultRes = await api.get(`/api/real-interview/result/${sessionId}`, { headers });
          if (resultRes.data?.success && resultRes.data?.result) {
            onCompleted(resultRes.data.result);
          }
          return;
        }

        if (data.status === "EVALUATION_FAILED") {
          setIsError(true);
          setErrorMessage(data.errorDetails || "We couldn't complete your result evaluation right now.");
          if (intervalId) clearInterval(intervalId);
          return;
        }

        setStatusState(data.status || "SUBMITTED");
        setStageText(data.evaluationStage || "Processing evaluation...");
        if (typeof data.evaluationProgress === "number") {
          setProgressPercent(data.evaluationProgress);
        }
      } catch (err) {
        console.warn("[EvaluationLoadingScreen] status check warning:", err.message);
      }
    };

    // Initial check
    checkStatus();
    // Poll every 1.5s
    intervalId = setInterval(checkStatus, 1500);

    return () => {
      isCancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [sessionId, token, onCompleted]);

  const handleRetry = async () => {
    setIsRetrying(true);
    setIsError(false);
    setErrorMessage("");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await api.post(`/api/real-interview/result/${sessionId}/retry`, {}, { headers });
      setStatusState("SUBMITTED");
      setProgressPercent(10);
      setStageText("Retrying evaluation pipeline...");
    } catch (err) {
      setIsError(true);
      setErrorMessage(err.response?.data?.message || err.message || "Retry failed.");
    } finally {
      setIsRetrying(false);
    }
  };

  const getStageStatus = (stageKey) => {
    const stageOrder = [
      "SUBMITTED",
      "EVALUATING_APTITUDE",
      "EVALUATING_TECHNICAL",
      "EVALUATING_PROJECT",
      "EVALUATING_HR",
      "EVALUATING_CODING",
      "CALCULATING_RESULT",
      "COMPLETED",
    ];

    const currentIndex = stageOrder.indexOf(statusState);
    const targetIndex = stageOrder.indexOf(stageKey);

    if (currentIndex > targetIndex || statusState === "COMPLETED") return "DONE";
    if (currentIndex === targetIndex) return "IN_PROGRESS";
    return "PENDING";
  };

  if (isError) {
    return (
      <div className="min-h-screen bg-[#050609] text-white flex items-center justify-center p-6 font-sans select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-slate-900/95 border border-red-500/30 rounded-3xl p-8 text-center space-y-6 shadow-2xl"
        >
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-white">Evaluation Temporarily Paused</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              We couldn't complete your result evaluation right now.
            </p>
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-mono text-red-300">
              {errorMessage}
            </div>
            <p className="text-xs text-slate-400 pt-2">
              Your interview responses are safely saved in the system.
            </p>
          </div>

          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-50"
          >
            {isRetrying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Retrying Pipeline...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Retry Result Evaluation</span>
              </>
            )}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050609] text-white flex items-center justify-center p-6 font-sans select-none">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full bg-slate-900/95 border border-white/10 rounded-3xl p-8 shadow-2xl space-y-7"
      >
        {/* BRANDING HEADER */}
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-white shadow-lg animate-pulse">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-wider uppercase text-white">
              Evaluating Your Interview
            </h2>
            <p className="text-xs text-white/50">
              Production-Grade Authoritative Evaluation Pipeline
            </p>
          </div>
        </div>

        {/* PROGRESS BAR */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-400 uppercase font-bold">{stageText}</span>
            <span className="text-emerald-400 font-black">{progressPercent}%</span>
          </div>
          <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden p-0.5 border border-white/5">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400"
              initial={{ width: "10%" }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* CHECKLIST OF STAGES */}
        <div className="space-y-3 pt-2 border-t border-white/10">
          {STAGES.slice(0, 7).map((st) => {
            const stState = getStageStatus(st.key);
            const isDone = stState === "DONE";
            const isInProgress = stState === "IN_PROGRESS";

            return (
              <div
                key={st.key}
                className={`flex items-center justify-between p-3 rounded-xl border text-xs font-medium transition-all ${
                  isDone
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300 font-bold"
                    : isInProgress
                    ? "bg-blue-500/10 border-blue-500/30 text-white font-bold"
                    : "bg-white/[0.02] border-white/5 text-slate-500"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : isInProgress ? (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-slate-600 shrink-0" />
                  )}
                  <span>{st.label}</span>
                </div>

                <span className="font-mono text-[10px] uppercase font-bold opacity-75">
                  {isDone ? "COMPLETE" : isInProgress ? "EVALUATING" : "WAITING"}
                </span>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-slate-400 italic">
          Please wait while we calculate and verify your authoritative score.
        </p>
      </motion.div>
    </div>
  );
}

export default EvaluationLoadingScreen;
