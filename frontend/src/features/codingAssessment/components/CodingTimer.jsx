import React from "react";
import { Timer, AlertTriangle } from "lucide-react";

export default function CodingTimer({ formattedTime, isLowTime, isCritical }) {
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs sm:text-sm font-bold border transition-all ${
        isCritical
          ? "bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse"
          : isLowTime
          ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
          : "bg-[var(--bg-secondary)] text-[var(--text-primary)] border-[var(--border)]"
      }`}
    >
      {isCritical ? (
        <AlertTriangle className="w-4 h-4 text-rose-400" />
      ) : (
        <Timer className={`w-4 h-4 ${isLowTime ? "text-amber-400" : "text-cyan-400"}`} />
      )}
      <span>{formattedTime}</span>
    </div>
  );
}
