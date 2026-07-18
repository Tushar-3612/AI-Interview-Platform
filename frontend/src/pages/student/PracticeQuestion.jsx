import { useState, useMemo } from "react";
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
} from "lucide-react";
import Button from "../../components/ui/Button";
import { getCompanyById } from "../../data/practiceQuestions";
import { getQuestionsForCompany } from "../../data/practiceQuestions";

/**
 * Practice Question Page — answer, evaluate, and progress through questions.
 */
function PracticeQuestion() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const company = getCompanyById(companyId);
  const allQuestions = useMemo(() => getQuestionsForCompany(companyId), [companyId]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [bookmarked, setBookmarked] = useState(new Set());
  const [completed, setCompleted] = useState(new Set());
  const [recording, setRecording] = useState(false);

  if (!company) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p style={{ color: "var(--text-secondary)" }}>Company not found.</p>
        <button type="button" onClick={() => navigate("/interview-practice")} className="mt-4 text-sm font-medium cursor-pointer" style={{ color: "var(--primary)" }}>
          Back to Practice
        </button>
      </div>
    );
  }

  const question = allQuestions[currentIndex];
  const progress = allQuestions.length ? ((currentIndex + 1) / allQuestions.length) * 100 : 0;

  const handleSubmit = () => {
    if (!answer.trim()) {
      toast.error("Please write your answer first");
      return;
    }
    setEvaluating(true);
    setTimeout(() => {
      const score = answer.length > 50 ? "Good" : "Needs Improvement";
      setEvaluation({
        score,
        feedback: score === "Good"
          ? "Your answer covers key concepts. Consider adding more specific examples."
          : "Try to expand your answer with more technical detail and structure.",
      });
      setSubmitted(true);
      setEvaluating(false);
    }, 1200);
  };

  const handleNext = () => {
    if (currentIndex < allQuestions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setAnswer("");
      setSubmitted(false);
      setEvaluation(null);
    } else {
      toast.success("Practice session complete!");
      navigate("/interview-practice");
    }
  };

  if (!question) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p style={{ color: "var(--text-secondary)" }}>No practice questions available for this company yet.</p>
        <button type="button" onClick={() => navigate("/interview-practice")} className="mt-4 text-sm font-medium cursor-pointer" style={{ color: "var(--primary)" }}>
          Back to Practice
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <button
        type="button"
        onClick={() => navigate("/interview-practice")}
        className="flex items-center gap-2 text-sm font-medium mb-6 cursor-pointer hover:opacity-80"
        style={{ color: "var(--text-secondary)" }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {company.name}
      </button>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          <span>Progress</span>
          <span>{currentIndex + 1} / {allQuestions.length}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: "var(--primary)" }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
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
            disabled={submitted}
            placeholder="Write your answer here..."
            rows={6}
            className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none"
            style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
          />
          <button
            type="button"
            onClick={() => {
              setRecording(!recording);
              toast(recording ? "Recording stopped" : "Voice input started (demo)");
            }}
            className="absolute bottom-3 right-3 p-2.5 rounded-xl cursor-pointer transition-all"
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
            Submit Answer
          </Button>
        ) : (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 mt-4"
            >
              <div className="p-4 rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}>
                <p className="text-xs font-semibold uppercase mb-1" style={{ color: "var(--text-muted)" }}>Evaluation</p>
                <p className="text-sm font-medium" style={{ color: "var(--success)" }}>{evaluation?.score}</p>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{evaluation?.feedback}</p>
              </div>
              <div className="p-4 rounded-xl border" style={{ borderColor: "var(--border)" }}>
                <p className="text-xs font-semibold uppercase mb-1" style={{ color: "var(--text-muted)" }}>Correct Answer</p>
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>{question.correctAnswer}</p>
              </div>
              <div className="p-4 rounded-xl border" style={{ borderColor: "var(--border)" }}>
                <p className="text-xs font-semibold uppercase mb-1" style={{ color: "var(--text-muted)" }}>Explanation</p>
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
          <button
            type="button"
            onClick={() => {
              setCompleted((prev) => new Set(prev).add(question.id));
              toast.success("Marked as completed");
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border cursor-pointer"
            style={{ borderColor: "var(--border)", color: completed.has(question.id) ? "var(--success)" : "var(--text-secondary)" }}
          >
            <CheckCircle2 className="w-4 h-4" />
            Mark as Completed
          </button>
          {submitted && (
            <button
              type="button"
              onClick={handleNext}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white btn-gradient cursor-pointer"
            >
              Next Question
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default PracticeQuestion;
