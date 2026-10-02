import React, { useState, useEffect } from "react";
import { Loader2, AlertCircle, RefreshCw, Key } from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import BYOKModal from "../BYOKModal";

function EvaluationLoadingScreen({ sessionId, onCompleted, isIndividualTechnical = false, isIndividualProject = false }) {
  const token = getAuthToken();
  const [errorMsg, setErrorMsg] = useState("");
  const [quotaError, setQuotaError] = useState(null);
  const [byokModalOpen, setByokModalOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    let intervalId = null;
    let isCancelled = false;

    const checkStatus = async () => {
      if (!sessionId || isCancelled) return;
      try {
        const headers = { Authorization: `Bearer ${token}` };
        if (isIndividualProject) {
          const { data } = await api.get(`/api/individual/project/result/${sessionId}`, { headers });
          if (isCancelled) return;
          const resDoc = data?.result || data;
          if (resDoc) {
            if (resDoc.status === "EVALUATION_FAILED") {
              setErrorMsg("AI evaluation encountered a temporary delay.");
              if (intervalId) clearInterval(intervalId);
              return;
            }
            if (resDoc.status === "CALCULATING" || resDoc.status === "IN_PROGRESS") {
              // Still calculating — continue polling
              return;
            }
            if (resDoc.obtainedScore !== undefined || resDoc.percentage !== undefined) {
              if (intervalId) clearInterval(intervalId);
              onCompleted(resDoc);
              return;
            }
          }
        } else if (isIndividualTechnical) {
          const { data } = await api.get(`/api/individual/technical/result/${sessionId}`, { headers });
          if (isCancelled) return;
          if (data && (data.obtainedScore !== undefined || data.sessionId)) {
            if (intervalId) clearInterval(intervalId);
            onCompleted(data);
            return;
          }
        } else {
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

          if (data.status === "FAILED" || data.status === "EVALUATION_FAILED" || data.status === "PARTIAL_EVALUATION" || data.errorType) {
            setQuotaError({
              errorType: data.errorType,
              keySource: data.keySource || "PLATFORM",
              requiresUserApiKey: Boolean(data.requiresUserApiKey),
              requiresNewApiKey: Boolean(data.requiresNewApiKey),
              message: data.message || data.recoveryMessage || "",
            });
            setErrorMsg(data.message || data.recoveryMessage || data.errorDetails || "AI evaluation service encountered a temporary issue. Please retry.");
            if (intervalId) clearInterval(intervalId);
          }
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
  }, [sessionId, token, onCompleted, isIndividualTechnical, isIndividualProject]);

  const handleRetry = async (byokPayload = null) => {
    if (isRetrying) return;
    setIsRetrying(true);
    setErrorMsg("");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const endpoint = isIndividualProject
        ? `/api/individual/project/session/${sessionId}/retry-evaluation`
        : isIndividualTechnical
        ? `/api/individual/technical/result/${sessionId}/retry`
        : `/api/real-interview/result/${sessionId}/retry`;

      const body = byokPayload && byokPayload.apiKey ? {
        provider: byokPayload.provider,
        apiKey: byokPayload.apiKey,
      } : {};

      const res = await api.post(endpoint, body, { headers });
      const resData = res.data?.result || res.data;
      if (res.data?.success && resData?.status === "COMPLETED") {
        onCompleted(resData);
      } else if (resData?.status === "PARTIAL_EVALUATION" || resData?.status === "EVALUATION_FAILED" || res.data?.errorType) {
        setQuotaError({
          errorType: res.data?.errorType,
          keySource: res.data?.keySource || "PLATFORM",
          requiresUserApiKey: Boolean(res.data?.requiresUserApiKey),
          requiresNewApiKey: Boolean(res.data?.requiresNewApiKey),
          message: res.data?.message || res.data?.recoveryMessage || "",
        });
        setErrorMsg(res.data?.message || res.data?.recoveryMessage || "AI evaluation service encountered a temporary issue. Please retry failed evaluations.");
      } else if (resData && (resData.obtainedScore !== undefined || resData.percentage !== undefined)) {
        onCompleted(resData);
      }
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.errorType) {
        setQuotaError({
          errorType: errData.errorType,
          keySource: errData.keySource || "PLATFORM",
          requiresUserApiKey: Boolean(errData.requiresUserApiKey),
          requiresNewApiKey: Boolean(errData.requiresNewApiKey),
          message: errData.message || errData.recoveryMessage || "",
        });
      }
      setErrorMsg(errData?.message || err.message || "Retry failed. Service temporarily unavailable.");
    } finally {
      setIsRetrying(false);
    }
  };

  if (errorMsg) {
    const isByokQuotaExhausted =
      quotaError?.errorType === "BYOK_QUOTA_EXHAUSTED" ||
      quotaError?.requiresNewApiKey ||
      quotaError?.keySource === "BYOK_REQUEST" ||
      quotaError?.keySource === "BYOK_SESSION";

    const isPlatformQuotaExhausted =
      quotaError?.errorType === "AI_QUOTA_EXHAUSTED" ||
      quotaError?.requiresUserApiKey ||
      (quotaError?.keySource === "PLATFORM" && Boolean(quotaError?.errorType));

    return (
      <div className="min-h-screen bg-[#050609] text-white flex items-center justify-center p-6 font-sans select-none">
        <div className="max-w-lg w-full bg-slate-900 border border-amber-500/30 rounded-3xl p-8 sm:p-10 text-center space-y-6 shadow-2xl relative">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-3">
            {isByokQuotaExhausted ? (
              <>
                <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center justify-center gap-2">
                  <span>⚠️</span> API Key Usage Limit Reached
                </h2>
                <div className="text-xs text-slate-300 font-medium leading-relaxed space-y-2 text-left bg-white/[0.03] p-4 rounded-xl border border-white/5">
                  <p>
                    Sorry! The AI API key currently being used for your evaluation has reached its usage limit or is no longer available.
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    Your interview answers have been safely preserved. Please provide a new API key to continue your interview evaluation.
                  </p>
                </div>
              </>
            ) : isPlatformQuotaExhausted ? (
              <>
                <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center justify-center gap-2">
                  <span>⚠️</span> AI Evaluation Temporarily Unavailable
                </h2>
                <div className="text-xs text-slate-300 font-medium leading-relaxed space-y-2 text-left bg-white/[0.03] p-4 rounded-xl border border-white/5">
                  <p>
                    Sorry! Our AI service has temporarily reached its usage limit.
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    We couldn't complete your interview evaluation using our platform AI service. Your interview answers have been safely preserved. Please provide your own AI API key to continue your evaluation.
                  </p>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-black text-white uppercase tracking-wider">
                  AI Evaluation Temporarily Unavailable
                </h2>
                <p className="text-sm text-slate-300 font-medium leading-relaxed">
                  Your interview responses are safely saved in MongoDB, but automated AI evaluation encountered a temporary delay.
                </p>
                <p className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-white/10 font-mono">
                  {errorMsg}
                </p>
              </>
            )}
          </div>

          <div className="flex flex-col gap-3 pt-2">
            {isByokQuotaExhausted ? (
              <button
                onClick={() => setByokModalOpen(true)}
                disabled={isRetrying}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#FF8A3D] hover:brightness-110 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#FF6B35]/20 disabled:opacity-50"
              >
                <Key className="w-4 h-4" />
                <span>Enter New API Key</span>
              </button>
            ) : isPlatformQuotaExhausted ? (
              <button
                onClick={() => setByokModalOpen(true)}
                disabled={isRetrying}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#FF8A3D] hover:brightness-110 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#FF6B35]/20 disabled:opacity-50"
              >
                <Key className="w-4 h-4" />
                <span>Use My API Key</span>
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => handleRetry()}
                  disabled={isRetrying}
                  className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#FF8A3D] hover:brightness-110 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#FF6B35]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRetrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  <span>{isRetrying ? "Retrying failed evaluations..." : "Retry Failed Evaluation"}</span>
                </button>
                <button
                  onClick={() => setByokModalOpen(true)}
                  disabled={isRetrying}
                  className="flex-1 py-3.5 px-6 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] text-orange-400 font-bold text-xs uppercase tracking-wider cursor-pointer transition border border-orange-500/30 flex items-center justify-center gap-2"
                >
                  <Key className="w-4 h-4" />
                  <span>Use Custom Key</span>
                </button>
              </div>
            )}

            <button
              onClick={() => { window.location.href = "/dashboard"; }}
              className="w-full py-3.5 px-6 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] text-white/80 font-bold text-xs uppercase tracking-wider cursor-pointer transition border border-white/10"
            >
              Back to Dashboard
            </button>
          </div>

          <BYOKModal
            isOpen={byokModalOpen}
            onClose={() => setByokModalOpen(false)}
            onSave={(data) => {
              setByokModalOpen(false);
              handleRetry(data);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050609] text-white flex items-center justify-center p-6 font-sans select-none">
      <div
        className="max-w-md w-full rounded-3xl p-8 text-center space-y-5 shadow-2xl"
        style={{
          background: "rgba(12, 15, 26, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <div className="w-14 h-14 rounded-2xl bg-[#FF6B35]/15 border border-[#FF6B35]/30 text-[#FF6B35] flex items-center justify-center mx-auto">
          <Loader2 className="w-7 h-7 animate-spin" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-white uppercase tracking-wider">
            {isIndividualProject
              ? "Calculating Project Interview Result"
              : isIndividualTechnical
              ? "Calculating Technical Practice Result"
              : "Calculating Real Interview Result"}
          </h2>
          <p className="text-xs text-white/50">Evaluating practice responses from MongoDB...</p>
        </div>
      </div>
    </div>
  );
}

export default EvaluationLoadingScreen;
