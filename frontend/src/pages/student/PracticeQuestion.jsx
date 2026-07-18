import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Mic,
  MicOff,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronRight,
  Sparkles
} from "lucide-react";
import Button from "../../components/ui/Button";
import { COMPANIES } from "../../data/companies";
import technicalQuestionsList from "../../data/technical.json";
import api from "../../utils/api";

function PracticeQuestion() {
  const { companyId } = useParams();
  const navigate = useNavigate();

  const company = COMPANIES.find((c) => c.id === companyId);
  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [bookmarked, setBookmarked] = useState(new Set());
  const [recording, setRecording] = useState(false);
  const [recognition, setRecognition] = useState(null);

  // Initialize Web Speech API for voice dictation
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        setAnswer((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };

      rec.onerror = (err) => {
        console.error("Speech Recognition Error:", err);
        setRecording(false);
      };

      rec.onend = () => {
        setRecording(false);
      };

      setRecognition(rec);
    }
  }, []);

  // Initialize practice session
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

    // Check if technical questions are already loaded in this session
    if (currentSession.rounds.technical.questions && currentSession.rounds.technical.questions.length === 20) {
      setQuestions(currentSession.rounds.technical.questions);
      // Load current index progress
      const savedAnswers = currentSession.rounds.technical.answers || {};
      const savedEvaluations = currentSession.rounds.technical.evaluations || {};

      // Determine where to resume
      let nextIndex = 0;
      for (let idx = 0; idx < 20; idx++) {
        const qId = currentSession.rounds.technical.questions[idx].id;
        if (savedEvaluations[qId]) {
          nextIndex = idx + 1;
        } else {
          nextIndex = idx;
          break;
        }
      }
      if (nextIndex >= 20) {
        nextIndex = 19; // Cap at last question
      }
      setCurrentIndex(nextIndex);

      const currentQId = currentSession.rounds.technical.questions[nextIndex].id;
      setAnswer(savedAnswers[currentQId] || "");
      if (savedEvaluations[currentQId]) {
        setEvaluation(savedEvaluations[currentQId]);
        setSubmitted(true);
      }
    } else {
      // Pick 20 random questions for this company
      const companyQuestions = technicalQuestionsList.filter((q) => q.companyId === companyId);
      const shuffled = [...companyQuestions].sort(() => 0.5 - Math.random());
      const sampled = shuffled.slice(0, 20);

      setQuestions(sampled);
      currentSession.rounds.technical.questions = sampled;
      currentSession.rounds.technical.answers = {};
      currentSession.rounds.technical.evaluations = {};
      localStorage.setItem(sessionKey, JSON.stringify(currentSession));
    }
  }, [companyId]);

  if (!company) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p style={{ color: "var(--text-secondary)" }}>Company not found.</p>
        <button
          type="button"
          onClick={() => navigate("/interview-practice")}
          className="mt-4 text-sm font-medium cursor-pointer"
          style={{ color: "var(--primary)" }}
        >
          Back to Practice
        </button>
      </div>
    );
  }

  if (!session || questions.length === 0) return null;

  const question = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  const handleVoiceToggle = () => {
    if (!recognition) {
      toast.error("Speech recognition is not supported in this browser. Please type your answer.");
      return;
    }

    if (recording) {
      recognition.stop();
      setRecording(false);
      toast.success("Voice input stopped.");
    } else {
      setRecording(true);
      recognition.start();
      toast.success("Listening... Speak your answer.");
    }
  };

  const handleSubmit = async () => {
    if (!answer.trim()) {
      toast.error("Please type or record your answer first");
      return;
    }

    setEvaluating(true);
    try {
      const response = await api.post("/api/interview/evaluate-technical", {
        question: question.question,
        answer: answer
      });

      const { score, feedback } = response.data;

      // Update state and localStorage
      const sessionKey = `practice-session-${companyId}`;
      const updated = { ...session };
      updated.rounds.technical.answers[question.id] = answer;
      updated.rounds.technical.evaluations[question.id] = { score, feedback };

      localStorage.setItem(sessionKey, JSON.stringify(updated));
      setSession(updated);
      setEvaluation({ score, feedback });
      setSubmitted(true);
      toast.success("Answer evaluated!");
    } catch (err) {
      console.error(err);
      toast.error("AI evaluation failed. Please try again.");
    } finally {
      setEvaluating(false);
    }
  };

  const handleNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < questions.length) {
      setCurrentIndex(nextIndex);
      const nextQId = questions[nextIndex].id;
      const nextAnswer = session.rounds.technical.answers[nextQId] || "";
      const nextEvaluation = session.rounds.technical.evaluations[nextQId] || null;

      setAnswer(nextAnswer);
      if (nextEvaluation) {
        setEvaluation(nextEvaluation);
        setSubmitted(true);
      } else {
        setEvaluation(null);
        setSubmitted(false);
      }
    } else {
      // All 20 completed. Compute aggregate technical score (as percentage: avg score of 0-10 scale * 10)
      const evals = Object.values(session.rounds.technical.evaluations);
      const totalScore = evals.reduce((sum, e) => sum + (e.score || 0), 0);
      // Average score on a 100% scale
      const finalScorePercentage = Math.round((totalScore / (questions.length * 10)) * 100);

      const sessionKey = `practice-session-${companyId}`;
      const updated = { ...session };
      updated.rounds.technical.completed = true;
      updated.rounds.technical.score = finalScorePercentage;

      localStorage.setItem(sessionKey, JSON.stringify(updated));
      toast.success(`Technical Round completed! AI Score: ${finalScorePercentage}%`);
      navigate(`/interview-practice/${companyId}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <button
        type="button"
        onClick={() => navigate(`/interview-practice/${companyId}`)}
        className="flex items-center gap-2 text-sm font-medium mb-6 cursor-pointer hover:opacity-80"
        style={{ color: "var(--text-secondary)" }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Rounds Selection
      </button>

      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] mb-2" style={{ color: "var(--text-muted)" }}>
            Selected Stage
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>
            <Sparkles className="w-4 h-4" />
            Technical Round
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          <span>Questions Answered: {currentIndex + (submitted ? 1 : 0)} / {questions.length}</span>
          <span>Question {currentIndex + 1} of {questions.length}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: "var(--primary)" }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <motion.div
        key={question.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="student-card p-6 sm:p-8"
      >
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>
            {question.category}
          </span>
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            {question.difficulty}
          </span>
        </div>

        <h2 className="text-lg font-semibold mb-6 leading-relaxed" style={{ color: "var(--text-primary)" }}>
          {question.question}
        </h2>

        <div className="relative mb-4">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={submitted || evaluating}
            placeholder="Write your answer here..."
            rows={6}
            className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
            style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
          />
          <button
            type="button"
            onClick={handleVoiceToggle}
            disabled={submitted || evaluating}
            className="absolute bottom-3 right-3 p-2.5 rounded-xl cursor-pointer transition-all disabled:opacity-40"
            style={{
              background: recording ? "var(--error)" : "var(--primary)",
              color: "#fff",
            }}
          >
            {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>

        {!submitted ? (
          <Button onClick={handleSubmit} loading={evaluating}>
            Submit Answer for AI Review
          </Button>
        ) : (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 mt-4"
            >
              <div className="p-4 rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}>
                <p className="text-xs font-semibold uppercase mb-1" style={{ color: "var(--text-muted)" }}>AI Evaluation Score</p>
                <p className="text-base font-bold" style={{ color: evaluation?.score >= 6 ? "var(--success)" : "var(--error)" }}>
                  {evaluation?.score} / 10
                </p>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{evaluation?.feedback}</p>
              </div>
              <div className="p-4 rounded-xl border" style={{ borderColor: "var(--border)" }}>
                <p className="text-xs font-semibold uppercase mb-1" style={{ color: "var(--text-muted)" }}>Sample Reference Answer</p>
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>{question.correctAnswer}</p>
              </div>
              <div className="p-4 rounded-xl border" style={{ borderColor: "var(--border)" }}>
                <p className="text-xs font-semibold uppercase mb-1" style={{ color: "var(--text-muted)" }}>Explanation Reference</p>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{question.explanation}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        <div className="flex flex-wrap items-center gap-3 mt-6 pt-6 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            type="button"
            onClick={() => {
              setBookmarked((prev) => {
                const next = new Set(prev);
                next.has(question.id) ? next.delete(question.id) : next.add(question.id);
                return next;
              });
              toast.success(bookmarked.has(question.id) ? "Bookmark removed" : "Question bookmarked");
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border cursor-pointer"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            {bookmarked.has(question.id) ? <BookmarkCheck className="w-4 h-4" style={{ color: "var(--primary)" }} /> : <Bookmark className="w-4 h-4" />}
            Bookmark
          </button>

          {submitted && (
            <button
              type="button"
              onClick={handleNext}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white btn-gradient cursor-pointer"
            >
              {currentIndex < questions.length - 1 ? "Next Question" : "Complete Round"}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default PracticeQuestion;
