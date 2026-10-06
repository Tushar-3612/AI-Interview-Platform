import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Flag, Send, AlertTriangle, Clock,
  CheckCircle, XCircle, Circle, BookOpen, Code, Maximize2,
  ShieldAlert, WifiOff, RefreshCw, EyeOff, Lock,
} from "lucide-react";
import api from "../../../core/api/api.js";
import { getAuthToken } from "../../student/hooks/useStudentProfile.js";
import toast from "react-hot-toast";
import CodingQuestionRenderer from "../../codingAssessment/components/CodingQuestionRenderer.jsx";
import SecureCanvasQuestionRenderer from "../components/SecureCanvasQuestionRenderer.jsx";
import { useExamLockdown } from "../hooks/useExamLockdown.js";

function Timer({ endTime, durationMinutes = 30, serverOffset = 0, onTimeUp }) {
  const [display, setDisplay] = useState("00:00:00");

  useEffect(() => {
    let targetEnd = NaN;
    if (endTime) {
      const parsed = new Date(endTime).getTime();
      if (!isNaN(parsed) && parsed > 0) {
        targetEnd = parsed;
      }
    }
    if (isNaN(targetEnd)) {
      targetEnd = Date.now() + (Number(durationMinutes) || 30) * 60000;
    }

    const tick = () => {
      const now = Date.now() + serverOffset;
      const diff = Math.max(0, targetEnd - now);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      const safeH = isNaN(h) ? "00" : String(h).padStart(2, "0");
      const safeM = isNaN(m) ? "00" : String(m).padStart(2, "0");
      const safeS = isNaN(s) ? "00" : String(s).padStart(2, "0");

      setDisplay(`${safeH}:${safeM}:${safeS}`);
      if (diff <= 0 && onTimeUp) onTimeUp();
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endTime, durationMinutes, serverOffset, onTimeUp]);

  const isLow = display.startsWith("00:0") || display.startsWith("00:00:");
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-mono font-bold ${
      isLow ? "bg-red-50 dark:bg-red-950/20 text-red-600" : "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600"
    }`}>
      <Clock className="w-4 h-4" /> {display}
    </div>
  );
}

function MCQRenderer({ question, questionIndex = 0, totalQuestions = 1, answer, onAnswer }) {
  const letters = ["A", "B", "C", "D"];
  if (!question) return <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>Question unavailable</p>;

  const difficulty = (question.difficulty || "medium").toLowerCase();
  const diffBadgeColor = difficulty === "easy"
    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
    : difficulty === "hard"
    ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";

  return (
    <div className="space-y-5">
      {/* Question Card Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b admin-table-divider">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold text-white shadow-sm" style={{ background: "var(--primary)" }}>
            Q{questionIndex + 1}
          </span>
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold border capitalize admin-bg-surface" style={{ color: "var(--text-secondary)" }}>
            {question.type || (question.subject ? question.subject : "MCQ")}
          </span>
          <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border capitalize ${diffBadgeColor}`}>
            {difficulty}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg admin-bg-surface" style={{ color: "var(--text-primary)" }}>
          <span>+{question.marks || 1} mark{question.marks !== 1 ? "s" : ""}</span>
          {question.negativeMarks > 0 && (
            <span className="text-red-500 text-[10px]">(-{question.negativeMarks})</span>
          )}
        </div>
      </div>

      {/* Question Text */}
      <div className="text-sm sm:text-base font-semibold leading-relaxed tracking-normal py-1" style={{ color: "var(--text-primary)" }}>
        {question.question || question.title || question.description}
      </div>

      {/* Options List */}
      <div className="grid grid-cols-1 gap-2.5 pt-1">
        {question.options?.map((opt, idx) => {
          if (!opt) return null;
          const letter = letters[idx] || String.fromCharCode(65 + idx);
          const isSelected = answer === letter;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onAnswer(letter)}
              className={`flex items-center gap-3.5 p-3.5 sm:p-4 rounded-xl border text-xs sm:text-sm text-left cursor-pointer transition-all duration-150 active:scale-[0.99] ${
                isSelected
                  ? "border-[var(--primary)] ring-1 ring-[var(--primary)] shadow-sm"
                  : "admin-border admin-hover hover:border-gray-400 dark:hover:border-zinc-600"
              }`}
              style={{
                background: isSelected
                  ? "color-mix(in srgb, var(--primary) 10%, transparent)"
                  : "var(--card-bg, transparent)",
              }}
            >
              <span
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 transition-all ${
                  isSelected
                    ? "text-white shadow-sm"
                    : "border admin-border"
                }`}
                style={{
                  background: isSelected ? "var(--primary)" : "var(--admin-bg-surface)",
                  color: isSelected ? "#fff" : "var(--text-secondary)",
                }}
              >
                {letter}
              </span>
              <span
                className={`flex-1 leading-snug ${isSelected ? "font-semibold" : "font-normal"}`}
                style={{ color: isSelected ? "var(--text-primary)" : "var(--text-primary)" }}
              >
                {opt}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SubmitConfirm({ stats, onConfirm, onClose, submitting }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={submitting ? undefined : onClose}>
      <div className="bg-white dark:bg-[#18181b] rounded-2xl border border-gray-200 dark:border-zinc-800 w-full max-w-sm mx-4 p-6 space-y-4 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="text-center">
          <Send className="w-10 h-10 mx-auto mb-2 text-orange-500" style={{ color: "var(--primary)" }} />
          <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Submit Test?</h3>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Review your progress before final submission.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          {[
            ["Answered", stats.answered, "var(--badge-success-text)"],
            ["Skipped", stats.skipped, "var(--badge-warning-text)"],
            ["Marked", stats.marked, "var(--badge-info-text)"],
            ["Not Visited", stats.notVisited, "var(--badge-error-text)"],
          ].map(([l, v, c]) => (
            <div key={l} className="p-3 rounded-xl admin-bg-surface text-center">
              <p className="text-lg font-bold" style={{ color: c }}>{v}</p>
              <p style={{ color: "var(--text-muted)" }}>{l}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 text-xs font-medium border admin-border rounded-xl admin-hover cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 py-2.5 text-xs font-medium text-white rounded-xl cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-75"
            style={{ background: "var(--primary)" }}
          >
            {submitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" /> Submit Now
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function TestEngine() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const token = getAuthToken();

  const [test, setTest] = useState(location.state?.test || null);
  const [attempt, setAttempt] = useState(location.state?.attempt || null);
  const [loading, setLoading] = useState(!test);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [proctoringError, setProctoringError] = useState(false);
  const [serverOffset, setServerOffset] = useState(0);
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [tabWarnings, setTabWarnings] = useState(0);
  const [endTime, setEndTime] = useState(null);
  const [saving, setSaving] = useState(false);

  const containerRef = useRef(null);
  const saveTimerRef = useRef(null);
  const lastSaveRef = useRef("");
  const heartbeatFailCountRef = useRef(0);

  // Sync test and attempt data
  useEffect(() => {
    if (test && attempt) return;
    const fetchAttempt = async () => {
      try {
        const { data } = await api.get(`/api/student/tests/attempt/${attemptId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAttempt(data);
        setTest(data.testId);
      } catch {
        toast.error("Failed to load test");
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    };
    fetchAttempt();
  }, [attemptId, token, test, attempt, navigate]);

  useEffect(() => {
    if (test) {
      setQuestions(test.questions || []);
    }
  }, [test]);

  useEffect(() => {
    if (attempt?.answers) {
      setAnswers(attempt.answers);
      setCurrentIdx(attempt.currentQuestionIndex || 0);
      const computedEnd = attempt.endTime || (attempt.startTime ? new Date(new Date(attempt.startTime).getTime() + (test?.duration || 30) * 60000).toISOString() : null);
      setEndTime(computedEnd);
      setTabWarnings(attempt.tabSwitchCount || 0);
      if (attempt.status === "completed" || attempt.status === "auto_submitted") {
        setSubmitted(true);
      }
    }
  }, [attempt, test]);

  // 3-strike violation handler (switches, minimizations, Alt+Tab, fullscreen exit)
  const reportViolation = useCallback(async (eventType = "tab_switch") => {
    if (submitted || !attemptId) return;
    try {
      const { data } = await api.post(`/api/student/tests/attempt/${attemptId}/tab-switch`, {
        eventType,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const newCount = typeof data.tabSwitchCount === "number" ? data.tabSwitchCount : null;
      if (newCount !== null) {
        setTabWarnings(newCount);
      } else {
        setTabWarnings(prev => prev + 1);
      }

      if (data.autoSubmitted || (newCount !== null ? newCount >= 3 : false)) {
        toast.error("🚨 3 of 3: Test auto-submitted", {
          id: "violation-auto-submit",
          duration: 5000,
        });
        setSubmitted(true);
        navigate(`/tests/result/${attemptId}`, { replace: true });
      } else if (newCount === 1) {
        toast.error("⚠️ Warning 1 of 3: Do not leave, switch, or minimize the test window", {
          id: "violation-warning",
          duration: 4000,
        });
      } else if (newCount === 2) {
        toast.error("🚨 Warning 2 of 3 (Final Warning): One more violation will auto-submit", {
          id: "violation-warning",
          duration: 5000,
        });
      }
    } catch (err) {
      console.warn("Violation reporting failed:", err);
      setProctoringError(true);
    }
  }, [attemptId, token, submitted, navigate]);

  // Integrity event logging for non-strike events
  const recordIntegrity = useCallback(async (eventType, durationSeconds = 0, details = {}) => {
    if (submitted || !attemptId) return;
    try {
      const { data } = await api.post(`/api/student/tests/attempt/${attemptId}/integrity-event`, {
        eventType,
        durationSeconds,
        details,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.autoSubmitted) {
        toast.error("Test auto-submitted due to security violation");
        setSubmitted(true);
        navigate(`/tests/result/${attemptId}`, { replace: true });
      }
    } catch (err) {
      console.warn("Integrity event reporting failed:", err);
      setProctoringError(true);
    }
  }, [attemptId, token, submitted, navigate]);

  // Determine if active question is coding
  const activeQuestion = questions[currentIdx];
  const isCoding = Boolean(
    activeQuestion?.type === "Coding" ||
    activeQuestion?.problemTitle ||
    (activeQuestion?.testCases && activeQuestion.testCases.length > 0)
  );

  // Candidate Watermark String
  const candidateWatermark = useMemo(() => {
    const candId = attempt?.userId?._id || attempt?.userId || "STUDENT_SESSION";
    const attShort = attemptId ? String(attemptId).slice(-6) : "SECURE";
    return `ID: ${candId} • ATT: ${attShort} • ${new Date().toLocaleDateString()}`;
  }, [attempt, attemptId]);

  // Hook into exam lockdown suite
  const {
    examState,
    isFullscreen,
    isAway,
    isDuplicateSession,
    enterFullscreen,
    resumeAssessment,
  } = useExamLockdown({
    attemptId,
    isCodingQuestion: isCoding,
    submitted,
    reportViolation,
    recordIntegrity,
  });

  // Heartbeat loop for telemetry & server clock synchronization
  const sendHeartbeat = useCallback(async () => {
    if (submitted || !attemptId) return;
    try {
      const res = await api.post(`/api/student/tests/attempt/${attemptId}/heartbeat`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.serverTime) {
        setServerOffset(new Date(res.data.serverTime).getTime() - Date.now());
      }
      if (res.data?.autoSubmitted) {
        toast.error("Test auto-submitted by server");
        setSubmitted(true);
        navigate(`/tests/result/${attemptId}`, { replace: true });
      }
      setProctoringError(false);
      heartbeatFailCountRef.current = 0;
    } catch (err) {
      console.warn("Heartbeat failed:", err);
      heartbeatFailCountRef.current += 1;
      if (heartbeatFailCountRef.current >= 2) {
        setProctoringError(true);
      }
    }
  }, [attemptId, token, submitted, navigate]);

  useEffect(() => {
    if (submitted || !attemptId) return;
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 15000);
    return () => clearInterval(interval);
  }, [sendHeartbeat, submitted, attemptId]);

  // Answer saving
  const saveCurrent = useCallback(async () => {
    if (!attemptId || submitted) return;
    const currentAnswer = answers[currentIdx];
    if (!currentAnswer) return;
    const serialized = JSON.stringify({
      answer: currentAnswer.answer,
      code: currentAnswer.code,
      language: currentAnswer.language,
      status: currentAnswer.status,
      codingScore: currentAnswer.codingScore,
      scoredMarks: currentAnswer.scoredMarks,
      passedCount: currentAnswer.passedCount,
      totalCount: currentAnswer.totalCount,
      executionStatus: currentAnswer.executionStatus,
    });
    if (serialized === lastSaveRef.current) return;
    lastSaveRef.current = serialized;
    setSaving(true);
    try {
      await api.post(`/api/student/tests/attempt/${attemptId}/answer`, {
        questionIndex: currentIdx,
        answer: currentAnswer.answer,
        code: currentAnswer.code,
        language: currentAnswer.language,
        status: currentAnswer.status,
        codingScore: currentAnswer.codingScore,
        passedCount: currentAnswer.passedCount,
        totalCount: currentAnswer.totalCount,
        executionStatus: currentAnswer.executionStatus,
        scoredMarks: currentAnswer.scoredMarks,
      }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.error?.includes("Deadline")) {
        toast.error("Test deadline has passed. Submitting test...");
        handleTimeUp();
      }
    } finally {
      setSaving(false);
    }
  }, [attemptId, answers, currentIdx, token, submitted]);

  useEffect(() => {
    saveTimerRef.current = setInterval(saveCurrent, 30000);
    return () => clearInterval(saveTimerRef.current);
  }, [saveCurrent]);

  useEffect(() => {
    lastSaveRef.current = "";
  }, [currentIdx]);

  const updateAnswer = (field, value) => {
    setAnswers(prev => prev.map((a, i) => i === currentIdx ? { ...a, [field]: value, status: field === "status" ? value : "answered" } : a));
  };

  const handleCodingSubmissionResult = useCallback((qIdx, res) => {
    const qMarks = questions[qIdx]?.marks || 10;
    const passedCount = res.passedCount || 0;
    const totalCount = res.totalCount || 0;
    const scoredMarks = totalCount > 0
      ? Math.round((passedCount / totalCount) * qMarks)
      : (res.status === "accepted" ? qMarks : 0);
    const codingScore = res.score !== undefined
      ? res.score
      : (totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : (res.status === "accepted" ? 100 : 0));
    const executionStatus = res.status || (passedCount === totalCount && totalCount > 0 ? "accepted" : "failed");

    setAnswers(prev => prev.map((a, i) => {
      if (i === qIdx) {
        return {
          ...a,
          status: "answered",
          codingScore,
          passedCount,
          totalCount,
          executionStatus,
          scoredMarks,
        };
      }
      return a;
    }));

    if (attemptId && !submitted) {
      const currentAnswer = answers[qIdx] || {};
      api.post(`/api/student/tests/attempt/${attemptId}/answer`, {
        questionIndex: qIdx,
        answer: currentAnswer.answer || "",
        code: currentAnswer.code || "",
        language: currentAnswer.language || "python",
        status: "answered",
        codingScore,
        passedCount,
        totalCount,
        executionStatus,
        scoredMarks,
      }, { headers: { Authorization: `Bearer ${token}` } }).catch(err => {
        console.warn("Failed to persist coding submission answer:", err.message);
      });
    }
  }, [attemptId, answers, questions, submitted, token]);

  const handleTimeUp = useCallback(async () => {
    if (submitted) return;
    toast("Time is up! Auto-submitting...", { icon: "⏰" });
    setSubmitted(true);
    try {
      await saveCurrent();
      await api.post(`/api/student/tests/attempt/${attemptId}/submit`, { forceSubmit: "auto" }, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // silent
    }
    navigate(`/tests/result/${attemptId}`, { replace: true });
  }, [attemptId, token, submitted, saveCurrent, navigate]);

  const handleSubmit = async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    try {
      await saveCurrent();
      await api.post(`/api/student/tests/attempt/${attemptId}/submit`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSubmitted(true);
      setSubmitConfirm(false);
      navigate(`/tests/result/${attemptId}`, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || "Failed to submit test");
      setSubmitting(false);
    }
  };

  const navigateTo = (idx) => {
    saveCurrent();
    setCurrentIdx(idx);
  };

  const stats = {
    answered: answers.filter(a => a.status === "answered").length,
    skipped: answers.filter(a => a.status === "skipped").length,
    marked: answers.filter(a => a.status === "marked").length,
    notVisited: answers.filter(a => a.status === "not_visited").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-8">
          <CheckCircle className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--success)" }} />
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Test Submitted</h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Redirecting to results...</p>
        </div>
      </div>
    );
  }

  const question = questions[currentIdx];
  const q = answers[currentIdx] || {};

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex flex-col select-none"
      style={{
        background: "var(--bg-primary)",
        userSelect: "none",
        WebkitUserSelect: "none",
        MozUserSelect: "none",
        msUserSelect: "none",
      }}
    >
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b admin-table-divider bg-white dark:bg-[#111]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>
              {test?.title || "Test"}
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full capitalize" style={{ background: "var(--admin-bg-surface)", color: "var(--text-muted)" }}>
              {test?.testType}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {saving && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Saving...</span>}
            <Timer endTime={endTime} durationMinutes={test?.duration || 30} serverOffset={serverOffset} onTimeUp={handleTimeUp} />
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
              <ShieldAlert className="w-3.5 h-3.5" /> Proctoring Active
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1" style={{ background: "var(--admin-bg-surface)" }}>
          <div className="h-full transition-all duration-500" style={{ width: `${(stats.answered / Math.max(questions.length, 1)) * 100}%`, background: "var(--primary)" }} />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Workspace */}
        {isCoding ? (
          <main className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#111]">
            {/* Coding Problem Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b admin-table-divider bg-white/70 dark:bg-[#111]/70 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                  Question {currentIdx + 1} of {questions.length}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>
                  Coding Assessment
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold px-2 py-0.5 rounded border admin-border" style={{ color: "var(--text-secondary)" }}>
                  Marks: {question?.marks || 0}
                </span>
              </div>
            </div>

            {/* Split IDE Canvas */}
            <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
              {question ? (
                <CodingQuestionRenderer
                  question={question}
                  questionSource="testQuestion"
                  questionIndex={currentIdx}
                  testId={test?._id}
                  initialCode={q.code}
                  initialLanguage={q.language || "python"}
                  onCodeChange={(v) => updateAnswer("code", v)}
                  onLanguageChange={(v) => updateAnswer("language", v)}
                  onSubmissionResult={(res) => handleCodingSubmissionResult(currentIdx, res)}
                />
              ) : (
                <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>Question unavailable</p>
              )}
            </div>

            {/* Docked Action Bar */}
            <div className="flex items-center justify-between px-4 py-2 border-t admin-table-divider bg-white dark:bg-[#111] shrink-0 z-10">
              <div className="flex items-center gap-2">
                <button onClick={() => navigateTo(Math.max(0, currentIdx - 1))} disabled={currentIdx === 0}
                  className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold border admin-border rounded-lg admin-hover cursor-pointer disabled:opacity-40">
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </button>
                <button onClick={() => { updateAnswer("status", "skipped"); navigateTo(Math.min(questions.length - 1, currentIdx + 1)); }}
                  disabled={currentIdx === questions.length - 1}
                  className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold border admin-border rounded-lg admin-hover cursor-pointer disabled:opacity-40">
                  Skip <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => updateAnswer("status", q.status === "marked" ? "answered" : "marked")}
                  className={`flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold border rounded-lg cursor-pointer transition ${
                    q.status === "marked" ? "border-[var(--primary)] text-[var(--primary)] bg-[var(--primary)]/10" : "admin-border admin-hover text-[var(--text-secondary)]"
                  }`}>
                  <Flag className="w-3.5 h-3.5" /> {q.status === "marked" ? "Unmark" : "Mark for Review"}
                </button>
                {currentIdx < questions.length - 1 ? (
                  <button onClick={() => { if (q.status === "not_visited") updateAnswer("status", "answered"); navigateTo(currentIdx + 1); }}
                    className="flex items-center gap-1 px-4 py-1.5 text-xs font-bold text-white rounded-lg cursor-pointer shadow-sm"
                    style={{ background: "var(--primary)" }}>
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button onClick={() => setSubmitConfirm(true)}
                    className="flex items-center gap-1 px-4 py-1.5 text-xs font-bold text-white rounded-lg cursor-pointer shadow-sm"
                    style={{ background: "var(--primary)" }}>
                    <Send className="w-3.5 h-3.5" /> Submit Test
                  </button>
                )}
              </div>
            </div>
          </main>
        ) : (
          <main className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50/30 dark:bg-zinc-950/30">
            {/* Scrollable Question Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center items-start">
              <div className="w-full max-w-3xl space-y-4">
                <div className="w-full">
                  {question ? (
                    <SecureCanvasQuestionRenderer
                      question={question}
                      questionIndex={currentIdx}
                      totalQuestions={questions.length}
                      answer={q.answer}
                      onAnswer={(v) => updateAnswer("answer", v)}
                      candidateWatermark={candidateWatermark}
                    />
                  ) : (
                    <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>Question unavailable</p>
                  )}
                </div>
              </div>
            </div>

            {/* Pinned Bottom Action Bar */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-t admin-table-divider bg-white dark:bg-[#111] shrink-0 z-10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigateTo(Math.max(0, currentIdx - 1))}
                  disabled={currentIdx === 0}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold border admin-border rounded-lg admin-hover cursor-pointer disabled:opacity-40 transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateAnswer("status", "skipped");
                    navigateTo(Math.min(questions.length - 1, currentIdx + 1));
                  }}
                  disabled={currentIdx === questions.length - 1}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold border admin-border rounded-lg admin-hover cursor-pointer disabled:opacity-40 transition"
                >
                  Skip <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateAnswer("status", q.status === "marked" ? "answered" : "marked")}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold border rounded-lg cursor-pointer transition ${
                    q.status === "marked"
                      ? "border-[var(--primary)] text-[var(--primary)] bg-[var(--primary)]/10"
                      : "admin-border admin-hover text-[var(--text-secondary)]"
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" /> {q.status === "marked" ? "Unmark" : "Mark for Review"}
                </button>
                {currentIdx < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (q.status === "not_visited") updateAnswer("status", "answered");
                      navigateTo(currentIdx + 1);
                    }}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white rounded-lg cursor-pointer shadow-sm hover:opacity-95 transition"
                    style={{ background: "var(--primary)" }}
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSubmitConfirm(true)}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white rounded-lg cursor-pointer shadow-sm hover:opacity-95 transition"
                    style={{ background: "var(--primary)" }}
                  >
                    <Send className="w-3.5 h-3.5" /> Submit Test
                  </button>
                )}
              </div>
            </div>
          </main>
        )}

        {/* Sidebar */}
        <aside className="w-64 shrink-0 border-l admin-table-divider overflow-y-auto bg-white dark:bg-[#111] hidden lg:block">
          <div className="p-4 space-y-4">
            <h4 className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Question Navigator</h4>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              {[
                { color: "var(--badge-success-text)", bg: "var(--badge-success-bg)", label: "Answered" },
                { color: "var(--badge-warning-text)", bg: "var(--badge-warning-bg)", label: "Skipped" },
                { color: "var(--badge-info-text)", bg: "var(--badge-info-bg)", label: "Marked" },
                { color: "var(--text-muted)", bg: "var(--admin-bg-surface)", label: "Not Visited" },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded" style={{ background: l.bg }} />
                  <span style={{ color: "var(--text-muted)" }}>{l.label}</span>
                </div>
              ))}
            </div>

            {/* Question Grid */}
            <div className="grid grid-cols-5 gap-1.5">
              {answers.map((a, idx) => {
                let bg = "var(--admin-bg-surface)";
                let color = "var(--text-muted)";
                if (idx === currentIdx) { bg = "var(--primary)"; color = "#fff"; }
                else if (a.status === "answered") { bg = "var(--badge-success-bg)"; color = "var(--badge-success-text)"; }
                else if (a.status === "marked") { bg = "var(--badge-info-bg)"; color = "var(--badge-info-text)"; }
                else if (a.status === "skipped") { bg = "var(--badge-warning-bg)"; color = "var(--badge-warning-text)"; }
                return (
                  <button key={idx} onClick={() => navigateTo(idx)}
                    className="w-8 h-8 rounded-lg text-[11px] font-semibold cursor-pointer transition-all hover:opacity-80"
                    style={{ background: bg, color }}>
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Summary */}
            <div className="pt-3 border-t admin-table-divider space-y-2 text-xs">
              <div className="flex justify-between">
                <span style={{ color: "var(--text-muted)" }}>Answered</span>
                <span className="font-semibold" style={{ color: "var(--badge-success-text)" }}>{stats.answered}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-muted)" }}>Skipped</span>
                <span className="font-semibold" style={{ color: "var(--badge-warning-text)" }}>{stats.skipped}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-muted)" }}>Marked</span>
                <span className="font-semibold" style={{ color: "var(--badge-info-text)" }}>{stats.marked}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-muted)" }}>Not Visited</span>
                <span className="font-semibold" style={{ color: "var(--text-muted)" }}>{stats.notVisited}</span>
              </div>
              <div className="pt-2">
                <button onClick={() => setSubmitConfirm(true)}
                  className="w-full py-2 text-xs font-medium text-white rounded-xl cursor-pointer flex items-center justify-center gap-1.5"
                  style={{ background: "var(--primary)" }}>
                  <Send className="w-3.5 h-3.5" /> Submit Test
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Tab & Window Switch Warning Banner */}
      {tabWarnings > 0 && !submitted && (
        <div className={`sticky bottom-0 z-40 px-4 py-2 text-xs text-center font-bold flex items-center justify-center gap-2 ${
          tabWarnings >= 2 ? "bg-red-600 text-white animate-pulse" : "bg-amber-500 text-black"
        }`}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {tabWarnings >= 2
            ? "🚨 Warning 2 of 3 (Final Warning)"
            : `⚠️ Warning ${tabWarnings} of 3`}
        </div>
      )}

      {/* Fullscreen Required Blocking Overlay */}
      {!isFullscreen && !submitted && !loading && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#090d16] p-6 text-center select-none">
          <div className="max-w-md w-full bg-[#141721] border border-red-500/40 rounded-2xl p-7 shadow-2xl space-y-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500">
              <Maximize2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">Fullscreen Required</h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                Assessment security requires full screen mode at all times. All fullscreen departures are logged to your proctoring audit log.
              </p>
            </div>
            <button
              type="button"
              onClick={enterFullscreen}
              className="w-full py-3.5 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition cursor-pointer flex items-center justify-center gap-2 shadow-lg hover:shadow-blue-500/25"
            >
              <Maximize2 className="w-4 h-4" /> Enter Fullscreen to Continue
            </button>
          </div>
        </div>
      )}

      {/* Window Focus Lost / Away Obscuring Shield */}
      {isAway && isFullscreen && !submitted && !loading && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#090d16] p-6 text-center select-none">
          <div className="max-w-md w-full bg-[#141721] border border-amber-500/40 rounded-2xl p-7 shadow-2xl space-y-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <EyeOff className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">Assessment Paused — Focus Lost</h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                You have shifted focus away to another window or application. Question content and choices are concealed while the assessment window is unfocused.
              </p>
            </div>
            <div className="py-2 px-3 rounded-lg bg-[#0d1017] border border-zinc-800 text-[11px] font-mono text-zinc-400">
              {candidateWatermark}
            </div>
            <button
              type="button"
              onClick={resumeAssessment}
              className="w-full py-3.5 px-4 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition cursor-pointer flex items-center justify-center gap-2 shadow-lg hover:shadow-amber-500/25"
            >
              <ShieldAlert className="w-4 h-4" /> Return to Assessment
            </button>
          </div>
        </div>
      )}

      {/* Duplicate Assessment Session Detected Blocking Overlay */}
      {isDuplicateSession && !submitted && !loading && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#090d16] p-6 text-center select-none">
          <div className="max-w-md w-full bg-[#141721] border border-red-500/40 rounded-2xl p-7 shadow-2xl space-y-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">Duplicate Session Detected</h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                This assessment attempt is active in another browser tab or window. Multiple simultaneous sessions are not permitted. Please close this duplicate tab.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Proctoring Lost Blocking Overlay */}
      {proctoringError && !submitted && (
        <div className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-[#090d16] p-6 text-center select-none">
          <div className="max-w-md w-full bg-[#141721] border border-amber-500/40 rounded-2xl p-7 shadow-2xl space-y-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <WifiOff className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">Proctoring Telemetry Paused</h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                Secure connection to the proctoring server was interrupted. If you have an ad-blocker or privacy extension active, please disable it for this site and click Retry.
              </p>
            </div>
            <button
              type="button"
              onClick={() => sendHeartbeat()}
              className="w-full py-3.5 px-4 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition cursor-pointer flex items-center justify-center gap-2 shadow-lg"
            >
              <RefreshCw className="w-4 h-4" /> Retry Connection
            </button>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t admin-table-divider bg-white dark:bg-[#111] px-3 py-2">
        <div className="flex items-center justify-between">
          <button onClick={() => navigateTo(Math.max(0, currentIdx - 1))} disabled={currentIdx === 0}
            className="p-2 rounded-lg admin-hover cursor-pointer disabled:opacity-40">
            <ChevronLeft className="w-5 h-5" style={{ color: "var(--text-secondary)" }} />
          </button>
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            {currentIdx + 1} / {questions.length}
          </span>
          <button onClick={() => setSubmitConfirm(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white rounded-xl cursor-pointer"
            style={{ background: "var(--primary)" }}>
            <Send className="w-3.5 h-3.5" /> Submit
          </button>
          <button onClick={() => navigateTo(Math.min(questions.length - 1, currentIdx + 1))}
            disabled={currentIdx === questions.length - 1}
            className="p-2 rounded-lg admin-hover cursor-pointer disabled:opacity-40">
            <ChevronRight className="w-5 h-5" style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>
      </div>

      {submitConfirm && (
        <SubmitConfirm
          stats={stats}
          onConfirm={handleSubmit}
          onClose={() => setSubmitConfirm(false)}
          submitting={submitting}
        />
      )}
    </div>
  );
}

export default TestEngine;
