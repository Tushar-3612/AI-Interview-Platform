import { motion } from "framer-motion";

function TechnicalSection({ questions, currentIndex, answers, onSave }) {
  const question = questions[currentIndex];

  if (!question) {
    return (
      <div className="text-center py-12">
        <p style={{ color: "var(--text-muted)" }}>No technical questions available.</p>
      </div>
    );
  }

  const currentAnswer = answers[question.questionId] || "";
  const options = Array.isArray(question.options) ? question.options : [];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-3xl mx-auto"
    >
      <div className="student-card p-6 sm:p-8">
        {/* Question Header */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold uppercase bg-purple-500/10 text-purple-500">
            {question.topic || "Technical"}
          </span>
          {question.subtopic && (
            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold uppercase bg-gray-500/10 text-gray-500">
              {question.subtopic}
            </span>
          )}
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

        {/* MCQ Options */}
        <div className="space-y-3">
          <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            Select one option:
          </label>
          {options.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              This question has no options available.
            </p>
          ) : (
            options.map((option, idx) => {
              const isSelected = currentAnswer === option;
              return (
                <label
                  key={idx}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border cursor-pointer transition-colors"
                  style={{
                    borderColor: isSelected ? "var(--primary)" : "var(--border)",
                    background: isSelected ? "var(--primary-soft)" : "var(--input-bg)",
                    color: "var(--text-primary)",
                  }}
                >
                  <input
                    type="radio"
                    name={`tech-${question.questionId}`}
                    value={option}
                    checked={isSelected}
                    onChange={() => onSave(question.questionId, option)}
                    className="accent-[var(--primary)] w-4 h-4"
                  />
                  <span className="text-sm">{option}</span>
                </label>
              );
            })
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default TechnicalSection;
