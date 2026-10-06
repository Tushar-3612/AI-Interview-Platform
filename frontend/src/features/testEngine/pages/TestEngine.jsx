import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Flag, Send, AlertTriangle, Clock,
  CheckCircle, XCircle, Circle, BookOpen, Code, Maximize2,
  ShieldCheck, ShieldAlert, WifiOff, RefreshCw, EyeOff, Lock,
  Check, RotateCcw, LayoutGrid, X,
} from "lucide-react";
import { isFullscreenSupported, exitFullscreenSafe } from "../hooks/useExamLockdown.js";
import api from "../../../core/api/api.js";
import { getAuthToken } from "../../student/hooks/useStudentProfile.js";
import toast from "react-hot-toast";
import CodingQuestionRenderer from "../../codingAssessment/components/CodingQuestionRenderer.jsx";
import MCQQuestionView from "../components/MCQQuestionView.jsx";
import { useExamLockdown } from "../hooks/useExamLockdown.js";

/**
 * PrepHire Assessment Timer
 * Supports hours, minutes, seconds with dynamic states:
 * - Normal (> 5m): Sleek dark slate pill with orange clock icon
 * - Warning (<= 5m): Amber warning state
 * - Critical (<= 1m): Red pulse state
 */
function Timer({ endTime, durationMinutes = 30, serverOffset = 0, onTimeUp }) {
  const [display, setDisplay] = useState("00:00:00");
  const [remainingMs, setRemainingMs] = useState(30 * 60 * 1000);

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
      setRemainingMs(diff);

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

  const isCritical = remainingMs <= 60000;
  const isWarning = remainingMs <= 300000 && !isCritical;

  let timerClasses = "bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-primary)]";
  let iconColor = "text-[#FF6B35]";

  if (isCritical) {
    timerClasses = "bg-red-500/15 border-red-500/40 text-red-500 dark:text-red-400 animate-pulse";
    iconColor = "text-red-500 dark:text-red-400";
  } else if (isWarning) {
    timerClasses = "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400";
    iconColor = "text-amber-600 dark:text-amber-400";
  }

  return (
    <div
      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold border transition-colors duration-200 select-none shadow-sm ${timerClasses}`}
      title="Remaining Exam Duration"
    >
      <Clock className={`w-3.5 h-3.5 shrink-0 ${iconColor}`} />
      <span className="tracking-wider">{display}</span>
    </div>
  );
}

/**
 * PrepHire Final Submission Confirmation Dialog
 */
function SubmitConfirm({ stats, onConfirm, onClose, submitting }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none"
      onClick={submitting ? undefined : onClose}
    >
      <div
        className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 sm:p-7 space-y-5 shadow-2xl text-[var(--text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#FF6B35]/10 border border-[#FF6B35]/30 flex items-center justify-center mx-auto text-[#FF6B35]">
            <Send className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Submit Assessment?</h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-xs mx-auto leading-relaxed">
            Please review your question summary before final submission. Once submitted, your answers cannot be modified.
          </p>
        </div>

        {/* Breakdown Grid */}
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-emerald-500/20 text-center">
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.answered}</p>
            <p className="text-[11px] font-medium text-[var(--text-secondary)] mt-0.5">Answered</p>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-purple-500/20 text-center">
            <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{stats.marked}</p>
            <p className="text-[11px] font-medium text-[var(--text-secondary)] mt-0.5">Marked for Review</p>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-amber-500/20 text-center">
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{stats.skipped}</p>
            <p className="text-[11px] font-medium text-[var(--text-secondary)] mt-0.5">Skipped</p>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-center">
            <p className="text-xl font-bold text-[var(--text-secondary)]">{stats.notVisited}</p>
            <p className="text-[11px] font-medium text-[var(--text-secondary)] mt-0.5">Unanswered</p>
          </div>
        </div>

        {/* Action CTAs */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 px-4 text-xs font-semibold border border-[var(--border)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            Review Questions
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 py-2.5 px-4 text-xs font-bold text-white rounded-xl bg-[#FF6B35] hover:bg-[#FF5514] active:scale-[0.99] transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#FF6B35]/20 disabled:opacity-75"
          >
            {submitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Submit Final</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * PrepHire Main Assessment Engine
 */
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
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);

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
        exitFullscreenSafe();
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
        exitFullscreenSafe();
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
    exitFullscreen,
    resumeAssessment,
  } = useExamLockdown({
    attemptId,
    isCodingQuestion: isCoding,
    submitted,
    reportViolation,
    recordIntegrity,
  });

  // Automatically exit fullscreen when test is submitted or completed
  useEffect(() => {
    if (submitted) {
      exitFullscreenSafe();
    }
  }, [submitted]);

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
        exitFullscreenSafe();
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

  // Helper: check if a question is genuinely answered
  const isQuestionAnswered = useCallback((a, q) => {
    if (!a) return false;
    const isCodingQ = Boolean(
      q?.type === "Coding" ||
      q?.problemTitle ||
      (q?.testCases && q.testCases.length > 0) ||
      a.type === "Coding"
    );
    if (isCodingQ) {
      return Boolean(
        a.executionStatus === "accepted" ||
        (typeof a.passedCount === "number" && a.passedCount > 0) ||
        (typeof a.codingScore === "number" && a.codingScore > 0) ||
        (typeof a.scoredMarks === "number" && a.scoredMarks > 0) ||
        (a.status === "answered" && ((a.code && a.code.trim() !== "") || (a.answer && a.answer.trim() !== ""))) ||
        (a.code && typeof a.code === "string" && a.code.trim() !== "")
      );
    }
    return Boolean(a.answer && typeof a.answer === "string" && a.answer.trim() !== "");
  }, []);

  // Helper: check if a question is explicitly skipped
  const isQuestionSkipped = useCallback((a, q) => {
    if (!a) return false;
    if (isQuestionAnswered(a, q)) return false;
    return Boolean(a.isSkipped || a.status === "skipped");
  }, [isQuestionAnswered]);

  // Answer saving
  const saveCurrent = useCallback(async () => {
    if (!attemptId || submitted) return;
    const currentAnswer = answers[currentIdx];
    if (!currentAnswer) return;

    const answered = isQuestionAnswered(currentAnswer, activeQuestion);
    const skipped = !answered && isQuestionSkipped(currentAnswer, activeQuestion);
    let backendStatus = "not_visited";
    if (currentAnswer.isMarked || currentAnswer.status === "marked") {
      backendStatus = "marked";
    } else if (answered) {
      backendStatus = "answered";
    } else if (skipped) {
      backendStatus = "skipped";
    }

    const serialized = JSON.stringify({
      answer: currentAnswer.answer,
      code: currentAnswer.code,
      language: currentAnswer.language,
      status: backendStatus,
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
        status: backendStatus,
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
  }, [attemptId, answers, currentIdx, token, submitted, isQuestionAnswered, isQuestionSkipped, activeQuestion]);

  useEffect(() => {
    saveTimerRef.current = setInterval(saveCurrent, 30000);
    return () => clearInterval(saveTimerRef.current);
  }, [saveCurrent]);

  useEffect(() => {
    lastSaveRef.current = "";
  }, [currentIdx]);

  // Set option answer (MCQ)
  const handleSelectAnswer = (val) => {
    setAnswers(prev => prev.map((a, i) => {
      if (i === currentIdx) {
        return {
          ...a,
          answer: val,
          isSkipped: false,
          status: a.isMarked ? "marked" : "answered",
          visited: true,
        };
      }
      return a;
    }));
  };

  // Set code (Coding)
  const handleCodeChange = (val) => {
    setAnswers(prev => prev.map((a, i) => {
      if (i === currentIdx) {
        return {
          ...a,
          code: val,
          visited: true,
        };
      }
      return a;
    }));
  };

  // Set language (Coding)
  const handleLanguageChange = (val) => {
    setAnswers(prev => prev.map((a, i) => {
      if (i === currentIdx) {
        return {
          ...a,
          language: val,
          visited: true,
        };
      }
      return a;
    }));
  };

  // Explicit Skip action
  const handleSkip = () => {
    setAnswers(prev => prev.map((a, i) => {
      if (i === currentIdx) {
        const answered = isQuestionAnswered(a, questions[i]);
        if (answered) return a;
        return {
          ...a,
          isSkipped: true,
          status: a.isMarked ? "marked" : "skipped",
          visited: true,
        };
      }
      return a;
    }));
    navigateTo(Math.min(questions.length - 1, currentIdx + 1));
  };

  // Clear choice action
  const handleClearChoice = () => {
    setAnswers(prev => prev.map((a, i) => {
      if (i === currentIdx) {
        return {
          ...a,
          answer: "",
          isSkipped: false,
          status: a.isMarked ? "marked" : "not_visited",
          visited: true,
        };
      }
      return a;
    }));
  };

  // Toggle Mark for Review action
  const handleToggleMark = () => {
    setAnswers(prev => prev.map((a, i) => {
      if (i === currentIdx) {
        const nextMarked = !(a.isMarked || a.status === "marked");
        const answered = isQuestionAnswered(a, questions[i]);
        const skipped = !answered && (a.isSkipped || a.status === "skipped");
        let newStatus = "not_visited";
        if (nextMarked) {
          newStatus = "marked";
        } else if (answered) {
          newStatus = "answered";
        } else if (skipped) {
          newStatus = "skipped";
        }
        return {
          ...a,
          isMarked: nextMarked,
          status: newStatus,
          visited: true,
        };
      }
      return a;
    }));
  };

  // Next question action
  const handleNext = () => {
    setAnswers(prev => prev.map((a, i) => {
      if (i === currentIdx) {
        return {
          ...a,
          visited: true,
        };
      }
      return a;
    }));
    navigateTo(currentIdx + 1);
  };

  // Coding submission result handler
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
          isSkipped: false,
          status: a.isMarked ? "marked" : "answered",
          codingScore,
          passedCount,
          totalCount,
          executionStatus,
          scoredMarks,
          visited: true,
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
        status: currentAnswer.isMarked ? "marked" : "answered",
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
    exitFullscreenSafe();
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
      exitFullscreenSafe();
      navigate(`/tests/result/${attemptId}`, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || "Failed to submit test");
      setSubmitting(false);
    }
  };

  const navigateTo = (idx) => {
    saveCurrent();
    setAnswers(prev => prev.map((a, i) => i === idx ? { ...a, visited: true } : a));
    setCurrentIdx(idx);
  };

  // Precise, mutually consistent summary stats derived from actual answer states
  const stats = useMemo(() => {
    const total = questions.length;
    let answered = 0;
    let skipped = 0;
    let marked = 0;

    answers.forEach((a, i) => {
      const q = questions[i];
      const isAns = isQuestionAnswered(a, q);
      const isSkp = !isAns && isQuestionSkipped(a, q);
      const isMrk = Boolean(a?.isMarked || a?.status === "marked");

      if (isAns) answered++;
      else if (isSkp) skipped++;
      if (isMrk) marked++;
    });

    const remaining = Math.max(0, total - answered - skipped);

    return {
      answered,
      skipped,
      marked,
      remaining,
      notVisited: remaining,
    };
  }, [answers, questions, isQuestionAnswered, isQuestionSkipped]);

  const totalQuestions = Math.max(questions.length, 1);
  const progressPercent = Math.round(((currentIdx + 1) / totalQuestions) * 100);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] space-y-4">
        <div className="w-10 h-10 border-3 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold tracking-wider text-[var(--text-secondary)] uppercase">Loading Assessment...</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <div className="text-center p-8 max-w-sm bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-2xl space-y-3">
          <CheckCircle className="w-12 h-12 mx-auto text-emerald-500 dark:text-emerald-400" />
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Assessment Submitted</h2>
          <p className="text-xs text-[var(--text-secondary)]">Processing results and generating report...</p>
        </div>
      </div>
    );
  }

  const question = questions[currentIdx];
  const q = answers[currentIdx] || {};

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex flex-col select-none bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased"
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        MozUserSelect: "none",
        msUserSelect: "none",
      }}
    >
      {/* ══════════════════════════════════════════════════════════════════════════
          PREPHIRE PREMIUM ASSESSMENT HEADER
      ══════════════════════════════════════════════════════════════════════════ */}
      <header
        className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--card-bg)]/95 backdrop-blur-md shrink-0"
        style={{ paddingTop: "max(0.4rem, env(safe-area-inset-top))" }}
      >
        <div className="max-w-[1600px] mx-auto flex items-center justify-between px-3 sm:px-6 py-2 gap-2 sm:gap-4">
          
          {/* LEFT: PrepHire Logo & Test Meta */}
          <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <img
                src="/images/metadata.png"
                alt="PrepHire"
                className="h-6 w-6 sm:h-7 sm:w-7 object-contain"
                draggable="false"
              />
              <span className="text-sm sm:text-base font-black tracking-tight text-[var(--text-primary)] hidden sm:inline">
                Prep<span className="text-[#FF6B35]">Hire</span>
              </span>
            </div>

            <div className="h-4 w-px bg-[var(--border)] hidden sm:block" />

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate max-w-[130px] xs:max-w-[170px] sm:max-w-[280px]">
                  {test?.title || "Assessment"}
                </h1>
                {test?.testType && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] hidden md:inline">
                    {test.testType}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* CENTER: Progress Info & Bar (Desktop only) */}
          <div className="hidden md:flex flex-col items-center justify-center flex-1 max-w-xs px-2">
            <div className="flex items-center justify-between w-full text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
              <span>Question {String(currentIdx + 1).padStart(2, "0")} of {String(totalQuestions).padStart(2, "0")}</span>
              <span className="text-[var(--text-muted)] font-mono">{progressPercent}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[var(--bg-secondary)] overflow-hidden border border-[var(--border)]">
              <div
                className="h-full bg-[#FF6B35] transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* RIGHT: Mobile Questions Button, Status & Timer */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Mobile Question Palette Trigger */}
            <button
              type="button"
              onClick={() => setMobilePaletteOpen(true)}
              className="lg:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-bold bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text-primary)] active:scale-95 transition cursor-pointer"
              title="Open Question Palette"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-[#FF6B35]" />
              <span>{currentIdx + 1}/{totalQuestions}</span>
            </button>

            {saving && (
              <span className="text-[10px] font-medium text-[var(--text-muted)] hidden sm:inline animate-pulse">
                Saving...
              </span>
            )}

            {/* Proctoring Active Pill */}
            <div
              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-[10px] sm:text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 select-none shrink-0"
              title="Active Proctoring & Integrity Lockdown"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">SECURE EXAM</span>
            </div>

            {/* Timer */}
            <Timer
              endTime={endTime}
              durationMinutes={test?.duration || 30}
              serverOffset={serverOffset}
              onTimeUp={handleTimeUp}
            />
          </div>
        </div>
      </header>

      {/* Desktop Warning Alert (Pinned at top of workspace when active on desktop) */}
      {tabWarnings > 0 && !submitted && (
        <div
          className={`hidden lg:flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold w-full shrink-0 z-30 transition-all ${
            tabWarnings >= 2 ? "bg-red-600 text-white animate-pulse" : "bg-amber-500 text-black"
          }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {tabWarnings >= 2
              ? "🚨 Warning 2 of 3 (Final Warning): Next window switch will automatically submit your exam"
              : `⚠️ Warning ${tabWarnings} of 3: Window departure detected`}
          </span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          ASSESSMENT WORKSPACE
      ══════════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: "calc(100vh - 58px)" }}>
        {isCoding ? (
          /* ════════════════ CODING WORKSPACE ════════════════ */
          <main className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-primary)]">
            {/* Mobile Coding Advisory Banner */}
            <div className="lg:hidden px-3 py-1.5 bg-[var(--card-bg)] border-b border-[var(--border)] text-[11px] text-[var(--text-secondary)] flex items-center justify-between">
              <span>💡 Laptop/Desktop recommended for coding IDE</span>
              <button
                type="button"
                onClick={() => setMobilePaletteOpen(true)}
                className="text-[#FF6B35] font-bold underline text-[11px]"
              >
                Questions ({stats.answered}/{totalQuestions})
              </button>
            </div>

            {/* Split / Stacked IDE Canvas */}
            <div className="flex-1 overflow-y-auto lg:overflow-hidden pb-36 lg:pb-0" style={{ minHeight: 0 }}>
              {question ? (
                <CodingQuestionRenderer
                  question={question}
                  questionSource="testQuestion"
                  questionIndex={currentIdx}
                  testId={test?._id}
                  initialCode={q.code}
                  initialLanguage={q.language || "python"}
                  onCodeChange={handleCodeChange}
                  onLanguageChange={handleLanguageChange}
                  onSubmissionResult={(res) => handleCodingSubmissionResult(currentIdx, res)}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-xs">
                  Coding problem unavailable
                </div>
              )}
            </div>

            {/* Desktop Docked Action Bar for Coding */}
            <div className="hidden lg:flex items-center justify-between px-6 py-2.5 border-t border-[var(--border)] bg-[var(--card-bg)] shrink-0 z-10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigateTo(Math.max(0, currentIdx - 1))}
                  disabled={currentIdx === 0}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold border border-[var(--border)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-xl transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={currentIdx === questions.length - 1}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold border border-[var(--border)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-xl transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Skip <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleToggleMark}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                    (q.isMarked || q.status === "marked")
                      ? "border-purple-500/50 text-purple-600 dark:text-purple-300 bg-purple-500/15"
                      : "border-[var(--border)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>{(q.isMarked || q.status === "marked") ? "Unmark" : "Mark for Review"}</span>
                </button>

                {currentIdx < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white rounded-xl bg-[#FF6B35] hover:bg-[#FF5514] active:scale-[0.99] transition cursor-pointer shadow-sm shadow-[#FF6B35]/20"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSubmitConfirm(true)}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white rounded-xl bg-[#FF6B35] hover:bg-[#FF5514] active:scale-[0.99] transition cursor-pointer shadow-sm shadow-[#FF6B35]/20"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Assessment</span>
                  </button>
                )}
              </div>
            </div>
          </main>
        ) : (
          /* ════════════════ MCQ WORKSPACE ════════════════ */
          <main className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-primary)]">
            {/* Scrollable Question Content */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 pb-36 lg:pb-8 flex justify-center items-start">
              <div className="w-full max-w-4xl space-y-4">
                <div className="w-full">
                  {question ? (
                    <MCQQuestionView
                      question={question}
                      questionIndex={currentIdx}
                      totalQuestions={questions.length}
                      answer={q.answer}
                      onAnswer={handleSelectAnswer}
                      candidateWatermark={candidateWatermark}
                    />
                  ) : (
                    <div className="p-8 text-center bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl text-[var(--text-muted)] text-xs">
                      Question unavailable
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop Sticky Bottom Action Bar */}
            <div className="hidden lg:flex items-center justify-between px-6 py-2.5 border-t border-[var(--border)] bg-[var(--card-bg)] shrink-0 z-10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigateTo(Math.max(0, currentIdx - 1))}
                  disabled={currentIdx === 0}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold border border-[var(--border)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-xl transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={currentIdx === questions.length - 1}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold border border-[var(--border)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-xl transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Skip <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                {Boolean(q.answer) && (
                  <button
                    type="button"
                    onClick={handleClearChoice}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-xl transition cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> Clear
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleToggleMark}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                    (q.isMarked || q.status === "marked")
                      ? "border-purple-500/50 text-purple-600 dark:text-purple-300 bg-purple-500/15"
                      : "border-[var(--border)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>{(q.isMarked || q.status === "marked") ? "Unmark" : "Mark for Review"}</span>
                </button>

                {currentIdx < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white rounded-xl bg-[#FF6B35] hover:bg-[#FF5514] active:scale-[0.99] transition cursor-pointer shadow-sm shadow-[#FF6B35]/20"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSubmitConfirm(true)}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white rounded-xl bg-[#FF6B35] hover:bg-[#FF5514] active:scale-[0.99] transition cursor-pointer shadow-sm shadow-[#FF6B35]/20"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Assessment</span>
                  </button>
                )}
              </div>
            </div>
          </main>
        )}

        {/* ════════════════ DESKTOP RIGHT QUESTION NAVIGATOR ════════════════ */}
        <aside className="w-72 shrink-0 border-l border-[var(--border)] bg-[var(--card-bg)] overflow-y-auto hidden lg:flex flex-col justify-between">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Questions</h2>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">{answers.length} Total</span>
            </div>

            {/* Status Breakdown Legend */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" />
                <span className="text-[var(--text-primary)] font-medium">✓ {stats.answered} Answered</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 dark:bg-purple-400 shrink-0" />
                <span className="text-[var(--text-primary)] font-medium">⚑ {stats.marked} Marked</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 dark:bg-amber-400 shrink-0" />
                <span className="text-[var(--text-primary)] font-medium">— {stats.skipped} Skipped</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-400 dark:bg-zinc-600 shrink-0" />
                <span className="text-[var(--text-primary)] font-medium">○ {stats.remaining} Remaining</span>
              </div>
            </div>

            {/* 5-Column Question Grid */}
            <div className="pt-2">
              <div className="grid grid-cols-5 gap-2">
                {answers.map((a, idx) => {
                  const qItem = questions[idx];
                  const isCurrent = idx === currentIdx;
                  const isAns = isQuestionAnswered(a, qItem);
                  const isSkp = !isAns && isQuestionSkipped(a, qItem);
                  const isMrk = Boolean(a?.isMarked || a?.status === "marked");

                  let itemClasses = "bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[#FF6B35]";

                  if (isCurrent) {
                    itemClasses = "border-[#FF6B35] ring-2 ring-[#FF6B35]/40 text-[#FF6B35] dark:text-white bg-[#FF6B35]/15 font-bold scale-[1.04]";
                  } else if (isAns) {
                    itemClasses = "bg-emerald-500/15 border-emerald-500/35 text-emerald-600 dark:text-emerald-300 font-bold hover:bg-emerald-500/25";
                  } else if (isSkp) {
                    itemClasses = "bg-amber-500/15 border-amber-500/35 text-amber-600 dark:text-amber-300 hover:bg-amber-500/25";
                  } else if (isMrk) {
                    itemClasses = "bg-purple-500/15 border-purple-500/35 text-purple-600 dark:text-purple-300 font-bold hover:bg-purple-500/25";
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => navigateTo(idx)}
                      className={`relative h-9 rounded-xl text-xs font-mono font-medium border transition-all duration-150 flex items-center justify-center cursor-pointer ${itemClasses}`}
                      title={`Go to Question ${idx + 1}`}
                    >
                      <span>{String(idx + 1).padStart(2, "0")}</span>
                      {isMrk && (
                        <span
                          className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-purple-500 dark:bg-purple-400 border border-[var(--card-bg)] shadow-sm"
                          title="Marked for Review"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Submit Action */}
          <div className="p-4 border-t border-[var(--border)] bg-[var(--card-bg)] space-y-2">
            <button
              type="button"
              onClick={() => setSubmitConfirm(true)}
              className="w-full py-2.5 px-4 text-xs font-bold text-white rounded-xl bg-[#FF6B35] hover:bg-[#FF5514] active:scale-[0.99] transition cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-[#FF6B35]/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Assessment</span>
            </button>
          </div>
        </aside>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          MOBILE WARNING ALERT — STACKED ABOVE BOTTOM ACTION BAR (< 1024px)
          NEVER overlaps or obscures the bottom action buttons.
      ══════════════════════════════════════════════════════════════════════════ */}
      {tabWarnings > 0 && !submitted && (
        <div
          className={`lg:hidden fixed left-2.5 right-2.5 z-40 rounded-xl px-3 py-2 text-xs font-bold flex items-center justify-between gap-2 shadow-xl border transition-all duration-200 ${
            tabWarnings >= 2
              ? "bg-red-600 text-white border-red-700 animate-pulse"
              : "bg-amber-500 text-black border-amber-600"
          }`}
          style={{
            bottom: "calc(58px + max(0.6rem, env(safe-area-inset-bottom)))",
          }}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="truncate text-[11px] font-bold">
              {tabWarnings >= 2
                ? "🚨 Final Warning: Next window exit auto-submits exam"
                : `⚠️ Warning ${tabWarnings} of 3: Window departure detected`}
            </span>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          UNIFIED MOBILE BOTTOM ACTION BAR (< 1024px)
      ══════════════════════════════════════════════════════════════════════════ */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-[var(--card-bg)]/98 backdrop-blur-md px-2.5 py-2 shadow-2xl"
        style={{ paddingBottom: "max(0.6rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between gap-1.5">
          {/* Previous Button */}
          <button
            type="button"
            onClick={() => navigateTo(Math.max(0, currentIdx - 1))}
            disabled={currentIdx === 0}
            className="flex items-center justify-center min-h-[44px] px-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-semibold disabled:opacity-25 active:scale-95 transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Question Palette Trigger */}
          <button
            type="button"
            onClick={() => setMobilePaletteOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] px-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] active:scale-95 transition cursor-pointer"
          >
            <LayoutGrid className="w-4 h-4 text-[#FF6B35]" />
            <span>Questions ({stats.answered}/{totalQuestions})</span>
          </button>

          {/* Mark for Review Button */}
          <button
            type="button"
            onClick={handleToggleMark}
            className={`flex items-center justify-center min-h-[44px] px-3 rounded-xl text-xs font-semibold border transition cursor-pointer active:scale-95 ${
              (q.isMarked || q.status === "marked")
                ? "border-purple-500/50 text-purple-600 dark:text-purple-300 bg-purple-500/20"
                : "border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
            }`}
            title="Mark for Review"
          >
            <Flag className="w-4 h-4" />
          </button>

          {/* Clear Answer Button (if answered) */}
          {Boolean(q.answer) && (
            <button
              type="button"
              onClick={handleClearChoice}
              className="flex items-center justify-center min-h-[44px] px-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] active:scale-95 transition cursor-pointer"
              title="Clear Selection"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Next / Submit Button */}
          {currentIdx < questions.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center justify-center min-h-[44px] px-4 rounded-xl text-xs font-bold text-white bg-[#FF6B35] hover:bg-[#FF5514] active:scale-95 transition cursor-pointer shadow-md shadow-[#FF6B35]/20 gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSubmitConfirm(true)}
              className="flex items-center justify-center min-h-[44px] px-4 rounded-xl text-xs font-bold text-white bg-[#FF6B35] hover:bg-[#FF5514] active:scale-95 transition cursor-pointer shadow-md shadow-[#FF6B35]/20 gap-1"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit</span>
            </button>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          MOBILE QUESTION PALETTE DRAWER / MODAL SHEET
      ══════════════════════════════════════════════════════════════════════════ */}
      {mobilePaletteOpen && (
        <div
          className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center items-center bg-black/80 backdrop-blur-sm select-none"
          onClick={() => setMobilePaletteOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-[var(--card-bg)] border border-[var(--border)] rounded-t-3xl sm:rounded-2xl p-5 space-y-4 max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 duration-200 text-[var(--text-primary)]"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: "max(1.2rem, env(safe-area-inset-bottom))" }}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-[#FF6B35]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Question Navigator</h3>
                <span className="text-xs font-mono text-[var(--text-secondary)]">({answers.length} Total)</span>
              </div>
              <button
                type="button"
                onClick={() => setMobilePaletteOpen(false)}
                className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status Legend */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" />
                <span className="text-[var(--text-primary)] font-medium">✓ {stats.answered} Answered</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 dark:bg-purple-400 shrink-0" />
                <span className="text-[var(--text-primary)] font-medium">⚑ {stats.marked} Marked</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 dark:bg-amber-400 shrink-0" />
                <span className="text-[var(--text-primary)] font-medium">— {stats.skipped} Skipped</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-400 dark:bg-zinc-600 shrink-0" />
                <span className="text-[var(--text-primary)] font-medium">○ {stats.remaining} Remaining</span>
              </div>
            </div>

            {/* Question Grid */}
            <div className="flex-1 overflow-y-auto py-2">
              <div className="grid grid-cols-5 gap-2.5">
                {answers.map((a, idx) => {
                  const qItem = questions[idx];
                  const isCurrent = idx === currentIdx;
                  const isAns = isQuestionAnswered(a, qItem);
                  const isSkp = !isAns && isQuestionSkipped(a, qItem);
                  const isMrk = Boolean(a?.isMarked || a?.status === "marked");

                  let itemClasses = "bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-secondary)]";

                  if (isCurrent) {
                    itemClasses = "border-[#FF6B35] ring-2 ring-[#FF6B35]/40 text-[#FF6B35] dark:text-white bg-[#FF6B35]/25 font-bold";
                  } else if (isAns) {
                    itemClasses = "bg-emerald-500/15 border-emerald-500/35 text-emerald-600 dark:text-emerald-300 font-bold";
                  } else if (isSkp) {
                    itemClasses = "bg-amber-500/15 border-amber-500/35 text-amber-600 dark:text-amber-300";
                  } else if (isMrk) {
                    itemClasses = "bg-purple-500/15 border-purple-500/35 text-purple-600 dark:text-purple-300 font-bold";
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        navigateTo(idx);
                        setMobilePaletteOpen(false);
                      }}
                      className={`relative min-h-[44px] rounded-xl text-xs font-mono font-medium border flex items-center justify-center active:scale-95 transition cursor-pointer ${itemClasses}`}
                    >
                      <span>{String(idx + 1).padStart(2, "0")}</span>
                      {isMrk && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-purple-500 dark:bg-purple-400 border border-[var(--card-bg)]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Bottom CTA */}
            <div className="pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => {
                  setMobilePaletteOpen(false);
                  setSubmitConfirm(true);
                }}
                className="w-full min-h-[44px] py-2.5 px-4 text-xs font-bold text-white rounded-xl bg-[#FF6B35] hover:bg-[#FF5514] active:scale-98 transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#FF6B35]/20"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Assessment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          SECURITY & INTEGRITY OVERLAYS (Preserved Lockdown Architecture)
      ══════════════════════════════════════════════════════════════════════════ */}

      {/* Fullscreen Required Blocking Overlay (Only displayed if browser supports DOM Fullscreen) */}
      {!isFullscreen && !submitted && !loading && isFullscreenSupported() && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-6 text-center select-none">
          <div className="max-w-md w-full bg-[var(--card-bg)] border border-red-500/40 rounded-2xl p-7 sm:p-8 shadow-2xl space-y-5 text-[var(--text-primary)]">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 dark:text-red-400">
              <Maximize2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Fullscreen Mode Required</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed">
                Assessment integrity requires full screen mode. Window exits and resizing are recorded in your proctoring audit log.
              </p>
            </div>
            <button
              type="button"
              onClick={enterFullscreen}
              className="w-full min-h-[44px] py-3 px-4 rounded-xl text-xs font-bold text-white bg-[#FF6B35] hover:bg-[#FF5514] transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#FF6B35]/25"
            >
              <Maximize2 className="w-4 h-4" /> Enter Fullscreen to Continue
            </button>
          </div>
        </div>
      )}

      {/* Window Focus Lost / Away Obscuring Shield */}
      {isAway && !submitted && !loading && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-6 text-center select-none">
          <div className="max-w-md w-full bg-[var(--card-bg)] border border-amber-500/40 rounded-2xl p-7 sm:p-8 shadow-2xl space-y-5 text-[var(--text-primary)]">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400">
              <EyeOff className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Assessment Concealed — Focus Lost</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed">
                You switched focus to another application or window. Question content is hidden while the assessment window is unfocused.
              </p>
            </div>
            <div className="py-2 px-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[11px] font-mono text-[var(--text-secondary)]">
              {candidateWatermark}
            </div>
            <button
              type="button"
              onClick={resumeAssessment}
              className="w-full min-h-[44px] py-3 px-4 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-600/25"
            >
              <ShieldAlert className="w-4 h-4" /> Return to Assessment
            </button>
          </div>
        </div>
      )}

      {/* Duplicate Assessment Session Detected Blocking Overlay */}
      {isDuplicateSession && !submitted && !loading && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-6 text-center select-none">
          <div className="max-w-md w-full bg-[var(--card-bg)] border border-red-500/40 rounded-2xl p-7 sm:p-8 shadow-2xl space-y-5 text-[var(--text-primary)]">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 dark:text-red-400">
              <Lock className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Duplicate Session Detected</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed">
                This assessment is active in another browser tab or window. Multiple simultaneous sessions are not permitted. Please close this duplicate tab.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Proctoring Lost Blocking Overlay */}
      {proctoringError && !submitted && (
        <div className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-6 text-center select-none">
          <div className="max-w-md w-full bg-[var(--card-bg)] border border-amber-500/40 rounded-2xl p-7 sm:p-8 shadow-2xl space-y-5 text-[var(--text-primary)]">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400">
              <WifiOff className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Proctoring Telemetry Interrupted</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed">
                Secure connection to the proctoring server was interrupted. If you have an ad-blocker or privacy extension active, please disable it for this site and click Retry.
              </p>
            </div>
            <button
              type="button"
              onClick={() => sendHeartbeat()}
              className="w-full min-h-[44px] py-3 px-4 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition cursor-pointer flex items-center justify-center gap-2 shadow-lg"
            >
              <RefreshCw className="w-4 h-4" /> Retry Connection
            </button>
          </div>
        </div>
      )}

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
