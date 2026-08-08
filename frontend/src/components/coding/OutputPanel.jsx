import { useState, useRef, useCallback, useEffect } from "react";
import {
  CheckCircle2, XCircle, Clock, MemoryStick, Lock,
  ChevronDown, ChevronRight, AlertTriangle,
} from "lucide-react";

const TABS = ["Testcase", "Test Result", "Submissions"];

const TERMINAL_HEIGHT_KEY = "codingide_terminal_height";
const MIN_HEIGHT = 150;
const DEFAULT_HEIGHT = 250;
const MAX_HEIGHT_VH = 70;

function OutputPanel({
  activeTab = "Testcase",
  setActiveTab,
  data = {},
  testCases = [],
  submissions = [],
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

  const handleDragStart = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(true);
      dragStartRef.current = { startY: e.clientY, startHeight: panelHeight };
    },
    [panelHeight]
  );

  const handleDragMove = useCallback(
    (e) => {
      if (!isDragging) return;
      const maxH =
        typeof window !== "undefined"
          ? (window.innerHeight * MAX_HEIGHT_VH) / 100
          : 700;
      const diff =
        dragStartRef.current.startHeight -
        (e.clientY - dragStartRef.current.startY);
      const newHeight = Math.max(MIN_HEIGHT, Math.min(maxH, diff));
      setPanelHeight(newHeight);
      onResize && onResize();
    },
    [isDragging, onResize]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    try {
      localStorage.setItem(TERMINAL_HEIGHT_KEY, String(panelHeight));
    } catch {}
  }, [panelHeight]);

  const handleSeparatorDoubleClick = useCallback(() => {
    setPanelHeight(DEFAULT_HEIGHT);
    try {
      localStorage.setItem(TERMINAL_HEIGHT_KEY, String(DEFAULT_HEIGHT));
    } catch {}
    onResize && onResize();
  }, [onResize]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleDragMove);
      document.addEventListener("mouseup", handleDragEnd);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      return () => {
        document.removeEventListener("mousemove", handleDragMove);
        document.removeEventListener("mouseup", handleDragEnd);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  const hasResults = submit != null || run != null;

  return (
    <div
      className="flex flex-col"
      style={{
        background: "#1a1a2e",
        color: "#e2e8f0",
        borderTop: "1px solid #2d2d44",
      }}
    >
      {/* Drag separator */}
      <div
        onMouseDown={handleDragStart}
        onDoubleClick={handleSeparatorDoubleClick}
        className="shrink-0 flex items-center justify-center cursor-row-resize group"
        style={{
          height: "5px",
          background: isDragging ? "#6366f1" : "#2d2d44",
          transition: isDragging ? "none" : "background 0.15s",
        }}
        title="Drag to resize. Double-click to reset."
      >
        <div
          className="w-10 h-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: isDragging ? "#fff" : "#6b7280" }}
        />
      </div>

      {/* Tab bar */}
      <div
        className="flex items-center shrink-0"
        style={{
          background: "#16162a",
          borderBottom: "1px solid #2d2d44",
        }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className="relative px-4 py-2.5 text-[13px] font-medium cursor-pointer transition-colors"
              style={{
                color: active ? "#e2e8f0" : "#64748b",
                background: "transparent",
              }}
            >
              {tab}
              {active && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-[2px]"
                  style={{ background: "#6366f1" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          height: panelHeight,
          minHeight: 0,
          background: "#1a1a2e",
        }}
      >
        {/* Test Cases Tab */}
        {activeTab === "Testcase" && (
          <TestCasesContent
            testCases={testCases}
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
function TestCasesContent({ testCases, run, submit }) {
  const [expandedIdx, setExpandedIdx] = useState(null);

  const visibleCases = testCases.filter((tc) => !tc.isHidden);
  const hiddenCount = testCases.filter((tc) => tc.isHidden).length;

  return (
    <div className="p-3 space-y-2 text-[13px]">
      {visibleCases.length === 0 && (
        <p style={{ color: "#64748b" }}>No sample test cases available.</p>
      )}

      {visibleCases.map((tc, i) => (
        <div
          key={i}
          className="rounded-lg overflow-hidden"
          style={{ border: "1px solid #2d2d44" }}
        >
          <button
            type="button"
            onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer transition-colors"
            style={{
              background: expandedIdx === i ? "#16162a" : "#12122a",
              color: "#e2e8f0",
            }}
          >
            {expandedIdx === i ? (
              <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "#64748b" }} />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "#64748b" }} />
            )}
            <span className="font-medium">Case {i + 1}</span>
          </button>

          {expandedIdx === i && (
            <div className="px-3 py-2.5 space-y-2" style={{ background: "#12122a" }}>
              <div>
                <span
                  className="block text-[11px] uppercase tracking-wider mb-1 font-medium"
                  style={{ color: "#64748b" }}
                >
                  Input
                </span>
                <pre
                  className="font-mono text-[12px] whitespace-pre-wrap break-all p-2 rounded-md"
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
                  Expected Output
                </span>
                <pre
                  className="font-mono text-[12px] whitespace-pre-wrap break-all p-2 rounded-md"
                  style={{ background: "#1e1e3a", color: "#e2e8f0" }}
                >
                  {tc.expected || "(empty)"}
                </pre>
              </div>
            </div>
          )}
        </div>
      ))}

      {hiddenCount > 0 && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px]"
          style={{ background: "#16162a", color: "#64748b" }}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>
            + {hiddenCount} hidden test case{hiddenCount > 1 ? "s" : ""} will be
            evaluated against your code when you submit.
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
      <div className="flex items-center justify-center h-full gap-3 text-[13px]">
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
      <div className="flex flex-col items-center justify-center h-full gap-2 text-[13px]">
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
  const isError = run.type === "error";
  const isTimeout = run.type === "timeout";

  return (
    <div className="p-3 space-y-3 text-[13px]">
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium"
        style={{
          background: isError
            ? "rgba(239,68,68,0.1)"
            : isTimeout
            ? "rgba(234,179,8,0.1)"
            : "rgba(34,197,94,0.1)",
          border: `1px solid ${
            isError
              ? "rgba(239,68,68,0.25)"
              : isTimeout
              ? "rgba(234,179,8,0.25)"
              : "rgba(34,197,94,0.25)"
          }`,
        }}
      >
        {isError ? (
          <>
            <XCircle className="w-4 h-4" style={{ color: "#ef4444" }} />
            <span style={{ color: "#ef4444" }}>Runtime Error</span>
          </>
        ) : isTimeout ? (
          <>
            <Clock className="w-4 h-4" style={{ color: "#eab308" }} />
            <span style={{ color: "#eab308" }}>Time Limit Exceeded</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4" style={{ color: "#22c55e" }} />
            <span style={{ color: "#22c55e" }}>Accepted</span>
          </>
        )}
      </div>

      {run.output && (
        <div>
          <span
            className="block text-[11px] uppercase tracking-wider mb-1 font-medium"
            style={{ color: "#64748b" }}
          >
            Output
          </span>
          <pre
            className="font-mono text-[12px] whitespace-pre-wrap break-all p-2.5 rounded-md"
            style={{
              background: "#1e1e3a",
              color: isError ? "#fca5a5" : "#e2e8f0",
            }}
          >
            {run.output}
          </pre>
        </div>
      )}

      {run.timeMs > 0 && (
        <div className="flex items-center gap-1.5 text-[12px]" style={{ color: "#64748b" }}>
          <Clock className="w-3.5 h-3.5" />
          <span>Runtime: {run.timeMs} ms</span>
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
  };

  const cfg = statusConfig[submit.status] || statusConfig.failed;
  const results = submit.results || [];
  const visibleResults = results.filter((r) => !r.isHidden);
  const hiddenResults = results.filter((r) => r.isHidden);
  const passedCount = submit.passedCount ?? results.filter((r) => r.passed).length;
  const totalCount = submit.totalCount ?? results.length;

  return (
    <div className="p-3 space-y-3 text-[13px]">
      {/* Status banner */}
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg font-semibold text-[14px]"
        style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
      >
        <span style={{ color: cfg.color }}>{cfg.icon}</span>
        <span style={{ color: cfg.color }}>{cfg.label}</span>
        <span className="ml-auto text-[12px] font-normal" style={{ color: "#94a3b8" }}>
          {passedCount}/{totalCount} test cases passed
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

      {/* Failed test case details */}
      {visibleResults.filter((r) => !r.passed).length > 0 && (
        <div className="space-y-1.5">
          <span
            className="block text-[11px] uppercase tracking-wider font-medium"
            style={{ color: "#64748b" }}
          >
            Failed Test Cases
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
      {submit.status === "compile_error" && submit.compileError && (
        <div>
          <span
            className="block text-[11px] uppercase tracking-wider mb-1 font-medium"
            style={{ color: "#64748b" }}
          >
            Compiler Output
          </span>
          <pre
            className="font-mono text-[12px] whitespace-pre-wrap break-all p-2.5 rounded-md"
            style={{ background: "#1e1e3a", color: "#fca5a5" }}
          >
            {submit.compileError}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ─── Test Result Row (for failed cases in submit) ─────────────────────── */
function TestResultRow({ tc, index, expanded, onToggle }) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: "1px solid #2d2d44" }}
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
        <XCircle className="w-3.5 h-3.5 shrink-0" style={{ color: "#ef4444" }} />
        <span className="font-medium">Case {tc.index || index + 1}</span>
        <span style={{ color: "#ef4444" }}>— Failed</span>
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
                className="font-mono text-[12px] whitespace-pre-wrap break-all p-2.5 rounded-md"
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
                  className="font-mono text-[12px] whitespace-pre-wrap break-all p-2 rounded-md"
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
                  className="font-mono text-[12px] whitespace-pre-wrap break-all p-2 rounded-md"
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
                  className="font-mono text-[12px] whitespace-pre-wrap break-all p-2 rounded-md"
                  style={{ background: "#1e1e3a", color: "#f87171" }}
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
                      : sub.status === "compile_error"
                      ? "Compile Error"
                      : sub.status === "runtime_error"
                      ? "Runtime Error"
                      : sub.status === "time_limit"
                      ? "Time Limit Exceeded"
                      : sub.status === "memory_limit"
                      ? "Memory Limit Exceeded"
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
                              className="font-mono text-[11px] whitespace-pre-wrap"
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
