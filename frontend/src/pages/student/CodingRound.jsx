import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  Play, Send, Loader2, Check, CheckCircle2, Maximize2, Minimize2, Copy,
  Timer, AlertTriangle, ChevronDown,
  Code2, Save, Split, RefreshCw, ArrowLeft,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import { useTheme } from "../../hooks/useTheme";
import MonacoCodeEditor from "../../components/coding/MonacoCodeEditor";
import OutputPanel from "../../components/coding/OutputPanel";
import ProblemDescription from "../../components/coding/ProblemDescription";
import { explainError } from "../../utils/coding/errorExplanations";
import useLinter from "../../utils/coding/useLinter";

const FULLSCREEN_KEY = "codingide_fullscreen";

function supportsFullscreen() {
  return !!(
    document.fullscreenEnabled ||
    document.webkitFullscreenEnabled ||
    document.mozFullScreenEnabled ||
    document.msFullscreenEnabled
  );
}

function requestFullscreen(el) {
  if (el.requestFullscreen) return el.requestFullscreen();
  if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
  if (el.mozRequestFullScreen) return el.mozRequestFullScreen();
  if (el.msRequestFullscreen) return el.msRequestFullscreen();
  return Promise.reject(new Error("Fullscreen API not supported"));
}

function exitFullscreenAPI() {
  if (document.exitFullscreen) return document.exitFullscreen();
  if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
  if (document.mozCancelFullScreen) return document.mozCancelFullScreen();
  if (document.msExitFullscreen) return document.msExitFullscreen();
  return Promise.resolve();
}

function getFullscreenElement() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );
}

const LANGUAGES = [
  { id: "python",     label: "Python",     ext: "py" },
  { id: "java",       label: "Java",       ext: "java" },
  { id: "c",          label: "C",          ext: "c" },
  { id: "cpp",        label: "C++",        ext: "cpp" },
];

const STARTER_CODE = {
  python: `def solution(*args):
    """
    Write your solution here.
    """
    pass`,
  java: `import java.util.*;

public class Solution {
    public static Object solve(Object... args) {
        // Write your solution here
        return null;
    }

    public static void main(String[] args) {
        // Test your solution
        System.out.println(solve());
    }
}`,
  c: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Write your solution here
int main() {
    // Read input and print output
    return 0;
}`,
  cpp: `#include <bits/stdc++.h>
using namespace std;

// Write your solution here
int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    // Read input and print output

    return 0;
}`,
};



function CodingRound() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const token = getAuthToken();
  const headers = useMemo(() => token ? { Authorization: `Bearer ${token}` } : {}, [token]);

  // ─── Data state ─────────────────────────────────────────────────────────────
  const [questions, setQuestions]       = useState([]);
  const [activeIndex, setActiveIndex]   = useState(0);
  const [solved, setSolved]             = useState(new Set());
  const [submissions, setSubmissions]   = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [questionsError, setQuestionsError]     = useState(false);

  // ─── Editor state ───────────────────────────────────────────────────────────
  const [code, setCode]                 = useState("");
  const [language, setLanguage]         = useState("python");
  const [customInput, setCustomInput]   = useState("");
  const [output, setOutput]             = useState(null);
  const [bottomTab, setBottomTab]       = useState("Testcase");
  const [splitView, setSplitView]       = useState(false);
  const [fullscreen, setFullscreen]     = useState(() => {
    try { return localStorage.getItem(FULLSCREEN_KEY) === "true"; } catch { return false; }
  });
  const [draftState, setDraftState]     = useState("idle");
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [langDropOpen, setLangDropOpen] = useState(false);
  const [copied, setCopied]             = useState(false);
  const [running, setRunning]           = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [runStage, setRunStage]         = useState(null);
  const [editorInstance, setEditorInstance] = useState({ editor: null, monaco: null });
  const [debugMode, setDebugMode]       = useState(false);
  const [debugLine, setDebugLine]       = useState(null);

  const draftTimerRef = useRef(null);
  const codeRef       = useRef(code);
  const langDropRef   = useRef(null);
  const startTime     = useRef(Date.now());
  const elapsedIntervalRef = useRef(null);
  const abortControllerRef = useRef(null);

  codeRef.current = code;

  // ─── Linter (as-you-type diagnostics) ───────────────────────────────────────
  const lintState = useLinter(
    editorInstance.monaco,
    editorInstance.editor,
    language,
    code,
    editorInstance.editor !== null
  );

  const lintMarkers = lintState.markers || [];
  const lintMarkersForEditor = lintMarkers.map((m) => ({
    startLineNumber: m.line,
    startColumn: m.column,
    endLineNumber: m.endLine || m.line,
    endColumn: m.endColumn || m.column + (m.message ? m.message.length : 1),
    message: m.message,
    severity: m.severity === 2 ? 2 : 1,
  }));
  const lintExplanation = lintMarkers.length > 0 ? lintMarkers[0].explanation : null;
  const lintOutputText = lintState.output;

  // ─── Fetch questions ────────────────────────────────────────────────────────
  const fetchQuestions = useCallback(async () => {
    setQuestionsLoading(true);
    setQuestionsError(false);
    try {
      const res = await api.get("/api/coding-questions", {
        headers,
        params: { companyId: companyId || "", limit: 100 },
      });
      const list = res.data?.questions || [];
      if (list.length === 0) { setQuestionsError(true); return; }
      setQuestions(list);
      setActiveIndex(0);

      const histRes = await api.get("/api/practice/coding/history", {
        headers,
        params: { limit: 200 },
      });
      const subs = histRes.data?.submissions || [];
      const acceptedIds = new Set(
        subs.filter((s) => s.status === "accepted").map((s) => s.questionId)
      );
      setSolved(acceptedIds);
    } catch {
      setQuestionsError(true);
    } finally {
      setQuestionsLoading(false);
    }
  }, [companyId, headers]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  // ─── Close language dropdown on outside click ─────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (langDropRef.current && !langDropRef.current.contains(e.target)) {
        setLangDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fullscreenContainerRef = useRef(null);
  const [useFallback, setUseFallback] = useState(false);

  // ─── Layout editor helper ────────────────────────────────────────────────
  const layoutEditor = useCallback(() => {
    if (editorInstance.editor) {
      requestAnimationFrame(() => {
        editorInstance.editor.layout();
      });
    }
  }, [editorInstance.editor]);

  // ─── Enter / Exit fullscreen ────────────────────────────────────────────
  const enterFullscreen = useCallback(async () => {
    const el = fullscreenContainerRef.current;
    if (!el) return;

    if (supportsFullscreen()) {
      try {
        await requestFullscreen(el);
        setFullscreen(true);
        document.body.style.overflow = "hidden";
        try { localStorage.setItem(FULLSCREEN_KEY, "true"); } catch {}
        setTimeout(layoutEditor, 50);
        setTimeout(layoutEditor, 200);
        return;
      } catch {
        // Fall through to CSS fallback
      }
    }

    // CSS fallback
    setUseFallback(true);
    setFullscreen(true);
    document.body.style.overflow = "hidden";
    try { localStorage.setItem(FULLSCREEN_KEY, "true"); } catch {}
    setTimeout(layoutEditor, 50);
    setTimeout(layoutEditor, 200);
  }, [layoutEditor]);

  const exitFullscreen = useCallback(async () => {
    if (getFullscreenElement()) {
      try {
        await exitFullscreenAPI();
      } catch {}
    }
    setUseFallback(false);
    setFullscreen(false);
    document.body.style.overflow = "";
    try { localStorage.setItem(FULLSCREEN_KEY, "false"); } catch {}
    setTimeout(layoutEditor, 50);
    setTimeout(layoutEditor, 200);
  }, [layoutEditor]);

  const toggleFullscreen = useCallback(() => {
    if (fullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [fullscreen, enterFullscreen, exitFullscreen]);

  // ─── Sync fullscreen state from browser API ─────────────────────────────
  useEffect(() => {
    const onFsChange = () => {
      const isFs = !!getFullscreenElement();
      setFullscreen(isFs);
      try { localStorage.setItem(FULLSCREEN_KEY, String(isFs)); } catch {}
      setTimeout(layoutEditor, 50);
      setTimeout(layoutEditor, 200);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, [layoutEditor]);

  // ─── ESC key exits fullscreen ───────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && fullscreen) {
        exitFullscreen();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [fullscreen, exitFullscreen]);

  // ─── Window resize → layout editor ─────────────────────────────────────
  useEffect(() => {
    const onResize = () => layoutEditor();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [layoutEditor]);

  // ─── Cleanup fullscreen on unmount ─────────────────────────────────────
  useEffect(() => {
    return () => {
      if (getFullscreenElement()) {
        exitFullscreenAPI().catch(() => {});
      }
      document.body.style.overflow = "";
    };
  }, []);

  // ─── Load draft on question change ─────────────────────────────────────────
  const loadDraft = useCallback(async (questionId, starterCode) => {
    if (!questionId) {
      setCode(starterCode || STARTER_CODE[language] || "");
      return;
    }
    try {
      const res = await api.get(`/api/practice/coding/draft/${questionId}`, { headers });
      if (res.data?.code) {
        setCode(res.data.code);
        if (res.data.language) setLanguage(res.data.language);
      } else {
        setCode(starterCode || STARTER_CODE[language] || "");
      }
    } catch {
      setCode(starterCode || STARTER_CODE[language] || "");
    }
  }, [language, headers]);

  // ─── Question switch handler ────────────────────────────────────────────────
  useEffect(() => {
    if (questions.length === 0) return;
    const q = questions[activeIndex];
    if (q) {
      setOutput(null);
      setBottomTab("Testcase");
      setCustomInput(q.sampleInput || "");
      setDebugMode(false);
      setDebugLine(null);
      setRunStage(null);
      loadDraft(q._id, q.starterCode || STARTER_CODE[language]);
    }
    startTime.current = Date.now();
  }, [activeIndex, questions, language, loadDraft]);

  // ─── Sync bookmark state ────────────────────────────────────────────────────
  const activeQuestion = questions[activeIndex];

  useEffect(() => {
    if (!activeQuestion) return;
    try {
      const saved = JSON.parse(localStorage.getItem("coding_bookmarks") || "[]");
      setIsBookmarked(saved.some((q) => q._id === activeQuestion._id));
    } catch {
      setIsBookmarked(false);
    }
  }, [activeQuestion]);

  // ─── Auto-save draft ────────────────────────────────────────────────────────
  useEffect(() => {
    if (draftState === "saving" || !questions[activeIndex] || !code) return;
    setDraftState("dirty");
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(async () => {
      try {
        setDraftState("saving");
        await api.post(
          "/api/practice/coding/draft",
          { questionId: questions[activeIndex]._id, language, code: codeRef.current },
          { headers }
        );
        setDraftState("saved");
      } catch {
        setDraftState("dirty");
      }
    }, 1500);
  }, [code, language, activeIndex, questions, headers]);

  // ─── Elapsed time display (live) ───────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    elapsedIntervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 60000));
    }, 10000);
    return () => clearInterval(elapsedIntervalRef.current);
  }, []);

  // ─── Language change ────────────────────────────────────────────────────────
  const handleLanguageChange = (langId) => {
    setLangDropOpen(false);
    const prevStarter = STARTER_CODE[language] || "";
    const q = questions[activeIndex];
    const isDefault = code === "" || code === prevStarter || code === (q?.starterCode || "");
    setLanguage(langId);
    if (isDefault) {
      setCode(q?.starterCode || STARTER_CODE[langId] || "");
    }
  };

  // ─── Editor mount ───────────────────────────────────────────────────────────
  const handleEditorReady = useCallback((editor, monacoInstance) => {
    setEditorInstance({ editor, monaco: monacoInstance });
  }, []);

  // ─── Highlight line (for compiler errors) ──────────────────────────────────
  const handleHighlightLine = useCallback((line) => {
    if (editorInstance.editor && line) {
      editorInstance.editor.revealLineInCenterIfOutsideViewport(line);
      editorInstance.editor.setPosition({ lineNumber: line, column: 1 });
      editorInstance.editor.focus();
    }
  }, [editorInstance.editor]);

  // ─── Run code (LeetCode-style staged experience) ───────────────────────────
  const handleRun = async () => {
    const q = questions[activeIndex];
    if (!code || !q) return;

    // Validate language
    const supportedLanguages = ["python", "java", "c", "cpp"];
    if (!supportedLanguages.includes(language)) {
      setOutput({ type: "run", data: { type: "error", output: `Language "${language}" is not supported. Please use Python, Java, C, or C++.`, timeMs: 0 } });
      setBottomTab("Test Result");
      return;
    }

    // Cancel previous execution if running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setRunning(true);
    setOutput(null);
    setBottomTab("Test Result");

    try {
      // Stage 1: Compiling
      setRunStage("Compiling...");
      await new Promise((r) => setTimeout(r, 300));

      // Stage 2: Running
      setRunStage("Running...");
      await new Promise((r) => setTimeout(r, 200));

      // Stage 3: Fetching output
      setRunStage("Fetching output...");

      const res = await api.post(
        "/api/practice/coding/run",
        { language, code, input: customInput },
        { headers, signal: abortControllerRef.current.signal }
      );
      const data = res.data || {};

      // Stage 4: Display result
      setRunStage(null);
      setOutput({ type: "run", data });
    } catch (err) {
      if (err.name === "CanceledError" || err.code === "ERR_CANCELED") {
        // Execution was cancelled - don't show error
        return;
      }
      const msg = err.response?.data?.message || "Failed to run code";
      setRunStage(null);
      setOutput({ type: "run", data: { type: "error", output: msg, timeMs: 0 } });
    } finally {
      setRunning(false);
      setRunStage(null);
    }
  };

  // ─── Submit code ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const q = questions[activeIndex];
    if (!q || !code) return;

    // Validate language
    const supportedLanguages = ["python", "java", "c", "cpp"];
    if (!supportedLanguages.includes(language)) {
      setOutput({ type: "submit", data: { status: "unsupported", message: `Language "${language}" is not supported. Please use Python, Java, C, or C++.` } });
      setBottomTab("Test Result");
      return;
    }

    // Cancel previous execution if running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setSubmitting(true);
    setOutput(null);
    setBottomTab("Test Result");

    try {
      setRunStage("Compiling...");
      await new Promise((r) => setTimeout(r, 200));
      setRunStage("Running test cases...");

      const res = await api.post(
        "/api/practice/coding/submit",
        { questionId: q._id, language, code, timeTakenMs: Date.now() - startTime.current },
        { headers, signal: abortControllerRef.current.signal }
      );

      setRunStage("Evaluating...");
      await new Promise((r) => setTimeout(r, 150));

      setRunStage(null);
      setOutput({ type: "submit", data: res.data });
      if (res.data.status === "accepted") {
        toast.success("All test cases passed!");
        setSolved((prev) => new Set(prev).add(q._id));
      } else if (res.data.status === "unsupported") {
        toast.error("This language is not supported for evaluation.");
      }
      fetchSubmissionsForQuestion(q._id);
    } catch (err) {
      if (err.name === "CanceledError" || err.code === "ERR_CANCELED") {
        return;
      }
      toast.error(err.response?.data?.message || "Failed to submit solution");
    } finally {
      setSubmitting(false);
      setRunStage(null);
    }
  };

  // ─── Fetch question submissions ─────────────────────────────────────────────
  const fetchSubmissionsForQuestion = useCallback(async (questionId) => {
    if (!questionId) return;
    try {
      const res = await api.get("/api/practice/coding/history", {
        headers,
        params: { questionId, limit: 20 },
      });
      setSubmissions(res.data?.submissions || []);
    } catch {
      setSubmissions([]);
    }
  }, [headers]);

  useEffect(() => {
    if (activeQuestion?._id) fetchSubmissionsForQuestion(activeQuestion._id);
  }, [activeQuestion, fetchSubmissionsForQuestion]);

  // ─── Copy link ──────────────────────────────────────────────────────────────
  const copyLink = () => {
    if (!activeQuestion) return;
    navigator.clipboard.writeText(
      `${window.location.origin}/interview-practice/${companyId}/coding?q=${activeQuestion._id}`
    ).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  // ─── Output data assembly ───────────────────────────────────────────────────
  const runData = output?.type === "run" ? output.data : null;
  const submitData = output?.type === "submit" ? output.data : null;
  const explanationData = runData && runData.type === "error"
    ? explainError(runData.output)
    : lintExplanation;

  const outputData = {
    run: runData,
    submit: submitData,
    lint: { errors: lintMarkers, output: lintOutputText },
    explanation: explanationData,
    execution: runData ? {
      timeMs: runData.timeMs,
      memory: undefined,
      language,
      exitCode: runData.type === "success" ? 0 : 1,
    } : undefined,
  };

  const visibleTestCases = (activeQuestion?.testCases || []).filter((tc) => !tc.isHidden);
  const sampleCases = (activeQuestion?.examples || []).length > 0
    ? activeQuestion.examples.map((ex) => ({ input: ex.input, expected: ex.output }))
    : visibleTestCases;

  // ─── Loading state ──────────────────────────────────────────────────────────
  if (questionsLoading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--primary)" }} />
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────────────────────────
  if (questionsError && questions.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col items-center justify-center text-center p-12 student-card max-w-lg mx-auto my-8 bg-[var(--card-bg)]">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: "rgba(239, 68, 68, 0.08)" }}>
            <AlertTriangle className="w-8 h-8" style={{ color: "var(--error)" }} />
          </div>
          <h3 className="text-lg font-bold mb-2 text-[var(--text-primary)]">Could Not Load Data</h3>
          <p className="text-sm mb-6 max-w-sm text-[var(--text-secondary)] leading-relaxed">
            No coding questions found for this company, or the server is unreachable.
          </p>
          <div className="flex items-center gap-3 justify-center">
            <button
              type="button"
              onClick={fetchQuestions}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90 cursor-pointer shadow-sm btn-gradient"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Connection
            </button>
            <button
              type="button"
              onClick={() => navigate(`/interview-practice/${companyId}`)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition hover:bg-[var(--border)]/20 cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  const activeLang = LANGUAGES.find((l) => l.id === language) || LANGUAGES[0];

  return (
    <div
      ref={fullscreenContainerRef}
      className={
        fullscreen
          ? useFallback
            ? "fixed inset-0 z-[999999] flex flex-col overflow-hidden"
            : "flex flex-col h-screen w-screen overflow-hidden"
          : "flex flex-col h-[calc(100vh-64px)]"
      }
      style={{
        background: "var(--bg-primary)",
        minHeight: 0,
      }}
    >
      {/* ── Top bar (hidden in fullscreen) ── */}
      {!fullscreen && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-2 border-b shrink-0 flex-wrap"
          style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}
        >
          <button
            type="button"
            onClick={() => navigate(`/interview-practice/${companyId}`)}
            className="flex items-center gap-1.5 text-sm font-medium cursor-pointer hover:opacity-80"
            style={{ color: "var(--text-secondary)" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Rounds
          </button>

          <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="flex items-center gap-1">
              <Timer className="w-3.5 h-3.5" />
              {elapsed} min
            </span>
            {draftState === "saved" && (
              <span className="flex items-center gap-1 text-green-500 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved
              </span>
            )}
            {draftState === "dirty" && (
              <span className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                <Save className="w-3.5 h-3.5" /> Saving…
              </span>
            )}
            <button
              type="button"
              onClick={copyLink}
              className="p-1.5 rounded-lg cursor-pointer hover:opacity-80"
              title="Copy problem link"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg cursor-pointer hover:opacity-80"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            </button>
          </div>
        </div>
      )}

      {/* ── Main split layout ── */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden" style={{ minHeight: 0 }}>

        {/* ── LEFT: Problem statement ── */}
        <div
          className="lg:w-[42%] flex flex-col overflow-y-auto border-r"
          style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}
        >
          {/* Question tabs */}
          <div className="flex items-center gap-1.5 px-4 pt-3 pb-0 flex-wrap shrink-0">
            {questions.map((q, idx) => {
              const active = idx === activeIndex;
              const done = solved.has(q._id);
              return (
                <button
                  key={q._id || idx}
                  type="button"
                  onClick={() => { setActiveIndex(idx); }}
                  className="w-8 h-8 rounded-lg text-xs font-bold cursor-pointer transition mb-2"
                  style={{
                    background: active ? "#6366f1" : done ? "rgba(34,197,94,0.12)" : "var(--input-bg)",
                    color: active ? "#fff" : done ? "#22c55e" : "var(--text-secondary)",
                    border: active ? "2px solid #6366f1" : "1px solid var(--border)",
                  }}
                  title={q.title}
                >
                  {done && !active ? "✓" : idx + 1}
                </button>
              );
            })}
          </div>

          <ProblemDescription
            question={activeQuestion}
            difficulty={activeQuestion?.difficulty}
            tags={activeQuestion?.tags}
          />
        </div>

        {/* ── RIGHT: Editor + bottom panel ── */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>

          {/* Editor toolbar */}
          <div
            className="flex items-center justify-between px-3 py-1.5 border-b shrink-0"
            style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}
          >
            {/* Language selector */}
            <div className="relative" ref={langDropRef}>
              <button
                type="button"
                onClick={() => setLangDropOpen((o) => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-80 transition border"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                }}
              >
                <Code2 className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
                {activeLang.label}
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </button>

              <AnimatePresence>
                {langDropOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.1 }}
                    className="absolute left-0 top-full mt-1 z-50 rounded-xl border shadow-xl py-1 min-w-[130px]"
                    style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
                  >
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.id}
                        type="button"
                        onClick={() => handleLanguageChange(lang.id)}
                        className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-[var(--border)]/30 transition flex items-center justify-between gap-2"
                        style={{
                          color: language === lang.id ? "var(--primary)" : "var(--text-primary)",
                          background: language === lang.id ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "transparent",
                        }}
                      >
                        <span>{lang.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Editor actions - cleaned up */}
            <div className="flex items-center gap-2">
              {fullscreen && (
                <button
                  type="button"
                  onClick={exitFullscreen}
                  className="p-1.5 rounded-lg cursor-pointer hover:opacity-80 transition"
                  title="Exit fullscreen (Esc)"
                  style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-muted)" }}
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setSplitView((s) => !s)}
                className="p-1.5 rounded-lg cursor-pointer hover:opacity-80 transition"
                title={splitView ? "Unsplit editor" : "Split editor"}
                style={{
                  background: splitView ? "rgba(99,102,241,0.12)" : "var(--input-bg)",
                  color: splitView ? "#6366f1" : "var(--text-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                <Split className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editorInstance.editor) {
                    editorInstance.editor.getAction("editor.action.formatDocument")?.run();
                  }
                }}
                className="p-1.5 rounded-lg cursor-pointer hover:opacity-80 transition"
                title="Format Document"
                style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-muted)" }}
              >
                <Code2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleRun}
                disabled={running || submitting || !activeQuestion}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-85 transition disabled:opacity-50"
                style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1" }}
              >
                {running ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Running…
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    Run
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || running || !activeQuestion}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-85 transition disabled:opacity-50"
                style={{ background: "var(--primary)", color: "#fff" }}
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Submit
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Code editor area */}
          <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
            <MonacoCodeEditor
              code={code}
              language={language}
              onChange={setCode}
              onEditorReady={handleEditorReady}
              theme={theme}
              wordWrap={false}
              markers={lintMarkersForEditor}
              debugLine={debugMode ? debugLine : null}
              debugMode={debugMode}
              split={splitView}
            />
          </div>

          {/* ── Bottom tabbed panel (resizable) ── */}
          <OutputPanel
            activeTab={bottomTab}
            setActiveTab={setBottomTab}
            data={outputData}
            running={running}
            submitting={submitting}
            testCases={sampleCases}
            submissions={submissions}
            runStage={runStage}
            onResize={layoutEditor}
          />
        </div>
      </div>
    </div>
  );
}

export default CodingRound;
