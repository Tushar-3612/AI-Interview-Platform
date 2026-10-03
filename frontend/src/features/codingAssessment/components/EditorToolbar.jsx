import React from "react";
import {
  Play,
  Send,
  Code2,
  RotateCcw,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Terminal,
  WrapText,
} from "lucide-react";

export const SUPPORTED_LANGUAGES = [
  { id: "python", label: "Python", ext: "py" },
  { id: "cpp", label: "C++", ext: "cpp" },
  { id: "java", label: "Java", ext: "java" },
  { id: "c", label: "C", ext: "c" },
  { id: "javascript", label: "JavaScript", ext: "js" },
];

export default function EditorToolbar({
  language,
  onLanguageChange,
  onRun,
  onSubmit,
  onReset,
  running = false,
  submitting = false,
  runStage = null,
  showCustomInput,
  onToggleCustomInput,
  wordWrap,
  onToggleWordWrap,
  fullscreen,
  onToggleFullscreen,
  code = "",
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      className="flex items-center justify-between px-3 py-2 border-b shrink-0 flex-wrap gap-2 select-none"
      style={{
        borderColor: "var(--border)",
        background: "var(--card-bg)",
      }}
    >
      {/* Left side: Language Selector */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-bold text-[var(--text-muted)] flex items-center gap-1">
          <Code2 className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Language:</span>
        </label>
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          disabled={running || submitting}
          className="text-xs font-bold px-2.5 py-1 rounded-lg border outline-none cursor-pointer transition"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
          }}
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      {/* Right side: Tool buttons & Actions */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Toggle Custom Input Panel */}
        <button
          type="button"
          onClick={onToggleCustomInput}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
            showCustomInput
              ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/40"
              : "text-[var(--text-muted)] border-transparent hover:bg-[var(--bg-secondary)]"
          }`}
          title="Toggle Custom Input Panel"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Custom Input</span>
        </button>

        {/* Word wrap toggle */}
        <button
          type="button"
          onClick={onToggleWordWrap}
          className={`p-1.5 rounded-lg border transition cursor-pointer ${
            wordWrap
              ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/40"
              : "text-[var(--text-muted)] border-transparent hover:bg-[var(--bg-secondary)]"
          }`}
          title={wordWrap ? "Disable Word Wrap" : "Enable Word Wrap"}
        >
          <WrapText className="w-3.5 h-3.5" />
        </button>

        {/* Copy Code */}
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition cursor-pointer"
          title="Copy Code"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>

        {/* Reset Code */}
        <button
          type="button"
          onClick={onReset}
          disabled={running || submitting}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition cursor-pointer"
          title="Reset Code to Starter Template"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Fullscreen toggle */}
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition cursor-pointer"
            title={fullscreen ? "Exit Fullscreen" : "Fullscreen Editor"}
          >
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        )}

        <div className="h-4 w-px bg-[var(--border)] mx-1" />

        {/* Run Sample Tests */}
        <button
          type="button"
          onClick={onRun}
          disabled={running || submitting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border disabled:opacity-50"
          style={{
            borderColor: "rgba(255, 107, 53, 0.4)",
            background: "rgba(255, 107, 53, 0.12)",
            color: "#FF6B35",
          }}
        >
          {running ? (
            <>
              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>{runStage || "Running..."}</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 fill-current" />
              <span>Run Tests</span>
            </>
          )}
        </button>

        {/* Submit Solution */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || running}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 shadow-sm shadow-cyan-500/25 transition cursor-pointer disabled:opacity-50"
        >
          {submitting ? (
            <>
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Evaluating...</span>
            </>
          ) : (
            <>
              <Send className="w-3 h-3" />
              <span>Submit</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
