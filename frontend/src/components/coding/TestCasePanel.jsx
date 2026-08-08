import React, { useState } from "react";
import { CheckCircle2, XCircle, Clock, Zap, Eye, EyeOff, Lock } from "lucide-react";

/**
 * TestCasePanel — renders per-test-case results for a submission.
 *
 * Props:
 *  results:   [{ index, passed, isHidden, input, expected, actual, error, timeMs, memory }]
 *  sampleCases: the question's visible sample test cases [{ input, expected }]
 *  passedCount, totalCount
 *  hideInput:  when true, hides "Input/Expected" columns (used in Output tab)
 */
function TestCasePanel({ results = [], sampleCases = [], passedCount, totalCount, hideInput = false }) {
  const [showDiff, setShowDiff] = useState({});

  const hasResults = results.length > 0;
  const hiddenResults = results.filter((r) => r.isHidden);
  const visibleResults = results.filter((r) => !r.isHidden);

  return (
    <div className="space-y-1.5">
      {/* Summary */}
      {hasResults && (
        <div className="flex items-center justify-between text-xs mb-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold" style={{ color: (passedCount ?? 0) === (totalCount ?? results.length) ? "#22c55e" : "#ef4444" }}>
              {passedCount ?? 0}/{totalCount ?? results.length} passed
            </span>
            <span style={{ color: "#969696" }}>· {results.length} test cases</span>
            {hiddenResults.length > 0 && (
              <span className="flex items-center gap-1" style={{ color: "#969696" }}>
                <Lock className="w-3 h-3" /> {hiddenResults.length} hidden
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5" style={{ color: "#969696" }}>
            <Zap className="w-3 h-3" />
            <span>{results.length > 0 ? Math.max(...results.map((r) => r.timeMs || 0)) : 0} ms max</span>
          </div>
        </div>
      )}

      {/* Visible sample cases (reference) */}
      {sampleCases.length > 0 && !hasResults && (
        <div className="space-y-1.5">
          {sampleCases.map((tc, i) => (
            <SampleCase key={i} index={i + 1} input={tc.input} expected={tc.expected} />
          ))}
        </div>
      )}

      {/* Results grid - visible */}
      {hasResults && visibleResults.map((tc, i) => (
        <ResultRow key={tc.index || i + 1} tc={tc} showDiff={showDiff} setShowDiff={setShowDiff} hideInput={hideInput} />
      ))}

      {/* Results grid - hidden */}
      {hasResults && hiddenResults.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: "#969696" }}>
            <Lock className="w-3 h-3" />
            <span className="font-medium">Hidden Test Cases</span>
          </div>
          {hiddenResults.map((tc, i) => (
            <ResultRow key={tc.index || `h${i}`} tc={tc} showDiff={showDiff} setShowDiff={setShowDiff} hideInput={hideInput} />
          ))}
        </div>
      )}

      {/* Hidden test case banner (when no results) */}
      {!hasResults && sampleCases.length > 0 && (
        <p className="text-[11px] mt-2" style={{ color: "#969696" }}>
          + Hidden test cases are evaluated on submit.
        </p>
      )}
    </div>
  );
}

function ResultRow({ tc, showDiff, setShowDiff, hideInput }) {
  const passed = tc.passed;
  const bg = passed ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)";
  const color = passed ? "#22c55e" : "#ef4444";

  return (
    <details
      className="text-xs rounded-lg mb-1"
      style={{ background: bg, border: `1px solid ${passed ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}` }}
    >
      <summary className="px-3 py-2 cursor-pointer flex items-center justify-between select-none">
        <div className="flex items-center gap-2 font-medium" style={{ color }}>
          {passed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
          Test {tc.index || "?"}
          {tc.isHidden ? " (Hidden)" : ""} — {passed ? "Passed" : "Failed"}
        </div>
        <div className="flex items-center gap-3">
          {tc.timeMs > 0 && (
            <span className="flex items-center gap-1" style={{ color: "#969696" }}>
              <Clock className="w-3 h-3" /> {tc.timeMs} ms
            </span>
          )}
          {tc.memory > 0 && (
            <span className="flex items-center gap-1" style={{ color: "#969696" }}>
              {tc.memory} KB
            </span>
          )}
        </div>
      </summary>
      <div className="px-3 py-2 border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
        {tc.error ? (
          <pre className="whitespace-pre-wrap" style={{ color: "#fca5a5" }}>{tc.error}</pre>
        ) : (
          <>
            {!hideInput && (
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <span className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "#969696" }}>Input</span>
                  <pre className="font-mono whitespace-pre-wrap break-all p-2 rounded" style={{ background: "#252526", color: "#d4d4d4" }}>{tc.input || "(empty)"}</pre>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "#969696" }}>Expected</span>
                  <pre className="font-mono whitespace-pre-wrap break-all p-2 rounded" style={{ background: "#252526", color: "#93c5fd" }}>{tc.expected || "(empty)"}</pre>
                </div>
              </div>
            )}
            {!passed && tc.actual != null && (
              <div className="mb-2">
                <span className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "#969696" }}>Actual</span>
                <pre className="font-mono whitespace-pre-wrap break-all p-2 rounded" style={{ background: "#252526", color: "#f87171" }}>{String(tc.actual)}</pre>
              </div>
            )}
            {!passed && tc.expected != null && tc.actual != null && (
              <DiffView expected={tc.expected} actual={tc.actual} open={showDiff[tc.index] || false} onToggle={() => setShowDiff((s) => ({ ...s, [tc.index]: !s[tc.index] }))} />
            )}
          </>
        )}
      </div>
    </details>
  );
}

function DiffView({ expected, actual, open, onToggle }) {
  const exp = String(expected || "");
  const act = String(actual || "");
  if (exp === act) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-[11px] cursor-pointer hover:underline"
        style={{ color: "#60a5fa" }}
      >
        {open ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        {open ? "Hide" : "Show"} difference
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <span className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "#969696" }}>Expected</span>
            <pre className="text-xs font-mono whitespace-pre-wrap break-all p-2 rounded" style={{ background: "#252526", color: "#d4d4d4" }}>{exp}</pre>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: "#969696" }}>Actual</span>
            <pre className="text-xs font-mono whitespace-pre-wrap break-all p-2 rounded" style={{ background: "rgba(239,68,68,0.1)", color: "#fca5a5" }}>{act}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function SampleCase({ index, input, expected }) {
  return (
    <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg" style={{ background: "#252526", color: "#d4d4d4" }}>
      <span className="font-mono">In: {input}</span>
      <span style={{ color: "#969696" }}>→</span>
      <span className="font-mono">Out: {expected}</span>
    </div>
  );
}

export default TestCasePanel;
