import React, { useState, useEffect } from "react";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";

function EvaluationLoadingScreen({ sessionId, onCompleted }) {
  const token = getAuthToken();
  const [errorMsg, setErrorMsg] = useState("");
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
          if (intervalId) clearInterval(intervalId);
          const resultRes = await api.get(`/api/real-interview/result/${sessionId}`, { headers });
          if (resultRes.data?.success && resultRes.data?.result) {
            onCompleted(resultRes.data.result);
          }
          return;
        }

        if (data.status === "FAILED" || data.status === "EVALUATION_FAILED") {
          setErrorMsg(data.errorDetails || "AI evaluation service is temporarily unavailable.");
          if (intervalId) clearInterval(intervalId);
        }
      } catch (err) {
        console.warn("[EvaluationLoadingScreen] Status check warning:", err.message);
      }
    };

    checkStatus();
    intervalId = setInterval(checkStatus, 1500);

    return () => {
      isCancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [sessionId, token, onCompleted]);

  const handleRetry = async () => {
    setIsRetrying(true);
    setErrorMsg("");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await api.post(`/api/real-interview/result/${sessionId}/retry`, {}, { headers });
      if (res.data?.success && res.data?.result) {
        onCompleted(res.data.result);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || "Retry failed. Service temporarily unavailable.");
    } finally {
      setIsRetrying(false);
    }
  };

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[#050609] text-white flex items-center justify-center p-6 font-sans select-none">
        <div className="max-w-lg w-full bg-slate-900 border border-amber-500/30 rounded-3xl p-8 sm:p-10 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-black text-white uppercase tracking-wider">AI Evaluation Temporarily Unavailable</h2>
            <p className="text-sm text-slate-300 font-medium leading-relaxed">
              Your interview responses are safely saved in MongoDB, but automated AI evaluation encountered a temporary delay.
            </p>
            <p className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-white/10 font-mono">
              {errorMsg}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex-1 py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
            >
              {isRetrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>{isRetrying ? "Evaluating..." : "Retry Evaluation"}</span>
            </button>

            <button
              onClick={() => { window.location.href = "/dashboard"; }}
              className="flex-1 py-3.5 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider cursor-pointer transition border border-white/10"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050609] text-white flex items-center justify-center p-6 font-sans select-none">
      <div className="max-w-md w-full bg-slate-900 border border-white/10 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto">
          <Loader2 className="w-7 h-7 animate-spin" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-white uppercase tracking-wider">Calculating Real Interview Result</h2>
          <p className="text-xs text-slate-400">Evaluating round responses from MongoDB...</p>
        </div>
      </div>
    </div>
  );
}

export default EvaluationLoadingScreen;
