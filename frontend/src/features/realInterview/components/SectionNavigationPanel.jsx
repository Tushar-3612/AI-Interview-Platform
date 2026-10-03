import React, { useState, useEffect } from "react";
import {
  Target,
  BrainCircuit,
  Code2,
  UserCheck,
  FileText,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";

/**
 * SectionNavigationPanel — Collapsible persistent section navigation side panel.
 * Collapses horizontally between Expanded (250px) and Collapsed (68px) modes,
 * matching the project's dashboard sidebar behavior.
 */
function SectionNavigationPanel({
  activeSection = "APTITUDE",
  targetRound = "all",
  onSelectSection,
  sectionProgress = {},
}) {
  const isIndividualMode = targetRound && targetRound !== "all";
  const normalizedTarget = isIndividualMode ? targetRound.toUpperCase() : null;

  // Horizontal sidebar collapse state with localStorage persistence
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("prephire_interview_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const handleToggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("prephire_interview_sidebar_collapsed", next ? "true" : "false");
      } catch {
        // noop
      }
      return next;
    });
  };

  // Base definitions (Single Source of Truth)
  const SECTIONS = [
    {
      id: "APTITUDE",
      name: "Aptitude",
      icon: Target,
      defaultTotal: 15,
      description: "Quantitative & Logical MCQs",
    },
    {
      id: "RESUME_PROJECT",
      name: "Resume / Project",
      icon: FileText,
      defaultTotal: 5,
      description: "AI questions from your resume",
    },
    {
      id: "TECHNICAL",
      name: "Technical",
      icon: BrainCircuit,
      defaultTotal: 20,
      description: "AI questions from your profile",
    },
    {
      id: "CODING",
      name: "Coding",
      icon: Code2,
      defaultTotal: 3,
      description: "Algorithmic Code IDE",
    },
    {
      id: "HR",
      name: "HR",
      icon: UserCheck,
      defaultTotal: 5,
      description: "Behavioral & Career Alignment",
    },
  ];

  const filteredSections = isIndividualMode
    ? SECTIONS.filter((s) => s.id === normalizedTarget)
    : SECTIONS;

  const targetSecObj = SECTIONS.find((s) => s.id === normalizedTarget);
  const totalCompleted = isIndividualMode
    ? (sectionProgress[normalizedTarget]?.completed || 0)
    : (sectionProgress.totalCompleted || 0);

  const totalQuestions = isIndividualMode
    ? (sectionProgress[normalizedTarget]?.total || targetSecObj?.defaultTotal || 5)
    : SECTIONS.reduce(
        (sum, sec) => sum + (sectionProgress[sec.id]?.total || sec.defaultTotal),
        0
      );

  return (
    <aside
      aria-label="Interview Sections Sidebar"
      className={`h-full flex flex-col justify-between transition-all duration-300 ease-in-out select-none rounded-2xl relative ${
        collapsed ? "w-[68px] p-2" : "w-[240px] xl:w-[260px] p-3.5"
      }`}
      style={{
        background: "linear-gradient(180deg, rgba(12, 15, 26, 0.95) 0%, rgba(8, 10, 18, 0.98) 100%)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* ── Top Header Bar ── */}
      <div
        className={`shrink-0 mb-3 pb-2.5 border-b border-white/10 flex items-center ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        {!collapsed ? (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded-lg bg-[#FF6B35]/10 border border-[#FF6B35]/30 flex items-center justify-center shrink-0">
                <Sparkles className="w-3 h-3 text-[#FF6B35]" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-widest text-white truncate">
                {isIndividualMode ? "Single Round" : "Sections"}
              </h3>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[9.5px] font-black text-[#FF6B35] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FF6B35]/10 border border-[#FF6B35]/25">
                {isIndividualMode ? "Mode" : `${SECTIONS.length} Rounds`}
              </span>
              <button
                type="button"
                onClick={handleToggleCollapse}
                title="Collapse sidebar"
                className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/15 text-white/50 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={handleToggleCollapse}
            title="Expand sidebar"
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/15 text-white/70 hover:text-white flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95"
          >
            <ChevronRight className="w-4 h-4 text-[#FF6B35]" />
          </button>
        )}
      </div>

      {/* ── Section List ── */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5 custom-scrollbar" style={{ scrollbarWidth: "none" }}>
        {filteredSections.map((sec) => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          const secTotal = sectionProgress[sec.id]?.total || sec.defaultTotal;
          const completedCount = sectionProgress[sec.id]?.completed || 0;
          const isFinished = completedCount >= secTotal && secTotal > 0;
          const roundPct = Math.min(100, Math.round((completedCount / (secTotal || 1)) * 100));
          const formattedCompleted = String(completedCount).padStart(2, "0");
          const formattedTotal = String(secTotal).padStart(2, "0");

          let statusBadgeText = isIndividualMode ? "TARGET" : "AVAILABLE";
          let statusBadgeClass = isIndividualMode
            ? "bg-[#FF6B35]/20 text-[#FF6B35] border-[#FF6B35]/30 font-extrabold"
            : "bg-white/5 text-white/40 border-white/10";

          if (isFinished) {
            statusBadgeText = "DONE";
            statusBadgeClass = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
          } else if (isActive) {
            statusBadgeText = "ACTIVE";
            statusBadgeClass = "bg-[#FF6B35]/20 text-[#FF6B35] border-[#FF6B35]/40 font-black";
          }

          if (collapsed) {
            /* ════ COLLAPSED ICON BUTTON WITH TOOLTIP ════ */
            return (
              <div key={sec.id} className="relative group flex justify-center">
                <button
                  type="button"
                  onClick={() => onSelectSection && onSelectSection(sec.id)}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer relative ${
                    isActive
                      ? "bg-[#FF6B35]/20 border-2 border-[#FF6B35] text-[#FF6B35] shadow-lg shadow-[#FF6B35]/20 scale-105"
                      : isFinished
                      ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                      : "bg-white/[0.03] border border-white/10 text-white/60 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {isActive && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#FF6B35] shadow-[0_0_8px_#FF6B35]" />
                  )}
                  {isFinished && !isActive && (
                    <CheckCircle2 className="absolute -top-1 -right-1 w-3 h-3 text-emerald-400 bg-[#0C0F1A] rounded-full" />
                  )}
                </button>

                {/* Floating Tooltip (right-anchored) */}
                <div className="opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 ease-out absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 w-44 p-2.5 rounded-xl bg-slate-900 border border-white/15 shadow-2xl backdrop-blur-xl text-left space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white truncate">{sec.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-extrabold uppercase border ${statusBadgeClass}`}>
                      {statusBadgeText}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-white/50 font-mono pt-0.5">
                    <span>Progress:</span>
                    <span className={`font-bold ${isActive ? "text-[#FF6B35]" : isFinished ? "text-emerald-400" : "text-white/70"}`}>
                      {formattedCompleted} / {formattedTotal} ({roundPct}%)
                    </span>
                  </div>
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${roundPct}%`,
                        backgroundColor: isFinished ? "#10b981" : isActive ? "#FF6B35" : "rgba(255,255,255,0.3)",
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          }

          /* ════ EXPANDED SECTION ITEM CARD ════ */
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => onSelectSection && onSelectSection(sec.id)}
              className={`w-full p-2.5 rounded-xl border text-left transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col gap-1.5 ${
                isActive
                  ? "bg-[#FF6B35]/[0.08] border-[#FF6B35] shadow-md shadow-[#FF6B35]/15"
                  : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/15"
              }`}
            >
              {/* Top Row: Icon + Name + Status Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-[#FF6B35]" : "text-white/60"}`} />
                  <span className="text-xs font-bold text-white truncate">
                    {sec.name}
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-extrabold uppercase tracking-wider border shrink-0 ${statusBadgeClass}`}>
                  {statusBadgeText}
                </span>
              </div>

              {/* Middle Row: Progress and Count */}
              <div className="flex items-center justify-between text-[10px] text-white/50 pt-0.5">
                <span className="text-white/40 truncate max-w-[110px]">{sec.description}</span>
                <div className="flex items-center gap-1.5 font-mono font-bold shrink-0">
                  <span className={isActive ? "text-[#FF6B35]" : isFinished ? "text-emerald-400" : "text-white/40"}>
                    {roundPct}%
                  </span>
                  <span className={isActive ? "text-white" : "text-white/60"}>
                    {formattedCompleted} / {formattedTotal}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${roundPct}%`,
                    backgroundColor: isFinished ? "#10b981" : isActive ? "#FF6B35" : "rgba(255,255,255,0.2)",
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Bottom Footer / Total Progress ── */}
      <div className={`shrink-0 pt-2.5 mt-2 border-t border-white/10 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed ? (
          <>
            <div>
              <p className="text-[9.5px] uppercase tracking-widest font-black text-white/40">
                {isIndividualMode ? "Round Progress" : "Total Progress"}
              </p>
              <p className="text-xs font-bold text-white font-mono mt-0.5">
                {String(totalCompleted).padStart(2, "0")} / {String(totalQuestions).padStart(2, "0")} Questions
              </p>
            </div>
            <div className="w-9 h-9 rounded-full border border-[#FF6B35]/40 flex items-center justify-center bg-[#FF6B35]/10 font-mono text-[11px] font-black text-[#FF6B35]">
              {Math.round((totalCompleted / (totalQuestions || 1)) * 100)}%
            </div>
          </>
        ) : (
          <div
            title={`Total Progress: ${totalCompleted}/${totalQuestions} (${Math.round((totalCompleted / (totalQuestions || 1)) * 100)}%)`}
            className="w-10 h-10 rounded-xl border border-[#FF6B35]/40 flex flex-col items-center justify-center bg-[#FF6B35]/10 font-mono text-[10px] font-black text-[#FF6B35] cursor-pointer"
            onClick={handleToggleCollapse}
          >
            <span>{Math.round((totalCompleted / (totalQuestions || 1)) * 100)}%</span>
          </div>
        )}
      </div>
    </aside>
  );
}

export default SectionNavigationPanel;
