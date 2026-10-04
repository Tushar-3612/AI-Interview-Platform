import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Send, Loader2, Code2, ChevronDown, Split, RotateCcw, Check, Copy, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../../core/api/api.js";
import { getAuthToken } from "../../student/hooks/useStudentProfile.js";
import { useTheme } from "../../../core/hooks/useTheme.jsx";
import MonacoCodeEditor from "./MonacoCodeEditor.jsx";
import OutputPanel from "./OutputPanel.jsx";
import ProblemDescription from "./ProblemDescription.jsx";
import { getStarterCode } from "../utils/starterGenerator.js";
import { explainError } from "../utils/errorExplanations.js";

const CODING_LANGUAGES = [
  { id: "python", label: "Python (3.8.1)", ext: "py" },
  { id: "cpp", label: "C++ (GCC 9.2.0)", ext: "cpp" },
  { id: "java", label: "Java (OpenJDK 13)", ext: "java" },
  { id: "c", label: "C (GCC 9.2.0)", ext: "c" },
  { id: "javascript", label: "JavaScript (Node 12)", ext: "js" },
];

/**
 * CodingQuestionRenderer — professional coding IDE for Test Engine and Coding Rounds.
 *
 * Split Layout:
 *  - Left Pane (42%): Independently scrollable Problem Statement, examples, constraints.
 *  - Right Pane (58%): Language Toolbar + Monaco Editor + Resizable Output Terminal.
 */
function CodingQuestionRenderer({
  question,
  questionSource = "testQuestion",
  questionIndex,
  testId,
  questionId,
  onCodeChange,
  onLanguageChange,
  onSubmissionResult,
  initialCode,
  initialLanguage,
  readOnly = false,
}) {
  const { theme } = useTheme();
  const token = getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const [code, setCode] = useState(() => initialCode || getStarterCode(question, initialLanguage || "python"));
  const [language, setLanguage] = useState(initialLanguage || "python");
  const [customInput, setCustomInput] = useState("");
  const [selectedTestCaseIndex, setSelectedTestCaseIndex] = useState(0);
  const [isCustomInput, setIsCustomInput] = useState(false);
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
  const codeRef = useRef(code);
  const codeByLanguageRef = useRef({});
  const languageRef = useRef(language);
  languageRef.current = language;

  codeRef.current = code;

  // Sync external question changes
  useEffect(() => {
    if (question) {
      codeByLanguageRef.current = {};
      const starter = getStarterCode(question, language);
      setCode(initialCode || starter);
      codeByLanguageRef.current[language] = initialCode || starter;
      setSelectedTestCaseIndex(0);
    }
  }, [question, initialCode]);

  useEffect(() => {
    if (initialLanguage !== undefined && initialLanguage !== language) {
      setLanguage(initialLanguage);
    }
  }, [initialLanguage]);

  // Close language dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (langDropRef.current && !langDropRef.current.contains(e.target)) {
        setLangDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Map test question fields to ProblemDescription format
  const mappedQuestion = question
    ? {
        title: question.problemTitle || question.title || "Coding Problem",
        problemStatement: question.description || question.problemStatement || "",
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

  // Visible test cases for the Testcase tab
  const rawTestCases = question?.testCases || question?.publicTestCases || question?.sampleTestCases || [];
  const visibleTestCases = rawTestCases.filter((tc) => !tc.isHidden).map((tc) => ({
    input: tc.input ?? tc.stdin ?? "",
    expected: tc.output ?? tc.expected ?? tc.expectedOutput ?? "",
    isHidden: false,
  }));

  const sampleCases =
    visibleTestCases.length > 0
      ? visibleTestCases
      : Array.isArray(question?.examples) && question.examples.length > 0
      ? question.examples.map((ex) => ({
          input: typeof ex.input === "object" ? JSON.stringify(ex.input) : String(ex.input ?? ""),
          expected: typeof ex.output === "object" ? JSON.stringify(ex.output) : String(ex.output ?? ""),
          isHidden: false,
        }))
      : question?.sampleInput || question?.sampleOutput
      ? [{ input: String(question.sampleInput || ""), expected: String(question.sampleOutput || ""), isHidden: false }]
      : [];

  // Editor layout helper
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

  // Language change
  const handleLanguageChange = (langId) => {
    setLangDropOpen(false);

    // Save current code for current language
    codeByLanguageRef.current[language] = code;

    setLanguage(langId);

    // Load code for new language
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

  // Reset to starter code
  const handleResetCode = () => {
    const starter = getStarterCode(question, language);
    setCode(starter);
    codeByLanguageRef.current[language] = starter;
    onCodeChange?.(starter);
  };

  // Code change
  const handleCodeChange = (val) => {
    setCode(val);
    onCodeChange?.(val);
  };

  // Editor mount
  const handleEditorReady = useCallback((editor, monacoInstance) => {
    setEditorInstance({ editor, monaco: monacoInstance });
  }, []);

  // Run code
  const handleRun = async () => {
    if (!code || !question) return;

    // Validate language
    const supportedLanguages = ["python", "java", "c", "cpp", "javascript"];
    if (!supportedLanguages.includes(language)) {
      setOutput({ type: "run", data: { type: "error", output: `Language "${language}" is not supported. Please use Python, Java, C, C++, or JavaScript.`, timeMs: 0 } });
      setBottomTab("Test Result");
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
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

      // Determine active stdin input and expected output
      let activeInput = "";
      let activeExpected = "";
      let activeCaseObj = null;

      if (isCustomInput && customInput.trim() !== "") {
        activeInput = customInput;
      } else if (sampleCases.length > 0) {
        activeCaseObj = sampleCases[selectedTestCaseIndex] || sampleCases[0];
        activeInput = activeCaseObj.input ?? activeCaseObj.stdin ?? "";
        activeExpected = activeCaseObj.expected ?? activeCaseObj.expectedOutput ?? activeCaseObj.output ?? "";
      } else {
        activeInput = customInput || "";
      }

      const payload = {
        language,
        code,
        input: activeInput,
        expectedOutput: activeExpected,
        testCase: activeCaseObj,
        directTestCases: sampleCases.length > 0 ? sampleCases : undefined,
        selectedTestCaseIndex,
        questionSource,
      };

      if (questionSource === "testQuestion") {
        payload.testId = testId;
        payload.questionIndex = questionIndex;
      } else {
        payload.questionId = questionId;
      }

      const res = await api.post(
        "/api/code/run",
        payload,
        { headers, signal: abortControllerRef.current.signal }
      );
      const data = res.data || {};
      setRunStage(null);
      setOutput({ type: "run", data });
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

  // Submit code
  const handleSubmit = async () => {
    if (!question || !code) return;

    // Validate language
    const supportedLanguages = ["python", "java", "c", "cpp", "javascript"];
    if (!supportedLanguages.includes(language)) {
      setOutput({ type: "submit", data: { status: "unsupported", message: `Language "${language}" is not supported. Please use Python, Java, C, C++, or JavaScript.` } });
      setBottomTab("Test Result");
      return;
    }

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

      const body = {
        language,
        code,
        timeTakenMs: 0,
        questionSource,
        directTestCases: sampleCases.length > 0 ? sampleCases : undefined,
      };

      if (questionSource === "testQuestion") {
        body.testId = testId;
        body.questionIndex = questionIndex;
      } else {
        body.questionId = questionId;
      }

      const res = await api.post("/api/code/submit", body, {
        headers,
        signal: abortControllerRef.current.signal,
      });

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

  // Output data assembly
  const runData = output?.type === "run" ? output.data : null;
  const submitData = output?.type === "submit" ? output.data : null;
  const explanationData = runData && runData.type === "error" ? explainError(runData.output) : null;

  const outputData = {
    run: runData,
    submit: submitData,
    explanation: explanationData,
    execution: runData
      ? {
          timeMs: runData.timeMs,
          language,
          exitCode: runData.type === "success" ? 0 : 1,
        }
      : undefined,
  };

  const activeLang = CODING_LANGUAGES.find((l) => l.id === language) || CODING_LANGUAGES[0];

  // Filter languages based on question's allowed languages
  const allowedLanguages = question?.languages || CODING_LANGUAGES.map((l) => l.label);
  const availableLanguages = CODING_LANGUAGES.filter((l) =>
    allowedLanguages.some(
      (al) => al.toLowerCase() === l.label.toLowerCase() || al.toLowerCase() === l.id
    )
  );
  const displayLanguages = availableLanguages.length > 0 ? availableLanguages : CODING_LANGUAGES;

  return (
    <div className="flex flex-col lg:flex-row w-full h-full overflow-hidden" style={{ minHeight: 0 }}>
      {/* ── LEFT PANE: Problem Description ── */}
      <div
        className="lg:w-[42%] flex flex-col overflow-y-auto border-b lg:border-b-0 lg:border-r border-[var(--border)] shrink-0 custom-scrollbar"
        style={{ background: "var(--card-bg)" }}
      >
        <ProblemDescription
          question={mappedQuestion}
          difficulty={mappedQuestion?.difficulty}
          tags={mappedQuestion?.tags}
        />
      </div>

      {/* ── RIGHT PANE: Code Editor & Output Terminal ── */}
      <div className="flex-1 flex flex-col overflow-hidden h-full" style={{ minHeight: 0, background: "var(--card-bg)" }}>
        {/* Editor Toolbar */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b shrink-0"
          style={{ borderColor: "var(--border)", background: "var(--bg-secondary, var(--card-bg))" }}
        >
          {/* Language selector */}
          <div className="relative" ref={langDropRef}>
            <button
              type="button"
              onClick={() => setLangDropOpen((o) => !o)}
              disabled={readOnly}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-80 transition border disabled:opacity-50"
              style={{
                borderColor: "var(--border)",
                background: "var(--input-bg)",
                color: "var(--text-primary)",
              }}
            >
              <Code2 className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
              <span>{activeLang.label}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </button>

            <AnimatePresence>
              {langDropOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.1 }}
                  className="absolute left-0 top-full mt-1 z-50 rounded-xl border shadow-xl py-1 min-w-[160px]"
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
                      {language === lang.id && <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetCode}
              disabled={readOnly}
              className="p-1.5 rounded-lg cursor-pointer hover:opacity-80 transition border disabled:opacity-50"
              title="Reset to starter code"
              style={{
                borderColor: "var(--border)",
                background: "var(--input-bg)",
                color: "var(--text-muted)",
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (editorInstance.editor) {
                  editorInstance.editor.getAction("editor.action.formatDocument")?.run();
                }
              }}
              className="p-1.5 rounded-lg cursor-pointer hover:opacity-80 transition border"
              title="Format Code"
              style={{
                borderColor: "var(--border)",
                background: "var(--input-bg)",
                color: "var(--text-muted)",
              }}
            >
              <Code2 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setSplitView((s) => !s)}
              className="p-1.5 rounded-lg cursor-pointer hover:opacity-80 transition border"
              title={splitView ? "Single Editor View" : "Split Editor View"}
              style={{
                borderColor: "var(--border)",
                background: splitView ? "rgba(99,102,241,0.12)" : "var(--input-bg)",
                color: splitView ? "#6366f1" : "var(--text-muted)",
              }}
            >
              <Split className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleRun}
              disabled={running || submitting || !question}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-90 transition disabled:opacity-50"
              style={{ background: "rgba(99,102,241,0.15)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.3)" }}
            >
              {running ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>{runStage || "Running..."}</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || running || !question}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer hover:opacity-90 transition disabled:opacity-50 shadow-sm"
              style={{ background: "var(--primary)" }}
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{runStage || "Submitting..."}</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Code</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Code Editor */}
        <div className="flex-1 overflow-hidden" style={{ minHeight: "280px" }}>
          <MonacoCodeEditor
            code={code}
            language={language}
            onChange={handleCodeChange}
            onEditorReady={handleEditorReady}
            theme={theme}
            wordWrap={false}
            readOnly={readOnly}
            split={splitView}
          />
        </div>

        {/* Resizable Output Panel */}
        <OutputPanel
          activeTab={bottomTab}
          setActiveTab={setBottomTab}
          data={outputData}
          running={running}
          submitting={submitting}
          testCases={sampleCases}
          selectedCaseIndex={selectedTestCaseIndex}
          onSelectCase={setSelectedTestCaseIndex}
          customInput={customInput}
          onCustomInputChange={setCustomInput}
          isCustomInput={isCustomInput}
          onToggleCustomInput={setIsCustomInput}
          submissions={[]}
          runStage={runStage}
          onResize={layoutEditor}
        />
      </div>
    </div>
  );
}

export default CodingQuestionRenderer;

