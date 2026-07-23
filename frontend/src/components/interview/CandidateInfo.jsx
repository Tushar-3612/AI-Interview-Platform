import React from "react";
import { FileText, Award, BarChart } from "lucide-react";

function CandidateInfo({ name, resumeName, interviewType, difficulty }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 h-full flex flex-col justify-center">
      <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
        Session Info
      </h3>
      
      <div className="space-y-4">
        <div>
          <p className="text-xs text-slate-500 mb-1">Candidate</p>
          <p className="font-semibold">{name}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-primary" />
          <div>
            <p className="text-xs text-slate-500">Context</p>
            <p className="text-sm font-medium truncate max-w-[150px]">{resumeName || "General Interview"}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium">{interviewType}</span>
          </div>
          <div className="flex items-center gap-2">
            <BarChart className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium">{difficulty}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CandidateInfo;
