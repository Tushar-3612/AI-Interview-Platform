import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search, Filter, Trash2, Eye, Clock, CheckCircle, XCircle,
  Users, FileText, Download, ChevronDown, ChevronUp, Calendar,
  AlertCircle, Edit, Send, Plus, RefreshCw, X, Ban,
  GraduationCap, BookOpen, Code, BarChart, Mail, Shield,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════════════════════ */
const DEPARTMENTS = ["Computer Engineering", "IT Engineering", "Electronics Engineering", "Mechanical Engineering", "Civil Engineering", "ENTC Engineering", "AI & DS"];
const YEARS = ["FE", "SE", "TE", "BE"];
const SECTIONS = ["A", "B", "C"];
const TEST_TYPES = ["aptitude", "technical", "coding", "mixed"];
const STATUS_OPTIONS = ["draft", "scheduled", "live", "completed", "cancelled"];
const TEST_STATUS_OPTIONS = ["all", "active", "completed", "archived"];
const RESCHEDULE_REASONS = ["Network Failure", "Browser Crash", "Technical Issue"];

const PAGE_SIZE = 10;

const statusBadge = (s) => {
  const map = {
    draft: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
    scheduled: "bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
    live: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    completed: "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    cancelled: "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
    active: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    archived: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700",
  };
  return map[s?.toLowerCase()] || map.draft;
};

const studentStatusBadge = (s) => {
  const map = {
    "not started": "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
    started: "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400",
    completed: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400",
    "auto submitted": "bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400",
  };
  return map[s?.toLowerCase()] || map["not started"];
};

/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ══════════════════════════════════════════════════════════════ */
function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function EmptyState({ onNavigate }) {
  return (
    <div className="border admin-border admin-card rounded-xl p-12 text-center">
      <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
      <h3 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No Assigned Tests Found</h3>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Create a test and assign it to students to get started.</p>
      <button onClick={onNavigate}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white rounded-lg cursor-pointer"
        style={{ background: "var(--primary)" }}>
        <Plus className="w-3.5 h-3.5" /> Create Test
      </button>
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="border admin-border admin-card rounded-xl p-12 text-center">
      <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--badge-error-text)" }} />
      <h3 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Failed to Load</h3>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Something went wrong. Please try again.</p>
      <button onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium border admin-border rounded-lg admin-hover cursor-pointer">
        <RefreshCw className="w-3.5 h-3.5" /> Retry
      </button>
    </div>
  );
}

function FilterBar({ filters, onFilterChange, companies }) {
  const activeCount = Object.values(filters).filter(v => v && v !== "all" && v !== "").length;

  return (
    <div className="border admin-border admin-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          <Filter className="w-3.5 h-3.5" /> Filters {activeCount > 0 && `(${activeCount})`}
        </div>
        {activeCount > 0 && (
          <button onClick={() => onFilterChange({
            search: "", company: "all", department: "all", year: "all",
            section: "all", testType: "all", status: "all", dateFrom: "", dateTo: "",
          })}
            className="text-xs px-2 py-1 rounded admin-hover cursor-pointer"
            style={{ color: "var(--primary)" }}>
            Clear All
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-2.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: "var(--text-muted)" }} />
          <input value={filters.search} onChange={e => onFilterChange({ ...filters, search: e.target.value })}
            className="w-full pl-7 pr-2 py-1.5 text-xs border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            style={{ color: "var(--text-primary)" }} placeholder="Search test..." />
        </div>
        <select value={filters.company} onChange={e => onFilterChange({ ...filters, company: e.target.value })}
          className="text-xs px-2 py-1.5 border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] admin-select"
          style={{ color: "var(--text-primary)" }}>
          <option value="all">All Companies</option>
          {companies.map(c => <option key={c._id || c.name} value={c.name}>{c.name}</option>)}
        </select>
        <select value={filters.department} onChange={e => onFilterChange({ ...filters, department: e.target.value })}
          className="text-xs px-2 py-1.5 border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] admin-select"
          style={{ color: "var(--text-primary)" }}>
          <option value="all">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
        </select>
        <select value={filters.year} onChange={e => onFilterChange({ ...filters, year: e.target.value })}
          className="text-xs px-2 py-1.5 border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] admin-select"
          style={{ color: "var(--text-primary)" }}>
          <option value="all">All Years</option>
          {YEARS.map(y => <option key={y}>{y}</option>)}
        </select>
        <select value={filters.section} onChange={e => onFilterChange({ ...filters, section: e.target.value })}
          className="text-xs px-2 py-1.5 border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] admin-select"
          style={{ color: "var(--text-primary)" }}>
          <option value="all">All Sections</option>
          {SECTIONS.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filters.testType} onChange={e => onFilterChange({ ...filters, testType: e.target.value })}
          className="text-xs px-2 py-1.5 border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] admin-select"
          style={{ color: "var(--text-primary)" }}>
          <option value="all">All Types</option>
          {TEST_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
        <select value={filters.status} onChange={e => onFilterChange({ ...filters, status: e.target.value })}
          className="text-xs px-2 py-1.5 border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] admin-select"
          style={{ color: "var(--text-primary)" }}>
          {TEST_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <input type="date" value={filters.dateFrom} onChange={e => onFilterChange({ ...filters, dateFrom: e.target.value })}
          className="text-xs px-2 py-1.5 border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          style={{ color: "var(--text-primary)" }} title="From date" />
      </div>
    </div>
  );
}

function StatsCards({ data }) {
  const cards = [
    { label: "Assigned", value: data.totalAssigned || 0, icon: Users, color: "var(--primary)" },
    { label: "Started", value: data.totalStarted || 0, icon: Clock, color: "var(--badge-warning-text)" },
    { label: "Completed", value: data.totalCompleted || 0, icon: CheckCircle, color: "var(--badge-success-text)" },
    { label: "Not Attempted", value: data.totalNotAttempted || 0, icon: XCircle, color: "var(--badge-error-text)" },
    { label: "Auto Submitted", value: data.totalAutoSubmitted || 0, icon: Ban, color: "var(--badge-warning-text)" },
    { label: "Passed", value: data.totalPassed || 0, icon: CheckCircle, color: "var(--success)" },
    { label: "Failed", value: data.totalFailed || 0, icon: XCircle, color: "var(--error)" },
    { label: "Avg Score", value: `${data.avgScore || 0}%`, icon: BarChart, color: "var(--primary)" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <motion.div key={c.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="border admin-border admin-card rounded-xl p-3 text-center">
            <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: c.color }} />
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{c.value}</p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{c.label}</p>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MODALS
   ══════════════════════════════════════════════════════════════ */
function DeleteConfirmModal({ assignment, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-[#111] rounded-xl border border-gray-200 dark:border-zinc-800 w-full max-w-sm mx-4 p-5 space-y-4"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--badge-error-bg)" }}>
            <AlertCircle className="w-5 h-5" style={{ color: "var(--badge-error-text)" }} />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Delete Test Assignment?</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              This will permanently remove <strong>{assignment?.testId?.title || "this assignment"}</strong> and all associated data.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium border admin-border rounded-lg admin-hover cursor-pointer">
            Cancel
          </button>
          <button onClick={() => onConfirm(assignment._id)}
            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 cursor-pointer">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function RescheduleModal({ assignment, onConfirm, onClose, saving }) {
  const [reason, setReason] = useState("");
  const [newDate, setNewDate] = useState("");

  const handleSubmit = () => {
    if (!reason) { toast.error("Select a reason"); return; }
    if (!newDate) { toast.error("Select a new date"); return; }
    onConfirm(assignment._id, { reason, newDate });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-[#111] rounded-xl border border-gray-200 dark:border-zinc-800 w-full max-w-md mx-4 p-5 space-y-4"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Calendar className="w-4 h-4" /> Reschedule Test
          </h3>
          <button onClick={onClose} className="p-1 rounded admin-hover cursor-pointer">
            <X className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Reschedule <strong>{assignment?.testId?.title}</strong>
        </p>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Reason *</label>
          <select value={reason} onChange={e => setReason(e.target.value)}
            className="w-full px-3 py-2 text-xs border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] admin-select"
            style={{ color: "var(--text-primary)" }}>
            <option value="">Select reason</option>
            {RESCHEDULE_REASONS.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>New Date & Time *</label>
          <input type="datetime-local" value={newDate} onChange={e => setNewDate(e.target.value)}
            className="w-full px-3 py-2 text-xs border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            style={{ color: "var(--text-primary)" }} />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium border admin-border rounded-lg admin-hover cursor-pointer">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-3 py-1.5 text-xs font-medium text-white rounded-lg cursor-pointer disabled:opacity-50"
            style={{ background: "var(--primary)" }}>
            {saving ? "Rescheduling..." : "Reschedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailReportModal({ assignment, students, onClose }) {
  const [selectedStudent, setSelectedStudent] = useState("");
  const [sending, setSending] = useState(false);
  const token = getAuthToken();

  const handleSend = async () => {
    if (!selectedStudent) { toast.error("Select a student"); return; }
    setSending(true);
    try {
      await api.post(`/api/admin/students/${selectedStudent}/email-report`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Report sent to student's email");
      onClose();
    } catch {
      toast.error("Failed to send report");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-[#111] rounded-xl border border-gray-200 dark:border-zinc-800 w-full max-w-md mx-4 p-5 space-y-4"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Mail className="w-4 h-4" /> Email Report
          </h3>
          <button onClick={onClose} className="p-1 rounded admin-hover cursor-pointer">
            <X className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Send test report to an individual student's registered email.
        </p>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Student *</label>
          <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}
            className="w-full px-3 py-2 text-xs border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] admin-select"
            style={{ color: "var(--text-primary)" }}>
            <option value="">Select a student</option>
            {(students || []).map(s => (
              <option key={s._id} value={s._id}>{s.name} ({s.email})</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium border admin-border rounded-lg admin-hover cursor-pointer">
            Cancel
          </button>
          <button onClick={handleSend} disabled={sending || !selectedStudent}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg cursor-pointer disabled:opacity-50"
            style={{ background: "var(--primary)" }}>
            <Mail className="w-3 h-3" /> {sending ? "Sending..." : "Send Report"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewTestModal({ assignment, onClose, onEdit, onDelete, onReschedule, onEmail }) {
  const test = assignment?.testId || {};
  const students = assignment?.studentIds || [];
  const questions = test?.questions || [];
  const inpCls = "w-full px-3 py-2 text-xs border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)]";
  const [studentFilter, setStudentFilter] = useState("");

  const aptitudeQ = questions.filter(q => q.type !== "Coding" && !q.subject);
  const technicalQ = questions.filter(q => q.type !== "Coding" && q.subject);
  const codingQ = questions.filter(q => q.type === "Coding");

  const filteredStudents = students.filter(s => {
    const q = studentFilter.toLowerCase();
    return !q || s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.department?.toLowerCase().includes(q);
  });

  const totalMarks = questions.reduce((s, q) => s + (q.marks || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-6 pb-6 overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-[#111] rounded-xl border border-gray-200 dark:border-zinc-800 w-full max-w-5xl mx-4"
        onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white dark:bg-[#111] rounded-t-xl border-b border-gray-200 dark:border-zinc-800 px-5 py-4 flex items-center justify-between">
          <h2 className="text-sm font-bold truncate pr-4" style={{ color: "var(--text-primary)" }}>{test.title || "Test Details"}</h2>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => onEdit(test)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border admin-border rounded-lg admin-hover cursor-pointer">
              <Edit className="w-3 h-3" /> Edit
            </button>
            <button onClick={() => onEmail(assignment)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border admin-border rounded-lg admin-hover cursor-pointer">
              <Mail className="w-3 h-3" /> Email
            </button>
            <button onClick={onClose} className="p-1.5 rounded admin-hover cursor-pointer">
              <X className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* General Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 border admin-border admin-card rounded-xl p-4">
              <h4 className="text-xs font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>General Information</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                {[
                  ["Test Name", test.title],
                  ["Company", test.companyId || "N/A"],
                  ["Description", test.description || "N/A"],
                  ["Test Type", test.testType],
                  ["Difficulty", test.difficulty],
                  ["Duration", `${test.duration} min`],
                  ["Passing Marks", `${test.passingMarks}%`],
                  ["Total Questions", `${questions.length}`],
                  ["Total Marks", `${totalMarks}`],
                  ["Attempt Limit", test.attemptLimit],
                  ["Created", test.createdAt ? new Date(test.createdAt).toLocaleDateString() : "N/A"],
                  ["Status", test.status],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center gap-2">
                    <span style={{ color: "var(--text-muted)" }}>{label}:</span>
                    <span className="font-medium truncate" style={{ color: "var(--text-primary)" }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border admin-border admin-card rounded-xl p-4">
              <h4 className="text-xs font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>Assignment Info</h4>
              <div className="space-y-2.5 text-xs">
                {[
                  ["Department", assignment?.assignType === "department" ? assignment.assignValue : "All"],
                  ["Academic Year", assignment?.assignType === "year" ? assignment.assignValue : "All"],
                  ["Section", assignment?.assignType === "section" ? assignment.assignValue : "All"],
                  ["Assigned Students", students.length],
                  ["Assign Type", assignment?.assignType],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span style={{ color: "var(--text-muted)" }}>{label}</span>
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>{value}</span>
                  </div>
                ))}
              </div>
              {/* Stats */}
              <div className="mt-4 pt-3 border-t admin-table-divider grid grid-cols-2 gap-2 text-xs">
                {[
                  ["Started", assignment?.startedCount || 0],
                  ["Completed", assignment?.completedCount || 0],
                  ["Not Attempted", assignment?.notAttemptedCount || 0],
                  ["Auto Submitted", assignment?.autoSubmittedCount || 0],
                  ["Avg Score", `${assignment?.averageScore || 0}%`],
                  ["Highest", assignment?.highestScore ? `${assignment.highestScore}%` : "N/A"],
                  ["Lowest", assignment?.lowestScore ? `${assignment.lowestScore}%` : "N/A"],
                  ["Passed", assignment?.passedCount || "N/A"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span style={{ color: "var(--text-muted)" }}>{label}</span>
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Question Summary */}
          <div className="border admin-border admin-card rounded-xl p-4">
            <h4 className="text-xs font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
              <BookOpen className="w-3.5 h-3.5" /> Question Summary
            </h4>
            <div className="space-y-4">
              {aptitudeQ.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: "var(--primary)" }}>Aptitude Questions ({aptitudeQ.length})</p>
                  <div className="space-y-1.5">
                    {aptitudeQ.map((q, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 rounded-lg admin-bg-surface text-xs">
                        <span className="font-semibold shrink-0" style={{ color: "var(--text-muted)" }}>Q{idx + 1}</span>
                        <p className="flex-1 truncate" style={{ color: "var(--text-primary)" }}>{q.question}</p>
                        <span className="px-1.5 py-0.5 rounded text-[10px] capitalize" style={{ background: "var(--badge-info-bg)", color: "var(--badge-info-text)" }}>{q.difficulty || "medium"}</span>
                        <span className="font-medium shrink-0" style={{ color: "var(--text-secondary)" }}>{q.marks} marks</span>
                        {q.correctAnswer && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "color-mix(in srgb, var(--success) 12%, transparent)", color: "var(--success)" }}>
                            Ans: {q.correctAnswer}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {technicalQ.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: "var(--primary)" }}>Technical Questions ({technicalQ.length})</p>
                  <div className="space-y-1.5">
                    {technicalQ.map((q, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 rounded-lg admin-bg-surface text-xs">
                        <span className="font-semibold shrink-0" style={{ color: "var(--text-muted)" }}>Q{idx + 1}</span>
                        <p className="flex-1 truncate" style={{ color: "var(--text-primary)" }}>{q.question}</p>
                        {q.subject && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--badge-warning-bg)", color: "var(--badge-warning-text)" }}>{q.subject}</span>}
                        <span className="px-1.5 py-0.5 rounded text-[10px] capitalize" style={{ background: "var(--badge-info-bg)", color: "var(--badge-info-text)" }}>{q.difficulty || "medium"}</span>
                        <span className="font-medium shrink-0" style={{ color: "var(--text-secondary)" }}>{q.marks} marks</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {codingQ.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: "var(--badge-success-text)" }}>Coding Problems ({codingQ.length})</p>
                  <div className="space-y-1.5">
                    {codingQ.map((q, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 rounded-lg admin-bg-surface text-xs">
                        <span className="font-semibold shrink-0" style={{ color: "var(--text-muted)" }}>P{idx + 1}</span>
                        <p className="flex-1 truncate" style={{ color: "var(--text-primary)" }}>{q.problemTitle || q.question}</p>
                        <span className="px-1.5 py-0.5 rounded text-[10px] capitalize" style={{ background: "var(--badge-info-bg)", color: "var(--badge-info-text)" }}>{q.difficulty || "medium"}</span>
                        <span className="font-medium shrink-0" style={{ color: "var(--text-secondary)" }}>{q.marks} marks</span>
                        <span style={{ color: "var(--text-muted)" }}>{(q.languages || []).join(", ")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {questions.length === 0 && (
                <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>No questions added yet.</p>
              )}
            </div>
          </div>

          {/* Student Status */}
          <div className="border admin-border admin-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                <Users className="w-3.5 h-3.5" /> Student Status ({students.length})
              </h4>
              <div className="relative max-w-[200px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: "var(--text-muted)" }} />
                <input value={studentFilter} onChange={e => setStudentFilter(e.target.value)}
                  className="w-full pl-7 pr-2 py-1 text-xs border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  style={{ color: "var(--text-primary)" }} placeholder="Filter students..." />
              </div>
            </div>

            {students.length === 0 ? (
              <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>No students assigned.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b admin-table-divider text-left" style={{ color: "var(--text-muted)" }}>
                      <th className="pb-2 pr-2 font-semibold">#</th>
                      <th className="pb-2 pr-2 font-semibold">Name</th>
                      <th className="pb-2 pr-2 font-semibold hidden sm:table-cell">Email</th>
                      <th className="pb-2 pr-2 font-semibold hidden md:table-cell">Department</th>
                      <th className="pb-2 pr-2 font-semibold">Status</th>
                      <th className="pb-2 pr-2 font-semibold text-right">Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s, idx) => (
                      <tr key={s._id} className="border-b admin-table-divider admin-hover">
                        <td className="py-2 pr-2" style={{ color: "var(--text-muted)" }}>{idx + 1}</td>
                        <td className="py-2 pr-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0" style={{ background: "var(--admin-surface-hover)", color: "var(--text-secondary)" }}>
                              {s.name?.[0]?.toUpperCase()}
                            </div>
                            <span className="font-medium truncate max-w-[120px]" style={{ color: "var(--text-primary)" }}>{s.name}</span>
                          </div>
                        </td>
                        <td className="py-2 pr-2 hidden sm:table-cell" style={{ color: "var(--text-secondary)" }}>{s.email}</td>
                        <td className="py-2 pr-2 hidden md:table-cell" style={{ color: "var(--text-secondary)" }}>{s.department} - {s.year}</td>
                        <td className="py-2 pr-2">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${studentStatusBadge("not started")}`}>
                            Not Started
                          </span>
                        </td>
                        <td className="py-2 pr-2 text-right" style={{ color: "var(--text-muted)" }}>-</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {studentFilter && filteredStudents.length === 0 && (
                  <p className="text-xs py-3 text-center" style={{ color: "var(--text-muted)" }}>No students match filter.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
function AssignedTests() {
  const navigate = useNavigate();
  const token = getAuthToken();

  const [assignments, setAssignments] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    search: "", company: "all", department: "all", year: "all",
    section: "all", testType: "all", status: "all", dateFrom: "", dateTo: "",
  });
  const [sortField, setSortField] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);

  const [viewModal, setViewModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [emailModal, setEmailModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [assignRes, compRes] = await Promise.all([
        api.get("/api/tests/assignments/list", { headers }),
        api.get("/api/admin/companies", { headers }).catch(() => ({ data: [] })),
      ]);
      setAssignments(assignRes.data || []);
      setCompanies(compRes.data || []);
    } catch (err) {
      setError("Failed to load assigned tests");
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Filter & Sort ── */
  const filtered = useMemo(() => {
    return assignments
      .filter(a => {
        const test = a.testId || {};
        const q = filters.search.toLowerCase();
        if (q && !test.title?.toLowerCase().includes(q) && !test.testType?.includes(q) && !a.assignType?.includes(q)) return false;
        if (filters.company !== "all" && test.companyId !== filters.company) return false;
        if (filters.testType !== "all" && test.testType !== filters.testType) return false;
        if (filters.status !== "all" && a.status !== filters.status) return false;
        if (filters.department !== "all" && a.assignType === "department" && a.assignValue !== filters.department) return false;
        if (filters.department !== "all" && a.assignType !== "department") return false;
        if (filters.year !== "all" && a.assignType === "year" && a.assignValue !== filters.year) return false;
        if (filters.year !== "all" && a.assignType !== "year") return false;
        const d = new Date(a.createdAt);
        if (filters.dateFrom && d < new Date(filters.dateFrom)) return false;
        if (filters.dateTo) {
          const end = new Date(filters.dateTo);
          end.setDate(end.getDate() + 1);
          if (d > end) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let va, vb;
        switch (sortField) {
          case "title": va = a.testId?.title?.toLowerCase() || ""; vb = b.testId?.title?.toLowerCase() || ""; break;
          case "testType": va = a.testId?.testType || ""; vb = b.testId?.testType || ""; break;
          case "totalStudents": va = a.totalStudents || 0; vb = b.totalStudents || 0; break;
          case "completedCount": va = a.completedCount || 0; vb = b.completedCount || 0; break;
          case "averageScore": va = a.averageScore || 0; vb = b.averageScore || 0; break;
          case "status": va = a.status || ""; vb = b.status || ""; break;
          default: va = new Date(a.createdAt).getTime(); vb = new Date(b.createdAt).getTime();
        }
        if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
        return sortDir === "asc" ? va - vb : vb - va;
      });
  }, [assignments, filters, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ── Aggregate Stats ── */
  const stats = useMemo(() => ({
    totalAssigned: filtered.reduce((s, a) => s + (a.totalStudents || 0), 0),
    totalStarted: filtered.reduce((s, a) => s + (a.startedCount || 0), 0),
    totalCompleted: filtered.reduce((s, a) => s + (a.completedCount || 0), 0),
    totalNotAttempted: filtered.reduce((s, a) => s + (a.notAttemptedCount || 0), 0),
    totalAutoSubmitted: filtered.reduce((s, a) => s + (a.autoSubmittedCount || 0), 0),
    avgScore: filtered.length > 0 ? Math.round(filtered.reduce((s, a) => s + (a.averageScore || 0), 0) / filtered.length) : 0,
    totalPassed: filtered.reduce((s, a) => s + (a.passedCount || 0), 0),
    totalFailed: filtered.reduce((s, a) => s + (a.failedCount || 0), 0),
  }), [filtered]);

  /* ── Handlers ── */
  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/tests/assignments/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAssignments(prev => prev.filter(a => a._id !== id));
      toast.success("Assignment deleted");
      setDeleteConfirm(null);
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleReschedule = async (id, { reason, newDate }) => {
    setSaving(true);
    try {
      const assignment = assignments.find(a => a._id === id);
      if (!assignment?.testId?._id) { toast.error("Test not found"); setSaving(false); return; }
      await api.put(`/api/tests/${assignment.testId._id}`, { scheduledAt: newDate, status: "scheduled" }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`Test rescheduled to ${new Date(newDate).toLocaleString()}`);
      setRescheduleModal(null);
      fetchData();
    } catch {
      toast.error("Failed to reschedule");
    } finally {
      setSaving(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const handleExportCSV = () => {
    const rows = filtered.map(a => ({
      "Test Name": a.testId?.title || "N/A",
      Company: a.testId?.companyId || "N/A",
      "Test Type": a.testId?.testType || "N/A",
      Department: a.assignType === "department" ? a.assignValue : "All",
      "Academic Year": a.assignType === "year" ? a.assignValue : "All",
      Section: a.assignType === "section" ? a.assignValue : "All",
      "Assigned Students": a.totalStudents || 0,
      Started: a.startedCount || 0,
      Completed: a.completedCount || 0,
      "Not Attempted": a.notAttemptedCount || 0,
      "Auto Submitted": a.autoSubmittedCount || 0,
      "Average Score": a.averageScore ? `${a.averageScore}%` : "0%",
      Status: a.status || "N/A",
      "Created Date": new Date(a.createdAt).toLocaleDateString(),
    }));
    const csv = [
      Object.keys(rows[0] || {}).join(","),
      ...rows.map(r => Object.values(r).map(v => `"${v}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `assigned_tests_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const handleExportExcel = () => {
    const data = filtered.map(a => ({
      "Test Name": a.testId?.title || "N/A",
      Company: a.testId?.companyId || "N/A",
      "Test Type": a.testId?.testType || "N/A",
      Department: a.assignType === "department" ? a.assignValue : "All",
      "Academic Year": a.assignType === "year" ? a.assignValue : "All",
      Section: a.assignType === "section" ? a.assignValue : "All",
      "Assigned Students": a.totalStudents || 0,
      Started: a.startedCount || 0,
      Completed: a.completedCount || 0,
      "Not Attempted": a.notAttemptedCount || 0,
      "Auto Submitted": a.autoSubmittedCount || 0,
      "Average Score": a.averageScore ? `${a.averageScore}%` : "0%",
      Status: a.status || "N/A",
      "Created Date": new Date(a.createdAt).toLocaleDateString(),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AssignedTests");
    XLSX.writeFile(wb, `assigned_tests_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel exported");
  };

  const toggleSort = (field) => (
    <span className="ml-1 text-[10px]" style={{ color: sortField === field ? "var(--primary)" : "var(--text-muted)" }}>
      {sortField === field ? (sortDir === "asc" ? "▲" : "▼") : "▲▼"}
    </span>
  );

  /* ── Render ── */
  if (loading) return <Spinner />;
  if (error) return <ErrorState onRetry={fetchData} />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Assigned Tests</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {filtered.length} test{filtered.length !== 1 ? "s" : ""} found
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border admin-border rounded-lg admin-hover cursor-pointer">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border admin-border rounded-lg admin-hover cursor-pointer">
            <FileText className="w-3.5 h-3.5" /> Excel
          </button>
          <button onClick={() => navigate("/admin/tests/create")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg cursor-pointer"
            style={{ background: "var(--primary)" }}>
            <Plus className="w-3.5 h-3.5" /> Create Test
          </button>
        </div>
      </div>

      {/* Filters */}
      <FilterBar filters={filters} onFilterChange={(f) => { setFilters(f); setPage(1); }} companies={companies} />

      {/* Stats */}
      <StatsCards data={stats} />

      {/* Empty state */}
      {filtered.length === 0 && !loading && (
        <EmptyState onNavigate={() => navigate("/admin/tests/create")} />
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div className="border admin-border admin-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b admin-table-divider" style={{ color: "var(--text-muted)" }}>
                  {[
                    { key: "title", label: "Test Name" },
                    { key: null, label: "Company" },
                    { key: "testType", label: "Type" },
                    { key: null, label: "Department" },
                    { key: null, label: "Year" },
                    { key: null, label: "Section" },
                    { key: "totalStudents", label: "Students" },
                    { key: null, label: "Started" },
                    { key: "completedCount", label: "Completed" },
                    { key: null, label: "Not Attempted" },
                    { key: null, label: "Auto Submitted" },
                    { key: "averageScore", label: "Avg Score" },
                    { key: "status", label: "Status" },
                    { key: null, label: "Actions" },
                  ].map(col => (
                    <th key={col.label} className={`pb-2.5 pr-2 font-semibold whitespace-nowrap ${col.key ? "cursor-pointer select-none" : ""}`}
                      onClick={() => col.key && handleSort(col.key)}
                      style={{ color: sortField === col.key ? "var(--primary)" : "var(--text-muted)" }}>
                      {col.label}{col.key && toggleSort(col.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((a) => {
                  const test = a.testId || {};
                  return (
                    <tr key={a._id} className="border-b admin-table-divider admin-hover">
                      <td className="py-2.5 pr-2">
                        <button onClick={() => setViewModal(a)}
                          className="font-medium text-left hover:underline cursor-pointer truncate max-w-[140px] block"
                          style={{ color: "var(--text-primary)" }}>
                          {test.title || "Untitled"}
                        </button>
                      </td>
                      <td className="py-2.5 pr-2" style={{ color: "var(--text-secondary)" }}>{test.companyId || "-"}</td>
                      <td className="py-2.5 pr-2">
                        <span className="capitalize text-[10px] font-medium px-1.5 py-0.5 rounded"
                          style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>
                          {test.testType || "N/A"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2" style={{ color: "var(--text-secondary)" }}>
                        {a.assignType === "department" ? a.assignValue : "All"}
                      </td>
                      <td className="py-2.5 pr-2" style={{ color: "var(--text-secondary)" }}>
                        {a.assignType === "year" ? a.assignValue : "All"}
                      </td>
                      <td className="py-2.5 pr-2" style={{ color: "var(--text-secondary)" }}>
                        {a.assignType === "section" ? a.assignValue : "All"}
                      </td>
                      <td className="py-2.5 pr-2 font-medium" style={{ color: "var(--text-primary)" }}>{a.totalStudents || 0}</td>
                      <td className="py-2.5 pr-2" style={{ color: "var(--badge-warning-text)" }}>{a.startedCount || 0}</td>
                      <td className="py-2.5 pr-2" style={{ color: "var(--badge-success-text)" }}>{a.completedCount || 0}</td>
                      <td className="py-2.5 pr-2" style={{ color: "var(--badge-error-text)" }}>{a.notAttemptedCount || 0}</td>
                      <td className="py-2.5 pr-2" style={{ color: "var(--badge-warning-text)" }}>{a.autoSubmittedCount || 0}</td>
                      <td className="py-2.5 pr-2 font-medium" style={{ color: (a.averageScore || 0) >= 40 ? "var(--badge-success-text)" : "var(--badge-error-text)" }}>
                        {a.averageScore ? `${a.averageScore}%` : "0%"}
                      </td>
                      <td className="py-2.5 pr-2">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${statusBadge(a.status)}`}>
                          {a.status || "draft"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setViewModal(a)}
                            className="p-1 rounded admin-hover cursor-pointer" title="View">
                            <Eye className="w-3.5 h-3.5" style={{ color: "var(--text-secondary)" }} />
                          </button>
                          <button onClick={() => navigate(`/admin/tests/create?edit=${test._id}`)}
                            className="p-1 rounded admin-hover cursor-pointer" title="Edit">
                            <Edit className="w-3.5 h-3.5" style={{ color: "var(--text-secondary)" }} />
                          </button>
                          <button onClick={() => setDeleteConfirm(a)}
                            className="p-1 rounded admin-hover cursor-pointer" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--badge-error-text)" }} />
                          </button>
                          <button onClick={() => setRescheduleModal(a)}
                            className="p-1 rounded admin-hover cursor-pointer" title="Reschedule">
                            <Calendar className="w-3.5 h-3.5" style={{ color: "var(--text-secondary)" }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t admin-table-divider">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Page {page} of {totalPages} ({filtered.length} total)
            </span>
            <div className="flex items-center gap-1.5">
              <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-2 py-1 text-xs border admin-border rounded admin-hover cursor-pointer disabled:opacity-40">
                Previous
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = start + i;
                if (p > totalPages) return null;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-7 h-7 text-xs rounded cursor-pointer ${
                      p === page ? "text-white" : "border admin-border admin-hover"
                    }`}
                    style={{ background: p === page ? "var(--primary)" : "transparent" }}>
                    {p}
                  </button>
                );
              })}
              <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="px-2 py-1 text-xs border admin-border rounded admin-hover cursor-pointer disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {viewModal && (
        <ViewTestModal
          assignment={viewModal}
          onClose={() => setViewModal(null)}
          onEdit={(test) => navigate(`/admin/tests/create?edit=${test._id}`)}
          onDelete={(a) => { setViewModal(null); setDeleteConfirm(a); }}
          onReschedule={(a) => { setViewModal(null); setRescheduleModal(a); }}
          onEmail={(a) => { setViewModal(null); setEmailModal(a); }}
        />
      )}
      {deleteConfirm && (
        <DeleteConfirmModal assignment={deleteConfirm} onConfirm={handleDelete} onClose={() => setDeleteConfirm(null)} />
      )}
      {rescheduleModal && (
        <RescheduleModal assignment={rescheduleModal} onConfirm={handleReschedule} onClose={() => setRescheduleModal(null)} saving={saving} />
      )}
      {emailModal && (
        <EmailReportModal assignment={emailModal} students={emailModal?.studentIds || []} onClose={() => setEmailModal(null)} />
      )}
    </div>
  );
}

export default AssignedTests;
