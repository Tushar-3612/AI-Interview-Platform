import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  GraduationCap,
  Clock,
  CheckCircle2,
  XCircle,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  FileText,
  AlertTriangle,
  RotateCcw,
  Send,
  Flag,
  BookOpen,
  Trophy,
  Check,
  X,
  Zap,
  Layers,
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
  isPartialStatus,
  getAnswerStatusLabel,
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
  // Restore draft answers if available (prevents accidental navigation / reload progress loss)
  const [answers, setAnswers] = useState(() => getLocalDraftAnswers());
  const [flagged, setFlagged] = useState(new Set());
  const [bookmarks, setBookmarks] = useState(() => getLocalBookmarks());
  const [checkedPractice, setCheckedPractice] = useState({});
  const [paletteFilter, setPaletteFilter] = useState("all"); // "all" | "answered" | "unanswered" | "flagged"
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const isSubmittingRef = useRef(false);
  const answersRef = useRef(answers);

  // Synchronize ref and save drafts whenever answers change in active phase
  useEffect(() => {
    answersRef.current = answers;
    if (phase === "active") {
      saveLocalDraftAnswers(answers);
    }
  }, [answers, phase]);

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

  // Timer: 120 minutes (7200 seconds) for practice assessment
  const initialDuration = (NPTEL_TEST_META.durationMinutes || 120) * 60;
  const [timeLeft, setTimeLeft] = useState(initialDuration);
  const timeLeftRef = useRef(timeLeft);
  const [timerRunning, setTimerRunning] = useState(true);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const solutionRef = useRef(null);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }
  }, [phase]);

  // Auto-advance to next question if answer is correct
  const [autoAdvanceOnCorrect, setAutoAdvanceOnCorrect] = useState(true);
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);
  const autoAdvanceTimerRef = useRef(null);

  // Clear timer when question changes or unmounts
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, [currentIndex]);

  // Result state
  const [resultData, setResultData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmitModal, setConfirmSubmitModal] = useState(false);
  const [confirmExitModal, setConfirmExitModal] = useState(false);

  const totalQuestions = questionsList.length;
  const currentQuestion = questionsList[currentIndex] || questionsList[0] || ALL_NPTEL_QUESTIONS[0];
  const isMulti = currentQuestion?.type === "multiple";
  const currentAnswer = useMemo(() => {
    return answers[currentQuestion?.id] || (isMulti ? [] : null);
  }, [answers, currentQuestion?.id, isMulti]);
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

  // Submit test and directly calculate results
  const handleSubmit = useCallback(async () => {
    if (isSubmittingRef.current || phase !== "active") return;
    isSubmittingRef.current = true;
    setSubmitting(true);
    setConfirmSubmitModal(false);

    // Clean up active timer interval upon submission
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerRunning(false);

    // Clean up auto-advance timer upon submission
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    setIsAutoAdvancing(false);

    clearLocalDraftAnswers();

    const currentAnswers = answersRef.current || {};
    const elapsedFromStart =
      startTimeRef.current && Number.isFinite(startTimeRef.current)
        ? Math.floor((Date.now() - startTimeRef.current) / 1000)
        : null;
    const currentRemainingTime = Number.isFinite(timeLeftRef.current) ? timeLeftRef.current : 0;
    const elapsedFromTimer = Math.max(0, initialDuration - currentRemainingTime);
    const rawTimeSpent =
      elapsedFromStart !== null && elapsedFromStart >= 0 && elapsedFromStart <= initialDuration + 3600
        ? elapsedFromStart
        : elapsedFromTimer;
    const timeSpent = Math.max(1, Math.min(initialDuration, Math.floor(rawTimeSpent)));

    // Try server evaluation first if logged in
    try {
      if (token) {
        const res = await api.post(
          "/api/nptel/submit",
          {
            answers: currentAnswers,
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
            answers: currentAnswers,
          });
          clearLocalDraftAnswers();
          setPhase("result");
          window.scrollTo({ top: 0, behavior: "smooth" });
          setSubmitting(false);
          isSubmittingRef.current = false;
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
    let unansweredCount = 0;

    const evaluated = questionsList.map((q) => {
      const userSel = currentAnswers[q.id];
      const evalRes = evaluateAnswer(q, userSel);

      totalScore += evalRes.pointsEarned;
      if (evalRes.isCorrect) {
        correctCount++;
      } else if (evalRes.isPartiallyCorrect) {
        partiallyCorrectCount++;
      } else if (evalRes.status === "unanswered") {
        unansweredCount++;
      } else {
        incorrectCount++;
      }

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
    const totalQuestionsCount = questionsList.length;
    const answeredCount = totalQuestionsCount - unansweredCount;
    const maxScore = questionsList.reduce((sum, q) => sum + (q.points || 1), 0);
    const percentage = maxScore > 0 ? Number(((totalScore / maxScore) * 100).toFixed(1)) : 0;

    const finalResult = {
      success: true,
      title: NPTEL_TEST_META.title,
      score: totalScore,
      maxScore,
      totalQuestions: totalQuestionsCount,
      percentage,
      correctCount,
      partiallyCorrectCount,
      incorrectCount,
      unansweredCount,
      answeredCount,
      timeSpentSeconds: timeSpent,
      results: evaluated,
    };

    saveLocalTestAttempt({
      score: totalScore,
      maxScore,
      answers: currentAnswers,
    });
    clearLocalDraftAnswers();

    setResultData(finalResult);
    setPhase("result");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setSubmitting(false);
    isSubmittingRef.current = false;
  }, [phase, token, mode, questionsList, initialDuration]);

  // If user closes tab or browser, save draft answers so progress is not lost
  useEffect(() => {
    const handleBeforeUnload = () => {
      const currentAnswers = answersRef.current || {};
      if (phase === "active" && Object.keys(currentAnswers).length > 0) {
        saveLocalDraftAnswers(currentAnswers);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [phase]);

  // Leave practice assessment without submitting: saves draft and navigates back to NPTEL home
  const handleConfirmExit = useCallback(() => {
    // 1. Clean up active timer interval
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerRunning(false);

    // 2. Clean up auto-advance interval
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    setIsAutoAdvancing(false);

    // 3. Save drafts so answers are preserved for resuming
    const currentAnswers = answersRef.current || answers;
    saveLocalDraftAnswers(currentAnswers);

    // 5. Dismiss modal and navigate away without submitting
    setConfirmExitModal(false);
    toast("Assessment paused. Your progress has been saved.", { icon: "💾" });
    navigate("/nptel-assignment");
  }, [answers, navigate]);

  // Active assessment countdown timer with ref-backed submit
  const handleSubmitRef = useRef(handleSubmit);
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  useEffect(() => {
    if (phase !== "active" || !timerRunning) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setTimerRunning(false);
          toast.error("Time is up! Submitting your assignment test.");
          handleSubmitRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [phase, timerRunning]);

  // Retake test: cleans up previous attempt timers and resets only attempt-specific state
  const handleRetakeTest = useCallback(() => {
    // 1. Clean up active timer and auto-advance intervals
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    setIsAutoAdvancing(false);

    // 2. Reset timer and fresh attempt timestamp
    const initialDuration = (NPTEL_TEST_META.durationMinutes || 120) * 60;
    setTimeLeft(initialDuration);
    setTimerRunning(true);
    startTimeRef.current = Date.now();

    // 3. Reset submission and guard flags
    isSubmittingRef.current = false;
    setSubmitting(false);
    setConfirmSubmitModal(false);

    // 4. Clear answers, flags, and temporary practice states
    setAnswers({});
    answersRef.current = {};
    setFlagged(new Set());
    setCheckedPractice({});
    clearLocalDraftAnswers();

    // 5. Reset navigation, filters, and result modals
    setCurrentIndex(0);
    setPaletteFilter("all");
    setMobilePaletteOpen(false);
    setShowReviewModal(false);
    setResultData(null);

    // 6. Transition to active phase
    setPhase("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const answeredCount = Object.keys(answers).filter((k) => {
    const val = answers[k];
    return Array.isArray(val) ? val.length > 0 : Boolean(val);
  }).length;

  const progressPercent = Math.round(((currentIndex + 1) / totalQuestions) * 100);

  // Palette filtered list
  const filteredPaletteQuestions = useMemo(() => {
    return questionsList.filter((q) => {
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
    const isPassing = Number(resultData.percentage || 0) >= 40;
    const totalQuestionsCount = Number(
      resultData.totalQuestions ||
      (Array.isArray(resultData.results) ? resultData.results.length : null) ||
      resultData.maxScore ||
      totalQuestions ||
      120
    );
    const unansweredCount =
      resultData.unansweredCount !== undefined
        ? Number(resultData.unansweredCount)
        : Math.max(
            0,
            totalQuestionsCount -
              (Number(resultData.correctCount || 0) +
                Number(resultData.partiallyCorrectCount || 0) +
                Number(resultData.incorrectCount || 0))
          );
    const answeredCount =
      resultData.answeredCount !== undefined
        ? Number(resultData.answeredCount)
        : Math.max(0, totalQuestionsCount - unansweredCount);

    return (
      <div className="w-full max-w-xl md:max-w-2xl mx-auto px-3 sm:px-4 py-2 sm:py-4 flex flex-col justify-start box-border">
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
          {/* Top Header Actions (Compact, single horizontal row) */}
          <div className="flex items-center justify-between gap-1.5 sm:gap-3 mb-2 sm:mb-3 w-full">
            {/* Back to Assignments */}
            <button
              type="button"
              id="nptel-result-back-btn"
              onClick={() => navigate("/nptel-assignment")}
              className="flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border text-[11px] sm:text-xs font-semibold cursor-pointer transition hover:bg-[var(--bg-secondary)] shrink-0 active:scale-95"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              title="Back to Assignments"
            >
              <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden sm:inline">Back to Assignments</span>
              <span className="sm:hidden">Back</span>
            </button>

            {/* Right Action Buttons: Leaderboard & Retake Test */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Leaderboard Button */}
              <button
                type="button"
                id="nptel-result-leaderboard-btn"
                onClick={() => navigate("/nptel-assignment/leaderboard")}
                className="flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border text-[11px] sm:text-xs font-bold cursor-pointer hover:opacity-85 transition active:scale-95 shrink-0"
                style={{
                  borderColor: "rgba(245, 158, 11, 0.35)",
                  background: "rgba(245, 158, 11, 0.08)",
                  color: "#F59E0B",
                }}
                title="View NPTEL Leaderboard"
              >
                <Trophy className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">View Leaderboard</span>
                <span className="sm:hidden">Leaderboard</span>
              </button>

              {/* Retake Test Button */}
              <button
                type="button"
                id="nptel-result-retake-btn"
                onClick={handleRetakeTest}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-black cursor-pointer hover:opacity-90 transition active:scale-95 shrink-0 text-white shadow-sm"
                style={{
                  background: NPTEL_THEME.gradient,
                  boxShadow: NPTEL_THEME.glow,
                }}
                title="Retake NPTEL Test"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Retake Test</span>
                <span className="sm:hidden">Retake</span>
              </button>
            </div>
          </div>

          {/* Redesigned Compact Result Card */}
          <div
            className="w-full rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 border relative overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in srgb, #FF6B35 10%, var(--card-bg)) 0%, var(--card-bg) 60%, color-mix(in srgb, #FF6B35 4%, var(--card-bg)) 100%)",
              borderColor: "color-mix(in srgb, #FF6B35 25%, var(--border))",
              boxShadow: "0 8px 24px -8px rgba(255, 107, 53, 0.12)",
            }}
          >
            {/* A. Header */}
            <div className="flex flex-col items-center text-center mb-1.5 sm:mb-2">
              <div
                className="inline-flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider mb-1 sm:mb-1.5 border"
                style={{
                  background: NPTEL_THEME.bgSubtle,
                  borderColor: NPTEL_THEME.border,
                  color: NPTEL_THEME.primary,
                }}
              >
                <Trophy className="w-3 h-3 shrink-0" />
                <span>COMPREHENSIVE ASSIGNMENT RESULT</span>
              </div>

              <h1
                className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight leading-tight mb-1"
                style={{ color: "var(--text-primary)" }}
              >
                NPTEL Assignment
              </h1>

              <p
                className="text-xs sm:text-sm leading-snug line-clamp-2 max-w-md mx-auto"
                style={{ color: "var(--text-secondary)" }}
              >
                {isPassing
                  ? "Congratulations! You passed."
                  : "You didn't reach the passing score. Review your answers and solutions."}
              </p>
            </div>

            {/* B. Score Summary */}
            <div
              className="w-full rounded-xl sm:rounded-2xl p-2.5 sm:p-4 my-2 sm:my-3 border text-center flex flex-col items-center justify-center relative overflow-hidden"
              style={{
                background: "var(--bg-secondary)",
                borderColor: "color-mix(in srgb, #FF6B35 25%, var(--border))",
                boxShadow: "0 4px 16px -4px rgba(255, 107, 53, 0.08)",
              }}
            >
              <div className="flex items-baseline justify-center gap-1">
                <span
                  className="text-3xl sm:text-4xl md:text-5xl font-black leading-none tracking-tight"
                  style={{ color: NPTEL_THEME.primary }}
                >
                  {resultData.score}
                </span>
                <span
                  className="text-sm sm:text-base font-bold"
                  style={{ color: "var(--text-muted)" }}
                >
                  / {resultData.maxScore}
                </span>
              </div>

              <div className="flex items-center justify-center gap-2 sm:gap-3 mt-1.5 flex-wrap">
                <span
                  className="text-[11px] sm:text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-full border"
                  style={{
                    background: isPassing ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                    borderColor: isPassing ? "rgba(16, 185, 129, 0.35)" : "rgba(239, 68, 68, 0.35)",
                    color: isPassing ? "#10B981" : "#EF4444",
                  }}
                >
                  {resultData.percentage}% Overall
                </span>
                <span className="text-[11px] sm:text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  Answered: {answeredCount}/{totalQuestionsCount}
                </span>
                <span className="text-[11px] sm:text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  Time: {formatTime(resultData.timeSpentSeconds)}
                </span>
              </div>
            </div>

            {/* C. Answer Statistics (4 compact cards in single row) */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5 w-full mt-2 sm:mt-2.5">
              {/* Correct */}
              <div
                className="flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-center transition-transform hover:scale-[1.02]"
                style={{
                  background: "var(--bg-secondary)",
                  borderColor: "rgba(16, 185, 129, 0.25)",
                }}
              >
                <span className="text-base sm:text-xl font-black leading-tight text-emerald-400">
                  {resultData.correctCount}
                </span>
                <span className="text-[10px] sm:text-xs font-semibold mt-0.5 truncate max-w-full px-0.5" style={{ color: "var(--text-secondary)" }}>
                  Correct
                </span>
              </div>

              {/* Partial */}
              <div
                className="flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-center transition-transform hover:scale-[1.02]"
                style={{
                  background: "var(--bg-secondary)",
                  borderColor: "rgba(245, 158, 11, 0.25)",
                }}
              >
                <span className="text-base sm:text-xl font-black leading-tight text-amber-400">
                  {resultData.partiallyCorrectCount || 0}
                </span>
                <span className="text-[10px] sm:text-xs font-semibold mt-0.5 truncate max-w-full px-0.5" style={{ color: "var(--text-secondary)" }} title="Partially Correct">
                  Partially Correct
                </span>
              </div>

              {/* Incorrect */}
              <div
                className="flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-center transition-transform hover:scale-[1.02]"
                style={{
                  background: "var(--bg-secondary)",
                  borderColor: "rgba(239, 68, 68, 0.25)",
                }}
              >
                <span className="text-base sm:text-xl font-black leading-tight text-rose-400">
                  {resultData.incorrectCount}
                </span>
                <span className="text-[10px] sm:text-xs font-semibold mt-0.5 truncate max-w-full px-0.5" style={{ color: "var(--text-secondary)" }}>
                  Incorrect
                </span>
              </div>

              {/* Unanswered */}
              <div
                className="flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-center transition-transform hover:scale-[1.02]"
                style={{
                  background: "var(--bg-secondary)",
                  borderColor: "rgba(255, 107, 53, 0.25)",
                }}
              >
                <span className="text-base sm:text-xl font-black leading-tight" style={{ color: NPTEL_THEME.primary }}>
                  {unansweredCount}
                </span>
                <span className="text-[10px] sm:text-xs font-semibold mt-0.5 truncate max-w-full px-0.5" style={{ color: "var(--text-secondary)" }}>
                  Unanswered
                </span>
              </div>
            </div>
          </div>

          {/* Optional Toggle to Review Solutions (Collapsed by default so page remains single-screen) */}
          {Array.isArray(resultData.results) && resultData.results.length > 0 && (
            <div className="mt-2.5 sm:mt-3 text-center">
              <button
                type="button"
                onClick={() => setShowReviewModal((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] sm:text-xs font-bold cursor-pointer transition hover:bg-[var(--bg-secondary)] active:scale-95"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg-secondary)",
                  color: "var(--text-secondary)",
                }}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{showReviewModal ? "Hide Question Solutions" : "Review Question Solutions"}</span>
              </button>

              {/* Collapsible Solution Review List */}
              {showReviewModal && (
                <div className="mt-3 text-left space-y-3">
                  {resultData.results.map((q, idx) => {
                    const isCorrect = q.status === "correct";
                    const isPartial = isPartialStatus(q.status);
                    const isUnanswered = q.status === "unanswered";

                    const borderColor = isCorrect
                      ? "rgba(16, 185, 129, 0.3)"
                      : isPartial
                      ? "rgba(245, 158, 11, 0.3)"
                      : isUnanswered
                      ? "rgba(156, 163, 175, 0.25)"
                      : "rgba(239, 68, 68, 0.3)";

                    const badgeClass = isCorrect
                      ? "text-emerald-400 bg-emerald-500/10"
                      : isPartial
                      ? "text-amber-400 bg-amber-500/10"
                      : isUnanswered
                      ? "text-gray-400 bg-gray-500/10"
                      : "text-rose-400 bg-rose-500/10";

                    const badgeLabel = getAnswerStatusLabel(q.status);

                    return (
                      <div
                        key={q.id || idx}
                        className="p-3 sm:p-4 rounded-xl border"
                        style={{
                          background: "var(--bg-secondary)",
                          borderColor,
                        }}
                      >
                        <div className="flex items-center justify-between mb-1.5 text-xs font-bold">
                          <span style={{ color: "var(--text-muted)" }}>
                            Question {q.questionNumber || idx + 1}
                          </span>
                          <span
                            className={`font-black text-[10px] px-2 py-0.5 rounded-full ${badgeClass}`}
                          >
                            {badgeLabel} ({q.pointsEarned || 0}/{q.maxPoints || 1} pts)
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                          {q.questionText}
                        </p>
                        {q.explanation && (
                          <p className="text-[11px] sm:text-xs leading-relaxed pt-2 border-t border-[var(--border)]" style={{ color: "var(--text-secondary)" }}>
                            <span className="font-bold text-[var(--text-primary)]">Explanation: </span>
                            {q.explanation}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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
    <div className="flex flex-col w-full max-w-[1600px] mx-auto px-2 sm:px-4 py-1.5 sm:py-2 min-h-[100dvh] box-border lg:h-screen lg:max-h-screen lg:overflow-hidden">
      {/* ═══════════════════════════════════════════════
          TOP RESPONSIVE HEADER BAR
      ═══════════════════════════════════════════════ */}
      <div className="shrink-0 mb-1.5 pb-1.5 sm:mb-2 sm:pb-2 border-b border-[var(--border)]">
        {/* Row 1: Back/Exit + Title (Left) and Palette + Submit + Auto-Next (Right) */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-2 min-w-0">
          {/* Left: Exit Button + Branding */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
            <button
              type="button"
              id="nptel-test-exit-btn"
              onClick={() => setConfirmExitModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition hover:bg-[var(--bg-secondary)] shrink-0 active:scale-95"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              title="Exit Assessment"
            >
              <ChevronLeft className="w-4 h-4 shrink-0" />
              <span>Exit</span>
            </button>

            <div
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 border"
              style={{
                background: NPTEL_THEME.bgSubtle,
                borderColor: NPTEL_THEME.border,
                color: NPTEL_THEME.primary,
              }}
            >
              <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <h1 className="text-xs sm:text-base font-black truncate leading-tight" style={{ color: "var(--text-primary)" }}>
                  {NPTEL_TEST_META.title}
                </h1>
                <span
                  className="hidden sm:inline-block text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0"
                  style={{
                    background: NPTEL_THEME.bgSubtle,
                    color: NPTEL_THEME.primary,
                    border: `1px solid ${NPTEL_THEME.border}`,
                  }}
                >
                  {totalQuestions} Questions
                </span>
              </div>
              <p className="hidden md:block text-[11px] truncate leading-tight mt-0.5" style={{ color: "var(--text-muted)" }}>
                {`Question ${currentIndex + 1} of ${totalQuestions} · ${currentQuestion?.sectionTitle}`}
              </p>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Auto-Next on Correct Toggle (Responsive) */}
            <button
              type="button"
              id="nptel-autonext-header-btn"
              onClick={() => {
                const nextState = !autoAdvanceOnCorrect;
                setAutoAdvanceOnCorrect(nextState);
                toast.success(
                  nextState
                    ? "Auto-Next enabled: advances automatically on correct answer"
                    : "Auto-Next disabled"
                );
              }}
              className="hidden sm:flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl border text-[11px] font-bold transition cursor-pointer active:scale-95 shrink-0"
              style={{
                borderColor: autoAdvanceOnCorrect ? NPTEL_THEME.border : "var(--border)",
                background: autoAdvanceOnCorrect ? NPTEL_THEME.bgSubtle : "var(--bg-secondary)",
                color: autoAdvanceOnCorrect ? NPTEL_THEME.primary : "var(--text-muted)",
              }}
              title={
                autoAdvanceOnCorrect
                  ? "Auto-Next is ON: Automatically advances to next question when answered correctly"
                  : "Auto-Next is OFF: Advance manually"
              }
            >
              <Zap className={`w-3.5 h-3.5 shrink-0 ${autoAdvanceOnCorrect ? "fill-[#FF6B35]" : ""}`} />
              <span className="hidden sm:inline">Auto-Next</span>
              <span className="sm:hidden">Auto</span>
              <span
                className="text-[10px] px-1 py-0.2 rounded font-black uppercase shrink-0"
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

            {/* Mobile / Tablet Palette Drawer Toggle with answered counter */}
            <button
              type="button"
              onClick={() => setMobilePaletteOpen((prev) => !prev)}
              className="lg:hidden flex items-center gap-1 px-2 py-1 rounded-xl border text-xs font-bold cursor-pointer hover:bg-[var(--bg-secondary)] active:scale-95"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              title="Question Palette"
            >
              <Layers className="w-3.5 h-3.5" style={{ color: NPTEL_THEME.primary }} />
              <span className="text-[11px] font-bold" style={{ color: NPTEL_THEME.primary }}>
                {answeredCount}/{totalQuestions}
              </span>
            </button>

            {/* Progress Count Badge on Desktop */}
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

            {/* Assessment Countdown Timer */}
            <div
              id="nptel-timer-display"
              className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl border text-xs font-bold shrink-0 transition-colors ${
                timeLeft < 300
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                  : timeLeft < 600
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  : "bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-secondary)]"
              }`}
              title="Time Remaining"
            >
              <Clock className="w-3.5 h-3.5 text-[#FF6B35] shrink-0" />
              <span className="tabular-nums font-mono text-[11px] sm:text-xs">
                {formatTime(timeLeft)}
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={() => setConfirmSubmitModal(true)}
              className="px-2.5 sm:px-3.5 py-1 rounded-xl text-xs font-bold text-white cursor-pointer transition shadow-md hover:opacity-95 active:scale-95 flex items-center gap-1 sm:gap-1.5 shrink-0"
              style={{
                background: NPTEL_THEME.gradient,
                boxShadow: NPTEL_THEME.glow,
              }}
              title="Submit Test"
            >
              <Send className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Submit</span>
            </button>
          </div>
        </div>

        {/* Mobile secondary toolbar row (< sm): Question info + Auto-Next toggle */}
        <div className="flex sm:hidden items-center justify-between gap-1.5 mt-1 pt-1 border-t border-[var(--border)]/40 text-[11px] min-w-0">
          <span className="truncate text-gray-400 font-medium min-w-0 flex-1">
            Q {currentIndex + 1}/{totalQuestions} · {currentQuestion?.sectionTitle}
          </span>
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
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold transition cursor-pointer shrink-0 active:scale-95"
            style={{
              borderColor: autoAdvanceOnCorrect ? NPTEL_THEME.border : "var(--border)",
              background: autoAdvanceOnCorrect ? NPTEL_THEME.bgSubtle : "var(--bg-secondary)",
              color: autoAdvanceOnCorrect ? NPTEL_THEME.primary : "var(--text-muted)",
            }}
          >
            <Zap className={`w-3 h-3 ${autoAdvanceOnCorrect ? "fill-[#FF6B35]" : ""}`} />
            <span>Auto-Next: {autoAdvanceOnCorrect ? "ON" : "OFF"}</span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="shrink-0 w-full h-1 sm:h-1.5 rounded-full overflow-hidden mb-1.5 sm:mb-2 bg-[var(--border)]">
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
          TEST WORKSPACE GRID
      ═══════════════════════════════════════════════ */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-3 lg:overflow-hidden">
          {/* Left Column: Active Question Workspace */}
          <div className="lg:col-span-8 xl:col-span-9 flex flex-col min-h-0 student-card rounded-xl sm:rounded-2xl border p-2.5 sm:p-4 relative box-border min-w-0 lg:h-full lg:overflow-hidden" style={{ borderColor: "var(--border)" }}>
            
            {/* Top Question Metadata Row (shrink-0) */}
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 pb-1.5 sm:pb-2 mb-1.5 sm:mb-2 border-b min-w-0" style={{ borderColor: "var(--border)" }}>
              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 min-w-0">
                <span
                  className="px-2 py-0.5 rounded-lg text-[11px] sm:text-xs font-black tracking-wide border shrink-0"
                  style={{
                    background: NPTEL_THEME.bgSubtle,
                    borderColor: NPTEL_THEME.border,
                    color: NPTEL_THEME.primary,
                  }}
                >
                  Question {currentQuestion.questionNumber} of {totalQuestions}
                </span>

                <span className="text-[10px] sm:text-[11px] font-semibold px-1.5 sm:px-2 py-0.5 rounded text-gray-400 border shrink-0" style={{ borderColor: "var(--border)" }}>
                  {currentQuestion.points || 1} Pt
                </span>

                <span
                  className="text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md border flex items-center gap-1 shrink-0"
                  style={{
                    background: NPTEL_THEME.bgSubtle,
                    borderColor: NPTEL_THEME.border,
                    color: NPTEL_THEME.primary,
                  }}
                >
                  <span>{isMulti ? "MSQ" : "MCQ"}</span>
                  <span className="hidden sm:inline">{isMulti ? "(Multi-Select)" : "(Single Choice)"}</span>
                </span>

                {isLocked && (
                  <span
                    className="text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md border flex items-center gap-1 shrink-0"
                    style={{
                      background: "rgba(245, 158, 11, 0.12)",
                      borderColor: "rgba(245, 158, 11, 0.35)",
                      color: "#F59E0B",
                    }}
                    title="Answer submitted and locked"
                  >
                    <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    <span>Locked</span>
                  </span>
                )}

                {hasPassage && (
                  <button
                    type="button"
                    onClick={() => setPassageModalOpen(true)}
                    className="text-[10px] sm:text-[11px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md border flex items-center gap-1 cursor-pointer transition hover:opacity-90 shrink-0"
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
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto sm:ml-0">
                <button
                  type="button"
                  onClick={() => handleToggleBookmark(currentQuestion.id)}
                  className="p-1 sm:p-1.5 rounded-lg border hover:bg-[var(--bg-secondary)] transition cursor-pointer active:scale-95"
                  style={{
                    borderColor: "var(--border)",
                    color: isBookmarked ? NPTEL_THEME.primary : "var(--text-muted)",
                  }}
                  title={isBookmarked ? "Remove Bookmark" : "Bookmark Question"}
                  aria-label="Bookmark Question"
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
                  className="text-[10px] sm:text-[11px] font-semibold flex items-center gap-1 cursor-pointer px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg border transition active:scale-95"
                  style={{
                    borderColor: isFlagged ? "#F59E0B" : "var(--border)",
                    color: isFlagged ? "#F59E0B" : "var(--text-muted)",
                    background: isFlagged ? "rgba(245, 158, 11, 0.12)" : "transparent",
                  }}
                  title="Flag for Review"
                  aria-label="Flag Question for Review"
                >
                  <Flag className="w-3 h-3" />
                  <span className="hidden xs:inline sm:inline">{isFlagged ? "Flagged" : "Review"}</span>
                </button>
              </div>
            </div>

            {/* Question Text & Prompt (shrink-0) */}
            <div className="shrink-0 mb-1.5 sm:mb-2 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5 sm:mb-1 truncate">
                Topic: {currentQuestion.sectionTitle}
              </div>

              <h2
                className="text-xs sm:text-sm md:text-base font-bold leading-snug break-words"
                style={{ color: "var(--text-primary)" }}
              >
                {currentQuestion.questionText}
              </h2>
            </div>

            {/* Options List */}
            {/* Reserves ample bottom padding on mobile so last option and feedback are never overlapped by docked panel */}
            <div className={`space-y-1.5 sm:space-y-2 py-1 pr-0.5 sm:pr-1 min-w-0 lg:flex-1 lg:min-h-0 lg:overflow-y-auto ${
              isCheckedInPractice ? "pb-44 sm:pb-48 lg:pb-1" : "pb-32 sm:pb-36 lg:pb-1"
            }`}>
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
                    className={`w-full p-2.5 sm:p-3 rounded-xl border text-left text-xs sm:text-sm font-medium transition flex items-start sm:items-center justify-between gap-2.5 group min-h-[44px] box-border min-w-0 ${
                      isLocked ? "cursor-default" : "cursor-pointer hover:border-[#FF6B35]/50 active:scale-[0.99]"
                    }`}
                    style={{
                      borderColor: optionBorder,
                      background: optionBg,
                      color: "var(--text-primary)",
                      boxShadow: isSelected ? "0 4px 15px -3px rgba(255, 107, 53, 0.2)" : "none",
                      opacity: isLocked && !isSelected && !currentQuestion.correctAnswers.includes(opt) ? 0.65 : 1,
                    }}
                  >
                    <div className="flex items-start sm:items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                      {isMulti ? (
                        /* Square Checkbox for MSQ */
                        <span
                          className="w-5 h-5 rounded-[5px] flex items-center justify-center shrink-0 border-2 transition-all shadow-sm mt-0.5 sm:mt-0"
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
                          className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 transition-all mt-0.5 sm:mt-0"
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
                        className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 border text-[11px] font-bold mt-0.5 sm:mt-0"
                        style={{
                          borderColor: "var(--border)",
                          background: "var(--bg-secondary)",
                          color: isSelected ? NPTEL_THEME.primary : "var(--text-muted)",
                        }}
                      >
                        {letter}
                      </span>

                      <span className="flex-1 min-w-0 break-words leading-relaxed">{opt}</span>
                    </div>

                    {isCheckedInPractice && (
                      <span className="shrink-0 text-xs font-bold self-start sm:self-center ml-1">
                        {currentQuestion.correctAnswers.includes(opt) ? (
                          <span className="text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/30">
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Correct
                          </span>
                        ) : isSelected ? (
                          <span className="text-red-400 flex items-center gap-1 bg-red-500/10 px-1.5 py-0.5 rounded-md border border-red-500/30">
                            <X className="w-3.5 h-3.5 stroke-[2.5]" /> Incorrect
                          </span>
                        ) : null}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ═══════════════════════════════════════════════
                DOCKED BOTTOM RESULT PANEL & NAVIGATION CONTROLS
                On mobile: positioned cleanly at viewport bottom (bottom-0) with safe-area padding
                On desktop: docked at the bottom of student-card
            ═══════════════════════════════════════════════ */}
            <div
              className="fixed lg:static bottom-0 lg:bottom-auto left-0 right-0 z-30 px-3 py-2 sm:px-4 sm:py-2.5 lg:p-0 lg:mt-auto border-t lg:border-t-0 shadow-lg lg:shadow-none shrink-0 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]"
              style={{
                background: "var(--bg-primary)",
                borderColor: "var(--border)",
              }}
            >
              <div className="w-full max-w-[1600px] mx-auto space-y-1.5 sm:space-y-2">
                {/* Auto-Advancing Notification */}
                <AnimatePresence>
                  {isAutoAdvancing && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="p-2 rounded-xl border flex items-center justify-between gap-2 text-xs font-bold"
                      style={{
                        background: "rgba(16, 185, 129, 0.12)",
                        borderColor: "rgba(16, 185, 129, 0.4)",
                        color: "#10B981",
                      }}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 stroke-[3] text-emerald-400" />
                        </span>
                        <span className="truncate">Correct! Advancing to next question...</span>
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
                    ref={solutionRef}
                    className="p-2 sm:p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 shadow-sm"
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
                    <div className="flex items-center gap-1.5 sm:gap-2 truncate min-w-0 flex-1">
                      {currentPracticeEval?.isCorrect ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-bold shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Correct (+1 Pt)
                        </span>
                      ) : currentPracticeEval?.isPartiallyCorrect ? (
                        <span className="text-amber-400 flex items-center gap-1 font-bold shrink-0">
                          <AlertTriangle className="w-3.5 h-3.5" /> Partially Correct (+{currentPracticeEval?.pointsEarned} Pt)
                        </span>
                      ) : (
                        <span className="text-red-400 flex items-center gap-1 font-bold shrink-0">
                          <XCircle className="w-3.5 h-3.5" /> Incorrect (0 Pt)
                        </span>
                      )}

                      <span className="hidden sm:inline text-gray-400">·</span>
                      <span className="text-[11px] text-gray-300 truncate min-w-0">
                        Accepted: <strong className="text-emerald-400">{currentQuestion.correctAnswers.join(" | ")}</strong>
                      </span>
                    </div>

                    {currentQuestion.explanation && (
                      <button
                        type="button"
                        onClick={() => setExplanationModalOpen(true)}
                        className="text-[11px] font-bold px-2 py-1 rounded-lg border cursor-pointer hover:underline shrink-0 flex items-center gap-1"
                        style={{
                          borderColor: NPTEL_THEME.border,
                          color: NPTEL_THEME.primary,
                          background: NPTEL_THEME.bgSubtle,
                        }}
                      >
                        <span>💡</span>
                        <span>View Explanation</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Card Docked Bottom Controls (Prev, Clear, Next) */}
                <div
                  className="flex items-center justify-between gap-2 pt-1 lg:pt-2.5 lg:border-t"
                  style={{ borderColor: "var(--border)" }}
                >
                  {/* Previous & Clear */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentIndex === 0}
                      onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-[var(--bg-secondary)] hover:bg-[var(--bg-secondary)]/80 active:scale-95"
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Prev</span>
                    </button>

                    {!isLocked && isAnswered && (
                      <button
                        type="button"
                        onClick={handleClearAnswer}
                        className="text-xs text-gray-400 hover:text-red-400 cursor-pointer px-2 py-1 transition"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Right: Next / Check */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={
                        currentIndex === totalQuestions - 1 &&
                        (!isMulti || checkedPractice[currentQuestion?.id] || !isAnswered)
                      }
                      onClick={handleNext}
                      className="px-4 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer transition flex items-center gap-1.5 shadow-md hover:opacity-95 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
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
                      <span>
                        {isMulti && isAnswered && !checkedPractice[currentQuestion?.id]
                          ? "Check Answer"
                          : "Next"}
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
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
                {answeredCount}/{totalQuestions}
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

            {/* Questions Number Grid */}
            <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-6 gap-1 pr-1">
              {filteredPaletteQuestions.map((q) => {
                const targetIndex = questionsList.findIndex(
                  (item) => (item.id || item.questionId) === (q.id || q.questionId)
                );
                const isCur = targetIndex === currentIndex;
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
                      if (targetIndex >= 0) {
                        setCurrentIndex(targetIndex);
                      }
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
                    Question Palette ({totalQuestions})
                  </h3>
                  <p className="text-[11px] text-gray-400">Jump directly to any question</p>
                </div>
                <div className="flex items-center gap-1.5">
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
                    className="flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition active:scale-95"
                    style={{
                      borderColor: autoAdvanceOnCorrect ? NPTEL_THEME.border : "var(--border)",
                      background: autoAdvanceOnCorrect ? NPTEL_THEME.bgSubtle : "var(--bg-secondary)",
                      color: autoAdvanceOnCorrect ? NPTEL_THEME.primary : "var(--text-muted)",
                    }}
                    title="Toggle Auto-Next"
                  >
                    <Zap className={`w-3 h-3 ${autoAdvanceOnCorrect ? "fill-[#FF6B35]" : ""}`} />
                    <span>Auto: {autoAdvanceOnCorrect ? "ON" : "OFF"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobilePaletteOpen(false)}
                    className="p-1.5 rounded-lg border cursor-pointer hover:bg-[var(--bg-secondary)]"
                    style={{ borderColor: "var(--border)" }}
                    aria-label="Close question palette"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
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
                  const targetIndex = questionsList.findIndex(
                    (item) => (item.id || item.questionId) === (q.id || q.questionId)
                  );
                  const isCur = targetIndex === currentIndex;
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
                        if (targetIndex >= 0) {
                          setCurrentIndex(targetIndex);
                        }
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
                  <BookOpen className="w-4 h-4" style={{ color: NPTEL_THEME.primary }} />
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
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmSubmitModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="student-card rounded-2xl sm:rounded-3xl p-5 sm:p-7 max-w-md w-full border shadow-2xl"
              style={{ background: "var(--bg-primary)", borderColor: NPTEL_THEME.border }}
            >
              <h3 className="text-lg sm:text-xl font-black mb-2" style={{ color: "var(--text-primary)" }}>
                Submit NPTEL Assessment?
              </h3>
              <p className="text-xs leading-relaxed mb-5 sm:mb-6" style={{ color: "var(--text-secondary)" }}>
                If you submit now, your test will be evaluated and submitted for your NPTEL assessment. You have answered{" "}
                <span className="font-bold" style={{ color: NPTEL_THEME.primary }}>{answeredCount}</span> out of{" "}
                <span className="font-bold">{totalQuestions}</span> questions.
                {flagged.size > 0 && (
                  <span>
                    {" "}You also have <span className="font-bold text-amber-400">{flagged.size}</span> questions marked for review.
                  </span>
                )}
              </p>

              <div className="flex items-center justify-end gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmSubmitModal(false)}
                  className="px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer hover:bg-[var(--bg-secondary)]"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  Keep Working
                </button>
                <button
                  type="button"
                  id="nptel-confirm-submit-btn"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-4 sm:px-5 py-2 rounded-xl text-xs font-bold text-white cursor-pointer shadow-md hover:opacity-95"
                  style={{ background: NPTEL_THEME.gradient }}
                >
                  {submitting ? "Submitting..." : "Submit Assessment"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════
          CONFIRM EXIT MODAL (Leave without submitting)
      ═══════════════════════════════════════════════ */}
      <AnimatePresence>
        {confirmExitModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmExitModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="student-card rounded-2xl sm:rounded-3xl p-5 sm:p-7 max-w-md w-full border shadow-2xl"
              style={{ background: "var(--bg-primary)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2.5 sm:gap-3 mb-2.5 sm:mb-3">
                <div
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    borderColor: "rgba(239, 68, 68, 0.3)",
                    color: "#EF4444",
                  }}
                >
                  <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black" style={{ color: "var(--text-primary)" }}>
                    Exit Assessment?
                  </h3>
                  <p className="text-[11px] sm:text-xs text-gray-400">
                    Leave without submitting
                  </p>
                </div>
              </div>

              <p className="text-xs leading-relaxed mb-5 sm:mb-6" style={{ color: "var(--text-secondary)" }}>
                You have answered{" "}
                <span className="font-bold" style={{ color: NPTEL_THEME.primary }}>{answeredCount}</span> out of{" "}
                <span className="font-bold">{totalQuestions}</span> questions.
                {" "}Your current answers will be saved as drafts so you can resume practice later. The assessment will <strong>not</strong> be submitted.
              </p>

              <div className="flex items-center justify-end gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmExitModal(false)}
                  className="px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer hover:bg-[var(--bg-secondary)]"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  Stay &amp; Continue
                </button>
                <button
                  type="button"
                  id="nptel-confirm-exit-btn"
                  onClick={handleConfirmExit}
                  className="px-4 sm:px-5 py-2 rounded-xl text-xs font-bold text-white cursor-pointer shadow-md hover:opacity-95"
                  style={{ background: "#EF4444" }}
                >
                  Exit Assessment
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
