import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";

const QUESTION_TYPES = ["MCQ", "True/False", "Descriptive"];

const emptyQuestion = () => ({
  type: "MCQ",
  question: "",
  options: ["", "", "", ""],
  correctAnswer: "",
  marks: 1,
  negativeMarks: 0,
  explanation: "",
  subject: "",
  difficulty: "medium",
});

export default function QuestionEditor({ questions, onChange, subjects }) {
  const [editing, setEditing] = useState(null);

  const addNew = () => {
    const q = emptyQuestion();
    onChange([...questions, q]);
    setEditing(questions.length);
  };

  const remove = (idx) => {
    if (editing === idx) setEditing(null);
    onChange(questions.filter((_, i) => i !== idx));
  };

  const update = (idx, field, value) => {
    const updated = questions.map((q, i) => i === idx ? { ...q, [field]: value } : q);
    onChange(updated);
  };

  const updateOption = (idx, oi, val) => {
    const updated = questions.map((q, i) => {
      if (i !== idx) return q;
      const opts = [...(q.options || [])];
      opts[oi] = val;
      return { ...q, options: opts };
    });
    onChange(updated);
  };

  const qType = questions[editing]?.type;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          {questions.length} question{questions.length !== 1 ? "s" : ""}
        </span>
        <button onClick={addNew}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg cursor-pointer"
          style={{ background: "var(--primary)" }}>
          <Plus className="w-3.5 h-3.5" /> Add Question
        </button>
      </div>

      {questions.length === 0 && (
        <div className="py-10 text-center">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No questions yet. Click "Add Question" to begin.</p>
        </div>
      )}

      {questions.map((q, idx) => (
        <div key={idx}
          className="border admin-border admin-card rounded-xl overflow-hidden"
        >
          {editing === idx ? (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold px-2 py-0.5 rounded admin-bg-surface">Q{idx + 1}</span>
                <button onClick={() => setEditing(null)} className="cursor-pointer">
                  <X className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Question *</label>
                  <textarea value={q.question} onChange={e => update(idx, "question", e.target.value)}
                    className="w-full px-3 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none min-h-[60px]"
                    style={{ color: "var(--text-primary)" }} placeholder="Enter question text" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Type</label>
                  <select value={q.type} onChange={e => update(idx, "type", e.target.value)}
                    className="w-full px-3 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] appearance-none cursor-pointer"
                    style={{ color: "var(--text-primary)" }}>
                    {QUESTION_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Marks</label>
                    <input type="number" min="0" value={q.marks} onChange={e => update(idx, "marks", parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      style={{ color: "var(--text-primary)" }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Negative</label>
                    <input type="number" min="0" value={q.negativeMarks} onChange={e => update(idx, "negativeMarks", parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      style={{ color: "var(--text-primary)" }} />
                  </div>
                </div>
              </div>

              {subjects?.length > 0 && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Subject</label>
                  <select value={q.subject} onChange={e => update(idx, "subject", e.target.value)}
                    className="w-full px-3 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] appearance-none cursor-pointer"
                    style={{ color: "var(--text-primary)" }}>
                    <option value="">Select subject</option>
                    {subjects.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Difficulty</label>
                  <select value={q.difficulty} onChange={e => update(idx, "difficulty", e.target.value)}
                    className="w-full px-3 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] appearance-none cursor-pointer"
                    style={{ color: "var(--text-primary)" }}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              {(q.type === "MCQ") && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Options</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs font-medium shrink-0" style={{ color: "var(--text-muted)" }}>
                          {String.fromCharCode(65 + i)}.
                        </span>
                        <input value={q.options[i] || ""} onChange={e => updateOption(idx, i, e.target.value)}
                          className="w-full px-3 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                          style={{ color: "var(--text-primary)" }} placeholder={`Option ${String.fromCharCode(65 + i)}`} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {q.type === "True/False" && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Correct Answer</label>
                  <select value={q.correctAnswer} onChange={e => update(idx, "correctAnswer", e.target.value)}
                    className="w-full px-3 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] appearance-none cursor-pointer"
                    style={{ color: "var(--text-primary)" }}>
                    <option value="">Select</option>
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                </div>
              )}

              {q.type === "MCQ" && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Correct Answer</label>
                  <input value={q.correctAnswer} onChange={e => update(idx, "correctAnswer", e.target.value)}
                    className="w-full px-3 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    style={{ color: "var(--text-primary)" }} placeholder="Enter correct option (e.g. A, B, C, D)" />
                </div>
              )}

              {q.type === "Descriptive" && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Model Answer (optional)</label>
                  <textarea value={q.correctAnswer} onChange={e => update(idx, "correctAnswer", e.target.value)}
                    className="w-full px-3 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none min-h-[60px]"
                    style={{ color: "var(--text-primary)" }} placeholder="Expected answer or key points" />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Explanation (optional)</label>
                <textarea value={q.explanation} onChange={e => update(idx, "explanation", e.target.value)}
                  className="w-full px-3 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none min-h-[50px]"
                  style={{ color: "var(--text-primary)" }} placeholder="Explain why this answer is correct" />
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between p-3 cursor-pointer" onClick={() => setEditing(idx)}>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-xs font-semibold px-2 py-0.5 rounded admin-bg-surface shrink-0">Q{idx + 1}</span>
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded border shrink-0"
                  style={{ borderColor: "var(--badge-info-text)", color: "var(--badge-info-text)" }}>{q.type}</span>
                <p className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
                  {q.question || "Empty question"}
                </p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); remove(idx); }}
                className="p-1.5 rounded-lg admin-error-hover shrink-0 cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--badge-error-text)" }} />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
