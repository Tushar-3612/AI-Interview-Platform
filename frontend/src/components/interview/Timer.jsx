import React from "react";
import { Clock } from "lucide-react";

function Timer({ seconds, totalSeconds }) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  
  const isLow = seconds < 300; // Less than 5 mins
  
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Clock className={`w-5 h-5 ${isLow ? 'text-red-500 animate-pulse' : 'text-slate-500'}`} />
        <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Session Time</span>
      </div>
      <div className={`text-2xl font-mono font-bold ${isLow ? 'text-red-500' : 'text-slate-800 dark:text-slate-200'}`}>
        {m}:{s}
      </div>
    </div>
  );
}

export default Timer;
