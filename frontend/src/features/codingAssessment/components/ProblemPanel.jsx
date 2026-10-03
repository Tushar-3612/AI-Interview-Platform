import React from "react";
import { Clock, Cpu, Tag, FileText, CheckCircle2 } from "lucide-react";

export default function ProblemPanel({ question }) {
  if (!question) {
    return (
      <div className="p-6 text-center text-xs text-[var(--text-muted)]">
        No question selected.
      </div>
    );
  }

  const diffColors = {
    easy: { text: "#10B981", bg: "rgba(16, 185, 129, 0.12)", border: "rgba(16, 185, 129, 0.3)" },
    medium: { text: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.3)" },
    hard: { text: "#EF4444", bg: "rgba(239, 68, 68, 0.12)", border: "rgba(239, 68, 68, 0.3)" },
  };

  const diffStyle = diffColors[String(question.difficulty).toLowerCase()] || diffColors.medium;
  const examples = question.examples || question.sampleTestCases || [];

  return (
    <div className="p-4 sm:p-6 overflow-y-auto h-full space-y-5 text-[var(--text-primary)]">
      {/* Title & Metadata header */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-lg sm:text-xl font-black tracking-tight leading-snug">
            {question.title}
          </h2>
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-bold px-2.5 py-0.5 rounded-full border capitalize"
              style={{
                color: diffStyle.text,
                background: diffStyle.bg,
                borderColor: diffStyle.border,
              }}
            >
              {question.difficulty}
            </span>
            <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
              {question.marks || 10} Marks
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)] flex-wrap">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Time Limit: {question.timeLimit || 2}s
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5" />
            Memory: {question.memoryLimit || 256} MB
          </span>
          {question.category && (
            <>
              <span>•</span>
              <span className="font-semibold text-[var(--text-secondary)]">{question.category}</span>
            </>
          )}
        </div>
      </div>

      {/* Problem Statement */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-cyan-400" />
          Problem Description
        </h3>
        <div className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap font-sans">
          {question.description || question.problemStatement}
        </div>
      </div>

      {/* Input / Output Format */}
      {(question.inputFormat || question.outputFormat) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {question.inputFormat && (
            <div className="p-3 rounded-xl border bg-[var(--bg-secondary)]/50 space-y-1" style={{ borderColor: "var(--border)" }}>
              <span className="text-[11px] font-bold text-[var(--text-primary)]">Input Format</span>
              <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{question.inputFormat}</p>
            </div>
          )}
          {question.outputFormat && (
            <div className="p-3 rounded-xl border bg-[var(--bg-secondary)]/50 space-y-1" style={{ borderColor: "var(--border)" }}>
              <span className="text-[11px] font-bold text-[var(--text-primary)]">Output Format</span>
              <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{question.outputFormat}</p>
            </div>
          )}
        </div>
      )}

      {/* Constraints */}
      {question.constraints && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Constraints
          </h4>
          <div className="p-3 rounded-xl border font-mono text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)]" style={{ borderColor: "var(--border)" }}>
            {question.constraints}
          </div>
        </div>
      )}

      {/* Sample Examples */}
      {examples.length > 0 && (
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Sample Testcases
          </h4>

          <div className="space-y-3">
            {examples.map((ex, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border bg-[var(--bg-secondary)]/40 space-y-2"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="text-[11px] font-bold text-cyan-400">
                  Example {ex.index || idx + 1}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border)]">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] block mb-0.5">Input:</span>
                    <pre className="whitespace-pre-wrap text-[var(--text-primary)]">{ex.input || "None"}</pre>
                  </div>
                  <div className="p-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border)]">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] block mb-0.5">Output:</span>
                    <pre className="whitespace-pre-wrap text-emerald-400">{ex.output || ex.expectedOutput || "None"}</pre>
                  </div>
                </div>

                {ex.explanation && (
                  <p className="text-xs text-[var(--text-muted)] pt-1 italic font-sans">
                    Explanation: {ex.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {question.tags && question.tags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-2">
          <Tag className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          {question.tags.map((t) => (
            <span
              key={t}
              className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)]"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
