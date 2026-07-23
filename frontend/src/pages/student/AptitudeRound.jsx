import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { ArrowLeft, Clock, ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import aptitudeQuestionsList from "../../data/aptitude.json";
import Button from "../../components/ui/Button";

function AptitudeRound() {
  const { companyId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes (1800 seconds)
  const [isSubmitted, setIsSubmitted] = useState(false);

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

    // Load or generate questions
    if (currentSession.rounds.aptitude.questions && currentSession.rounds.aptitude.questions.length === 30) {
      setQuestions(currentSession.rounds.aptitude.questions);
      setAnswers(currentSession.rounds.aptitude.answers || {});
      if (currentSession.rounds.aptitude.timeLeft !== undefined) {
        setTimeLeft(currentSession.rounds.aptitude.timeLeft);
      }
      if (currentSession.rounds.aptitude.completed) {
        setIsSubmitted(true);
      }
    } else {
      // Sample 10 Quantitative, 10 Logical, 10 Verbal questions
      const quants = aptitudeQuestionsList.filter((q) => q.category === "Quantitative");
      const logicals = aptitudeQuestionsList.filter((q) => q.category === "Logical");
      const verbals = aptitudeQuestionsList.filter((q) => q.category === "Verbal");

      const getRandomSample = (arr, num) => {
        const shuffled = [...arr].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, num);
      };

      const sampledQuestions = [
        ...getRandomSample(quants, 10),
        ...getRandomSample(logicals, 10),
        ...getRandomSample(verbals, 10)
      ].sort(() => 0.5 - Math.random()); // mix them up

      setQuestions(sampledQuestions);
      currentSession.rounds.aptitude.questions = sampledQuestions;
      currentSession.rounds.aptitude.answers = {};
      currentSession.rounds.aptitude.timeLeft = 1800;
      localStorage.setItem(sessionKey, JSON.stringify(currentSession));
    }
  }, [companyId]);

  // Timer loop
  useEffect(() => {
    if (isSubmitted || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const nextTime = prev - 1;
        if (nextTime <= 0) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        // Periodically save remaining time to prevent reset on refresh
        if (nextTime % 5 === 0 && session) {
          const sessionKey = `practice-session-${companyId}`;
          const updated = { ...session };
          updated.rounds.aptitude.timeLeft = nextTime;
          updated.rounds.aptitude.answers = answers;
          localStorage.setItem(sessionKey, JSON.stringify(updated));
        }
        return nextTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isSubmitted, session, answers, companyId]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSelectOption = (questionId, option) => {
    if (isSubmitted) return;
    const nextAnswers = { ...answers, [questionId]: option };
    setAnswers(nextAnswers);

    // Save answer state locally
    if (session) {
      const sessionKey = `practice-session-${companyId}`;
      const updated = { ...session };
      updated.rounds.aptitude.answers = nextAnswers;
      localStorage.setItem(sessionKey, JSON.stringify(updated));
    }
  };

  const calculateScore = () => {
    let score = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.answer) {
        score++;
      }
    });
    return score;
  };

  const submitTest = (finalAnswers = answers) => {
    const score = Object.keys(questions).reduce((acc, idx) => {
      const q = questions[idx];
      return finalAnswers[q.id] === q.answer ? acc + 1 : acc;
    }, 0);

    const sessionKey = `practice-session-${companyId}`;
    const updated = { ...session };
    updated.rounds.aptitude.completed = true;
    updated.rounds.aptitude.score = score;
    updated.rounds.aptitude.answers = finalAnswers;
    updated.rounds.aptitude.timeLeft = timeLeft;

    localStorage.setItem(sessionKey, JSON.stringify(updated));
    setSession(updated);
    setIsSubmitted(true);

    toast.success(`Aptitude test completed! Score: ${score}/30`);
  };

  const handleAutoSubmit = () => {
    toast.error("Time's up! Submitting your test automatically.");
    submitTest();
  };

  const handleSubmitClick = () => {
    const answeredCount = Object.keys(answers).length;
    const unansweredCount = questions.length - answeredCount;

    let confirmMsg = "Are you sure you want to submit the Aptitude Test?";
    if (unansweredCount > 0) {
      confirmMsg = `You have ${unansweredCount} unanswered questions. ${confirmMsg}`;
    }

    if (window.confirm(confirmMsg)) {
      submitTest();
    }
  };

  if (!session || questions.length === 0) return null;

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <button
          type="button"
          onClick={() => navigate(`/interview-practice/${companyId}`)}
          className="flex items-center gap-2 text-sm font-medium cursor-pointer hover:opacity-80"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Rounds
        </button>

        {!isSubmitted && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold" style={{ borderColor: timeLeft < 300 ? "var(--error)" : "var(--border)", color: timeLeft < 300 ? "var(--error)" : "var(--text-primary)" }}>
            <Clock className="w-4 h-4 animate-pulse" />
            <span>Time Left: {formatTime(timeLeft)}</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          <span>Questions Answered: {answeredCount} / {questions.length}</span>
          <span>Question {currentIndex + 1} of {questions.length}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: "var(--primary)" }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.2 }}
          />
        </div>
      </div>

      {/* Question Card */}
      <motion.div
        key={currentIndex}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="student-card p-6 sm:p-8 mb-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>
            {currentQuestion.category}
          </span>
        </div>

        <h2 className="text-base sm:text-lg font-semibold mb-6 leading-relaxed" style={{ color: "var(--text-primary)" }}>
          {currentQuestion.question}
        </h2>

        {/* Options */}
        <div className="space-y-3 mb-6">
          {currentQuestion.options.map((option, idx) => {
            const isSelected = answers[currentQuestion.id] === option;
            const isCorrect = currentQuestion.answer === option;
            const wasSelectedAndIncorrect = isSelected && !isCorrect;

            let borderStyle = "var(--border)";
            let bgStyle = "var(--input-bg)";
            let textColor = "var(--text-primary)";

            if (isSubmitted) {
              if (isCorrect) {
                borderStyle = "var(--success)";
                bgStyle = "color-mix(in srgb, var(--success) 8%, transparent)";
                textColor = "var(--success)";
              } else if (wasSelectedAndIncorrect) {
                borderStyle = "var(--error)";
                bgStyle = "color-mix(in srgb, var(--error) 8%, transparent)";
                textColor = "var(--error)";
              }
            } else if (isSelected) {
              borderStyle = "var(--primary)";
              bgStyle = "color-mix(in srgb, var(--primary) 8%, transparent)";
              textColor = "var(--primary)";
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={isSubmitted}
                onClick={() => handleSelectOption(currentQuestion.id, option)}
                className="w-full p-4 rounded-xl border text-left text-sm transition-all flex items-center justify-between cursor-pointer"
                style={{ borderColor: borderStyle, background: bgStyle, color: textColor }}
              >
                <span>{option}</span>
                {!isSubmitted && isSelected && (
                  <div className="w-2 h-2 rounded-full" style={{ background: "var(--primary)" }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Feedback / Explanations when submitted */}
        {isSubmitted && (
          <div className="p-4 rounded-xl border mb-6 text-sm" style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}>
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Explanation:</p>
            <p className="mt-1" style={{ color: "var(--text-secondary)" }}>{currentQuestion.explanation}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4 pt-6 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((prev) => prev - 1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer hover:bg-neutral-800 transition disabled:opacity-40"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          {currentIndex < questions.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => prev + 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer hover:bg-neutral-800 transition"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            !isSubmitted && (
              <Button onClick={handleSubmitClick} className="px-5 py-2 text-xs">
                Submit Test
              </Button>
            )
          )}
        </div>
      </motion.div>

      {isSubmitted && (
        <div className="student-card p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div>
              <h3 className="font-semibold text-sm sm:text-base">Round Completed Successfully</h3>
              <p className="text-xs text-neutral-400">Score obtained: {calculateScore()} / 30. You can now proceed to the Technical Round.</p>
            </div>
          </div>
          <Button
            onClick={() => navigate(`/interview-practice/${companyId}`)}
            className="text-xs px-5 py-2"
          >
            Back to Rounds Selection
          </Button>
        </div>
      )}
    </div>
  );
}

export default AptitudeRound;
