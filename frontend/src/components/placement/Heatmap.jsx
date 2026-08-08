import { useMemo, useState } from "react";

const GREEN_LEVELS = [
  "var(--heatmap-empty)",
  "var(--heatmap-low)",
  "var(--heatmap-med-low)",
  "var(--heatmap-med)",
  "var(--heatmap-high)",
  "var(--heatmap-max)",
];

const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

export default function Heatmap({ days = [], weeksToShow = 26 }) {
  const [tooltip, setTooltip] = useState(null);

  const { weeks, monthLabels } = useMemo(() => {
    const arr = [...days];
    if (arr.length > weeksToShow * 7) arr.splice(0, arr.length - weeksToShow * 7);
    const cols = [];
    for (let i = 0; i < arr.length; i += 7) {
      cols.push(arr.slice(i, i + 7));
    }

    const labels = [];
    let lastMonth = "";
    cols.forEach((week, wi) => {
      const firstDay = week[0];
      if (firstDay) {
        const d = new Date(`${firstDay.date}T00:00:00`);
        const month = d.toLocaleString("en-US", { month: "short" });
        if (month !== lastMonth) {
          labels.push({ week: wi, month });
          lastMonth = month;
        }
      }
    });

    return { weeks: cols, monthLabels: labels };
  }, [days, weeksToShow]);

  if (!days || days.length === 0) {
    return (
      <div className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
        No practice activity yet — complete an attempt to start your heatmap.
      </div>
    );
  }

  const totalActiveDays = days.filter((d) => d.count > 0).length;

  return (
    <div>
      {/* Month labels */}
      <div className="flex gap-[3px] mb-1 pl-7">
        {weeks.map((_, wi) => {
          const label = monthLabels.find((m) => m.week === wi);
          return (
            <div key={wi} className="w-[14px] text-center">
              {label && (
                <span className="text-[9px] font-medium" style={{ color: "var(--text-muted)" }}>
                  {label.month}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-0 overflow-x-auto pb-2">
        {/* Weekday labels */}
        <div className="flex flex-col gap-[3px] pr-1.5 shrink-0">
          {WEEKDAY_LABELS.map((label, i) => (
            <div
              key={i}
              className="w-6 h-[14px] flex items-center text-[9px] font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex gap-[3px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day) => (
                <div
                  key={day.date}
                  className="w-[14px] h-[14px] rounded-[3px] cursor-default relative transition-transform hover:scale-125"
                  style={{
                    background: GREEN_LEVELS[day.level] || GREEN_LEVELS[0],
                  }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({
                      x: rect.left + rect.width / 2,
                      y: rect.top - 8,
                      date: day.date,
                      count: day.count,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend + Summary */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
          <span>Less</span>
          {GREEN_LEVELS.map((c, i) => (
            <span key={i} className="w-[14px] h-[14px] rounded-[3px]" style={{ background: c }} />
          ))}
          <span>More</span>
        </div>
        <span className="text-[10px] font-semibold" style={{ color: "var(--text-secondary)" }}>
          {totalActiveDays} active days
        </span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-md)",
            color: "var(--text-primary)",
          }}
        >
          {new Date(`${tooltip.date}T00:00:00`).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          {tooltip.count > 0 && (
            <span style={{ color: "#22C55E" }}> — {tooltip.count} {tooltip.count === 1 ? "activity" : "activities"}</span>
          )}
          {tooltip.count === 0 && (
            <span style={{ color: "var(--text-muted)" }}> — No activity</span>
          )}
        </div>
      )}
    </div>
  );
}
