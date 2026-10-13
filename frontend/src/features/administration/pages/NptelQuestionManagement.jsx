import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
  Search,
  Filter,
  Upload,
  FileCode,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BookOpen,
  Download,
  RotateCcw,
} from "lucide-react";
import api from "../../../core/api/api.js";
import { getAuthToken } from "../../student/hooks/useStudentProfile.js";
import toast from "react-hot-toast";

const NPTEL_THEME_COLOR = "#FF6B35";

export default function NptelQuestionManagement() {
  const token = getAuthToken();
  const headers = { Authorization: `Bearer ${token}` };

  // Data & Pagination
  const [questions, setQuestions] = useState([]);
  const [stats, setStats] = useState({ total: 0, single: 0, multiple: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [weekFilter, setWeekFilter] = useState("");

  // Modals
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [deleteModalTarget, setDeleteModalTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Upload Modal State
  const [uploadTab, setUploadTab] = useState("json"); // "json" | "pdf" | "csv"
  const [uploadFile, setUploadFile] = useState(null);
  const [jsonText, setJsonText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [copiedSample, setCopiedSample] = useState(false);

  // Question Form State
  const emptyForm = {
    questionText: "",
    type: "single",
    options: ["", "", "", ""],
    correctAnswers: [],
    explanation: "",
    sectionTitle: "Introduction to Research",
    weekNumber: 1,
    points: 1,
    difficulty: "medium",
    passageTitle: "",
    passage: "",
  };
  const [formData, setFormData] = useState(emptyForm);

  // Fetch Questions
  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (search) params.search = search;
      if (typeFilter) params.type = typeFilter;
      if (weekFilter) params.week = weekFilter;

      const res = await api.get("/api/nptel/admin/questions", { headers, params });
      if (res.data?.success) {
        setQuestions(res.data.questions || []);
        setTotalCount(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
        if (res.data.stats) setStats(res.data.stats);
      }
    } catch (err) {
      toast.error("Failed to load NPTEL questions");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, typeFilter, weekFilter]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Open Form Modal for Create / Edit
  const handleOpenAdd = () => {
    setEditingQuestion(null);
    setFormData(emptyForm);
    setFormModalOpen(true);
  };

  const handleOpenEdit = (q) => {
    setEditingQuestion(q);
    setFormData({
      questionText: q.questionText || "",
      type: q.type || (q.correctAnswers?.length > 1 ? "multiple" : "single"),
      options: q.options?.length ? [...q.options] : ["", "", "", ""],
      correctAnswers: Array.isArray(q.correctAnswers) ? [...q.correctAnswers] : [q.correctAnswers],
      explanation: q.explanation || "",
      sectionTitle: q.sectionTitle || "Introduction to Research",
      weekNumber: q.weekNumber || 1,
      points: q.points || 1,
      difficulty: q.difficulty || "medium",
      passageTitle: q.passageTitle || "",
      passage: q.passage || "",
    });
    setFormModalOpen(true);
  };

  // Toggle option in correct answers list
  const handleToggleCorrectOption = (optText) => {
    if (!optText.trim()) return;
    const isMulti = formData.type === "multiple";

    if (isMulti) {
      setFormData((prev) => {
        const exists = prev.correctAnswers.includes(optText);
        const next = exists
          ? prev.correctAnswers.filter((a) => a !== optText)
          : [...prev.correctAnswers, optText];
        return { ...prev, correctAnswers: next };
      });
    } else {
      setFormData((prev) => ({
        ...prev,
        correctAnswers: [optText],
      }));
    }
  };

  // Save Question (Create or Update)
  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    if (!formData.questionText.trim()) {
      toast.error("Question text is required.");
      return;
    }
    const cleanOpts = formData.options.map((o) => o.trim()).filter(Boolean);
    if (cleanOpts.length < 2) {
      toast.error("At least 2 options are required.");
      return;
    }
    if (formData.correctAnswers.length === 0) {
      toast.error("Please mark at least one accepted answer.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        options: cleanOpts,
        type: formData.correctAnswers.length > 1 ? "multiple" : formData.type,
      };

      if (editingQuestion) {
        const qId = editingQuestion._id || editingQuestion.questionId;
        await api.put(`/api/nptel/admin/questions/${qId}`, payload, { headers });
        toast.success("Question updated successfully.");
      } else {
        await api.post("/api/nptel/admin/questions", payload, { headers });
        toast.success("Question created successfully.");
      }
      setFormModalOpen(false);
      fetchQuestions();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save question");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Question
  const handleDeleteConfirm = async () => {
    if (!deleteModalTarget) return;
    setSubmitting(true);
    try {
      const qId = deleteModalTarget._id || deleteModalTarget.questionId;
      await api.delete(`/api/nptel/admin/questions/${qId}`, { headers });
      toast.success("Question deleted.");
      setDeleteModalTarget(null);
      fetchQuestions();
    } catch (err) {
      toast.error("Failed to delete question");
    } finally {
      setSubmitting(false);
    }
  };

  // Bulk Upload Handler
  const handleBulkUpload = async () => {
    setUploading(true);
    try {
      if (uploadTab === "json" && jsonText.trim()) {
        const res = await api.post(
          "/api/nptel/admin/upload",
          { jsonText },
          { headers }
        );
        if (res.data?.success) {
          toast.success(res.data.message || `Imported ${res.data.count} questions!`);
          setUploadModalOpen(false);
          setJsonText("");
          fetchQuestions();
          return;
        }
      }

      if (!uploadFile) {
        toast.error("Please select a file to upload.");
        setUploading(false);
        return;
      }

      const fd = new FormData();
      fd.append("file", uploadFile);

      const res = await api.post("/api/nptel/admin/upload", fd, {
        headers: {
          ...headers,
          "Content-Type": "multipart/form-data",
        },
      });

      if (res.data?.success) {
        toast.success(res.data.message || `Imported ${res.data.count} questions!`);
        setUploadModalOpen(false);
        setUploadFile(null);
        fetchQuestions();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload questions");
    } finally {
      setUploading(false);
    }
  };

  // Sample JSON for copying
  const sampleJsonCode = `[
  {
    "questionText": "Which of the following are essential aspects of scientific research?",
    "type": "multiple",
    "options": [
      "Empirical testing and validation",
      "Systematic observation and methodology",
      "Subjective intuition without verification",
      "Reproducible experimental results"
    ],
    "correctAnswers": [
      "Empirical testing and validation",
      "Systematic observation and methodology",
      "Reproducible experimental results"
    ],
    "explanation": "Scientific inquiry demands empirical validation, structured methods, and reproducibility.",
    "sectionTitle": "Week 1: Research Methodology",
    "weekNumber": 1,
    "points": 1
  },
  {
    "questionText": "What distinguishes inductive reasoning from deductive reasoning?",
    "type": "single",
    "options": [
      "Inductive reasoning moves from specific observations to broader generalizations",
      "Deductive reasoning never uses logic",
      "Inductive reasoning is only used in literature",
      "There is no difference between them"
    ],
    "correctAnswers": [
      "Inductive reasoning moves from specific observations to broader generalizations"
    ],
    "explanation": "Inductive reasoning establishes general rules from observed premises.",
    "sectionTitle": "Week 2: Reasoning in Science",
    "weekNumber": 2,
    "points": 1
  }
]`;

  const handleCopySample = () => {
    navigator.clipboard.writeText(sampleJsonCode);
    setCopiedSample(true);
    toast.success("Sample JSON copied to clipboard");
    setTimeout(() => setCopiedSample(false), 2000);
  };

  const handleDownloadTemplate = async (format) => {
    try {
      const res = await api.get(`/api/nptel/admin/templates/${format}`, {
        headers,
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `nptel_questions_template.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${format.toUpperCase()} template`);
    } catch {
      toast.error("Failed to download template");
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border"
            style={{
              background: "rgba(255, 107, 53, 0.12)",
              borderColor: "rgba(255, 107, 53, 0.3)",
              color: NPTEL_THEME_COLOR,
            }}
          >
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black" style={{ color: "var(--text-primary)" }}>
                NPTEL Question Bank
              </h1>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                style={{
                  background: "rgba(255, 107, 53, 0.15)",
                  color: NPTEL_THEME_COLOR,
                  border: "1px solid rgba(255, 107, 53, 0.3)",
                }}
              >
                Admin Management
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Manage, create, and bulk-upload questions for the unified NPTEL assessment via PDF or JSON
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setUploadModalOpen(true)}
            className="px-4 py-2.5 rounded-xl border text-xs font-bold transition flex items-center gap-2 cursor-pointer hover:bg-[var(--bg-secondary)]"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <Upload className="w-4 h-4" style={{ color: NPTEL_THEME_COLOR }} />
            <span>Upload PDF / JSON</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4.5 py-2.5 rounded-xl text-xs font-bold text-white transition flex items-center gap-2 cursor-pointer shadow-md hover:opacity-95"
            style={{
              background: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)",
              boxShadow: "0 4px 15px rgba(255, 107, 53, 0.3)",
            }}
          >
            <Plus className="w-4 h-4" />
            <span>Add Question</span>
          </button>
        </div>
      </div>

      {/* ── STATS STRIP ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl border bg-[var(--card-bg)]" style={{ borderColor: "var(--border)" }}>
          <span className="text-xs font-semibold text-gray-400">Total Questions</span>
          <p className="text-2xl font-black mt-1" style={{ color: "var(--text-primary)" }}>
            {stats.total || totalCount}
          </p>
        </div>

        <div className="p-4 rounded-2xl border bg-[var(--card-bg)]" style={{ borderColor: "var(--border)" }}>
          <span className="text-xs font-semibold text-gray-400">Single Choice</span>
          <p className="text-2xl font-black text-sky-400 mt-1">
            {stats.single}
          </p>
        </div>

        <div className="p-4 rounded-2xl border bg-[var(--card-bg)]" style={{ borderColor: "var(--border)" }}>
          <span className="text-xs font-semibold text-gray-400">Multi-Select (MSQ)</span>
          <p className="text-2xl font-black text-orange-400 mt-1">
            {stats.multiple}
          </p>
        </div>

        <div className="p-4 rounded-2xl border bg-[var(--card-bg)]" style={{ borderColor: "var(--border)" }}>
          <span className="text-xs font-semibold text-gray-400">Passing Benchmark</span>
          <p className="text-2xl font-black text-emerald-400 mt-1">
            40%
          </p>
        </div>
      </div>

      {/* ── FILTERS BAR ── */}
      <div className="p-4 rounded-2xl border bg-[var(--card-bg)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3" style={{ borderColor: "var(--border)" }}>
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search questions or keywords..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs border outline-none bg-[var(--input-bg)] transition focus:border-[#FF6B35]"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl text-xs border outline-none bg-[var(--input-bg)] cursor-pointer"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <option value="">All Question Types</option>
            <option value="single">Single Choice Only</option>
            <option value="multiple">Multi-Select (MSQ) Only</option>
          </select>

          {/* Week filter */}
          <select
            value={weekFilter}
            onChange={(e) => {
              setWeekFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl text-xs border outline-none bg-[var(--input-bg)] cursor-pointer"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <option value="">All 12 Weeks</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Week {i + 1}
              </option>
            ))}
          </select>

          {(search || typeFilter || weekFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setTypeFilter("");
                setWeekFilter("");
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-white border flex items-center gap-1 cursor-pointer"
              style={{ borderColor: "var(--border)" }}
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* ── QUESTIONS TABLE ── */}
      <div className="rounded-2xl border bg-[var(--card-bg)] overflow-hidden" style={{ borderColor: "var(--border)" }}>
        {loading ? (
          <div className="p-12 text-center text-xs text-gray-400">Loading questions...</div>
        ) : questions.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-400 space-y-2">
            <p>No questions matched your filter.</p>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="text-[#FF6B35] font-bold hover:underline"
            >
              Add your first question
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b text-gray-400 uppercase tracking-wider text-[10px]" style={{ borderColor: "var(--border)" }}>
                  <th className="py-3.5 px-4 font-bold w-14">#</th>
                  <th className="py-3.5 px-4 font-bold">Question</th>
                  <th className="py-3.5 px-4 font-bold w-32">Type</th>
                  <th className="py-3.5 px-4 font-bold w-48">Topic / Week</th>
                  <th className="py-3.5 px-4 font-bold w-24 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                {questions.map((q) => {
                  const isMulti = q.type === "multiple" || q.correctAnswers?.length > 1;

                  return (
                    <tr
                      key={q._id || q.questionId}
                      className="hover:bg-[var(--bg-secondary)]/50 transition group"
                    >
                      <td className="py-3.5 px-4 font-black" style={{ color: NPTEL_THEME_COLOR }}>
                        Q{q.questionNumber}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <p className="font-semibold line-clamp-2" style={{ color: "var(--text-primary)" }}>
                            {q.questionText}
                          </p>

                          {/* Options pills preview */}
                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                            {q.options?.map((opt, i) => {
                              const isCorrect = q.correctAnswers?.includes(opt);
                              return (
                                <span
                                  key={i}
                                  className={`text-[10px] px-2 py-0.5 rounded-md border font-medium ${
                                    isCorrect
                                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-bold"
                                      : "border-gray-700 text-gray-400"
                                  }`}
                                >
                                  {String.fromCharCode(65 + i)}: {opt.slice(0, 30)}
                                  {opt.length > 30 ? "..." : ""}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {isMulti ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30">
                            Multi-Select
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30">
                            Single Choice
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-gray-400">
                        <div className="truncate max-w-[180px] font-medium">
                          {q.sectionTitle}
                        </div>
                        <span className="text-[10px] text-gray-500">
                          Week {q.weekNumber} · {q.points || 1} pt
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(q)}
                            className="p-1.5 rounded-lg border hover:text-white cursor-pointer transition hover:bg-[var(--bg-secondary)]"
                            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                            title="Edit Question"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteModalTarget(q)}
                            className="p-1.5 rounded-lg border hover:text-red-400 cursor-pointer transition hover:bg-red-500/10"
                            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                            title="Delete Question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between gap-3 text-xs" style={{ borderColor: "var(--border)" }}>
            <span className="text-gray-400">
              Showing page {page} of {totalPages} ({totalCount} questions)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border disabled:opacity-40 cursor-pointer flex items-center gap-1"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border disabled:opacity-40 cursor-pointer flex items-center gap-1"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════
          ADD / EDIT QUESTION MODAL
      ═══════════════════════════════════════════════ */}
      <AnimatePresence>
        {formModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="student-card rounded-3xl p-6 sm:p-8 max-w-2xl w-full border my-8"
              style={{ background: "var(--bg-primary)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  {editingQuestion ? `Edit Question #${editingQuestion.questionNumber}` : "Add New NPTEL Question"}
                </h2>
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveQuestion} className="space-y-4">
                {/* Question Text */}
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Question Text *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={formData.questionText}
                    onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
                    placeholder="Enter the question statement..."
                    className="w-full p-3 rounded-xl text-xs border outline-none bg-[var(--input-bg)] focus:border-[#FF6B35]"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </div>

                {/* Type & Week Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">
                      Type *
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => {
                        const newType = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          type: newType,
                          correctAnswers: newType === "single" && prev.correctAnswers.length > 1
                            ? [prev.correctAnswers[0]]
                            : prev.correctAnswers,
                        }));
                      }}
                      className="w-full p-2.5 rounded-xl text-xs border outline-none bg-[var(--input-bg)]"
                      style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                    >
                      <option value="single">Single Choice</option>
                      <option value="multiple">Multi-Select (MSQ)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">
                      Week / Section Number
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={formData.weekNumber}
                      onChange={(e) => setFormData({ ...formData, weekNumber: Number(e.target.value) })}
                      className="w-full p-2.5 rounded-xl text-xs border outline-none bg-[var(--input-bg)]"
                      style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">
                      Marks / Points
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={formData.points}
                      onChange={(e) => setFormData({ ...formData, points: Number(e.target.value) })}
                      className="w-full p-2.5 rounded-xl text-xs border outline-none bg-[var(--input-bg)]"
                      style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                    />
                  </div>
                </div>

                {/* Section Title */}
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Topic / Section Title
                  </label>
                  <input
                    type="text"
                    value={formData.sectionTitle}
                    onChange={(e) => setFormData({ ...formData, sectionTitle: e.target.value })}
                    placeholder="e.g. Introduction to Research Methodology"
                    className="w-full p-2.5 rounded-xl text-xs border outline-none bg-[var(--input-bg)]"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </div>

                {/* Options (A, B, C, D) & Answer Checkbox */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-gray-300">
                      Options &amp; Accepted Answer(s) *
                    </label>
                    <span className="text-[11px] text-gray-400">
                      Check box next to option to mark as accepted
                    </span>
                  </div>

                  <div className="space-y-2">
                    {formData.options.map((opt, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      const isMarked = formData.correctAnswers.includes(opt);

                      return (
                        <div key={idx} className="flex items-center gap-2">
                          {/* Checkbox / Radio indicator to mark accepted */}
                          <button
                            type="button"
                            onClick={() => handleToggleCorrectOption(opt)}
                            className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 cursor-pointer transition ${
                              isMarked ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-500"
                            }`}
                            title="Mark as accepted answer"
                          >
                            {isMarked ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <span className="text-[10px] text-gray-400">{letter}</span>}
                          </button>

                          <input
                            type="text"
                            required
                            placeholder={`Option ${letter} text...`}
                            value={opt}
                            onChange={(e) => {
                              const val = e.target.value;
                              const oldVal = formData.options[idx];
                              const nextOpts = [...formData.options];
                              nextOpts[idx] = val;

                              // Update correctAnswers if this option was selected
                              const nextCorrect = formData.correctAnswers.map((a) =>
                                a === oldVal ? val : a
                              );

                              setFormData({
                                ...formData,
                                options: nextOpts,
                                correctAnswers: nextCorrect,
                              });
                            }}
                            className="flex-1 p-2.5 rounded-xl text-xs border outline-none bg-[var(--input-bg)]"
                            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Explanation */}
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Explanation / Accepted Rationale
                  </label>
                  <textarea
                    rows={2}
                    value={formData.explanation}
                    onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                    placeholder="Explain why the accepted answer is correct..."
                    className="w-full p-2.5 rounded-xl text-xs border outline-none bg-[var(--input-bg)]"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </div>

                {/* Submit Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                  <button
                    type="button"
                    onClick={() => setFormModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer hover:bg-[var(--bg-secondary)]"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white cursor-pointer shadow-md hover:opacity-95"
                    style={{ background: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)" }}
                  >
                    {submitting ? "Saving..." : editingQuestion ? "Update Question" : "Create Question"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════
          BULK UPLOAD MODAL (PDF / JSON / CSV)
      ═══════════════════════════════════════════════ */}
      <AnimatePresence>
        {uploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="student-card rounded-3xl p-6 sm:p-8 max-w-xl w-full border my-8"
              style={{ background: "var(--bg-primary)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                    Bulk Import Questions
                  </h2>
                  <p className="text-xs text-gray-400">
                    Upload official assignment PDFs or structured JSON questions
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-2 p-1 rounded-xl border text-xs font-bold mb-4" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
                <button
                  type="button"
                  onClick={() => setUploadTab("json")}
                  className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    uploadTab === "json" ? "bg-[#FF6B35] text-white" : "text-gray-400"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>JSON (File / Paste)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setUploadTab("pdf")}
                  className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    uploadTab === "pdf" ? "bg-[#FF6B35] text-white" : "text-gray-400"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>PDF Document</span>
                </button>

                <button
                  type="button"
                  onClick={() => setUploadTab("csv")}
                  className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    uploadTab === "csv" ? "bg-[#FF6B35] text-white" : "text-gray-400"
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>CSV File</span>
                </button>
              </div>

              {/* TAB 1: JSON */}
              {uploadTab === "json" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-300">
                      Paste JSON Array or Upload .json file
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopySample}
                        className="text-[11px] font-bold text-[#FF6B35] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {copiedSample ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedSample ? "Copied" : "Copy Sample"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadTemplate("json")}
                        className="text-[11px] font-bold text-gray-400 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Template</span>
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={6}
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    placeholder='[ { "questionText": "...", "options": ["A", "B"], "correctAnswers": ["A"] } ]'
                    className="w-full p-3 rounded-xl text-xs font-mono border outline-none bg-[var(--input-bg)]"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">
                      Or select .json file:
                    </label>
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="text-xs text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#FF6B35] file:text-white cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: PDF */}
              {uploadTab === "pdf" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border bg-[var(--bg-secondary)] space-y-2" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center gap-2 text-xs font-bold text-[#FF6B35]">
                      <FileText className="w-4 h-4" />
                      <span>PDF Document Parsing</span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Upload assignment question sheet PDF. Questions, options (A, B, C, D), and answers will be automatically parsed and mapped into the NPTEL question bank.
                    </p>
                  </div>

                  <div className="border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition hover:border-[#FF6B35]" style={{ borderColor: "var(--border)" }}>
                    <input
                      type="file"
                      id="pdf-upload-input"
                      accept=".pdf"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <label htmlFor="pdf-upload-input" className="cursor-pointer space-y-2 block">
                      <Upload className="w-8 h-8 mx-auto text-[#FF6B35]" />
                      <p className="text-xs font-bold text-gray-200">
                        {uploadFile ? uploadFile.name : "Click to select or drag .pdf file here"}
                      </p>
                      <p className="text-[11px] text-gray-500">Max size 15MB</p>
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 3: CSV */}
              {uploadTab === "csv" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-300">
                      Upload CSV file
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDownloadTemplate("csv")}
                      className="text-[11px] font-bold text-[#FF6B35] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download Template</span>
                    </button>
                  </div>

                  <div className="border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition hover:border-[#FF6B35]" style={{ borderColor: "var(--border)" }}>
                    <input
                      type="file"
                      id="csv-upload-input"
                      accept=".csv"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <label htmlFor="csv-upload-input" className="cursor-pointer space-y-2 block">
                      <FileSpreadsheet className="w-8 h-8 mx-auto text-[#FF6B35]" />
                      <p className="text-xs font-bold text-gray-200">
                        {uploadFile ? uploadFile.name : "Click to select or drag .csv file here"}
                      </p>
                      <p className="text-[11px] text-gray-500">Columns: questionText, type, option_a, option_b, option_c, option_d, correctAnswer</p>
                    </label>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t" style={{ borderColor: "var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer hover:bg-[var(--bg-secondary)]"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkUpload}
                  disabled={uploading}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white cursor-pointer shadow-md hover:opacity-95 flex items-center gap-1.5"
                  style={{ background: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)" }}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? "Importing Questions..." : "Import Questions"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════
          DELETE CONFIRMATION MODAL
      ═══════════════════════════════════════════════ */}
      <AnimatePresence>
        {deleteModalTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="student-card rounded-3xl p-6 sm:p-8 max-w-md w-full border"
              style={{ background: "var(--bg-primary)", borderColor: "var(--border)" }}
            >
              <h3 className="text-lg font-black mb-2" style={{ color: "var(--text-primary)" }}>
                Delete Question #{deleteModalTarget.questionNumber}?
              </h3>
              <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                Are you sure you want to delete this question? It will no longer appear in the NPTEL assignment test.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteModalTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer hover:bg-[var(--bg-secondary)]"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 cursor-pointer"
                >
                  {submitting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
