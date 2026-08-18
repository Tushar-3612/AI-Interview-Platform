import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Save,
  X,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

const TOPICS = [
  "Programming & OOP",
  "Data Structures & Algorithms",
  "DBMS & SQL",
  "Operating Systems",
  "Computer Networks",
  "Software Engineering",
  "Web Development",
  "Cloud Computing",
  "Cyber Security",
  "Git & Version Control",
  "Company-specific Technologies",
  "Other",
];

const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const QUESTION_TYPES = ["Conceptual", "Scenario", "Project", "Code-tracing"];

const emptyQuestion = {
  companyId: "",
  companyName: "",
  topic: "Programming & OOP",
  subtopic: "",
  difficulty: "Medium",
  questionType: "Conceptual",
  question: "",
  expectedAnswer: "",
  explanation: "",
  marks: 1,
};

function AdminTechnicalManagement() {
  const token = getAuthToken();
  const headers = { Authorization: `Bearer ${token}` };

  const [questions, setQuestions] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyQuestion);
  const [filters, setFilters] = useState({ companyId: "", topic: "", difficulty: "" });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const loadData = async () => {
    setLoading(true);
    try {
      const [questionsRes, companiesRes, statsRes] = await Promise.all([
        api.get("/api/technical-questions", {
          headers,
          params: { ...filters, page, limit: 20 },
        }),
        api.get("/api/companies", { headers }).catch(() => ({ data: [] })),
        api.get("/api/technical-questions/stats", { headers }).catch(() => ({ data: null })),
      ]);

      setQuestions(questionsRes.data?.questions || []);
      setTotal(questionsRes.data?.total || 0);
      setCompanies(companiesRes.data?.companies || companiesRes.data || []);
      setStats(statsRes.data || null);
    } catch (error) {
      console.error("Load data error:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount and when filters/page change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);

  const handleSave = async () => {
    if (!form.companyId || !form.question || !form.expectedAnswer) {
      toast.error("Company, question, and expected answer are required");
      return;
    }

    try {
      if (editingId) {
        await api.put(`/api/technical-questions/${editingId}`, form, { headers });
        toast.success("Question updated");
      } else {
        await api.post("/api/technical-questions", form, { headers });
        toast.success("Question created");
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyQuestion);
      loadData();
    } catch (error) {
      console.error("Save error:", error);
      toast.error(error.response?.data?.message || "Failed to save question");
    }
  };

  const handleEdit = (question) => {
    setForm({
      companyId: question.companyId,
      companyName: question.companyName,
      topic: question.topic,
      subtopic: question.subtopic || "",
      difficulty: question.difficulty,
      questionType: question.questionType,
      question: question.question,
      expectedAnswer: question.expectedAnswer,
      explanation: question.explanation || "",
      marks: question.marks || 1,
    });
    setEditingId(question._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this question?")) return;

    try {
      await api.delete(`/api/technical-questions/${id}`, { headers });
      toast.success("Question deleted");
      loadData();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete question");
    }
  };

  const filteredQuestions = questions.filter((q) => {
    if (search && !q.question.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              Technical Question Bank
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Manage technical questions for company-specific mock interviews
            </p>
          </div>
          <button
            onClick={() => { setForm(emptyQuestion); setEditingId(null); setShowForm(true); }}
            className="px-4 py-2 rounded-xl font-bold text-white text-sm cursor-pointer flex items-center gap-2"
            style={{ background: "var(--primary)" }}
          >
            <Plus className="w-4 h-4" /> Add Question
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="student-card p-4">
              <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{stats.total || 0}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Total Questions</p>
            </div>
            <div className="student-card p-4">
              <p className="text-2xl font-bold text-green-500">{stats.active || 0}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Active</p>
            </div>
            <div className="student-card p-4">
              <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{stats.byCompany?.length || 0}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Companies</p>
            </div>
            <div className="student-card p-4">
              <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                {stats.usageStats?.reduce((acc, s) => acc + (s.totalUsage || 0), 0) || 0}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Total Usage</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="student-card p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Search questions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border text-sm outline-none"
                  style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                />
              </div>
            </div>
            <select
              value={filters.companyId}
              onChange={(e) => setFilters({ ...filters, companyId: e.target.value })}
              className="px-3 py-2 rounded-xl border text-sm outline-none"
              style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
            >
              <option value="">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={filters.topic}
              onChange={(e) => setFilters({ ...filters, topic: e.target.value })}
              className="px-3 py-2 rounded-xl border text-sm outline-none"
              style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
            >
              <option value="">All Topics</option>
              {TOPICS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={filters.difficulty}
              onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
              className="px-3 py-2 rounded-xl border text-sm outline-none"
              style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
            >
              <option value="">All Difficulties</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Questions List */}
        {loading ? (
          <div className="text-center py-12">
            <p style={{ color: "var(--text-muted)" }}>Loading...</p>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="text-center py-12 student-card">
            <p style={{ color: "var(--text-muted)" }}>No questions found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQuestions.map((q) => (
              <div key={q._id} className="student-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-500">
                        {q.companyName}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-500">
                        {q.topic}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-500/10 text-gray-500">
                        {q.difficulty}
                      </span>
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {q.questionId}
                      </span>
                    </div>
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {q.question}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      Used by {q.usageCount || 0} students
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(q)}
                      className="p-2 rounded-lg hover:bg-[var(--bg-primary)] cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
                    </button>
                    <button
                      onClick={() => handleDelete(q._id)}
                      className="p-2 rounded-lg hover:bg-red-500/10 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > 20 && (
          <div className="flex justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl border text-sm cursor-pointer disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Previous
            </button>
            <span className="px-4 py-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              Page {page} of {Math.ceil(total / 20)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(total / 20)}
              className="px-4 py-2 rounded-xl border text-sm cursor-pointer disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Next
            </button>
          </div>
        )}
      </motion.div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-2xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  {editingId ? "Edit Question" : "Add Question"}
                </h2>
                <button onClick={() => setShowForm(false)} className="p-1 cursor-pointer">
                  <X className="w-5 h-5" style={{ color: "var(--text-secondary)" }} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Company *</label>
                    <select
                      value={form.companyId}
                      onChange={(e) => {
                        const company = companies.find((c) => c.id === e.target.value);
                        setForm({ ...form, companyId: e.target.value, companyName: company?.name || "" });
                      }}
                      className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                    >
                      <option value="">Select Company</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Topic *</label>
                    <select
                      value={form.topic}
                      onChange={(e) => setForm({ ...form, topic: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                    >
                      {TOPICS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Difficulty</label>
                    <select
                      value={form.difficulty}
                      onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                    >
                      {DIFFICULTIES.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Question Type</label>
                    <select
                      value={form.questionType}
                      onChange={(e) => setForm({ ...form, questionType: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                    >
                      {QUESTION_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Marks</label>
                    <input
                      type="number"
                      value={form.marks}
                      onChange={(e) => setForm({ ...form, marks: Number(e.target.value) })}
                      min={1}
                      className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Subtopic</label>
                  <input
                    type="text"
                    value={form.subtopic}
                    onChange={(e) => setForm({ ...form, subtopic: e.target.value })}
                    placeholder="e.g., Inheritance, SQL Joins"
                    className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Question *</label>
                  <textarea
                    value={form.question}
                    onChange={(e) => setForm({ ...form, question: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl border text-sm outline-none resize-none"
                    style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Expected Answer / Key Points *</label>
                  <textarea
                    value={form.expectedAnswer}
                    onChange={(e) => setForm({ ...form, expectedAnswer: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 rounded-xl border text-sm outline-none resize-none"
                    style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Explanation</label>
                  <textarea
                    value={form.explanation}
                    onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl border text-sm outline-none resize-none"
                    style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-xl border text-sm font-semibold cursor-pointer"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white cursor-pointer flex items-center gap-2"
                  style={{ background: "var(--primary)" }}
                >
                  <Save className="w-4 h-4" /> {editingId ? "Update" : "Create"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AdminTechnicalManagement;
