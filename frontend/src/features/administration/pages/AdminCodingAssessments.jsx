import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code2,
  Plus,
  Search,
  Clock,
  Award,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Users,
  Eye,
  ToggleLeft,
  ToggleRight,
  X,
  ChevronRight,
  ArrowUpDown,
  BookOpen,
  Filter,
  Upload,
} from "lucide-react";
import api from "../../../core/api/api.js";
import { getAuthToken } from "../../student/hooks/useStudentProfile.js";
import toast from "react-hot-toast";
import CodingBulkImportModal from "../components/CodingBulkImportModal.jsx";

export default function AdminCodingAssessments() {
  const token = getAuthToken();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const navigate = useNavigate();

  const [assessments, setAssessments] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    durationMinutes: 60,
    isActive: true,
    questions: [], // array of { questionId, order, marks, title, difficulty }
  });

  // Question Picker modal state
  const [questionSearch, setQuestionSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [resAssessments, resQuestions] = await Promise.all([
        api.get("/api/admin/coding/assessments", { headers }),
        api.get("/api/admin/coding/questions", { headers, params: { limit: 200 } }),
      ]);

      if (resAssessments.data?.success) {
        setAssessments(resAssessments.data.data?.assessments || []);
      }
      if (resQuestions.data?.success) {
        setQuestions(resQuestions.data.data?.questions || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load assessments");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleImportSuccess = async (importedList = []) => {
    const prevIds = new Set(questions.map((q) => String(q._id)));

    let newlyFetchedQuestions = [];
    try {
      const [resAssessments, resQuestions] = await Promise.all([
        api.get("/api/admin/coding/assessments", { headers }),
        api.get("/api/admin/coding/questions", { headers, params: { limit: 200 } }),
      ]);
      if (resAssessments.data?.success) {
        setAssessments(resAssessments.data.data?.assessments || []);
      }
      if (resQuestions.data?.success) {
        newlyFetchedQuestions = resQuestions.data.data?.questions || [];
        setQuestions(newlyFetchedQuestions);
      }
    } catch (err) {
      console.error("Refresh error after import:", err);
    }

    let newlyUploaded = Array.isArray(importedList) && importedList.length > 0 ? importedList : [];
    if (newlyUploaded.length === 0 && newlyFetchedQuestions.length > 0) {
      newlyUploaded = newlyFetchedQuestions.filter((q) => !prevIds.has(String(q._id)));
    }

    if (newlyUploaded.length > 0) {
      setModalOpen(true);

      setFormData((prev) => {
        const existingIds = new Set(prev.questions.map((item) => String(item.questionId)));
        const toAdd = [];

        newlyUploaded.forEach((q) => {
          const qId = String(q._id || q.id);
          if (qId && !existingIds.has(qId)) {
            existingIds.add(qId);
            toAdd.push({
              questionId: q._id || q.id,
              order: prev.questions.length + toAdd.length + 1,
              marks: Number(q.marks) || 10,
              title: q.title || "Uploaded Problem",
              difficulty: q.difficulty || "Medium",
            });
          }
        });

        if (toAdd.length > 0) {
          toast.success(`Directly added ${toAdd.length} uploaded question(s) to assessment!`, { icon: "✅" });
          return {
            ...prev,
            questions: [...prev.questions, ...toAdd],
          };
        }
        return prev;
      });
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({
      title: "",
      description: "",
      durationMinutes: 60,
      isActive: true,
      questions: [],
    });
    setModalOpen(true);
  };

  const openEditModal = (assessment) => {
    setEditingId(assessment._id);
    const mappedQuestions = (assessment.questions || []).map((q, idx) => ({
      questionId: q.questionId?._id || q.questionId,
      order: q.order || idx + 1,
      marks: q.marks || q.questionId?.marks || 10,
      title: q.questionId?.title || "Coding Problem",
      difficulty: q.questionId?.difficulty || "Medium",
    }));

    setFormData({
      title: assessment.title || "",
      description: assessment.description || "",
      durationMinutes: assessment.durationMinutes || 60,
      isActive: assessment.isActive ?? true,
      questions: mappedQuestions,
    });
    setModalOpen(true);
  };

  const handleToggleActive = async (id, currentStatus) => {
    try {
      const res = await api.patch(
        `/api/admin/coding/assessments/${id}/activate`,
        {},
        { headers }
      );
      if (res.data?.success) {
        toast.success(`Assessment ${res.data.data.isActive ? "activated" : "deactivated"}`);
        setAssessments((prev) =>
          prev.map((a) => (a._id === id ? { ...a, isActive: res.data.data.isActive } : a))
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to toggle status");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this assessment?")) return;
    try {
      const res = await api.delete(`/api/admin/coding/assessments/${id}`, { headers });
      if (res.data?.success) {
        toast.success("Assessment deleted successfully");
        setAssessments((prev) => prev.filter((a) => a._id !== id));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete assessment");
    }
  };

  // Add question to assessment selection
  const toggleSelectQuestion = (q) => {
    const exists = formData.questions.some((item) => item.questionId === q._id);
    if (exists) {
      setFormData((prev) => ({
        ...prev,
        questions: prev.questions
          .filter((item) => item.questionId !== q._id)
          .map((item, idx) => ({ ...item, order: idx + 1 })),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        questions: [
          ...prev.questions,
          {
            questionId: q._id,
            order: prev.questions.length + 1,
            marks: q.marks || 10,
            title: q.title,
            difficulty: q.difficulty,
          },
        ],
      }));
    }
  };

  const updateQuestionMarks = (questionId, newMarks) => {
    const val = parseInt(newMarks, 10) || 0;
    setFormData((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.questionId === questionId ? { ...q, marks: val } : q
      ),
    }));
  };

  const moveQuestionOrder = (index, direction) => {
    const updated = [...formData.questions];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= updated.length) return;
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    // re-assign orders
    const reordered = updated.map((item, idx) => ({ ...item, order: idx + 1 }));
    setFormData((prev) => ({ ...prev, questions: reordered }));
  };

  const totalCalculatedMarks = formData.questions.reduce(
    (sum, q) => sum + (parseInt(q.marks, 10) || 0),
    0
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      return toast.error("Please enter assessment title");
    }
    if (formData.questions.length === 0) {
      return toast.error("Please select at least 1 coding question");
    }

    setSaving(true);
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        durationMinutes: parseInt(formData.durationMinutes, 10) || 60,
        isActive: formData.isActive,
        questions: formData.questions.map((q) => ({
          questionId: q.questionId,
          order: q.order,
          marks: q.marks,
        })),
        totalMarks: totalCalculatedMarks,
      };

      if (editingId) {
        const res = await api.put(`/api/admin/coding/assessments/${editingId}`, payload, { headers });
        if (res.data?.success) {
          toast.success("Assessment updated successfully");
          setModalOpen(false);
          fetchData();
        }
      } else {
        const res = await api.post("/api/admin/coding/assessments", payload, { headers });
        if (res.data?.success) {
          toast.success("Assessment created successfully");
          setModalOpen(false);
          fetchData();
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save assessment");
    } finally {
      setSaving(false);
    }
  };

  const filteredAssessments = assessments.filter((a) =>
    a.title?.toLowerCase().includes(search.toLowerCase())
  );

  const categories = Array.from(new Set(questions.map((q) => q.category).filter(Boolean)));

  const filteredAvailableQuestions = questions.filter((q) => {
    const matchesSearch =
      q.title?.toLowerCase().includes(questionSearch.toLowerCase()) ||
      q.tags?.some((t) => t.toLowerCase().includes(questionSearch.toLowerCase()));
    const matchesCategory =
      categoryFilter === "all" || q.category?.toLowerCase() === categoryFilter.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" style={{ color: "var(--text-primary)" }}>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
            <Code2 className="w-7 h-7 text-indigo-500" />
            Coding Assessment Management
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Create structured coding rounds by picking verified questions from the Admin Question Bank
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs border transition cursor-pointer hover:opacity-90 shadow-xs"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          >
            <Upload className="w-4 h-4 text-indigo-500" />
            <span>Import Questions</span>
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-lg shadow-indigo-500/20 cursor-pointer transition hover:opacity-90"
            style={{ background: "var(--primary)" }}
          >
            <Plus className="w-4 h-4" />
            Create Assessment
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3">
        <div
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          <Search className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Search assessments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs focus:outline-none"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
      </div>

      {/* Assessments Table / Cards */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 rounded-2xl border animate-pulse"
              style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
            />
          ))}
        </div>
      ) : filteredAssessments.length === 0 ? (
        <div
          className="text-center py-16 px-4 rounded-3xl border"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          <Code2 className="w-12 h-12 mx-auto mb-3 opacity-30 text-indigo-500" />
          <h3 className="text-base font-bold">No Coding Assessments Found</h3>
          <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: "var(--text-muted)" }}>
            Create an assessment to bundle selected questions with duration and marks for students.
          </p>
          <button
            onClick={openCreateModal}
            className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-white inline-flex items-center gap-2 cursor-pointer"
            style={{ background: "var(--primary)" }}
          >
            <Plus className="w-3.5 h-3.5" />
            Create First Assessment
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAssessments.map((a) => (
            <motion.div
              key={a._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-2xl border transition-all hover:shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
              style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-base font-bold">{a.title}</h3>
                  <button
                    onClick={() => handleToggleActive(a._id, a.isActive)}
                    className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer border transition"
                    style={{
                      background: a.isActive ? "rgba(16,185,129,0.1)" : "rgba(148,163,184,0.1)",
                      color: a.isActive ? "#10b981" : "#94a3b8",
                      borderColor: a.isActive ? "rgba(16,185,129,0.3)" : "rgba(148,163,184,0.3)",
                    }}
                  >
                    {a.isActive ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Active
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 text-slate-400" /> Inactive
                      </>
                    )}
                  </button>
                </div>

                {a.description && (
                  <p className="text-xs line-clamp-1" style={{ color: "var(--text-muted)" }}>
                    {a.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: "var(--text-muted)" }}>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    {a.durationMinutes} mins
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                    {a.questions?.length || 0} Questions
                  </span>
                  <span className="flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    {a.totalMarks || 0} Total Marks
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => navigate(`/admin/coding-assessments/${a._id}/results`)}
                  className="px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition hover:opacity-80"
                  style={{
                    background: "rgba(99,102,241,0.08)",
                    borderColor: "rgba(99,102,241,0.25)",
                    color: "#6366f1",
                  }}
                >
                  <Users className="w-3.5 h-3.5" />
                  Candidate Results
                </button>
                <button
                  onClick={() => openEditModal(a)}
                  className="p-2 rounded-xl border text-xs font-semibold cursor-pointer hover:opacity-80"
                  style={{ background: "var(--input-bg)", borderColor: "var(--border)" }}
                  title="Edit"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(a._id)}
                  className="p-2 rounded-xl border text-xs font-semibold text-rose-500 cursor-pointer hover:opacity-80"
                  style={{
                    background: "rgba(244,63,94,0.06)",
                    borderColor: "rgba(244,63,94,0.2)",
                  }}
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT ASSESSMENT MODAL */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-4xl rounded-2xl border p-6 my-8 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl"
              style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--border)" }}>
                <div>
                  <h2 className="text-lg font-bold">
                    {editingId ? "Edit Coding Assessment" : "Create Coding Assessment"}
                  </h2>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Select questions from Admin Question Bank and assign marks
                  </p>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 rounded-lg hover:opacity-70 cursor-pointer"
                  style={{ color: "var(--text-muted)" }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold block mb-1">Assessment Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Software Engineer Coding Round - Phase 1"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      style={{
                        background: "var(--input-bg)",
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">Duration (Minutes) *</label>
                    <input
                      type="number"
                      required
                      min="5"
                      max="360"
                      value={formData.durationMinutes}
                      onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      style={{
                        background: "var(--input-bg)",
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold block mb-1">Instructions / Description</label>
                  <textarea
                    rows={2}
                    placeholder="Instructions for the candidates..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    style={{
                      background: "var(--input-bg)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>

                {/* Selected Questions Section */}
                <div className="border rounded-2xl p-4 space-y-4" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.02)" }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider">
                        Selected Questions ({formData.questions.length})
                      </h4>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        Set question sequence order and individual marks
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-indigo-500">
                        Total Marks: {totalCalculatedMarks}
                      </span>
                    </div>
                  </div>

                  {formData.questions.length === 0 ? (
                    <div className="text-center py-6 border border-dashed rounded-xl" style={{ borderColor: "var(--border)" }}>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        No questions selected yet. Pick questions from the list below.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {formData.questions.map((q, idx) => (
                        <div
                          key={q.questionId}
                          className="flex items-center justify-between p-3 rounded-xl border text-xs gap-3"
                          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] bg-indigo-500/10 text-indigo-500">
                              {idx + 1}
                            </span>
                            <div className="flex flex-col">
                              <span className="font-bold">{q.title}</span>
                              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                                {q.difficulty}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <label className="text-[11px] font-semibold text-slate-400">Marks:</label>
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={q.marks}
                                onChange={(e) => updateQuestionMarks(q.questionId, e.target.value)}
                                className="w-16 px-2 py-1 rounded text-center text-xs font-bold border"
                                style={{
                                  background: "var(--input-bg)",
                                  borderColor: "var(--border)",
                                }}
                              />
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => moveQuestionOrder(idx, -1)}
                                className="p-1 rounded hover:bg-slate-500/10 disabled:opacity-30 cursor-pointer"
                                title="Move Up"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                disabled={idx === formData.questions.length - 1}
                                onClick={() => moveQuestionOrder(idx, 1)}
                                className="p-1 rounded hover:bg-slate-500/10 disabled:opacity-30 cursor-pointer"
                                title="Move Down"
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleSelectQuestion({ _id: q.questionId })}
                                className="p-1 text-rose-500 hover:bg-rose-500/10 rounded cursor-pointer ml-1"
                                title="Remove"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Available Question Bank Picker */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider">
                        Pick Questions From Question Bank
                      </h4>
                      <button
                        type="button"
                        onClick={() => setIsImportOpen(true)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold text-indigo-400 border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 cursor-pointer transition"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Upload Questions</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="relative flex-1 sm:w-48">
                        <input
                          type="text"
                          placeholder="Search questions..."
                          value={questionSearch}
                          onChange={(e) => setQuestionSearch(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs border"
                          style={{
                            background: "var(--input-bg)",
                            borderColor: "var(--border)",
                          }}
                        />
                      </div>
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-2 py-1.5 rounded-lg text-xs border capitalize"
                        style={{
                          background: "var(--input-bg)",
                          borderColor: "var(--border)",
                        }}
                      >
                        <option value="all">All Categories</option>
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div
                    className="max-h-56 overflow-y-auto rounded-xl border p-2 space-y-1.5"
                    style={{ background: "var(--input-bg)", borderColor: "var(--border)" }}
                  >
                    {filteredAvailableQuestions.length === 0 ? (
                      <div className="py-8 text-center text-xs space-y-2" style={{ color: "var(--text-muted)" }}>
                        <p>No coding questions match your search or filter.</p>
                        <button
                          type="button"
                          onClick={() => setIsImportOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer shadow-sm transition"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Import Questions Now
                        </button>
                      </div>
                    ) : (
                      filteredAvailableQuestions.map((q) => {
                      const isSelected = formData.questions.some((item) => item.questionId === q._id);
                      return (
                        <div
                          key={q._id}
                          onClick={() => toggleSelectQuestion(q)}
                          className="flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition text-xs border"
                          style={{
                            background: isSelected ? "rgba(99,102,241,0.12)" : "var(--card-bg)",
                            borderColor: isSelected ? "rgba(99,102,241,0.4)" : "var(--border)",
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded text-indigo-500 cursor-pointer pointer-events-none"
                            />
                            <span className="font-semibold">{q.title}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400">
                              {q.category}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                q.difficulty === "Easy"
                                  ? "text-emerald-500 bg-emerald-500/10"
                                  : q.difficulty === "Medium"
                                  ? "text-amber-500 bg-amber-500/10"
                                  : "text-rose-500 bg-rose-500/10"
                              }`}
                            >
                              {q.difficulty}
                            </span>
                            <span className="text-[11px] font-bold text-slate-400">
                              {q.marks || 10} pts
                            </span>
                          </div>
                        </div>
                      );
                    }))}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer hover:opacity-80"
                    style={{ borderColor: "var(--border)" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 rounded-xl text-xs font-bold text-white shadow-md cursor-pointer transition hover:opacity-90 disabled:opacity-50"
                    style={{ background: "var(--primary)" }}
                  >
                    {saving ? "Saving..." : editingId ? "Save Changes" : "Create Assessment"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Import Questions Modal */}
      <CodingBulkImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
}
