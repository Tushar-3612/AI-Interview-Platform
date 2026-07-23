import React from "react";
import { ListChecks } from "lucide-react";

function LiveNotes({ notes = [] }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 h-full flex flex-col">
      <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <ListChecks className="w-4 h-4" />
        AI Evaluator Notes
      </h3>
      
      <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-2">
        {notes.length > 0 ? (
          notes.map((note, idx) => (
            <div key={idx} className="flex gap-2 text-xs">
              <span className="text-primary mt-0.5">•</span>
              <span className="text-slate-600 dark:text-slate-400">{note}</span>
            </div>
          ))
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-slate-400 italic text-center">
            AI is analyzing your performance in real-time...
          </div>
        )}
      </div>
    </div>
  );
}

export default LiveNotes;
