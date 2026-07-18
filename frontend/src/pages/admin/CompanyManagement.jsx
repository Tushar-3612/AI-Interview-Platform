import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Edit2,
  Trash2,
  Cpu,
  Code2,
  MessageSquare,
  AlertTriangle,
  Play,
  TrendingUp,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

function CompanyManagement() {
  const token = getAuthToken();

  const [companies, setCompanies] = useState([]);
  const [analytics, setAnalytics] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("add"); // "add" or "edit"
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [form, setForm] = useState({
    name: "",
    color: "#2563EB",
    technical: 10,
    coding: 5,
    hr: 5,
    difficulty: "Medium",
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState(null);

  const fetchCompaniesAndAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [compRes, analyticsRes] = await Promise.all([
        api.get("/api/admin/companies", { headers }),
        api.get("/api/admin/companies/analytics", { headers }),
      ]);
      setCompanies(compRes.data || []);
      setAnalytics(analyticsRes.data || []);
    } catch (error) {
      console.error("Error loading companies", error);
      toast.error("Failed to load companies data");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCompaniesAndAnalytics();
  }, [fetchCompaniesAndAnalytics]);

  const handleOpenAdd = () => {
    setModalType("add");
    setForm({
      name: "",
      color: "#2563EB",
      technical: 15,
      coding: 10,
      hr: 5,
      difficulty: "Medium",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (company) => {
    setSelectedCompany(company);
    setModalType("edit");
    setForm({
      name: company.name || "",
      color: company.color || "#2563EB",
      technical: company.technical || 0,
      coding: company.coding || 0,
      hr: company.hr || 0,
      difficulty: company.difficulty || "Medium",
    });
    setModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      const headers = { Authorization: `Bearer ${token}` };
      if (modalType === "add") {
        await api.post("/api/admin/companies", form, { headers });
        toast.success("New company profile generated");
      } else {
        await api.put(`/api/admin/companies/${selectedCompany._id}`, form, { headers });
        toast.success("Company profile modified");
      }
      setModalOpen(false);
      fetchCompaniesAndAnalytics();
    } catch (error) {
      console.error("Error saving company", error);
      toast.error(error.response?.data?.message || "Failed to save company");
    }
  };

  const handleOpenDelete = (company) => {
    setCompanyToDelete(company);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await api.delete(`/api/admin/companies/${companyToDelete._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Company profile deleted successfully");
      setDeleteConfirmOpen(false);
      fetchCompaniesAndAnalytics();
    } catch (error) {
      console.error("Error deleting company", error);
      toast.error("Failed to delete company profile");
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Company Management
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Configure and monitor company specific placement mock databases.
          </p>
        </motion.div>
        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white btn-gradient cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Placement Target
        </motion.button>
      </div>

      {/* Grid of Companies */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Loading company profiles...</p>
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-20 student-card">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>No companies cataloged yet. Seed them or create one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {companies.map((company, i) => {
            // Find analytics matching this company ID
            const analytic = analytics.find((a) => a.companyId === company.id) || {};
            const attempts = analytic.attempts || 0;
            const avgScore = analytic.averageScore || 0;
            const bestScore = analytic.bestScore || 0;

            return (
              <motion.div
                key={company._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="student-card p-5 space-y-4 text-left"
              >
                {/* Header card with name and edit actions */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold text-sm shrink-0"
                      style={{ background: company.color || "#2563EB" }}
                    >
                      {company.name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm truncate max-w-[120px]" style={{ color: "var(--text-primary)" }}>
                        {company.name}
                      </h4>
                      <span
                        className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          color: company.difficulty === "Hard" ? "var(--error)" : company.difficulty === "Medium" ? "var(--primary)" : "var(--success)",
                          background: "color-mix(in srgb, var(--primary) 7%, transparent)",
                        }}
                      >
                        {company.difficulty}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(company)}
                      title="Edit Company"
                      className="p-1.5 border rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDelete(company)}
                      title="Delete Company"
                      className="p-1.5 border rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
                      style={{ borderColor: "var(--border)", color: "var(--error)" }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Question Counts breakdown */}
                <div className="grid grid-cols-3 gap-2.5 text-center text-[10px] py-3.5 border-y" style={{ borderColor: "var(--border)" }}>
                  <div className="flex flex-col items-center">
                    <Cpu className="w-3.5 h-3.5 text-blue-500 mb-1" />
                    <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>Tech</span>
                    <span className="font-bold text-xs mt-0.5" style={{ color: "var(--text-primary)" }}>{company.technical || 0}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Code2 className="w-3.5 h-3.5 text-emerald-500 mb-1" />
                    <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>Coding</span>
                    <span className="font-bold text-xs mt-0.5" style={{ color: "var(--text-primary)" }}>{company.coding || 0}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-500 mb-1" />
                    <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>HR</span>
                    <span className="font-bold text-xs mt-0.5" style={{ color: "var(--text-primary)" }}>{company.hr || 0}</span>
                  </div>
                </div>

                {/* Analytics */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between" style={{ color: "var(--text-secondary)" }}>
                    <span className="flex items-center gap-1.5"><Play className="w-3.5 h-3.5 text-slate-400" /> Attempts taken:</span>
                    <span className="font-bold" style={{ color: "var(--text-primary)" }}>{attempts}</span>
                  </div>
                  <div className="flex justify-between" style={{ color: "var(--text-secondary)" }}>
                    <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-slate-400" /> Average score:</span>
                    <span className="font-bold" style={{ color: "var(--text-primary)" }}>{avgScore}%</span>
                  </div>
                  <div className="flex justify-between" style={{ color: "var(--text-secondary)" }}>
                    <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Highest score:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{bestScore}%</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Company Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md rounded-3xl p-6 sm:p-8 glass-card"
            >
              <h3 className="text-lg font-bold mb-4" style={{ color: "var(--text-primary)" }}>
                {modalType === "add" ? "Add Company Profile" : "Edit Company Profile"}
              </h3>
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Company Name</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    placeholder="Google, Microsoft, etc."
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Theme Color (Hex)</label>
                  <div className="flex gap-2.5">
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => setForm({ ...form, color: e.target.value })}
                      className="w-10 h-10 border rounded-xl cursor-pointer p-0 overflow-hidden"
                      style={{ borderColor: "var(--border)" }}
                    />
                    <input
                      value={form.color}
                      onChange={(e) => setForm({ ...form, color: e.target.value })}
                      className="flex-1 px-3 py-2 border rounded-xl text-sm outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Tech Qs</label>
                    <input
                      type="number"
                      min="0"
                      value={form.technical}
                      onChange={(e) => setForm({ ...form, technical: Number(e.target.value) })}
                      required
                      className="w-full px-3 py-2 border rounded-xl text-sm outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Coding Qs</label>
                    <input
                      type="number"
                      min="0"
                      value={form.coding}
                      onChange={(e) => setForm({ ...form, coding: Number(e.target.value) })}
                      required
                      className="w-full px-3 py-2 border rounded-xl text-sm outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>HR Qs</label>
                    <input
                      type="number"
                      min="0"
                      value={form.hr}
                      onChange={(e) => setForm({ ...form, hr: Number(e.target.value) })}
                      required
                      className="w-full px-3 py-2 border rounded-xl text-sm outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Difficulty Category</label>
                  <select
                    value={form.difficulty}
                    onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none cursor-pointer"
                    style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex-1 py-2.5 border rounded-xl text-xs font-semibold cursor-pointer"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white btn-gradient cursor-pointer"
                  >
                    Generate Company
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {deleteConfirmOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteConfirmOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm rounded-3xl p-6 sm:p-8 glass-card text-center"
            >
              <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--error)" }} />
              <h3 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                Confirm Deletion
              </h3>
              <p className="text-xs mb-6" style={{ color: "var(--text-secondary)" }}>
                Are you sure you want to delete the company profile for <strong>{companyToDelete?.name}</strong>? Students will no longer see this placement target in their Practice hub.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="flex-1 py-2.5 border rounded-xl text-xs font-semibold cursor-pointer"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer bg-[var(--error)]"
                >
                  Remove Company
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CompanyManagement;
