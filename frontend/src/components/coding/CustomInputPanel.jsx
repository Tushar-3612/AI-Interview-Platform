import React from "react";
import { Terminal, Play, X, Clock, MemoryStick } from "lucide-react";

export default function CustomInputPanel({
  customInput = "",
  onChangeCustomInput,
  onRunCustom,
  running = false,
  customOutput = null,
  onClose,
}) {
  return (
    <div
      className="p-3 border-t space-y-2.5 bg-[var(--card-bg)] shrink-0"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          Custom Test Input
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-md"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Input Textarea */}
        <div className="space-y-1">
          <textarea
            value={customInput}
            onChange={(e) => onChangeCustomInput(e.target.value)}
            placeholder="Enter standard input (stdin) for your program..."
            rows={3}
            className="w-full p-2.5 rounded-xl border text-xs font-mono outline-none transition resize-none"
            style={{
              background: "var(--input-bg)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-muted)]">
              Max 10 KB • For testing only (does not affect final score)
            </span>
            <button
              type="button"
              onClick={onRunCustom}
              disabled={running}
              className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 transition cursor-pointer disabled:opacity-50"
            >
              {running ? (
                <>
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  Run Custom Input
                </>
              )}
            </button>
          </div>
        </div>

        {/* Output Area */}
        <div className="space-y-1">
          <div
            className="w-full p-2.5 rounded-xl border text-xs font-mono h-[88px] overflow-y-auto"
            style={{
              background: "var(--bg-secondary)",
              borderColor: "var(--border)",
            }}
          >
            {customOutput ? (
              <div className="space-y-1">
                {customOutput.compileOutput && (
                  <pre className="text-rose-400 whitespace-pre-wrap">{customOutput.compileOutput}</pre>
                )}
                {customOutput.stderr && (
                  <pre className="text-amber-400 whitespace-pre-wrap">{customOutput.stderr}</pre>
                )}
                {customOutput.stdout && (
                  <pre className="text-emerald-400 whitespace-pre-wrap">{customOutput.stdout}</pre>
                )}
                {!customOutput.stdout && !customOutput.stderr && !customOutput.compileOutput && (
                  <span className="text-[var(--text-muted)]">Program returned no output.</span>
                )}
              </div>
            ) : (
              <span className="text-[var(--text-muted)] italic">
                Execution output will appear here...
              </span>
            )}
          </div>

          {customOutput && (
            <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {customOutput.timeMs || 0} ms
              </span>
              {customOutput.memoryKB > 0 && (
                <span className="flex items-center gap-1">
                  <MemoryStick className="w-3 h-3" />
                  {customOutput.memoryKB} KB
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
