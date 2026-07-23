import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, AlertTriangle, Building2, Globe, MapPin, DollarSign, Users, Cpu, Code2, MessageSquare, Eye } from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

const DEPARTMENTS = ["Computer Engineering", "IT Engineering", "Electronics Engineering", "Mechanical Engineering", "Civil Engineering", "ENTC Engineering", "AI & DS"];
const YEARS = ["FE", "SE", "TE", "BE"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const INTERVIEW_TYPES = ["practice", "real", "both"];

function CompanyManagement() {
  const token = getAuthToken();
  const headers = { Authorization: `Bearer ${token}` };
  const [companies, setCompanies] = useState([]);
  const [analytics, setAnalytics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [viewCompany, setViewCompany] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("add");
  const [form, setForm] = useState({
    name: "", color: "#2563EB", logo: "", description: "", website: "", location: "",
    package: "", eligibleDepartments: [], eligibleYears: [], requiredSkills: [],
    selectionProcess: "", passingPercentage: 0, minimumCGPA: 0,
    interviewType: "practice", status: "active",
    technical: 15, coding: 10, hr: 5, difficulty: "Medium",
  });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

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

  const openAdd = () => {
    setModalType("add"); setSelectedCompany(null);
    setForm({ name: "", color: "#2563EB", logo: "", description: "", website: "", location: "", package: "", eligibleDepartments: [], eligibleYears: [], requiredSkills: [], selectionProcess: "", passingPercentage: 0, minimumCGPA: 0, interviewType: "practice", status: "active", technical: 15, coding: 10, hr: 5, difficulty: "Medium" });
    setModalOpen(true);
  };

  const openEdit = (company) => {
    setModalType("edit"); setSelectedCompany(company);
    setForm({
      name: company.name || "", color: company.color || "#2563EB",
      logo: company.logo || "", description: company.description || "",
      website: company.website || "", location: company.location || "",
      package: company.package || "", eligibleDepartments: company.eligibleDepartments || [],
      eligibleYears: company.eligibleYears || [], requiredSkills: company.requiredSkills || [],
      selectionProcess: company.selectionProcess || "",
      passingPercentage: company.passingPercentage || 0, minimumCGPA: company.minimumCGPA || 0,
      interviewType: company.interviewType || "practice", status: company.status || "active",
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modalType === "add") {
        await api.post("/api/companies", form, { headers });
        toast.success("Company added");
      } else {
        await api.put(`/api/companies/${selectedCompany._id}`, form, { headers });
        toast.success("Company updated");
      }
      setModalOpen(false); fetchData();
    } catch (err) { toast.error(err.response?.data?.message || "Failed to save"); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/companies/${deleteConfirm._id}`, { headers });
      toast.success("Company deleted"); setDeleteConfirm(null); fetchData();
    } catch { toast.error("Delete failed"); }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Company Management</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Manage placement companies and track performance</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer" style={{ background: "var(--primary)" }}>
          <Plus className="w-4 h-4" /> Add Company
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" /></div>
      ) : companies.length === 0 ? (
        <div className="text-center py-20 border rounded-2xl" style={{ borderColor: "var(--border)" }}>
          <Building2 className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No companies yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((company, i) => {
            const analytic = analytics.find(a => a.companyId === company.id) || {};
            return (
              <motion.div key={company._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="border rounded-2xl p-5" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ background: company.color || "#2563EB" }}>
                      {company.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{company.name}</h4>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${company.status === "active" ? "text-green-600 bg-green-50 dark:bg-green-900/20" : "text-gray-400 bg-gray-100 dark:bg-gray-800"}`}>
                        {company.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleView(company)} className="p-1.5 rounded-lg cursor-pointer" style={{ color: "var(--primary)" }} title="View"><Eye className="w-3.5 h-3.5" /></button>
                    <button onClick={() => openEdit(company)} className="p-1.5 rounded-lg cursor-pointer" style={{ color: "var(--text-secondary)" }} title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteConfirm(company)} className="p-1.5 rounded-lg cursor-pointer" style={{ color: "var(--error)" }} title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                {company.description && <p className="text-xs mb-3 line-clamp-2" style={{ color: "var(--text-secondary)" }}>{company.description}</p>}
                <div className="flex flex-wrap gap-3 text-xs mb-3">
                  {company.location && <span className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}><MapPin className="w-3 h-3" />{company.location}</span>}
                  {company.package && <span className="flex items-center gap-1 font-semibold" style={{ color: "var(--success)" }}><DollarSign className="w-3 h-3" />{company.package}</span>}
                </div>
                <div className="flex gap-3 text-xs border-t pt-3" style={{ borderColor: "var(--border)" }}>
                  <span className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}><Cpu className="w-3 h-3" />{company.technical}</span>
                  <span className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}><Code2 className="w-3 h-3" />{company.coding}</span>
                  <span className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}><MessageSquare className="w-3 h-3" />{company.hr}</span>
                  <span className="ml-auto font-semibold" style={{ color: "var(--primary)" }}>{analytic.averageScore || 0}%</span>
                </div>
              </motion.div>
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
            <p className="text-xs mb-5" style={{ color: "var(--text-secondary)" }}>This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 text-xs font-semibold border rounded-xl cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 text-xs font-semibold text-white rounded-xl cursor-pointer" style={{ background: "var(--error)" }}>Delete</button>
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}

export default CompanyManagement;
