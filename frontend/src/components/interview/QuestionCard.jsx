import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, Clock, Award } from "lucide-react";

/**
 * QuestionCard Component
 * Displays the current interview question details with transition animations.
 */
function QuestionCard({
  questionText = "Explain the difference between process and thread.",
  currentIndex = 2,
  totalQuestions = 10,
  difficulty = "Medium",
  category = "Technical",
  estimatedTime = "3:00",
  topic = "General",
  marks = "10 Marks"
}) {
  // Difficulty styling configurations
  const diffColors = {
    Easy: { bg: "rgba(16, 185, 129, 0.1)", text: "var(--success)", border: "rgba(16, 185, 129, 0.2)" },
    Medium: { bg: "rgba(37, 99, 235, 0.1)", text: "var(--primary)", border: "rgba(37, 99, 235, 0.2)" },
    Hard: { bg: "rgba(239, 68, 68, 0.1)", text: "var(--error)", border: "rgba(239, 68, 68, 0.2)" }
  };

  const currentDiff = diffColors[difficulty] || diffColors.Medium;

  return (
    <div className="glass-card rounded-[16px] p-4 flex flex-col h-full justify-between relative overflow-hidden">
      {/* Background tech visual */}
      <div className="absolute right-0 bottom-0 opacity-[0.02] pointer-events-none translate-x-6 translate-y-6">
        <HelpCircle className="w-64 h-64" />
      </div>

      <div className="flex flex-col min-h-0 flex-1 justify-between">
        {/* Upper metadata row */}
        <div className="flex flex-col text-left mb-1">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
            Question {currentIndex} of {totalQuestions}
          </span>
          <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 mt-0.5">
            {category} <span className="mx-1 text-slate-350 dark:text-zinc-700">|</span> <span style={{ color: currentDiff.text }}>{difficulty}</span>
          </span>
        </div>

        {/* Dynamic Question Text with Fade/Slide Transition */}
        <div className="flex-1 flex items-center min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={questionText}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="w-full"
            >
              <h2 
                className="text-base sm:text-lg lg:text-xl font-bold leading-normal text-left"
                style={{ color: "var(--text-primary)" }}
              >
                "{questionText}"
              </h2>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Recommended Duration Row */}
      <div 
        className="flex items-center justify-between pt-2 border-t border-dashed mt-2 text-xs font-medium shrink-0"
        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
      >
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-slate-450 shrink-0" />
          <span>Est. Time: <span className="font-semibold text-slate-800 dark:text-slate-200">{estimatedTime} mins</span></span>
        </div>

        <div className="flex items-center gap-1">
          <span>Topic: <span className="font-semibold text-slate-800 dark:text-slate-200">{topic}</span></span>
        </div>

        <div className="flex items-center gap-1">
          <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>Marks: <span className="font-semibold text-slate-800 dark:text-slate-200">{marks}</span></span>
        </div>
      </div>
    </div>
  );
}

export default QuestionCard;
