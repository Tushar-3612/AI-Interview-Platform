import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search, ChevronDown, ChevronLeft, ChevronRight, Eye, Edit2, Trash2,
  Download, FileText, AlertTriangle, X, Filter, SlidersHorizontal,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

const DEPARTMENTS = ["Computer Engineering", "IT Engineering", "Electronics Engineering", "Mechanical Engineering", "Civil Engineering", "ENTC Engineering", "AI & DS"];
const YEARS = ["FE", "SE", "TE", "BE"];

function StudentsList() {
  const navigate = useNavigate();
  const token = getAuthToken();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [deleteId, setDeleteId] = useState(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/admin/students", {
        params: { search, department, year, page, limit: 10 },
        headers: { Authorization: `Bearer ${token}` },
      });
      let list = [...(data.students || [])];
      if (sortBy === "name") list.sort((a, b) => a.name?.localeCompare(b.name));
      if (sortBy === "score") list.sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0));
      if (sortBy === "date") list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setStudents(list);
      setPages(data.pagination?.pages || 1);
      setTotal(data.pagination?.total || 0);
    } catch {
      toast.error("Failed to load students");
    } finally {
      setLoading(false);
    }
  }, [search, department, year, page, sortBy, token]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const handleSearch = (val) => { setSearch(val); setPage(1); };
  const handleDept = (val) => { setDepartment(val); setPage(1); };
  const handleYear = (val) => { setYear(val); setPage(1); };

  const handleEdit = (s) => {
    setEditForm({
      name: s.name || "",
      department: s.department || "",
      year: s.year || "",
      phone: s.phone || "",
      atsScore: s.atsScore ?? 0,
    });
    setEditModal(s);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/api/admin/students/${editModal._id}`, editForm, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Student updated");
      setEditModal(null);
      fetchStudents();
    } catch { toast.error("Update failed"); }
  };

  const deleteStudent = async () => {
    try {
      await api.delete(`/api/admin/students/${deleteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Student deleted");
      setDeleteId(null);
      fetchStudents();
    } catch { toast.error("Delete failed"); }
  };

  const viewResume = async (id) => {
    try {
      const { data } = await api.get(`/api/admin/students/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.student?.resumeBase64) {
        const w = window.open("");
        w.document.write(`<iframe src="data:application/pdf;base64,${data.student.resumeBase64}" style="width:100%;height:100vh;border:none;"></iframe>`);
      } else {
        toast.error("No resume uploaded");
      }
    } catch { toast.error("Failed to load resume"); }
  };

  const downloadResume = async (id, fileName) => {
    try {
      const { data } = await api.get(`/api/admin/students/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.student?.resumeBase64) {
        const a = document.createElement("a");
        a.href = `data:application/pdf;base64,${data.student.resumeBase64}`;
        a.download = fileName || "resume.pdf";
        a.click();
        toast.success("Downloading resume");
      } else {
        toast.error("No resume data");
      }
    } catch { toast.error("Download failed"); }
  };

  const statusBadge = (s) => {
    const avg = s.avgScore || 0;
    if (avg >= 75 && s.resumeFileName) return { label: "Excellent", color: "var(--badge-success-text)", bg: "var(--badge-success-bg)" };
    if (avg >= 50 && s.resumeFileName) return { label: "Good", color: "var(--badge-info-text)", bg: "var(--badge-info-bg)" };
    if (s.resumeFileName) return { label: "Needs Practice", color: "var(--badge-warning-text)", bg: "var(--badge-warning-bg)" };
    return { label: "Incomplete", color: "var(--badge-error-text)", bg: "var(--badge-error-bg)" };
  };

  const inputCls = "w-full px-3 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)]";
  const selCls = "px-3 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] appearance-none cursor-pointer";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Students</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {total} registered student{total !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border admin-border rounded-lg admin-hover cursor-pointer self-start sm:self-auto"
          style={{ color: "var(--text-secondary)" }}>
          <Filter className="w-3.5 h-3.5" />
          Filters
          {(department || year || sortBy || search) && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
          )}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
        <input value={search} onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full pl-10 pr-10 py-2.5 text-sm border admin-border rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          style={{ color: "var(--text-primary)" }} />
        {search && (
          <button onClick={() => handleSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer">
            <X className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          </button>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-3 p-4 border admin-border rounded-xl"
          style={{ background: "var(--card-bg)" }}>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Filter by</span>
          </div>
          <select value={department} onChange={(e) => handleDept(e.target.value)} className={selCls} style={{ color: "var(--text-primary)" }}>
            <option value="">All Departments</option>
            {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
          </select>
          <select value={year} onChange={(e) => handleYear(e.target.value)} className={selCls} style={{ color: "var(--text-primary)" }}>
            <option value="">All Years</option>
            {YEARS.map(y => <option key={y}>{y}</option>)}
          </select>
          <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }} className={selCls} style={{ color: "var(--text-primary)" }}>
            <option value="">Sort by</option>
            <option value="name">Name</option>
            <option value="score">Average Score</option>
            <option value="date">Recently Joined</option>
          </select>
          {(department || year || sortBy) && (
              <button onClick={() => { setDepartment(""); setYear(""); setSortBy(""); setPage(1); }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer admin-error-hover"
                style={{ color: "var(--badge-error-text)" }}>
              Clear all
            </button>
          )}
        </motion.div>
      )}

      {/* Table */}
      <div className="border admin-border rounded-xl overflow-hidden" style={{ background: "var(--card-bg)" }}>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: "var(--bg-primary)" }}>
                <Search className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
              </div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>No students found</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Try adjusting your search or filters</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                  <tr className="border-b admin-table-divider">
                  {["Student", "Department", "Year", "Resume", "Practice", "Real", "Avg Score", "Status", ""].map(h => (
                    <th key={h} className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-admin">
                {students.map((s, idx) => {
                  const st = statusBadge(s);
                  return (
                    <motion.tr key={s._id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}
                      className="group admin-row-hover cursor-pointer"
                      onClick={() => navigate(`/admin/students/${s._id}`)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0 max-w-[200px]">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                            style={{ background: "var(--primary)", color: "#fff" }}>
                            {s.name?.[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{s.name}</p>
                            <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{s.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{s.department}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                          style={{ background: "var(--bg-primary)", color: "var(--text-secondary)" }}>
                          {s.year}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{
                          background: s.resumeFileName ? "var(--badge-success-bg)" : "var(--admin-surface-hover)",
                          color: s.resumeFileName ? "var(--badge-success-text)" : "var(--text-muted)",
                        }}>{s.resumeFileName ? "Uploaded" : "Pending"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{s.attempts || 0}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{s.realCount || 0}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold" style={{
                          color: s.avgScore >= 75 ? "var(--badge-success-text)" : s.avgScore >= 50 ? "var(--primary)" : "var(--badge-error-text)",
                        }}>{s.avgScore ? `${s.avgScore}%` : "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap"
                          style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                          <button onClick={() => navigate(`/admin/students/${s._id}`)}
                            className="p-1.5 rounded-lg admin-hover cursor-pointer" title="View details"
                            style={{ color: "var(--primary)" }}>
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleEdit(s)}
                            className="p-1.5 rounded-lg admin-hover cursor-pointer" title="Edit student"
                            style={{ color: "var(--text-secondary)" }}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteId(s._id)}
                            className="p-1.5 rounded-lg admin-error-hover cursor-pointer" title="Delete student">
                            <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--badge-error-text)" }} />
                          </button>
                          <div className="w-px h-4 mx-0.5" style={{ background: "var(--border)" }} />
                          <button onClick={() => viewResume(s._id)}
                            className="p-1.5 rounded-lg admin-hover cursor-pointer" title="Preview resume"
                            style={{ color: "var(--badge-warning-text)" }}>
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => downloadResume(s._id, s.resumeFileName)}
                            className="p-1.5 rounded-lg admin-hover cursor-pointer" title="Download resume"
                            style={{ color: "var(--badge-success-text)" }}>
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t admin-table-divider">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Page {page} of {pages}</p>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(1)}
                className="px-2 py-1 text-xs border admin-border rounded-lg admin-hover disabled:opacity-30 cursor-pointer"
                style={{ color: "var(--text-secondary)" }}>First</button>
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                className="p-1.5 border admin-border rounded-lg admin-hover disabled:opacity-30 cursor-pointer">
                <ChevronLeft className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
              </button>
              <span className="text-xs font-medium px-2" style={{ color: "var(--text-primary)" }}>{page}</span>
              <button disabled={page >= pages} onClick={() => setPage(page + 1)}
                className="p-1.5 border admin-border rounded-lg admin-hover disabled:opacity-30 cursor-pointer">
                <ChevronRight className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
              </button>
              <button disabled={page >= pages} onClick={() => setPage(pages)}
                className="px-2 py-1 text-xs border admin-border rounded-lg admin-hover disabled:opacity-30 cursor-pointer"
                style={{ color: "var(--text-secondary)" }}>Last</button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ background: "var(--admin-modal-overlay)" }}
          onClick={() => setEditModal(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="border admin-border rounded-xl p-6 w-full max-w-md shadow-xl"
            style={{ background: "var(--card-bg)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Edit Student</h3>
              <button onClick={() => setEditModal(null)} className="cursor-pointer">
                <X className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              </button>
            </div>
            <form onSubmit={saveEdit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Name</label>
                  <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className={inputCls} style={{ color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Department</label>
                  <select value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className={selCls + " w-full"} style={{ color: "var(--text-primary)" }}>
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Year</label>
                  <select value={editForm.year} onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                    className={selCls + " w-full"} style={{ color: "var(--text-primary)" }}>
                    {YEARS.map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Phone</label>
                  <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className={inputCls} style={{ color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>ATS Score</label>
                  <input type="number" min="0" max="100" value={editForm.atsScore}
                    onChange={(e) => setEditForm({ ...editForm, atsScore: parseInt(e.target.value) || 0 })}
                    className={inputCls} style={{ color: "var(--text-primary)" }} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditModal(null)}
                  className="flex-1 py-2.5 text-xs font-semibold border admin-border rounded-lg admin-hover cursor-pointer"
                  style={{ color: "var(--text-secondary)" }}>Cancel</button>
                <button type="submit"
                  className="flex-1 py-2.5 text-xs font-semibold text-white rounded-lg hover:opacity-90 cursor-pointer"
                  style={{ background: "var(--primary)" }}>Save Changes</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ background: "var(--admin-modal-overlay)" }}
          onClick={() => setDeleteId(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="border admin-border rounded-xl p-6 w-full max-w-sm text-center shadow-xl"
            style={{ background: "var(--card-bg)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--badge-error-bg)" }}>
              <AlertTriangle className="w-6 h-6" style={{ color: "var(--badge-error-text)" }} />
            </div>
            <h3 className="text-base font-bold mb-1" style={{ color: "var(--text-primary)" }}>Delete Student?</h3>
            <p className="text-xs mb-6" style={{ color: "var(--text-secondary)" }}>This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 text-xs font-semibold border admin-border rounded-lg admin-hover cursor-pointer"
                style={{ color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={deleteStudent}
                className="flex-1 py-2.5 text-xs font-semibold text-white rounded-lg hover:opacity-90 cursor-pointer"
                style={{ background: "var(--error)" }}>Delete</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default StudentsList;
