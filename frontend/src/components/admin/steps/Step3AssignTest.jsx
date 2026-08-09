import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import api from "../../../utils/api";
import { getAuthToken } from "../../../hooks/useStudentProfile";

const DEPARTMENTS = ["Computer Engineering", "IT Engineering", "Electronics Engineering", "Mechanical Engineering", "Civil Engineering", "ENTC Engineering", "AI & DS"];
const YEARS = ["1st Year", "2nd Year", "3rd Year", "Last Year"];
const SECTIONS = ["A", "B", "C"];

export default function Step3AssignTest({ assignTargets, onAssignChange, testId }) {
  const [students, setStudents] = useState([]);
  const token = getAuthToken();
  const selCls = "w-full px-3 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] appearance-none cursor-pointer admin-select";

  useEffect(() => {
    api.get("/api/admin/students", { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => setStudents(data.students || data || []))
      .catch(() => {});
  }, [token]);

  const needsSave = !testId;

  const handleAssignTypeChange = (val) => {
    onAssignChange({ assignType: val, assignValue: "", studentIds: [], department: "", year: "", section: "" });
  };

  return (
    <div className="space-y-5">
      <div className="border admin-border admin-card rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <Users className="w-4 h-4" /> Assign Test
        </h3>

        {needsSave && (
          <div className="p-3 rounded-lg mb-4 text-xs flex items-center gap-2" style={{ background: "var(--badge-warning-bg)", color: "var(--badge-warning-text)" }}>
            Complete General Info and Question Source first to auto-save before assigning.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Assign By</label>
            <select className={selCls} value={assignTargets.assignType} onChange={e => handleAssignTypeChange(e.target.value)} style={{ color: "var(--text-primary)" }}>
              <option value="all">All Students</option>
              <option value="department_year">Department + Year</option>
              <option value="department">Department Only</option>
              <option value="year">Academic Year Only</option>
              <option value="section">Section</option>
              <option value="individual">Individual</option>
              <option value="multiple">Multiple Students</option>
            </select>
          </div>
        </div>

        {assignTargets.assignType === "department_year" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Select Department *</label>
              <select className={selCls} value={assignTargets.department || ""}
                onChange={e => onAssignChange({ ...assignTargets, department: e.target.value })}
                style={{ color: "var(--text-primary)" }}>
                <option value="">-- Choose Department --</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Select Year *</label>
              <select className={selCls} value={assignTargets.year || ""}
                onChange={e => onAssignChange({ ...assignTargets, year: e.target.value })}
                style={{ color: "var(--text-primary)" }}>
                <option value="">-- Choose Year --</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        )}

        {assignTargets.assignType === "department" && (
          <div className="mt-4">
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Select Department</label>
            <select className={selCls} value={assignTargets.assignValue}
              onChange={e => onAssignChange({ ...assignTargets, assignValue: e.target.value })}
              style={{ color: "var(--text-primary)" }}>
              <option value="">-- Choose Department --</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}

        {assignTargets.assignType === "year" && (
          <div className="mt-4">
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Select Year</label>
            <select className={selCls} value={assignTargets.assignValue}
              onChange={e => onAssignChange({ ...assignTargets, assignValue: e.target.value })}
              style={{ color: "var(--text-primary)" }}>
              <option value="">-- Choose Year --</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}

        {assignTargets.assignType === "section" && (
          <div className="mt-4">
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Select Section</label>
            <select className={selCls} value={assignTargets.assignValue}
              onChange={e => onAssignChange({ ...assignTargets, assignValue: e.target.value })}
              style={{ color: "var(--text-primary)" }}>
              <option value="">-- Choose Section --</option>
              {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        {(assignTargets.assignType === "individual" || assignTargets.assignType === "multiple") && (
          <div className="mt-4">
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Select Students</label>
            <div className="max-h-48 overflow-y-auto border admin-border rounded-lg p-2 space-y-1">
              {students.length === 0 && (
                <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>Loading students...</p>
              )}
              {students.map(s => (
                <label key={s._id} className="flex items-center gap-2 px-2 py-1.5 rounded admin-hover cursor-pointer text-xs">
                  <input type={assignTargets.assignType === "individual" ? "radio" : "checkbox"} name="student-select"
                    checked={assignTargets.studentIds.includes(s._id)}
                    onChange={() => {
                      const ids = assignTargets.assignType === "individual"
                        ? [s._id]
                        : assignTargets.studentIds.includes(s._id)
                          ? assignTargets.studentIds.filter(id => id !== s._id)
                          : [...assignTargets.studentIds, s._id];
                      onAssignChange({ ...assignTargets, studentIds: ids });
                    }} />
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{s.name}</span>
                  <span style={{ color: "var(--text-muted)" }}>- {s.email}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {assignTargets.assignType === "department_year" && assignTargets.department && assignTargets.year && (
          <div className="mt-4 p-3 rounded-lg text-xs" style={{ background: "var(--badge-info-bg)", color: "var(--badge-info-text)" }}>
            Students matching: <strong>{assignTargets.department}</strong> + <strong>{assignTargets.year}</strong> will receive this test.
          </div>
        )}
      </div>
    </div>
  );
}
