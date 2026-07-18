import { 
  ArrowLeft, 
  ArrowRight, 
  CornerDownRight, 
  RotateCw, 
  Pause, 
  Play, 
  LogOut 
} from "lucide-react";

/**
 * NavigationControls Component
 * Provides action buttons for traversing questions, repeating queries, pausing, or completing the interview.
 */
function NavigationControls({
  currentIndex = 1,
  totalQuestions = 10,
  isPaused = false,
  isSpeechActive = false,
  onPrev,
  onNext,
  onSkip,
  onRepeat,
  onTogglePause,
  onEnd,
}) {
  return (
    <div 
      className="glass-card rounded-[16px] px-3 flex items-center justify-between w-full"
      style={{ height: "70px" }}
    >
      <div className="flex items-center justify-between w-full gap-2 lg:gap-3">
        {/* Previous Question */}
        <button
          type="button"
          onClick={onPrev}
          disabled={currentIndex <= 1 || isPaused}
          className="flex-1 flex items-center justify-center gap-1.5 h-[48px] rounded-xl border text-xs font-semibold hover:opacity-85 disabled:opacity-40 transition-all cursor-pointer truncate px-1"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-secondary)" }}
        >
          <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
          <span>Previous</span>
        </button>

        {/* Repeat Question */}
        <button
          type="button"
          onClick={onRepeat}
          disabled={isPaused}
          className="flex-1 flex items-center justify-center gap-1.5 h-[48px] rounded-xl border text-xs font-semibold hover:opacity-85 disabled:opacity-40 transition-all cursor-pointer truncate px-1"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-secondary)" }}
          title="Repeats the AI voice query"
        >
          <RotateCw className="w-3.5 h-3.5 shrink-0" />
          <span>Repeat</span>
        </button>

        {/* Skip Question */}
        <button
          type="button"
          onClick={onSkip}
          disabled={currentIndex >= totalQuestions || isPaused}
          className="flex-1 flex items-center justify-center gap-1.5 h-[48px] rounded-xl border text-xs font-semibold hover:opacity-85 disabled:opacity-40 transition-all cursor-pointer truncate px-1"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-secondary)" }}
        >
          <CornerDownRight className="w-3.5 h-3.5 shrink-0" />
          <span>Skip</span>
        </button>

        {/* Pause/Resume Interview */}
        <button
          type="button"
          onClick={onTogglePause}
          className={`flex-1 flex items-center justify-center gap-1.5 h-[48px] rounded-xl border text-xs font-semibold hover:opacity-85 transition-all cursor-pointer truncate px-1 ${
            isPaused
              ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
              : "bg-slate-50 border-slate-200 text-slate-700 dark:bg-zinc-800/40 dark:border-zinc-700 dark:text-zinc-300"
          }`}
        >
          {isPaused ? <Play className="w-3.5 h-3.5 shrink-0" /> : <Pause className="w-3.5 h-3.5 shrink-0" />}
          <span>{isPaused ? "Resume" : "Pause Interview"}</span>
        </button>

        {/* Emergency Exit */}
        <button
          type="button"
          onClick={onEnd}
          className="flex-1 flex items-center justify-center gap-1.5 h-[48px] rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-all cursor-pointer border border-transparent shadow-sm shadow-red-950/20 truncate px-1"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          <span>End Interview</span>
        </button>

        {/* Save & Next Question */}
        <button
          type="button"
          onClick={onNext}
          disabled={isPaused}
          className="flex-grow flex-[1.3] flex items-center justify-center gap-1.5 h-[48px] rounded-xl text-xs font-semibold text-white btn-gradient disabled:opacity-40 transition-all cursor-pointer truncate px-2"
        >
          <span>{currentIndex === totalQuestions ? "Submit Interview" : "Save & Next"}</span>
          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>
    </div>
  );
}

export default NavigationControls;
