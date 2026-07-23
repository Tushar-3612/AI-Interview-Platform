import React from "react";
import { Clock } from "lucide-react";

function ProgressTracker({ currentIndex, totalQuestions, answeredCount, skippedCount, remainingTimeText }) {
  const progressPercent = (currentIndex / totalQuestions) * 100;
  
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Overall Progress
          </h3>
          <span className="text-sm font-bold text-primary">{Math.round(progressPercent)}%</span>
        </div>
        
        <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className="text-center">
          <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{answeredCount}</p>
          <p className="text-xs text-slate-500">Answered</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-amber-500">{skippedCount}</p>
          <p className="text-xs text-slate-500">Skipped</p>
        </div>
        <div className="text-center border-l border-slate-200 dark:border-zinc-800">
          <div className="flex items-center justify-center gap-1 text-primary">
            <Clock className="w-4 h-4" />
            <p className="text-lg font-bold">{remainingTimeText}</p>
          </div>
          <p className="text-xs text-slate-500 mt-1">Remaining</p>
        </div>
      </div>
    </div>
  );
}

export default ProgressTracker;
