/**
 * Application-wide constants for authentication module.
 */

export const DEPARTMENTS = [
  { value: "Computer Engineering", label: "Computer Engineering" },
  { value: "IT Engineering", label: "IT Engineering" },
  { value: "Electronics Engineering", label: "Electronics Engineering" },
  { value: "Mechanical Engineering", label: "Mechanical Engineering" },
  { value: "Civil Engineering", label: "Civil Engineering" },
  { value: "ENTC Engineering", label: "ENTC Engineering" },
  { value: "AI & DS", label: "AI & DS" },
];

export const YEARS = [
  { value: "1st Year", label: "1st Year" },
  { value: "2nd Year", label: "2nd Year" },
  { value: "3rd Year", label: "3rd Year" },
  { value: "B.Tech", label: "B.Tech" },
];

/**
 * Canonical string values for academic year / department.
 * Use these (not local hardcoded arrays) wherever a raw string list is required
 * so the UI and backend stay in sync. "Last Year" / "Final Year" / "4th Year"
 * are legacy aliases that must no longer appear as user-facing options.
 */
export const YEAR_VALUES = YEARS.map((y) => y.value);
export const DEPARTMENT_VALUES = DEPARTMENTS.map((d) => d.value);

/** Legacy year values that have been normalized to "B.Tech". */
export const LEGACY_YEARS = ["Last Year", "Final Year", "4th Year", "Fourth Year", "B.Tech Final Year"];

export const FEATURES = [
  { label: "Resume Based Questions", icon: "FileText" },
  { label: "Voice Interview", icon: "Mic" },
  { label: "Performance Evaluation", icon: "ClipboardCheck" },
  { label: "Coding Round", icon: "Code2" },
  { label: "Placement Analytics", icon: "BarChart3" },
];

export const THEME_STORAGE_KEY = "placement-interview-theme";
