import React from "react";
import { CheckCircle2, Circle, AlertCircle, Award } from "lucide-react";

export default function QuestionNavigator({
  questions = [],
  currentIndex = 0,
  onSelectQuestion,
  questionProgress = [],
}) {
  const getProgress = (qId) => {
    return questionProgress.find((qp) => String(qp.questionId) === String(qId)) || {};
  };

  const getDifficultyColor = (diff = "") => {
    switch (diff.toLowerCase()) {
      case "easy":
        return "#10B981";
      case "medium":
        return "#F59E0B";
      case "hard":
        return "#EF4444";
      default:
        return "#06B6D4";
    }
  };

  return (
    <div
      className="flex flex-col border-r h-full overflow-hidden shrink-0 select-none"
      style={{
        borderColor: "var(--border)",
        background: "var(--card-bg)",
      }}
    >
      <div className="p-3 border-b shrink-0 flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5 text-cyan-400" />
          Questions ({questions.length})
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {questions.map((q, idx) => {
          const isActive = idx === currentIndex;
          const prog = getProgress(q._id || q.id);
          const isSolved = prog.status === "SOLVED";
          const isPartial = prog.status === "PARTIAL";
          const diffColor = getDifficultyColor(q.difficulty);

          return (
            <button
              key={q._id || idx}
              type="button"
              onClick={() => onSelectQuestion(idx)}
              className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                isActive
                  ? "ring-2 ring-cyan-500/50 shadow-sm"
                  : "hover:bg-[var(--bg-secondary)] border-transparent"
              }`}
              style={{
                borderColor: isActive ? "#06B6D4" : "var(--border)",
                background: isActive ? "rgba(6, 182, 212, 0.08)" : "var(--bg-secondary)",
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 font-mono"
                  style={{
                    background: isSolved
                      ? "rgba(16, 185, 129, 0.2)"
                      : isPartial
                      ? "rgba(245, 158, 11, 0.2)"
                      : "var(--input-bg)",
                    color: isSolved ? "#10B981" : isPartial ? "#F59E0B" : "var(--text-secondary)",
                  }}
                >
                  {isSolved ? "✓" : idx + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className="text-xs font-bold truncate"
                    style={{
                      color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                    }}
                  >
                    {q.title || `Problem ${idx + 1}`}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
                    <span className="font-semibold" style={{ color: diffColor }}>
                      {q.difficulty}
                    </span>
                    <span className="text-[var(--text-muted)]">•</span>
                    <span className="text-[var(--text-muted)]">{q.marks || 10} pts</span>
                  </div>
                </div>
              </div>

              {/* Status pill icon */}
              <div className="shrink-0">
                {isSolved ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : isPartial ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-bold">
                    {prog.passedTests}/{prog.totalTests}
                  </span>
                ) : (
                  <Circle className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-40" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
