import { useState, useRef, useCallback } from "react";
import {
  CheckCircle2, XCircle, Clock, MemoryStick, Lock,
  ChevronDown, ChevronRight, AlertTriangle,
} from "lucide-react";

const TABS = ["Testcase", "Test Result", "Submissions"];

const TERMINAL_HEIGHT_KEY = "codingide_terminal_height";
const MIN_HEIGHT = 100;
const DEFAULT_HEIGHT = 180;
const MAX_HEIGHT_VH = 70;

function OutputPanel({
  activeTab = "Testcase",
  setActiveTab,
  data = {},
  testCases = [],
  submissions = [],
  selectedCaseIndex = 0,
  onSelectCase,
  customInput = "",
  onCustomInputChange,
  isCustomInput = false,
  onToggleCustomInput,
  runStage = null,
  running = false,
  submitting = false,
  onResize,
}) {
  const { run, submit } = data;

  const [panelHeight, setPanelHeight] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem(TERMINAL_HEIGHT_KEY), 10);
      return saved >= MIN_HEIGHT ? saved : DEFAULT_HEIGHT;
    } catch {
      return DEFAULT_HEIGHT;
    }
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ startY: 0, startHeight: 0 });
  const panelRef = useRef(null);

  const clampH = (v) => {
    let maxH =
      typeof window !== "undefined" ? (window.innerHeight * MAX_HEIGHT_VH) / 100 : 700;
    const parent = panelRef.current?.parentElement;
    if (parent) {
      const available = parent.clientHeight - 130; // toolbar + min editor + chrome
      if (available > MIN_HEIGHT) maxH = Math.min(maxH, available);
    }
    return Math.max(MIN_HEIGHT, Math.min(maxH, v));
  };

  // ── Pointer-event based resize (VS Code-like draggable divider) ──
  const handleResizeStart = useCallback(
    (e) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      dragStartRef.current = { startY: e.clientY, startHeight: panelHeight };
      setIsDragging(true);
    },
    [panelHeight]
  );

  const handleResizeMove = useCallback(
    (e) => {
      if (!isDragging) return;
      const delta = dragStartRef.current.startY - e.clientY;
      const newHeight = clampH(dragStartRef.current.startHeight + delta);
      setPanelHeight(newHeight);
      onResize && onResize();
    },
    [isDragging, onResize]
  );

  const handleResizeEnd = useCallback(
    (e) => {
      if (!isDragging) return;
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      try {
        localStorage.setItem(TERMINAL_HEIGHT_KEY, String(panelHeight));
      } catch {}
    },
    [isDragging, panelHeight]
  );

  const handleSeparatorDoubleClick = useCallback(() => {
    setPanelHeight(DEFAULT_HEIGHT);
    try {
      localStorage.setItem(TERMINAL_HEIGHT_KEY, String(DEFAULT_HEIGHT));
    } catch {}
    onResize && onResize();
  }, [onResize]);

  return (
    <div
      ref={panelRef}
      className="flex flex-col"
      style={{
        flexShrink: 0,
        background: "rgba(10, 14, 26, 0.95)",
        color: "#e2e8f0",
        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
        userSelect: isDragging ? "none" : "auto",
        cursor: isDragging ? "row-resize" : "default",
      }}
    >
      {/* Drag separator */}
      <div
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        onPointerCancel={handleResizeEnd}
        onDoubleClick={handleSeparatorDoubleClick}
        className="shrink-0 flex items-center justify-center cursor-row-resize group touch-none select-none hover:bg-[#FF6B35]/20 transition-colors"
        style={{
          height: "8px",
          background: isDragging ? "#FF6B35" : "rgba(255, 255, 255, 0.06)",
        }}
        title="Drag to resize terminal. Double-click to reset."
      >
        <div
          className="flex items-center gap-[3px] opacity-60 group-hover:opacity-100 transition-opacity"
          style={{ color: isDragging ? "#fff" : "rgba(255, 255, 255, 0.6)" }}
        >
          <span className="block w-[3px] h-[3px] rounded-full" style={{ background: "currentColor" }} />
          <span className="block w-[3px] h-[3px] rounded-full" style={{ background: "currentColor" }} />
          <span className="block w-[3px] h-[3px] rounded-full" style={{ background: "currentColor" }} />
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="flex items-center shrink-0"
        style={{
          background: "rgba(10, 14, 26, 0.95)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className="relative px-4 py-2.5 text-xs font-semibold cursor-pointer transition-colors"
              style={{
                color: active ? "#ffffff" : "rgba(255, 255, 255, 0.5)",
                background: "transparent",
              }}
            >
              {tab}
              {active && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-[2px]"
                  style={{ background: "#FF6B35" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div
        className="overflow-y-auto overflow-x-auto"
        style={{
          height: panelHeight,
          flex: "0 0 auto",
          minHeight: 0,
          background: "rgba(8, 11, 20, 0.98)",
        }}
      >
        {/* Test Cases Tab */}
        {activeTab === "Testcase" && (
          <TestCasesContent
            testCases={testCases}
            selectedCaseIndex={selectedCaseIndex}
            onSelectCase={onSelectCase}
            customInput={customInput}
            onCustomInputChange={onCustomInputChange}
            isCustomInput={isCustomInput}
            onToggleCustomInput={onToggleCustomInput}
            run={run}
            submit={submit}
          />
        )}

        {/* Test Result Tab */}
        {activeTab === "Test Result" && (
          <TestResultContent
            run={run}
            submit={submit}
            runStage={runStage}
            running={running}
            submitting={submitting}
          />
        )}

        {/* Submissions Tab */}
        {activeTab === "Submissions" && (
          <SubmissionsContent
            submissions={submissions}
            setActiveTab={setActiveTab}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Test Cases Content ───────────────────────────────────────────────── */
function TestCasesContent({
  testCases = [],
  selectedCaseIndex = 0,
  onSelectCase,
  customInput = "",
  onCustomInputChange,
  isCustomInput = false,
  onToggleCustomInput,
}) {
  const visibleCases = testCases.filter((tc) => !tc.isHidden);
  const hiddenCount = testCases.filter((tc) => tc.isHidden).length;

  const activeIdx = Math.max(0, Math.min(selectedCaseIndex, Math.max(0, visibleCases.length - 1)));
  const activeCase = visibleCases[activeIdx] || null;

  return (
    <div className="p-3.5 space-y-3 text-[13px]">
      {/* Case Selection Tabs */}
      <div className="flex items-center gap-2 flex-wrap border-b border-white/10 pb-2.5">
        {visibleCases.map((tc, idx) => {
          const isSelected = !isCustomInput && activeIdx === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onToggleCustomInput?.(false);
                onSelectCase?.(idx);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                isSelected
                  ? "bg-[#FF6B35]/20 text-[#FF6B35] border border-[#FF6B35]/40 shadow-sm"
                  : "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-transparent"
              }`}
            >
              Case {idx + 1}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onToggleCustomInput?.(!isCustomInput)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
            isCustomInput
              ? "bg-[#FF6B35]/20 text-[#FF6B35] border border-[#FF6B35]/40 shadow-sm"
              : "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-transparent"
          }`}
        >
          Custom Input
        </button>
      </div>

      {/* Case Details / Custom Input Area */}
      {isCustomInput ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
              Custom Standard Input (stdin)
            </span>
            <span className="text-[10px] text-slate-500">Will be passed to your program as stdin</span>
          </div>
          <textarea
            value={customInput}
            onChange={(e) => onCustomInputChange?.(e.target.value)}
            placeholder="Enter custom input to pass via stdin (e.g. 9 -2 1 -3 4 -1 2 1 -5 4)..."
            rows={3}
            className="w-full bg-[#12122a] border border-white/15 rounded-lg p-2.5 font-mono text-xs text-white placeholder:text-slate-500 outline-none focus:border-[#FF6B35] transition"
          />
        </div>
      ) : activeCase ? (
        <div className="space-y-2.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                Input (stdin)
              </span>
              <span className="text-[10px] text-slate-500">Passed as stdin on Run</span>
            </div>
            <pre className="font-mono text-xs whitespace-pre-wrap p-2.5 rounded-lg bg-[#12122a] border border-white/10 text-emerald-300">
              {activeCase.input || "(empty input)"}
            </pre>
          </div>

          <div>
            <span className="block text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-1">
              Expected Output
            </span>
            <pre className="font-mono text-xs whitespace-pre-wrap p-2.5 rounded-lg bg-[#12122a] border border-white/10 text-sky-300">
              {activeCase.expected || activeCase.expectedOutput || activeCase.output || "(empty output)"}
            </pre>
          </div>
        </div>
      ) : (
        <div className="py-4 text-center space-y-1">
          <p className="text-xs font-semibold text-slate-400">No test cases defined</p>
          <p className="text-[11px] text-slate-500">You can use Custom Input to test your solution.</p>
        </div>
      )}

      {hiddenCount > 0 && !isCustomInput && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ background: "#16162a", color: "#64748b" }}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>
            + {hiddenCount} hidden test case{hiddenCount > 1 ? "s" : ""} will be evaluated on Submit.
          </span>
        </div>
      )}
    </div>
  );
}

/* ─── Test Result Content ──────────────────────────────────────────────── */
function TestResultContent({ run, submit, runStage, running, submitting }) {
  if (runStage) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-[13px] py-6">
        <div
          className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "#6366f1", borderTopColor: "transparent" }}
        />
        <span style={{ color: "#94a3b8" }}>{runStage}</span>
      </div>
    );
  }

  if (!run && !submit) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-[13px] py-6">
        <AlertTriangle className="w-5 h-5" style={{ color: "#64748b" }} />
        <span style={{ color: "#64748b" }}>
          Run or submit your code to see results here.
        </span>
      </div>
    );
  }

  if (submit) return <SubmitResult submit={submit} />;
  if (run) return <RunResult run={run} />;
  return null;
}

/* ─── Run Result ───────────────────────────────────────────────────────── */
function RunResult({ run }) {
  const isError =
    run.type === "error" ||
    run.status === "error" ||
    run.status === "runtime_error" ||
    run.status === "compile_error";
  const isTimeout = run.type === "timeout" || run.status === "time_limit";
  const isWrongAnswer =
    run.status === "wrong_answer" ||
    run.type === "wrong_answer" ||
    (run.passed === false && !isError && !isTimeout);
  const isAccepted = !isError && !isTimeout && !isWrongAnswer;

  return (
    <div className="p-3.5 space-y-3 text-[13px]">
      {/* Status Banner */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-lg font-semibold text-[13px]"
        style={{
          background: isError
            ? "rgba(239,68,68,0.1)"
            : isTimeout
            ? "rgba(234,179,8,0.1)"
            : isWrongAnswer
            ? "rgba(239,68,68,0.1)"
            : "rgba(34,197,94,0.1)",
          border: `1px solid ${
            isError
              ? "rgba(239,68,68,0.25)"
              : isTimeout
              ? "rgba(234,179,8,0.25)"
              : isWrongAnswer
              ? "rgba(239,68,68,0.25)"
              : "rgba(34,197,94,0.25)"
          }`,
        }}
      >
        {isError ? (
          <>
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-red-400">
              {run.status === "compile_error" ? "Compilation Error" : "Runtime Error"}
            </span>
          </>
        ) : isTimeout ? (
          <>
            <Clock className="w-4 h-4 text-yellow-500" />
            <span className="text-yellow-400">Time Limit Exceeded</span>
          </>
        ) : isWrongAnswer ? (
          <>
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-red-400">Wrong Answer</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-emerald-400">Accepted</span>
          </>
        )}

        {run.timeMs > 0 && (
          <span className="ml-auto text-xs font-normal text-slate-400">
            Runtime: {run.timeMs} ms
          </span>
        )}
      </div>

      {/* Input */}
      {run.input !== undefined && run.input !== null && run.input !== "" && (
        <div>
          <span className="block text-[11px] uppercase tracking-wider mb-1 font-semibold text-slate-400">
            Input (stdin)
          </span>
          <pre className="font-mono text-xs whitespace-pre-wrap p-2.5 rounded-lg bg-[#12122a] border border-white/10 text-emerald-300">
            {run.input}
          </pre>
        </div>
      )}

      {/* Output */}
      {run.output !== undefined && run.output !== null && (
        <div>
          <span className="block text-[11px] uppercase tracking-wider mb-1 font-semibold text-slate-400">
            Your Output
          </span>
          <pre
            className="font-mono text-xs whitespace-pre-wrap p-2.5 rounded-lg bg-[#12122a] border border-white/10"
            style={{ color: isError ? "#fca5a5" : "#e2e8f0" }}
          >
            {run.stdout || run.output || "(no output)"}
          </pre>
        </div>
      )}

      {/* Expected Output if available */}
      {run.expectedOutput && (
        <div>
          <span className="block text-[11px] uppercase tracking-wider mb-1 font-semibold text-slate-400">
            Expected Output
          </span>
          <pre className="font-mono text-xs whitespace-pre-wrap p-2.5 rounded-lg bg-[#12122a] border border-white/10 text-sky-300">
            {run.expectedOutput}
          </pre>
        </div>
      )}

      {/* Compiler / Error Stderr */}
      {(run.compileOutput || run.stderr) && (
        <div>
          <span className="block text-[11px] uppercase tracking-wider mb-1 font-semibold text-red-400">
            {run.compileOutput ? "Compiler Output" : "Error Log / Stderr"}
          </span>
          <pre className="font-mono text-xs whitespace-pre-wrap p-2.5 rounded-lg bg-[#1e1015] border border-red-500/20 text-red-300">
            {run.compileOutput || run.stderr}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ─── Submit Result ────────────────────────────────────────────────────── */
function SubmitResult({ submit }) {
  const [expandedIdx, setExpandedIdx] = useState(null);

  const statusConfig = {
    accepted: {
      color: "#22c55e",
      bg: "rgba(34,197,94,0.1)",
      border: "rgba(34,197,94,0.25)",
      label: "Accepted",
      icon: <CheckCircle2 className="w-5 h-5" />,
    },
    completed: {
      color: "#22c55e",
      bg: "rgba(34,197,94,0.1)",
      border: "rgba(34,197,94,0.25)",
      label: "Accepted",
      icon: <CheckCircle2 className="w-5 h-5" />,
    },
    success: {
      color: "#22c55e",
      bg: "rgba(34,197,94,0.1)",
      border: "rgba(34,197,94,0.25)",
      label: "Accepted",
      icon: <CheckCircle2 className="w-5 h-5" />,
    },
    wrong: {
      color: "#ef4444",
      bg: "rgba(239,68,68,0.1)",
      border: "rgba(239,68,68,0.25)",
      label: "Wrong Answer",
      icon: <XCircle className="w-5 h-5" />,
    },
    failed: {
      color: "#ef4444",
      bg: "rgba(239,68,68,0.1)",
      border: "rgba(239,68,68,0.25)",
      label: "Wrong Answer",
      icon: <XCircle className="w-5 h-5" />,
    },
    wrong_answer: {
      color: "#ef4444",
      bg: "rgba(239,68,68,0.1)",
      border: "rgba(239,68,68,0.25)",
      label: "Wrong Answer",
      icon: <XCircle className="w-5 h-5" />,
    },
    compile_error: {
      color: "#ef4444",
      bg: "rgba(239,68,68,0.1)",
      border: "rgba(239,68,68,0.25)",
      label: "Compilation Error",
      icon: <XCircle className="w-5 h-5" />,
    },
    runtime_error: {
      color: "#ef4444",
      bg: "rgba(239,68,68,0.1)",
      border: "rgba(239,68,68,0.25)",
      label: "Runtime Error",
      icon: <XCircle className="w-5 h-5" />,
    },
    time_limit: {
      color: "#eab308",
      bg: "rgba(234,179,8,0.1)",
      border: "rgba(234,179,8,0.25)",
      label: "Time Limit Exceeded",
      icon: <Clock className="w-5 h-5" />,
    },
    memory_limit: {
      color: "#eab308",
      bg: "rgba(234,179,8,0.1)",
      border: "rgba(234,179,8,0.25)",
      label: "Memory Limit Exceeded",
      icon: <MemoryStick className="w-5 h-5" />,
    },
    unsupported: {
      color: "#94a3b8",
      bg: "rgba(148,163,184,0.1)",
      border: "rgba(148,163,184,0.25)",
      label: "Unsupported Language",
      icon: <AlertTriangle className="w-5 h-5" />,
    },
    execution_error: {
      color: "#f97316",
      bg: "rgba(249,115,22,0.1)",
      border: "rgba(249,115,22,0.25)",
      label: "Execution Error",
      icon: <AlertTriangle className="w-5 h-5" />,
    },
  };

  const results = submit.results || [];
  const visibleResults = results.filter((r) => !r.isHidden);
  const hiddenResults = results.filter((r) => r.isHidden);
  const passedCount = submit.passedCount ?? results.filter((r) => r.passed).length;
  const totalCount = submit.totalCount ?? results.length;

  const isCompileError = submit.status === "compile_error" || Boolean(submit.compileError) || (Boolean(submit.compileOutput) && passedCount === 0);
  const isRuntimeError = submit.status === "runtime_error";
  const isTimeLimit = submit.status === "time_limit";
  const isMemoryLimit = submit.status === "memory_limit";
  const isAllPassed = passedCount === totalCount && totalCount > 0 && !isCompileError && !isRuntimeError && !isTimeLimit && !isMemoryLimit;

  let cfg = statusConfig[submit.status] || statusConfig.failed;
  if (isAllPassed) {
    cfg = statusConfig.accepted;
  } else if (isCompileError) {
    cfg = statusConfig.compile_error;
  } else if (isRuntimeError) {
    cfg = statusConfig.runtime_error;
  } else if (isTimeLimit) {
    cfg = statusConfig.time_limit;
  } else if (isMemoryLimit) {
    cfg = statusConfig.memory_limit;
  } else if (passedCount > 0 && totalCount > 0) {
    cfg = {
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.1)",
      border: "rgba(245,158,11,0.25)",
      label: `Partial Solution (${passedCount}/${totalCount} Passed)`,
      icon: <AlertTriangle className="w-5 h-5" />,
    };
  } else {
    cfg = statusConfig.wrong;
  }

  return (
    <div className="p-3 space-y-3 text-[13px]" style={{ minWidth: "fit-content" }}>
      {/* Status banner */}
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg font-semibold text-[14px]"
        style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
      >
        <span style={{ color: cfg.color }}>{cfg.icon}</span>
        <span style={{ color: cfg.color }}>{cfg.label}</span>
        <span className="ml-auto text-[12px] font-normal" style={{ color: "#94a3b8" }}>
          {passedCount}/{totalCount} test cases passed ({totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0}%)
        </span>
      </div>

      {/* Runtime & Memory */}
      <div className="flex items-center gap-4 text-[12px]" style={{ color: "#94a3b8" }}>
        {submit.timeMs > 0 && (
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {submit.timeMs} ms
          </span>
        )}
        {submit.memory && (
          <span className="flex items-center gap-1.5">
            <MemoryStick className="w-3.5 h-3.5" />
            {submit.memory} KB
          </span>
        )}
      </div>

      {/* Test case details */}
      {visibleResults.length > 0 && (
        <div className="space-y-1.5">
          <span
            className="block text-[11px] uppercase tracking-wider font-medium"
            style={{ color: "#64748b" }}
          >
            Test Case Results
          </span>
          {visibleResults.map((tc, i) => (
            <TestResultRow
              key={tc.index || i}
              tc={tc}
              index={i}
              expanded={expandedIdx === i}
              onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
            />
          ))}
        </div>
      )}

      {/* All passed message */}
      {visibleResults.filter((r) => !r.passed).length === 0 &&
        visibleResults.length > 0 && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px]"
            style={{
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.2)",
            }}
          >
            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#22c55e" }} />
            <span style={{ color: "#22c55e" }}>
              All visible test cases passed!
            </span>
          </div>
        )}

      {/* Hidden test cases indicator */}
      {hiddenResults.length > 0 && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px]"
          style={{ background: "#16162a", color: "#64748b" }}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>
            + {hiddenResults.length} hidden test case
            {hiddenResults.length > 1 ? "s" : ""} evaluated.
          </span>
        </div>
      )}

      {/* Compile error output */}
      {(submit.status === "compile_error" || submit.status === "execution_error") && (submit.compileOutput || submit.compileError) && (
        <div>
          <span
            className="block text-[11px] uppercase tracking-wider mb-1 font-medium"
            style={{ color: "#64748b" }}
          >
            {submit.status === "execution_error" ? "Error Output" : "Compiler Output"}
          </span>
          <pre
            className="font-mono text-[12px] whitespace-pre p-2.5 rounded-md"
            style={{ background: "#1e1e3a", color: "#fca5a5" }}
          >
            {submit.compileOutput || submit.compileError}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ─── Test Result Row (shows both passed and failed cases) ─────────────── */
function TestResultRow({ tc, index, expanded, onToggle }) {
  const isPassed = Boolean(tc.passed);

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: `1px solid ${isPassed ? "rgba(34,197,94,0.2)" : "#2d2d44"}` }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer transition-colors"
        style={{
          background: expanded ? "#16162a" : "#12122a",
          color: "#e2e8f0",
        }}
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "#64748b" }} />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "#64748b" }} />
        )}
        {isPassed ? (
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: "#22c55e" }} />
        ) : (
          <XCircle className="w-3.5 h-3.5 shrink-0" style={{ color: "#ef4444" }} />
        )}
        <span className="font-medium">Case {tc.index || index + 1}</span>
        <span style={{ color: isPassed ? "#22c55e" : "#ef4444" }}>
          — {isPassed ? "Passed" : "Failed"}
        </span>
      </button>

      {expanded && (
        <div className="px-3 py-2.5 space-y-2" style={{ background: "#12122a" }}>
          {tc.error ? (
            <div>
              <span
                className="block text-[11px] uppercase tracking-wider mb-1 font-medium"
                style={{ color: "#64748b" }}
              >
                Error
              </span>
              <pre
                className="font-mono text-[12px] whitespace-pre p-2.5 rounded-md"
                style={{ background: "#1e1e3a", color: "#fca5a5" }}
              >
                {tc.error}
              </pre>
            </div>
          ) : (
            <>
              <div>
                <span
                  className="block text-[11px] uppercase tracking-wider mb-1 font-medium"
                  style={{ color: "#64748b" }}
                >
                  Input
                </span>
                <pre
                  className="font-mono text-[12px] whitespace-pre p-2 rounded-md"
                  style={{ background: "#1e1e3a", color: "#e2e8f0" }}
                >
                  {tc.input || "(empty)"}
                </pre>
              </div>
              <div>
                <span
                  className="block text-[11px] uppercase tracking-wider mb-1 font-medium"
                  style={{ color: "#64748b" }}
                >
                  Expected
                </span>
                <pre
                  className="font-mono text-[12px] whitespace-pre p-2 rounded-md"
                  style={{ background: "#1e1e3a", color: "#93c5fd" }}
                >
                  {tc.expected || "(empty)"}
                </pre>
              </div>
              <div>
                <span
                  className="block text-[11px] uppercase tracking-wider mb-1 font-medium"
                  style={{ color: "#64748b" }}
                >
                  Actual
                </span>
                <pre
                  className="font-mono text-[12px] whitespace-pre p-2 rounded-md"
                  style={{ background: "#1e1e3a", color: isPassed ? "#4ade80" : "#f87171" }}
                >
                  {String(tc.actual ?? "(no output)")}
                </pre>
              </div>
            </>
          )}

          {tc.timeMs > 0 && (
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "#64748b" }}>
              <Clock className="w-3 h-3" />
              <span>{tc.timeMs} ms</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Submissions Content ──────────────────────────────────────────────── */
function SubmissionsContent({ submissions, setActiveTab }) {
  const [selectedIdx, setSelectedIdx] = useState(null);

  if (submissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-[13px]">
        <span style={{ color: "#64748b" }}>
          No submissions yet for this problem.
        </span>
      </div>
    );
  }

  const selectedSub = selectedIdx !== null ? submissions[selectedIdx] : null;

  return (
    <div className="flex flex-col h-full text-[13px]">
      {/* Table header */}
      <div
        className="flex items-center px-3 py-2 text-[11px] uppercase tracking-wider font-medium shrink-0"
        style={{
          background: "#16162a",
          borderBottom: "1px solid #2d2d44",
          color: "#64748b",
        }}
      >
        <span className="w-10 text-center">#</span>
        <span className="flex-1">Status</span>
        <span className="w-20 text-right">Runtime</span>
        <span className="w-20 text-right">Memory</span>
        <span className="w-24 text-right">Language</span>
        <span className="w-32 text-right">Submitted</span>
      </div>

      {/* Table body */}
      <div className="flex-1 overflow-y-auto">
        {submissions.map((sub, idx) => {
          const isAccepted = sub.status === "accepted";
          const isSelected = selectedIdx === idx;

          return (
            <div key={sub._id || idx}>
              <button
                type="button"
                onClick={() => setSelectedIdx(isSelected ? null : idx)}
                className="w-full flex items-center px-3 py-2 cursor-pointer transition-colors text-left"
                style={{
                  background: isSelected
                    ? "#16162a"
                    : idx % 2 === 0
                    ? "#1a1a2e"
                    : "#15152a",
                  borderBottom: "1px solid #1e1e3a",
                }}
              >
                <span className="w-10 text-center text-[12px]" style={{ color: "#64748b" }}>
                  {idx + 1}
                </span>
                <span className="flex-1 flex items-center gap-1.5">
                  {isAccepted ? (
                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#22c55e" }} />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" style={{ color: "#ef4444" }} />
                  )}
                  <span
                    className="font-medium capitalize"
                    style={{ color: isAccepted ? "#22c55e" : "#ef4444" }}
                  >
                    {sub.status === "accepted"
                      ? "Accepted"
                      : sub.status === "wrong"
                      ? "Wrong Answer"
                      : sub.status === "failed"
                      ? "Wrong Answer"
                      : sub.status === "compile_error"
                      ? "Compile Error"
                      : sub.status === "runtime_error"
                      ? "Runtime Error"
                      : sub.status === "time_limit"
                      ? "Time Limit Exceeded"
                      : sub.status === "memory_limit"
                      ? "Memory Limit Exceeded"
                      : sub.status === "execution_error"
                      ? "Execution Error"
                      : sub.status}
                  </span>
                </span>
                <span
                  className="w-20 text-right text-[12px]"
                  style={{ color: "#94a3b8" }}
                >
                  {sub.timeMs > 0 ? `${sub.timeMs} ms` : "—"}
                </span>
                <span
                  className="w-20 text-right text-[12px]"
                  style={{ color: "#94a3b8" }}
                >
                  {sub.memory ? `${sub.memory} KB` : "—"}
                </span>
                <span
                  className="w-24 text-right text-[12px] capitalize"
                  style={{ color: "#94a3b8" }}
                >
                  {sub.language}
                </span>
                <span
                  className="w-32 text-right text-[11px]"
                  style={{ color: "#64748b" }}
                >
                  {formatTimestamp(sub.createdAt)}
                </span>
              </button>

              {/* Expanded submission detail */}
              {isSelected && selectedSub && (
                <div
                  className="px-4 py-3 space-y-2"
                  style={{
                    background: "#12122a",
                    borderBottom: "1px solid #2d2d44",
                  }}
                >
                  <div className="flex items-center gap-4 text-[12px]" style={{ color: "#94a3b8" }}>
                    <span className="font-medium" style={{ color: isAccepted ? "#22c55e" : "#ef4444" }}>
                      {selectedSub.status === "accepted" ? "Accepted" : selectedSub.status}
                    </span>
                    <span>
                      {selectedSub.passedCount}/{selectedSub.totalCount} test cases passed
                    </span>
                    {selectedSub.timeMs > 0 && <span>{selectedSub.timeMs} ms</span>}
                    {selectedSub.memory && <span>{selectedSub.memory} KB</span>}
                  </div>

                  {/* Show failed test details if available */}
                  {selectedSub.results &&
                    selectedSub.results
                      .filter((r) => !r.passed && !r.isHidden)
                      .slice(0, 3)
                      .map((tc, ti) => (
                        <div
                          key={ti}
                          className="rounded-md p-2 text-[12px] space-y-1"
                          style={{
                            background: "rgba(239,68,68,0.06)",
                            border: "1px solid rgba(239,68,68,0.15)",
                          }}
                        >
                          <span style={{ color: "#ef4444", fontWeight: 500 }}>
                            Case {tc.index || ti + 1} failed
                          </span>
                          {tc.error && (
                            <pre
                              className="font-mono text-[11px] whitespace-pre"
                              style={{ color: "#fca5a5" }}
                            >
                              {tc.error}
                            </pre>
                          )}
                        </div>
                      ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */
function formatTimestamp(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default OutputPanel;
