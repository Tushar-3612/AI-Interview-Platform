import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import api from "../../../core/api/api.js";
import { getAuthToken } from "../../student/hooks/useStudentProfile.js";
import { useTheme } from "../../../core/hooks/useTheme.jsx";
import { useCodingTimer } from "../hooks/useCodingTimer.js";
import { useAutosaveCode } from "../hooks/useAutosaveCode.js";

import CodingHeader from "../components/CodingHeader.jsx";
import QuestionNavigator from "../components/QuestionNavigator.jsx";
import ProblemPanel from "../components/ProblemPanel.jsx";
import EditorToolbar from "../components/EditorToolbar.jsx";
import MonacoCodeEditor from "../components/MonacoCodeEditor.jsx";
import CustomInputPanel from "../components/CustomInputPanel.jsx";
import TestResultsPanel from "../components/TestResultsPanel.jsx";
import SubmissionModal from "../components/SubmissionModal.jsx";

import toast from "react-hot-toast";
import { Loader2, AlertCircle } from "lucide-react";

const STARTER_CODES = {
  python: `def main():\n    # Write your solution here\n    pass\n\nif __name__ == "__main__":\n    main()`,
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}`,
  java: `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}`,
  c: `#include <stdio.h>\n\nint main() {\n    // Write your solution here\n    return 0;\n}`,
  javascript: `// Read input from stdin\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8').trim();\n\nfunction solution() {\n    // Write your solution here\n}\n\nsolution();`,
};

export default function CodingAssessment() {
  const { assessmentId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const token = getAuthToken();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // Assessment & Attempt State
  const [attemptId, setAttemptId] = useState(searchParams.get("attempt") || null);
  const [assessment, setAssessment] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionProgress, setQuestionProgress] = useState([]);
  const [expiresAt, setExpiresAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Editor State
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState("");
  const [wordWrap, setWordWrap] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [customOutput, setCustomOutput] = useState(null);

  // Execution & Results State
  const [running, setRunning] = useState(false);
  const [runStage, setRunStage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sampleResults, setSampleResults] = useState([]);
  const [submissionData, setSubmissionData] = useState(null);
  const [compileOutput, setCompileOutput] = useState("");
  const [activeResultTab, setActiveResultTab] = useState("sample");

  // Modals
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);

  // Cache of code by questionId and language
  const codeCacheRef = useRef({});
  const activeQuestion = questions[currentIndex] || null;

  // ─── 1. Initialize or resume assessment ────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        let currentAttemptId = attemptId;

        // If no attemptId in query, call startAssessment to get or create
        if (!currentAttemptId) {
          const startRes = await api.post(`/api/coding/assessments/${assessmentId}/start`, {}, { headers });
          const startData = startRes.data?.data;
          currentAttemptId = startData?.attemptId;
          setAttemptId(currentAttemptId);
        }

        // Fetch authoritative attempt state
        const stateRes = await api.get(`/api/coding/attempts/${currentAttemptId}`, { headers });
        const data = stateRes.data?.data;

        if (isMounted) {
          if (data.isExpired || ["SUBMITTED", "AUTO_SUBMITTED"].includes(data.status)) {
            toast("Assessment completed. Showing result...", { icon: "ℹ️" });
            navigate(`/coding-assessment/result/${currentAttemptId}`);
            return;
          }

          setAssessment(data.assessment);
          setQuestions(data.questions || []);
          setQuestionProgress(data.questionProgress || []);
          setExpiresAt(data.expiresAt);

          // Populate cached drafts if present
          if (data.savedDrafts) {
            codeCacheRef.current = { ...data.savedDrafts };
          }

          // Initialize code for first question
          if (data.questions && data.questions.length > 0) {
            const firstQ = data.questions[0];
            const cached = data.savedDrafts?.[`${firstQ._id}_python`];
            const starter = firstQ.starterCodeByLanguage?.python || firstQ.starterCode || STARTER_CODES.python;
            setCode(cached || starter);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.message || "Failed to load assessment.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();
    return () => {
      isMounted = false;
    };
  }, [assessmentId, attemptId, headers, navigate]);

  // ─── 2. Autosave Hook ──────────────────────────────────────────────────────
  const { saveStatus, triggerSave, markInitialCodeAsSaved } = useAutosaveCode({
    attemptId,
    questionId: activeQuestion?._id,
    language,
    code,
    intervalMs: 6000,
  });

  // ─── 3. Authoritative Timer & Auto-Submit ──────────────────────────────────
  const handleAutoSubmit = useCallback(async () => {
    toast.error("Assessment time has expired! Auto-submitting solutions...", { duration: 6000 });
    try {
      await api.post(`/api/coding/attempts/${attemptId}/complete`, { autoSubmitted: true }, { headers });
      navigate(`/coding-assessment/result/${attemptId}`);
    } catch {
      navigate(`/coding-assessment/result/${attemptId}`);
    }
  }, [attemptId, headers, navigate]);

  const { formattedTime, isLowTime, isCritical } = useCodingTimer({
    expiresAt,
    onTimeUp: handleAutoSubmit,
    active: !loading && !error,
  });

  // ─── 4. Switch Question ────────────────────────────────────────────────────
  const handleSelectQuestion = (idx) => {
    if (idx === currentIndex) return;

    // Cache current code before switching
    if (activeQuestion) {
      codeCacheRef.current[`${activeQuestion._id}_${language}`] = code;
      triggerSave();
    }

    const nextQ = questions[idx];
    setCurrentIndex(idx);
    setSampleResults([]);
    setSubmissionData(null);
    setCompileOutput("");
    setCustomOutput(null);

    // Restore cached or default starter code
    if (nextQ) {
      const cached = codeCacheRef.current[`${nextQ._id}_${language}`];
      const starter =
        nextQ.starterCodeByLanguage?.[language] ||
        (typeof nextQ.starterCode === "string" ? nextQ.starterCode : STARTER_CODES[language]);
      const initialCode = cached || starter || STARTER_CODES[language];
      setCode(initialCode);
      markInitialCodeAsSaved(initialCode);
    }
  };

  // ─── 5. Switch Language ────────────────────────────────────────────────────
  const handleLanguageChange = (newLang) => {
    if (newLang === language) return;

    // Cache current code under old language
    if (activeQuestion) {
      codeCacheRef.current[`${activeQuestion._id}_${language}`] = code;
    }

    setLanguage(newLang);

    // Restore cached under new language or starter code
    if (activeQuestion) {
      const cached = codeCacheRef.current[`${activeQuestion._id}_${newLang}`];
      const starter =
        activeQuestion.starterCodeByLanguage?.[newLang] ||
        (typeof activeQuestion.starterCode === "string" ? activeQuestion.starterCode : STARTER_CODES[newLang]);
      const codeForLang = cached || starter || STARTER_CODES[newLang];
      setCode(codeForLang);
      markInitialCodeAsSaved(codeForLang);
    }
  };

  // ─── 6. Reset Code to Starter ──────────────────────────────────────────────
  const handleResetCode = () => {
    if (!activeQuestion) return;
    const starter =
      activeQuestion.starterCodeByLanguage?.[language] ||
      (typeof activeQuestion.starterCode === "string" ? activeQuestion.starterCode : STARTER_CODES[language]);
    const cleanStarter = starter || STARTER_CODES[language];
    setCode(cleanStarter);
    codeCacheRef.current[`${activeQuestion._id}_${language}`] = cleanStarter;
    toast.success("Code reset to starter template.");
  };

  // ─── 7. Run Sample Tests ───────────────────────────────────────────────────
  const handleRunSample = async () => {
    if (!activeQuestion || !code.trim()) {
      toast.error("Please write your code before running tests.");
      return;
    }

    setRunning(true);
    setRunStage("Compiling...");
    setActiveResultTab("sample");
    setCompileOutput("");

    try {
      await new Promise((r) => setTimeout(r, 200));
      setRunStage("Running tests...");

      const res = await api.post(
        "/api/coding/run",
        {
          questionId: activeQuestion._id,
          language,
          sourceCode: code,
        },
        { headers }
      );

      const data = res.data?.data || {};
      setSampleResults(data.results || []);

      const compileErr = (data.results || []).find((r) => r.status === "COMPILATION_ERROR")?.error;
      if (compileErr) {
        setCompileOutput(compileErr);
      }

      if (data.status === "ACCEPTED") {
        toast.success(`✓ All ${data.passedCount}/${data.totalCount} sample testcases passed!`);
      } else {
        toast.error(`Sample tests failed (${data.passedCount || 0}/${data.totalCount || 0} passed).`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to execute sample tests.");
    } finally {
      setRunning(false);
      setRunStage(null);
    }
  };

  // ─── 8. Run Custom Input ───────────────────────────────────────────────────
  const handleRunCustom = async () => {
    if (!code.trim()) {
      toast.error("Source code is required.");
      return;
    }

    setRunning(true);
    try {
      const res = await api.post(
        "/api/coding/run-custom",
        {
          language,
          sourceCode: code,
          customInput,
        },
        { headers }
      );
      setCustomOutput(res.data?.data || {});
    } catch (err) {
      toast.error(err.response?.data?.message || "Custom input execution failed.");
    } finally {
      setRunning(false);
    }
  };

  // ─── 9. Submit Question (Hidden + Sample Test Cases) ───────────────────────
  const handleSubmitQuestion = async () => {
    setSubmitConfirmOpen(false);
    if (!activeQuestion || !code.trim()) return;

    setSubmitting(true);
    try {
      const res = await api.post(
        "/api/coding/submit",
        {
          attemptId,
          questionId: activeQuestion._id,
          language,
          sourceCode: code,
        },
        { headers }
      );

      const data = res.data?.data || {};
      setSubmissionData(data);
      setActiveResultTab("hidden");

      // Update question progress locally
      setQuestionProgress((prev) =>
        prev.map((qp) => {
          if (String(qp.questionId) === String(activeQuestion._id)) {
            return {
              ...qp,
              status: data.status === "ACCEPTED" ? "SOLVED" : data.passedTests > 0 ? "PARTIAL" : "FAILED",
              passedTests: data.passedTests,
              totalTests: data.totalTests,
              marks: data.score,
            };
          }
          return qp;
        })
      );

      if (data.status === "ACCEPTED") {
        toast.success(`🎉 Problem Solved! All ${data.passedTests}/${data.totalTests} tests passed. Full ${data.score} marks!`);
      } else {
        toast.error(`Submitted: ${data.passedTests}/${data.totalTests} tests passed. Score: ${data.score}/${data.maxMarks}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit solution.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── 10. Complete Entire Assessment ────────────────────────────────────────
  const handleFinishAssessment = async () => {
    setFinishConfirmOpen(false);
    setSubmitting(true);

    try {
      // Autosave current code first
      if (activeQuestion && code) {
        await api.post(
          "/api/coding/autosave",
          { attemptId, questionId: activeQuestion._id, language, sourceCode: code },
          { headers }
        ).catch(() => {});
      }

      await api.post(`/api/coding/attempts/${attemptId}/complete`, {}, { headers });
      toast.success("Assessment submitted successfully!");
      navigate(`/coding-assessment/result/${attemptId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit assessment.");
    } finally {
      setSubmitting(false);
    }
  };

  const solvedCount = useMemo(() => {
    return questionProgress.filter((qp) => qp.status === "SOLVED").length;
  }, [questionProgress]);

  // Loading state
  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex flex-col items-center justify-center space-y-3 bg-[var(--bg-primary)]">
        <Loader2 className="w-9 h-9 animate-spin text-cyan-400" />
        <p className="text-xs font-bold text-[var(--text-secondary)]">
          Setting up sandboxed coding environment...
        </p>
      </div>
    );
  }

  // Error state
  if (error || !assessment || questions.length === 0) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-[var(--bg-primary)]">
        <div className="max-w-md w-full p-6 rounded-2xl border text-center space-y-3 bg-[var(--card-bg)]" style={{ borderColor: "var(--border)" }}>
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h2 className="text-base font-bold text-[var(--text-primary)]">Could Not Load Assessment</h2>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {error || "No questions found assigned to this assessment."}
          </p>
          <button
            type="button"
            onClick={() => navigate("/coding-assessments")}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 text-white cursor-pointer hover:bg-cyan-600 transition"
          >
            Back to Assessments
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col bg-[var(--bg-primary)] ${
        fullscreen ? "fixed inset-0 z-50 h-screen w-screen overflow-hidden" : "h-[calc(100vh-64px)] overflow-hidden"
      }`}
    >
      {/* ── TOP HEADER ── */}
      <CodingHeader
        assessmentTitle={assessment.title}
        currentIndex={currentIndex}
        totalQuestions={questions.length}
        formattedTime={formattedTime}
        isLowTime={isLowTime}
        isCritical={isCritical}
        saveStatus={saveStatus}
        onSubmitAssessment={() => setFinishConfirmOpen(true)}
        onExit={() => navigate("/coding-assessments")}
        solvedCount={solvedCount}
      />

      {/* ── MAIN ASSESSMENT IDE LAYOUT ── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* LEFT COLUMN: Question Navigator */}
        <div className="lg:w-60 shrink-0 border-b lg:border-b-0 h-40 lg:h-full overflow-hidden">
          <QuestionNavigator
            questions={questions}
            currentIndex={currentIndex}
            onSelectQuestion={handleSelectQuestion}
            questionProgress={questionProgress}
          />
        </div>

        {/* CENTER COLUMN: Problem Statement Panel */}
        <div
          className="lg:w-[40%] flex flex-col border-r h-full overflow-hidden shrink-0"
          style={{
            borderColor: "var(--border)",
            background: "var(--card-bg)",
          }}
        >
          <ProblemPanel question={activeQuestion} />
        </div>

        {/* RIGHT COLUMN: Monaco Editor + Terminal + Test Results */}
        <div className="flex-1 flex flex-col h-full overflow-hidden min-h-0 bg-[var(--bg-secondary)]">
          {/* Editor Toolbar */}
          <EditorToolbar
            language={language}
            onLanguageChange={handleLanguageChange}
            onRun={handleRunSample}
            onSubmit={() => setSubmitConfirmOpen(true)}
            onReset={handleResetCode}
            running={running}
            submitting={submitting}
            runStage={runStage}
            showCustomInput={showCustomInput}
            onToggleCustomInput={() => setShowCustomInput((v) => !v)}
            wordWrap={wordWrap}
            onToggleWordWrap={() => setWordWrap((v) => !v)}
            fullscreen={fullscreen}
            onToggleFullscreen={() => setFullscreen((v) => !v)}
            code={code}
          />

          {/* Monaco Code Editor */}
          <div className="flex-1 overflow-hidden min-h-0 relative">
            <MonacoCodeEditor
              code={code}
              language={language}
              onChange={setCode}
              theme={theme}
              wordWrap={wordWrap}
            />
          </div>

          {/* Optional Custom Input Panel */}
          {showCustomInput && (
            <CustomInputPanel
              customInput={customInput}
              onChangeCustomInput={setCustomInput}
              onRunCustom={handleRunCustom}
              running={running}
              customOutput={customOutput}
              onClose={() => setShowCustomInput(false)}
            />
          )}

          {/* Bottom Test Results Panel */}
          <TestResultsPanel
            activeTab={activeResultTab}
            onTabChange={setActiveResultTab}
            sampleResults={sampleResults}
            submissionData={submissionData}
            compileOutput={compileOutput}
          />
        </div>
      </div>

      {/* Confirmation Modals */}
      <SubmissionModal
        isOpen={submitConfirmOpen}
        onClose={() => setSubmitConfirmOpen(false)}
        onConfirm={handleSubmitQuestion}
        title="Submit Problem Solution?"
        message="Your code will be evaluated against all official hidden test cases via Judge0. Your score for this question will be updated in the assessment."
        confirmText="Submit Solution"
        loading={submitting}
      />

      <SubmissionModal
        isOpen={finishConfirmOpen}
        onClose={() => setFinishConfirmOpen(false)}
        onConfirm={handleFinishAssessment}
        title="Finish Entire Coding Assessment?"
        message="Are you sure you want to finish and submit the assessment? All your question submissions will be locked and your final score will be calculated."
        confirmText="Finish & Submit"
        loading={submitting}
      />
    </div>
  );
}
