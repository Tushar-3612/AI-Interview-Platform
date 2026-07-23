import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { ArrowLeft, Play, Save, CheckCircle2, XCircle, AlertTriangle, HelpCircle, Code, ListTodo } from "lucide-react";
import codingQuestionsList from "../../data/coding.json";
import { COMPANIES } from "../../data/companies";
import Button from "../../components/ui/Button";

function CodingRound() {
  const { companyId } = useParams();
  const navigate = useNavigate();

  const company = COMPANIES.find((c) => c.id === companyId);
  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [activeTab, setActiveTab] = useState(0); // 0: Easy, 1: Medium, 2: Hard
  const [userCode, setUserCode] = useState("");
  const [testResults, setTestResults] = useState(null);
  const [solvedStatuses, setSolvedStatuses] = useState({ 0: false, 1: false, 2: false });
  const [codeDrafts, setCodeDrafts] = useState({}); // Stores user code draft per question ID

  useEffect(() => {
    if (!companyId) return;

    const sessionKey = `practice-session-${companyId}`;
    const stored = localStorage.getItem(sessionKey);
    let currentSession = stored ? JSON.parse(stored) : null;

    if (!currentSession) {
      currentSession = {
        companyId,
        rounds: {
          aptitude: { completed: false, score: null, maxScore: 30 },
          technical: { completed: false, score: null, maxScore: 100 },
          coding: { completed: false, score: null, maxScore: 3 }
        }
      };
    }

    setSession(currentSession);

    // Initialize or load coding questions
    if (currentSession.rounds.coding.questions && currentSession.rounds.coding.questions.length === 3) {
      setQuestions(currentSession.rounds.coding.questions);
      const drafts = currentSession.rounds.coding.codeDrafts || {};
      setCodeDrafts(drafts);
      
      const q = currentSession.rounds.coding.questions[0];
      setUserCode(drafts[q.id] || q.starterCode);

      const savedStatuses = currentSession.rounds.coding.solvedStatuses || { 0: false, 1: false, 2: false };
      setSolvedStatuses(savedStatuses);
    } else {
      // Pick 1 Easy, 1 Medium, 1 Hard coding questions for this company
      const companyCoding = codingQuestionsList.filter((q) => q.companyId === companyId);
      const easies = companyCoding.filter((q) => q.difficulty === "Easy");
      const mediums = companyCoding.filter((q) => q.difficulty === "Medium");
      const hards = companyCoding.filter((q) => q.difficulty === "Hard");

      const selectOneRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

      const picked = [
        selectOneRandom(easies),
        selectOneRandom(mediums),
        selectOneRandom(hards)
      ].filter(Boolean); // Handle if any difficulty is missing

      setQuestions(picked);
      currentSession.rounds.coding.questions = picked;
      
      const initialDrafts = {};
      picked.forEach((q) => {
        initialDrafts[q.id] = q.starterCode;
      });
      setCodeDrafts(initialDrafts);
      setUserCode(picked[0]?.starterCode || "");

      currentSession.rounds.coding.codeDrafts = initialDrafts;
      currentSession.rounds.coding.solvedStatuses = { 0: false, 1: false, 2: false };
      currentSession.rounds.coding.answers = {};
      currentSession.rounds.coding.results = {};

      localStorage.setItem(sessionKey, JSON.stringify(currentSession));
    }
  }, [companyId]);

  // Sync draft code on change of code
  const handleCodeChange = (code) => {
    setUserCode(code);
    if (questions[activeTab]) {
      const qId = questions[activeTab].id;
      const nextDrafts = { ...codeDrafts, [qId]: code };
      setCodeDrafts(nextDrafts);

      // Save code draft state
      if (session) {
        const sessionKey = `practice-session-${companyId}`;
        const updated = { ...session };
        updated.rounds.coding.codeDrafts = nextDrafts;
        localStorage.setItem(sessionKey, JSON.stringify(updated));
      }
    }
  };

  // Tab switching
  const handleTabChange = (idx) => {
    setActiveTab(idx);
    setTestResults(null);
    const q = questions[idx];
    if (q) {
      setUserCode(codeDrafts[q.id] || q.starterCode);
    }
  };

  // Safely execute code against test cases
  const runEvaluation = (runOnly = false) => {
    const q = questions[activeTab];
    if (!q) return;

    // Get the function name based on difficulty/title mapping in JSON
    let functionName = "";
    if (q.starterCode.includes("function findSecondLargest")) functionName = "findSecondLargest";
    else if (q.starterCode.includes("function longestSubarray")) functionName = "longestSubarray";
    else if (q.starterCode.includes("function mergeIntervals")) functionName = "mergeIntervals";
    else if (q.starterCode.includes("function isValid")) functionName = "isValid";
    else if (q.starterCode.includes("function maxArea")) functionName = "maxArea";
    else if (q.starterCode.includes("function trap")) functionName = "trap";
    else if (q.starterCode.includes("function findDuplicate")) functionName = "findDuplicate";
    else if (q.starterCode.includes("function searchRotated")) functionName = "searchRotated";
    else if (q.starterCode.includes("function findMedianSortedArrays")) functionName = "findMedianSortedArrays";
    else if (q.starterCode.includes("function reverseWords")) functionName = "reverseWords";
    else if (q.starterCode.includes("function findKthLargest")) functionName = "findKthLargest";
    else if (q.starterCode.includes("function longestConsecutive")) functionName = "longestConsecutive";

    const results = q.testCases.map((tc, tcIdx) => {
      let passed = false;
      let actual = "";
      let error = null;

      try {
        // Parse input argument array safely
        const args = JSON.parse(`[${tc.input}]`);
        
        // Wrap user code in Function context and execute
        const executionBody = `
          ${userCode}
          if (typeof ${functionName} !== 'function') {
            throw new Error('Function "${functionName}" not found. Do not rename the function.');
          }
          return ${functionName}.apply(null, arguments[0]);
        `;

        const evaluator = new Function("args", executionBody);
        const output = evaluator(args);
        
        actual = JSON.stringify(output);

        // Normalize comparison
        const expectedObj = JSON.parse(tc.expected);
        const actualObj = JSON.parse(actual);
        passed = JSON.stringify(expectedObj) === JSON.stringify(actualObj);
      } catch (err) {
        passed = false;
        error = err.message;
        actual = "Error";
      }

      return {
        id: tcIdx + 1,
        input: tc.input,
        expected: tc.expected,
        actual,
        passed,
        error
      };
    });

    const allPassed = results.every((r) => r.passed);
    setTestResults({ results, allPassed });

    if (allPassed) {
      toast.success("All test cases passed!");
      const nextStatuses = { ...solvedStatuses, [activeTab]: true };
      setSolvedStatuses(nextStatuses);

      // Save solved status in session
      if (session) {
        const sessionKey = `practice-session-${companyId}`;
        const updated = { ...session };
        updated.rounds.coding.solvedStatuses = nextStatuses;
        updated.rounds.coding.answers[q.id] = userCode;
        updated.rounds.coding.results[q.id] = { passed: true, results };
        localStorage.setItem(sessionKey, JSON.stringify(updated));
        setSession(updated);
      }
    } else {
      toast.error("Some test cases failed. Review console.");
    }
  };

  const handleResetCode = () => {
    if (window.confirm("Reset editor to starter code?")) {
      const q = questions[activeTab];
      if (q) {
        handleCodeChange(q.starterCode);
        setTestResults(null);
      }
    }
  };

  const handleFinishCodingRound = () => {
    const solvedCount = Object.values(solvedStatuses).filter(Boolean).length;
    if (solvedCount < questions.length) {
      if (!window.confirm(`You have only solved ${solvedCount} out of ${questions.length} questions. Are you sure you want to finish the coding round?`)) {
        return;
      }
    }

    const sessionKey = `practice-session-${companyId}`;
    const updated = { ...session };
    updated.rounds.coding.completed = true;
    updated.rounds.coding.score = solvedCount;

    localStorage.setItem(sessionKey, JSON.stringify(updated));
    toast.success("Coding Round completed!");
    navigate(`/interview-practice/${companyId}`);
  };

  if (!company || questions.length === 0) return null;

  const currentQ = questions[activeTab];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 flex flex-col h-[calc(100vh-5.5rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 shrink-0">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(`/interview-practice/${companyId}`)}
            className="flex items-center justify-center w-9 h-9 rounded-xl border cursor-pointer hover:bg-neutral-800 transition"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <span>Coding Round</span>
              <span className="text-xs px-2 py-0.5 rounded border uppercase" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                {company.name} Mock
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleFinishCodingRound} className="px-5 py-2 text-xs">
            Finish Coding Stage
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 shrink-0 border-b pb-2" style={{ borderColor: "var(--border)" }}>
        {questions.map((q, idx) => {
          const isSelected = activeTab === idx;
          const isSolved = solvedStatuses[idx];
          return (
            <button
              key={q.id}
              onClick={() => handleTabChange(idx)}
              className="px-4 py-2 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5"
              style={{
                background: isSelected
                  ? "var(--primary)"
                  : "color-mix(in srgb, var(--border) 10%, transparent)",
                color: isSelected ? "#fff" : "var(--text-secondary)",
              }}
            >
              <span>{q.difficulty} Challenge</span>
              {isSolved && <CheckCircle2 className="w-3.5 h-3.5 text-green-300" />}
            </button>
          );
        })}
      </div>

      {/* Main split work area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0 overflow-hidden">
        {/* Left pane: Details */}
        <div className="flex flex-col min-h-0 overflow-y-auto pr-2 space-y-4">
          <div className="student-card p-6 space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Question {activeTab + 1}:
              </span>
              <h2 className="text-lg font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>
                {currentQ.title}
              </h2>
            </div>

            <div
              className="text-sm leading-relaxed p-4 rounded-2xl whitespace-pre-line"
              style={{ background: "var(--input-bg)", color: "var(--text-secondary)" }}
            >
              {currentQ.problemStatement}
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase text-neutral-400 mb-1">Constraints</h4>
              <pre className="text-xs font-mono p-3 rounded-xl border whitespace-pre-wrap" style={{ borderColor: "var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
                {currentQ.constraints}
              </pre>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-bold uppercase text-neutral-400 mb-1">Sample Input</h4>
                <pre className="text-xs font-mono p-3 rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
                  {currentQ.sampleInput}
                </pre>
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase text-neutral-400 mb-1">Sample Output</h4>
                <pre className="text-xs font-mono p-3 rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
                  {currentQ.sampleOutput}
                </pre>
              </div>
            </div>
          </div>

          {/* Test results inside left pane */}
          {testResults && (
            <div className="student-card p-6 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-neutral-400" />
                <span>Test Execution Results</span>
                <span className={`text-xs px-2 py-0.5 rounded font-mono ${testResults.allPassed ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                  {testResults.allPassed ? "ALL PASSED" : "SOME FAILED"}
                </span>
              </h3>

              <div className="space-y-3">
                {testResults.results.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-xl border text-xs font-mono flex flex-col gap-2"
                    style={{ borderColor: r.passed ? "var(--success)" : "var(--error)", background: "var(--input-bg)" }}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>Test Case {r.id}</span>
                      {r.passed ? (
                        <span className="text-green-500 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Passed</span>
                      ) : (
                        <span className="text-red-500 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Failed</span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-neutral-400">
                      <div>
                        <span>Input: </span>
                        <code className="text-neutral-200">{r.input}</code>
                      </div>
                      <div>
                        <span>Expected: </span>
                        <code className="text-neutral-200">{r.expected}</code>
                      </div>
                    </div>

                    {!r.passed && (
                      <div className="pt-1.5 border-t border-dashed text-red-400" style={{ borderColor: "color-mix(in srgb, var(--error) 20%, transparent)" }}>
                        {r.error ? (
                          <span>Error: {r.error}</span>
                        ) : (
                          <span>Actual Output: {r.actual}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right pane: Code Editor */}
        <div className="flex flex-col min-h-0 student-card overflow-hidden">
          {/* Editor Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}>
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-neutral-400" />
              <span className="text-xs font-bold font-mono text-neutral-200">solution.js</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetCode}
                className="text-xs px-3 py-1.5 rounded-lg border cursor-pointer hover:bg-neutral-800 transition"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => runEvaluation(false)}
                className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3.5 py-1.5 rounded-lg cursor-pointer transition"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Run Tests
              </button>
            </div>
          </div>

          {/* Text Area Code Editor */}
          <div className="flex-1 min-h-0 relative p-4 flex gap-4" style={{ background: "#0d0d0d" }}>
            <textarea
              value={userCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              className="flex-1 w-full h-full font-mono text-sm leading-relaxed text-emerald-400 bg-transparent border-0 outline-none resize-none align-top p-0 select-text"
              style={{
                fontFamily: "Fira Code, JetBrains Mono, source-code-pro, Menlo, Monaco, Consolas, monospace",
                lineHeight: "1.6"
              }}
              placeholder="// Write your JavaScript code here..."
              spellCheck="false"
            />
          </div>

          {/* Quick Guidance Alert */}
          <div className="p-3 border-t text-[11px] leading-relaxed text-neutral-400 shrink-0 flex items-center gap-2" style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}>
            <HelpCircle className="w-4 h-4 shrink-0 text-neutral-400" />
            <span>Write your function solution inside the editor. Run test cases to compile and execute locally. Complete all 3 tasks!</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CodingRound;
