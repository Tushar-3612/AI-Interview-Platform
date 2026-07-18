import { Clock } from "lucide-react";

/**
 * Timer Component
 * Displays a digital interview countdown that alerts the user visually by color shifting.
 */
function Timer({ seconds = 1122, totalSeconds = 1800 }) {
  // Format seconds to MM:SS
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Determine color coding based on threshold percentages
  const ratio = seconds / totalSeconds;
  
  let colorClass = "text-emerald-500 border-emerald-500/20 bg-emerald-500/5";
  let pulseClass = "bg-emerald-500";
  let label = "Status: Healthy";

  if (ratio <= 0.15) {
    colorClass = "text-red-500 border-red-500/20 bg-red-500/5 animate-pulse";
    pulseClass = "bg-red-500";
    label = "Time Critical!";
  } else if (ratio <= 0.35) {
    colorClass = "text-amber-500 border-amber-500/20 bg-amber-500/5";
    pulseClass = "bg-amber-500";
    label = "Time Warning";
  }

  return (
    <div 
      className={`glass-card rounded-[16px] px-4 flex items-center justify-between transition-all duration-500 w-full ${colorClass}`}
      style={{ height: "var(--timer-height)" }}
    >
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${pulseClass}`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${pulseClass}`}></span>
        </span>
        <div className="flex flex-col text-left">
          <span className="text-[10px] font-black tracking-widest text-slate-850 dark:text-white uppercase leading-none">
            LIVE
          </span>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 mt-1 leading-none">
            {label.includes("Healthy") || label.includes("Status:") ? "Healthy Session" : label}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        {formatTime(seconds)}
      </div>
    </div>
  );
}

export default Timer;
