import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, BrainCircuit, Target, Code2, Layers, Mic, Zap, Sparkles, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";

function StartInterviewModal({ open, onClose, isStarting: externalIsStarting = false }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const isStarting = externalIsStarting || loading;

  if (!open) return null;

  const handleStartRealInterview = async () => {
    setLoading(true);
    const toastId = toast.loading("Initializing Real Interview Session...");
    try {
      const activeToken = getAuthToken();
      const headers = activeToken ? { Authorization: `Bearer ${activeToken}` } : {};

      const { data } = await api.post(
        "/api/student/interviews",
        { interviewType: "actual", targetRound: "all" },
        { headers }
      );
      const sessionId = data.sessionId || data.interviewId || data._id;
      if (sessionId) {
        toast.success("Real Interview session ready!", { id: toastId });
        onClose?.();
        navigate(`/interview/${sessionId}`);
      } else {
        throw new Error("No session ID returned");
      }
    } catch (err) {
      console.error("Start Real Interview error:", err);
      toast.error(err.response?.data?.message || "Failed to start Real Interview session", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={isStarting ? undefined : onClose}
          className="absolute inset-0"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", duration: 0.4, bounce: 0.1 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg rounded-3xl bg-[#0B0F19] border border-white/15 text-white shadow-2xl overflow-hidden"
          style={{
            boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 30px rgba(255,107,53,0.15)",
          }}
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-white/10 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3.5">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  background: "radial-gradient(circle, rgba(255,107,53,0.3) 0%, rgba(255,107,53,0.08) 100%)",
                  border: "1px solid rgba(255,107,53,0.35)",
                  boxShadow: "0 0 16px rgba(255,107,53,0.25)",
                }}
              >
                <BrainCircuit className="w-5 h-5 text-[#FF6B35]" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white leading-tight">
                  AI Real Interview
                </h2>
                <p className="text-[11.5px] sm:text-xs text-gray-400 mt-1 leading-relaxed">
                  Complete AI-powered placement interview based on your resume, technical skills, projects, behavioral responses and coding ability.
                </p>
              </div>
            </div>
            <button
              onClick={isStarting ? undefined : onClose}
              disabled={isStarting}
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer shrink-0"
              aria-label="Close modal"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 space-y-5 max-h-[78vh] overflow-y-auto custom-scrollbar">
            {/* Stats Summary Bar */}
            <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-center">
              <div className="space-y-0.5">
                <span className="text-lg font-black text-white block">53</span>
                <span className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider block">Questions</span>
              </div>
              <div className="space-y-0.5 border-x border-white/10">
                <span className="text-lg font-black text-[#FF6B35] block">5</span>
                <span className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider block">Rounds</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-lg font-black text-amber-400 block">450</span>
                <span className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider block">Total Marks</span>
              </div>
            </div>

            {/* Round Breakdown */}
            <div className="space-y-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 block px-1">
                Interview Structure & Marks
              </span>

              <div className="space-y-2">
                {[
                  { name: "Aptitude", count: "15 Questions", marks: "/50 Marks", color: "#F59E0B", icon: Target },
                  { name: "Technical", count: "20 Questions", marks: "/100 Marks", color: "#06B6D4", icon: Code2 },
                  { name: "Project/Resume", count: "10 Questions", marks: "/100 Marks", color: "#3B82F6", icon: Layers },
                  { name: "HR", count: "5 Questions", marks: "/100 Marks", color: "#A855F7", icon: Mic },
                  { name: "Coding", count: "3 Questions", marks: "/100 Marks", color: "#10B981", icon: Zap },
                ].map((round) => {
                  const Icon = round.icon;
                  return (
                    <div
                      key={round.name}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
                          style={{
                            background: `color-mix(in srgb, ${round.color} 12%, transparent)`,
                            borderColor: `color-mix(in srgb, ${round.color} 25%, transparent)`,
                            color: round.color,
                          }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white block">{round.name}</span>
                          <span className="text-[11px] text-gray-400 block">{round.count}</span>
                        </div>
                      </div>
                      <span className="text-xs font-black text-gray-300 px-2 py-1 rounded-md bg-white/5 border border-white/10">
                        {round.marks}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Primary Action Button */}
            <motion.button
              onClick={handleStartRealInterview}
              disabled={isStarting}
              className="w-full py-3.5 px-6 rounded-2xl text-sm font-bold text-white cursor-pointer shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)",
                boxShadow: "0 6px 20px rgba(255, 107, 53, 0.4)",
              }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              {isStarting ? (
                <>
                  <Sparkles className="w-4.5 h-4.5 animate-spin" />
                  <span>Launching Session...</span>
                </>
              ) : (
                <>
                  <Play className="w-4.5 h-4.5 fill-current" />
                  <span>Start Real Interview</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default StartInterviewModal;
