import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  SlidersHorizontal,
  Mail,
  Phone,
  FileDown,
  MailWarning,
  Eye,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  CheckCircle,
  AlertTriangle,
  Loader,
  Plus,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

function StudentsList() {
  const navigate = useNavigate();
  const token = getAuthToken();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters and Pagination
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    department: "",
    year: "",
    phone: "",
    atsScore: 0,
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [sendingEmailId, setSendingEmailId] = useState(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/admin/students", {
        params: { search, department, year, page, limit: 8 },
        headers: { Authorization: `Bearer ${token}` },
      });
      setStudents(data.students || []);
      setPages(data.pagination.pages || 1);
      setTotal(data.pagination.total || 0);
    } catch (error) {
      console.error("Error fetching students", error);
      toast.error("Failed to load student registry");
    } finally {
      setLoading(false);
    }
  }, [search, department, year, page, token]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleDeptChange = (e) => {
    setDepartment(e.target.value);
    setPage(1);
  };

  const handleYearChange = (e) => {
    setYear(e.target.value);
    setPage(1);
  };

  const handleSendEmailReport = async (studentId) => {
    setSendingEmailId(studentId);
    try {
      const { data } = await api.post(`/api/admin/students/${studentId}/email-report`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(data.message || "Report emailed successfully!");
    } catch (error) {
      console.error("Error sending email report", error);
      toast.error(error.response?.data?.message || "Failed to dispatch email report");
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleOpenEdit = (student) => {
    setSelectedStudent(student);
    setEditForm({
      name: student.name || "",
      department: student.department || "",
      year: student.year || "",
      phone: student.phone || "",
      atsScore: student.atsScore || 0,
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/api/admin/students/${selectedStudent._id}`, editForm, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Student details updated successfully");
      setEditModalOpen(false);
      fetchStudents();
    } catch (error) {
      console.error("Error saving edits", error);
      toast.error("Failed to save changes");
    }
  };

  const handleOpenDelete = (student) => {
    setStudentToDelete(student);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await api.delete(`/api/admin/students/${studentToDelete._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Student account removed");
      setDeleteConfirmOpen(false);
      fetchStudents();
    } catch (error) {
      console.error("Error deleting student", error);
      toast.error("Failed to remove student account");
    }
  };

  const handleExportAll = () => {
    window.open(`http://localhost:5000/api/admin/reports/export-all?Authorization=Bearer ${token}`, "_blank");
    toast.success("Downloading all students CSV list");
  };

  const handleDownloadSingleReport = (studentId, type) => {
    const route = type === "pdf" ? "pdf" : "csv";
    window.open(`http://localhost:5000/api/admin/students/${studentId}/${route}`, "_blank");
    toast.success(`Downloading performance ${type.toUpperCase()}`);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Student Database
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Review, edit, and dispatch mock reports for registered students ({total} total).
          </p>
        </motion.div>
        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={handleExportAll}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white btn-gradient cursor-pointer"
        >
          <FileDown className="w-4 h-4" />
          Export All Students (CSV)
        </motion.button>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <input
            value={search}
            onChange={handleSearchChange}
            placeholder="Search name or email..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none"
            style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
          />
        </div>

        <select
          value={department}
          onChange={handleDeptChange}
          className="px-4 py-2.5 rounded-xl border text-sm outline-none cursor-pointer"
          style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
        >
          <option value="">All Departments</option>
          <option value="Computer Science">Computer Science</option>
          <option value="Information Technology">Information Technology</option>
          <option value="Electronics & TC">Electronics & TC</option>
          <option value="Mechanical Engineering">Mechanical Engineering</option>
          <option value="Civil Engineering">Civil Engineering</option>
        </select>

        <select
          value={year}
          onChange={handleYearChange}
          className="px-4 py-2.5 rounded-xl border text-sm outline-none cursor-pointer"
          style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
        >
          <option value="">All Years</option>
          <option value="1st Year">1st Year</option>
          <option value="2nd Year">2nd Year</option>
          <option value="3rd Year">3rd Year</option>
          <option value="4th Year">4th Year</option>
        </select>
      </div>

      {/* Table Section */}
      <div className="student-card overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Loading students directory...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-20">
              <AlertTriangle className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>No students found matching filters.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b text-xs font-semibold uppercase tracking-wider bg-slate-50 dark:bg-zinc-900/50" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Department & Year</th>
                  <th className="px-6 py-4">Resume</th>
                  <th className="px-6 py-4">ATS Match</th>
                  <th className="px-6 py-4">Attempts</th>
                  <th className="px-6 py-4 text-center">Avg Score</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                {students.map((student, i) => (
                  <tr key={student._id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/10 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-bold text-sm shrink-0">
                          {student.name[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate max-w-[150px]">{student.name}</p>
                          <p className="text-xs truncate max-w-[150px]" style={{ color: "var(--text-muted)" }}>{student.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-xs">{student.department}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{student.year}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        student.resumeFileName
                          ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400"
                          : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400"
                      }`}>
                        {student.resumeFileName ? "Uploaded" : "Pending"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-xs" style={{ color: student.atsScore >= 75 ? "var(--success)" : "var(--primary)" }}>
                        {student.atsScore || 0}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-semibold text-xs">{student.attempts || 0}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-bold text-xs" style={{ color: student.avgScore >= 75 ? "var(--success)" : student.avgScore >= 50 ? "var(--primary)" : "var(--error)" }}>
                        {student.avgScore ? `${student.avgScore}%` : "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/students/${student._id}`)}
                          title="View Details"
                          className="p-1.5 rounded-lg border hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                          style={{ borderColor: "var(--border)", color: "var(--primary)" }}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(student)}
                          title="Edit Details"
                          className="p-1.5 rounded-lg border hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(student)}
                          title="Delete Student"
                          className="p-1.5 rounded-lg border hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                          style={{ borderColor: "var(--border)", color: "var(--error)" }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadSingleReport(student._id, "pdf")}
                          title="Download PDF"
                          className="p-1.5 rounded-lg border hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                          style={{ borderColor: "var(--border)", color: "var(--accent)" }}
                        >
                          <FileDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={sendingEmailId === student._id}
                          onClick={() => handleSendEmailReport(student._id)}
                          title="Email Report"
                          className="p-1.5 rounded-lg border hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
                          style={{ borderColor: "var(--border)", color: "#FF9900" }}
                        >
                          {sendingEmailId === student._id ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <Mail className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Page {page} of {pages}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-2 border rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
                className="p-2 border rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Student Modal */}
      <AnimatePresence>
        {editModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditModalOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md rounded-3xl p-6 sm:p-8 glass-card"
            >
              <h3 className="text-lg font-bold mb-4" style={{ color: "var(--text-primary)" }}>
                Edit Student Profile
              </h3>
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Full Name</label>
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Department</label>
                  <select
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none cursor-pointer"
                    style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                  >
                    <option value="Computer Science">Computer Science</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Electronics & TC">Electronics & TC</option>
                    <option value="Mechanical Engineering">Mechanical Engineering</option>
                    <option value="Civil Engineering">Civil Engineering</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Academic Year</label>
                  <select
                    value={editForm.year}
                    onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none cursor-pointer"
                    style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Phone Number</label>
                  <input
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Manual ATS Score adjustment (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editForm.atsScore}
                    onChange={(e) => setEditForm({ ...editForm, atsScore: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-xl text-sm outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
                  />
                </div>
                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(false)}
                    className="flex-1 py-2.5 border rounded-xl text-xs font-semibold cursor-pointer"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white btn-gradient cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
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
                Are you sure you want to delete the student account for <strong>{studentToDelete?.name}</strong>? This action is permanent and clears all mock history files.
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
                  Delete Student
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default StudentsList;
