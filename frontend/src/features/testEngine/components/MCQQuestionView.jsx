import React from "react";
import { Check } from "lucide-react";

/**
 * PrepHire MCQ / Objective Question Renderer
 * 
 * Production-ready DOM component conforming to PrepHire design specification:
 * - Brand Dark Theme (#0e131f / #131826)
 * - Orange Active Accent (#FF6B35)
 * - Option cards with Letter badge (A, B, C, D) + Radio circle + Crisp text
 * - Security & Copy Protection: user-select: none + capture lockdown
 * - Diagonal subtle security watermark
 */
export default function MCQQuestionView({
  question,
  questionIndex = 0,
  totalQuestions = 1,
  answer,
  onAnswer,
  candidateWatermark = "PREPHIRE SECURE ASSESSMENT",
}) {
  if (!question) {
    return (
      <div className="p-8 text-center bg-[#0e131f] border border-white/10 rounded-2xl text-zinc-500 text-xs">
        Question unavailable
      </div>
    );
  }

  const letters = ["A", "B", "C", "D", "E", "F"];
  const difficulty = (question.difficulty || "medium").toLowerCase();

  const diffBadgeStyles =
    difficulty === "easy"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      : difficulty === "hard"
      ? "bg-red-500/10 text-red-400 border-red-500/30"
      : "bg-amber-500/10 text-amber-400 border-amber-500/30";

  const questionText =
    question.question ||
    question.title ||
    question.description ||
    "Question text unavailable";

  const rawOptions = question.options || [];
  const options = Array.isArray(rawOptions)
    ? rawOptions
    : typeof rawOptions === "object"
    ? Object.values(rawOptions)
    : [];

  return (
    <div
      className="relative overflow-hidden bg-[#0e131f] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6 select-none"
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        MozUserSelect: "none",
        msUserSelect: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
    >
      {/* ── Subtle Diagonal Security Watermark ── */}
      <div
        className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center opacity-[0.035] select-none rotate-[-22deg] scale-150 overflow-hidden"
        aria-hidden="true"
      >
        <div className="grid grid-cols-3 gap-16 text-center font-mono text-[10px] text-zinc-100 tracking-wider">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="whitespace-nowrap">
              {candidateWatermark}
            </div>
          ))}
        </div>
      </div>

      {/* ── Question Header (Meta & Badges) ── */}
      <div className="relative z-10 flex items-center justify-between flex-wrap gap-2 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Question Number Badge */}
          <span className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-[#FF6B35] shadow-sm shadow-[#FF6B35]/20 tracking-wide">
            QUESTION {String(questionIndex + 1).padStart(2, "0")}
          </span>

          {/* Type Badge */}
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[#131826] border border-white/5 text-zinc-400 uppercase tracking-wider">
            {question.type || (question.subject ? question.subject : "MCQ")}
          </span>

          {/* Difficulty Badge */}
          <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border uppercase tracking-wider ${diffBadgeStyles}`}>
            {difficulty}
          </span>
        </div>

        {/* Marks Badge */}
        <div className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#131826] border border-white/5 text-zinc-300">
          <span>+{question.marks || 1} {question.marks === 1 ? "MARK" : "MARKS"}</span>
          {question.negativeMarks > 0 && (
            <span className="text-red-400 text-[10px]">(-{question.negativeMarks})</span>
          )}
        </div>
      </div>

      {/* ── Question Statement Text ── */}
      <div className="relative z-10 text-base sm:text-lg font-semibold leading-relaxed tracking-normal text-zinc-100 py-1 whitespace-pre-wrap">
        {questionText}
      </div>

      {/* ── Options List ── */}
      <div className="relative z-10 grid grid-cols-1 gap-3 pt-2">
        {options.map((opt, idx) => {
          if (opt === null || opt === undefined) return null;
          const optText = typeof opt === "string" ? opt : String(opt?.text || opt?.value || opt);
          const letter = letters[idx] || String.fromCharCode(65 + idx);
          const isSelected = answer === letter;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onAnswer(letter)}
              className={`group flex items-center gap-4 p-4 sm:p-4.5 rounded-xl border text-left cursor-pointer transition-all duration-150 active:scale-[0.99] ${
                isSelected
                  ? "border-[#FF6B35] bg-[#FF6B35]/10 ring-1 ring-[#FF6B35]/40 shadow-md shadow-[#FF6B35]/10"
                  : "border-white/10 hover:border-white/20 bg-[#131826] hover:bg-[#171e30]"
              }`}
            >
              {/* Option Letter Box */}
              <div
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition-colors duration-150 ${
                  isSelected
                    ? "bg-[#FF6B35] text-white shadow-sm shadow-[#FF6B35]/30"
                    : "bg-[#181f30] border border-white/10 text-zinc-400 group-hover:text-zinc-200 group-hover:border-white/20"
                }`}
              >
                {letter}
              </div>

              {/* Radio Indicator */}
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                  isSelected
                    ? "border-[#FF6B35] bg-[#FF6B35]/20"
                    : "border-zinc-600 group-hover:border-zinc-400"
                }`}
              >
                {isSelected && (
                  <div className="w-2 h-2 rounded-full bg-[#FF6B35]" />
                )}
              </div>

              {/* Option Content */}
              <div
                className={`flex-1 text-xs sm:text-sm leading-relaxed ${
                  isSelected ? "font-semibold text-white" : "font-normal text-zinc-300 group-hover:text-zinc-100"
                }`}
              >
                {optText}
              </div>

              {/* Selected Checkmark */}
              {isSelected && (
                <div className="shrink-0 text-[#FF6B35]">
                  <Check className="w-4 h-4" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
