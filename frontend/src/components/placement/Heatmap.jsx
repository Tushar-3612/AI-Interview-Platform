import { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

// Theme-aware contribution levels mapped directly to PrepHire's CSS design system
const HEATMAP_CSS_LEVELS = [
  "var(--heatmap-empty)",
  "var(--heatmap-low)",
  "var(--heatmap-med-low)",
  "var(--heatmap-med)",
  "var(--heatmap-high)",
];

const WEEKDAY_NAMES = [
  { label: "", row: 0 },    // Sunday (empty)
  { label: "Mon", row: 1 },  // Monday
  { label: "", row: 2 },    // Tuesday (empty)
  { label: "Wed", row: 3 },  // Wednesday
  { label: "", row: 4 },    // Thursday (empty)
  { label: "Fri", row: 5 },  // Friday
  { label: "", row: 6 },    // Saturday (empty)
];

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateLong(dateOrKey) {
  if (dateOrKey instanceof Date) {
    return dateOrKey.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  const d = new Date(`${dateOrKey}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getContributionLevel(count) {
  if (!count || count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

// Format breakdown rows if real activity type categories exist in user data
function formatBreakdown(breakdown) {
  if (!breakdown || typeof breakdown !== "object") return [];

  const LABEL_MAP = {
    coding: "Coding Practice",
    codingSubmissions: "Coding Practice",
    codingAttempts: "Coding Practice",
    aptitude: "Aptitude Practice",
    aptitudeAttempts: "Aptitude Practice",
    aptitudeTests: "Aptitude Practice",
    interview: "Mock Interview",
    interviews: "Mock Interview",
    mockInterview: "Mock Interview",
    mockInterviews: "Mock Interview",
    companyMock: "Company Mock",
    companyMocks: "Company Mock",
    companyMockAttempts: "Company Mock",
    mockOA: "Company Mock OA",
    mockOAs: "Company Mock OA",
    mockOAAttempts: "Company Mock OA",
    test: "Test Assessment",
    tests: "Test Assessment",
    testAttempts: "Test Assessment",
  };

  const rows = [];
  for (const [rawKey, val] of Object.entries(breakdown)) {
    if (["count", "total", "date", "level", "day", "month"].includes(rawKey)) continue;
    const num = Number(val);
    if (!isNaN(num) && num > 0) {
      const label = LABEL_MAP[rawKey] || rawKey.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
      rows.push({ label, count: num });
    }
  }
  return rows.sort((a, b) => b.count - a.count);
}

export default function Heatmap({ days = [], activityMap = {} }) {
  const currentYear = new Date().getFullYear();
  const [tooltip, setTooltip] = useState(null);
  const [showHowWeCount, setShowHowWeCount] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const popoverRef = useRef(null);

  // Close popovers on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setShowHowWeCount(false);
        setShowSettings(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Consolidate real user activity data (counts and any real breakdowns)
  const practiceDetails = useMemo(() => {
    const map = {};

    // 1. Ingest activityMap if provided
    if (activityMap && typeof activityMap === "object") {
      for (const [key, val] of Object.entries(activityMap)) {
        if (!val && val !== 0) continue;
        if (typeof val === "number") {
          map[key] = { count: val, breakdown: null };
        } else if (typeof val === "object") {
          const count = val.count ?? val.total ?? Object.values(val.breakdown || val).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);
          map[key] = {
            count: Number(count) || 0,
            breakdown: val.breakdown || val.activities || val.types || (val.coding || val.aptitude || val.mock || val.interview ? val : null),
          };
        }
      }
    }

    // 2. Ingest days array if provided (fallback / enhancement)
    if (Array.isArray(days)) {
      for (const d of days) {
        if (!d?.date) continue;
        const key = d.date;
        const count = typeof d.count === "number" ? d.count : 0;
        const breakdown = d.breakdown || d.activities || d.types || null;
        if (!map[key] || count > (map[key].count || 0)) {
          map[key] = {
            count: Math.max(count, map[key]?.count || 0),
            breakdown: breakdown || map[key]?.breakdown || null,
          };
        }
      }
    }

    return map;
  }, [activityMap, days]);

  // Determine available years ONLY from real data present in practiceDetails (NO FAKE YEARS)
  const availableYears = useMemo(() => {
    const yearsSet = new Set();
    yearsSet.add(currentYear);

    for (const [key, val] of Object.entries(practiceDetails)) {
      if (val.count > 0) {
        const y = parseInt(key.slice(0, 4), 10);
        if (!isNaN(y) && y >= 2020 && y <= currentYear + 1) {
          yearsSet.add(y);
        }
      }
    }

    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [practiceDetails, currentYear]);

  const [selectedYear, setSelectedYear] = useState(() => availableYears[0] || currentYear);

  // Keep selectedYear valid if availableYears changes
  useEffect(() => {
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0] || currentYear);
    }
  }, [availableYears, selectedYear, currentYear]);

  // Sizing constants for GitHub contribution grid proportions
  const CELL_PX = 13;
  const GAP_PX = 3;
  const COL_WIDTH = CELL_PX + GAP_PX; // 16px per column
  const LEFT_OFFSET = 30; // space reserved for weekday labels

  // Build the 52/53-week GitHub contribution calendar
  const { weeks, monthLabels, totalContributions } = useMemo(() => {
    const isCurrentYear = selectedYear === currentYear;
    const cols = [];
    const labels = [];
    let yearTotal = 0;

    if (isCurrentYear) {
      // Trailing 52 weeks up to Saturday of the current week (matches GitHub's "in the last year")
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const end = new Date(today);
      end.setDate(today.getDate() + (6 - today.getDay())); // Saturday of current week

      const start = new Date(end);
      start.setDate(end.getDate() - (52 * 7 - 1)); // 52 weeks prior (Sunday)

      let lastMonth = -1;
      let lastMonthCol = -10;

      for (let w = 0; w < 52; w++) {
        const week = [];
        for (let d = 0; d < 7; d++) {
          const date = new Date(start);
          date.setDate(start.getDate() + w * 7 + d);
          const key = toDateKey(date);
          const entry = practiceDetails[key] || { count: 0, breakdown: null };
          const count = entry.count || 0;
          yearTotal += count;

          week.push({
            date,
            dateKey: key,
            count,
            level: getContributionLevel(count),
            breakdown: entry.breakdown,
            isFuture: date > today,
          });
        }
        cols.push(week);

        // Detect month starts in this week
        const firstOfMonth = week.find((item) => item.date.getDate() <= 7 && item.date.getMonth() !== lastMonth);
        if (firstOfMonth && w - lastMonthCol >= 3 && w <= 48) {
          lastMonth = firstOfMonth.date.getMonth();
          lastMonthCol = w;
          labels.push({
            month: firstOfMonth.date.toLocaleString("en-US", { month: "short" }),
            leftPx: LEFT_OFFSET + w * COL_WIDTH,
          });
        }
      }
    } else {
      // Past calendar year: full calendar year (Jan 1 -> Dec 31)
      const jan1 = new Date(selectedYear, 0, 1);
      const d0 = jan1.getDay(); // 0 = Sunday
      const start = new Date(selectedYear, 0, 1 - d0); // Sunday of week containing Jan 1

      const dec31 = new Date(selectedYear, 11, 31);
      const dEnd = dec31.getDay();
      const end = new Date(selectedYear, 11, 31 + (6 - dEnd)); // Saturday of week containing Dec 31

      const totalDays = Math.round((end - start) / (24 * 3600 * 1000)) + 1;
      const numWeeks = Math.round(totalDays / 7);

      let lastMonth = -1;
      let lastMonthCol = -10;

      for (let w = 0; w < numWeeks; w++) {
        const week = [];
        for (let d = 0; d < 7; d++) {
          const date = new Date(start);
          date.setDate(start.getDate() + w * 7 + d);
          const key = toDateKey(date);
          const inSelectedYear = date.getFullYear() === selectedYear;
          const entry = inSelectedYear ? (practiceDetails[key] || { count: 0, breakdown: null }) : { count: 0, breakdown: null };
          const count = entry.count || 0;
          if (inSelectedYear) yearTotal += count;

          week.push({
            date,
            dateKey: key,
            count,
            level: inSelectedYear ? getContributionLevel(count) : 0,
            breakdown: entry.breakdown,
            isOutsideYear: !inSelectedYear,
          });
        }
        cols.push(week);

        const firstOfMonth = week.find((item) => item.date.getFullYear() === selectedYear && item.date.getDate() <= 7 && item.date.getMonth() !== lastMonth);
        if (firstOfMonth && w - lastMonthCol >= 3 && w <= numWeeks - 2) {
          lastMonth = firstOfMonth.date.getMonth();
          lastMonthCol = w;
          labels.push({
            month: firstOfMonth.date.toLocaleString("en-US", { month: "short" }),
            leftPx: LEFT_OFFSET + w * COL_WIDTH,
          });
        }
      }
    }

    return { weeks: cols, monthLabels: labels, totalContributions: yearTotal };
  }, [selectedYear, currentYear, practiceDetails]);

  // Robust cell hover handler that captures cell coordinates reliably
  const handleCellHover = (day, e) => {
    if (!day || day.isOutsideYear) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isNearTop = rect.top < 150;
    setTooltip({
      x: rect.left + rect.width / 2,
      y: isNearTop ? rect.bottom : rect.top,
      isNearTop,
      date: day.date,
      dateKey: day.dateKey,
      count: day.count,
      breakdown: day.breakdown,
    });
  };

  const handleCellLeave = () => {
    setTooltip(null);
  };

  return (
    <div className="w-full font-sans select-none" ref={popoverRef}>
      {/* Outer Row: Heatmap card on left, Year navigation on right */}
      <div className="flex flex-col lg:flex-row gap-5 items-start justify-between">
        {/* Main Content Area */}
        <div className="flex-1 min-w-0 w-full">
          {/* Top header row */}
          <div className="flex items-center justify-between mb-2.5">
            <span
              className="text-[14px] sm:text-[15px] font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {totalContributions}{" "}
              {totalContributions === 1 ? "contribution" : "contributions"} in{" "}
              {selectedYear === currentYear ? "the last year" : selectedYear}
            </span>

            {/* Contribution settings dropdown button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSettings((prev) => !prev)}
                className="text-[12px] flex items-center gap-1 transition-colors py-0.5 cursor-pointer font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                Contribution settings
                <span className="text-[9px]">▼</span>
              </button>

              {showSettings && (
                <div
                  className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-xl p-3 text-xs shadow-xl"
                  style={{
                    backgroundColor: "var(--card-bg)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <div
                    className="font-semibold pb-1.5 mb-1.5"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    Contribution activity
                  </div>
                  <div className="flex items-center gap-2 py-1 text-emerald-500 font-medium">
                    <span>✓</span>
                    <span>Practice attempts & tests</span>
                  </div>
                  <div
                    className="text-[10px] pt-1 leading-relaxed"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Counts aptitude, coding submissions, AI interviews, and company mocks.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Theme-Adaptive Contribution Box */}
          <div
            className="rounded-2xl p-4 sm:p-5 relative transition-colors duration-200"
            style={{
              backgroundColor: "var(--card-bg)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            {/* Scrollable calendar container with centered alignment */}
            <div className="w-full overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
              <div className="flex justify-center min-w-max">
                <div className="inline-block">
                  {/* Month labels header */}
                  <div
                    className="relative text-[10px] mb-1.5 select-none font-medium"
                    style={{
                      height: "16px",
                      minWidth: `${LEFT_OFFSET + weeks.length * COL_WIDTH}px`,
                      color: "var(--text-muted)",
                    }}
                  >
                    {monthLabels.map((m, idx) => (
                      <span
                        key={`${m.month}-${idx}`}
                        style={{ position: "absolute", left: `${m.leftPx}px` }}
                      >
                        {m.month}
                      </span>
                    ))}
                  </div>

                  {/* Calendar Grid: Weekday labels on left, columns on right */}
                  <div className="flex gap-0 items-start">
                    {/* Weekday labels (Mon, Wed, Fri) */}
                    <div className="flex flex-col gap-[3px] pr-2 shrink-0 select-none">
                      {WEEKDAY_NAMES.map((item, idx) => (
                        <div
                          key={idx}
                          className="w-5 h-[13px] flex items-center text-[9px] font-medium leading-none"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {item.label}
                        </div>
                      ))}
                    </div>

                    {/* 52/53 Weekly columns with 13px cells */}
                    <div className="flex gap-[3px]">
                      {weeks.map((week, wi) => (
                        <div key={wi} className="flex flex-col gap-[3px]">
                          {week.map((day) => {
                            const isHidden = day.isOutsideYear;
                            const titleDate = formatDateLong(day.date || day.dateKey);
                            const titleText = day.count === 0 ? "No practice" : `${day.count} ${day.count === 1 ? "practice" : "practices"}`;

                            return (
                              <div
                                key={day.dateKey}
                                title={`${titleDate}: ${titleText}`}
                                className={`w-[13px] h-[13px] rounded-[2px] ${
                                  isHidden ? "opacity-0 pointer-events-none" : "cursor-pointer hover:ring-1 hover:ring-emerald-400"
                                }`}
                                style={{
                                  backgroundColor: isHidden
                                    ? "transparent"
                                    : HEATMAP_CSS_LEVELS[day.level],
                                  outline: isHidden
                                    ? "none"
                                    : "1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)",
                                }}
                                onMouseEnter={(e) => handleCellHover(day, e)}
                                onMouseMove={(e) => handleCellHover(day, e)}
                                onMouseLeave={handleCellLeave}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Footer: "Learn how we count contributions" on left, Less...More legend on right */}
            <div
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-2.5 text-[11px]"
              style={{
                borderTop: "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
                color: "var(--text-muted)",
              }}
            >
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowHowWeCount((prev) => !prev)}
                  className="hover:underline transition-colors text-left cursor-pointer font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  Learn how we count contributions
                </button>

                {showHowWeCount && (
                  <div
                    className="absolute left-0 bottom-full mb-2 z-50 w-72 rounded-xl p-3 text-xs shadow-xl"
                    style={{
                      backgroundColor: "var(--card-bg)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <div className="font-semibold mb-1">
                      How contributions are counted
                    </div>
                    <p
                      className="text-[11px] leading-relaxed"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Every completed aptitude practice attempt, coding problem submission,
                      AI mock interview, company mock OA, and assigned assessment test is
                      automatically recorded as a practice contribution for that day.
                    </p>
                  </div>
                )}
              </div>

              {/* Legend: Less [0][1][2][3][4] More */}
              <div className="flex items-center gap-1.5 self-end sm:self-auto select-none font-medium">
                <span>Less</span>
                <div className="flex items-center gap-[3px]">
                  {HEATMAP_CSS_LEVELS.map((colorVar, i) => (
                    <span
                      key={i}
                      className="w-[11px] h-[11px] rounded-[2px]"
                      style={{
                        backgroundColor: colorVar,
                        outline: "1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)",
                      }}
                      title={`Level ${i}`}
                    />
                  ))}
                </div>
                <span>More</span>
              </div>
            </div>
          </div>
        </div>

        {/* Year Navigation Column (renders ONLY real available years, NO FAKE YEARS) */}
        {availableYears.length > 0 && (
          <div className="flex flex-row lg:flex-col gap-1.5 shrink-0 self-start w-full lg:w-auto pt-0 sm:pt-7">
            {availableYears.map((year) => {
              const isActive = selectedYear === year;
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => setSelectedYear(year)}
                  className={`text-xs font-semibold px-4 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#1f6feb] text-white shadow-sm"
                      : "hover:bg-[var(--border)]/40"
                  }`}
                  style={{
                    color: isActive ? "#ffffff" : "var(--text-muted)",
                  }}
                >
                  {year}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Real-time GitHub-Style Portal Tooltip rendered directly into document.body */}
      {tooltip && typeof document !== "undefined" && createPortal(
        (() => {
          const formattedDate = formatDateLong(tooltip.date || tooltip.dateKey);
          const breakdownRows = formatBreakdown(tooltip.breakdown);
          const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
          const clampedX = Math.max(120, Math.min(windowWidth - 120, tooltip.x));
          const topPosition = tooltip.isNearTop ? tooltip.y + 10 : tooltip.y - 10;
          const transformValue = tooltip.isNearTop ? "translate(-50%, 0%)" : "translate(-50%, -100%)";

          return (
            <div
              role="tooltip"
              className="fixed pointer-events-none select-none transition-transform duration-75"
              style={{
                zIndex: 999999,
                left: `${clampedX}px`,
                top: `${topPosition}px`,
                transform: transformValue,
              }}
            >
              <div
                className="relative px-3.5 py-2.5 rounded-xl text-xs"
                style={{
                  backgroundColor: "var(--card-bg, #ffffff)",
                  border: "1px solid var(--border, #e5e7eb)",
                  color: "var(--text-primary, #111827)",
                  boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.05)",
                  minWidth: breakdownRows.length > 0 ? "200px" : "155px",
                  maxWidth: "280px",
                }}
              >
                {/* Exact Date */}
                <div
                  className="font-semibold text-[12px] leading-tight"
                  style={{ color: "var(--text-primary, #111827)" }}
                >
                  {formattedDate}
                </div>

                {tooltip.count === 0 ? (
                  <div
                    className="text-[11px] mt-1 font-medium"
                    style={{ color: "var(--text-muted, #9ca3af)" }}
                  >
                    No practice
                  </div>
                ) : (
                  <>
                    {/* Total Count */}
                    <div className="text-[11px] font-semibold mt-1 text-emerald-500">
                      {tooltip.count} {tooltip.count === 1 ? "practice" : "practices"}
                    </div>

                    {/* Real Activity Breakdown (Only rendered if real breakdown exists in data) */}
                    {breakdownRows.length > 0 && (
                      <div
                        className="mt-2 pt-2 space-y-1.5"
                        style={{ borderTop: "1px solid color-mix(in srgb, var(--border) 70%, transparent)" }}
                      >
                        {breakdownRows.map((row, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[11px] gap-4">
                            <span style={{ color: "var(--text-secondary, #6b7280)" }}>{row.label}</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{row.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* GitHub-style arrow pointer pointing directly at hovered square */}
                <div
                  className="absolute w-2 h-2 rotate-45 pointer-events-none"
                  style={{
                    left: "50%",
                    marginLeft: "-4px",
                    backgroundColor: "var(--card-bg, #ffffff)",
                    borderRight: tooltip.isNearTop ? "none" : "1px solid var(--border, #e5e7eb)",
                    borderBottom: tooltip.isNearTop ? "none" : "1px solid var(--border, #e5e7eb)",
                    borderTop: tooltip.isNearTop ? "1px solid var(--border, #e5e7eb)" : "none",
                    borderLeft: tooltip.isNearTop ? "1px solid var(--border, #e5e7eb)" : "none",
                    bottom: tooltip.isNearTop ? "auto" : "-5px",
                    top: tooltip.isNearTop ? "-5px" : "auto",
                  }}
                />
              </div>
            </div>
          );
        })(),
        document.body
      )}
    </div>
  );
}
