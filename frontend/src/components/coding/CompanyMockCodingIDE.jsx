import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Send, Code2, ChevronDown, Split, Check,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import { useTheme } from "../../hooks/useTheme";
import MonacoCodeEditor from "./MonacoCodeEditor";
import OutputPanel from "./OutputPanel";
import ProblemDescription from "./ProblemDescription";
import { explainError } from "../../utils/coding/errorExplanations";
import useLinter from "../../utils/coding/useLinter";

/**
 * CompanyMockCodingIDE — full-featured split-pane coding IDE for the Company
 * Mock Interview. Mirrors the Interview Practice coding screen (left problem
 * statement, right Monaco editor, resizable output panel) while preserving the
 * exact backend execution contract used by the mock:
 *
 *   - /api/code/run     { language, code, input }
 *   - /api/code/submit  { language, code, timeTakenMs, questionSource:"codingQuestion", questionId }
 *
 * State and result flow (code per question, global language, submission capture)
 * are wired through the parent's callbacks so scoring is unchanged.
 *
 * Props:
 *  - question       : the coding question object (from backend toClientCoding)
 *  - questions      : all coding questions in this mock (for the question tabs)
 *  - activeIndex    : index of the currently shown coding question
 *  - solvedSet      : Set of question _ids that have a recorded submission
 *  - onNavigate(idx): jump to a different coding question (within the coding section)
 *  - initialCode    : saved code for this question (or starter)
 *  - initialLanguage: currently selected global language
 *  - onCodeChange(code)      → updateCoding
 *  - onLanguageChange(lang)  → set selected language + submission language
 *  - onSubmissionResult(result) → handleCodingSubmission
 */
import { getStarterCode } from "../../utils/coding/starterGenerator";

const CODING_LANGUAGES = [
  { id: "python", label: "Python", ext: "py" },
  { id: "cpp", label: "C++", ext: "cpp" },
  { id: "java", label: "Java", ext: "java" },
  { id: "javascript", label: "JavaScript", ext: "js" },
];

function CompanyMockCodingIDE({
  question,
  questions = [],
  activeIndex = 0,
  solvedSet = new Set(),
  onNavigate,
  onCodeChange,
  onLanguageChange,
  onSubmissionResult,
  initialCode,
  initialLanguage,
}) {
  const { theme } = useTheme();
  const token = getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const [code, setCode] = useState(() => initialCode || getStarterCode(question, initialLanguage || "python"));
  const [language, setLanguage] = useState(initialLanguage || "python");
  const [output, setOutput] = useState(null);
  const [bottomTab, setBottomTab] = useState("Testcase");
  const [splitView, setSplitView] = useState(false);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runStage, setRunStage] = useState(null);
  const [langDropOpen, setLangDropOpen] = useState(false);
  const [editorInstance, setEditorInstance] = useState({ editor: null, monaco: null });

  const abortControllerRef = useRef(null);
  const langDropRef = useRef(null);
  const codeByLanguageRef = useRef({});

  // Sync question changes
  useEffect(() => {
    if (question) {
      codeByLanguageRef.current = {};
      const starter = getStarterCode(question, language);
      setCode(initialCode || starter);
      codeByLanguageRef.current[language] = initialCode || starter;
    }
  }, [question, initialCode]);

  // Linter diagnostics (as-you-type) — reused from Interview Practice.
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

  // Close language dropdown on outside click.
  useEffect(() => {
    const handler = (e) => {
      if (langDropRef.current && !langDropRef.current.contains(e.target)) {
        setLangDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Editor layout helper (keeps Monaco sized correctly on resize/split changes).
  const layoutEditor = useCallback(() => {
    if (editorInstance.editor) {
      requestAnimationFrame(() => {
        editorInstance.editor.layout();
      });
    }
  }, [editorInstance.editor]);

  useEffect(() => {
    const onResize = () => layoutEditor();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [layoutEditor]);

  // Ensure Monaco measures the real (now definite) container height once it
  // mounts — if the initial flex layout reports 0, Monaco's automaticLayout can
  // miss the first size and leave an unclickable/empty editor. This mirrors the
  // explicit relayout used by the working Interview Practice screen.
  useEffect(() => {
    if (!editorInstance.editor) return;
    const t = setTimeout(layoutEditor, 60);
    return () => clearTimeout(t);
  }, [editorInstance.editor, layoutEditor]);

  // Visible test cases (non-hidden) for the Testcase tab.
  const visibleTestCases = (question?.testCases || []).filter((tc) => !tc.isHidden);
  const sampleCases =
    visibleTestCases.length > 0
      ? visibleTestCases
      : question?.sampleInput || question?.sampleOutput
        ? [{ input: question.sampleInput, expected: question.sampleOutput }]
        : [];

  // Map test/question fields to ProblemDescription format.
  const mappedQuestion = question
    ? {
        title: question.title || "Coding Problem",
        problemStatement: question.problemStatement || question.text || "",
        description: question.description || "",
        constraints: question.constraints || "",
        inputFormat: question.inputFormat || "",
        outputFormat: question.outputFormat || "",
        sampleInput: question.sampleInput || "",
        sampleOutput: question.sampleOutput || "",
        examples: question.examples || [],
        difficulty: question.difficulty || "Medium",
        tags: question.tags || [],
        timeLimit: question.timeLimit,
        memoryLimit: question.memoryLimit,
      }
    : null;

  // Language change — keep per-language code locally, notify parent.
  const handleLanguageChange = (langId) => {
    setLangDropOpen(false);
    codeByLanguageRef.current[language] = code;

    setLanguage(langId);

    const savedCode = codeByLanguageRef.current[langId];
    if (savedCode && savedCode.trim() !== "") {
      setCode(savedCode);
    } else {
      const newStarter = getStarterCode(question, langId);
      setCode(newStarter);
      codeByLanguageRef.current[langId] = newStarter;
    }
    onLanguageChange?.(langId);
  };

  const handleCodeChange = (val) => {
    setCode(val);
    onCodeChange?.(val);
  };

  const handleEditorReady = useCallback((editor, monacoInstance) => {
    setEditorInstance({ editor, monaco: monacoInstance });
  }, []);

  // ── Run code (Judge0 via /api/code/run) ──
  const handleRun = async () => {
    if (!code || !question) return;

    const supportedLanguages = ["python", "java", "c", "cpp", "javascript"];
    if (!supportedLanguages.includes(language)) {
      setOutput({
        type: "run",
        data: { type: "error", output: `Language "${language}" is not supported. Please use Python, Java, C, C++, or JavaScript.`, timeMs: 0 },
      });
      setBottomTab("Test Result");
      return;
    }

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setRunning(true);
    setOutput(null);
    setBottomTab("Test Result");

    try {
      setRunStage("Compiling...");
      await new Promise((r) => setTimeout(r, 200));
      setRunStage("Running...");
      await new Promise((r) => setTimeout(r, 150));
      setRunStage("Fetching output...");

      const res = await api.post(
        "/api/code/run",
        { language, code, input: "" },
        { headers, signal: abortControllerRef.current.signal }
      );
      setRunStage(null);
      setOutput({ type: "run", data: res.data || {} });
    } catch (err) {
      if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
      const msg = err.response?.data?.message || "Failed to run code";
      setRunStage(null);
      setOutput({ type: "run", data: { type: "error", output: msg, timeMs: 0 } });
    } finally {
      setRunning(false);
      setRunStage(null);
    }
  };

  // ── Submit code (Judge0 grading via /api/code/submit) ──
  const handleSubmit = async () => {
    if (!question || !code) return;

    const supportedLanguages = ["python", "java", "c", "cpp", "javascript"];
    if (!supportedLanguages.includes(language)) {
      setOutput({
        type: "submit",
        data: { status: "unsupported", message: `Language "${language}" is not supported. Please use Python, Java, C, C++, or JavaScript.` },
      });
      setBottomTab("Test Result");
      return;
    }

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setSubmitting(true);
    setOutput(null);
    setBottomTab("Test Result");

    try {
      setRunStage("Compiling...");
      await new Promise((r) => setTimeout(r, 200));
      setRunStage("Running test cases...");

      const res = await api.post(
        "/api/code/submit",
        {
          language,
          code,
          timeTakenMs: 0,
          questionSource: "codingQuestion",
          questionId: question._id,
        },
        { headers, signal: abortControllerRef.current.signal }
      );

      setRunStage("Evaluating...");
      await new Promise((r) => setTimeout(r, 150));

      setRunStage(null);
      setOutput({ type: "submit", data: res.data });
      onSubmissionResult?.({
        status: res.data?.status,
        passedCount: res.data?.passedCount ?? res.data?.passed ?? (res.data?.status === "accepted" ? 1 : 0),
        totalCount: res.data?.totalCount ?? res.data?.total ?? 0,
        score: res.data?.score ?? 0,
      });
    } catch (err) {
      if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
      const msg = err.response?.data?.message || "Failed to submit code";
      setRunStage(null);
      setOutput({ type: "submit", data: { status: "failed", message: msg } });
    } finally {
      setSubmitting(false);
      setRunStage(null);
    }
  };

  // Output data assembly (run / submit / lint / explanation).
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
    execution: runData
      ? {
          timeMs: runData.timeMs,
          memory: undefined,
          language,
          exitCode: runData.type === "success" ? 0 : 1,
        }
      : undefined,
  };

  const activeLang = CODING_LANGUAGES.find((l) => l.id === language) || CODING_LANGUAGES[0];

  // Filter languages based on the question's allowed languages.
  const allowedLanguages = question?.languages || CODING_LANGUAGES.map((l) => l.label);
  const availableLanguages = CODING_LANGUAGES.filter((l) =>
    allowedLanguages.some(
      (al) => al.toLowerCase() === l.label.toLowerCase() || al.toLowerCase() === l.id
    )
  );
  const displayLanguages = availableLanguages.length > 0 ? availableLanguages : CODING_LANGUAGES;

  return (
    <div className="flex flex-col lg:flex-row flex-1 overflow-hidden" style={{ minHeight: 0 }}>
      {/* ── LEFT: Problem statement + question tabs ── */}
      <div
        className="lg:w-[42%] lg:min-w-[320px] flex flex-col overflow-y-auto border-r"
        style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}
      >
        {/* Question tabs */}
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-0 flex-wrap shrink-0">
          {questions.map((q, idx) => {
            const active = idx === activeIndex;
            const done = solvedSet.has(q._id);
            return (
              <button
                key={q._id || idx}
                type="button"
                onClick={() => onNavigate?.(idx)}
                className="w-8 h-8 rounded-lg text-xs font-bold cursor-pointer transition mb-2"
                style={{
                  background: active ? "#6366f1" : done ? "rgba(34,197,94,0.12)" : "var(--input-bg)",
                  color: active ? "#fff" : done ? "#22c55e" : "var(--text-secondary)",
                  border: active ? "2px solid #6366f1" : "1px solid var(--border)",
                }}
                title={q.title}
              >
                {done && !active ? <Check className="w-3.5 h-3.5 mx-auto" /> : idx + 1}
              </button>
            );
          })}
        </div>

        <ProblemDescription
          question={mappedQuestion}
          difficulty={mappedQuestion?.difficulty}
          tags={mappedQuestion?.tags}
        />
      </div>

      {/* ── RIGHT: Editor toolbar + Monaco + resizable output ── */}
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
                  className="absolute left-0 top-full mt-1 z-50 rounded-xl border shadow-xl py-1 min-w-[150px]"
                  style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
                >
                  {displayLanguages.map((lang) => (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => handleLanguageChange(lang.id)}
                      className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-[var(--border)]/30 transition flex items-center justify-between gap-2"
                      style={{
                        color: language === lang.id ? "var(--primary)" : "var(--text-primary)",
                        background:
                          language === lang.id
                            ? "color-mix(in srgb, var(--primary) 8%, transparent)"
                            : "transparent",
                      }}
                    >
                      <span>{lang.label}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
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
              onClick={handleRun}
              disabled={running || submitting || !question}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-85 transition disabled:opacity-50"
              style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1" }}
            >
              {running ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Running...
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
              disabled={submitting || running || !question}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-85 transition disabled:opacity-50"
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Submitting...
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
            onChange={handleCodeChange}
            onEditorReady={handleEditorReady}
            theme={theme}
            wordWrap={false}
            markers={lintMarkersForEditor}
            split={splitView}
          />
        </div>

        {/* Bottom tabbed panel (resizable) */}
        <OutputPanel
          activeTab={bottomTab}
          setActiveTab={setBottomTab}
          data={outputData}
          running={running}
          submitting={submitting}
          testCases={sampleCases}
          submissions={[]}
          runStage={runStage}
          onResize={layoutEditor}
        />
      </div>
    </div>
  );
}

export default CompanyMockCodingIDE;
