import React from "react";
import { Clock, MemoryStick, Tag, Hash } from "lucide-react";

/**
 * LeetCode-style problem description panel.
 *
 * Props:
 *  question: the full CodingQuestion object
 *  difficulty: "easy" | "medium" | "hard"
 *  acceptance: number 0-100 (optional)
 *  tags: string[] (optional)
 */
function ProblemDescription({ question, difficulty, acceptance, tags }) {
  const diff = (difficulty || question?.difficulty || "easy").toLowerCase();
  const diffColors = { easy: "#22c55e", medium: "#eab308", hard: "#ef4444" };
  const color = diffColors[diff] || diffColors.medium;

  const examples = (question?.examples && question.examples.length > 0) ? question.examples : [];
  const constraints = question?.constraints || question?.description;
  const timeLimit = question?.timeLimit;
  const memoryLimit = question?.memoryLimit;
  const questionTags = tags && tags.length ? tags : (question?.tags || []);

  return (
    <div className="px-4 py-3 flex-1 overflow-y-auto">
      {/* Title */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <h1
          className="text-xl font-bold leading-snug"
          style={{ color: "var(--text-primary)" }}
        >
          {question?.title || "Untitled Problem"}
        </h1>
        <span
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize shrink-0"
          style={{
            background: `${color}18`,
            color: color,
            border: `1px solid ${color}40`,
          }}
        >
          {diff}
        </span>
      </div>

      {/* Meta row: acceptance, time, memory */}
      <div className="flex flex-wrap items-center gap-4 mb-4 text-xs" style={{ color: "var(--text-muted)" }}>
        {typeof acceptance === "number" && (
          <span className="flex items-center gap-1">
            <Hash className="w-3.5 h-3.5" />
            Acceptance: {acceptance}%
          </span>
        )}
        {timeLimit > 0 && (
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Time: {timeLimit}ms
          </span>
        )}
        {memoryLimit > 0 && (
          <span className="flex items-center gap-1">
            <MemoryStick className="w-3.5 h-3.5" />
            Memory: {memoryLimit}MB
          </span>
        )}
        {questionTags.length > 0 && (
          <span className="flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" />
            {questionTags.map((t) => (
              <span
                key={t}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ background: "var(--input-bg)", color: "var(--text-muted)" }}
              >
              {t}
              </span>
            ))}
          </span>
        )}
      </div>

      {/* Problem statement */}
      <div
        className="prose prose-sm max-w-none mb-5"
        style={{ color: "var(--text-primary)" }}
      >
        {renderHTML(question?.problemStatement || question?.description || "")}
      </div>

      {/* Constraints */}
      {constraints && (
        <div
          className="p-3.5 rounded-xl mb-4 text-xs"
          style={{ background: "var(--input-bg)", color: "var(--text-secondary)" }}
        >
          <span className="font-semibold block mb-1.5" style={{ color: "var(--text-primary)" }}>
            Constraints
          </span>
          {renderHTML(constraints)}
        </div>
      )}

      {/* Examples */}
      {examples.length > 0 && (
        <div className="space-y-3.5 mb-4">
          <span className="font-semibold text-xs" style={{ color: "var(--text-primary)" }}>
            Examples
          </span>
          {examples.map((ex, i) => (
            <div key={i}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] font-medium block mb-1" style={{ color: "var(--text-muted)" }}>
                    Input
                  </span>
                  <pre
                    className="whitespace-pre-wrap rounded-lg p-2.5 text-xs overflow-x-auto"
                    style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                  >
                    {ex.input || "(empty)"}
                  </pre>
                </div>
                <div>
                  <span className="text-[11px] font-medium block mb-1" style={{ color: "var(--text-muted)" }}>
                    Output
                  </span>
                  <pre
                    className="whitespace-pre-wrap rounded-lg p-2.5 text-xs overflow-x-auto"
                    style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                  >
                    {ex.output || "(empty)"}
                  </pre>
                </div>
              </div>
              {ex.explanation && (
                <p className="text-xs mt-1.5" style={{ color: "var(--text-secondary)" }}>
                  {ex.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Sample I/O fallback for legacy questions */}
      {(question?.sampleInput || question?.sampleOutput) && examples.length === 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <span className="text-[11px] font-medium block mb-1" style={{ color: "var(--text-muted)" }}>
              Sample Input
            </span>
            <pre
              className="whitespace-pre-wrap rounded-lg p-2.5 text-xs overflow-x-auto"
              style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              {question?.sampleInput || "—"}
            </pre>
          </div>
          <div>
            <span className="text-[11px] font-medium block mb-1" style={{ color: "var(--text-muted)" }}>
              Sample Output
            </span>
            <pre
              className="whitespace-pre-wrap rounded-lg p-2.5 text-xs overflow-x-auto"
              style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              {question?.sampleOutput || "—"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Render a piece of text that may be plain text or basic HTML.
 * Falls back to a <pre> for plain text so whitespace is preserved.
 */
function renderHTML(content) {
  if (!content) return <p style={{ color: "var(--text-muted)" }}>No description available.</p>;
  // If it looks like HTML, render it directly; otherwise treat as plain text.
  if (/<\w+>|<\/\w+>|<br/i.test(content)) {
    return <div dangerouslySetInnerHTML={{ __html: content }} />;
  }
  return <pre className="whitespace-pre-wrap leading-relaxed">{content}</pre>;
}

export default ProblemDescription;
