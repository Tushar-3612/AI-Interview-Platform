import { DonutChart } from "./Charts";

export function scoreColor(value) {
  if (value >= 85) return "var(--success)";
  if (value >= 70) return "var(--primary)";
  if (value >= 50) return "#f59e0b";
  return "var(--error)";
}

export function ProgressBar({ value = 0, max = 100, color = null, height = 8, showLabel = true }) {
  const pct = Math.min(Math.max(max > 0 ? (value / max) * 100 : 0, 0), 100);
  const fill = color || scoreColor(value);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height, background: "var(--border)" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: fill, transition: "width 0.6s ease" }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-bold shrink-0" style={{ color: fill }}>
          {Math.round(value)}%
        </span>
      )}
    </div>
  );
}

export function ReadinessRing({ value = 0, label = "", size = 150, sublabel = "" }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <DonutChart value={value} size={size} color={scoreColor(value)} label={label} sublabel={sublabel} />
    </div>
  );
}

export function ScorePill({ value, label }) {
  return (
    <div className="rounded-2xl p-4 border" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--card-bg) 60%, transparent)" }}>
      <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>{label}</p>
      <ProgressBar value={value} />
    </div>
  );
}
