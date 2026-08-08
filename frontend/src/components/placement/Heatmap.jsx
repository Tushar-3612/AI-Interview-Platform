import { useMemo } from "react";

const LEVEL_COLORS = [
  "var(--heatmap-0)",
  "var(--heatmap-1)",
  "var(--heatmap-2)",
  "var(--heatmap-3)",
  "var(--heatmap-4)",
];

/**
 * GitHub-style contribution heatmap.
 * Renders weeks × 7 days of practice activity.
 */
export default function Heatmap({ days = [], weeksToShow = 26 }) {
  const weeks = useMemo(() => {
    const arr = [...days];
    if (arr.length > weeksToShow * 7) arr.splice(0, arr.length - weeksToShow * 7);
    const cols = [];
    for (let i = 0; i < arr.length; i += 7) {
      cols.push(arr.slice(i, i + 7));
    }
    return cols;
  }, [days, weeksToShow]);

  if (!days || days.length === 0) {
    return (
      <div className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
        No practice activity yet — complete an attempt to start your heatmap.
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex gap-1 min-w-max">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => (
              <div
                key={day.date}
                title={`${day.date}: ${day.count} practice items`}
                className="w-3.5 h-3.5 rounded-[3px] transition-transform hover:scale-125"
                style={{ background: LEVEL_COLORS[day.level] || LEVEL_COLORS[0] }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
        <span>Less</span>
        {LEVEL_COLORS.map((c, i) => (
          <span key={i} className="w-3.5 h-3.5 rounded-[3px]" style={{ background: c }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
