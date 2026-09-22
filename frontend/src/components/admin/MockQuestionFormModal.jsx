import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

export default function MockQuestionFormModal({ isOpen, onClose, onSuccess, companyId, type = "mcq", initialData = null, onDuplicateFound }) {
  const isEdit = Boolean(initialData);

  const [formData, setFormData] = useState({
    question: "",
    title: "",
    options: ["", "", "", ""],
    correctAnswer: "",
    expectedAnswer: "",
    explanation: "",
    betterAnswer: "",
    difficulty: "Medium",
    marks: 3,
    topic: "Technical Fundamentals",
    problemStatement: "",
    constraints: "",
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        question: initialData.question || "",
        title: initialData.title || initialData.question || "",
        options: Array.isArray(initialData.options) && initialData.options.length > 0
          ? initialData.options
          : ["", "", "", ""],
        correctAnswer: initialData.correctAnswer || "",
        expectedAnswer: initialData.expectedAnswer || "",
        explanation: initialData.explanation || "",
        betterAnswer: initialData.betterAnswer || "",
        difficulty: initialData.difficulty || "Medium",
        marks: initialData.marks || (type === "mcq" ? 1 : 3),
        topic: initialData.topic || initialData.category || "General",
        problemStatement: initialData.problemStatement || initialData.question || "",
        constraints: initialData.constraints || "",
      });
    } else {
      setFormData({
        question: "",
        title: "",
        options: ["", "", "", ""],
        correctAnswer: "",
        expectedAnswer: "",
        explanation: "",
        betterAnswer: "",
        difficulty: "Medium",
        marks: type === "mcq" ? 1 : 3,
        topic: type === "coding" ? "Algorithms" : "Technical Fundamentals",
        problemStatement: "",
        constraints: "",
      });
    }
  }, [initialData, type, isOpen]);

  if (!isOpen) return null;

  const handleOptionChange = (idx, val) => {
    const next = [...formData.options];
    next[idx] = val;
    setFormData({ ...formData, options: next });
  };

  const addOptionField = () => {
    setFormData({ ...formData, options: [...formData.options, ""] });
  };

  const removeOptionField = (idx) => {
    if (formData.options.length <= 2) {
      toast.error("MCQ must have at least 2 options");
      return;
    }
    const next = formData.options.filter((_, i) => i !== idx);
    setFormData({ ...formData, options: next });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = getAuthToken();
    const headers = { Authorization: `Bearer ${token}` };

    const textToMatch = type === "coding" ? formData.title : formData.question;
    if (!textToMatch || !textToMatch.trim()) {
      toast.error("Question text is required");
      return;
    }

    setSubmitting(true);

    try {
      // 1. Client-Side Check Endpoint
      const checkRes = await api.post(
        "/api/admin/mock-questions/check-duplicate",
        {
          companyId,
          type,
          questionText: textToMatch,
          excludeId: initialData?.questionId || initialData?._id,
        },
        { headers }
      );

      if (checkRes.data?.isDuplicate) {
        setSubmitting(false);
        if (onDuplicateFound) {
          onDuplicateFound(
            { question: textToMatch, companyId, type },
            checkRes.data.existingQuestion
          );
        }
        return;
      }

      // 2. Submit to Add/Edit Endpoint
      const payload = {
        companyId,
        type,
        question: formData.question,
        title: formData.title,
        options: formData.options.filter((o) => o.trim() !== ""),
        correctAnswer: formData.correctAnswer,
        expectedAnswer: formData.expectedAnswer,
        explanation: formData.explanation,
        betterAnswer: formData.betterAnswer,
        difficulty: formData.difficulty,
        marks: Number(formData.marks),
        topic: formData.topic,
        problemStatement: formData.problemStatement,
        constraints: formData.constraints,
      };

      if (isEdit) {
        const qId = initialData.questionId || initialData._id;
        await api.put(`/api/admin/mock-questions/${qId}`, payload, { headers });
        toast.success("Question updated successfully!");
      } else {
        await api.post("/api/admin/mock-questions", payload, { headers });
        toast.success("Question added successfully!");
      }

      onSuccess();
      onClose();
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.isDuplicate) {
        if (onDuplicateFound) {
          onDuplicateFound(
            { question: textToMatch, companyId, type },
            err.response.data.existingQuestion
          );
        }
      } else {
        toast.error(err.response?.data?.message || "Failed to save question");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 backdrop-blur-md"
          style={{ background: "var(--admin-modal-overlay, rgba(0, 0, 0, 0.7))" }}
        />

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-2xl rounded-2xl border p-6 shadow-2xl z-10 my-8"
          style={{ background: "var(--card-bg, #1e293b)", borderColor: "var(--border, #334155)", color: "var(--text-primary, #f8fafc)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: "var(--border, #334155)" }}>
            <h3 className="text-base font-bold tracking-tight">
              {isEdit ? "Edit Mock Question" : "Add New Mock Question"} — <span className="uppercase" style={{ color: "var(--primary)" }}>{type}</span>
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl transition-colors hover:bg-slate-700/50 cursor-pointer"
              style={{ color: "var(--text-muted, #64748b)" }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="py-4 space-y-4 max-h-[75vh] overflow-y-auto pr-2">
            {/* Topic & Difficulty Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary, #94a3b8)" }}>
                  Topic / Category
                </label>
                <input
                  type="text"
                  required
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  placeholder="e.g. Data Structures"
                  className="w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-blue-500"
                  style={{ background: "var(--input-bg)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                  Difficulty
                </label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-blue-500"
                  style={{ background: "var(--input-bg)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                  Marks
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={formData.marks}
                  onChange={(e) => setFormData({ ...formData, marks: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-blue-500"
                  style={{ background: "var(--input-bg)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </div>
            </div>

            {/* Question Text or Title */}
            {type === "coding" ? (
              <>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                    Problem Title
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value, question: e.target.value })}
                    placeholder="e.g. Reverse Linked List"
                    className="w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-blue-500"
                    style={{ background: "var(--input-bg)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                    Problem Statement
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={formData.problemStatement}
                    onChange={(e) => setFormData({ ...formData, problemStatement: e.target.value })}
                    placeholder="Describe the coding problem..."
                    className="w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-blue-500 font-mono"
                    style={{ background: "var(--input-bg)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                  Question Text
                </label>
                <textarea
                  rows={3}
                  required
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  placeholder="Enter question text..."
                  className="w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-blue-500"
                  style={{ background: "var(--input-bg)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </div>
            )}

            {/* MCQ Options & Correct Answer */}
            {type === "mcq" && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                    Options
                  </label>
                  <button
                    type="button"
                    onClick={addOptionField}
                    className="flex items-center gap-1 text-[11px] font-semibold hover:underline cursor-pointer"
                    style={{ color: "var(--primary)" }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Option</span>
                  </button>
                </div>

                {formData.options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs font-semibold w-5 text-slate-400">{String.fromCharCode(65 + idx)}.</span>
                    <input
                      type="text"
                      required
                      value={opt}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                      className="flex-1 px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-blue-500"
                      style={{ background: "var(--input-bg)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                    />
                    <button
                      type="button"
                      onClick={() => removeOptionField(idx)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-500/10 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                    Correct Answer
                  </label>
                  <select
                    value={formData.correctAnswer}
                    onChange={(e) => setFormData({ ...formData, correctAnswer: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-blue-500"
                    style={{ background: "var(--input-bg)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  >
                    <option value="">-- Select Correct Option --</option>
                    {formData.options.map((opt, idx) => (
                      <option key={idx} value={opt}>
                        {String.fromCharCode(65 + idx)}: {opt.slice(0, 40)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Technical Free-Text Answers */}
            {type === "technical" && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                    Expected Answer
                  </label>
                  <textarea
                    rows={3}
                    value={formData.expectedAnswer}
                    onChange={(e) => setFormData({ ...formData, expectedAnswer: e.target.value })}
                    placeholder="Key concepts, terms, or expected explanation..."
                    className="w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-blue-500"
                    style={{ background: "var(--input-bg)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                    Better / Exemplary Answer (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={formData.betterAnswer}
                    onChange={(e) => setFormData({ ...formData, betterAnswer: e.target.value })}
                    placeholder="In-depth answer for top scoring..."
                    className="w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-blue-500"
                    style={{ background: "var(--input-bg)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>
            )}

            {/* Explanation */}
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                Explanation (Optional)
              </label>
              <textarea
                rows={2}
                value={formData.explanation}
                onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                placeholder="Additional notes or solution explanation..."
                className="w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-blue-500"
                style={{ background: "var(--input-bg)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>

            {/* Footer */}
            <div className="pt-4 border-t flex justify-end gap-3" style={{ borderColor: "var(--border)" }}>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold border hover:bg-slate-500/10 cursor-pointer"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2 hover:opacity-90 shadow-sm"
                style={{ background: "var(--primary)" }}
              >
                {submitting ? (
                  <span>Checking & Saving...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isEdit ? "Update Question" : "Save Question"}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
