import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Key, Zap, CheckCircle2, AlertCircle } from "lucide-react";
import api from "../../../utils/api";
import { getAuthToken } from "../../../hooks/useStudentProfile";
import toast from "react-hot-toast";

export default function IndividualTechnicalStartModal({ isOpen, onClose, onStartSuccess }) {
  const [sourceMode, setSourceMode] = useState("RESUME"); // "RESUME" | "INTERVIEW_KEY"
  const [interviewKeyId, setInterviewKeyId] = useState("");
  const [difficulty, setDifficulty] = useState("Mixed"); // "Easy" | "Medium" | "Hard" | "Mixed"
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleStart = async () => {
    setErrorMsg("");

    if (sourceMode === "INTERVIEW_KEY" && !interviewKeyId.trim()) {
      setErrorMsg("Please enter a valid Interview Key ID or Code.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Preparing Technical Practice Session...");

    try {
      const token = getAuthToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const { data } = await api.post(
        "/api/individual/technical/start",
        {
          sourceMode,
          interviewKeyId: sourceMode === "INTERVIEW_KEY" ? interviewKeyId.trim() : "",
          difficulty,
        },
        { headers }
      );

      if (data.success && data.sessionId) {
        toast.success("Technical Practice Session Ready!", { id: toastId });
        onClose();
        if (onStartSuccess) {
          onStartSuccess(data.sessionId);
        }
      } else {
        throw new Error(data.message || "Failed to start session.");
      }
    } catch (err) {
      console.error("Start Individual Technical Error:", err);
      const msg = err.response?.data?.message || err.message || "We couldn't prepare your Technical Practice right now. Please try again.";
      setErrorMsg(msg);
      toast.error(msg, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-xl bg-gray-900 border border-gray-800 rounded-3xl p-6 sm:p-8 text-white shadow-2xl space-y-6"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-gray-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-500">
                  <Zap className="w-4 h-4" />
                </div>
                <h2 className="text-xl font-extrabold tracking-tight">Technical Practice</h2>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                20-Question Targeted Technical Practice (Max Score = 100)
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Source Selection */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
              1. Choose Question Source
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setSourceMode("RESUME");
                  setErrorMsg("");
                }}
                className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                  sourceMode === "RESUME"
                    ? "bg-orange-500/10 border-orange-500 text-white shadow-lg shadow-orange-500/10"
                    : "bg-gray-800/50 border-gray-700/60 text-gray-300 hover:border-gray-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Sparkles className={`w-5 h-5 ${sourceMode === "RESUME" ? "text-orange-500" : "text-gray-400"}`} />
                  {sourceMode === "RESUME" && <CheckCircle2 className="w-4 h-4 text-orange-500" />}
                </div>
                <div>
                  <h4 className="text-sm font-bold">Start from Your Resume</h4>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">
                    Questions generated strictly from your technical skills context.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSourceMode("INTERVIEW_KEY");
                  setErrorMsg("");
                }}
                className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                  sourceMode === "INTERVIEW_KEY"
                    ? "bg-orange-500/10 border-orange-500 text-white shadow-lg shadow-orange-500/10"
                    : "bg-gray-800/50 border-gray-700/60 text-gray-300 hover:border-gray-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Key className={`w-5 h-5 ${sourceMode === "INTERVIEW_KEY" ? "text-orange-500" : "text-gray-400"}`} />
                  {sourceMode === "INTERVIEW_KEY" && <CheckCircle2 className="w-4 h-4 text-orange-500" />}
                </div>
                <div>
                  <h4 className="text-sm font-bold">Start from Interview Key</h4>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">
                    Load questions from an assigned test code or company bank.
                  </p>
                </div>
              </button>
            </div>

            {/* Input if Interview Key Mode */}
            {sourceMode === "INTERVIEW_KEY" && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="pt-2">
                <input
                  type="text"
                  value={interviewKeyId}
                  onChange={(e) => setInterviewKeyId(e.target.value)}
                  placeholder="Enter Interview Key ID or Test Code (e.g. cognizant, tcs)..."
                  className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-xs sm:text-sm text-white placeholder-gray-500 outline-none focus:border-orange-500"
                />
              </motion.div>
            )}
          </div>

          {/* Section 2: Difficulty Selection */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
              2. Choose Difficulty
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: "Easy", label: "Easy", desc: "20 Easy" },
                { id: "Medium", label: "Medium", desc: "20 Medium" },
                { id: "Hard", label: "Hard", desc: "20 Hard" },
                { id: "Mixed", label: "Mixed", desc: "8E • 10M • 2H" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDifficulty(item.id)}
                  className={`py-3 px-2 rounded-xl border text-center cursor-pointer transition-all ${
                    difficulty === item.id
                      ? "bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20"
                      : "bg-gray-800/60 border-gray-700 text-gray-300 hover:border-gray-600"
                  }`}
                >
                  <div className="text-xs font-black">{item.label}</div>
                  <div className="text-[10px] opacity-80 mt-0.5">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Info Banner */}
          <div className="p-3.5 rounded-2xl bg-gray-800/40 border border-gray-800 text-xs text-gray-400 leading-relaxed">
            <span className="font-bold text-gray-200">Note:</span> Individual Technical Practice contains 20 questions evaluated exclusively out of 100 marks. No Aptitude, HR, or Coding questions will be included.
          </div>

          {/* Submit Action */}
          <button
            type="button"
            disabled={loading || (sourceMode === "INTERVIEW_KEY" && !interviewKeyId.trim())}
            onClick={handleStart}
            className="w-full py-4 rounded-2xl text-sm font-extrabold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 active:scale-[0.99] shadow-lg shadow-orange-500/25 cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Preparing Questions...</span>
            ) : (
              <span>Start Technical Practice</span>
            )}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
