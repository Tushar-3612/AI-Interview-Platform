import { User, FileText, Briefcase, Award } from "lucide-react";

/**
 * CandidateInfo Component
 * Displays candidate details, resume references, and current session settings.
 */
function CandidateInfo({
  name = "Roshan Langhi",
  resumeName = "Roshan_Langhi_CV.pdf",
  interviewType = "Full Stack Engineer Mock Interview",
  difficulty = "Medium",
}) {
  return (
    <div 
      className="glass-card rounded-[16px] p-3 flex flex-col justify-between w-full"
      style={{ height: "var(--session-info-height)" }}
    >
      <div className="flex items-center justify-between border-b pb-1 shrink-0" style={{ borderColor: "var(--border)" }}>
        <h3 className="font-bold text-[10px] tracking-wider uppercase text-muted">
          Session Info
        </h3>
        <span className="text-[8px] bg-sky-100 dark:bg-sky-950/40 text-sky-600 px-1.5 py-0.5 rounded font-black uppercase tracking-wider shrink-0">
          Active
        </span>
      </div>

      <div className="flex-1 flex flex-col justify-between pt-1.5 min-h-0">
        {/* Candidate Row */}
        <div className="flex items-center justify-between text-xs min-w-0 py-0.5">
          <span className="text-slate-400 dark:text-zinc-500 font-medium text-[11px] shrink-0">Candidate</span>
          <span className="font-semibold truncate text-slate-800 dark:text-zinc-200 text-right ml-2 max-w-[70%]">{name}</span>
        </div>

        {/* Resume Row */}
        <div className="flex items-center justify-between text-xs min-w-0 py-0.5">
          <span className="text-slate-400 dark:text-zinc-500 font-medium text-[11px] shrink-0">Resume</span>
          <span className="font-semibold truncate text-slate-800 dark:text-zinc-200 text-right ml-2 max-w-[70%]" title={resumeName}>{resumeName || "None"}</span>
        </div>

        {/* Role Row */}
        <div className="flex items-center justify-between text-xs min-w-0 py-0.5">
          <span className="text-slate-400 dark:text-zinc-500 font-medium text-[11px] shrink-0">Role</span>
          <span className="font-semibold truncate text-slate-800 dark:text-zinc-200 text-right ml-2 max-w-[70%]" title={interviewType}>{interviewType}</span>
        </div>

        {/* Difficulty Row */}
        <div className="flex items-center justify-between text-xs min-w-0 py-0.5">
          <span className="text-slate-400 dark:text-zinc-500 font-medium text-[11px] shrink-0">Difficulty</span>
          <span className="font-semibold truncate text-slate-850 dark:text-zinc-200 text-right ml-2 max-w-[70%]">{difficulty}</span>
        </div>
      </div>
    </div>
  );
}

export default CandidateInfo;
