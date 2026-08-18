import { motion } from "framer-motion";

function AptitudeSection({ questions, currentIndex, answers, onSave }) {
  const question = questions[currentIndex];

  if (!question) {
    return (
      <div className="text-center py-12">
        <p style={{ color: "var(--text-muted)" }}>No aptitude questions available.</p>
      </div>
    );
  }

  const selectedAnswer = answers[question.questionId] || "";

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-3xl mx-auto"
    >
      <div className="student-card p-6 sm:p-8">
        {/* Question Header */}
        <div className="flex items-center gap-3 mb-4">
          <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold uppercase bg-blue-500/10 text-blue-500">
            {question.category || "Aptitude"}
          </span>
          <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold uppercase bg-gray-500/10 text-gray-500">
            {question.difficulty || "Medium"}
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            Q{currentIndex + 1} of {questions.length}
          </span>
        </div>

        {/* Question */}
        <h3 className="text-base sm:text-lg font-bold leading-relaxed mb-6" style={{ color: "var(--text-primary)" }}>
          {question.question}
        </h3>

        {/* Options */}
        <div className="space-y-3">
          {(question.options || []).map((option, idx) => {
            const optionLabel = String.fromCharCode(65 + idx); // A, B, C, D
            const isSelected = selectedAnswer === optionLabel || selectedAnswer === String(idx);

            return (
              <button
                key={idx}
                onClick={() => onSave(question.questionId, optionLabel)}
                className={`w-full p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "border-[var(--primary)] bg-[var(--primary)]/5"
                    : "border-[var(--border)] hover:border-[var(--primary)]/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                      isSelected
                        ? "bg-[var(--primary)] text-white"
                        : "bg-[var(--bg-primary)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {optionLabel}
                  </span>
                  <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                    {option}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

export default AptitudeSection;
