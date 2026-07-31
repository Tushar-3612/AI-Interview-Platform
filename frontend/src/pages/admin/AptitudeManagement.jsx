import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, BrainCircuit, Search, X, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Archive, RotateCcw, Upload, Tags, CheckSquare, Square } from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";
import { SkeletonCard, ErrorState } from "../../components/ui/Skeleton";

const DIFFICULTIES = ["easy", "medium", "hard"];
const DIFF_LABELS = { easy: "Easy", medium: "Medium", hard: "Hard" };
const DIFF_COLORS = { easy: "#22c55e", medium: "#eab308", hard: "#ef4444" };

function AptitudeManagement() {
  const token = getAuthToken();
  const headers = { Authorization: `Bearer ${token}` };

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expandId, setExpandId] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [selected, setSelected] = useState([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [assignForm, setAssignForm] = useState({ companyId: "", difficulty: "", category: "", marks: "", explanation: "" });

  const [trash, setTrash] = useState([]);
  const [showTrash, setShowTrash] = useState(false);
  const [trashLoading, setTrashLoading] = useState(false);

  const emptyForm = { category: "General", question: "", options: ["", "", "", ""], correctAnswer: "", difficulty: "medium", explanation: "", marks: 1, companyId: "", companyName: "" };
  const [form, setForm] = useState(emptyForm);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [qRes, cRes] = await Promise.all([
        api.get("/api/aptitude", { headers, params: { limit: 500 } }),
        api.get("/api/companies", { headers }),
      ]);
      setQuestions(qRes.data?.questions || qRes.data || []);
      setCompanies(cRes.data || []);
    } catch { setError(true); toast.error("Failed to load data"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchTrash = async () => {
    setTrashLoading(true);
    try {
      const res = await api.get("/api/aptitude/trash", { headers });
      setTrash(res.data?.questions || []);
    } catch { toast.error("Failed to load trash"); }
    finally { setTrashLoading(false); }
  };

  const toggleTrash = () => {
    setShowTrash((s) => !s);
    if (!showTrash && trash.length === 0) fetchTrash();
  };

  const openAdd = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };

  const openEdit = (q) => {
    setEditing(q);
    setForm({
      category: q.category || "General", question: q.question || "",
      options: q.options?.length === 4 ? [...q.options] : ["", "", "", ""],
      correctAnswer: q.correctAnswer || "", difficulty: q.difficulty || "medium",
      explanation: q.explanation || "", marks: q.marks || 1,
      companyId: q.companyId || "", companyName: q.companyName || "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.question || !form.correctAnswer) { toast.error("Question and answer are required"); return; }
    try {
      if (editing) {
        await api.put(`/api/aptitude/${editing._id}`, form, { headers });
        toast.success("Question updated");
      } else {
        await api.post("/api/aptitude", form, { headers });
        toast.success("Question created");
      }
      setModalOpen(false);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || "Failed to save"); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Move this aptitude question to trash?")) return;
    try { await api.delete(`/api/aptitude/${id}`, { headers }); toast.success("Question moved to trash"); fetchData(); }
    catch { toast.error("Failed to delete"); }
  };

  const handleBulkDelete = async () => {
    if (selected.length === 0 || !window.confirm(`Move ${selected.length} questions to trash?`)) return;
    try {
      await api.post("/api/aptitude/bulk-delete", { ids: selected }, { headers });
      toast.success(`${selected.length} questions moved to trash`);
      setSelected([]); fetchData();
    } catch { toast.error("Bulk delete failed"); }
  };

  const handleRestore = async (id) => {
    try { await api.post(`/api/aptitude/${id}/restore`, {}, { headers }); toast.success("Question restored"); fetchTrash(); fetchData(); }
    catch { toast.error("Restore failed"); }
  };

  const handleBulkRestore = async () => {
    const ids = selected.length > 0 ? selected : trash.map((q) => q._id);
    if (ids.length === 0) return;
    try { await api.post("/api/aptitude/bulk-restore", { ids }, { headers }); toast.success(`Restored ${ids.length} questions`); setSelected([]); fetchTrash(); fetchData(); }
    catch { toast.error("Restore failed"); }
  };

  const handleHardDelete = async (id) => {
    if (!window.confirm("Permanently delete this question? This cannot be undone.")) return;
    try { await api.delete(`/api/aptitude/${id}/hard`, { headers }); toast.success("Question permanently deleted"); fetchTrash(); }
    catch { toast.error("Permanent delete failed"); }
  };

  const handleBulkHardDelete = async () => {
    const ids = selected.length > 0 ? selected : trash.map((q) => q._id);
    if (ids.length === 0) return;
    if (!window.confirm(`Permanently delete ${ids.length} questions? This cannot be undone.`)) return;
    try { await api.post("/api/aptitude/bulk-hard-delete", { ids }, { headers }); toast.success(`Permanently deleted ${ids.length} questions`); setSelected([]); fetchTrash(); fetchData(); }
    catch { toast.error("Permanent delete failed"); }
  };

  const handleAssign = async () => {
    if (selected.length === 0) return;
    const patch = { ids: selected };
    if (assignForm.companyId) patch.companyId = assignForm.companyId;
    if (assignForm.difficulty) patch.difficulty = assignForm.difficulty;
    if (assignForm.category) patch.category = assignForm.category;
    if (assignForm.marks) patch.marks = parseInt(assignForm.marks);
    if (assignForm.explanation) patch.explanation = assignForm.explanation;
    try {
      await api.post("/api/aptitude/bulk-assign", patch, { headers });
      toast.success(`Assigned to ${selected.length} questions`);
      setAssignOpen(false); setSelected([]); setAssignForm({ companyId: "", difficulty: "", category: "", marks: "", explanation: "" }); fetchData();
    } catch (err) { toast.error(err.response?.data?.message || "Bulk assign failed"); }
  };

  const handleImport = async () => {
    try {
      const parsed = JSON.parse(importText);
      if (!Array.isArray(parsed) || parsed.length === 0) { toast.error("Provide a JSON array of questions"); return; }
      const res = await api.post("/api/aptitude/bulk-import", { questions: parsed }, { headers });
      toast.success(res.data?.message || "Import complete");
      setImportOpen(false); setImportText(""); fetchData();
    } catch { toast.error("Invalid JSON. Provide an array of question objects."); }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleActive = async (id) => {
    try { await api.patch(`/api/aptitude/${id}/toggle`, {}, { headers }); fetchData(); }
    catch { toast.error("Failed to toggle"); }
  };

  const categories = [...new Set(questions.map((q) => q.category).filter(Boolean))].sort();

  const filtered = questions.filter((q) => {
    const matchSearch = q.question.toLowerCase().includes(searchTerm.toLowerCase()) || q.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDiff = !difficultyFilter || q.difficulty === difficultyFilter;
    const matchCompany = !companyFilter || q.companyId === companyFilter;
    const matchCategory = !categoryFilter || q.category === categoryFilter;
    return matchSearch && matchDiff && matchCompany && matchCategory;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Aptitude Questions</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Manage aptitude question bank · {questions.length} questions</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }}>
              <span className="text-xs font-semibold" style={{ color: "var(--primary)" }}>{selected.length} selected</span>
              <button type="button" onClick={() => setAssignOpen(true)} className="flex items-center gap-1 text-xs font-semibold cursor-pointer hover:opacity-80" style={{ color: "var(--primary)" }}>
                <Tags className="w-3.5 h-3.5" /> Assign
              </button>
              <button type="button" onClick={handleBulkDelete} className="text-xs font-semibold cursor-pointer hover:opacity-80" style={{ color: "#ef4444" }}>Delete</button>
              <button type="button" onClick={() => setSelected([])} className="text-xs font-semibold cursor-pointer hover:opacity-80" style={{ color: "var(--text-muted)" }}>Clear</button>
            </div>
          )}
          <button type="button" onClick={() => setImportOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            <Upload className="w-4 h-4" /> Import
          </button>
          <button type="button" onClick={toggleTrash} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            <Archive className="w-4 h-4" /> Trash {trash.length > 0 && !showTrash ? `(${trash.length})` : ""}
          </button>
          <button type="button" onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white cursor-pointer" style={{ background: "var(--primary)" }}>
            <Plus className="w-4 h-4" /> Add Question
          </button>
        </div>
      </div>

      {showTrash && (
        <div className="border rounded-2xl p-5 mb-4" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Trash (soft-deleted questions)</h3>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Auto-purged after 30 days.</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleBulkRestore} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer" style={{ background: "color-mix(in srgb, var(--success) 12%, transparent)", color: "var(--success)" }}>
                <RotateCcw className="w-3 h-3" /> Restore All
              </button>
              <button type="button" onClick={handleBulkHardDelete} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                <Trash2 className="w-3 h-3" /> Delete Forever All
              </button>
              <button type="button" onClick={toggleTrash} className="text-xs font-semibold cursor-pointer" style={{ color: "var(--primary)" }}>Close</button>
            </div>
          </div>
          {trashLoading ? (
            <SkeletonCard />
          ) : trash.length === 0 ? (
            <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>Trash is empty.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {trash.map((q) => (
                <div key={q._id} className="flex items-center justify-between gap-3 border rounded-xl px-3 py-2" style={{ borderColor: "var(--border)" }}>
                  <p className="text-xs truncate flex-1" style={{ color: "var(--text-primary)" }}>{q.question}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded shrink-0" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>Trashed</span>
                  <div className="flex gap-1.5 shrink-0">
                    <button type="button" onClick={() => handleRestore(q._id)} className="p-1.5 rounded-lg cursor-pointer hover:opacity-70" style={{ color: "var(--success)" }} title="Restore"><RotateCcw className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => handleHardDelete(q._id)} className="p-1.5 rounded-lg cursor-pointer hover:opacity-70" style={{ color: "#ef4444" }} title="Delete forever"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search questions..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none"
            style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
        </div>
        <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border text-sm outline-none cursor-pointer"
          style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}>
          <option value="">All Difficulties</option>
          {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFF_LABELS[d]}</option>)}
        </select>
        <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border text-sm outline-none cursor-pointer"
          style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}>
          <option value="">All Companies</option>
          {companies.map((c) => <option key={c._id || c.id} value={c.id || c._id}>{c.name}</option>)}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border text-sm outline-none cursor-pointer"
          style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : error ? (
        <ErrorState message="Could not load aptitude questions." onRetry={fetchData} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <BrainCircuit className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>No Aptitude Questions</h2>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>Click "Add Question" to create the first question, or import a batch.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => {
            const isExpanded = expandId === q._id;
            const isSelected = selected.includes(q._id);
            return (
              <div key={q._id} className="student-card p-5" style={{ opacity: q.isActive === false ? 0.5 : 1, borderColor: isSelected ? "var(--primary)" : undefined }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <button type="button" onClick={() => toggleSelect(q._id)} className="mt-0.5 shrink-0 cursor-pointer" title={isSelected ? "Deselect" : "Select"}>
                      {isSelected ? <CheckSquare className="w-4 h-4" style={{ color: "var(--primary)" }} /> : <Square className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}
                    </button>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${DIFF_COLORS[q.difficulty]}15` }}>
                      <BrainCircuit className="w-5 h-5" style={{ color: DIFF_COLORS[q.difficulty] }} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium line-clamp-1" style={{ color: "var(--text-primary)" }}>{q.question}</p>
                        {q.isActive === false && <span className="text-xs px-1.5 py-0.5 rounded shrink-0" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>Disabled</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: `${DIFF_COLORS[q.difficulty]}15`, color: DIFF_COLORS[q.difficulty] }}>
                          {DIFF_LABELS[q.difficulty]}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>{q.category}</span>
                        {q.companyName && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{q.companyName}</span>}
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{q.questionId}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => toggleActive(q._id)} className="p-2 rounded-lg border cursor-pointer hover:bg-neutral-800 transition" style={{ borderColor: "var(--border)", color: q.isActive !== false ? "#22c55e" : "var(--text-muted)" }}>
                      {q.isActive !== false ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button type="button" onClick={() => setExpandId(isExpanded ? null : q._id)} className="p-2 rounded-lg border cursor-pointer hover:bg-neutral-800 transition" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button type="button" onClick={() => openEdit(q)} className="p-2 rounded-lg border cursor-pointer hover:bg-neutral-800 transition" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => handleDelete(q._id)} className="p-2 rounded-lg border cursor-pointer hover:bg-red-500/10 transition" style={{ borderColor: "var(--border)", color: "#ef4444" }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
                    <p className="text-sm" style={{ color: "var(--text-primary)" }}>{q.question}</p>
                    <div className="space-y-1">
                      {q.options.map((opt, idx) => (
                        <div key={idx} className={`px-3 py-1.5 rounded-lg border text-xs ${opt === q.correctAnswer ? "border-green-500 text-green-500" : ""}`}
                          style={{ background: opt === q.correctAnswer ? "rgba(34,197,94,0.08)" : "var(--input-bg)", borderColor: opt === q.correctAnswer ? "#22c55e" : "var(--border)" }}>
                          {opt} {opt === q.correctAnswer && "(Correct)"}
                        </div>
                      ))}
                    </div>
                    {q.explanation && <p className="text-xs p-2 rounded" style={{ background: "var(--input-bg)", color: "var(--text-secondary)" }}>Explanation: {q.explanation}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {modalOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModalOpen(false)} className="fixed inset-0 z-50 backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.5)" }} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-4 sm:inset-20 z-50 overflow-y-auto rounded-2xl border p-6 sm:p-8"
              style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{editing ? "Edit Aptitude Question" : "Add Aptitude Question"}</h2>
                <button type="button" onClick={() => setModalOpen(false)} className="p-2 rounded-lg border cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Question *</label>
                  <textarea value={form.question} onChange={(e) => setForm((prev) => ({ ...prev, question: e.target.value }))} rows={3} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none resize-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Category</label>
                    <input value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Difficulty</label>
                    <select value={form.difficulty} onChange={(e) => setForm((prev) => ({ ...prev, difficulty: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}>
                      {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFF_LABELS[d]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Marks</label>
                    <input type="number" value={form.marks} onChange={(e) => setForm((prev) => ({ ...prev, marks: parseInt(e.target.value) || 1 }))} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Company</label>
                  <select value={form.companyId} onChange={(e) => { const c = companies.find((co) => co.id === e.target.value || co._id === e.target.value); setForm((prev) => ({ ...prev, companyId: e.target.value, companyName: c?.name || "" })); }}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}>
                    <option value="">None</option>
                    {companies.map((c) => <option key={c._id || c.id} value={c.id || c._id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Options *</label>
                  {form.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold w-6" style={{ color: "var(--text-muted)" }}>{String.fromCharCode(65 + idx)}.</span>
                      <input value={opt} onChange={(e) => {
                        const newOpts = [...form.options];
                        newOpts[idx] = e.target.value;
                        setForm((prev) => ({ ...prev, options: newOpts }));
                      }} className="flex-1 px-4 py-2 rounded-xl border text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
                      <input type="radio" name="correctAnswer" checked={form.correctAnswer === opt} onChange={() => setForm((prev) => ({ ...prev, correctAnswer: opt }))} />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Explanation</label>
                  <textarea value={form.explanation} onChange={(e) => setForm((prev) => ({ ...prev, explanation: e.target.value }))} rows={2} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none resize-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t" style={{ borderColor: "var(--border)" }}>
                <button type="button" onClick={() => setModalOpen(false)} className="px-6 py-2.5 rounded-xl border text-sm font-semibold cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
                <button type="button" onClick={handleSave} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer" style={{ background: "var(--primary)" }}>{editing ? "Update" : "Create"}</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bulk Assign Modal */}
      <AnimatePresence>
        {assignOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAssignOpen(false)} className="fixed inset-0 z-50 backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.5)" }} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-8 sm:inset-32 z-50 overflow-y-auto rounded-2xl border p-6 sm:p-8"
              style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Assign to {selected.length} selected questions</h2>
                <button type="button" onClick={() => setAssignOpen(false)} className="p-2 rounded-lg border cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}><X className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Company</label>
                  <select value={assignForm.companyId} onChange={(e) => setAssignForm((prev) => ({ ...prev, companyId: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}>
                    <option value="">Leave unchanged</option>
                    {companies.map((c) => <option key={c._id || c.id} value={c.id || c._id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Difficulty</label>
                  <select value={assignForm.difficulty} onChange={(e) => setAssignForm((prev) => ({ ...prev, difficulty: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}>
                    <option value="">Leave unchanged</option>
                    {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFF_LABELS[d]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Category</label>
                  <input value={assignForm.category} onChange={(e) => setAssignForm((prev) => ({ ...prev, category: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Marks</label>
                  <input type="number" value={assignForm.marks} onChange={(e) => setAssignForm((prev) => ({ ...prev, marks: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
                </div>
              </div>
              <div className="mt-4">
                <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Explanation</label>
                <textarea value={assignForm.explanation} onChange={(e) => setAssignForm((prev) => ({ ...prev, explanation: e.target.value }))} rows={2} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
              </div>
              <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t" style={{ borderColor: "var(--border)" }}>
                <button type="button" onClick={() => setAssignOpen(false)} className="px-6 py-2.5 rounded-xl border text-sm font-semibold cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
                <button type="button" onClick={handleAssign} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer" style={{ background: "var(--primary)" }}>Apply to Selection</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Import Modal */}
      <AnimatePresence>
        {importOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setImportOpen(false)} className="fixed inset-0 z-50 backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.5)" }} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-8 sm:inset-24 z-50 overflow-y-auto rounded-2xl border p-6 sm:p-8"
              style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Bulk Import Questions</h2>
                <button type="button" onClick={() => setImportOpen(false)} className="p-2 rounded-lg border cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}><X className="w-5 h-5" /></button>
              </div>
              <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                Paste a JSON array of questions. Fields: <code>question</code>, <code>options</code> (array of 4), <code>answer</code>, <code>category</code>, <code>difficulty</code> (easy/medium/hard), <code>explanation</code>, <code>marks</code>, <code>companyId</code>.
              </p>
              <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={12}
                className="w-full px-4 py-3 rounded-xl border text-xs font-mono outline-none"
                placeholder='[{"question": "What is 2+2?", "options": ["2", "3", "4", "5"], "answer": "4", "category": "Quantitative", "difficulty": "easy", "explanation": "2 plus 2 equals 4", "marks": 1}]'
                style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
              <div className="flex items-center justify-end gap-3 pt-4">
                <button type="button" onClick={() => setImportOpen(false)} className="px-6 py-2.5 rounded-xl border text-sm font-semibold cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
                <button type="button" onClick={handleImport} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer" style={{ background: "var(--primary)" }}>Import</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AptitudeManagement;
