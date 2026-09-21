import React from "react";
import { Brain, Mic } from "lucide-react";
import AudioVisualizer from "./AudioVisualizer";

/**
 * AIInterviewerCard — Compact, high-performance AI Interviewer banner.
 * Focuses on interviewer identity, speaking/listening state, live waveform, and REC status.
 * Note: Question text is NOT rendered here to avoid duplicate content on the screen.
 */
function AIInterviewerCard({
  aiStatus = "Listening",
  isGeneratingQuestion = false,
  section = "TECHNICAL",
  interviewerName,
  interviewerRole,
}) {
  const normalizedStatus = String(aiStatus).toUpperCase();
  const isSpeaking = normalizedStatus === "SPEAKING";
  const isThinking = normalizedStatus === "THINKING" || isGeneratingQuestion;
  const isListening = normalizedStatus === "LISTENING";

  const isHR = section === "HR";
  const resolvedName = interviewerName || (isHR ? "Sarah — AI HR Interviewer" : "Alex — AI Interviewer");
  const resolvedRole = interviewerRole || (isHR ? "Senior HR Evaluator" : "Senior Technical Evaluator");

  /* Dot Color */
  const dotColor = isSpeaking
    ? "#10b981"
    : isThinking
    ? "#f59e0b"
    : isListening
    ? "#FF6B35"
    : "#9ca3af";

  const statusLabel = isGeneratingQuestion
    ? "ANALYZING..."
    : isSpeaking
    ? "SPEAKING"
    : isThinking
    ? "THINKING"
    : isListening
    ? "LISTENING"
    : "READY";

  return (
    <div
      className="relative w-full h-full rounded-2xl overflow-hidden flex items-center justify-between px-4 sm:px-6 py-2 select-none border border-white/10"
      style={{
        background: "linear-gradient(135deg, rgba(12, 15, 26, 0.95) 0%, rgba(8, 10, 18, 0.98) 100%)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Background ambient pulse */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          background: isSpeaking
            ? "radial-gradient(circle at 20% 50%, rgba(16,185,129,0.3) 0%, transparent 60%)"
            : isThinking
            ? "radial-gradient(circle at 20% 50%, rgba(245,158,11,0.25) 0%, transparent 60%)"
            : "radial-gradient(circle at 20% 50%, rgba(255,107,53,0.25) 0%, transparent 60%)",
          transition: "background 0.5s ease",
        }}
      />

      {/* Left: Avatar + Persona details */}
      <div className="flex items-center gap-3 relative z-10 min-w-0">
        <div className="relative shrink-0">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center relative overflow-hidden"
            style={{
              background: "radial-gradient(circle at 35% 35%, #1a2456 0%, #0a0f22 100%)",
              border: `2px solid ${isSpeaking ? "#10b981" : isThinking ? "#f59e0b" : "#FF6B35"}`,
              boxShadow: isSpeaking
                ? "0 0 12px rgba(16,185,129,0.4)"
                : isThinking
                ? "0 0 12px rgba(245,158,11,0.35)"
                : "0 0 12px rgba(255,107,53,0.35)",
            }}
          >
            {isThinking ? (
              <Brain className="w-5 h-5 text-amber-400 animate-pulse" />
            ) : (
              <svg width="28" height="28" viewBox="0 0 72 72" fill="none" aria-label="AI Interviewer Avatar">
                <ellipse cx="36" cy="30" rx="20" ry="22" fill="#1e3a5f" />
                <ellipse cx="28" cy="26" rx="4" ry="4.5" fill={isSpeaking ? "#10b981" : "#FF6B35"} />
                <ellipse cx="44" cy="26" rx="4" ry="4.5" fill={isSpeaking ? "#10b981" : "#FF6B35"} />
                <circle cx="29.5" cy="24.5" r="1.5" fill="white" opacity="0.8" />
                <circle cx="45.5" cy="24.5" r="1.5" fill="white" opacity="0.8" />
                {isSpeaking ? (
                  <ellipse cx="36" cy="38" rx="7" ry="4" fill="#10b981" opacity="0.8" />
                ) : (
                  <path d="M29 37 Q36 42 43 37" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" fill="none" />
                )}
                <path d="M16 60 Q24 50 36 52 Q48 50 56 60" fill="#0f1f38" />
              </svg>
            )}
          </div>
          {isSpeaking && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
          )}
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-bold text-white truncate">{resolvedName}</span>
          </div>
          <span className="text-[10px] text-white/40 truncate">{resolvedRole}</span>
        </div>
      </div>

      {/* Center: Live Audio Waveform */}
      <div className="hidden md:flex items-center gap-2 flex-1 max-w-xs mx-4 justify-center relative z-10">
        <AudioVisualizer
          isActive={isSpeaking || isListening}
          barCount={18}
          color="rgba(255,255,255,0.15)"
          activeColor={isSpeaking ? "#10b981" : "#FF6B35"}
          height="16px"
          className="w-full"
        />
      </div>

      {/* Right: AI Status & REC badge */}
      <div className="flex items-center gap-2.5 relative z-10 shrink-0">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: dotColor, animation: "statusDot 1.2s ease-in-out infinite" }}
          />
          <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider">
            {statusLabel}
          </span>
        </div>

        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[9px] font-extrabold text-red-400 uppercase tracking-widest">REC</span>
        </div>
      </div>
    </div>
  );
}

export default AIInterviewerCard;
