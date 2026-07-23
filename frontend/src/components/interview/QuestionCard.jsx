import React from "react";
import { BrainCircuit } from "lucide-react";

/**
 * QuestionCard — Compact header card showing Question number, Category, and Difficulty badge.
 * The question text itself is displayed prominently on the main AI stage.
 */
function QuestionCard({ currentIndex, totalQuestions, difficulty, category, showQuestionText = false, questionText, estimatedTime }) {
  return (
    <div
      className="rounded-2xl overflow-hidden shadow-sm flex flex-col"
      style={{
        background: "rgba(8,10,18,0.9)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-white/90">
            Question {currentIndex} <span className="text-white/40 font-normal">/ {totalQuestions}</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {category && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20">
              {category}
            </span>
          )}
          {difficulty && (
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                difficulty === "Hard"
                  ? "bg-red-500/15 text-red-400 border-red-500/20"
                  : difficulty === "Medium"
                  ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
                  : "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
              }`}
            >
              {difficulty}
            </span>
          )}
        </div>
      </div>

      {showQuestionText && (
        <div className="p-4 border-t border-white/5">
          <p className="text-xs text-white/80 leading-relaxed">{questionText}</p>
        </div>
      )}
    </div>
  );
}

export default QuestionCard;

