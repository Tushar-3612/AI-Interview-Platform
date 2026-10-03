/**
 * Single source of truth for student academic classification (backend).
 *
 * The frontend mirrors these values in `frontend/src/utils/constants.js`.
 * Any controller that reads or writes `year` / `department` must normalize
 * through these helpers so the stored canonical values stay consistent with
 * the UI. "Last Year" / "Final Year" / "4th Year" are legacy aliases that are
 * normalized to the canonical "B.Tech" value.
 */

export const ACADEMIC_YEARS = ["1st Year", "2nd Year", "3rd Year", "B.Tech"];

export const DEPARTMENTS = [
  "Computer Engineering",
  "IT Engineering",
  "Electronics Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "ENTC Engineering",
  "AI & DS",
];

/** Legacy year strings (any casing / surrounding whitespace) -> canonical value. */
const YEAR_ALIASES = {
  "last year": "B.Tech",
  "final year": "B.Tech",
  "fourth year": "B.Tech",
  "4th year": "B.Tech",
  "b.tech final year": "B.Tech",
  "btech": "B.Tech",
  "b.tech": "B.Tech",
};

/** Exact-match legacy strings still present in old database records. */
export const LEGACY_YEARS = [
  "Last Year",
  "Final Year",
  "4th Year",
  "Fourth Year",
  "B.Tech Final Year",
];

/**
 * Normalize a year value to its canonical form.
 * Unknown values are returned trimmed (so callers can still validate).
 */
export function normalizeYear(value) {
  if (!value || typeof value !== "string") return value || "";
  const trimmed = value.trim();
  const lowered = trimmed.toLowerCase();
  if (YEAR_ALIASES[lowered]) return YEAR_ALIASES[lowered];
  if (ACADEMIC_YEARS.includes(trimmed)) return trimmed;
  // case-insensitive canonical match (e.g. "b.tech" already handled above)
  const canonical = ACADEMIC_YEARS.find((y) => y.toLowerCase() === lowered);
  return canonical || trimmed;
}

/** Normalize a department value (trim + collapse internal whitespace). */
export function normalizeDepartment(value) {
  if (!value || typeof value !== "string") return value || "";
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Return all stored-value variants that should match a given year filter.
 * Used in Mongo queries so that, even before a data migration runs, legacy
 * "Last Year" records are still returned for a "B.Tech" filter.
 */
export function yearMatchValues(value) {
  const canonical = normalizeYear(value);
  const variants = new Set([canonical]);
  LEGACY_YEARS.forEach((legacy) => {
    if (normalizeYear(legacy) === canonical) variants.add(legacy);
  });
  Object.keys(YEAR_ALIASES).forEach((alias) => {
    if (YEAR_ALIASES[alias] === canonical) variants.add(alias);
  });
  return [...variants];
}

export function yearQuery(value) {
  if (!value) return undefined;
  const variants = yearMatchValues(value);
  return variants.length === 1 ? variants[0] : { $in: variants };
}

export function isCanonicalYear(value) {
  return ACADEMIC_YEARS.includes(normalizeYear(value));
}
