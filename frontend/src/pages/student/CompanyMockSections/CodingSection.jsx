import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Play, Code2, Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import api from "../../../utils/api";
import MonacoCodeEditor from "../../../components/coding/MonacoCodeEditor";
import { useTheme } from "../../../hooks/useTheme";

const LANGUAGES = [
  { id: "java", label: "Java" },
  { id: "cpp", label: "C++" },
  { id: "c", label: "C" },
  { id: "python", label: "Python" },
];

const DEFAULT_STARTER_CODE = {
  java: `class Solution {
    public static void main(String[] args) {
        // Write your solution here
    }
  }`,
  cpp: `#include <iostream>
using namespace std;

int main() {
    // Write your solution here
    return 0;
}`,
  c: `#include <stdio.h>

int main() {
    // Write your solution here
    return 0;
}`,
  python: `# Write your solution here
`,
};

function CodingSection({
  questions,
  currentIndex,
  drafts,
  selectedLanguage,
  onLanguageChange,
  onSaveDraft,
  attemptId,
  token,
}) {
  const { theme } = useTheme();
  const question = questions[currentIndex];
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [executionFailed, setExecutionFailed] = useState(false);

  const draftKey = question ? `${question.questionId}:${selectedLanguage}` : "";
  const currentCode =
    drafts[draftKey] ||
    question?.starterCode?.[selectedLanguage] ||
    DEFAULT_STARTER_CODE[selectedLanguage] ||
    "";

  const handleCodeChange = useCallback(
    (code) => {
      if (!question) return;
      onSaveDraft(question.questionId, selectedLanguage, code);
    },
    [question, selectedLanguage, onSaveDraft]
  );

  // Load all language drafts when the question changes (NOT on language switch —
  // switching language only changes which already-loaded draft is displayed).
  useEffect(() => {
    const loadDrafts = async () => {
      if (!attemptId || !question?.questionId) return;
      try {
        const { data } = await api.get(
          `/api/company-mock/draft/${attemptId}/${question.questionId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (data.drafts) {
          Object.entries(data.drafts).forEach(([lang, code]) => {
            onSaveDraft(question.questionId, lang, code);
          });
        } else if (data.code) {
          onSaveDraft(question.questionId, data.language || selectedLanguage, data.code);
        }
      } catch {
        // Draft may not exist yet
      }
    };
    loadDrafts();
  }, [question?.questionId, attemptId, token, onSaveDraft]);

  if (!question) {
    return (
      <div className="text-center py-12">
        <p style={{ color: "var(--text-muted)" }}>No coding questions available.</p>
      </div>
    );
  }

  const handleRun = async () => {
    setRunning(true);
    setOutput("");
    setTestResults(null);
    setExecutionFailed(false);

    try {
      const { data } = await api.post(
        "/api/code/run",
        {
          language: selectedLanguage,
          code: currentCode,
          input: question.sampleInput || "",
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Backend contract (codeExecutionController.runCode):
      //   { type: "success", output, timeMs }
      //   { type: "error", output, timeMs, errorType }  (compile_error | runtime_error | execution_error | time_limit | ...)
      //   { type: "info", output, timeMs, language }     (unsupported language)
      const type = data.type || "success";
      if (type === "success") {
        setExecutionFailed(false);
        setOutput(data.output ?? data.stdout ?? "No output");
      } else if (type === "info") {
        setExecutionFailed(false);
        setOutput(data.output ?? "No output");
      } else if (type === "error") {
        const et = data.errorType;
        setExecutionFailed(et === "execution_error");
        if (et === "compile_error") {
          setOutput(`Compile Error:\n${data.output || ""}`);
        } else if (et === "runtime_error") {
          setOutput(`Runtime Error:\n${data.output || ""}`);
        } else if (et === "time_limit") {
          setOutput(`Time Limit Exceeded:\n${data.output || ""}`);
        } else {
          setOutput(data.output || "Execution Error");
        }
      } else {
        setExecutionFailed(false);
        setOutput(data.output ?? data.stdout ?? "No output");
      }
    } catch (error) {
      const status = error.response?.status;
      const msg = error.response?.data?.message;
      setExecutionFailed(true);
      // PART 18 — distinguish validation failures from execution-infrastructure failures.
      if (status === 400) {
        setOutput(`Validation Error\n${msg || "Invalid request"}`);
      } else {
        setOutput(msg ? `Execution Error\nBackend: ${msg}` : "Execution Error");
      }
    } finally {
      setRunning(false);
    }
  };

  const handleSubmitCode = async () => {
    setRunning(true);
    setTestResults(null);
    setExecutionFailed(false);
    setOutput("");

    try {
      const { data } = await api.post(
        "/api/company-mock/coding-submit",
        {
          attemptId,
          questionId: question.questionId,
          language: selectedLanguage,
          code: currentCode,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Backend contract (companyMockController.submitCodingAnswer):
      //   { status: "accepted" | "failed" | "compile_error" | "runtime_error"
      //            | "time_limit" | "execution_error",
      //     passedCount, totalCount, results, compileOutput }
      setTestResults(data);
      setExecutionFailed(data.status === "execution_error");

      if (data.status === "accepted") {
        setOutput("All test cases passed!");
      } else if (data.status === "compile_error") {
        setOutput(`Compile Error:\n${data.compileOutput || ""}`);
      } else if (data.status === "runtime_error") {
        setOutput(`Runtime Error:\n${(data.results && data.results[0]?.error) || data.compileOutput || ""}`);
      } else if (data.status === "time_limit") {
        setOutput(`Time Limit Exceeded:\n${data.compileOutput || ""}`);
      } else if (data.status === "execution_error") {
        setOutput(`Execution Error:\n${data.compileOutput || data.message || ""}`);
      } else {
        setOutput(`${data.passedCount ?? 0}/${data.totalCount ?? 0} test cases passed`);
      }
    } catch (error) {
      const status = error.response?.status;
      const msg = error.response?.data?.message;
      setExecutionFailed(true);
      // PART 18 — Validation Error for malformed requests, Execution Error for infra failures.
      if (status === 400) {
        setOutput(`Validation Error\n${msg || "Invalid request"}`);
      } else {
        setOutput(msg ? `Execution Error\nBackend: ${msg}` : "Execution Error");
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="student-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold uppercase bg-green-500/10 text-green-500">
              Coding
            </span>
            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold uppercase bg-gray-500/10 text-gray-500">
              {question.difficulty || "Medium"}
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              Q{currentIndex + 1} of {questions.length}
            </span>
          </div>

          <h3 className="text-lg font-bold mb-4" style={{ color: "var(--text-primary)" }}>
            {question.title || question.problemTitle}
          </h3>

          <div className="space-y-4 text-sm" style={{ color: "var(--text-secondary)" }}>
            <div>
              <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Problem:</p>
              <p className="whitespace-pre-wrap">{question.description || question.problemStatement}</p>
            </div>

            {question.sampleInput && (
              <div>
                <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Sample Input:</p>
                <pre className="font-mono text-xs bg-[var(--bg-primary)] p-2 rounded">{question.sampleInput}</pre>
              </div>
            )}

            {question.sampleOutput && (
              <div>
                <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Sample Output:</p>
                <pre className="font-mono text-xs bg-[var(--bg-primary)] p-2 rounded">{question.sampleOutput}</pre>
              </div>
            )}
          </div>
        </div>

        <div className="student-card p-6 flex flex-col min-h-[480px]">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.id}
                onClick={() => onLanguageChange(lang.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  selectedLanguage === lang.id
                    ? "bg-[var(--primary)] text-white"
                    : "bg-[var(--bg-primary)] text-[var(--text-secondary)]"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-[300px] border rounded-xl overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <MonacoCodeEditor
              key={question.questionId}
              code={currentCode}
              language={selectedLanguage}
              onChange={handleCodeChange}
              theme={theme}
              wordWrap={false}
            />
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleRun}
              disabled={running}
              className="flex-1 py-2.5 rounded-xl border text-sm font-semibold cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run
            </button>
            <button
              onClick={handleSubmitCode}
              disabled={running}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Code2 className="w-4 h-4" />}
              Submit
            </button>
          </div>

          {(output || testResults) && (
            <div className="mt-4 p-4 rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Output:</p>
              {testResults ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {testResults.status === "accepted" ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm font-semibold" style={{ color: testResults.status === "accepted" ? "var(--success)" : "var(--error)" }}>
                      {testResults.passedCount}/{testResults.totalCount} test cases passed
                    </span>
                  </div>
                  {testResults.results?.map((result, idx) => (
                    <div key={idx} className="text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        {result.passed ? (
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        ) : (
                          <XCircle className="w-3 h-3 text-red-500" />
                        )}
                        <span>Test {idx + 1}: {result.passed ? "Passed" : result.error || "Wrong Answer"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  {executionFailed ? (
                    <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
                  )}
                  <pre className="text-xs font-mono whitespace-pre-wrap flex-1" style={{ color: "var(--text-primary)" }}>
                    {output}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default CodingSection;
