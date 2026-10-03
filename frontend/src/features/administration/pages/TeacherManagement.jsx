import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserCheck, Plus, Search, Building2, Mail, Lock, Shield,
  Power, KeyRound, Edit3, Trash2, X, Check, AlertTriangle, RefreshCw
} from "lucide-react";
import api from "../../../core/api/api.js";
import { getAuthToken } from "../../student/hooks/useStudentProfile.js";
import toast from "react-hot-toast";
import { DEPARTMENT_VALUES as DEPARTMENTS } from "../../../core/utils/constants.js";

export default function TeacherManagement() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalTeacher, setEditModalTeacher] = useState(null);
  const [resetPassTeacher, setResetPassTeacher] = useState(null);
  const [deleteTeacherTarget, setDeleteTeacherTarget] = useState(null);

  // Forms
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    department: "",
  });

  const [editData, setEditData] = useState({
    name: "",
    email: "",
    department: "",
  });

  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${getAuthToken()}` };
      const { data } = await api.get("/api/admin/teachers", {
        headers,
        params: { search, department: deptFilter },
      });
      setTeachers(data.teachers || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load faculty teachers");
    } finally {
      setLoading(false);
    }
  }, [search, deptFilter]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password || !formData.department) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const headers = { Authorization: `Bearer ${getAuthToken()}` };
      await api.post("/api/admin/teachers", formData, { headers });
      toast.success("Teacher account created successfully!");
      setCreateModalOpen(false);
      setFormData({ name: "", email: "", password: "", department: "" });
      fetchTeachers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create teacher account");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editData.name || !editData.email || !editData.department) {
      toast.error("Please fill in all fields");
      return;
    }

    setSubmitting(true);
    try {
      const headers = { Authorization: `Bearer ${getAuthToken()}` };
      await api.put(`/api/admin/teachers/${editModalTeacher._id}`, editData, { headers });
      toast.success("Teacher details updated successfully");
      setEditModalTeacher(null);
      fetchTeachers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update teacher");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (teacher) => {
    try {
      const headers = { Authorization: `Bearer ${getAuthToken()}` };
      const { data } = await api.patch(`/api/admin/teachers/${teacher._id}/status`, {}, { headers });
      toast.success(data.message || "Status updated");
      fetchTeachers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status");
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setSubmitting(true);
    try {
      const headers = { Authorization: `Bearer ${getAuthToken()}` };
      await api.post(
        `/api/admin/teachers/${resetPassTeacher._id}/reset-password`,
        { password: newPassword },
        { headers }
      );
      toast.success("Teacher password reset successfully");
      setResetPassTeacher(null);
      setNewPassword("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTeacher = async () => {
    if (!deleteTeacherTarget) return;
    setSubmitting(true);
    try {
      const headers = { Authorization: `Bearer ${getAuthToken()}` };
      await api.delete(`/api/admin/teachers/${deleteTeacherTarget._id}`, { headers });
      toast.success("Teacher account deleted");
      setDeleteTeacherTarget(null);
      fetchTeachers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete teacher");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              Access Control
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Teacher & Department Management
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Create, assign, and manage faculty accounts with isolated department-level permissions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchTeachers}
            className="p-2.5 rounded-xl border bg-[var(--card-bg)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] cursor-pointer"
            style={{ borderColor: "var(--border)" }}
            title="Refresh List"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[var(--primary)] text-white hover:opacity-90 shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Teacher
          </button>
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div className="p-4 rounded-2xl border bg-[var(--card-bg)] flex flex-col sm:flex-row items-center justify-between gap-3" style={{ borderColor: "var(--border)" }}>
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by teacher name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs border bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
            style={{ borderColor: "var(--border)" }}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Building2 className="w-4 h-4 text-[var(--text-muted)] hidden sm:block" />
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="w-full sm:w-56 px-3 py-2 rounded-xl text-xs border bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
            style={{ borderColor: "var(--border)" }}
          >
            <option value="">All Departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Teacher List Table ── */}
      <div className="rounded-2xl border overflow-hidden bg-[var(--card-bg)] shadow-xs" style={{ borderColor: "var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b bg-[var(--bg-secondary)]" style={{ borderColor: "var(--border)" }}>
                <th className="px-5 py-3.5 font-semibold text-[var(--text-secondary)]">Faculty Name</th>
                <th className="px-5 py-3.5 font-semibold text-[var(--text-secondary)]">Email</th>
                <th className="px-5 py-3.5 font-semibold text-[var(--text-secondary)]">Department</th>
                <th className="px-5 py-3.5 font-semibold text-[var(--text-secondary)] text-center">Status</th>
                <th className="px-5 py-3.5 font-semibold text-[var(--text-secondary)] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[var(--text-muted)]">
                    <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading teachers...
                  </td>
                </tr>
              ) : teachers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[var(--text-muted)]">
                    <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-40 text-purple-500" />
                    No faculty teachers found. Click <strong>Add Teacher</strong> to create one.
                  </td>
                </tr>
              ) : (
                teachers.map((teacher) => (
                  <tr key={teacher._id} className="hover:bg-[var(--bg-secondary)]/50 transition-colors">
                    <td className="px-5 py-4 font-semibold text-[var(--text-primary)]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center text-xs">
                          {teacher.name?.charAt(0)?.toUpperCase() || "T"}
                        </div>
                        <div>
                          <div>{teacher.name}</div>
                          <span className="text-[10px] text-[var(--text-muted)] uppercase font-mono">Role: {teacher.role}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[var(--text-secondary)] font-mono text-[11px]">
                      {teacher.email}
                    </td>
                    <td className="px-5 py-4 font-medium text-[var(--text-primary)]">
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        {teacher.department}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => handleToggleStatus(teacher)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-all cursor-pointer ${
                          teacher.isActive
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                            : "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-500/25"
                        }`}
                        title="Click to toggle active status"
                      >
                        <Power className="w-3 h-3" />
                        {teacher.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setEditModalTeacher(teacher);
                            setEditData({
                              name: teacher.name,
                              email: teacher.email,
                              department: teacher.department,
                            });
                          }}
                          className="p-1.5 rounded-lg border hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] cursor-pointer"
                          style={{ borderColor: "var(--border)" }}
                          title="Edit Teacher"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setResetPassTeacher(teacher);
                            setNewPassword("");
                          }}
                          className="p-1.5 rounded-lg border hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 cursor-pointer"
                          style={{ borderColor: "var(--border)" }}
                          title="Reset Password"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTeacherTarget(teacher)}
                          className="p-1.5 rounded-lg border hover:bg-red-500/10 text-red-600 cursor-pointer"
                          style={{ borderColor: "var(--border)" }}
                          title="Delete Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CREATE TEACHER MODAL ── */}
      <AnimatePresence>
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 rounded-2xl border bg-[var(--card-bg)] shadow-2xl space-y-4"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-[var(--primary)]" />
                  <h2 className="text-base font-bold text-[var(--text-primary)]">Add Department Teacher</h2>
                </div>
                <button onClick={() => setCreateModalOpen(false)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Rahul Patil"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs border bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
                    style={{ borderColor: "var(--border)" }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. rahul.patil@college.edu"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs border bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
                    style={{ borderColor: "var(--border)" }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Initial Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Secure password (min 6 chars)"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs border bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
                    style={{ borderColor: "var(--border)" }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Assigned Department *</label>
                  <select
                    required
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs border bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <option value="">Select Department...</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
                    style={{ borderColor: "var(--border)" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? "Creating..." : "Create Teacher"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── EDIT TEACHER MODAL ── */}
      <AnimatePresence>
        {editModalTeacher && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 rounded-2xl border bg-[var(--card-bg)] shadow-2xl space-y-4"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-[var(--primary)]" />
                  <h2 className="text-base font-bold text-[var(--text-primary)]">Edit Faculty Details</h2>
                </div>
                <button onClick={() => setEditModalTeacher(null)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs border bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
                    style={{ borderColor: "var(--border)" }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={editData.email}
                    onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs border bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
                    style={{ borderColor: "var(--border)" }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Assigned Department</label>
                  <select
                    required
                    value={editData.department}
                    onChange={(e) => setEditData({ ...editData, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs border bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditModalTeacher(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
                    style={{ borderColor: "var(--border)" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── RESET PASSWORD MODAL ── */}
      <AnimatePresence>
        {resetPassTeacher && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 rounded-2xl border bg-[var(--card-bg)] shadow-2xl space-y-4"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-amber-500" />
                  <h2 className="text-base font-bold text-[var(--text-primary)]">Reset Teacher Password</h2>
                </div>
                <button onClick={() => setResetPassTeacher(null)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-[var(--text-secondary)]">
                Resetting password for <strong>{resetPassTeacher.name}</strong> ({resetPassTeacher.email}).
              </p>

              <form onSubmit={handleResetPassword} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">New Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter new password (min 6 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs border bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
                    style={{ borderColor: "var(--border)" }}
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setResetPassTeacher(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
                    style={{ borderColor: "var(--border)" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? "Resetting..." : "Reset Password"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── DELETE CONFIRM MODAL ── */}
      <AnimatePresence>
        {deleteTeacherTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm p-6 rounded-2xl border bg-[var(--card-bg)] shadow-2xl space-y-4"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/15 text-red-600 flex items-center justify-center font-bold">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Delete Teacher Account?</h3>
                  <p className="text-xs text-[var(--text-secondary)]">This action cannot be undone.</p>
                </div>
              </div>

              <p className="text-xs text-[var(--text-muted)]">
                Are you sure you want to permanently remove <strong>{deleteTeacherTarget.name}</strong> from department <strong>{deleteTeacherTarget.department}</strong>?
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTeacherTarget(null)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold border bg-transparent text-[var(--text-secondary)] cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleDeleteTeacher}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Deleting..." : "Delete Account"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
