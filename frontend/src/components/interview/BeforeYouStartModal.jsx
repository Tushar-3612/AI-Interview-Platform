import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Key, Sparkles, ArrowRight } from "lucide-react";

/**
 * BeforeYouStartModal — Simplified, concise consent & guidelines modal for AI Real Interview.
 * 
 * Props:
 * - isOpen: boolean (whether modal is visible)
 * - onClose: () => void (cancel/close handler)
 * - onAgreeAndStart: () => Promise<void> | void (callback to start interview)
 * - isStarting: boolean (loading state during session initialization)
 */
export default function BeforeYouStartModal({
  isOpen,
  onClose,
  onAgreeAndStart,
  isStarting = false,
}) {
  const [agreed, setAgreed] = useState(false);

  if (!isOpen) return null;

  const handleAgreeAndStart = () => {
    if (!agreed || isStarting) return;
    onAgreeAndStart?.();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={isStarting ? undefined : onClose}
          className="absolute inset-0"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg rounded-3xl bg-[#0B0F19] border border-white/15 text-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          style={{
            boxShadow: "0 20px 60px rgba(0,0,0,0.85), 0 0 30px rgba(255,107,53,0.15)",
          }}
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-3 shrink-0 bg-white/[0.01]">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "radial-gradient(circle, rgba(255,107,53,0.25) 0%, rgba(255,107,53,0.05) 100%)",
                  border: "1px solid rgba(255,107,53,0.35)",
                }}
              >
                <AlertTriangle className="w-4.5 h-4.5 text-[#FF6B35]" />
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                ⚠️ Before You Start
              </h2>
            </div>

            <button
              onClick={isStarting ? undefined : onClose}
              disabled={isStarting}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer shrink-0"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto custom-scrollbar flex-1 text-left text-xs leading-relaxed text-gray-300">
            {/* 1. Intro & Clarification */}
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1.5">
              <p className="text-gray-200 font-medium">
                This AI Real Interview is created for placement-practice purposes. A lot of effort has gone into building this platform, so please give your interview honestly and without cheating.
              </p>
              <p className="text-gray-400 text-[11px]">
                Questions may be generated based on your resume, projects, and skills, but no specific question is guaranteed to appear in an actual company interview.
              </p>
            </div>

            {/* 2. One Attempt Warning (Highlighted) */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-extrabold text-[11px] uppercase tracking-wider">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>⚠️ ONE ATTEMPT ONLY</span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-amber-100/80">
                Please start only when you are ready. You get one attempt, so answer honestly and treat it like a real interview.
              </p>
            </div>

            {/* 3. AI API Information */}
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
              <div className="flex items-center gap-1.5 text-white font-bold text-xs">
                <Key className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>🔑 AI API Information</span>
              </div>
              <p className="text-gray-300 text-[11.5px]">
                AI APIs are used for interview question generation and result evaluation. Depending on the configuration, you may need to provide your own API key (BYOK).
              </p>
              <div className="flex items-center gap-2 text-[11px] font-semibold text-cyan-300/90 bg-cyan-500/10 px-2.5 py-1.5 rounded-xl border border-cyan-500/20">
                <span>Google Gemini • Groq • OpenRouter</span>
              </div>
              <p className="text-[11px] text-gray-400">
                Your API key should never be shared with anyone.
              </p>
            </div>
          </div>

          {/* Footer & Confirmation */}
          <div className="p-4 sm:p-5 border-t border-white/10 bg-[#070A11] shrink-0 space-y-3.5">
            <div className="space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block px-0.5">
                Please confirm before continuing:
              </span>

              {/* Checkbox */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  disabled={isStarting}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5 text-[#FF6B35] focus:ring-[#FF6B35] focus:ring-offset-0 cursor-pointer accent-[#FF6B35] shrink-0"
                />
                <span className="text-[11.5px] text-gray-300 leading-snug">
                  I have read and understood the above information and agree to take this interview honestly without external assistance.
                </span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isStarting}
                className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>

              <motion.button
                type="button"
                onClick={handleAgreeAndStart}
                disabled={!agreed || isStarting}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: agreed && !isStarting
                    ? "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)"
                    : "rgba(255, 255, 255, 0.08)",
                  boxShadow: agreed && !isStarting ? "0 4px 16px rgba(255, 107, 53, 0.35)" : "none",
                }}
                whileHover={agreed && !isStarting ? { scale: 1.01 } : {}}
                whileTap={agreed && !isStarting ? { scale: 0.99 } : {}}
              >
                {isStarting ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Launching Session...</span>
                  </>
                ) : (
                  <>
                    <span>I Agree & Start Interview</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
