import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Flag, Send, AlertTriangle, Clock,
  CheckCircle, XCircle, Circle, BookOpen, Code, Maximize,
  Minimize,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";
import CodingQuestionRenderer from "../../components/coding/CodingQuestionRenderer";

function Timer({ endTime, onTimeUp }) {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date().getTime();
      const end = new Date(endTime).getTime();
      const diff = Math.max(0, end - now);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setDisplay(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
      if (diff <= 0) onTimeUp();
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endTime, onTimeUp]);

  const isLow = display.startsWith("00:0") || display.startsWith("00:00:");
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-mono font-bold ${
      isLow ? "bg-red-50 dark:bg-red-950/20 text-red-600" : "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600"
    }`}>
      <Clock className="w-4 h-4" /> {display}
    </div>
  );
}

function MCQRenderer({ question, answer, onAnswer }) {
  const letters = ["A", "B", "C", "D"];
  if (!question) return <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>Question unavailable</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--text-primary)" }}>
        {question.question}
      </p>
      <div className="grid gap-2">
        {question.options?.map((opt, idx) => opt ? (
          <button key={idx} onClick={() => onAnswer(letters[idx])}
            className={`flex items-center gap-3 p-3 rounded-xl border text-xs text-left cursor-pointer transition-all ${
              answer === letters[idx]
                ? "border-[var(--primary)]"
                : "admin-border admin-hover"
            }`}
            style={{
              background: answer === letters[idx]
                ? "color-mix(in srgb, var(--primary) 8%, transparent)"
                : "transparent",
            }}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
              answer === letters[idx]
                ? "text-white"
                : "border admin-border"
            }`}
              style={{ background: answer === letters[idx] ? "var(--primary)" : "transparent" }}>
              {letters[idx]}
            </span>
            <span style={{ color: "var(--text-primary)" }}>{opt}</span>
          </button>
        ) : null)}
      </div>
    </div>
  );
}

function SubmitConfirm({ stats, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-zinc-800 w-full max-w-sm mx-4 p-6 space-y-4"
        onClick={e => e.stopPropagation()}>
        <div className="text-center">
          <Send className="w-10 h-10 mx-auto mb-2" style={{ color: "var(--primary)" }} />
          <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Submit Test?</h3>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Review your progress before submitting.</p>
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
          <button onClick={onClose}
            className="flex-1 py-2.5 text-xs font-medium border admin-border rounded-xl admin-hover cursor-pointer">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 text-xs font-medium text-white rounded-xl cursor-pointer flex items-center justify-center gap-1.5"
            style={{ background: "var(--primary)" }}>
            <Send className="w-3.5 h-3.5" /> Submit
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
  const [fullscreen, setFullscreen] = useState(false);
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [tabWarnings, setTabWarnings] = useState(0);
  const [endTime, setEndTime] = useState(null);
  const [saving, setSaving] = useState(false);

  const containerRef = useRef(null);
  const saveTimerRef = useRef(null);
  const lastSaveRef = useRef("");

  const goFullscreen = useCallback(() => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
    setFullscreen(true);
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen();
    }
    setFullscreen(false);
  }, []);

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
      setEndTime(attempt.endTime);
      setTabWarnings(attempt.tabSwitchCount || 0);
      if (attempt.status === "completed" || attempt.status === "auto_submitted") {
        setSubmitted(true);
      }
    }
  }, [attempt]);

  useEffect(() => {
    if (!fullscreen && !submitted) goFullscreen();
  }, [fullscreen, submitted, goFullscreen]);

  const saveCurrent = useCallback(async () => {
    if (!attemptId || submitted) return;
    const currentAnswer = answers[currentIdx];
    if (!currentAnswer) return;
    const serialized = JSON.stringify({ answer: currentAnswer.answer, code: currentAnswer.code, language: currentAnswer.language, status: currentAnswer.status });
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
      }, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      // silent fail - retry on next interval
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

  const handleTabSwitch = useCallback(async () => {
    if (submitted) return;
    const newCount = tabWarnings + 1;
    setTabWarnings(newCount);
    try {
      const { data } = await api.post(`/api/student/tests/attempt/${attemptId}/tab-switch`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.autoSubmitted) {
        toast.error("Test auto-submitted due to excessive tab switching");
        setSubmitted(true);
        navigate(`/tests/result/${attemptId}`, { replace: true });
      } else if (newCount === 1) {
        toast("Warning: Tab switching detected. This is warning 1 of 3.", { icon: "⚠️" });
      } else if (newCount === 2) {
        toast("Final Warning: One more tab switch will auto-submit your test.", { icon: "🚨" });
      }
    } catch {
      // silent
    }
  }, [attemptId, token, tabWarnings, submitted, navigate]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && !submitted) handleTabSwitch();
    };
    const handleBlur = () => {
      if (!submitted) {
        // debounce blur - only count if not intentional (e.g., Alt+Tab)
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
    };
  }, [handleTabSwitch, submitted]);

  useEffect(() => {
    const handleContext = (e) => e.preventDefault();
    document.addEventListener("contextmenu", handleContext);
    return () => document.removeEventListener("contextmenu", handleContext);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && ["c", "v", "x", "a", "u"].includes(e.key.toLowerCase())) {
        const q = questions[currentIdx];
        const isCoding = q?.type === "Coding" || q?.problemTitle || (q?.testCases && q.testCases.length > 0);
        if (!isCoding) e.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIdx, questions]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!submitted) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [submitted]);

  const handleTimeUp = useCallback(async () => {
    if (submitted) return;
    toast("Time is up! Auto-submitting...", { icon: "⏰" });
    setSubmitted(true);
    try {
      await api.post(`/api/student/tests/attempt/${attemptId}/submit`, { forceSubmit: "auto" }, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // silent
    }
    navigate(`/tests/result/${attemptId}`, { replace: true });
  }, [attemptId, token, submitted, navigate]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await saveCurrent();
      await api.post(`/api/student/tests/attempt/${attemptId}/submit`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSubmitted(true);
      setSubmitConfirm(false);
      navigate(`/tests/result/${attemptId}`, { replace: true });
    } catch {
      toast.error("Failed to submit");
    } finally {
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
  const isCoding = question?.type === "Coding" || question?.problemTitle || (question?.testCases && question.testCases.length > 0);
  const q = answers[currentIdx] || {};

  return (
    <div ref={containerRef} className="min-h-screen flex flex-col" style={{ background: "var(--bg-primary)" }}>
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
            {endTime && <Timer endTime={endTime} onTimeUp={handleTimeUp} />}
            <button onClick={fullscreen ? exitFullscreen : goFullscreen}
              className="p-2 rounded-xl admin-hover cursor-pointer">
              {fullscreen ? <Minimize className="w-4 h-4" style={{ color: "var(--text-muted)" }} /> : <Maximize className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1" style={{ background: "var(--admin-bg-surface)" }}>
          <div className="h-full transition-all duration-500" style={{ width: `${(stats.answered / Math.max(questions.length, 1)) * 100}%`, background: "var(--primary)" }} />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Question {currentIdx + 1} of {questions.length}
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Marks: {question?.marks || 0}
                {isCoding && " | Coding Problem"}
              </span>
            </div>

            <div className="border admin-border admin-card rounded-2xl p-5">
              {question ? (
                isCoding ? (
                  <div style={{ height: "70vh", minHeight: "500px" }}>
                    <CodingQuestionRenderer
                      question={question}
                      questionSource="testQuestion"
                      questionIndex={currentIdx}
                      testId={test?._id}
                      initialCode={q.code}
                      initialLanguage={q.language || "python"}
                      onCodeChange={(v) => updateAnswer("code", v)}
                      onLanguageChange={(v) => updateAnswer("language", v)}
                    />
                  </div>
                ) : (
                  <MCQRenderer
                    question={question}
                    answer={q.answer}
                    onAnswer={(v) => updateAnswer("answer", v)}
                  />
                )
              ) : (
                <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>Question unavailable</p>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button onClick={() => navigateTo(Math.max(0, currentIdx - 1))} disabled={currentIdx === 0}
                  className="flex items-center gap-1 px-4 py-2 text-xs font-medium border admin-border rounded-xl admin-hover cursor-pointer disabled:opacity-40">
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </button>
                <button onClick={() => { updateAnswer("status", "skipped"); navigateTo(Math.min(questions.length - 1, currentIdx + 1)); }}
                  disabled={currentIdx === questions.length - 1}
                  className="flex items-center gap-1 px-4 py-2 text-xs font-medium border admin-border rounded-xl admin-hover cursor-pointer disabled:opacity-40">
                  Skip <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => updateAnswer("status", q.status === "marked" ? "answered" : "marked")}
                  className={`flex items-center gap-1 px-4 py-2 text-xs font-medium border rounded-xl cursor-pointer ${
                    q.status === "marked" ? "border-[var(--primary)]" : "admin-border admin-hover"
                  }`}
                  style={{ color: q.status === "marked" ? "var(--primary)" : "var(--text-secondary)" }}>
                  <Flag className="w-3.5 h-3.5" /> {q.status === "marked" ? "Unmark" : "Mark for Review"}
                </button>
                {currentIdx < questions.length - 1 ? (
                  <button onClick={() => { if (q.status === "not_visited") updateAnswer("status", "answered"); navigateTo(currentIdx + 1); }}
                    className="flex items-center gap-1 px-4 py-2 text-xs font-medium text-white rounded-xl cursor-pointer"
                    style={{ background: "var(--primary)" }}>
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button onClick={() => setSubmitConfirm(true)}
                    className="flex items-center gap-1 px-4 py-2 text-xs font-medium text-white rounded-xl cursor-pointer"
                    style={{ background: "var(--primary)" }}>
                    <Send className="w-3.5 h-3.5" /> Submit
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>

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

      {/* Tab Warning Banner */}
      {tabWarnings > 0 && (
        <div className={`sticky bottom-0 px-4 py-2 text-xs text-center font-medium ${
          tabWarnings >= 2 ? "bg-red-50 dark:bg-red-950/20 text-red-600" : "bg-amber-50 dark:bg-amber-950/20 text-amber-600"
        }`}>
          {tabWarnings >= 2
            ? "🚨 Final Warning: One more tab switch will auto-submit your test!"
            : "⚠️ Tab Switch Warning 1 of 3. Please stay on this tab."}
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
        />
      )}
    </div>
  );
}

export default TestEngine;
