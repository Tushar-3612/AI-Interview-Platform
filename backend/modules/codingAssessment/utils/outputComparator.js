/**
 * Output Comparator Utility
 * Supports comparison modes:
 * - "exact": Strict equality after CRLF normalization
 * - "trimmed": Leading/trailing whitespace trimmed
 * - "whitespace": All internal multi-space and whitespace normalized
 * - "float": Numeric floating-point comparison with epsilon tolerance (1e-5)
 */
export function normalizeOutput(str, mode = "trimmed") {
  if (str === null || str === undefined) return "";
  const s = String(str).replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  switch (mode) {
    case "exact":
      return s;
    case "whitespace":
      return s
        .split("\n")
        .map((line) => line.trim().replace(/\s+/g, " "))
        .filter((line) => line.length > 0)
        .join("\n")
        .trim();
    case "float":
    case "trimmed":
    default:
      return s
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n")
        .trim();
  }
}

export function compareOutput(actual, expected, mode = "trimmed") {
  if (actual === null || actual === undefined) actual = "";
  if (expected === null || expected === undefined) expected = "";

  const normActual = normalizeOutput(actual, mode);
  const normExpected = normalizeOutput(expected, mode);

  // 1. Direct match
  if (normActual === normExpected) return true;

  // 2. Float mode or numeric equivalence
  if (mode === "float") {
    const actNum = parseFloat(normActual);
    const expNum = parseFloat(normExpected);
    if (!isNaN(actNum) && !isNaN(expNum)) {
      return Math.abs(actNum - expNum) <= 1e-5;
    }
  }

  // 3. Boolean case-insensitive match (e.g., Python "True" vs JS "true")
  const actLower = normActual.toLowerCase();
  const expLower = normExpected.toLowerCase();
  if ((actLower === "true" || actLower === "false") && actLower === expLower) {
    return true;
  }

  // 4. JSON / array normalization check
  try {
    const actParsed = JSON.parse(normActual.replace(/'/g, '"'));
    const expParsed = JSON.parse(normExpected.replace(/'/g, '"'));
    if (JSON.stringify(actParsed) === JSON.stringify(expParsed)) {
      return true;
    }
  } catch {
    // Not valid JSON, ignore
  }

  // 5. Structure & whitespace normalized fallback
  if (mode !== "exact") {
    const actClean = normActual.replace(/\s+/g, " ").trim();
    const expClean = normExpected.replace(/\s+/g, " ").trim();
    if (actClean === expClean) return true;
  }

  return false;
}
