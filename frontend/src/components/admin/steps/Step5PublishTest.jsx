import { Send, Save, ClipboardList, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Step5PublishTest({ form, questions, saving, testCreated, testId, onSaveDraft, onPublish, onChange }) {
  const navigate = useNavigate();
  const isValid = form.title?.trim() && questions.length > 0;
  const isScheduled = form.startAt && new Date(form.startAt) > new Date();

  return (
    <div className="border admin-border admin-card rounded-xl p-6 text-center max-w-xl mx-auto">
      <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4"
        style={{ background: isScheduled ? "color-mix(in srgb, var(--badge-info-text) 15%, transparent)" : "color-mix(in srgb, var(--success) 15%, transparent)" }}>
        {isScheduled ? <Calendar className="w-7 h-7" style={{ color: "var(--badge-info-text)" }} /> : <Send className="w-7 h-7" style={{ color: "var(--success)" }} />}
      </div>

      <h3 className="text-lg font-bold mb-1" style={{ color: "var(--text-primary)" }}>
        {isScheduled ? "Schedule Test?" : "Ready to Publish?"}
      </h3>
      <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>
        {isScheduled
          ? "Set the schedule below. Students will see this test only during the allowed window."
          : "Review your test before publishing. You can also save as draft and publish later."
        }
      </p>

      <div className="space-y-2 mb-6">
        <div className="flex justify-between text-xs px-4 py-2 rounded-lg admin-bg-surface">
          <span style={{ color: "var(--text-muted)" }}>Test Name</span>
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>{form.title || "Untitled"}</span>
        </div>
        <div className="flex justify-between text-xs px-4 py-2 rounded-lg admin-bg-surface">
          <span style={{ color: "var(--text-muted)" }}>Questions</span>
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>{questions.length}</span>
        </div>
        <div className="flex justify-between text-xs px-4 py-2 rounded-lg admin-bg-surface">
          <span style={{ color: "var(--text-muted)" }}>Total Marks</span>
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>{questions.reduce((s, q) => s + (q.marks || 0), 0)}</span>
        </div>
        <div className="flex justify-between text-xs px-4 py-2 rounded-lg admin-bg-surface">
          <span style={{ color: "var(--text-muted)" }}>Type</span>
          <span className="font-medium capitalize" style={{ color: "var(--text-primary)" }}>{form.testType}</span>
        </div>
        <div className="flex justify-between text-xs px-4 py-2 rounded-lg admin-bg-surface">
          <span style={{ color: "var(--text-muted)" }}>Duration</span>
          <span className="font-medium" style={{ color: "var(--text-primary)" }}>{form.duration} min</span>
        </div>
      </div>

      <div className="space-y-3 mb-6 text-left">
        <div className="p-3 rounded-lg border admin-border">
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            <Calendar className="w-3 h-3 inline mr-1" /> Start Date & Time (optional - for scheduling)
          </label>
          <input type="datetime-local"
            value={form.startAt || ""}
            onChange={e => onChange({ ...form, startAt: e.target.value })}
            className="w-full px-3 py-2 text-xs border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
        <div className="p-3 rounded-lg border admin-border">
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            <Calendar className="w-3 h-3 inline mr-1" /> End Date & Time (optional)
          </label>
          <input type="datetime-local"
            value={form.endAt || ""}
            onChange={e => onChange({ ...form, endAt: e.target.value })}
            className="w-full px-3 py-2 text-xs border admin-border rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button onClick={onSaveDraft} disabled={!isValid || saving}
          className="flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-medium border admin-border rounded-lg admin-hover cursor-pointer disabled:opacity-50">
          <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save Draft"}
        </button>
        <button onClick={onPublish} disabled={!isValid || saving}
          className="flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-medium text-white rounded-lg cursor-pointer disabled:opacity-50"
          style={{ background: isScheduled ? "var(--badge-info-text)" : "var(--success)" }}>
          <Send className="w-3.5 h-3.5" /> {saving ? "Publishing..." : isScheduled ? "Save & Schedule" : "Publish Test"}
        </button>
      </div>

      {testCreated && testId && (
        <div className="mt-4 pt-4 border-t admin-table-divider">
          <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
            Test ID: <span className="font-mono font-medium">{testId}</span>
          </p>
          <button onClick={() => navigate("/admin/tests/assigned")}
            className="flex items-center justify-center gap-1.5 text-xs font-medium admin-hover px-3 py-1.5 rounded-lg cursor-pointer mx-auto"
            style={{ color: "var(--text-secondary)" }}>
            <ClipboardList className="w-3.5 h-3.5" /> View Assigned Tests
          </button>
        </div>
      )}
    </div>
  );
}
