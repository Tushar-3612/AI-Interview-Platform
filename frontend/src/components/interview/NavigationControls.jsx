import React, { useState } from "react";
import { ChevronLeft, ChevronRight, SkipForward, Volume2, Loader2 } from "lucide-react";

/**
 * NavigationControls — compact sidebar card with:
 *   - "Listen Again" replay button (top row)
 *   - Progress label
 *   - Prev / Skip / Next buttons
 */
function NavigationControls({
  currentIndex,
  totalQuestions,
  isPaused,
  onPrev,
  onNext,
  onSkip,
  onRepeat,
  isSpeakerOn = true,
}) {
  const isLast = currentIndex === totalQuestions;
  const [replaying, setReplaying] = useState(false);

  const handleReplay = () => {
    if (!onRepeat || replaying) return;
    setReplaying(true);
    onRepeat();
    // Reset visual state after ~6 s (enough for most question TTS to finish)
    setTimeout(() => setReplaying(false), 6000);
  };

  return (
    <div
      className="rounded-2xl p-3 flex flex-col gap-2"
      style={{
        background: "rgba(8,10,18,0.9)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* ── Listen Again ── */}
      <button
        onClick={handleReplay}
        disabled={isPaused || !isSpeakerOn}
        title={!isSpeakerOn ? "Chatbot is muted" : "Replay the question aloud"}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        style={{
          background: replaying
            ? "rgba(20,184,166,0.15)"
            : "rgba(37,99,235,0.12)",
          border: `1px solid ${replaying ? "rgba(20,184,166,0.35)" : "rgba(37,99,235,0.25)"}`,
          color: replaying ? "#2dd4bf" : "#60a5fa",
        }}
      >
        {replaying ? (
          <>
            {/* Animated speaker bars */}
            <span className="flex items-end gap-[2px] h-3.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-sm bg-teal-400"
                  style={{
                    height: "60%",
                    animation: `waveBar 0.7s ease-in-out infinite`,
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </span>
            Playing question…
          </>
        ) : (
          <>
            <Volume2 className="w-3.5 h-3.5" />
            Listen Again
          </>
        )}
      </button>

      {/* ── Progress label ── */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[11px] font-semibold text-white/35 uppercase tracking-widest">
          Progress
        </span>
        <span className="text-[11px] font-bold text-white/60">
          {currentIndex} <span className="text-white/25">/ {totalQuestions}</span>
        </span>
      </div>

      {/* ── Prev / Skip / Next ── */}
      <div className="grid grid-cols-3 gap-1.5">
        {/* Previous */}
        <button
          onClick={onPrev}
          disabled={currentIndex <= 1 || isPaused}
          className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-bold transition-all disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          style={{
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.55)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Prev
        </button>

        {/* Skip */}
        <button
          onClick={onSkip}
          disabled={isPaused}
          className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-bold transition-all disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          style={{
            background: "rgba(245,158,11,0.1)",
            color: "rgba(251,191,36,0.8)",
            border: "1px solid rgba(245,158,11,0.2)",
          }}
        >
          <SkipForward className="w-3.5 h-3.5" />
          Skip
        </button>

        {/* Next / Submit */}
        <button
          onClick={onNext}
          disabled={isPaused}
          className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-bold transition-all disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          style={{
            background: isLast
              ? "linear-gradient(135deg, #10b981, #059669)"
              : "linear-gradient(135deg, #2563eb, #1d4ed8)",
            color: "#ffffff",
            boxShadow: isLast
              ? "0 0 12px rgba(16,185,129,0.3)"
              : "0 0 12px rgba(37,99,235,0.3)",
          }}
        >
          {isLast ? "Submit" : "Next"}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default NavigationControls;
