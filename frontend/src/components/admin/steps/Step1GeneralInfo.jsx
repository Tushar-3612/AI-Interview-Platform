import { Settings } from "lucide-react";

const TEST_TYPES = ["aptitude", "technical", "coding", "mixed"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];

const selCls = "w-full px-3 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)] admin-select";
const inputCls = "w-full px-3 py-2 text-sm border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)]";

export default function Step1GeneralInfo({ form, onChange }) {
  const update = (key, value) => onChange({ ...form, [key]: value });

  const handleTypeChange = (newType) => {
    const updated = { ...form, testType: newType };
    if (newType !== "technical") updated.subjects = [];
    if (newType !== "coding") updated.codingLanguages = [];
    onChange(updated);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="border admin-border admin-card rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <Settings className="w-4 h-4" /> Test Details
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Test Name *</label>
            <input className={inputCls} value={form.title} onChange={e => update("title", e.target.value)}
              placeholder="e.g. Technical Assessment 2025" style={{ color: "var(--text-primary)" }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Test Type *</label>
              <select className={selCls} value={form.testType} onChange={e => handleTypeChange(e.target.value)}>
                {TEST_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Difficulty</label>
              <select className={selCls} value={form.difficulty} onChange={e => update("difficulty", e.target.value)}>
                {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Description</label>
            <textarea className={inputCls + " min-h-[72px] resize-none"} value={form.description} onChange={e => update("description", e.target.value)}
              placeholder="Optional description or instructions" style={{ color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Company (optional)</label>
            <input className={inputCls} value={form.companyId} onChange={e => update("companyId", e.target.value)}
              placeholder="e.g. Google, Microsoft" style={{ color: "var(--text-primary)" }} />
          </div>
        </div>
      </div>

      <div className="border admin-border admin-card rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Configuration</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Duration (min) *</label>
              <input type="number" min="1" className={inputCls} value={form.duration} onChange={e => update("duration", parseInt(e.target.value) || 30)} style={{ color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Passing Marks (%)</label>
              <input type="number" min="0" max="100" className={inputCls} value={form.passingMarks} onChange={e => update("passingMarks", parseInt(e.target.value) || 40)} style={{ color: "var(--text-primary)" }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Attempt Limit</label>
              <input type="number" min="1" className={inputCls} value={form.attemptLimit} onChange={e => update("attemptLimit", parseInt(e.target.value) || 1)} style={{ color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Schedule (optional)</label>
              <input type="datetime-local" className={inputCls} value={form.scheduledAt} onChange={e => update("scheduledAt", e.target.value)} style={{ color: "var(--text-primary)" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
