import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Send, Loader2, Code2, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import { useTheme } from "../../hooks/useTheme";
import MonacoCodeEditor from "../coding/MonacoCodeEditor";
import OutputPanel from "../coding/OutputPanel";
import ProblemDescription from "../coding/ProblemDescription";
import { explainError } from "../../utils/coding/errorExplanations";

const CODING_LANGUAGES = [
  { id: "cpp", label: "C++ (GCC 9.2.0)", ext: "cpp" },
  { id: "c", label: "C (GCC 9.2.0)", ext: "c" },
  { id: "java", label: "Java (OpenJDK 13)", ext: "java" },
  { id: "python", label: "Python (3.8.1)", ext: "py" },
  { id: "javascript", label: "JavaScript (Node 12)", ext: "js" },
];

const STARTER_CODE = {
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    int a, b;\n    if (cin >> a >> b) {\n        cout << a + b;\n    }\n    return 0;\n}`,
  c: `#include <stdio.h>\n\nint main() {\n    // Write your solution here\n    int a, b;\n    if (scanf("%d %d", &a, &b) == 2) {\n        printf("%d", a + b);\n    }\n    return 0;\n}`,
  java: `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (sc.hasNextInt()) {\n            int a = sc.nextInt();\n            int b = sc.nextInt();\n            System.out.println(a + b);\n        }\n    }\n}`,
  python: `import sys\n\n# Read input from stdin\nlines = sys.stdin.read().split()\nif len(lines) >= 2:\n    a, b = int(lines[0]), int(lines[1])\n    print(a + b)\n`,
  javascript: `const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);\nif (input.length >= 2) {\n    const [a, b] = input.map(Number);\n    console.log(a + b);\n}\n`,
};

/**
 * CodingQuestionRenderer — reusable coding IDE for both Coding Practice and Test Coding Round.
 *
 * Reuses:
 *  - MonacoCodeEditor (shared editor component)
 *  - OutputPanel (shared output/test-result panel)
 *  - ProblemDescription (shared problem description panel)
 *
 * Props:
 *  - question: the coding question object (from Test.js embedded question or CodingQuestion)
 *  - questionSource: "testQuestion" | "codingQuestion" — determines which API endpoint to use
 *  - questionIndex: number — for test questions, the index in the test's questions array
 *  - testId: string — for test questions, the test ID
 *  - questionId: string — for coding questions, the CodingQuestion ID
 *  - onCodeChange: (code) => void — callback when code changes (for test state saving)
 *  - onLanguageChange: (language) => void — callback when language changes
 *  - initialCode: string — initial code to load
 *  - initialLanguage: string — initial language to use
 *  - readOnly: boolean — whether the editor is read-only
 */
function CodingQuestionRenderer({
  question,
  questionSource = "testQuestion",
  questionIndex,
  testId,
  questionId,
  onCodeChange,
  onLanguageChange,
  initialCode,
  initialLanguage,
  readOnly = false,
}) {
  const { theme } = useTheme();
  const token = getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const [code, setCode] = useState(initialCode || "");
  const [language, setLanguage] = useState(initialLanguage || "python");
  const [customInput, setCustomInput] = useState("");
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

  // Sync external code/language changes
  useEffect(() => {
    if (initialCode !== undefined && initialCode !== code) {
      setCode(initialCode);
    }
  }, [initialCode]);

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
  const visibleTestCases = (question?.testCases || []).filter((tc) => !tc.isHidden);
  const sampleCases =
    visibleTestCases.length > 0
      ? visibleTestCases
      : question?.sampleInput || question?.sampleOutput
        ? [{ input: question.sampleInput, expected: question.sampleOutput }]
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
    const isDefault = code === "" || code === STARTER_CODE[language] || code === "";

    // Save current code for current language
    codeByLanguageRef.current[language] = code;

    setLanguage(langId);

    // Load code for new language
    const savedCode = codeByLanguageRef.current[langId];
    if (savedCode) {
      setCode(savedCode);
    } else if (isDefault) {
      setCode(STARTER_CODE[langId] || "");
    }
    onLanguageChange?.(langId);
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

      const res = await api.post(
        "/api/code/run",
        { language, code, input: customInput },
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
    <div className="flex flex-col h-full overflow-hidden" style={{ minHeight: 0 }}>
      {/* Problem description */}
      <div
        className="flex-1 overflow-y-auto border-b"
        style={{ borderColor: "var(--border)", background: "var(--card-bg)", maxHeight: "40%" }}
      >
        <ProblemDescription
          question={mappedQuestion}
          difficulty={mappedQuestion?.difficulty}
          tags={mappedQuestion?.tags}
        />
      </div>

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
            disabled={readOnly}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-80 transition border disabled:opacity-50"
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
            <Code2 className="w-4 h-4" />
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
          readOnly={readOnly}
          split={splitView}
        />
      </div>

      {/* Bottom tabbed panel */}
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
  );
}

export default CodingQuestionRenderer;
