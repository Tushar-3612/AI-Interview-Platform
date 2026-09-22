import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, AlertTriangle, Building2, Globe, MapPin, DollarSign, Users, Cpu, Code2, MessageSquare, BookOpen, Eye, Archive, RotateCcw, Power, Upload, Search, X } from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";
import { SkeletonCompanyGrid as SkeletonGrid } from "../../components/ui/Skeleton";
import { DEPARTMENT_VALUES as DEPARTMENTS, YEAR_VALUES as YEARS } from "../../utils/constants";
import CompanyCard from "../../components/admin/CompanyCard";

const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const INTERVIEW_TYPES = ["practice", "real", "both"];

const ALL_ROUNDS = [
  { id: "aptitude", label: "Aptitude Round", icon: BookOpen, color: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.3)" },
  { id: "coding", label: "Coding Round", icon: Code2, color: "#06B6D4", bg: "rgba(6, 182, 212, 0.12)", border: "rgba(6, 182, 212, 0.3)" },
  { id: "technical", label: "Technical Round", icon: Cpu, color: "#8B5CF6", bg: "rgba(139, 92, 246, 0.12)", border: "rgba(139, 92, 246, 0.3)" },
  { id: "hr", label: "HR Round", icon: MessageSquare, color: "#10B981", bg: "rgba(16, 185, 129, 0.12)", border: "rgba(16, 185, 129, 0.3)" },
];

function CompanyManagement() {
  const token = getAuthToken();
  const headers = { Authorization: `Bearer ${token}` };
  const [companies, setCompanies] = useState([]);
  const [analytics, setAnalytics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trash, setTrash] = useState([]);
  const [showTrash, setShowTrash] = useState(false);
  const [trashLoading, setTrashLoading] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [viewCompany, setViewCompany] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("add");
  const [logoFile, setLogoFile] = useState(null);
  const [form, setForm] = useState({
    name: "", color: "#2563EB", logo: "", description: "", website: "", location: "",
    package: "", eligibleDepartments: [], eligibleYears: [], requiredSkills: [],
    selectionProcess: "", passingPercentage: 0, minimumCGPA: 0,
    interviewType: "practice", status: "active",
    supportedRounds: ["aptitude", "coding", "technical", "hr"],
    technical: 15, coding: 10, hr: 5, difficulty: "Medium",
  });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [trashDeleteConfirm, setTrashDeleteConfirm] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.name?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.location?.toLowerCase().includes(q) ||
        c.package?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [companies, searchQuery, statusFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [compRes, analyticsRes] = await Promise.all([
        api.get("/api/companies", { headers }),
        api.get("/api/companies/analytics", { headers }),
      ]);
      setCompanies(compRes.data || []);
      setAnalytics(analyticsRes.data || []);
    } catch { toast.error("Failed to load companies"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchTrash = async () => {
    setTrashLoading(true);
    try {
      const res = await api.get("/api/companies/trash", { headers });
      setTrash(res.data?.companies || []);
    } catch { toast.error("Failed to load trash"); }
    finally { setTrashLoading(false); }
  };

  const toggleTrash = () => {
    setShowTrash((s) => !s);
    if (!showTrash && trash.length === 0) fetchTrash();
  };

  const openAdd = () => {
    setModalType("add"); setSelectedCompany(null); setLogoFile(null);
    setForm({ name: "", color: "#2563EB", logo: "", description: "", website: "", location: "", package: "", eligibleDepartments: [], eligibleYears: [], requiredSkills: [], selectionProcess: "", passingPercentage: 0, minimumCGPA: 0, interviewType: "practice", status: "active", supportedRounds: ["aptitude", "coding", "technical", "hr"], technical: 15, coding: 10, hr: 5, difficulty: "Medium" });
    setModalOpen(true);
  };

  const openEdit = (company) => {
    setModalType("edit"); setSelectedCompany(company); setLogoFile(null);
    setForm({
      name: company.name || "", color: company.color || "#2563EB",
      logo: company.logo || "", description: company.description || "",
      website: company.website || "", location: company.location || "",
      package: company.package || "", eligibleDepartments: company.eligibleDepartments || [],
      eligibleYears: company.eligibleYears || [], requiredSkills: company.requiredSkills || [],
      selectionProcess: company.selectionProcess || "",
      passingPercentage: company.passingPercentage || 0, minimumCGPA: company.minimumCGPA || 0,
      interviewType: company.interviewType || "practice", status: company.status || "active",
      supportedRounds: company.supportedRounds && company.supportedRounds.length > 0 ? company.supportedRounds : ["aptitude", "coding", "technical", "hr"],
      technical: company.technical ?? 15, coding: company.coding ?? 10, hr: company.hr ?? 5,
      difficulty: company.difficulty || "Medium",
    });
    setModalOpen(true);
  };

  const handleView = async (company) => {
    try {
      const { data } = await api.get(`/api/companies/${company._id}`, { headers });
      setViewData(data);
      setViewCompany(company);
    } catch { toast.error("Failed to load company details"); }
  };

  const handleLogoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoFile({ name: file.name, dataUrl: reader.result });
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modalType === "add") {
        const { data } = await api.post("/api/companies", form, { headers });
        if (logoFile) {
          await api.patch(`/api/companies/${data._id}/logo`, { logo: logoFile.dataUrl }, { headers });
        }
        toast.success("Company added");
      } else {
        await api.put(`/api/companies/${selectedCompany._id}`, form, { headers });
        if (logoFile) {
          await api.patch(`/api/companies/${selectedCompany._id}/logo`, { logo: logoFile.dataUrl }, { headers });
        }
        toast.success("Company updated");
      }
      setModalOpen(false); fetchData();
    } catch (err) { toast.error(err.response?.data?.message || "Failed to save"); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/companies/${deleteConfirm._id}`, { headers });
      toast.success("Company moved to trash"); setDeleteConfirm(null); fetchData();
    } catch { toast.error("Delete failed"); }
  };

  const handleRestore = async (company) => {
    try {
      await api.post(`/api/companies/${company._id}/restore`, {}, { headers });
      toast.success("Company restored"); fetchTrash(); fetchData();
    } catch { toast.error("Restore failed"); }
  };

  const handleHardDelete = async () => {
    try {
      await api.delete(`/api/companies/${trashDeleteConfirm._id}/hard`, { headers });
      toast.success("Company permanently deleted"); setTrashDeleteConfirm(null); fetchTrash(); fetchData();
    } catch { toast.error("Permanent delete failed"); }
  };

  const toggleStatus = async (company) => {
    const next = company.status === "active" ? "inactive" : "active";
    try {
      await api.patch(`/api/companies/${company._id}/status`, { status: next }, { headers });
      toast.success(next === "active" ? "Company enabled" : "Company disabled");
      fetchData();
    } catch { toast.error("Failed to update status"); }
  };

  const toggleArrayField = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value) ? prev[field].filter(v => v !== value) : [...prev[field], value],
    }));
  };

  const inputCls = "w-full px-3 py-2 text-sm border rounded-xl bg-transparent outline-none focus:ring-2 focus:ring-[var(--primary)]";
  const selCls = "w-full px-3 py-2 text-sm border rounded-xl bg-transparent outline-none focus:ring-2 focus:ring-[var(--primary)] appearance-none cursor-pointer";

  return (
    <div className="space-y-6">
      {/* ================= HEADER ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Company Management
          </h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Manage placement companies and track performance
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={toggleTrash}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border hover:bg-[var(--admin-surface-hover)]"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            <Archive className="w-4 h-4" />
            <span>Trash</span>
            {trash.length > 0 && !showTrash && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500">
                {trash.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow transition-all cursor-pointer bg-[#FF6B35] hover:bg-[#fa5a22]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Company</span>
          </button>
        </div>
      </div>

      {/* ================= SEARCH & STATUS FILTER TOOLBAR ================= */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            type="text"
            placeholder="Search companies by name, description, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm rounded-xl border bg-[var(--card-bg)] outline-none focus:ring-2 focus:ring-[#FF6B35]/20 focus:border-[#FF6B35] transition-all"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm rounded-xl border bg-[var(--card-bg)] outline-none focus:ring-2 focus:ring-[#FF6B35]/20 focus:border-[#FF6B35] cursor-pointer"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {showTrash && (
        <div className="border rounded-2xl p-5" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Trash (soft-deleted companies)</h3>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Auto-purged after 30 days. Restore or permanently delete.</p>
            </div>
            <button onClick={toggleTrash} className="text-xs font-semibold cursor-pointer" style={{ color: "var(--primary)" }}>Close</button>
          </div>
          {trashLoading ? (
            <SkeletonGrid count={3} />
          ) : trash.length === 0 ? (
            <p className="text-xs py-6 text-center" style={{ color: "var(--text-muted)" }}>Trash is empty.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {trash.map((company) => (
                <div key={company._id} className="border rounded-xl p-4" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{company.name}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>Trashed</span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => handleRestore(company)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer" style={{ background: "color-mix(in srgb, var(--success) 12%, transparent)", color: "var(--success)" }}>
                      <RotateCcw className="w-3 h-3" /> Restore
                    </button>
                    <button onClick={() => setTrashDeleteConfirm(company)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                      <Trash2 className="w-3 h-3" /> Delete Forever
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= COMPANIES GRID ================= */}
      {loading ? (
        <SkeletonGrid count={6} />
      ) : filteredCompanies.length === 0 ? (
        <div
          className="text-center py-16 border rounded-2xl p-6"
          style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}
        >
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: "var(--text-muted)" }} />
          <h4 className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            {companies.length === 0
              ? "No placement companies yet"
              : "No companies match your filters"}
          </h4>
          <p className="text-xs max-w-sm mx-auto mb-4" style={{ color: "var(--text-secondary)" }}>
            {companies.length === 0
              ? "Click 'Add Company' to onboard your first placement drive company."
              : "Try searching with a different keyword or resetting your status filter."}
          </p>
          {companies.length > 0 && (searchQuery || statusFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border hover:bg-[var(--admin-surface-hover)] cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCompanies.map((company, i) => {
            const analytic =
              analytics.find(
                (a) => a.companyId === company.id || a.companyId === company._id
              ) || {};
            return (
              <CompanyCard
                key={company._id}
                company={company}
                analytic={analytic}
                onView={handleView}
                onToggleStatus={toggleStatus}
                onEdit={openEdit}
                onDelete={setDeleteConfirm}
                index={i}
              />
            );
          })}
        </div>
      )}

      {/* View Company Modal */}
      <AnimatePresence>{viewCompany && viewData && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: "var(--admin-modal-overlay)" }}
          onClick={() => { setViewCompany(null); setViewData(null); }}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
            className="border rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>{viewData.company?.name}</h3>
              <button onClick={() => { setViewCompany(null); setViewData(null); }} className="cursor-pointer" style={{ color: "var(--text-muted)" }}><AlertTriangle className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              {viewData.company?.website && <div><span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Website:</span><p style={{ color: "var(--text-primary)" }}>{viewData.company.website}</p></div>}
              {viewData.company?.location && <div><span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Location:</span><p style={{ color: "var(--text-primary)" }}>{viewData.company.location}</p></div>}
              {viewData.company?.package && <div><span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Package:</span><p style={{ color: "var(--text-primary)" }}>{viewData.company.package}</p></div>}
              {viewData.company?.minimumCGPA > 0 && <div><span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Min CGPA:</span><p style={{ color: "var(--text-primary)" }}>{viewData.company.minimumCGPA}</p></div>}
            </div>
            {viewData.stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  ["Students", viewData.stats.totalStudentsAppeared, "var(--primary)"],
                  ["Avg Score", `${viewData.stats.averageScore}%`, "#f59e0b"],
                  ["Highest", `${viewData.stats.highestScore}%`, "var(--success)"],
                  ["Selected", viewData.stats.selectedStudents, "var(--success)"],
                ].map(([l, v, c]) => (
                  <div key={l} className="p-3 rounded-xl border text-center" style={{ borderColor: "var(--border)" }}>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{l}</p>
                    <p className="text-lg font-bold" style={{ color: c }}>{v}</p>
                  </div>
                ))}
              </div>
            )}
            {viewData.company?.selectionProcess && (
              <div className="mb-3">
                <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Selection Process:</p>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{viewData.company.selectionProcess}</p>
              </div>
            )}
            {viewData.company?.requiredSkills?.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Required Skills:</p>
                <div className="flex flex-wrap gap-1.5">{viewData.company.requiredSkills.map((s, i) => <span key={i} className="px-2 py-0.5 rounded-lg text-xs" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>{s}</span>)}</div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* Add/Edit Modal */}
      <AnimatePresence>{modalOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 backdrop-blur-sm overflow-y-auto" style={{ background: "var(--admin-modal-overlay)" }}
          onClick={() => setModalOpen(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
            className="border rounded-2xl p-6 w-full max-w-2xl" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-4" style={{ color: "var(--text-primary)" }}>{modalType === "add" ? "Add Company" : "Edit Company"}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Company Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} style={{ color: "var(--text-primary)" }} required />
                </div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Color</label><input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="w-full h-9 rounded-xl border cursor-pointer" style={{ borderColor: "var(--border)" }} /></div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Logo</label>
                  <label className="flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer text-xs" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                    <Upload className="w-3.5 h-3.5" />
                    {logoFile ? logoFile.name : "Upload logo (PNG/JPG)"}
                    <input type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
                  </label>
                </div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Difficulty</label><select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })} className={selCls} style={{ color: "var(--text-primary)" }}>{DIFFICULTIES.map(d => <option key={d}>{d}</option>)}</select></div>
                <div className="col-span-2"><label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className={inputCls} style={{ color: "var(--text-primary)" }} /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Website</label><input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} className={inputCls} style={{ color: "var(--text-primary)" }} /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Location</label><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className={inputCls} style={{ color: "var(--text-primary)" }} /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Package</label><input value={form.package} onChange={e => setForm({ ...form, package: e.target.value })} placeholder="e.g. 12 LPA" className={inputCls} style={{ color: "var(--text-primary)" }} /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Min CGPA</label><input type="number" step="0.1" value={form.minimumCGPA} onChange={e => setForm({ ...form, minimumCGPA: parseFloat(e.target.value) || 0 })} className={inputCls} style={{ color: "var(--text-primary)" }} /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Passing %</label><input type="number" value={form.passingPercentage} onChange={e => setForm({ ...form, passingPercentage: parseInt(e.target.value) || 0 })} className={inputCls} style={{ color: "var(--text-primary)" }} /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Interview Type</label><select value={form.interviewType} onChange={e => setForm({ ...form, interviewType: e.target.value })} className={selCls} style={{ color: "var(--text-primary)" }}>{INTERVIEW_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Status</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={selCls} style={{ color: "var(--text-primary)" }}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Eligible Departments</label>
                  <div className="flex flex-wrap gap-1.5">{DEPARTMENTS.map(d => <button key={d} type="button" onClick={() => toggleArrayField("eligibleDepartments", d)} className={`px-2.5 py-1 rounded-lg text-xs border cursor-pointer ${form.eligibleDepartments.includes(d) ? "text-white" : ""}`} style={{ borderColor: "var(--border)", background: form.eligibleDepartments.includes(d) ? "var(--primary)" : "transparent", color: form.eligibleDepartments.includes(d) ? "white" : "var(--text-secondary)" }}>{d}</button>)}</div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Eligible Years</label>
                  <div className="flex gap-1.5">{YEARS.map(y => <button key={y} type="button" onClick={() => toggleArrayField("eligibleYears", y)} className={`px-3 py-1 rounded-lg text-xs border cursor-pointer ${form.eligibleYears.includes(y) ? "text-white" : ""}`} style={{ borderColor: "var(--border)", background: form.eligibleYears.includes(y) ? "var(--primary)" : "transparent", color: form.eligibleYears.includes(y) ? "white" : "var(--text-secondary)" }}>{y}</button>)}</div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Required Skills (comma separated)</label>
                  <input value={form.requiredSkills.join(", ")} onChange={e => setForm({ ...form, requiredSkills: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} className={inputCls} style={{ color: "var(--text-primary)" }} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Supported Interview Rounds *</label>
                  <p className="text-[11px] mb-2" style={{ color: "var(--text-muted)" }}>Select which rounds this company conducts (e.g. Aptitude, Coding, Technical, HR)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {ALL_ROUNDS.map((r) => {
                      const Icon = r.icon;
                      const active = (form.supportedRounds || []).includes(r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => toggleArrayField("supportedRounds", r.id)}
                          className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${active ? "shadow-sm scale-[1.02]" : "opacity-60"}`}
                          style={{
                            background: active ? r.bg : "transparent",
                            borderColor: active ? r.color : "var(--border)",
                            color: active ? r.color : "var(--text-muted)",
                          }}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{r.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Round Question Targets */}
                {(form.supportedRounds || []).some(r => ["coding", "technical", "hr"].includes(r)) && (
                  <div className="col-span-2 p-3 rounded-xl border space-y-2" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
                    <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Round Question Targets</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(form.supportedRounds || []).includes("coding") && (
                        <div>
                          <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Coding Qs</label>
                          <input type="number" min="0" value={form.coding} onChange={e => setForm({ ...form, coding: parseInt(e.target.value) || 0 })} className={inputCls} style={{ color: "var(--text-primary)" }} />
                        </div>
                      )}
                      {(form.supportedRounds || []).includes("technical") && (
                        <div>
                          <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Technical Qs</label>
                          <input type="number" min="0" value={form.technical} onChange={e => setForm({ ...form, technical: parseInt(e.target.value) || 0 })} className={inputCls} style={{ color: "var(--text-primary)" }} />
                        </div>
                      )}
                      {(form.supportedRounds || []).includes("hr") && (
                        <div>
                          <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>HR Qs</label>
                          <input type="number" min="0" value={form.hr} onChange={e => setForm({ ...form, hr: parseInt(e.target.value) || 0 })} className={inputCls} style={{ color: "var(--text-primary)" }} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Selection Process</label>
                  <textarea value={form.selectionProcess} onChange={e => setForm({ ...form, selectionProcess: e.target.value })} rows={2} className={inputCls} style={{ color: "var(--text-primary)" }} placeholder="e.g. Aptitude Test → Technical Interview → HR Round" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-2.5 text-xs font-semibold border rounded-xl cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
                <button type="submit" className="flex-1 py-2.5 text-xs font-semibold text-white rounded-xl cursor-pointer" style={{ background: "var(--primary)" }}>{modalType === "add" ? "Add Company" : "Save Changes"}</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>{deleteConfirm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: "var(--admin-modal-overlay)" }}
          onClick={() => setDeleteConfirm(null)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
            className="border rounded-2xl p-6 w-full max-w-sm text-center" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
            onClick={e => e.stopPropagation()}>
            <AlertTriangle className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--error)" }} />
            <h3 className="text-base font-bold mb-1" style={{ color: "var(--text-primary)" }}>Delete {deleteConfirm.name}?</h3>
            <p className="text-xs mb-5" style={{ color: "var(--text-secondary)" }}>The company will be moved to trash and can be restored within 30 days.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 text-xs font-semibold border rounded-xl cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 text-xs font-semibold text-white rounded-xl cursor-pointer" style={{ background: "var(--error)" }}>Delete</button>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
      {/* Trash Permanent Delete Modal */}
      <AnimatePresence>{trashDeleteConfirm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: "var(--admin-modal-overlay)" }}
          onClick={() => setTrashDeleteConfirm(null)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
            className="border rounded-2xl p-6 w-full max-w-sm text-center" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
            onClick={e => e.stopPropagation()}>
            <AlertTriangle className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--error)" }} />
            <h3 className="text-base font-bold mb-1" style={{ color: "var(--text-primary)" }}>Permanently delete {trashDeleteConfirm.name}?</h3>
            <p className="text-xs mb-5" style={{ color: "var(--text-secondary)" }}>This action cannot be undone. The company will be removed forever.</p>
            <div className="flex gap-3">
              <button onClick={() => setTrashDeleteConfirm(null)} className="flex-1 py-2.5 text-xs font-semibold border rounded-xl cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={handleHardDelete} className="flex-1 py-2.5 text-xs font-semibold text-white rounded-xl cursor-pointer" style={{ background: "var(--error)" }}>Delete Forever</button>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}

export default CompanyManagement;
