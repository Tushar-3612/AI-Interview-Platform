import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Plus,
  Trash2,
  CheckCircle2,
  Eye,
  EyeOff,
  Edit2,
  Save,
  RotateCcw,
  Sparkles,
  Layers,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

export default function TestCaseManagementModal({ isOpen, onClose, question, onUpdated }) {
  const token = getAuthToken();
  const headers = { Authorization: `Bearer ${token}` };

  const [testCases, setTestCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Test Case Form
  const [newTc, setNewTc] = useState({
    input: "",
    expectedOutput: "",
    isSample: true,
    isHidden: false,
    weight: 1,
  });

  // Editing state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    input: "",
    expectedOutput: "",
    isSample: true,
    isHidden: false,
    weight: 1,
  });

  useEffect(() => {
    if (isOpen && question?._id) {
      fetchTestCases();
    }
  }, [isOpen, question]);

  const fetchTestCases = async () => {
    if (!question?._id) return;
    try {
      setLoading(true);
      const res = await api.get(`/api/admin/coding/questions/${question._id}/testcases`, { headers });
      if (res.data?.success) {
        setTestCases(res.data.data || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load test cases");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTestCase = async (e) => {
    e.preventDefault();
    if (!newTc.expectedOutput && newTc.expectedOutput !== "") {
      return toast.error("Expected output is required");
    }
    setSubmitting(true);
    try {
      const res = await api.post(
        `/api/admin/coding/questions/${question._id}/testcases`,
        {
          input: newTc.input,
          expectedOutput: newTc.expectedOutput,
          isSample: newTc.isSample,
          isHidden: newTc.isSample ? false : true,
          weight: Number(newTc.weight) || 1,
        },
        { headers }
      );
      if (res.data?.success) {
        toast.success("Test case added successfully");
        setNewTc({ input: "", expectedOutput: "", isSample: true, isHidden: false, weight: 1 });
        fetchTestCases();
        if (onUpdated) onUpdated();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add test case");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (tc) => {
    setEditingId(tc._id);
    setEditForm({
      input: tc.input || "",
      expectedOutput: tc.expectedOutput || tc.expected || "",
      isSample: Boolean(tc.isSample),
      isHidden: Boolean(tc.isHidden),
      weight: tc.weight || 1,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleUpdateTestCase = async (tcId) => {
    try {
      const res = await api.put(
        `/api/admin/coding/testcases/${tcId}`,
        {
          input: editForm.input,
          expectedOutput: editForm.expectedOutput,
          isSample: editForm.isSample,
          isHidden: editForm.isSample ? false : true,
          weight: Number(editForm.weight) || 1,
        },
        { headers }
      );
      if (res.data?.success) {
        toast.success("Test case updated successfully");
        setEditingId(null);
        fetchTestCases();
        if (onUpdated) onUpdated();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update test case");
    }
  };

  const handleDeleteTestCase = async (tcId) => {
    if (!window.confirm("Are you sure you want to delete this test case?")) return;
    try {
      const res = await api.delete(`/api/admin/coding/testcases/${tcId}`, { headers });
      if (res.data?.success) {
        toast.success("Test case deleted");
        setTestCases((prev) => prev.filter((tc) => tc._id !== tcId));
        if (onUpdated) onUpdated();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete test case");
    }
  };

  if (!isOpen) return null;

  const sampleCases = testCases.filter((tc) => tc.isSample);
  const hiddenCases = testCases.filter((tc) => !tc.isSample);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-4xl rounded-2xl border p-6 my-8 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl"
        style={{ background: "var(--card-bg)", borderColor: "var(--border)", color: "var(--text-primary)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--border)" }}>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-500" />
              Manage Test Cases: {question?.title}
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Add and manage Sample (public candidate examples) and Hidden (evaluator-only) test cases
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:opacity-70 cursor-pointer"
            style={{ color: "var(--text-muted)" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add Test Case Form */}
        <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--input-bg)", borderColor: "var(--border)" }}>
          <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-indigo-400">
            <Plus className="w-4 h-4" /> Add New Test Case
          </h3>

          <form onSubmit={handleCreateTestCase} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold block mb-1">Standard Input (stdin)</label>
                <textarea
                  rows={2}
                  value={newTc.input}
                  onChange={(e) => setNewTc({ ...newTc, input: e.target.value })}
                  placeholder="e.g. 2 7 11 15\n9"
                  className="w-full px-3 py-2 rounded-lg text-xs font-mono border focus:outline-none"
                  style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold block mb-1">Expected Output (stdout) *</label>
                <textarea
                  rows={2}
                  required
                  value={newTc.expectedOutput}
                  onChange={(e) => setNewTc({ ...newTc, expectedOutput: e.target.value })}
                  placeholder="e.g. 0 1"
                  className="w-full px-3 py-2 rounded-lg text-xs font-mono border focus:outline-none"
                  style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="radio"
                    name="caseType"
                    checked={newTc.isSample}
                    onChange={() => setNewTc({ ...newTc, isSample: true, isHidden: false })}
                    className="text-indigo-500"
                  />
                  <span className="flex items-center gap-1 text-emerald-500">
                    <Eye className="w-3.5 h-3.5" /> Sample Case (Visible)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-semibold">
                  <input
                    type="radio"
                    name="caseType"
                    checked={!newTc.isSample}
                    onChange={() => setNewTc({ ...newTc, isSample: false, isHidden: true })}
                    className="text-indigo-500"
                  />
                  <span className="flex items-center gap-1 text-rose-500">
                    <EyeOff className="w-3.5 h-3.5" /> Hidden Case (Evaluator Only)
                  </span>
                </label>

                <div className="flex items-center gap-1.5 ml-2">
                  <span className="text-slate-400">Weight:</span>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newTc.weight}
                    onChange={(e) => setNewTc({ ...newTc, weight: e.target.value })}
                    className="w-14 px-2 py-1 rounded text-center text-xs font-bold border"
                    style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md cursor-pointer transition hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--primary)" }}
              >
                {submitting ? "Adding..." : "Add Test Case"}
              </button>
            </div>
          </form>
        </div>

        {/* Existing Test Cases List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider">
              Configured Test Cases ({testCases.length})
            </h3>
            <span className="text-xs text-slate-400">
              {sampleCases.length} Sample · {hiddenCases.length} Hidden
            </span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs animate-pulse">Loading test cases...</div>
          ) : testCases.length === 0 ? (
            <div className="py-8 text-center border rounded-xl border-dashed" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                No test cases found for this question. Add at least 1 sample and 1 hidden test case for robust evaluation.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {testCases.map((tc, idx) => {
                const isEditing = editingId === tc._id;

                if (isEditing) {
                  return (
                    <div
                      key={tc._id}
                      className="p-3 rounded-xl border space-y-2"
                      style={{ background: "var(--input-bg)", borderColor: "var(--border)" }}
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <textarea
                          rows={2}
                          value={editForm.input}
                          onChange={(e) => setEditForm({ ...editForm, input: e.target.value })}
                          placeholder="Input"
                          className="w-full p-2 text-xs font-mono rounded border"
                          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
                        />
                        <textarea
                          rows={2}
                          value={editForm.expectedOutput}
                          onChange={(e) => setEditForm({ ...editForm, expectedOutput: e.target.value })}
                          placeholder="Expected Output"
                          className="w-full p-2 text-xs font-mono rounded border"
                          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name={`editType-${tc._id}`}
                              checked={editForm.isSample}
                              onChange={() => setEditForm({ ...editForm, isSample: true, isHidden: false })}
                            />
                            Sample
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name={`editType-${tc._id}`}
                              checked={!editForm.isSample}
                              onChange={() => setEditForm({ ...editForm, isSample: false, isHidden: true })}
                            />
                            Hidden
                          </label>
                          <label className="flex items-center gap-1">
                            Weight:
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={editForm.weight}
                              onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })}
                              className="w-12 px-1 py-0.5 rounded text-xs border"
                              style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
                            />
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="px-2.5 py-1 text-xs rounded border cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateTestCase(tc._id)}
                            className="px-3 py-1 text-xs rounded font-bold text-white bg-indigo-600 cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={tc._id || idx}
                    className="p-3 rounded-xl border flex items-center justify-between gap-3 text-xs"
                    style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="font-bold text-[10px] px-1.5 py-0.5 rounded bg-slate-500/10">
                        #{idx + 1}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1"
                        style={{
                          background: tc.isSample ? "rgba(16,185,129,0.1)" : "rgba(244,63,94,0.1)",
                          color: tc.isSample ? "#10b981" : "#f43f5e",
                        }}
                      >
                        {tc.isSample ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {tc.isSample ? "Sample" : "Hidden"}
                      </span>

                      <div className="flex-1 font-mono text-[11px] truncate">
                        <span className="text-slate-400">In: </span>
                        <span className="font-semibold text-slate-200">
                          {tc.input ? tc.input.replace(/\n/g, " ") : "(empty)"}
                        </span>
                        <span className="text-slate-400 ml-2">→ Out: </span>
                        <span className="font-semibold text-emerald-400">
                          {tc.expectedOutput || tc.expected}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => startEdit(tc)}
                        className="p-1.5 rounded-lg border hover:opacity-80 cursor-pointer"
                        style={{ borderColor: "var(--border)" }}
                        title="Edit"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteTestCase(tc._id)}
                        className="p-1.5 rounded-lg border text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                        style={{ borderColor: "var(--border)" }}
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold border cursor-pointer hover:opacity-80"
            style={{ borderColor: "var(--border)" }}
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
