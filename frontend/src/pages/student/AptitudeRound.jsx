import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { ArrowLeft, Clock, ChevronLeft, CheckCircle, XCircle, HelpCircle, BarChart3, Timer, BrainCircuit, Bookmark, BookmarkCheck, Percent, History } from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import Button from "../../components/ui/Button";
import { SkeletonAptitudeQuiz, ErrorState } from "../../components/ui/Skeleton";
import { formatTime } from "../../utils/dateUtils";

const DIFFICULTIES = [
  { id: "easy", label: "Easy", color: "#22c55e", desc: "Basic concepts and direct formulas" },
  { id: "medium", label: "Medium", color: "#eab308", desc: "Standard problems with moderate steps" },
  { id: "hard", label: "Hard", color: "#ef4444", desc: "Challenging multi-step reasoning" },
];
const DIFFICULTY_LABELS = { easy: "Easy", medium: "Medium", hard: "Hard" };
const DIFFICULTY_COLORS = { easy: "#22c55e", medium: "#eab308", hard: "#ef4444" };
const COUNT_OPTIONS = [15, 20, 30];
const AUTO_ADVANCE_DELAY_MS = 450;
const DISTRIBUTIONS = {
  15: { easy: 5, medium: 5, hard: 5 },
  20: { easy: 7, medium: 7, hard: 6 },
  30: { easy: 10, medium: 10, hard: 10 },
};

function AptitudeRound() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const token = getAuthToken();
  const headers = { Authorization: `Bearer ${token}` };
  const timerRef = useRef(null);
  const advanceTimerRef = useRef(null);
  const questionCardRef = useRef(null);

  const [phase, setPhase] = useState("config");
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [bookmarked, setBookmarked] = useState(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [totalCount, setTotalCount] = useState(15);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [company, setCompany] = useState(null);

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const res = await api.get("/api/practice/home", { headers });
        const found = (res.data?.companies || []).find((c) => c.id === companyId || c._id === companyId);
        setCompany(found);
      } catch {
        setCompany(null);
      }
    };
    fetchCompany();
  }, [companyId]);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/practice/aptitude/paper", {
        headers,
        params: { count: totalCount, companyId: companyId || "" },
      });
      if (!res.data.questions || res.data.questions.length === 0) {
        toast.error("No questions available for this selection. Try again later.");
        setLoading(false);
        return;
      }
      setQuestions(res.data.questions);
      setTimeLeft(totalCount * 60);
      setPhase("quiz");
      setStartTime(Date.now());
      setCurrentIndex(0);
      setAnswers({});
    } catch (err) {
      setError(err.response?.status || "network_failure");
      toast.error("Failed to load questions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (phase !== "quiz" || timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          toast.error("Time's up! Submitting automatically.");
          handleSubmit("auto");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, timeLeft]);

  const cancelAutoAdvance = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  const goToQuestion = useCallback(
    (index) => {
      cancelAutoAdvance();
      if (index < 0 || index >= questions.length || index === currentIndex) return;
      setCurrentIndex(index);
    },
    [cancelAutoAdvance, currentIndex, questions.length]
  );

  useEffect(() => {
    cancelAutoAdvance();
    return () => cancelAutoAdvance();
  }, [currentIndex, cancelAutoAdvance]);

  useEffect(() => () => cancelAutoAdvance(), [cancelAutoAdvance]);

  // Smooth-scroll the question card into view whenever the question changes.
  useEffect(() => {
    if (phase !== "quiz") return;
    requestAnimationFrame(() => {
      questionCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [currentIndex, phase]);

  const handleSelectOption = (qId, option) => {
    setAnswers((prev) => ({ ...prev, [qId]: option }));
    const isCurrentQuestion = qId === currentQuestion?.questionId;
    if (!isCurrentQuestion) return;
    if (currentIndex < questions.length - 1) {
      cancelAutoAdvance();
      advanceTimerRef.current = setTimeout(() => {
        setCurrentIndex((prev) => Math.min(prev + 1, questions.length - 1));
      }, AUTO_ADVANCE_DELAY_MS);
    }
  };

  const toggleBookmark = async (qId) => {
    const next = new Set(bookmarked);
    if (next.has(qId)) next.delete(qId);
    else next.add(qId);
    setBookmarked(next);
    try {
      await api.post("/api/practice/bookmark", { questionId: qId }, { headers });
    } catch {
      toast.error("Could not sync bookmark");
    }
  };

  const handleSubmit = async (mode = "manual") => {
    if (mode === "manual" && !window.confirm("Submit your answers?")) return;
    setSubmitting(true);
    try {
      const res = await api.post(
        "/api/practice/aptitude/submit",
        {
          companyId: companyId || "",
          companyName: company?.name || "",
          answers,
          timeTaken: startTime ? Math.floor((Date.now() - startTime) / 1000) : 0,
          questions,
          difficulty: "mixed",
        },
        { headers }
      );
      setResult(res.data);
      setPhase("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      toast.error("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const answeredCount = Object.keys(answers).length;

  if (loading) {
    return <SkeletonAptitudeQuiz />;
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <ErrorState
          statusCode={error}
          message="Failed to load or generate questions for this assessment."
          onRetry={handleStart}
          onGoBack={() => navigate(`/interview-practice/${companyId}`)}
        />
      </div>
    );
  }

  if (phase === "config") {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <button
          type="button"
          onClick={() => navigate(`/interview-practice/${companyId}`)}
          className="flex items-center gap-2 text-sm font-medium mb-8 cursor-pointer hover:opacity-80"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Rounds
        </button>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="student-card p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(99,102,241,0.12)" }}>
              <BrainCircuit className="w-7 h-7" style={{ color: "#6366f1" }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Aptitude Practice</h1>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {company ? `${company.name} · ` : ""}Configure your practice session
              </p>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl mb-6 text-sm" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
              Failed to reach the server. Check your connection and try again.
            </div>
          )}

          <div className="mb-6">
            <label className="text-sm font-semibold mb-2 block" style={{ color: "var(--text-primary)" }}>Number of Questions</label>
            <div className="flex gap-3">
              {COUNT_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setTotalCount(c)}
                  className={`flex-1 py-3 rounded-xl border text-sm font-semibold cursor-pointer transition ${
                    totalCount === c ? "border-[var(--primary)]" : ""
                  }`}
                  style={{
                    background: totalCount === c ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "var(--input-bg)",
                    borderColor: totalCount === c ? "var(--primary)" : "var(--border)",
                    color: "var(--text-primary)",
                  }}
                >
                  {c} Questions
                </button>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <label className="text-sm font-semibold mb-2 block" style={{ color: "var(--text-primary)" }}>Difficulty Distribution</label>
            <div className="grid grid-cols-3 gap-4">
              {DIFFICULTIES.map((d) => {
                const count = DISTRIBUTIONS[totalCount]?.[d.id] || 0;
                return (
                  <div
                    key={d.id}
                    className={`p-4 rounded-xl border text-center`}
                    style={{
                      background: "var(--input-bg)",
                      borderColor: d.color,
                    }}
                  >
                    <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ background: d.color }} />
                    <p className="text-sm font-bold" style={{ color: d.color }}>{count} {d.label}</p>
                    <p className="text-[11px] mt-1 leading-snug" style={{ color: "var(--text-muted)" }}>{d.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-xl mb-8" style={{ background: "var(--input-bg)" }}>
            <Timer className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Time Limit: {formatTime(totalCount * 60)}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                1 minute per question · auto-submitted when time expires · every attempt generates a fresh random paper
              </p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              <SkeletonButton className="w-full" />
              <Skeleton className="h-3 w-1/2 mx-auto rounded" />
            </div>
          ) : (
            <Button onClick={handleStart} disabled={loading || submitting} className="w-full py-3 text-sm font-semibold">
              {loading ? "Generating Paper..." : "Start Aptitude Test"}
            </Button>
          )}
        </motion.div>
      </div>
    );
  }

  if (phase === "result" && result) {
    const percentage = result.percentage || 0;
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: percentage >= 60 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)" }}
            >
              {percentage >= 60 ? (
                <CheckCircle className="w-10 h-10 text-green-500" />
              ) : (
                <XCircle className="w-10 h-10 text-red-500" />
              )}
            </div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Test Complete!</h1>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {company ? `${company.name} aptitude practice` : "Aptitude practice"} · Mixed Difficulty · {result.total} questions
              </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
            {[
              { label: "Score", value: `${result.score}/${result.total}`, color: "#6366f1", icon: BarChart3 },
              { label: "Percentage", value: `${percentage}%`, color: "#8b5cf6", icon: Percent },
              { label: "Correct", value: result.correct, color: "#22c55e", icon: CheckCircle },
              { label: "Wrong", value: result.wrong, color: "#ef4444", icon: XCircle },
              { label: "Skipped", value: result.skipped, color: "#eab308", icon: HelpCircle },
            ].map((item) => {
              const ItemIcon = item.icon;
              return (
                <div key={item.label} className="student-card p-4 text-center">
                  <ItemIcon className="w-5 h-5 mx-auto mb-1" style={{ color: item.color }} />
                  <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{item.value}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{item.label}</p>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-2 p-4 rounded-xl mb-8" style={{ background: "var(--input-bg)" }}>
            <Clock className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>
              Time Taken: {formatTime(result.timeTaken)}
            </span>
            <button
              type="button"
              onClick={() => navigate("/practice/aptitude/history")}
              className="ml-4 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer hover:opacity-80"
              style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}
            >
              <History className="w-3.5 h-3.5" /> All Attempts
            </button>
          </div>

          <div className="space-y-4 mb-8">
            {result.details.map((q, idx) => {
              const isCorrect = q.isCorrect;
              const isSkipped = !q.userAnswer;
              return (
                <div key={q.questionId || idx} className="student-card p-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {isCorrect ? (
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                      ) : isSkipped ? (
                        <HelpCircle className="w-5 h-5 text-yellow-500 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>
                          Q{idx + 1}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: `${DIFFICULTY_COLORS[q.difficulty]}15`, color: DIFFICULTY_COLORS[q.difficulty] }}>
                          {DIFFICULTY_LABELS[q.difficulty]}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(139,92,246,0.1)", color: "#8b5cf6" }}>
                          {q.category}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(234,179,8,0.1)", color: "#eab308" }}>
                          {q.marks} mark{q.marks > 1 ? "s" : ""}
                        </span>
                      </div>
                      <p className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>{q.question}</p>
                      <div className="space-y-1.5 mb-3">
                        {q.options.map((opt, optIdx) => {
                          const isUserAnswer = q.userAnswer === opt;
                          const isRightAnswer = q.correctAnswer === opt;
                          let bgStyle = "transparent", borderStyle = "var(--border)", textStyle = "var(--text-secondary)";
                          if (isRightAnswer) { bgStyle = "rgba(34,197,94,0.08)"; borderStyle = "#22c55e"; textStyle = "#22c55e"; }
                          else if (isUserAnswer && !isRightAnswer) { bgStyle = "rgba(239,68,68,0.08)"; borderStyle = "#ef4444"; textStyle = "#ef4444"; }
                          return (
                            <div key={optIdx} className="px-3 py-2 rounded-lg border text-xs" style={{ borderColor: borderStyle, background: bgStyle, color: textStyle }}>
                              {opt}
                              {isRightAnswer && <span className="ml-2 font-semibold">(Correct Answer)</span>}
                              {isUserAnswer && !isRightAnswer && <span className="ml-2 font-semibold">(Your Answer)</span>}
                            </div>
                          );
                        })}
                      </div>
                      {q.explanation && (
                        <div className="p-3 rounded-lg text-xs" style={{ background: "var(--input-bg)", color: "var(--text-secondary)" }}>
                          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Explanation: </span>
                          {q.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-3">
            <Button onClick={() => navigate(`/interview-practice/${companyId}`)} className="px-8 py-2.5 text-sm">
              Back to Rounds
            </Button>
            <Button onClick={() => setPhase("config")} className="px-8 py-2.5 text-sm" variant="secondary">
              Practice Again
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (questions.length === 0) return null;

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const isBookmarked = bookmarked.has(currentQuestion.questionId);
  const isLastQuestion = currentIndex === questions.length - 1;
  const currentAnswer = answers[currentQuestion.questionId];

  const navigatorProps = { questions, answers, currentIndex, onSelect: goToQuestion };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="flex items-center justify-between gap-4 mb-6">
        <button
          type="button"
          onClick={() => navigate(`/interview-practice/${companyId}`)}
          className="flex items-center gap-2 text-sm font-medium cursor-pointer hover:opacity-80"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Exit
        </button>

        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold"
          style={{ borderColor: timeLeft < 300 ? "#ef4444" : "var(--border)", color: timeLeft < 300 ? "#ef4444" : "var(--text-primary)" }}
        >
          <Clock className="w-4 h-4" />
          <span>{formatTime(timeLeft)}</span>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          <span>Answered: {answeredCount} / {questions.length}</span>
          <span>{currentIndex + 1} of {questions.length}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: "#6366f1" }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.2 }}
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="order-first lg:order-last lg:w-64 shrink-0">
          <div className="student-card p-4 lg:sticky lg:top-24">
            <QuestionNavigator {...navigatorProps} />
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
              <Button onClick={() => handleSubmit("manual")} disabled={submitting} className="w-full py-2 text-xs">
                {submitting ? "Submitting..." : "Submit Test"}
              </Button>
            </div>
          </div>
        </aside>

        <div className="order-last lg:order-first flex-1 min-w-0">
          <div className="lg:hidden mb-4">
            <div className="student-card p-4">
              <QuestionNavigator {...navigatorProps} horizontal />
            </div>
          </div>

          <motion.div
            key={currentIndex}
            ref={questionCardRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="student-card p-6 sm:p-8 aptitude-question-anchor"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: `${DIFFICULTY_COLORS[currentQuestion.difficulty]}15`, color: DIFFICULTY_COLORS[currentQuestion.difficulty] }}>
                  {DIFFICULTY_LABELS[currentQuestion.difficulty]}
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>
                  {currentQuestion.category}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: "rgba(234,179,8,0.1)", color: "#eab308" }}>
                  {currentQuestion.marks || 1} mark
                </span>
              </div>
              <button
                type="button"
                onClick={() => toggleBookmark(currentQuestion.questionId)}
                className="p-1.5 rounded-lg cursor-pointer hover:opacity-80 transition"
                aria-label="Bookmark question"
              >
                {isBookmarked ? (
                  <BookmarkCheck className="w-4 h-4" style={{ color: "#6366f1" }} />
                ) : (
                  <Bookmark className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                )}
              </button>
            </div>

            <h2 className="text-base sm:text-lg font-semibold mb-6 leading-relaxed" style={{ color: "var(--text-primary)" }}>
              {currentQuestion.question}
            </h2>

            <div className="space-y-3 mb-4">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = answers[currentQuestion.questionId] === option;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectOption(currentQuestion.questionId, option)}
                    className="w-full p-4 rounded-xl border text-left text-sm transition-all flex items-center justify-between cursor-pointer"
                    style={{
                      borderColor: isSelected ? "#6366f1" : "var(--border)",
                      background: isSelected ? "rgba(99,102,241,0.08)" : "var(--input-bg)",
                      color: isSelected ? "#6366f1" : "var(--text-primary)",
                    }}
                  >
                    <span>{option}</span>
                    {isSelected && <div className="w-2 h-2 rounded-full" style={{ background: "#6366f1" }} />}
                  </button>
                );
              })}
            </div>

            {currentAnswer && !isLastQuestion && (
              <p className="text-[11px] mb-4 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                <CheckCircle className="w-3.5 h-3.5" style={{ color: "#22c55e" }} />
                Answer saved — moving to the next question automatically.
              </p>
            )}
            {isLastQuestion && (
              <p className="text-[11px] mb-4" style={{ color: "var(--text-muted)" }}>
                Last question — review your answers in the navigator, then submit.
              </p>
            )}

            <div className="flex items-center justify-between gap-4 pt-6 border-t" style={{ borderColor: "var(--border)" }}>
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => goToQuestion(currentIndex - 1)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer hover:opacity-80 transition disabled:opacity-40"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              {isLastQuestion ? (
                <Button onClick={() => handleSubmit("manual")} disabled={submitting} className="px-5 py-2 text-xs">
                  {submitting ? "Submitting..." : "Submit Test"}
                </Button>
              ) : (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Answer auto-saved · moves to the next question automatically
                </span>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function QuestionNavigator({ questions, answers, currentIndex, onSelect, horizontal = false }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Question Navigator</p>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {Object.keys(answers).length}/{questions.length} answered
        </span>
      </div>
      <div
        className={horizontal ? "flex gap-2 overflow-x-auto pb-1" : "grid grid-cols-5 gap-2"}
        style={{ scrollbarWidth: "thin" }}
      >
        {questions.map((q, idx) => {
          const isAnswered = answers[q.questionId] != null;
          const isCurrent = idx === currentIndex;
          return (
            <button
              key={q.questionId || idx}
              type="button"
              onClick={() => onSelect(idx)}
              aria-label={`Go to question ${idx + 1}`}
              className="aspect-square rounded-lg text-xs font-semibold flex items-center justify-center cursor-pointer transition hover:opacity-80 shrink-0"
              style={
                isCurrent
                  ? { background: "#6366f1", color: "#ffffff", border: "1px solid #6366f1" }
                  : isAnswered
                    ? { background: "rgba(99,102,241,0.15)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.35)" }
                    : { background: "var(--input-bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }
              }
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default AptitudeRound;
