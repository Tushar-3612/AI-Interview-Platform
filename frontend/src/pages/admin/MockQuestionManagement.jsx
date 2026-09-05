import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Plus, Edit2, Trash2, Search, Filter, Upload, HelpCircle,
  Code2, BrainCircuit, AlertTriangle, CheckCircle2, Copy, Eye, X, ChevronLeft, ChevronRight
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

import MockQuestionFormModal from "../../components/admin/MockQuestionFormModal";
import DuplicateConflictModal from "../../components/admin/DuplicateConflictModal";
import BulkImportModal from "../../components/admin/BulkImportModal";

const SUPPORTED_COMPANIES = [
  { id: "celebal", name: "Celebal" },
  { id: "tcs", name: "TCS" },
  { id: "wipro", name: "Wipro" },
  { id: "accenture", name: "Accenture" },
  { id: "benchmark", name: "Benchmark IT Solutions" },
  { id: "capgemini", name: "Capgemini" },
  { id: "cognizant", name: "Cognizant" },
  { id: "deloitte", name: "Deloitte" },
  { id: "infosys", name: "Infosys" },
];

export default function MockQuestionManagement() {
  const [selectedCompany, setSelectedCompany] = useState("celebal");
  const [questionType, setQuestionType] = useState("mcq");

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [topic, setTopic] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Data & Counts
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [counts, setCounts] = useState({ mcqCount: 0, technicalCount: 0, codingCount: 0, totalCount: 0 });
  const [pagination, setPagination] = useState({ totalPages: 1, total: 0 });

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [viewingQuestion, setViewingQuestion] = useState(null);

  // Duplicate Conflict Modal
  const [conflictData, setConflictData] = useState({ isOpen: false, newQuestion: null, existingQuestion: null });

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Quick Duplicate Search Modal
  const [isDupSearchOpen, setIsDupSearchOpen] = useState(false);
  const [dupSearchInput, setDupSearchInput] = useState("");
  const [dupSearchResult, setDupSearchResult] = useState(null);

  const token = getAuthToken();
  const headers = { Authorization: `Bearer ${token}` };

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        companyId: selectedCompany,
        type: questionType,
        page,
        limit,
      });
      if (search) queryParams.append("search", search);
      if (difficulty) queryParams.append("difficulty", difficulty);
      if (topic) queryParams.append("topic", topic);

      const res = await api.get(`/api/admin/mock-questions?${queryParams.toString()}`, { headers });
      if (res.data?.success) {
        setQuestions(res.data.data.questions || []);
        setCounts(res.data.data.counts || { mcqCount: 0, technicalCount: 0, codingCount: 0, totalCount: 0 });
        setPagination(res.data.data.pagination || { totalPages: 1, total: 0 });
      }
    } catch (err) {
      toast.error("Failed to load company mock questions");
    } finally {
      setLoading(false);
    }
  }, [selectedCompany, questionType, search, difficulty, topic, page, limit]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleOpenAdd = () => {
    setEditingQuestion(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (q) => {
    setEditingQuestion(q);
    setIsFormOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const qId = deleteTarget.questionId || deleteTarget._id;
      await api.delete(`/api/admin/mock-questions/${qId}?companyId=${selectedCompany}&type=${questionType}`, { headers });
      toast.success("Question deleted (suppressed) successfully!");
      setDeleteTarget(null);
      fetchQuestions();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete question");
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicateCheckSearch = async (e) => {
    e.preventDefault();
    if (!dupSearchInput.trim()) return;
    try {
      const res = await api.post(
        "/api/admin/mock-questions/check-duplicate",
        {
          companyId: selectedCompany,
          type: questionType,
          questionText: dupSearchInput,
        },
        { headers }
      );
      setDupSearchResult(res.data || null);
    } catch (err) {
      toast.error("Failed to check duplicate");
    }
  };

  const currentCompanyName = SUPPORTED_COMPANIES.find((c) => c.id === selectedCompany)?.name || selectedCompany;
  const startCount = (page - 1) * limit + 1;
  const endCount = Math.min(page * limit, pagination.total || 0);

  return (
    <div className="space-y-6 pb-16" style={{ color: "var(--text-primary)" }}>
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Company Mock Question Bank</h1>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Manage actual Company Mock question pools across all 9 supported companies. Strict company isolation applied.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setDupSearchInput("");
              setDupSearchResult(null);
              setIsDupSearchOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-sm hover:opacity-90"
            style={{ background: "var(--card-bg)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <Search className="w-3.5 h-3.5 text-amber-500" />
            <span>Duplicate Search</span>
          </button>

          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-sm hover:opacity-90"
            style={{ background: "var(--card-bg)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <Upload className="w-3.5 h-3.5 text-blue-500" />
            <span>Import Questions</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Question</span>
          </button>
        </div>
      </div>

      {/* Company Selector Pills */}
      <div className="p-3.5 rounded-2xl border space-y-2 shadow-sm" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Target Company:
          </p>
          <span className="text-[11px] font-semibold text-blue-500">
            {currentCompanyName} Selected
          </span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {SUPPORTED_COMPANIES.map((c) => {
            const isSelected = selectedCompany === c.id;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setSelectedCompany(c.id);
                  setPage(1);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer border ${
                  isSelected
                    ? "bg-blue-600 border-blue-600 text-white shadow-md font-bold"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-slate-500/10 hover:text-[var(--text-primary)]"
                }`}
                style={{ background: isSelected ? undefined : "var(--bg-primary)" }}
              >
                <Building2 className={`w-3.5 h-3.5 ${isSelected ? "text-white" : "text-blue-500"}`} />
                <span>{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Question Type Tabs & Real Counts */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex gap-2">
          {[
            { id: "mcq", label: `MCQ (${counts.mcqCount || 0})`, icon: BrainCircuit },
            { id: "technical", label: `Technical / TITA (${counts.technicalCount || 0})`, icon: HelpCircle },
            { id: "coding", label: `Coding (${counts.codingCount || 0})`, icon: Code2 },
          ].map((t) => {
            const Icon = t.icon;
            const isSelected = questionType === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setQuestionType(t.id);
                  setPage(1);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  isSelected
                    ? "bg-blue-500/15 border-blue-500/40 text-blue-500 shadow-sm"
                    : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Filter & Page Size Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${questionType} questions...`}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:border-blue-500"
              style={{ background: "var(--input-bg)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>

          <select
            value={difficulty}
            onChange={(e) => {
              setDifficulty(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:border-blue-500"
            style={{ background: "var(--input-bg)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <option value="">All Difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>

          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:border-blue-500"
            style={{ background: "var(--input-bg)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
        </div>
      </div>

      {/* Main Content Area — No Fixed Max-Height Bounds to prevent clipping */}
      <div className="p-6 rounded-2xl border space-y-4 shadow-sm" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
        {/* Sub-Header / Visibility Count */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3" style={{ borderColor: "var(--border)" }}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {currentCompanyName} — {questionType.toUpperCase()} Pool
          </h3>
          {pagination.total > 0 && (
            <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Showing <span className="text-blue-500 font-bold">{startCount}–{endCount}</span> of <span className="font-bold text-[var(--text-primary)]">{pagination.total}</span> questions
            </p>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs font-semibold text-slate-400">Loading questions...</div>
        ) : questions.length > 0 ? (
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <div
                key={q.questionId || q._id || idx}
                className="p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-start justify-between gap-4 group"
                style={{
                  background: "var(--bg-primary)",
                  borderColor: "var(--border)",
                }}
              >
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded font-bold border bg-slate-500/10 text-blue-500 border-blue-500/20">
                      {q.questionId || `Q-${startCount + idx}`}
                    </span>

                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                      (q.difficulty || "").toLowerCase() === "easy"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : (q.difficulty || "").toLowerCase() === "hard"
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    }`}>
                      {q.difficulty || "Medium"}
                    </span>

                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-500/10 border border-slate-500/20 text-slate-500 dark:text-slate-400">
                      Topic: {q.topic || q.category || "General"}
                    </span>

                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      Marks: {q.marks || 3}
                    </span>
                  </div>

                  {/* Question / Title Text */}
                  <p className="text-sm font-semibold leading-relaxed" style={{ color: "var(--text-primary)" }}>
                    {q.question || q.title || q.problemStatement}
                  </p>

                  {/* MCQ Options Display */}
                  {Array.isArray(q.options) && q.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {q.options.map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className={`text-xs px-3 py-1.5 rounded-lg border ${
                            opt === q.correctAnswer
                              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-bold"
                              : "bg-slate-500/5 border-slate-500/20 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          <span className="font-bold mr-1.5">{String.fromCharCode(65 + oIdx)}.</span> {opt}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Technical Answer Preview */}
                  {q.expectedAnswer && (
                    <p className="text-xs italic line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                      <span className="font-semibold not-italic">Expected Answer:</span> {q.expectedAnswer}
                    </p>
                  )}
                </div>

                {/* Actions Bar */}
                <div className="flex items-center gap-1.5 self-end md:self-start shrink-0 pt-1">
                  <button
                    onClick={() => setViewingQuestion(q)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-blue-500/10 text-blue-500 border-blue-500/20 cursor-pointer"
                    title="View Full Details"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(q)}
                    className="p-1.5 rounded-lg transition-colors text-slate-400 hover:text-blue-500 hover:bg-slate-500/10 cursor-pointer"
                    title="Edit Question"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setDeleteTarget(q)}
                    className="p-1.5 rounded-lg transition-colors text-slate-400 hover:text-rose-500 hover:bg-slate-500/10 cursor-pointer"
                    title="Delete Question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center space-y-2">
            <p className="text-xs font-bold text-slate-400">
              No Company Mock {questionType.toUpperCase()} questions available for {currentCompanyName}.
            </p>
            <p className="text-[11px] text-slate-500">
              Click "Add Question" or "Import Questions" to populate this pool.
            </p>
          </div>
        )}

        {/* Server-Side Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Page <span className="font-bold text-[var(--text-primary)]">{page}</span> of <span className="font-bold text-[var(--text-primary)]">{pagination.totalPages}</span>
            </p>

            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border disabled:opacity-40 cursor-pointer hover:bg-slate-500/10"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <div className="flex items-center gap-1 px-2">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum = page - 2 + i;
                  if (pageNum < 1) pageNum = i + 1;
                  if (pageNum > pagination.totalPages) return null;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        page === pageNum
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-400 hover:bg-slate-500/10"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border disabled:opacity-40 cursor-pointer hover:bg-slate-500/10"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Full Question Inspection Modal */}
      {viewingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 backdrop-blur-md bg-black/60" onClick={() => setViewingQuestion(null)} />
          <div
            className="relative w-full max-w-2xl rounded-2xl border p-6 shadow-2xl z-10 max-h-[85vh] overflow-y-auto space-y-4"
            style={{ background: "var(--card-bg)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <div className="flex items-start justify-between pb-3 border-b" style={{ borderColor: "var(--border)" }}>
              <div>
                <span className="text-[11px] font-mono text-blue-500 font-bold">
                  {viewingQuestion.questionId}
                </span>
                <h3 className="text-sm font-bold mt-1">Full Question Details</h3>
              </div>
              <button onClick={() => setViewingQuestion(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl border bg-slate-500/5" style={{ borderColor: "var(--border)" }}>
                <p className="font-semibold text-slate-400 uppercase text-[10px] mb-1">Question / Problem Statement:</p>
                <p className="text-sm font-semibold leading-relaxed" style={{ color: "var(--text-primary)" }}>
                  {viewingQuestion.question || viewingQuestion.title || viewingQuestion.problemStatement}
                </p>
              </div>

              {Array.isArray(viewingQuestion.options) && viewingQuestion.options.length > 0 && (
                <div className="space-y-1.5">
                  <p className="font-semibold text-slate-400 uppercase text-[10px]">MCQ Options:</p>
                  {viewingQuestion.options.map((opt, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border text-xs ${
                        opt === viewingQuestion.correctAnswer
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-bold"
                          : "border-slate-500/20 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {String.fromCharCode(65 + idx)}. {opt}
                    </div>
                  ))}
                </div>
              )}

              {viewingQuestion.expectedAnswer && (
                <div className="p-3 rounded-xl border bg-slate-500/5" style={{ borderColor: "var(--border)" }}>
                  <p className="font-semibold text-slate-400 uppercase text-[10px] mb-1">Expected Technical Answer:</p>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-primary)" }}>
                    {viewingQuestion.expectedAnswer}
                  </p>
                </div>
              )}

              {viewingQuestion.explanation && (
                <div className="p-3 rounded-xl border bg-slate-500/5" style={{ borderColor: "var(--border)" }}>
                  <p className="font-semibold text-slate-400 uppercase text-[10px] mb-1">Explanation:</p>
                  <p className="text-xs text-slate-400">{viewingQuestion.explanation}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-[11px] pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                <div>Company: <span className="font-bold text-blue-500">{currentCompanyName}</span></div>
                <div>Difficulty: <span className="font-bold capitalize text-amber-500">{viewingQuestion.difficulty}</span></div>
                <div>Marks: <span className="font-bold text-emerald-500">{viewingQuestion.marks}</span></div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingQuestion(null)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Form Modal */}
      <MockQuestionFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={fetchQuestions}
        companyId={selectedCompany}
        type={questionType}
        initialData={editingQuestion}
        onDuplicateFound={(newQ, existQ) => {
          setIsFormOpen(false);
          setConflictData({ isOpen: true, newQuestion: newQ, existingQuestion: existQ });
        }}
      />

      {/* Duplicate Conflict Modal */}
      <DuplicateConflictModal
        isOpen={conflictData.isOpen}
        onClose={() => setConflictData({ isOpen: false, newQuestion: null, existingQuestion: null })}
        newQuestion={conflictData.newQuestion}
        existingQuestion={conflictData.existingQuestion}
      />

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={fetchQuestions}
        companyId={selectedCompany}
        type={questionType}
      />

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 backdrop-blur-md bg-black/60" onClick={() => setDeleteTarget(null)} />
          <div
            className="relative w-full max-w-md rounded-2xl border p-6 shadow-2xl z-10 space-y-4"
            style={{ background: "var(--card-bg)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <div className="flex items-center gap-3 text-rose-500">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold">Delete Question</h3>
            </div>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Are you sure you want to delete this question? It will be safely suppressed from future Company Mock pools while historical completed attempts remain untouched.
            </p>
            <div className="p-3 rounded-xl border text-xs font-mono bg-slate-500/5" style={{ borderColor: "var(--border)" }}>
              ID: {deleteTarget.questionId || deleteTarget._id}<br />
              Text: {(deleteTarget.question || deleteTarget.title || "").slice(0, 80)}...
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border hover:bg-slate-500/10 cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50 cursor-pointer"
              >
                {deleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Duplicate Search Modal */}
      {isDupSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 backdrop-blur-md bg-black/60" onClick={() => setIsDupSearchOpen(false)} />
          <div
            className="relative w-full max-w-lg rounded-2xl border p-6 shadow-2xl z-10 space-y-4"
            style={{ background: "var(--card-bg)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Search className="w-4 h-4 text-amber-500" />
                <span>Quick Duplicate Search ({currentCompanyName})</span>
              </h3>
              <button onClick={() => setIsDupSearchOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDuplicateCheckSearch} className="space-y-3">
              <textarea
                rows={3}
                required
                placeholder="Type or paste question text to check..."
                value={dupSearchInput}
                onChange={(e) => setDupSearchInput(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-amber-500 font-sans"
                style={{ background: "var(--input-bg)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
              <button
                type="submit"
                className="w-full py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer"
              >
                Check Database & JSON Bank
              </button>
            </form>

            {dupSearchResult && (
              <div className="p-4 rounded-xl border text-xs bg-slate-500/5" style={{ borderColor: "var(--border)" }}>
                {dupSearchResult.isDuplicate ? (
                  <div className="space-y-2 text-amber-500">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Already Exists!</span>
                    </p>
                    <p style={{ color: "var(--text-secondary)" }}>
                      Question ID: <span className="font-mono font-bold text-amber-500">{dupSearchResult.existingQuestion.questionId}</span>
                    </p>
                    <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{dupSearchResult.existingQuestion.question}</p>
                  </div>
                ) : (
                  <p className="font-bold text-emerald-500 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>New Question — Available to Add!</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
