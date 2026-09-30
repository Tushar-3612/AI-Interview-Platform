import React from "react";
import { CheckCircle2, Save, Send, AlertCircle, ArrowLeft } from "lucide-react";
import CodingTimer from "./CodingTimer";

export default function CodingHeader({
  assessmentTitle = "Coding Assessment",
  currentIndex = 0,
  totalQuestions = 1,
  formattedTime,
  isLowTime,
  isCritical,
  saveStatus = "idle",
  onSubmitAssessment,
  onExit,
  solvedCount = 0,
}) {
  return (
    <header
      className="flex items-center justify-between gap-3 px-4 py-2.5 border-b shrink-0 flex-wrap"
      style={{
        borderColor: "var(--border)",
        background: "var(--card-bg)",
      }}
    >
      <div className="flex items-center gap-3">
        {onExit && (
          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border)] transition cursor-pointer"
            style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
            title="Leave assessment"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exit</span>
          </button>
        )}

        <div>
          <h1 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)] tracking-tight line-clamp-1">
            {assessmentTitle}
          </h1>
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <span>
              Question <strong className="text-[var(--text-primary)]">{currentIndex + 1}</strong> of {totalQuestions}
            </span>
            <span>•</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {solvedCount} Solved
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        {/* Autosave status indicator */}
        <div className="hidden sm:flex items-center gap-1 text-xs">
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1 text-[var(--text-muted)]">
              <div className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Saving...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Saved
            </span>
          )}
          {saveStatus === "dirty" && (
            <span className="flex items-center gap-1 text-[var(--text-muted)]">
              <Save className="w-3.5 h-3.5" />
              Unsaved changes
            </span>
          )}
        </div>

        {/* Countdown Timer */}
        {formattedTime && (
          <CodingTimer
            formattedTime={formattedTime}
            isLowTime={isLowTime}
            isCritical={isCritical}
          />
        )}

        {/* Finish / Submit Assessment Button */}
        {onSubmitAssessment && (
          <button
            type="button"
            onClick={onSubmitAssessment}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 shadow-md shadow-emerald-500/20 cursor-pointer transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Finish Test</span>
          </button>
        )}
      </div>
    </header>
  );
}
