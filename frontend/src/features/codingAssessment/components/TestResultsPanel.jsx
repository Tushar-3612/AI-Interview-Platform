import React, { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Terminal, Clock } from "lucide-react";

export default function TestResultsPanel({
  activeTab = "sample",
  onTabChange,
  sampleResults = [],
  submissionData = null,
  compileOutput = "",
}) {
  const [selectedCaseIdx, setSelectedCaseIdx] = useState(0);

  const sampleCount = sampleResults.length;
  const samplePassed = sampleResults.filter((r) => r.status === "ACCEPTED" || r.passed).length;

  const hiddenSummary = submissionData?.hiddenTestSummary || {
    passed: submissionData?.results?.filter((r) => r.isHidden && r.passed)?.length || 0,
    total: submissionData?.results?.filter((r) => r.isHidden)?.length || 0,
  };

  const selectedCase = sampleResults[selectedCaseIdx] || sampleResults[0];

  return (
    <div
      className="flex flex-col border-t bg-[var(--card-bg)] shrink-0 h-56 sm:h-64 select-none"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Tab Header */}
      <div className="flex items-center justify-between px-3 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onTabChange("sample")}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "sample"
                ? "border-cyan-500 text-cyan-400"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <span>Sample Tests</span>
            {sampleCount > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  samplePassed === sampleCount
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-rose-500/20 text-rose-400"
                }`}
              >
                {samplePassed}/{sampleCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onTabChange("hidden")}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "hidden"
                ? "border-cyan-500 text-cyan-400"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Hidden Tests</span>
            {hiddenSummary.total > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold bg-purple-500/20 text-purple-400">
                {hiddenSummary.passed}/{hiddenSummary.total}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onTabChange("console")}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "console"
                ? "border-cyan-500 text-cyan-400"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Console</span>
            {compileOutput && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-3 text-xs">
        {activeTab === "sample" && (
          <div className="h-full flex flex-col sm:flex-row gap-3">
            {sampleResults.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)]">
                <Terminal className="w-6 h-6 mb-1 opacity-50" />
                <p>Click "Run Tests" above to execute your solution against sample testcases.</p>
              </div>
            ) : (
              <>
                {/* Cases pill list */}
                <div className="flex sm:flex-col gap-1.5 overflow-x-auto sm:overflow-y-auto sm:w-44 shrink-0 pb-1 sm:pb-0">
                  {sampleResults.map((tc, idx) => {
                    const isPassed = tc.status === "ACCEPTED" || tc.passed;
                    const isSelected = selectedCaseIdx === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedCaseIdx(idx)}
                        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer text-left shrink-0 sm:w-full ${
                          isSelected
                            ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                            : "border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                        }`}
                      >
                        <span>Case {idx + 1}</span>
                        {isPassed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Selected Case Inspection */}
                {selectedCase && (
                  <div className="flex-1 rounded-xl border bg-[var(--bg-secondary)] p-3 overflow-y-auto space-y-2 font-mono text-xs" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[var(--text-primary)]">
                        Test Case {selectedCaseIdx + 1}:{" "}
                        <strong className={selectedCase.status === "ACCEPTED" || selectedCase.passed ? "text-emerald-400" : "text-rose-400"}>
                          {selectedCase.status === "ACCEPTED" || selectedCase.passed ? "Passed" : selectedCase.status || "Failed"}
                        </strong>
                      </span>
                      {selectedCase.timeMs !== undefined && (
                        <span className="text-[var(--text-muted)] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {selectedCase.timeMs} ms
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-[var(--text-muted)] block">Input:</span>
                      <pre className="p-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border)] whitespace-pre-wrap text-[var(--text-primary)]">
                        {selectedCase.input || "(Empty)"}
                      </pre>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-[var(--text-muted)] block">Expected Output:</span>
                        <pre className="p-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border)] whitespace-pre-wrap text-emerald-400">
                          {selectedCase.expected || "(Empty)"}
                        </pre>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-[var(--text-muted)] block">Your Output:</span>
                        <pre
                          className={`p-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border)] whitespace-pre-wrap ${
                            selectedCase.status === "ACCEPTED" || selectedCase.passed
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }`}
                        >
                          {selectedCase.actual || "(No output)"}
                        </pre>
                      </div>
                    </div>

                    {selectedCase.error && (
                      <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] whitespace-pre-wrap">
                        {selectedCase.error}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab 2: Hidden Tests Summary (Rule 22: Never reveals hidden inputs/outputs) */}
        {activeTab === "hidden" && (
          <div className="h-full flex flex-col justify-center items-center text-center p-4 space-y-3">
            <ShieldCheck className="w-8 h-8 text-purple-400" />
            <h4 className="text-sm font-bold text-[var(--text-primary)]">
              Official Hidden Test Suite
            </h4>

            {submissionData ? (
              <div className="p-4 rounded-2xl border bg-[var(--bg-secondary)] max-w-md w-full space-y-2" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Hidden Test Cases Passed:</span>
                  <span className="font-mono font-black text-sm text-purple-400">
                    {hiddenSummary.passed} / {hiddenSummary.total} Passed
                  </span>
                </div>
                <div className="w-full bg-[var(--input-bg)] h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all duration-500"
                    style={{
                      width: `${hiddenSummary.total > 0 ? (hiddenSummary.passed / hiddenSummary.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] pt-1">
                  {hiddenSummary.passed === hiddenSummary.total && hiddenSummary.total > 0
                    ? "🎉 All hidden test cases passed! Full marks awarded."
                    : "Some hidden test cases failed. Re-check edge cases, boundary values, and performance constraints."}
                </p>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)] max-w-sm">
                Hidden test cases are verified automatically upon clicking <strong>"Submit"</strong>. Per assessment security standards, hidden test case inputs are not disclosed.
              </p>
            )}
          </div>
        )}

        {/* Tab 3: Console / Compiler Output */}
        {activeTab === "console" && (
          <div className="h-full font-mono text-xs p-2 rounded-xl bg-[var(--bg-secondary)] border overflow-y-auto space-y-2" style={{ borderColor: "var(--border)" }}>
            {compileOutput ? (
              <div className="space-y-1">
                <span className="text-rose-400 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Compiler Error / Diagnostics:
                </span>
                <pre className="text-rose-400 whitespace-pre-wrap">{compileOutput}</pre>
              </div>
            ) : (
              <span className="text-[var(--text-muted)] italic">
                No compiler errors or diagnostics reported.
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
