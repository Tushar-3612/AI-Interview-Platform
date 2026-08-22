import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, Code, Search, X, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Archive, RotateCcw, RefreshCw } from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";
// Replace line 7 with:
import { SkeletonCompanyCard as SkeletonCard, ErrorState } from "../../components/ui/Skeleton";

const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const LANGUAGES = ["JavaScript", "Python", "Java", "C++", "Go", "Rust"];

function CodingQuestionManagement() {
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

  const [trash, setTrash] = useState([]);
  const [showTrash, setShowTrash] = useState(false);
  const [trashLoading, setTrashLoading] = useState(false);
  const [sourceInfo, setSourceInfo] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");

  const emptyForm = {
    title: "", difficulty: "Medium", category: "", problemStatement: "", description: "",
    inputFormat: "", outputFormat: "", constraints: "", sampleInput: "", sampleOutput: "",
    explanation: "", starterCode: "function solution() {\n  // Write your code here\n}",
    testCases: [{ input: "", expected: "", isHidden: false }],
    languages: ["JavaScript"], tags: [], companyId: "", companyName: "", marks: 10,
    timeLimit: 1000, memoryLimit: 256,
  };

  const [form, setForm] = useState(emptyForm);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [qRes, cRes] = await Promise.all([
        api.get("/api/coding-questions", { headers, params: { limit: 200 } }),
        api.get("/api/companies", { headers }),
      ]);
      const list = qRes.data?.questions || qRes.data || [];
      setQuestions(list);
      setCompanies(cRes.data || []);
    } catch {
      setError(true);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    api.get("/api/coding-questions/source-files", { headers })
      .then((res) => setSourceInfo(res.data))
      .catch(() => setSourceInfo(null));
  }, []);

  const handleSyncFromJson = async () => {
    setSyncing(true);
    try {
      const res = await api.post("/api/coding-questions/sync-from-json", {}, { headers });
      toast.success(res.data?.message || "Sync complete");
      if (res.data?.sources) {
        const res2 = await api.get("/api/coding-questions/source-files", { headers });
        setSourceInfo(res2.data);
      }
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const fetchTrash = async () => {
    setTrashLoading(true);
    try {
      const res = await api.get("/api/coding-questions/trash", { headers });
      setTrash(res.data?.questions || []);
    } catch { toast.error("Failed to load trash"); }
    finally { setTrashLoading(false); }
  };

  const toggleTrash = () => {
    setShowTrash((s) => !s);
    if (!showTrash && trash.length === 0) fetchTrash();
  };

  const handleRestore = async (id) => {
    try { await api.post(`/api/coding-questions/${id}/restore`, {}, { headers }); toast.success("Question restored"); fetchTrash(); fetchData(); }
    catch { toast.error("Restore failed"); }
  };

  const handleHardDelete = async (id) => {
    if (!window.confirm("Permanently delete this question? This cannot be undone.")) return;
    try { await api.delete(`/api/coding-questions/${id}/hard`, { headers }); toast.success("Question permanently deleted"); fetchTrash(); }
    catch { toast.error("Permanent delete failed"); }
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (q) => {
    setEditing(q);
    setForm({
      title: q.title || "", difficulty: q.difficulty || "Medium", category: q.category || "",
      problemStatement: q.problemStatement || "", description: q.description || "",
      inputFormat: q.inputFormat || "", outputFormat: q.outputFormat || "",
      constraints: q.constraints || "", sampleInput: q.sampleInput || "",
      sampleOutput: q.sampleOutput || "", explanation: q.explanation || "",
      starterCode: q.starterCode || emptyForm.starterCode,
      testCases: Array.isArray(q.testCases) && q.testCases.length > 0 ? q.testCases.map((tc) => ({ input: tc.input, expected: tc.expected, isHidden: tc.isHidden || false })) : emptyForm.testCases,
      languages: Array.isArray(q.languages) && q.languages.length > 0 ? q.languages : ["JavaScript"],
      tags: Array.isArray(q.tags) ? q.tags : [], companyId: q.companyId || "", companyName: q.companyName || "",
      marks: q.marks || 10, timeLimit: q.timeLimit || 1000, memoryLimit: q.memoryLimit || 256,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.problemStatement) {
      toast.error("Title and problem statement are required"); return;
    }
    try {
      if (editing) {
        await api.put(`/api/coding-questions/${editing._id}`, form, { headers });
        toast.success("Question updated");
      } else {
        await api.post("/api/coding-questions", form, { headers });
        toast.success("Question created");
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Move this coding question to trash?")) return;
    try {
      await api.delete(`/api/coding-questions/${id}`, { headers });
      toast.success("Question moved to trash");
      fetchData();
    } catch { toast.error("Failed to delete"); }
  };

  const toggleActive = async (id) => {
    try {
      await api.patch(`/api/coding-questions/${id}/toggle`, {}, { headers });
      fetchData();
    } catch { toast.error("Failed to toggle"); }
  };

  const addTestCase = () => setForm((prev) => ({ ...prev, testCases: [...(Array.isArray(prev.testCases) ? prev.testCases : []), { input: "", expected: "", isHidden: false }] }));
  const removeTestCase = (idx) => setForm((prev) => ({ ...prev, testCases: (Array.isArray(prev.testCases) ? prev.testCases : []).filter((_, i) => i !== idx) }));
  const updateTestCase = (idx, field, value) => setForm((prev) => {
    const testCases = Array.isArray(prev.testCases) ? prev.testCases : [];
    const updated = [...testCases];
    updated[idx] = { ...updated[idx], [field]: value };
    return { ...prev, testCases: updated };
  });

  const addTag = (tag) => { if (tag && Array.isArray(form.tags) && !form.tags.includes(tag)) setForm((prev) => ({ ...prev, tags: [...(Array.isArray(prev.tags) ? prev.tags : []), tag] })); };
  const removeTag = (tag) => setForm((prev) => ({ ...prev, tags: (Array.isArray(prev.tags) ? prev.tags : []).filter((t) => t !== tag) }));
  const [tagInput, setTagInput] = useState("");

  const filtered = questions.filter((q) => {
    const matchSearch = q.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDiff = !difficultyFilter || q.difficulty === difficultyFilter;
    const matchCompany = !companyFilter || q.companyId === companyFilter;
    const matchCategory = !categoryFilter || q.category === categoryFilter;
    return matchSearch && matchDiff && matchCompany && matchCategory;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Coding Questions</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Manage coding problems and test cases · {questions.length} questions</p>
          {sourceInfo && (
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Source: <code className="font-mono">backend/data/coding/</code> · {sourceInfo.sources?.length || 0} file(s) · {sourceInfo.total || 0} questions in JSON
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleSyncFromJson} disabled={syncing} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", opacity: syncing ? 0.6 : 1 }}>
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Syncing..." : "Sync from JSON"}
          </button>
          <button type="button" onClick={toggleTrash} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            <Archive className="w-4 h-4" /> Trash {trash.length > 0 && !showTrash ? `(${trash.length})` : ""}
          </button>
          <button type="button" onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer" style={{ background: "var(--primary)" }}>
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
            <button type="button" onClick={toggleTrash} className="text-xs font-semibold cursor-pointer" style={{ color: "var(--primary)" }}>Close</button>
          </div>
          {trashLoading ? (
            <SkeletonCard />
          ) : trash.length === 0 ? (
            <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>Trash is empty.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {trash.map((q) => (
                <div key={q._id} className="flex items-center justify-between gap-3 border rounded-xl px-3 py-2" style={{ borderColor: "var(--border)" }}>
                  <p className="text-xs truncate flex-1" style={{ color: "var(--text-primary)" }}>{q.title}</p>
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
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by title..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none"
            style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
        </div>
        <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border text-sm outline-none cursor-pointer"
          style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}>
          <option value="">All Difficulties</option>
          {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
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
          {[...new Set(questions.map((q) => q.category).filter(Boolean))].map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : error ? (
        <ErrorState message="Could not load coding questions." onRetry={fetchData} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Code className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>No Coding Questions</h2>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>Click "Add Question" to create the first coding problem.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => {
            const isExpanded = expandId === q._id;
            const diffColor = q.difficulty === "Easy" ? "#22c55e" : q.difficulty === "Medium" ? "#eab308" : "#ef4444";
            return (
              <div key={q._id} className="student-card p-5" style={{ opacity: q.isActive ? 1 : 0.5 }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${diffColor}15` }}>
                      <Code className="w-5 h-5" style={{ color: diffColor }} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>{q.title}</h3>
                        {!q.isActive && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>Disabled</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: `${diffColor}15`, color: diffColor }}>{q.difficulty}</span>
                        {q.category && <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(168,85,247,0.1)", color: "#a855f7" }}>{q.category}</span>}
                        {q.companyName && <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>{q.companyName}</span>}
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{q.testCases?.length || 0} test cases</span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{q.marks || 10} marks</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => toggleActive(q._id)} className="p-2 rounded-lg border cursor-pointer hover:bg-neutral-800 transition" style={{ borderColor: "var(--border)", color: q.isActive ? "#22c55e" : "var(--text-muted)" }}>
                      {q.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
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
                  <div className="mt-4 pt-4 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
                    <p className="text-sm whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>{q.problemStatement}</p>
                     {Array.isArray(q.testCases) && q.testCases.length > 0 && (
                       <div>
                         <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Test Cases:</p>
                         <div className="space-y-1.5">
                           {q.testCases.map((tc, idx) => (
                            <div key={idx} className="text-xs font-mono p-2 rounded-lg" style={{ background: "var(--input-bg)", color: "var(--text-secondary)" }}>
                              <span className="text-neutral-400">#{idx + 1}{tc.isHidden ? " (Hidden)" : " (Sample)"}: </span>
                              Input: {tc.input} → Expected: {tc.expected}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {Array.isArray(q.tags) && q.tags.map((tag, idx) => <span key={idx} className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>{tag}</span>)}
                      {Array.isArray(q.languages) && q.languages.map((lang, idx) => <span key={idx} className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>{lang}</span>)}
                    </div>
                    <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
                      <span>Time: {q.timeLimit || 1000}ms</span>
                      <span>Memory: {q.memoryLimit || 256}MB</span>
                    </div>
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
              className="fixed inset-4 sm:inset-10 z-50 overflow-y-auto rounded-2xl border p-6 sm:p-8"
              style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{editing ? "Edit Coding Question" : "Add Coding Question"}</h2>
                <button type="button" onClick={() => setModalOpen(false)} className="p-2 rounded-lg border cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Title *</label>
                    <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Difficulty</label>
                    <select value={form.difficulty} onChange={(e) => setForm((prev) => ({ ...prev, difficulty: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}>
                      {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Category</label>
                    <input value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} placeholder="e.g. Arrays, Strings, Dynamic Programming" className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
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
                    <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Marks</label>
                    <input type="number" value={form.marks} onChange={(e) => setForm((prev) => ({ ...prev, marks: parseInt(e.target.value) || 0 }))} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Time Limit (ms)</label>
                      <input type="number" value={form.timeLimit} onChange={(e) => setForm((prev) => ({ ...prev, timeLimit: parseInt(e.target.value) || 1000 }))} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Memory Limit (MB)</label>
                      <input type="number" value={form.memoryLimit} onChange={(e) => setForm((prev) => ({ ...prev, memoryLimit: parseInt(e.target.value) || 256 }))} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Tags</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(Array.isArray(form.tags) ? form.tags : []).map((tag) => (
                        <span key={tag} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded cursor-pointer" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }} onClick={() => removeTag(tag)}>
                          {tag} <X className="w-3 h-3" />
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput.trim()); setTagInput(""); } }} placeholder="Add tag..." className="flex-1 px-4 py-2 rounded-xl border text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
                      <button type="button" onClick={() => { addTag(tagInput.trim()); setTagInput(""); }} className="px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>Add</button>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Problem Statement *</label>
                    <textarea value={form.problemStatement} onChange={(e) => setForm((prev) => ({ ...prev, problemStatement: e.target.value }))} rows={4} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none resize-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Description</label>
                    <textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} rows={2} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none resize-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Input Format</label>
                      <textarea value={form.inputFormat} onChange={(e) => setForm((prev) => ({ ...prev, inputFormat: e.target.value }))} rows={2} className="w-full px-4 py-2 rounded-xl border text-sm outline-none resize-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Output Format</label>
                      <textarea value={form.outputFormat} onChange={(e) => setForm((prev) => ({ ...prev, outputFormat: e.target.value }))} rows={2} className="w-full px-4 py-2 rounded-xl border text-sm outline-none resize-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Constraints</label>
                    <textarea value={form.constraints} onChange={(e) => setForm((prev) => ({ ...prev, constraints: e.target.value }))} rows={2} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none resize-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Sample Input</label>
                      <textarea value={form.sampleInput} onChange={(e) => setForm((prev) => ({ ...prev, sampleInput: e.target.value }))} rows={2} className="w-full px-4 py-2 rounded-xl border text-sm outline-none resize-none font-mono" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Sample Output</label>
                      <textarea value={form.sampleOutput} onChange={(e) => setForm((prev) => ({ ...prev, sampleOutput: e.target.value }))} rows={2} className="w-full px-4 py-2 rounded-xl border text-sm outline-none resize-none font-mono" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-primary)" }}>Explanation</label>
                    <textarea value={form.explanation} onChange={(e) => setForm((prev) => ({ ...prev, explanation: e.target.value }))} rows={2} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none resize-none" style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }} />
                  </div>
                </div>
              </div>
              <div className="mb-6">
                <label className="text-xs font-semibold mb-2 block" style={{ color: "var(--text-primary)" }}>Starter Code</label>
                <textarea value={form.starterCode} onChange={(e) => setForm((prev) => ({ ...prev, starterCode: e.target.value }))} rows={6} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none resize-none font-mono" style={{ borderColor: "var(--border)", background: "#0d0d0d", color: "#22c55e" }} />
              </div>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Test Cases</label>
                  <button type="button" onClick={addTestCase} className="text-xs px-3 py-1.5 rounded-lg border cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--primary)" }}>+ Add Test Case</button>
                </div>
                <div className="space-y-2">
                  {(Array.isArray(form.testCases) ? form.testCases : []).map((tc, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-3 rounded-xl" style={{ background: "var(--input-bg)" }}>
                      <span className="text-xs font-bold mt-2.5 shrink-0" style={{ color: "var(--text-muted)" }}>#{idx + 1}</span>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input value={tc.input} onChange={(e) => updateTestCase(idx, "input", e.target.value)} placeholder="Input" className="px-3 py-1.5 rounded-lg border text-xs font-mono outline-none" style={{ borderColor: "var(--border)", background: "var(--card-bg)", color: "var(--text-primary)" }} />
                        <input value={tc.expected} onChange={(e) => updateTestCase(idx, "expected", e.target.value)} placeholder="Expected" className="px-3 py-1.5 rounded-lg border text-xs font-mono outline-none" style={{ borderColor: "var(--border)", background: "var(--card-bg)", color: "var(--text-primary)" }} />
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                            <input type="checkbox" checked={tc.isHidden} onChange={(e) => updateTestCase(idx, "isHidden", e.target.checked)} /> Hidden
                          </label>
                          {form.testCases.length > 1 && (
                            <button type="button" onClick={() => removeTestCase(idx)} className="p-1 rounded cursor-pointer hover:bg-red-500/10" style={{ color: "#ef4444" }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                <button type="button" onClick={() => setModalOpen(false)} className="px-6 py-2.5 rounded-xl border text-sm font-semibold cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
                <button type="button" onClick={handleSave} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer" style={{ background: "var(--primary)" }}>{editing ? "Update" : "Create"}</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CodingQuestionManagement;
