import React from "react";
import { Target, BrainCircuit, Code2, UserCheck, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";

/**
 * SectionNavigationPanel — Persistent section navigation side panel.
 * Displays interview sections, completed/total counts, real section states,
 * and allows candidate to switch between sections.
 */
function SectionNavigationPanel({
  activeSection = "APTITUDE",
  onSelectSection,
  sectionProgress = {}
}) {
  const SECTIONS = [
    {
      id: "APTITUDE",
      name: "Aptitude",
      icon: Target,
      color: "amber",
      total: 25,
      description: "Quantitative & Logical MCQs",
      accentBg: "rgba(245, 158, 11, 0.15)",
      accentBorder: "rgba(245, 158, 11, 0.4)",
      badgeColor: "#f59e0b",
    },
    {
      id: "TECHNICAL",
      name: "Technical",
      icon: BrainCircuit,
      color: "blue",
      total: 25,
      description: "Resume & Project Engineering",
      accentBg: "rgba(37, 99, 235, 0.15)",
      accentBorder: "rgba(37, 99, 235, 0.4)",
      badgeColor: "#3b82f6",
    },
    {
      id: "CODING",
      name: "Coding",
      icon: Code2,
      color: "emerald",
      total: 3,
      description: "Algorithmic Code IDE",
      accentBg: "rgba(16, 185, 129, 0.15)",
      accentBorder: "rgba(16, 185, 129, 0.4)",
      badgeColor: "#10b981",
    },
    {
      id: "HR",
      name: "HR",
      icon: UserCheck,
      color: "purple",
      total: 5,
      description: "Behavioral & Career Alignment",
      accentBg: "rgba(168, 85, 247, 0.15)",
      accentBorder: "rgba(168, 85, 247, 0.4)",
      badgeColor: "#a855f7",
    },
  ];

  const totalCompleted = sectionProgress.totalCompleted || 0;
  const totalQuestions = SECTIONS.reduce(
    (sum, sec) => sum + (sectionProgress[sec.id]?.total || sec.total),
    0
  );

  return (
    <div
      className="w-full h-full flex flex-col justify-between p-4 rounded-2xl select-none"
      style={{
        background: "linear-gradient(180deg, rgba(12, 15, 26, 0.95) 0%, rgba(8, 10, 18, 0.98) 100%)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Panel Header */}
      <div className="shrink-0 mb-4 pb-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-white/90">
            Interview Sections
          </h3>
        </div>
        <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
          {SECTIONS.length} Rounds
        </span>
      </div>

      {/* Section List */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1">
        {SECTIONS.map((sec) => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          const prog = sectionProgress[sec.id] || { completed: 0, total: sec.total, status: "AVAILABLE" };
          const isFinished = prog.completed >= sec.total;
          const formattedCompleted = String(prog.completed).padStart(2, "0");
          const formattedTotal = String(sec.total).padStart(2, "0");

          let statusBadgeText = "AVAILABLE";
          let statusBadgeClass = "bg-white/5 text-white/40 border-white/10";

          if (isFinished) {
            statusBadgeText = "COMPLETED";
            statusBadgeClass = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
          } else if (isActive) {
            statusBadgeText = "IN PROGRESS";
            statusBadgeClass = "bg-blue-500/20 text-blue-400 border-blue-500/30";
          }

          return (
            <button
              key={sec.id}
              onClick={() => onSelectSection && onSelectSection(sec.id)}
              className={`w-full p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer relative overflow-hidden group flex flex-col gap-2 ${
                isActive
                  ? "shadow-lg"
                  : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/15"
              }`}
              style={{
                background: isActive ? sec.accentBg : undefined,
                borderColor: isActive ? sec.accentBorder : undefined,
              }}
            >
              {/* Top Row: Icon + Name + Status Badge */}
              <div className="flex items-center justify-between">
               <div className="flex items-center gap-2.5">
                   <Icon className="w-4 h-4 text-white/80" />
                   <span className="text-xs font-bold text-white group-hover:text-white">
                     {sec.name}
                   </span>
                 </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${statusBadgeClass}`}>
                  {statusBadgeText}
                </span>
              </div>

              {/* Bottom Row: Count Progress */}
              <div className="flex items-center justify-between text-[11px] font-semibold text-white/50 pt-1 border-t border-white/5">
                <span>{sec.description}</span>
                <span className="font-mono text-white/80 font-bold">
                  {formattedCompleted} / {formattedTotal}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Panel Footer: Total Progress */}
      <div className="shrink-0 pt-3 mt-3 border-t border-white/10 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold text-white/40">Total Progress</p>
          <p className="text-xs font-bold text-white font-mono mt-0.5">
            {String(totalCompleted).padStart(2, "0")} / {String(totalQuestions).padStart(2, "0")} Questions
          </p>
        </div>
        <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center bg-white/5 font-mono text-xs font-bold text-amber-400">
          {Math.round((totalCompleted / totalQuestions) * 100)}%
        </div>
      </div>
    </div>
  );
}

export default SectionNavigationPanel;
