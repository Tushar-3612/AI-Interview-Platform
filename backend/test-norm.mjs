export function compareOutputs(actual, expected) {
  if (actual === null || actual === undefined) actual = "";
  if (expected === null || expected === undefined) expected = "";

  const aStr = String(actual).trim();
  const eStr = String(expected).trim();

  // 1. Direct exact match
  if (aStr === eStr) return true;

  // 2. Case-insensitive boolean match (e.g. Python "True" vs JSON "true")
  if (aStr.toLowerCase() === eStr.toLowerCase() && (aStr.toLowerCase() === "true" || aStr.toLowerCase() === "false")) {
    return true;
  }

  // 3. Numeric match (e.g. 2.0 vs 2.00000 or 2 vs 2.0)
  const aNum = Number(aStr);
  const eNum = Number(eStr);
  if (!isNaN(aNum) && !isNaN(eNum) && aStr !== "" && eStr !== "") {
    if (Math.abs(aNum - eNum) < 1e-5) return true;
  }

  // 4. Try JSON / Python list/tuple parsing (e.g. [[1, 6], [8, 10]] vs [[1,6],[8,10]])
  function tryParse(s) {
    if (!s) return null;
    try {
      return JSON.parse(s);
    } catch {}
    try {
      return JSON.parse(s.replace(/'/g, '"'));
    } catch {}
    return null;
  }

  const aJson = tryParse(aStr);
  const eJson = tryParse(eStr);
  if (aJson !== null && eJson !== null) {
    if (JSON.stringify(aJson) === JSON.stringify(eJson)) return true;
  }

  // 5. Structure & whitespace normalized string match
  const norm = (s) =>
    String(s)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\s*,\s*/g, ",")
      .replace(/\s*\[\s*/g, "[")
      .replace(/\s*\]\s*/g, "]")
      .replace(/\s*\{\s*/g, "{")
      .replace(/\s*\}\s*/g, "}")
      .replace(/[ \t]+/g, " ")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n")
      .trim();

  return norm(aStr) === norm(eStr);
}

console.log("1. Python list vs JSON array:", compareOutputs("[[1, 6], [8, 10], [15, 18]]", "[[1,6],[8,10],[15,18]]"));
console.log("2. Array with spaces:", compareOutputs("[ 1, 2, 3 ]", "[1,2,3]"));
console.log("3. Boolean True vs true:", compareOutputs("True", "true"));
console.log("4. Float 2.0 vs 2.00000:", compareOutputs("2.0", "2.00000"));
console.log("5. Plain text with whitespace:", compareOutputs("4\n", "4"));
