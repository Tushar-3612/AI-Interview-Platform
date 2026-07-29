import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Brain, Mic } from "lucide-react";
import AudioVisualizer from "./AudioVisualizer";

/**
 * AIInterviewerCard — Cinematic AI Avatar stage.
 *
 * Props:
 *   aiStatus           {string}  — "Speaking" | "Thinking" | "Listening"
 *   isGeneratingQuestion {boolean}
 *   currentQuestionText  {string}
 */
function AIInterviewerCard({ aiStatus = "Listening", isGeneratingQuestion = false, currentQuestionText = "" }) {
  const isSpeaking  = aiStatus === "Speaking";
  const isThinking  = aiStatus === "Thinking" || isGeneratingQuestion;
  const isListening = aiStatus === "Listening";

  /* Halo ring animation class based on AI state */
  const haloClass = isSpeaking ? "halo-speak" : isThinking ? "halo-think" : "halo-idle";

  /* Status dot color */
  const dotColor  = isSpeaking
    ? "#10b981"   // green
    : isThinking
    ? "#f59e0b"   // amber
    : "#60a5fa";  // blue

  const statusLabel = isGeneratingQuestion ? "Thinking..." : aiStatus;

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden flex flex-col" style={{ background: "linear-gradient(145deg, #07080f 0%, #0e1120 60%, #060b18 100%)" }}>

      {/* Grid noise overlay */}
      <div className="absolute inset-0 interview-grid-bg pointer-events-none" />

      {/* Ambient glow blobs */}
      <div
        className="absolute w-72 h-72 rounded-full pointer-events-none"
        style={{
          background: isSpeaking
            ? "radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 70%)"
            : isThinking
            ? "radial-gradient(circle, rgba(245,158,11,0.1) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(37,99,235,0.1) 0%, transparent 70%)",
          top: "15%", left: "50%", transform: "translateX(-50%)",
          transition: "background 1s ease",
        }}
      />

      {/* Status Badge — top left */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 room-card px-3 py-1.5 rounded-full">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: dotColor, animation: "statusDot 1.2s ease-in-out infinite" }}
        />
        <span className="text-[11px] font-semibold text-white/80 uppercase tracking-widest">
          {statusLabel}
        </span>
      </div>

      {/* REC badge — top right */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 room-card px-2.5 py-1 rounded-full">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">REC</span>
      </div>

      {/* ─────── Avatar Zone ─────── */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6">
        <AnimatePresence mode="wait">
          {isThinking ? (
            <motion.div
              key="thinking"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center gap-5"
            >
              {/* Spinner avatar */}
              <div className="relative">
                <div
                  className="w-28 h-28 rounded-full flex items-center justify-center"
                  style={{
                    background: "radial-gradient(circle at 35% 35%, #1e2a4a, #0a0e1a)",
                    border: "2px solid rgba(245,158,11,0.3)",
                    boxShadow: "0 0 40px rgba(245,158,11,0.15)",
                  }}
                >
                  <Brain className="w-12 h-12 text-amber-400 animate-pulse" />
                </div>
                {/* Orbit ring */}
                <div
                  className="absolute inset-0 rounded-full border-2 border-dashed border-amber-500/20 animate-spin"
                  style={{ animationDuration: "3s" }}
                />
              </div>
              <p className="text-sm font-medium text-amber-300/80">Formulating next question…</p>
              {/* Typing dots */}
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full bg-amber-400/60 animate-bounce"
                    style={{ animationDelay: `${i * 0.18}s` }}
                  />
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="avatar"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center gap-5"
            >
              {/* Avatar circle with halo */}
              <div className="relative">
                {/* Outer glow halo */}
                <div
                  className={`absolute inset-0 rounded-full ${haloClass}`}
                  style={{ borderRadius: "50%" }}
                />
                {/* Avatar ring */}
                <div
                  className="w-32 h-32 rounded-full flex items-center justify-center relative overflow-hidden"
                  style={{
                    background: "radial-gradient(circle at 38% 35%, #1a2456 0%, #0a0f22 100%)",
                    border: `2px solid ${isSpeaking ? "rgba(20,184,166,0.5)" : "rgba(37,99,235,0.4)"}`,
                  }}
                >
                  {/* AI Face SVG */}
                  <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-label="AI Interviewer Avatar">
                    {/* Head */}
                    <ellipse cx="36" cy="30" rx="20" ry="22" fill="#1e3a5f" />
                    {/* Eyes */}
                    <ellipse cx="28" cy="26" rx="4" ry="4.5"
                      fill={isSpeaking ? "#14b8a6" : "#2563eb"}
                      style={{ transition: "fill 0.5s ease" }} />
                    <ellipse cx="44" cy="26" rx="4" ry="4.5"
                      fill={isSpeaking ? "#14b8a6" : "#2563eb"}
                      style={{ transition: "fill 0.5s ease" }} />
                    {/* Eye shine */}
                    <circle cx="29.5" cy="24.5" r="1.5" fill="white" opacity="0.8" />
                    <circle cx="45.5" cy="24.5" r="1.5" fill="white" opacity="0.8" />
                    {/* Mouth: changes shape when speaking */}
                    {isSpeaking ? (
                      <ellipse cx="36" cy="38" rx="7" ry="4" fill="#14b8a6" opacity="0.8" />
                    ) : (
                      <path d="M29 37 Q36 42 43 37" stroke="#4a90d9" strokeWidth="2" strokeLinecap="round" fill="none" />
                    )}
                    {/* Collar/body */}
                    <path d="M16 60 Q24 50 36 52 Q48 50 56 60" fill="#0f1f38" />
                    {/* Circuit lines on forehead */}
                    <line x1="22" y1="18" x2="26" y2="18" stroke="#2563eb" strokeWidth="0.8" opacity="0.6" />
                    <line x1="46" y1="18" x2="50" y2="18" stroke="#2563eb" strokeWidth="0.8" opacity="0.6" />
                    <circle cx="22" cy="18" r="1" fill="#2563eb" opacity="0.7" />
                    <circle cx="50" cy="18" r="1" fill="#2563eb" opacity="0.7" />
                  </svg>

                  {/* Scan line overlay when speaking */}
                  {isSpeaking && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: "linear-gradient(0deg, transparent 40%, rgba(20,184,166,0.08) 50%, transparent 60%)",
                        animation: "scanLine 3s linear infinite",
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Name tag */}
              <div className="text-center">
                <p className="text-sm font-bold text-white">Alex — AI Interviewer</p>
                <p className="text-[11px] text-white/40 mt-0.5">Senior Technical Evaluator</p>
              </div>

              {/* Audio visualizer — only visible when speaking */}
              <div className="flex items-center gap-3">
                <Mic className="w-3.5 h-3.5 text-white/30" />
                <AudioVisualizer
                  isActive={isSpeaking}
                  barCount={16}
                  color="rgba(96,165,250,0.25)"
                  activeColor="#14b8a6"
                  height="24px"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─────── Bottom: Question Subtitle Overlay ─────── */}
      <AnimatePresence>
        {currentQuestionText && !isThinking && (
          <motion.div
            key="question-subtitle"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative z-20 mx-4 mb-4 p-3 rounded-xl"
            style={{
              background: "rgba(0,0,0,0.65)",
              border: "1px solid rgba(255,255,255,0.07)",
              backdropFilter: "blur(8px)",
            }}
          >
            <p className="text-xs text-white/75 leading-relaxed line-clamp-3 text-center">
              {currentQuestionText}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom waveform bar when AI speaks */}
      <div className="relative z-20 px-6 pb-5 flex items-center justify-center gap-2">
        <AudioVisualizer
          isActive={isSpeaking}
          barCount={24}
          color="rgba(37,99,235,0.15)"
          activeColor="rgba(20,184,166,0.7)"
          height="20px"
          className="w-full"
        />
      </div>
    </div>
  );
}

export default AIInterviewerCard;
