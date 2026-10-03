import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import {
  ArrowLeft,
  Timer,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldAlert,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Send,
  RotateCcw,
  BarChart3,
  Award,
  AlertTriangle,
  Layers,
  Sparkles,
  Maximize2,
  Minimize2,
  RefreshCw,
  Percent,
} from "lucide-react";
import api from "../../../core/api/api.js";
import { getAuthToken } from "../../student/hooks/useStudentProfile.js";
import { formatTime } from "../../../core/utils/dateUtils.js";
import { Loader2 } from "lucide-react";

export default function AptitudeAssessment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = getAuthToken();

  const trackId = searchParams.get("track") || "general";
  const assessmentDurationMinutes = trackId === "verbal" ? 15 : trackId === "logical" ? 20 : trackId === "quantitative" ? 25 : 30;
  const assessmentQuestionCount = trackId === "verbal" || trackId === "logical" ? 15 : trackId === "quantitative" ? 20 : 25;

  // ─── State ─────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState(new Set());
  const [timeLeft, setTimeLeft] = useState(assessmentDurationMinutes * 60);
  const [phase, setPhase] = useState("exam"); // "exam" | "submitting" | "result"
  const [result, setResult] = useState(null);
  const [infractions, setInfractions] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [confirmSubmitModal, setConfirmSubmitModal] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);

  const timerRef = useRef(null);
  const initialTimeRef = useRef(assessmentDurationMinutes * 60);

  // ─── Fetch questions ──────────────────────────────────────────────────
  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await api.get("/api/practice/aptitude/paper", {
        headers,
        params: { count: assessmentQuestionCount },
      });
      if (!res.data.questions || res.data.questions.length === 0) {
        toast.error("No assessment questions available at the moment.");
        navigate("/aptitude");
        return;
      }
      setQuestions(res.data.questions);
      setTimeLeft(assessmentDurationMinutes * 60);
      initialTimeRef.current = assessmentDurationMinutes * 60;
      setAnswers({});
      setMarkedForReview(new Set());
      setPhase("exam");
      setCurrentIndex(0);
    } catch (err) {
      console.error("Failed to load aptitude assessment:", err);
      toast.error("Network error while generating assessment.");
    } finally {
      setLoading(false);
    }
  }, [assessmentQuestionCount, assessmentDurationMinutes, navigate, token]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // ─── Submit Handler ───────────────────────────────────────────────────
  const handleSubmit = useCallback(async (isAuto = false) => {
    if (phase !== "exam") return;
    setPhase("submitting");
    setConfirmSubmitModal(false);

    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const timeTaken = initialTimeRef.current - timeLeft;

      const payload = {
        companyId: "",
        companyName: `Aptitude Assessment (${trackId.toUpperCase()})`,
        answers,
        timeTaken,
        questions,
        difficulty: "mixed",
      };

      const res = await api.post("/api/practice/aptitude/submit", payload, { headers });
      setResult(res.data);
      setPhase("result");
      if (isAuto) {
        toast.error("Assessment auto-submitted: Time expired.");
      } else {
        toast.success("Assessment submitted successfully!");
      }
    } catch (err) {
      console.error("Submission error:", err);
      toast.error("Failed to submit assessment results.");
      setPhase("exam");
    }
  }, [answers, initialTimeRef, phase, questions, timeLeft, token, trackId]);

  // ─── Timer countdown ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "exam" || timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [phase, timeLeft, handleSubmit]);

  // ─── Proctoring / Blur Detection ──────────────────────────────────────
  useEffect(() => {
    if (phase !== "exam") return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setInfractions((prev) => {
          const next = prev + 1;
          setShowWarningModal(true);
          return next;
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [phase]);

  // ─── Question status helpers ──────────────────────────────────────────
  const currentQuestion = questions[currentIndex];

  const getQuestionStatus = (qId, idx) => {
    const isCurrent = idx === currentIndex;
    const isAnswered = answers[qId] != null;
    const isMarked = markedForReview.has(qId);

    if (isAnswered && isMarked) return "answered-marked";
    if (isMarked) return "marked";
    if (isAnswered) return "answered";
    return "unvisited";
  };

  const handleSelectOption = (option) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.questionId]: option,
    }));
  };

  const handleClearOption = () => {
    if (!currentQuestion) return;
    setAnswers((prev) => {
      const copy = { ...prev };
      delete copy[currentQuestion.questionId];
      return copy;
    });
  };

  const toggleMarkForReview = () => {
    if (!currentQuestion) return;
    const qId = currentQuestion.questionId;
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  // Stats for top bar
  const answeredCount = Object.keys(answers).length;
  const markedCount = markedForReview.size;

  // ─── Render: Loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex flex-col items-center justify-center space-y-4 bg-[var(--bg-primary)]">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
        <p className="text-sm font-bold text-[var(--text-secondary)]">
          Generating Timed Assessment Paper...
        </p>
      </div>
    );
  }

  // ─── Render: Result Page ──────────────────────────────────────────────
  if (phase === "result" && result) {
    const pct = result.percentage || 0;
    const isPassed = pct >= 60;

    return (
      <div className="min-h-screen bg-[var(--bg-primary)] py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Top Result Card */}
          <div className="p-6 sm:p-8 rounded-[24px] border bg-[var(--card-bg)] shadow-xl text-center space-y-5" style={{ borderColor: "var(--border)" }}>
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-lg"
              style={{
                background: isPassed ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                color: isPassed ? "#10B981" : "#EF4444",
              }}
            >
              {isPassed ? <CheckCircle2 className="w-9 h-9" /> : <XCircle className="w-9 h-9" />}
            </div>

            <div>
              <span className="text-[11px] font-extrabold uppercase px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
                Assessment Evaluated
              </span>
              <h1 className="text-2xl sm:text-3xl font-black mt-2 text-[var(--text-primary)]">
                {isPassed ? "Assessment Cleared!" : "Assessment Needs Work"}
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
                Completed in {formatTime(result.timeTaken || 0)} • Negative marking (+1 / -0.25) applied
              </p>
            </div>

            {/* Score Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto pt-2">
              <div className="p-3.5 rounded-2xl border bg-[var(--bg-secondary)]/60 text-center" style={{ borderColor: "var(--border)" }}>
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Score</span>
                <span className="text-xl font-black text-amber-400 font-mono block mt-0.5">{result.score} / {result.total}</span>
              </div>
              <div className="p-3.5 rounded-2xl border bg-[var(--bg-secondary)]/60 text-center" style={{ borderColor: "var(--border)" }}>
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Accuracy</span>
                <span className="text-xl font-black text-emerald-400 font-mono block mt-0.5">{pct}%</span>
              </div>
              <div className="p-3.5 rounded-2xl border bg-[var(--bg-secondary)]/60 text-center" style={{ borderColor: "var(--border)" }}>
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Correct</span>
                <span className="text-xl font-black text-emerald-400 font-mono block mt-0.5">{result.correct}</span>
              </div>
              <div className="p-3.5 rounded-2xl border bg-[var(--bg-secondary)]/60 text-center" style={{ borderColor: "var(--border)" }}>
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Wrong / Skip</span>
                <span className="text-xl font-black text-rose-400 font-mono block mt-0.5">{result.wrong} / {result.skipped}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                type="button"
                onClick={() => navigate("/aptitude")}
                className="px-5 py-2.5 rounded-xl border text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--border)]/20 transition cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                Back to Aptitude Hub
              </button>
              <button
                type="button"
                onClick={fetchQuestions}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition hover:opacity-90 cursor-pointer flex items-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #F59E0B 0%, #EA580C 55%, #FF6B35 100%)",
                }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Take Another Assessment</span>
              </button>
            </div>
          </div>

          {/* Detailed Question Review List */}
          <div className="space-y-4">
            <h3 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <span>Diagnostic Question Solutions</span>
            </h3>

            {(result.questions || []).map((q, idx) => {
              const isCorrect = q.isCorrect;
              const isSkipped = q.userAnswer == null;

              return (
                <div
                  key={idx}
                  className="p-5 rounded-2xl border bg-[var(--card-bg)] shadow-sm space-y-3"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--text-muted)]">
                      Question {idx + 1} • {q.category || "General"}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                        isCorrect
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : isSkipped
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {isCorrect ? "+1 Mark (Correct)" : isSkipped ? "0 Marks (Skipped)" : "-0.25 Marks (Wrong)"}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-[var(--text-primary)] leading-relaxed">
                    {q.question}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {(q.options || []).map((opt, oIdx) => {
                      const isUser = q.userAnswer === opt;
                      const isAns = q.correctAnswer === opt;

                      let borderClass = "border-[var(--border)]";
                      let bgClass = "bg-[var(--bg-secondary)]/40";
                      let textClass = "text-[var(--text-secondary)]";

                      if (isAns) {
                        borderClass = "border-emerald-500/50";
                        bgClass = "bg-emerald-500/10";
                        textClass = "text-emerald-400 font-bold";
                      } else if (isUser && !isAns) {
                        borderClass = "border-rose-500/50";
                        bgClass = "bg-rose-500/10";
                        textClass = "text-rose-400 font-bold";
                      }

                      return (
                        <div
                          key={oIdx}
                          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${borderClass} ${bgClass} ${textClass}`}
                        >
                          <span>{opt}</span>
                          {isAns && <span className="text-[10px] font-extrabold uppercase ml-2 text-emerald-400">(Correct)</span>}
                          {isUser && !isAns && <span className="text-[10px] font-extrabold uppercase ml-2 text-rose-400">(Your Pick)</span>}
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div className="p-3.5 rounded-xl border bg-[var(--bg-secondary)]/50 text-xs text-[var(--text-secondary)] leading-relaxed mt-2" style={{ borderColor: "var(--border)" }}>
                      <strong className="text-amber-400 block mb-0.5">Solution Logic & Formula:</strong>
                      {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </div>
    );
  }

  // ─── Render: Active Exam Window ───────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[var(--bg-primary)] overflow-hidden select-none">
      
      {/* ── Top Header / Timer Bar ── */}
      <header
        className="flex items-center justify-between px-4 py-2.5 border-b shrink-0 bg-[var(--card-bg)]"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setConfirmSubmitModal(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl border hover:opacity-80 transition cursor-pointer"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-secondary)" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Exit Exam</span>
          </button>

          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--text-primary)]">
              Aptitude Assessment
            </span>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Proctored
            </span>
          </div>
        </div>

        {/* Center: Live Countdown Timer */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-mono text-xs font-black border ${
              timeLeft < 300
                ? "bg-rose-500/10 border-rose-500/40 text-rose-400 animate-pulse"
                : "bg-amber-500/10 border-amber-500/30 text-amber-400"
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
            <span>{formatTime(timeLeft)}</span>
          </div>

          {infractions > 0 && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-rose-400 px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/25">
              <ShieldAlert className="w-3 h-3" />
              <span>{infractions} Warning{infractions > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        {/* Right Action: Submit Button & Palette Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPaletteOpen((o) => !o)}
            className="px-2.5 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer hover:bg-[var(--border)]/20 transition hidden md:flex items-center gap-1.5"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{paletteOpen ? "Hide Grid" : "Show Grid"}</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmSubmitModal(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-md cursor-pointer transition hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #F59E0B 0%, #EA580C 55%, #FF6B35 100%)",
            }}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Finish Test</span>
          </button>
        </div>
      </header>

      {/* ── Main Exam Body: Split View ── */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        
        {/* Left / Center: Question Workspace */}
        <main className="flex-1 flex flex-col justify-between overflow-y-auto p-4 sm:p-6 lg:p-8">
          {currentQuestion && (
            <div className="max-w-3xl w-full mx-auto space-y-6">
              
              {/* Question Header & Category */}
              <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase text-amber-400">
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">•</span>
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    {currentQuestion.category || "General Aptitude"}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-emerald-400 font-mono font-bold">+1.0</span>
                  <span className="text-[var(--text-muted)]">/</span>
                  <span className="text-rose-400 font-mono font-bold">-0.25</span>
                </div>
              </div>

              {/* Question Text */}
              <div className="p-5 sm:p-6 rounded-2xl border bg-[var(--card-bg)] shadow-sm" style={{ borderColor: "var(--border)" }}>
                <p className="text-base sm:text-lg font-medium text-[var(--text-primary)] leading-relaxed">
                  {currentQuestion.question}
                </p>
              </div>

              {/* MCQ 4 Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {(currentQuestion.options || []).map((opt, oIdx) => {
                  const isSelected = answers[currentQuestion.questionId] === opt;
                  return (
                    <button
                      key={oIdx}
                      type="button"
                      onClick={() => handleSelectOption(opt)}
                      className={`p-4 rounded-2xl border text-left text-xs sm:text-sm font-medium transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-amber-500/10 border-amber-500 text-amber-300 shadow-md shadow-amber-500/10"
                          : "bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-secondary)] hover:border-amber-500/40 hover:text-[var(--text-primary)]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${
                            isSelected
                              ? "bg-amber-500 text-black border-amber-500"
                              : "border-[var(--border)] text-[var(--text-muted)]"
                          }`}
                        >
                          {String.fromCharCode(65 + oIdx)}
                        </div>
                        <span>{opt}</span>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>

            </div>
          )}

          {/* Bottom Question Action Bar */}
          <div className="max-w-3xl w-full mx-auto pt-6 mt-6 border-t flex items-center justify-between gap-3" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMarkForReview}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  currentQuestion && markedForReview.has(currentQuestion.questionId)
                    ? "bg-purple-500/15 border-purple-500/40 text-purple-400"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:text-white"
                }`}
              >
                {currentQuestion && markedForReview.has(currentQuestion.questionId) ? (
                  <BookmarkCheck className="w-3.5 h-3.5" />
                ) : (
                  <Bookmark className="w-3.5 h-3.5" />
                )}
                <span>Review Flag</span>
              </button>

              {currentQuestion && answers[currentQuestion.questionId] != null && (
                <button
                  type="button"
                  onClick={handleClearOption}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-muted)] hover:text-rose-400 transition cursor-pointer"
                >
                  Clear Selection
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                className="flex items-center gap-1 px-3.5 py-2 rounded-xl border text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
                style={{ borderColor: "var(--border)" }}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <button
                type="button"
                disabled={currentIndex === questions.length - 1}
                onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, #F59E0B 0%, #EA580C 55%, #FF6B35 100%)",
                }}
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </main>

        {/* Right Palette Drawer */}
        {paletteOpen && (
          <aside
            className="w-72 border-l p-5 flex flex-col justify-between overflow-y-auto shrink-0 bg-[var(--card-bg)] hidden md:flex"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: "var(--border)" }}>
                <span className="text-xs font-bold text-[var(--text-primary)]">Question Palette</span>
                <span className="text-[11px] font-mono text-[var(--text-muted)]">{answeredCount} of {questions.length} Answered</span>
              </div>

              {/* Legend */}
              <div className="grid grid-cols-2 gap-2 text-[10.5px] text-[var(--text-secondary)]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-md bg-emerald-500" />
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-md bg-purple-500" />
                  <span>Flagged</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-md bg-slate-700" />
                  <span>Unvisited</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-md border border-amber-500" />
                  <span>Current</span>
                </div>
              </div>

              {/* Palette Buttons Grid */}
              <div className="grid grid-cols-5 gap-2 pt-2">
                {questions.map((q, idx) => {
                  const status = getQuestionStatus(q.questionId, idx);
                  const isCurrent = idx === currentIndex;

                  let bgStyle = "rgba(255, 255, 255, 0.05)";
                  let borderStyle = "1px solid var(--border)";
                  let textStyle = "var(--text-muted)";

                  if (status === "answered") {
                    bgStyle = "rgba(16, 185, 129, 0.25)";
                    borderStyle = "1px solid #10B981";
                    textStyle = "#10B981";
                  } else if (status === "marked") {
                    bgStyle = "rgba(139, 92, 246, 0.25)";
                    borderStyle = "1px solid #8B5CF6";
                    textStyle = "#A78BFA";
                  } else if (status === "answered-marked") {
                    bgStyle = "rgba(139, 92, 246, 0.35)";
                    borderStyle = "2px solid #10B981";
                    textStyle = "#FFFFFF";
                  }

                  if (isCurrent) {
                    borderStyle = "2px solid #F59E0B";
                  }

                  return (
                    <button
                      key={q.questionId || idx}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className="w-10 h-10 rounded-xl text-xs font-bold cursor-pointer transition flex items-center justify-center"
                      style={{ background: bgStyle, border: borderStyle, color: textStyle }}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Summary Card */}
            <div className="pt-4 border-t space-y-2 text-xs" style={{ borderColor: "var(--border)" }}>
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>Marked for Review:</span>
                <span className="font-bold text-purple-400 font-mono">{markedCount}</span>
              </div>
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>Unanswered:</span>
                <span className="font-bold text-rose-400 font-mono">{questions.length - answeredCount}</span>
              </div>
            </div>
          </aside>
        )}

      </div>

      {/* ── Proctoring Warning Dialog ── */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="max-w-md w-full p-6 rounded-3xl border border-rose-500/40 bg-[var(--card-bg)] shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-500">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                Integrity Alert: Tab Switch Detected
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                You have left the active examination window. This incident has been logged. Continuous window switches will result in automatic exam disqualification.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowWarningModal(false)}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer transition shadow-md"
            >
              I Understand, Resume Test
            </button>
          </div>
        </div>
      )}

      {/* ── Confirm Submit Modal ── */}
      {confirmSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="max-w-md w-full p-6 sm:p-7 rounded-3xl border bg-[var(--card-bg)] shadow-2xl space-y-5 text-center" style={{ borderColor: "var(--border)" }}>
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                Confirm Finish Assessment?
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                You have answered <strong className="text-[var(--text-primary)]">{answeredCount}</strong> out of <strong className="text-[var(--text-primary)]">{questions.length}</strong> questions.
                {questions.length - answeredCount > 0 && ` There are ${questions.length - answeredCount} unanswered questions remaining.`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setConfirmSubmitModal(false)}
                className="flex-1 py-2.5 rounded-xl border text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--border)]/20 transition cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                Continue Test
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition hover:opacity-90 cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, #F59E0B 0%, #EA580C 55%, #FF6B35 100%)",
                }}
              >
                Submit Now
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
