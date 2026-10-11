import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  GraduationCap,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  BarChart3,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  FileText,
  AlertTriangle,
  RotateCcw,
  Send,
  Flag,
  Sparkles,
  Trophy,
  Check,
  X,
  Target,
  Zap,
  Layers,
  Filter,
  Search,
  Lock,
} from "lucide-react";
import api from "../../../core/api/api.js";
import { getAuthToken } from "../../student/hooks/useStudentProfile.js";
import { formatTime } from "../../../core/utils/dateUtils.js";
import {
  ALL_NPTEL_QUESTIONS,
  NPTEL_TEST_META,
  NPTEL_THEME,
  evaluateAnswer,
  getLocalTestProgress,
  saveLocalTestAttempt,
  getLocalDraftAnswers,
  saveLocalDraftAnswers,
  clearLocalDraftAnswers,
  getLocalBookmarks,
  toggleLocalBookmark,
} from "../data/nptelData.js";

export default function NptelAssignmentTest() {
  const navigate = useNavigate();
  const token = getAuthToken();

  // Dedicated practice mode with instant evaluation & auto-advance on correct
  const mode = "practice";

  const [passageModalOpen, setPassageModalOpen] = useState(false);
  const [explanationModalOpen, setExplanationModalOpen] = useState(false);

  // Test state
  const [questionsList, setQuestionsList] = useState(ALL_NPTEL_QUESTIONS);
  const [phase, setPhase] = useState("active"); // "active" | "result"
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState(() => getLocalDraftAnswers());
  const [flagged, setFlagged] = useState(new Set());
  const [bookmarks, setBookmarks] = useState(() => getLocalBookmarks());
  const [checkedPractice, setCheckedPractice] = useState(() => {
    const drafts = getLocalDraftAnswers();
    const init = {};
    if (drafts && typeof drafts === "object") {
      Object.keys(drafts).forEach((k) => {
        const val = drafts[k];
        if (val !== null && val !== undefined && (!Array.isArray(val) || val.length > 0)) {
          init[k] = true;
        }
      });
    }
    return init;
  });
  const [paletteFilter, setPaletteFilter] = useState("all"); // "all" | "answered" | "unanswered" | "flagged"
  const [passageOpen, setPassageOpen] = useState(false);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);

  // Load questions from DB if available (to sync with Admin uploads/edits)
  useEffect(() => {
    let isMounted = true;
    async function loadQuestionsFromDb() {
      try {
        const res = await api.get("/api/nptel/test?includeSolutions=true");
        if (res.data?.success && Array.isArray(res.data.questions) && res.data.questions.length > 0) {
          if (isMounted) {
            setQuestionsList(res.data.questions);
          }
        }
      } catch (err) {
        console.warn("Using offline/local questions fallback:", err?.message);
      }
    }
    loadQuestionsFromDb();
    return () => {
      isMounted = false;
    };
  }, []);

  // Timer: 120 minutes (7200 seconds) for 120 questions in exam mode
  const [timeLeft, setTimeLeft] = useState(7200);
  const [timerRunning, setTimerRunning] = useState(true);
  const timerRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const solutionRef = useRef(null);

  // Auto-advance to next question if answer is correct
  const [autoAdvanceOnCorrect, setAutoAdvanceOnCorrect] = useState(true);
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);
  const autoAdvanceTimerRef = useRef(null);

  // Clear timer when question changes or unmounts
  useEffect(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
    }
    setIsAutoAdvancing(false);
  }, [currentIndex]);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  // Result state
  const [resultData, setResultData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmitModal, setConfirmSubmitModal] = useState(false);
  const [reviewFilter, setReviewFilter] = useState("all"); // "all" | "correct" | "incorrect"

  const totalQuestions = questionsList.length;
  const currentQuestion = questionsList[currentIndex] || questionsList[0] || ALL_NPTEL_QUESTIONS[0];
  const isMulti = currentQuestion?.type === "multiple";
  const currentAnswer = answers[currentQuestion?.id] || (isMulti ? [] : null);
  const isAnswered = isMulti
    ? Array.isArray(currentAnswer) && currentAnswer.length > 0
    : currentAnswer !== null && currentAnswer !== undefined;

  // For single-choice: selecting an option immediately registers and locks the answer.
  // For multi-choice (MSQ): selections are made freely, and clicking "Next" checks and locks the answer.
  const isLocked = isMulti ? Boolean(checkedPractice[currentQuestion?.id]) : Boolean(isAnswered);

  // Practice evaluation status for current question
  const isCheckedInPractice = isMulti
    ? Boolean(isAnswered && checkedPractice[currentQuestion?.id])
    : Boolean(isAnswered);

  // Autosave draft answers
  useEffect(() => {
    saveLocalDraftAnswers(answers);
  }, [answers]);

  // Smooth scroll directly to the answer explanation when an option is selected / verified in practice mode
  useEffect(() => {
    if (isCheckedInPractice && mode === "practice" && solutionRef.current) {
      const timer = setTimeout(() => {
        solutionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isCheckedInPractice, currentIndex, mode]);

  // Bookmarking toggle
  const handleToggleBookmark = (qId) => {
    const updated = toggleLocalBookmark(qId);
    setBookmarks(new Set(updated));
    toast.success(updated.has(qId) ? "Question bookmarked" : "Bookmark removed");
  };

  // Flag toggle
  const handleToggleFlag = (qId) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  // Option selection
  const handleSelectOption = (option) => {
    if (phase === "result") return;

    if (isLocked) {
      toast.error("Answer has already been submitted for this question and cannot be modified.", {
        id: "locked-answer",
      });
      return;
    }

    if (isMulti) {
      const existing = Array.isArray(currentAnswer) ? [...currentAnswer] : [];
      const exists = existing.includes(option);
      const updated = exists ? existing.filter((o) => o !== option) : [...existing, option];
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: updated }));

      // Multi-choice options are toggled freely; answer is evaluated when user clicks Next.
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
      setIsAutoAdvancing(false);
    } else {
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: option }));
      // For single-choice in practice mode, directly mark as checked to show answer immediately & permanently lock
      if (mode === "practice") {
        setCheckedPractice((prev) => ({ ...prev, [currentQuestion.id]: true }));
        const evalRes = evaluateAnswer(currentQuestion, option);
        if (evalRes.isCorrect) {
          if (autoAdvanceOnCorrect && currentIndex < totalQuestions - 1) {
            setIsAutoAdvancing(true);
            if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
            autoAdvanceTimerRef.current = setTimeout(() => {
              setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1));
              setIsAutoAdvancing(false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }, 800);
          } else if (currentIndex === totalQuestions - 1) {
            toast.success("Correct! You have reached the final question.", { icon: "🎉" });
          }
        } else {
          // If answer is incorrect, stay on the question so user can see solution
          if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
          setIsAutoAdvancing(false);
        }
      }
    }
  };

  // Next button click handler:
  // For multiple-choice (MSQ): if answers have been selected and not yet checked, clicking Next checks the answer!
  // If already checked (or for MCQ, or if MSQ skipped without answer): Next navigates to the next question.
  const handleNext = () => {
    // If auto-advancing is in progress and user clicks Next, advance immediately
    if (isAutoAdvancing) {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
      setIsAutoAdvancing(false);
      if (currentIndex < totalQuestions - 1) {
        setCurrentIndex((prev) => prev + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }

    // For multiple choice (MSQ) questions: check answer if not checked yet
    if (isMulti && isAnswered && !checkedPractice[currentQuestion?.id]) {
      setCheckedPractice((prev) => ({ ...prev, [currentQuestion.id]: true }));
      const evalRes = evaluateAnswer(currentQuestion, currentAnswer);
      if (evalRes.isCorrect) {
        if (autoAdvanceOnCorrect && currentIndex < totalQuestions - 1) {
          setIsAutoAdvancing(true);
          if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
          autoAdvanceTimerRef.current = setTimeout(() => {
            setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1));
            setIsAutoAdvancing(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }, 900);
        } else if (currentIndex === totalQuestions - 1) {
          toast.success("Correct! You have reached the final question.", { icon: "🎉" });
        }
      } else {
        if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
        setIsAutoAdvancing(false);
      }
      return;
    }

    // Standard Next navigation
    if (currentIndex < totalQuestions - 1) {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
      setIsAutoAdvancing(false);
      setCurrentIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Clear answer for current question (only allowed before final submission for multi-choice)
  const handleClearAnswer = () => {
    if (isLocked) {
      toast.error("Answer cannot be changed once submitted.", { id: "locked-clear" });
      return;
    }
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[currentQuestion.id];
      return next;
    });
    setCheckedPractice((prev) => ({ ...prev, [currentQuestion.id]: false }));
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    setIsAutoAdvancing(false);
  };

  // Exam mode timer
  useEffect(() => {
    if (mode !== "exam" || phase !== "active" || !timerRunning) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          toast.error("Time is up! Submitting your assignment test.");
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [mode, phase, timerRunning]);

  // Submit test
  const handleSubmit = async () => {
    setSubmitting(true);
    setConfirmSubmitModal(false);

    const timeSpent = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));

    // Try server evaluation first if logged in
    try {
      if (token) {
        const res = await api.post(
          "/api/nptel/submit",
          {
            answers,
            mode,
            timeSpentSeconds: timeSpent,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data?.success) {
          setResultData(res.data);
          saveLocalTestAttempt({
            score: res.data.score,
            maxScore: res.data.maxScore,
            answers,
          });
          clearLocalDraftAnswers();
          setPhase("result");
          window.scrollTo({ top: 0, behavior: "smooth" });
          setSubmitting(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Server submission fallback to client evaluation:", err.message);
    }

    // Client evaluation
    let totalScore = 0;
    let correctCount = 0;
    let partiallyCorrectCount = 0;
    let incorrectCount = 0;

    const evaluated = questionsList.map((q) => {
      const userSel = answers[q.id];
      const evalRes = evaluateAnswer(q, userSel);

      totalScore += evalRes.pointsEarned;
      if (evalRes.isCorrect) correctCount++;
      else if (evalRes.isPartiallyCorrect) partiallyCorrectCount++;
      else incorrectCount++;

      return {
        id: q.id,
        questionNumber: q.questionNumber,
        sectionTitle: q.sectionTitle,
        sectionBadge: q.sectionBadge,
        questionText: q.questionText,
        type: q.type,
        options: q.options,
        userSelection: userSel || null,
        correctAnswers: q.correctAnswers,
        pointsEarned: evalRes.pointsEarned,
        maxPoints: q.points || 1,
        status: evalRes.status,
        explanation: q.explanation,
        passageTitle: q.passageTitle || null,
        passage: q.passage || null,
      };
    });

    totalScore = Number(totalScore.toFixed(2));
    const percentage = Number(((totalScore / totalQuestions) * 100).toFixed(1));

    const finalResult = {
      success: true,
      title: NPTEL_TEST_META.title,
      score: totalScore,
      maxScore: totalQuestions,
      percentage,
      correctCount,
      partiallyCorrectCount,
      incorrectCount,
      timeSpentSeconds: timeSpent,
      results: evaluated,
    };

    saveLocalTestAttempt({
      score: totalScore,
      maxScore: totalQuestions,
      answers,
    });
    clearLocalDraftAnswers();

    setResultData(finalResult);
    setPhase("result");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setSubmitting(false);
  };

  const answeredCount = Object.keys(answers).filter((k) => {
    const val = answers[k];
    return Array.isArray(val) ? val.length > 0 : Boolean(val);
  }).length;

  const progressPercent = Math.round(((currentIndex + 1) / totalQuestions) * 100);

  // Palette filtered list
  const filteredPaletteQuestions = useMemo(() => {
    return questionsList.filter((q, idx) => {
      const isAns = answers[q.id] && (Array.isArray(answers[q.id]) ? answers[q.id].length > 0 : true);
      const isFlg = flagged.has(q.id);

      if (paletteFilter === "answered") return isAns;
      if (paletteFilter === "unanswered") return !isAns;
      if (paletteFilter === "flagged") return isFlg;
      return true;
    });
  }, [paletteFilter, answers, flagged, questionsList]);

  const currentPracticeEval = useMemo(() => {
    if (!isCheckedInPractice) return null;
    return evaluateAnswer(currentQuestion, currentAnswer);
  }, [isCheckedInPractice, currentQuestion, currentAnswer]);

  // ═══════════════════════════════════════════════
  // RESULT VIEW
  // ═══════════════════════════════════════════════
  if (phase === "result" && resultData) {
    const isPassing = resultData.percentage >= 40;
    const isMastery = resultData.percentage >= 75;

    return (
      <div className="page-container py-8 max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
          {/* Top Return & Leaderboard Buttons */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setPhase("active");
                  setAnswers({});
                  setCheckedPractice({});
                  setTimeLeft(7200);
                  setCurrentIndex(0);
                }}
                className="flex items-center gap-2 text-xs sm:text-sm font-bold cursor-pointer hover:opacity-85 transition px-3 py-1.5 rounded-xl border"
                style={{
                  borderColor: NPTEL_THEME.border,
                  background: NPTEL_THEME.bgSubtle,
                  color: NPTEL_THEME.primary,
                }}
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retake NPTEL Test</span>
              </button>

              <button
                type="button"
                onClick={() => navigate("/nptel-assignment/leaderboard")}
                className="flex items-center gap-2 text-xs sm:text-sm font-bold cursor-pointer hover:opacity-85 transition px-3 py-1.5 rounded-xl border"
                style={{
                  borderColor: "rgba(245, 158, 11, 0.35)",
                  background: "rgba(245, 158, 11, 0.08)",
                  color: "#F59E0B",
                }}
              >
                <Trophy className="w-4 h-4" />
                <span>View NPTEL Leaderboard</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => navigate("/nptel-assignment")}
              className="text-xs sm:text-sm font-bold cursor-pointer transition flex items-center gap-1.5 hover:opacity-85"
              style={{ color: "var(--text-secondary)" }}
            >
              ← Back to Assignment
            </button>
          </div>

          {/* Performance Hero Card with Adaptive Theme Colors (No Dark Black Fade) */}
          <div
            className="rounded-3xl p-6 sm:p-10 mb-8 border relative overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in srgb, #FF6B35 12%, var(--card-bg)) 0%, var(--card-bg) 55%, color-mix(in srgb, #FF6B35 5%, var(--card-bg)) 100%)",
              borderColor: "color-mix(in srgb, #FF6B35 30%, var(--border))",
              boxShadow: "0 10px 30px -10px rgba(255, 107, 53, 0.15)",
            }}
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="max-w-xl">
                <div
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-3 border"
                  style={{
                    background: NPTEL_THEME.bgSubtle,
                    borderColor: NPTEL_THEME.border,
                    color: NPTEL_THEME.primary,
                  }}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Comprehensive Assignment Result</span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black mb-2" style={{ color: "var(--text-primary)" }}>
                  {NPTEL_TEST_META.title}
                </h1>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {isMastery
                    ? "Outstanding performance! You have demonstrated exceptional mastery across all 120 research methodology concepts."
                    : isPassing
                    ? "Congratulations! You have passed the comprehensive assignment benchmark. Review missed questions below."
                    : "Score below passing mark. Go through each question and solution below to reinforce your research concepts."}
                </p>
              </div>

              {/* Circular Score Gauge */}
              <div
                className="flex flex-col items-center justify-center p-6 rounded-2xl border min-w-[190px]"
                style={{
                  background: "var(--bg-secondary)",
                  borderColor: "color-mix(in srgb, #FF6B35 25%, var(--border))",
                  boxShadow: "0 8px 24px -6px rgba(255, 107, 53, 0.12)",
                }}
              >
                <span className="text-4xl font-black" style={{ color: NPTEL_THEME.primary }}>
                  {resultData.score}
                  <span className="text-lg font-bold" style={{ color: "var(--text-muted)" }}>
                    /{resultData.maxScore}
                  </span>
                </span>
                <span className="text-xs font-bold mt-1 uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                  {resultData.percentage}% Overall
                </span>
                <span className="text-[11px] font-medium mt-1" style={{ color: "var(--text-muted)" }}>
                  Time: {formatTime(resultData.timeSpentSeconds || 0)}
                </span>
              </div>
            </div>

            {/* Metric Strips */}
            <div className="grid grid-cols-4 gap-3 mt-6 pt-6 border-t" style={{ borderColor: "var(--border)" }}>
              <div className="text-center">
                <div className="text-xl font-black text-emerald-400">{resultData.correctCount}</div>
                <div className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Correct</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-black text-amber-400">{resultData.partiallyCorrectCount || 0}</div>
                <div className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Partial</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-black text-red-400">{resultData.incorrectCount}</div>
                <div className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Incorrect</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-black" style={{ color: NPTEL_THEME.primary }}>
                  {totalQuestions - (resultData.correctCount + (resultData.partiallyCorrectCount || 0) + resultData.incorrectCount)}
                </div>
                <div className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Unanswered</div>
              </div>
            </div>

            {/* Action CTAs in Result View */}
            <div className="flex flex-wrap items-center justify-center gap-4 mt-8 pt-6 border-t" style={{ borderColor: "var(--border)" }}>
              <button
                type="button"
                onClick={() => {
                  setPhase("active");
                  setAnswers({});
                  setCheckedPractice({});
                  setTimeLeft(7200);
                  setCurrentIndex(0);
                }}
                className="px-6 py-3 rounded-2xl text-sm font-black text-white cursor-pointer transition shadow-lg hover:opacity-95 active:scale-95 flex items-center gap-2"
                style={{
                  background: NPTEL_THEME.gradient,
                  boxShadow: NPTEL_THEME.glow,
                }}
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retake Test</span>
              </button>

              <button
                type="button"
                onClick={() => navigate("/nptel-assignment/leaderboard")}
                className="px-6 py-3 rounded-2xl text-sm font-black cursor-pointer transition border hover:bg-[var(--bg-secondary)] flex items-center gap-2"
                style={{
                  borderColor: NPTEL_THEME.border,
                  background: NPTEL_THEME.bgSubtle,
                  color: NPTEL_THEME.primary,
                }}
              >
                <Trophy className="w-4 h-4" />
                <span>View Leaderboard</span>
              </button>

              <button
                type="button"
                onClick={() => navigate("/nptel-assignment")}
                className="px-5 py-3 rounded-2xl text-sm font-bold border transition cursor-pointer hover:bg-[var(--bg-secondary)]"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                }}
              >
                ← Back to Assignment
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // ACTIVE TEST / PRACTICE WORKSPACE (ORANGE THEME)
  // ═══════════════════════════════════════════════
  const hasPassage = Boolean(currentQuestion?.passage);
  const isBookmarked = bookmarks.has(currentQuestion?.id);
  const isFlagged = flagged.has(currentQuestion?.id);

  return (
    <div className="h-[calc(100vh-4.25rem)] max-h-[calc(100vh-4.25rem)] overflow-hidden flex flex-col px-2 sm:px-4 py-2 select-none w-full max-w-[1600px] mx-auto">
      {/* ═══════════════════════════════════════════════
          TOP COMPACT HEADER BAR
      ═══════════════════════════════════════════════ */}
      <div className="shrink-0 flex items-center justify-between gap-2 mb-2 pb-2 border-b border-[var(--border)]">
        {/* Left: Back Button + Branding */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            id="nptel-test-back-btn"
            onClick={() => {
              if (answeredCount > 0) {
                setConfirmSubmitModal(true);
              } else {
                navigate("/nptel-assignment");
              }
            }}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition hover:bg-[var(--bg-secondary)] shrink-0"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            title="Exit / Submit NPTEL Assignment"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exit</span>
          </button>
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border"
            style={{
              background: NPTEL_THEME.bgSubtle,
              borderColor: NPTEL_THEME.border,
              color: NPTEL_THEME.primary,
            }}
          >
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm sm:text-base font-black truncate" style={{ color: "var(--text-primary)" }}>
                {NPTEL_TEST_META.title}
              </h1>
              <span
                className="hidden sm:inline-block text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                style={{
                  background: NPTEL_THEME.bgSubtle,
                  color: NPTEL_THEME.primary,
                  border: `1px solid ${NPTEL_THEME.border}`,
                }}
              >
                120 MCQs
              </span>
            </div>
            <p className="hidden md:block text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
              {`Question ${currentIndex + 1} of ${totalQuestions} · ${currentQuestion?.sectionTitle}`}
            </p>
          </div>
        </div>

        {/* Right: Auto-Next Toggle, Answered Count & Palette Drawer */}
        <div className="flex items-center gap-2">
          {/* Auto-Next on Correct Toggle */}
          <button
            type="button"
            onClick={() => {
              const nextState = !autoAdvanceOnCorrect;
              setAutoAdvanceOnCorrect(nextState);
              toast.success(
                nextState
                  ? "Auto-Next enabled: advances automatically on correct answer"
                  : "Auto-Next disabled"
              );
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition cursor-pointer"
            style={{
              borderColor: autoAdvanceOnCorrect ? NPTEL_THEME.border : "var(--border)",
              background: autoAdvanceOnCorrect ? NPTEL_THEME.bgSubtle : "var(--bg-secondary)",
              color: autoAdvanceOnCorrect ? NPTEL_THEME.primary : "var(--text-muted)",
            }}
            title="Automatically advance to next question when answered correctly"
          >
            <Zap className={`w-3.5 h-3.5 ${autoAdvanceOnCorrect ? "fill-[#FF6B35]" : ""}`} />
            <span className="hidden sm:inline">Auto-Next</span>
            <span
              className="text-[10px] px-1 py-0.2 rounded font-black uppercase"
              style={{
                background: autoAdvanceOnCorrect
                  ? "rgba(255, 107, 53, 0.2)"
                  : "rgba(156, 163, 175, 0.2)",
                color: autoAdvanceOnCorrect ? NPTEL_THEME.primary : "inherit",
              }}
            >
              {autoAdvanceOnCorrect ? "ON" : "OFF"}
            </span>
          </button>

          {/* Submit Button near Auto-Next */}
          <button
            type="button"
            onClick={() => setConfirmSubmitModal(true)}
            className="px-3 sm:px-3.5 py-1 rounded-xl text-xs font-bold text-white cursor-pointer transition shadow-md hover:opacity-95 active:scale-95 flex items-center gap-1.5 shrink-0"
            style={{
              background: NPTEL_THEME.gradient,
              boxShadow: NPTEL_THEME.glow,
            }}
            title="Submit Test"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit</span>
          </button>

          {/* Progress Count Badge */}
          <div
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-bold"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg-secondary)",
              color: "var(--text-secondary)",
            }}
          >
            <span style={{ color: NPTEL_THEME.primary }}>{answeredCount}</span>
            <span>/</span>
            <span>{totalQuestions}</span>
          </div>

          {/* Mobile / Tablet Palette Drawer Toggle */}
          <button
            type="button"
            onClick={() => setMobilePaletteOpen((prev) => !prev)}
            className="lg:hidden p-1.5 rounded-xl border cursor-pointer hover:bg-[var(--bg-secondary)]"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            title="Question Palette"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="shrink-0 w-full h-1 rounded-full overflow-hidden mb-2 bg-[var(--border)]">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: NPTEL_THEME.gradient,
            boxShadow: NPTEL_THEME.glow,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.2 }}
        />
      </div>

      {/* ═══════════════════════════════════════════════
          SINGLE-PAGE NO-SCROLL TEST WORKSPACE
      ═══════════════════════════════════════════════ */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden">
          {/* Left Column: Active Question Workspace */}
          <div className="lg:col-span-8 xl:col-span-9 flex flex-col h-full min-h-0 student-card rounded-2xl border p-3 sm:p-4 overflow-hidden relative" style={{ borderColor: "var(--border)" }}>
            
            {/* Top Question Metadata Row (shrink-0) */}
            <div className="shrink-0 flex items-center justify-between gap-2 pb-2 mb-2 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span
                  className="px-2.5 py-0.5 rounded-lg text-xs font-black tracking-wide border"
                  style={{
                    background: NPTEL_THEME.bgSubtle,
                    borderColor: NPTEL_THEME.border,
                    color: NPTEL_THEME.primary,
                  }}
                >
                  Question {currentQuestion.questionNumber} of {totalQuestions}
                </span>

                <span className="text-[11px] font-semibold px-2 py-0.5 rounded text-gray-400 border" style={{ borderColor: "var(--border)" }}>
                  {currentQuestion.points || 1} Pt
                </span>

                {isMulti && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1"
                    style={{
                      background: NPTEL_THEME.bgSubtle,
                      borderColor: NPTEL_THEME.border,
                      color: NPTEL_THEME.primary,
                    }}
                  >
                    <span>MSQ</span>
                    <span className="hidden sm:inline">(Multi-Select)</span>
                  </span>
                )}

                {isLocked && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1"
                    style={{
                      background: "rgba(245, 158, 11, 0.12)",
                      borderColor: "rgba(245, 158, 11, 0.35)",
                      color: "#F59E0B",
                    }}
                    title="Answer submitted and locked"
                  >
                    <Lock className="w-3 h-3" />
                    <span>Locked</span>
                  </span>
                )}

                {hasPassage && (
                  <button
                    type="button"
                    onClick={() => setPassageModalOpen(true)}
                    className="text-[11px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 cursor-pointer transition hover:opacity-90"
                    style={{
                      background: "rgba(255, 107, 53, 0.15)",
                      borderColor: NPTEL_THEME.border,
                      color: NPTEL_THEME.primary,
                    }}
                  >
                    <FileText className="w-3 h-3" />
                    <span>View Passage</span>
                  </button>
                )}
              </div>

              {/* Bookmark & Flag */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleToggleBookmark(currentQuestion.id)}
                  className="p-1 rounded-lg border hover:bg-[var(--bg-secondary)] transition cursor-pointer"
                  style={{
                    borderColor: "var(--border)",
                    color: isBookmarked ? NPTEL_THEME.primary : "var(--text-muted)",
                  }}
                  title={isBookmarked ? "Remove Bookmark" : "Bookmark Question"}
                >
                  {isBookmarked ? (
                    <BookmarkCheck className="w-3.5 h-3.5 fill-[#FF6B35]" />
                  ) : (
                    <Bookmark className="w-3.5 h-3.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleFlag(currentQuestion.id)}
                  className="text-[11px] font-semibold flex items-center gap-1 cursor-pointer px-2 py-0.5 rounded-lg border transition"
                  style={{
                    borderColor: isFlagged ? "#F59E0B" : "var(--border)",
                    color: isFlagged ? "#F59E0B" : "var(--text-muted)",
                    background: isFlagged ? "rgba(245, 158, 11, 0.12)" : "transparent",
                  }}
                  title="Flag for Review"
                >
                  <Flag className="w-3 h-3" />
                  <span className="hidden sm:inline">{isFlagged ? "Flagged" : "Review"}</span>
                </button>
              </div>
            </div>

            {/* Question Text & Prompt (shrink-0) */}
            <div className="shrink-0 mb-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                Topic: {currentQuestion.sectionTitle}
              </div>

              <h2
                className="text-xs sm:text-sm md:text-base font-bold leading-snug max-h-24 overflow-y-auto pr-1"
                style={{ color: "var(--text-primary)" }}
              >
                {currentQuestion.questionText}
              </h2>

            </div>

            {/* Options List (flex-1 min-h-0 overflow-y-auto) */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 sm:space-y-2 py-1 pr-1">
              {currentQuestion.options.map((opt, optIdx) => {
                const isSelected = isMulti
                  ? Array.isArray(currentAnswer) && currentAnswer.includes(opt)
                  : currentAnswer === opt;

                const letter = String.fromCharCode(65 + optIdx);

                let optionBorder = isSelected ? NPTEL_THEME.primary : "var(--border)";
                let optionBg = isSelected
                  ? "color-mix(in srgb, #FF6B35 12%, transparent)"
                  : "var(--input-bg)";

                if (isCheckedInPractice) {
                  const isAccepted = currentQuestion.correctAnswers.includes(opt);
                  if (isAccepted) {
                    optionBorder = "#10B981";
                    optionBg = "rgba(16, 185, 129, 0.12)";
                  } else if (isSelected && !isAccepted) {
                    optionBorder = "#EF4444";
                    optionBg = "rgba(239, 68, 68, 0.12)";
                  }
                }

                return (
                  <button
                    key={optIdx}
                    type="button"
                    disabled={isLocked}
                    onClick={() => handleSelectOption(opt)}
                    className={`w-full p-2.5 sm:p-3 rounded-xl border text-left text-xs sm:text-sm font-medium transition flex items-center justify-between gap-2.5 group min-h-[42px] ${
                      isLocked ? "cursor-default" : "cursor-pointer hover:border-[#FF6B35]/50"
                    }`}
                    style={{
                      borderColor: optionBorder,
                      background: optionBg,
                      color: "var(--text-primary)",
                      boxShadow: isSelected ? "0 4px 15px -3px rgba(255, 107, 53, 0.2)" : "none",
                      opacity: isLocked && !isSelected && !currentQuestion.correctAnswers.includes(opt) ? 0.65 : 1,
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      {isMulti ? (
                        /* Square Checkbox for MSQ */
                        <span
                          className="w-5 h-5 rounded-[5px] flex items-center justify-center shrink-0 border-2 transition-all shadow-sm"
                          style={{
                            borderColor: isSelected
                              ? (isCheckedInPractice
                                  ? (currentQuestion.correctAnswers.includes(opt) ? "#10B981" : "#EF4444")
                                  : NPTEL_THEME.primary)
                              : "rgba(156, 163, 175, 0.6)",
                            background: isSelected
                              ? (isCheckedInPractice
                                  ? (currentQuestion.correctAnswers.includes(opt) ? "#10B981" : "#EF4444")
                                  : NPTEL_THEME.primary)
                              : (isCheckedInPractice && currentQuestion.correctAnswers.includes(opt)
                                  ? "rgba(16, 185, 129, 0.2)"
                                  : "transparent"),
                          }}
                        >
                          {isSelected ? (
                            <Check className="w-3.5 h-3.5 text-white stroke-[3.5]" />
                          ) : isCheckedInPractice && currentQuestion.correctAnswers.includes(opt) ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                          ) : null}
                        </span>
                      ) : (
                        /* Radio Circle for Single Choice */
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 transition-all"
                          style={{
                            borderColor: isSelected ? NPTEL_THEME.primary : "rgba(156, 163, 175, 0.6)",
                            background: "transparent",
                          }}
                        >
                          {isSelected && (
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{
                                background: isCheckedInPractice
                                  ? (currentQuestion.correctAnswers.includes(opt) ? "#10B981" : "#EF4444")
                                  : NPTEL_THEME.primary,
                              }}
                            />
                          )}
                        </span>
                      )}

                      {/* Option Letter Badge (A, B, C, D) */}
                      <span
                        className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 border text-[11px] font-bold"
                        style={{
                          borderColor: "var(--border)",
                          background: "var(--bg-secondary)",
                          color: isSelected ? NPTEL_THEME.primary : "var(--text-muted)",
                        }}
                      >
                        {letter}
                      </span>

                      <span>{opt}</span>
                    </div>

                    {isCheckedInPractice && (
                      <span className="shrink-0 text-xs font-bold">
                        {currentQuestion.correctAnswers.includes(opt) ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Correct
                          </span>
                        ) : isSelected ? (
                          <span className="text-red-400 flex items-center gap-1">
                            <X className="w-3.5 h-3.5" /> Incorrect
                          </span>
                        ) : null}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Inline Practice Feedback Strip & Auto-Advancing Notification (shrink-0) */}
            <div className="shrink-0 pt-1.5">
              {/* Auto-Advancing Banner */}
              <AnimatePresence>
                {isAutoAdvancing && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="p-2 mb-1.5 rounded-xl border flex items-center justify-between gap-2 text-xs font-bold"
                    style={{
                      background: "rgba(16, 185, 129, 0.12)",
                      borderColor: "rgba(16, 185, 129, 0.4)",
                      color: "#10B981",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3] text-emerald-400" />
                      </span>
                      <span>Correct! Advancing to next question...</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
                        setIsAutoAdvancing(false);
                        toast("Auto-advance cancelled. Staying on this question.", { icon: "ℹ️" });
                      }}
                      className="px-2 py-0.5 rounded-lg border text-[10px] font-semibold hover:bg-emerald-500/20 cursor-pointer transition shrink-0"
                      style={{ borderColor: "rgba(16, 185, 129, 0.4)", color: "#10B981" }}
                    >
                      Stay Here
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Compact Solution Feedback Strip */}
              {isCheckedInPractice && currentPracticeEval && (
                <div
                  className="p-2 rounded-xl border text-xs flex items-center justify-between gap-2"
                  style={{
                    background: currentPracticeEval?.isCorrect
                      ? "rgba(16, 185, 129, 0.08)"
                      : currentPracticeEval?.isPartiallyCorrect
                      ? "rgba(245, 158, 11, 0.08)"
                      : "rgba(239, 68, 68, 0.08)",
                    borderColor: currentPracticeEval?.isCorrect
                      ? "rgba(16, 185, 129, 0.3)"
                      : currentPracticeEval?.isPartiallyCorrect
                      ? "rgba(245, 158, 11, 0.3)"
                      : "rgba(239, 68, 68, 0.3)",
                  }}
                >
                  <div className="flex items-center gap-2 truncate">
                    {currentPracticeEval?.isCorrect ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Correct (+1 Pt)
                      </span>
                    ) : currentPracticeEval?.isPartiallyCorrect ? (
                      <span className="text-amber-400 flex items-center gap-1 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5" /> Partial (+{currentPracticeEval?.pointsEarned} Pt)
                      </span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-1 font-bold">
                        <XCircle className="w-3.5 h-3.5" /> Incorrect (0 Pt)
                      </span>
                    )}

                    <span className="hidden sm:inline text-gray-400">·</span>
                    <span className="text-[11px] text-gray-300 truncate">
                      Accepted: <strong className="text-emerald-400">{currentQuestion.correctAnswers.join(" | ")}</strong>
                    </span>
                  </div>

                  {currentQuestion.explanation && (
                    <button
                      type="button"
                      onClick={() => setExplanationModalOpen(true)}
                      className="text-[11px] font-bold px-2 py-0.5 rounded-lg border cursor-pointer hover:underline shrink-0"
                      style={{
                        borderColor: NPTEL_THEME.border,
                        color: NPTEL_THEME.primary,
                        background: NPTEL_THEME.bgSubtle,
                      }}
                    >
                      💡 View Explanation
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Card Docked Bottom Controls (shrink-0) */}
            <div className="shrink-0 pt-2.5 mt-auto border-t flex items-center justify-between gap-2" style={{ borderColor: "var(--border)" }}>
              {/* Previous & Clear */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-[var(--bg-secondary)]"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Prev</span>
                </button>

                {!isLocked && isAnswered && (
                  <button
                    type="button"
                    onClick={handleClearAnswer}
                    className="text-xs text-gray-400 hover:text-red-400 cursor-pointer px-2 py-1"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Right: Next */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={
                    currentIndex === totalQuestions - 1 &&
                    (!isMulti || checkedPractice[currentQuestion?.id] || !isAnswered)
                  }
                  onClick={handleNext}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer transition flex items-center gap-1.5 shadow-md hover:opacity-95 disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    background: NPTEL_THEME.gradient,
                    boxShadow: NPTEL_THEME.glow,
                  }}
                  title={
                    isMulti && isAnswered && !checkedPractice[currentQuestion?.id]
                      ? "Check answer"
                      : "Next Question"
                  }
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Complete 120-Question Palette (Desktop) */}
          <div className="hidden lg:flex lg:col-span-4 xl:col-span-3 flex-col h-full min-h-0 student-card rounded-2xl p-3 border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            {/* Palette Header */}
            <div className="shrink-0 flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Question Palette
              </h3>
              <span className="text-xs font-bold" style={{ color: NPTEL_THEME.primary }}>
                {answeredCount}/120
              </span>
            </div>

            {/* Filter Buttons */}
            <div className="shrink-0 grid grid-cols-4 gap-1 p-1 rounded-xl border text-[10px] font-bold mb-2" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
              <button
                type="button"
                onClick={() => setPaletteFilter("all")}
                className={`py-1 rounded cursor-pointer ${paletteFilter === "all" ? "bg-[#FF6B35] text-white" : "text-gray-400"}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setPaletteFilter("answered")}
                className={`py-1 rounded cursor-pointer ${paletteFilter === "answered" ? "bg-[#FF6B35] text-white" : "text-gray-400"}`}
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => setPaletteFilter("unanswered")}
                className={`py-1 rounded cursor-pointer ${paletteFilter === "unanswered" ? "bg-[#FF6B35] text-white" : "text-gray-400"}`}
              >
                Left
              </button>
              <button
                type="button"
                onClick={() => setPaletteFilter("flagged")}
                className={`py-1 rounded cursor-pointer ${paletteFilter === "flagged" ? "bg-[#FF6B35] text-white" : "text-gray-400"}`}
              >
                Flag
              </button>
            </div>

            {/* 120 Questions Number Grid */}
            <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-6 gap-1 pr-1">
              {filteredPaletteQuestions.map((q) => {
                const idx = q.questionNumber - 1;
                const isCur = idx === currentIndex;
                const isAns = answers[q.id] && (Array.isArray(answers[q.id]) ? answers[q.id].length > 0 : true);
                const isFlg = flagged.has(q.id);

                let bg = "var(--input-bg)";
                let textCol = "var(--text-muted)";
                let border = "var(--border)";

                if (isCur) {
                  border = NPTEL_THEME.primary;
                  textCol = NPTEL_THEME.primary;
                  bg = NPTEL_THEME.bgSubtle;
                } else if (isFlg) {
                  bg = "rgba(245, 158, 11, 0.2)";
                  textCol = "#F59E0B";
                  border = "#F59E0B";
                } else if (isAns) {
                  bg = NPTEL_THEME.primary;
                  textCol = "#FFFFFF";
                  border = NPTEL_THEME.primary;
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx);
                      setMobilePaletteOpen(false);
                    }}
                    className="h-7 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center justify-center relative hover:scale-105"
                    style={{ borderColor: border, background: bg, color: textCol }}
                  >
                    {q.questionNumber}
                    {isFlg && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute top-0.5 right-0.5" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="shrink-0 space-y-1 text-[10px] font-medium pt-2 mt-2 border-t" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded" style={{ background: NPTEL_THEME.primary }} />
                <span>Answered ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded bg-amber-500/20 border border-amber-500" />
                <span>Marked for Review ({flagged.size})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded border" style={{ borderColor: "var(--border)", background: "var(--input-bg)" }} />
                <span>Unvisited ({totalQuestions - answeredCount})</span>
              </div>
            </div>
          </div>
        </div>

      {/* ═══════════════════════════════════════════════
          MOBILE PALETTE DRAWER / MODAL
      ═══════════════════════════════════════════════ */}
      <AnimatePresence>
        {mobilePaletteOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm lg:hidden p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="student-card rounded-t-3xl sm:rounded-3xl p-4 w-full max-w-lg border max-h-[80vh] flex flex-col"
              style={{ background: "var(--bg-primary)", borderColor: NPTEL_THEME.border }}
            >
              <div className="flex items-center justify-between mb-3 pb-2 border-b" style={{ borderColor: "var(--border)" }}>
                <div>
                  <h3 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
                    Question Palette (120)
                  </h3>
                  <p className="text-[11px] text-gray-400">Jump directly to any question</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobilePaletteOpen(false)}
                  className="p-1.5 rounded-lg border cursor-pointer hover:bg-[var(--bg-secondary)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Filter */}
              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl border text-[11px] font-bold mb-3" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
                {["all", "answered", "unanswered", "flagged"].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setPaletteFilter(f)}
                    className={`py-1 rounded capitalize cursor-pointer ${paletteFilter === f ? "bg-[#FF6B35] text-white" : "text-gray-400"}`}
                  >
                    {f === "unanswered" ? "Left" : f}
                  </button>
                ))}
              </div>

              {/* Grid */}
              <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-6 sm:grid-cols-8 gap-1.5 p-1">
                {filteredPaletteQuestions.map((q) => {
                  const idx = q.questionNumber - 1;
                  const isCur = idx === currentIndex;
                  const isAns = answers[q.id] && (Array.isArray(answers[q.id]) ? answers[q.id].length > 0 : true);
                  const isFlg = flagged.has(q.id);

                  let bg = "var(--input-bg)";
                  let textCol = "var(--text-muted)";
                  let border = "var(--border)";

                  if (isCur) {
                    border = NPTEL_THEME.primary;
                    textCol = NPTEL_THEME.primary;
                    bg = NPTEL_THEME.bgSubtle;
                  } else if (isFlg) {
                    bg = "rgba(245, 158, 11, 0.2)";
                    textCol = "#F59E0B";
                    border = "#F59E0B";
                  } else if (isAns) {
                    bg = NPTEL_THEME.primary;
                    textCol = "#FFFFFF";
                    border = NPTEL_THEME.primary;
                  }

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(idx);
                        setMobilePaletteOpen(false);
                      }}
                      className="h-9 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center justify-center relative"
                      style={{ borderColor: border, background: bg, color: textCol }}
                    >
                      {q.questionNumber}
                      {isFlg && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute top-0.5 right-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 mt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                <span className="text-xs text-gray-400">Answered {answeredCount} of {totalQuestions}</span>
                <button
                  type="button"
                  onClick={() => setMobilePaletteOpen(false)}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold border cursor-pointer hover:bg-[var(--bg-secondary)]"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════
          READING PASSAGE MODAL
      ═══════════════════════════════════════════════ */}
      <AnimatePresence>
        {passageModalOpen && currentQuestion?.passage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="student-card rounded-3xl p-5 sm:p-6 max-w-2xl w-full border max-h-[85vh] flex flex-col"
              style={{ background: "var(--bg-primary)", borderColor: NPTEL_THEME.border }}
            >
              <div className="flex items-center justify-between mb-3 pb-2 border-b" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" style={{ color: NPTEL_THEME.primary }} />
                  <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                    Reading Passage: {currentQuestion.passageTitle || "Reference Text"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPassageModalOpen(false)}
                  className="p-1 rounded-lg border cursor-pointer hover:bg-[var(--bg-secondary)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div
                className="flex-1 min-h-0 overflow-y-auto text-xs sm:text-sm leading-relaxed whitespace-pre-line pr-2"
                style={{ color: "var(--text-secondary)" }}
              >
                {currentQuestion.passage}
              </div>

              <div className="mt-4 pt-3 border-t flex justify-end" style={{ borderColor: "var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setPassageModalOpen(false)}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer"
                  style={{ background: NPTEL_THEME.gradient }}
                >
                  Back to Question
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════
          EXPLANATION MODAL
      ═══════════════════════════════════════════════ */}
      <AnimatePresence>
        {explanationModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="student-card rounded-3xl p-5 sm:p-6 max-w-xl w-full border max-h-[85vh] flex flex-col"
              style={{ background: "var(--bg-primary)", borderColor: NPTEL_THEME.border }}
            >
              <div className="flex items-center justify-between mb-3 pb-2 border-b" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: NPTEL_THEME.primary }} />
                  <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                    Explanation &amp; Accepted Rationale
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setExplanationModalOpen(false)}
                  className="p-1 rounded-lg border cursor-pointer hover:bg-[var(--bg-secondary)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-3 text-xs sm:text-sm leading-relaxed pr-2">
                <div className="p-3 rounded-xl border bg-[var(--input-bg)]" style={{ borderColor: "var(--border)" }}>
                  <div className="text-[11px] font-bold text-gray-400 mb-1">
                    Question {currentQuestion.questionNumber}:
                  </div>
                  <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    {currentQuestion.questionText}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-gray-400">Accepted Answer(s):</span>
                  <span className="font-bold text-emerald-400">
                    {currentQuestion.correctAnswers.join(" | ")}
                  </span>
                </div>

                <div
                  className="p-3.5 rounded-xl border leading-relaxed text-xs sm:text-sm"
                  style={{
                    background: "rgba(255, 107, 53, 0.08)",
                    borderColor: NPTEL_THEME.border,
                    color: "var(--text-secondary)",
                  }}
                >
                  <span className="font-bold block mb-1" style={{ color: NPTEL_THEME.primary }}>
                    Detailed Concept Explanation:
                  </span>
                  {currentQuestion.explanation}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t flex justify-end" style={{ borderColor: "var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setExplanationModalOpen(false)}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer"
                  style={{ background: NPTEL_THEME.gradient }}
                >
                  Got It
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════
          CONFIRM SUBMISSION MODAL
      ═══════════════════════════════════════════════ */}
      <AnimatePresence>
        {confirmSubmitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="student-card rounded-3xl p-6 sm:p-8 max-w-md w-full border"
              style={{ background: "var(--bg-primary)", borderColor: NPTEL_THEME.border }}
            >
              <h3 className="text-xl font-black mb-2" style={{ color: "var(--text-primary)" }}>
                Submit NPTEL Assessment?
              </h3>
              <p className="text-xs leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
                If you exit or submit now, your test will be evaluated and submitted for your NPTEL assessment. You have answered{" "}
                <span className="font-bold" style={{ color: NPTEL_THEME.primary }}>{answeredCount}</span> out of{" "}
                <span className="font-bold">{totalQuestions}</span> questions.
                {flagged.size > 0 && (
                  <span>
                    {" "}You also have <span className="font-bold text-amber-400">{flagged.size}</span> questions marked for review.
                  </span>
                )}
              </p>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmSubmitModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer hover:bg-[var(--bg-secondary)]"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  Keep Working
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white cursor-pointer shadow-md hover:opacity-95"
                  style={{ background: NPTEL_THEME.gradient }}
                >
                  {submitting ? "Submitting..." : "Submit Assessment"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
