import { Send, Save, ClipboardList, Calendar, Clock, RotateCcw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const fmtDateSummary = (isoStr) => {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export default function Step5PublishTest({ form, questions, saving, testCreated, testId, onSaveDraft, onPublish, onChange }) {
  const navigate = useNavigate();

  const update = (key, value) => onChange({ ...form, [key]: value });

  const durationNum = Number(form.duration);
  const attemptLimitNum = Number(form.attemptLimit);

  // Field Presence & Numeric Constraints
  const baseValid = Boolean(form.title?.trim()) && Array.isArray(questions) && questions.length > 0;
  const startMissing = !form.startAt;
  const endMissing = !form.endAt;
  const durationInvalid = form.duration === "" || form.duration == null || isNaN(durationNum) || !Number.isInteger(durationNum) || durationNum < 1;
  const attemptLimitInvalid = form.attemptLimit === "" || form.attemptLimit == null || isNaN(attemptLimitNum) || !Number.isInteger(attemptLimitNum) || attemptLimitNum < 1;

  // Chronological & Window Constraints
  const startTime = form.startAt ? new Date(form.startAt).getTime() : NaN;
  const endTime = form.endAt ? new Date(form.endAt).getTime() : NaN;
  const endBeforeOrEqualStart = !isNaN(startTime) && !isNaN(endTime) && endTime <= startTime;
  const windowDurationMs = !isNaN(startTime) && !isNaN(endTime) ? endTime - startTime : 0;
  const requiredDurationMs = (!durationInvalid ? durationNum : 0) * 60000;
  const windowTooShort = !endBeforeOrEqualStart && !isNaN(startTime) && !isNaN(endTime) && !durationInvalid && windowDurationMs < requiredDurationMs;

  const hasValidationError = startMissing || endMissing || durationInvalid || attemptLimitInvalid || endBeforeOrEqualStart || windowTooShort;
  const isValid = baseValid && !hasValidationError;

  let validationErrorMessage = "";
  if (startMissing) {
    validationErrorMessage = "Start date and time are required.";
  } else if (endMissing) {
    validationErrorMessage = "End date and time are required.";
  } else if (endBeforeOrEqualStart) {
    validationErrorMessage = "End date and time must be after the start date and time.";
  } else if (durationInvalid) {
    validationErrorMessage = "Duration must be at least 1 minute.";
  } else if (attemptLimitInvalid) {
    validationErrorMessage = "Attempt limit must be at least 1.";
  } else if (windowTooShort) {
    const windowMinutes = Math.round(windowDurationMs / 60000);
    validationErrorMessage = `Schedule window (${windowMinutes} min) must be at least as long as the test duration (${durationNum} min).`;
  }

  const totalMarks = (questions || []).reduce((s, q) => s + (Number(q.marks) || 0), 0);
  const requiredMarks = Math.ceil(totalMarks * (Number(form.passingMarks) || 0) / 100);

  return (
    <div className="border admin-border admin-card rounded-xl p-6 text-center max-w-2xl mx-auto shadow-sm">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
        style={{ background: "color-mix(in srgb, var(--primary) 15%, transparent)" }}
      >
        <Calendar className="w-7 h-7" style={{ color: "var(--primary)" }} />
      </div>

      <h3 className="text-base font-bold mb-1" style={{ color: "var(--text-primary)" }}>
        Final Test Configuration & Schedule
      </h3>
      <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
        Configure the mandatory assessment schedule and timing. Students will only be able to take this assessment during the designated window.
      </p>

      {/* FINAL CONFIGURATION INPUT FORM */}
      <div className="text-left space-y-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-xl border admin-border admin-bg-surface">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
              <Calendar className="w-3.5 h-3.5 inline mr-1 text-[var(--primary)]" /> Start Date & Time *
            </label>
            <input
              type="datetime-local"
              value={form.startAt || ""}
              onChange={(e) => update("startAt", e.target.value)}
              className="w-full px-3 py-2 text-xs border admin-border rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              style={{ color: "var(--text-primary)" }}
            />
          </div>

          <div className="p-3.5 rounded-xl border admin-border admin-bg-surface">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
              <Calendar className="w-3.5 h-3.5 inline mr-1 text-[var(--primary)]" /> End Date & Time *
            </label>
            <input
              type="datetime-local"
              value={form.endAt || ""}
              onChange={(e) => update("endAt", e.target.value)}
              className="w-full px-3 py-2 text-xs border admin-border rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              style={{ color: "var(--text-primary)" }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-xl border admin-border admin-bg-surface">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
              <Clock className="w-3.5 h-3.5 inline mr-1 text-[var(--primary)]" /> Duration (minutes) *
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={form.duration ?? ""}
              onChange={(e) => update("duration", e.target.value === "" ? "" : parseInt(e.target.value, 10))}
              placeholder="e.g. 30"
              className="w-full px-3 py-2 text-xs border admin-border rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              style={{ color: "var(--text-primary)" }}
            />
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
              Individual timer allocated per student attempt.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border admin-border admin-bg-surface">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
              <RotateCcw className="w-3.5 h-3.5 inline mr-1 text-[var(--primary)]" /> Attempt Limit *
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={form.attemptLimit ?? ""}
              onChange={(e) => update("attemptLimit", e.target.value === "" ? "" : parseInt(e.target.value, 10))}
              placeholder="e.g. 1"
              className="w-full px-3 py-2 text-xs border admin-border rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              style={{ color: "var(--text-primary)" }}
            />
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
              Maximum attempts allowed per student.
            </p>
          </div>
        </div>
      </div>

      {/* SCHEDULE SUMMARY */}
      <div className="border admin-border rounded-xl p-4 mb-5 text-left admin-bg-surface space-y-2.5">
        <h4 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Schedule Summary
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between py-1 border-b admin-table-divider">
            <span style={{ color: "var(--text-muted)" }}>Test Name</span>
            <span className="font-semibold truncate max-w-[180px]" style={{ color: "var(--text-primary)" }}>{form.title || "Untitled"}</span>
          </div>
          <div className="flex justify-between py-1 border-b admin-table-divider">
            <span style={{ color: "var(--text-muted)" }}>Questions & Marks</span>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{questions.length} Q ({totalMarks} marks)</span>
          </div>
          <div className="flex justify-between py-1 border-b admin-table-divider">
            <span style={{ color: "var(--text-muted)" }}>Start Time</span>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{fmtDateSummary(form.startAt)}</span>
          </div>
          <div className="flex justify-between py-1 border-b admin-table-divider">
            <span style={{ color: "var(--text-muted)" }}>End Time</span>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{fmtDateSummary(form.endAt)}</span>
          </div>
          <div className="flex justify-between py-1 border-b admin-table-divider">
            <span style={{ color: "var(--text-muted)" }}>Attempt Duration</span>
            <span className="font-bold text-[var(--primary)]">{form.duration ? `${form.duration} minutes` : "—"}</span>
          </div>
          <div className="flex justify-between py-1 border-b admin-table-divider">
            <span style={{ color: "var(--text-muted)" }}>Attempt Limit</span>
            <span className="font-bold" style={{ color: "var(--text-primary)" }}>{form.attemptLimit ? `${form.attemptLimit} attempt(s)` : "—"}</span>
          </div>
          <div className="flex justify-between py-1">
            <span style={{ color: "var(--text-muted)" }}>Passing Criteria</span>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{requiredMarks} / {totalMarks} ({form.passingMarks}%)</span>
          </div>
          <div className="flex justify-between py-1">
            <span style={{ color: "var(--text-muted)" }}>Assessment Type</span>
            <span className="font-semibold capitalize" style={{ color: "var(--text-primary)" }}>{form.testType || "N/A"}</span>
          </div>
        </div>
      </div>

      {/* VALIDATION ERROR BANNER */}
      {hasValidationError && (
        <div className="p-3 rounded-xl mb-5 flex items-center justify-center gap-2 text-xs font-semibold bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{validationErrorMessage}</span>
        </div>
      )}

      {/* ACTIONS */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={onSaveDraft}
          disabled={!baseValid || saving}
          className="flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-semibold border admin-border rounded-xl admin-hover cursor-pointer disabled:opacity-50 transition"
        >
          <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save Draft"}
        </button>
        <button
          onClick={onPublish}
          disabled={!isValid || saving}
          className="flex items-center justify-center gap-1.5 px-6 py-2.5 text-xs font-bold text-white rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md hover:opacity-95"
          style={{ background: "var(--primary)" }}
        >
          <Send className="w-3.5 h-3.5" /> {saving ? "Publishing..." : "Publish & Schedule Test"}
        </button>
      </div>

      {testCreated && testId && (
        <div className="mt-5 pt-4 border-t admin-table-divider">
          <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
            Test ID: <span className="font-mono font-medium">{testId}</span>
          </p>
          <button
            onClick={() => navigate("/admin/tests/assigned")}
            className="flex items-center justify-center gap-1.5 text-xs font-semibold admin-hover px-3.5 py-1.5 rounded-lg cursor-pointer mx-auto"
            style={{ color: "var(--text-secondary)" }}
          >
            <ClipboardList className="w-3.5 h-3.5" /> View Assigned Tests
          </button>
        </div>
      )}
    </div>
  );
}
