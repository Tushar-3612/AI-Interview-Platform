import React from "react";
import { Clock, MemoryStick, Tag, Hash } from "lucide-react";

/**
 * LeetCode-style problem description panel.
 * Protected against copy/drag/contextmenu extraction with watermark and select lockdown.
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
    <div
      className="relative px-4 py-3 flex-1 overflow-y-auto select-none"
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        MozUserSelect: "none",
        msUserSelect: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Subtle Security Watermark Layer */}
      <div
        className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center opacity-[0.025] select-none rotate-[-22deg] scale-150 overflow-hidden"
        aria-hidden="true"
      >
        <div className="grid grid-cols-3 gap-16 text-center font-mono text-[10px] text-zinc-400 tracking-wider">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="whitespace-nowrap">
              PREPHIRE CONFIDENTIAL ASSESSMENT
            </div>
          ))}
        </div>
      </div>

      {/* Content Layer */}
      <div className="relative z-10 space-y-4">
        {/* Title */}
        <div className="flex items-start justify-between gap-2">
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
        <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
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
          className="prose prose-sm max-w-none text-xs sm:text-sm leading-relaxed"
          style={{ color: "var(--text-primary)" }}
        >
          {renderHTML(question?.problemStatement || question?.description || "")}
        </div>

        {/* Constraints */}
        {constraints && (
          <div
            className="p-3.5 rounded-xl text-xs space-y-1"
            style={{ background: "var(--input-bg)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
          >
            <span className="font-semibold block mb-1" style={{ color: "var(--text-primary)" }}>
              Constraints
            </span>
            {renderHTML(constraints)}
          </div>
        )}

        {/* Examples */}
        {examples.length > 0 && (
          <div className="space-y-3 pt-1">
            <span className="font-semibold text-xs block" style={{ color: "var(--text-primary)" }}>
              Examples
            </span>
            {examples.map((ex, i) => (
              <div key={i} className="p-3 rounded-xl space-y-2" style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}>
                <span className="text-xs font-bold" style={{ color: "var(--primary)" }}>Example {i + 1}</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-muted)" }}>
                      Input:
                    </span>
                    <pre
                      className="whitespace-pre-wrap rounded-lg p-2 text-xs font-mono overflow-x-auto"
                      style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                    >
                      {ex.input || "(empty)"}
                    </pre>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-muted)" }}>
                      Output:
                    </span>
                    <pre
                      className="whitespace-pre-wrap rounded-lg p-2 text-xs font-mono overflow-x-auto"
                      style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                    >
                      {ex.output || "(empty)"}
                    </pre>
                  </div>
                </div>
                {ex.explanation && (
                  <p className="text-xs leading-relaxed pt-1" style={{ color: "var(--text-secondary)" }}>
                    <strong style={{ color: "var(--text-primary)" }}>Explanation: </strong>
                    {ex.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Sample I/O fallback for legacy questions */}
        {(question?.sampleInput || question?.sampleOutput) && examples.length === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-muted)" }}>
                Sample Input
              </span>
              <pre
                className="whitespace-pre-wrap rounded-lg p-2.5 text-xs font-mono overflow-x-auto"
                style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              >
                {question?.sampleInput || "—"}
              </pre>
            </div>
            <div>
              <span className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-muted)" }}>
                Sample Output
              </span>
              <pre
                className="whitespace-pre-wrap rounded-lg p-2.5 text-xs font-mono overflow-x-auto"
                style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              >
                {question?.sampleOutput || "—"}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Render a piece of text that may be plain text or basic HTML.
 */
function renderHTML(content) {
  if (!content) return <p style={{ color: "var(--text-muted)" }}>No description available.</p>;
  if (/<\w+>|<\/\w+>|<br/i.test(content)) {
    return <div dangerouslySetInnerHTML={{ __html: content }} />;
  }
  return <pre className="whitespace-pre-wrap leading-relaxed font-sans">{content}</pre>;
}

export default ProblemDescription;
