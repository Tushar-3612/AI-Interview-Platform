import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Users, FileText, Send, AlertTriangle, Eye, X } from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

function EmailManagement() {
  const token = getAuthToken();
  const headers = { Authorization: `Bearer ${token}` };
  const [students, setStudents] = useState([]);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [previewEmail, setPreviewEmail] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [form, setForm] = useState({
    type: "assignment", subject: "", message: "",
    studentIds: [], testId: "", companyId: "",
  });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get("/api/users", { params: { role: "student" }, headers }),
      api.get("/api/email/history", { headers }),
    ]).then(([uRes, hRes]) => {
      setStudents(uRes.data?.users || uRes.data || []);
      setHistory(hRes.data || []);
    }).catch(() => toast.error("Failed to load data"))
    .finally(() => setLoading(false));
  }, []);

  const toggleStudent = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
    setSelectAll(false);
  };

  const toggleAll = () => {
    if (selectAll) { setSelected([]); setSelectAll(false); }
    else { setSelected(students.map(s => s._id)); setSelectAll(true); }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (selected.length === 0 && form.studentIds.length === 0) { toast.error("Select at least one student"); return; }
    setSending(true);
    try {
      const payload = {
        ...form,
        studentIds: form.studentIds.length > 0 ? form.studentIds : selected,
      };
      await api.post("/api/email/send", payload, { headers });
      toast.success("Emails sent"); setComposeOpen(false);
      const hRes = await api.get("/api/email/history", { headers });
      setHistory(hRes.data || []);
    } catch (err) { toast.error(err.response?.data?.message || "Failed to send"); }
    finally { setSending(false); }
  };

  const openCompose = () => {
    setForm({ type: "assignment", subject: "", message: "", studentIds: [], testId: "", companyId: "" });
    setComposeOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Email Management</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Send emails to students and track history</p>
        </div>
        <button onClick={openCompose} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer" style={{ background: "var(--primary)" }}>
          <Send className="w-4 h-4" /> Compose
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[["All Students", students.length, "var(--primary)"], ["Sent Today", history.filter(h => new Date(h.sentAt).toDateString() === new Date().toDateString()).length, "#f59e0b"], ["Total Sent", history.length, "var(--success)"], ["Failed", history.filter(h => h.status === "failed").length, "var(--error)"]].map(([l, v, c]) => (
          <div key={l} className="border rounded-xl p-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{l}</p>
            <p className="text-xl font-bold" style={{ color: c }}>{v}</p>
          </div>
        ))}
      </div>

      <div className="border rounded-2xl" style={{ borderColor: "var(--border)" }}>
        <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={selectAll} onChange={toggleAll} className="rounded" />
            <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Student List ({selected.length} selected)</span>
            {selected.length > 0 && (
              <button onClick={openCompose} className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer" style={{ background: "var(--primary)" }}>
                <Mail className="w-3 h-3" /> Email {selected.length}
              </button>
            )}
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" /></div>
          ) : students.length === 0 ? (
            <p className="text-center py-10 text-xs" style={{ color: "var(--text-muted)" }}>No students found.</p>
          ) : students.map((student) => (
            <label key={student._id} className="flex items-center gap-3 px-4 py-2.5 border-b cursor-pointer" style={{ borderColor: "var(--border) " }}>
              <input type="checkbox" checked={selected.includes(student._id)} onChange={() => toggleStudent(student._id)} className="rounded" />
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: "var(--primary)" }}>
                {student.name?.[0]?.toUpperCase() || student.email?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{student.name || "N/A"}</p>
                <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{student.email}</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: student.department ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "transparent", color: "var(--primary)" }}>{student.department || "N/A"}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="border rounded-2xl" style={{ borderColor: "var(--border)" }}>
        <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Email History</h3>
        </div>
        {history.length === 0 ? (
          <p className="text-center py-8 text-xs" style={{ color: "var(--text-muted)" }}>No emails sent yet.</p>
        ) : (
          <div>{history.map((h, i) => (
            <div key={h._id || i} className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${h.status === "sent" ? "text-green-500 bg-green-50 dark:bg-green-900/20" : "text-red-500 bg-red-50 dark:bg-red-900/20"}`}>
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{h.subject || h.type} – {h.recipientCount || "N/A"} recipients</p>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{new Date(h.sentAt).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${h.status === "sent" ? "text-green-600 bg-green-50 dark:bg-green-900/20" : "text-red-500 bg-red-50 dark:bg-red-900/20"}`}>{h.status}</span>
                <button onClick={() => setPreviewEmail(h)} className="p-1.5 rounded-lg cursor-pointer" style={{ color: "var(--text-secondary)" }}><Eye className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}</div>
        )}
      </div>

      {/* Compose Modal */}
      <AnimatePresence>{composeOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: "var(--admin-modal-overlay)" }}
          onClick={() => setComposeOpen(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
            className="border rounded-2xl p-6 w-full max-w-lg" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-2" style={{ color: "var(--text-primary)" }}>Compose Email</h3>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>To: {selected.length > 0 ? `${selected.length} selected students` : "No students selected"}</p>
            <form onSubmit={handleSend} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Email Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-xl bg-transparent outline-none" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  <option value="assignment">Test Assignment</option>
                  <option value="result">Test Result</option>
                  <option value="reminder">Reminder</option>
                  <option value="welcome">Welcome</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Subject</label>
                <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-xl bg-transparent outline-none" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} required />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Message</label>
                <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} rows={4} className="w-full px-3 py-2 text-sm border rounded-xl bg-transparent outline-none" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} required />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setComposeOpen(false)} className="flex-1 py-2.5 text-xs font-semibold border rounded-xl cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
                <button type="submit" disabled={sending} className="flex-1 py-2.5 text-xs font-semibold text-white rounded-xl cursor-pointer disabled:opacity-50" style={{ background: "var(--primary)" }}>
                  {sending ? "Sending..." : "Send Email"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>{previewEmail && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: "var(--admin-modal-overlay)" }}
          onClick={() => setPreviewEmail(null)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
            className="border rounded-2xl p-6 w-full max-w-lg" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Email Details</h3>
              <button onClick={() => setPreviewEmail(null)} className="cursor-pointer" style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2 text-xs">
              <p><span style={{ color: "var(--text-muted)" }}>Type:</span> <span style={{ color: "var(--text-primary)" }}>{previewEmail.type}</span></p>
              <p><span style={{ color: "var(--text-muted)" }}>Subject:</span> <span style={{ color: "var(--text-primary)" }}>{previewEmail.subject}</span></p>
              <p><span style={{ color: "var(--text-muted)" }}>Sent:</span> <span style={{ color: "var(--text-primary)" }}>{new Date(previewEmail.sentAt).toLocaleString()}</span></p>
              <p><span style={{ color: "var(--text-muted)" }}>Status:</span> <span className={previewEmail.status === "sent" ? "text-green-500" : "text-red-500"}>{previewEmail.status}</span></p>
              {previewEmail.body && <div className="mt-2 p-3 border rounded-xl" style={{ borderColor: "var(--border)" }}><p style={{ color: "var(--text-secondary)" }}>{previewEmail.body}</p></div>}
            </div>
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}

export default EmailManagement;
