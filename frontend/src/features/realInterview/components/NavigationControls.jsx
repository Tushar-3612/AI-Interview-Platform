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
  answeredCount = 0,
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
      className="rounded-2xl p-3 flex flex-col gap-2.5"
      style={{
        background: "rgba(12, 15, 26, 0.95)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      {/* ── Listen Again ── */}
      <button
        onClick={handleReplay}
        disabled={isPaused || !isSpeakerOn}
        title={!isSpeakerOn ? "Chatbot is muted" : "Replay the question aloud"}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        style={{
          background: replaying
            ? "rgba(255, 107, 53, 0.2)"
            : "rgba(255, 107, 53, 0.06)",
          border: `1px solid ${replaying ? "rgba(255, 107, 53, 0.5)" : "rgba(255, 107, 53, 0.25)"}`,
          color: "#FF6B35",
        }}
      >
        {replaying ? (
          <>
            {/* Animated speaker bars */}
            <span className="flex items-end gap-[2px] h-3.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-sm bg-[#FF6B35]"
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
            <Volume2 className="w-4 h-4 text-[#FF6B35]" />
            <span>Listen Again</span>
          </>
        )}
      </button>

      {/* ── Progress label (completed / total, single source of truth) ── */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
          Progress
        </span>
        <span className="text-xs font-bold font-mono text-white/80">
          {String(answeredCount).padStart(2, "0")} <span className="text-white/30">/ {String(totalQuestions).padStart(2, "0")}</span>
        </span>
      </div>

      {/* ── Prev / Skip / Next ── */}
      <div className="grid grid-cols-3 gap-2">
        {/* Previous */}
        <button
          onClick={onPrev}
          disabled={currentIndex <= 1 || isPaused}
          className="flex items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed hover:text-white"
          style={{
            background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.6)",
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
          className="flex items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed hover:bg-white/[0.08]"
          style={{
            background: "rgba(255,255,255,0.04)",
            color: "#FF6B35",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <SkipForward className="w-3.5 h-3.5" />
          Skip
        </button>

        {/* Next / Submit */}
        <button
          onClick={onNext}
          disabled={isPaused}
          className="flex items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed shadow-lg"
          style={{
            background: isLast
              ? "linear-gradient(135deg, #10b981, #059669)"
              : "linear-gradient(135deg, #FF6B35, #FF8A3D)",
            color: "#ffffff",
            boxShadow: isLast
              ? "0 0 12px rgba(16,185,129,0.3)"
              : "0 0 12px rgba(255,107,53,0.3)",
          }}
        >
          <span>{isLast ? "Submit" : "Next"}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default NavigationControls;
