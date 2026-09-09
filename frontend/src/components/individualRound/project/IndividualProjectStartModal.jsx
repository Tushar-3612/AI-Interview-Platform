import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Key, FolderGit2, CheckCircle2, AlertCircle } from "lucide-react";
import api from "../../../utils/api";
import { getAuthToken } from "../../../hooks/useStudentProfile";
import toast from "react-hot-toast";

export default function IndividualProjectStartModal({ isOpen, onClose, onStartSuccess }) {
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
    const toastId = toast.loading("Preparing Project Practice Session...");

    try {
      const token = getAuthToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const { data } = await api.post(
        "/api/individual/project/start",
        {
          sourceMode,
          interviewKeyId: sourceMode === "INTERVIEW_KEY" ? interviewKeyId.trim() : "",
          difficulty,
        },
        { headers }
      );

      if (data.success && data.sessionId) {
        toast.success("Project Practice Session Ready!", { id: toastId });
        onClose();
        if (onStartSuccess) {
          onStartSuccess(data.sessionId);
        }
      } else {
        throw new Error(data.message || "Failed to start project practice session.");
      }
    } catch (err) {
      console.error("Start Individual Project Error:", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "We couldn't prepare your Project Practice right now. Please try again.";
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
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <FolderGit2 className="w-4 h-4" />
                </div>
                <h2 className="text-xl font-extrabold tracking-tight">Project / Resume Practice</h2>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                10-Question Targeted Project & Resume Practice (Max Score = 100)
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
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              1. Question Source
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setSourceMode("RESUME");
                  setErrorMsg("");
                }}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition ${
                  sourceMode === "RESUME"
                    ? "bg-emerald-500/10 border-emerald-500/50 text-white"
                    : "bg-gray-800/50 border-gray-800 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`}
              >
                <Sparkles
                  className={`w-5 h-5 ${sourceMode === "RESUME" ? "text-emerald-400" : "text-gray-500"}`}
                />
                <div>
                  <div className="text-sm font-bold">Your Resume / Profile</div>
                  <div className="text-[11px] text-gray-400">Extracts projects & skills from profile</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSourceMode("INTERVIEW_KEY");
                  setErrorMsg("");
                }}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition ${
                  sourceMode === "INTERVIEW_KEY"
                    ? "bg-emerald-500/10 border-emerald-500/50 text-white"
                    : "bg-gray-800/50 border-gray-800 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`}
              >
                <Key
                  className={`w-5 h-5 ${
                    sourceMode === "INTERVIEW_KEY" ? "text-emerald-400" : "text-gray-500"
                  }`}
                />
                <div>
                  <div className="text-sm font-bold">Interview Key / Code</div>
                  <div className="text-[11px] text-gray-400">Load company/key specific project scope</div>
                </div>
              </button>
            </div>

            {sourceMode === "INTERVIEW_KEY" && (
              <div className="mt-2 space-y-1">
                <input
                  type="text"
                  placeholder="Enter Interview Key ID (e.g. tcs-nqt, capgemini-sec)"
                  value={interviewKeyId}
                  onChange={(e) => setInterviewKeyId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}
          </div>

          {/* Section 2: Difficulty Selection */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              2. Select Difficulty
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "Easy", label: "Easy", desc: "10 Easy Qs" },
                { id: "Medium", label: "Medium", desc: "10 Medium Qs" },
                { id: "Hard", label: "Hard", desc: "10 Hard Qs" },
                { id: "Mixed", label: "Mixed", desc: "4 Easy, 4 Med, 2 Hard" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDifficulty(item.id)}
                  className={`p-3 rounded-2xl border text-center transition ${
                    difficulty === item.id
                      ? "bg-emerald-500/10 border-emerald-500/60 text-white font-bold"
                      : "bg-gray-800/40 border-gray-800 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                  }`}
                >
                  <div className="text-xs font-bold">{item.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Practice Feature Highlights */}
          <div className="bg-gray-800/40 rounded-2xl p-4 border border-gray-800 text-xs text-gray-400 space-y-2">
            <div className="flex items-center gap-2 text-gray-300 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Project Practice Round Information:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-gray-400 pl-1">
              <li>10 Deep Project Questions total (Max Score = 100 Marks).</li>
              <li>Questions test architecture, DB schema, API design, trade-offs, and failure recovery.</li>
              <li>Voice-to-text recording supported with automatic answer persistence.</li>
              <li>Includes full PDF Evaluation Report download after completion.</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-400 hover:text-white hover:bg-gray-800 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleStart}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Generating Questions...</span>
                </>
              ) : (
                <>
                  <FolderGit2 className="w-4 h-4" />
                  <span>Start Practice (10 Qs)</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
