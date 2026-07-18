import { motion } from "framer-motion";
import { ListChecks, Timer as TimerIcon, CornerDownRight, CheckCircle2 } from "lucide-react";

/**
 * ProgressTracker Component
 * Visual progress bars and answer count status panels.
 */
function ProgressTracker({
  currentIndex = 3,
  totalQuestions = 10,
  answeredCount = 2,
  skippedCount = 0,
  remainingTimeText = "18:42"
}) {
  const totalBlocks = 12;
  const activeBlocksCount = Math.min(Math.round(((currentIndex - 1) / totalQuestions) * totalBlocks), totalBlocks);

  return (
    <div 
      className="glass-card rounded-[16px] p-3 flex flex-col justify-between w-full"
      style={{ height: "var(--progress-height)" }}
    >
      <div className="flex items-center justify-between border-b pb-1 shrink-0" style={{ borderColor: "var(--border)" }}>
        <h3 className="font-bold text-[10px] tracking-wider uppercase text-muted">
          Interview Progress
        </h3>
        <span 
          className="text-[10px] font-bold text-slate-700 dark:text-zinc-300 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-zinc-800"
        >
          {currentIndex} / {totalQuestions}
        </span>
      </div>

      {/* Block Progress Bar */}
      <div className="flex items-center justify-center gap-1.5 py-1.5 shrink-0 select-none">
        {Array.from({ length: totalBlocks }).map((_, idx) => {
          const isActive = idx < activeBlocksCount;
          return (
            <div 
              key={idx} 
              className={`w-3.5 h-3.5 rounded-[2px] transition-all duration-300 ${
                isActive 
                  ? "bg-blue-600 dark:bg-blue-500 shadow-sm shadow-blue-500/20" 
                  : "bg-slate-200 dark:bg-zinc-800"
              }`}
            />
          );
        })}
      </div>

      {/* Numerical logs grid */}
      <div className="grid grid-cols-2 gap-2 pt-1 shrink-0">
        {/* Answered tracker */}
        <div className="py-1.5 px-2 rounded-xl border flex items-center justify-between bg-slate-50/50 dark:bg-zinc-800/10" style={{ borderColor: "var(--border)" }}>
          <span className="text-[10px] text-slate-400 font-medium leading-none">Answered</span>
          <span className="text-xs font-black text-emerald-500">{answeredCount}</span>
        </div>

        {/* Skipped tracker */}
        <div className="py-1.5 px-2 rounded-xl border flex items-center justify-between bg-slate-50/50 dark:bg-zinc-800/10" style={{ borderColor: "var(--border)" }}>
          <span className="text-[10px] text-slate-400 font-medium leading-none">Skipped</span>
          <span className="text-xs font-black text-amber-500">{skippedCount}</span>
        </div>
      </div>
    </div>
  );
}

export default ProgressTracker;
