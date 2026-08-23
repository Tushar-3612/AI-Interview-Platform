/**
 * AI response parser & validator.
 * Never trust raw AI output. Strip markdown fences, parse JSON,
 * and validate schema/counts before any question is persisted.
 */

const VALID_DIFFICULTIES = ["easy", "medium", "hard"];

export function normalizeDifficulty(d) {
  const x = String(d || "").toLowerCase();
  return VALID_DIFFICULTIES.includes(x) ? x : "medium";
}

export function stripCodeFences(raw) {
  if (typeof raw !== "string") return raw;
  let s = raw.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) s = fence[1].trim();
  return s;
}

export function parseAIJson(raw) {
  const s = stripCodeFences(raw);
  try {
    return JSON.parse(s);
  } catch {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(s.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new Error("AI response is not valid JSON");
  }
}

/**
 * Validate a generic "questions" array.
 * Returns up to `count` well-formed question objects.
 */
export function validateQuestionList(data, { section, count, fields = ["question"] }) {
  if (!data || !Array.isArray(data.questions)) {
    throw new Error("AI response missing 'questions' array");
  }
  const out = [];
  for (const q of data.questions) {
    if (!q || typeof q.question !== "string" || !q.question.trim()) continue;
    out.push({
      raw: q,
      question: q.question.trim(),
      difficulty: normalizeDifficulty(q.difficulty),
      section: q.section || section,
      topic: q.topic || q.skill || "General",
    });
  }
  if (out.length === 0) throw new Error("No valid questions after validation");
  return out.slice(0, count);
}

/**
 * Validate AI-generated coding problems.
 * Requires: title, description, constraints, and at least one test case
 * with both input and expected (or output).
 */
export function validateCodingProblems(data, count = 3) {
  if (!data || !Array.isArray(data.questions)) {
    throw new Error("AI coding response missing 'questions' array");
  }

  const out = [];
  for (const q of data.questions) {
    if (!q || !q.title || !q.title.trim()) continue;
    if (!q.description || !q.description.trim()) continue;
    if (!q.constraints || !q.constraints.trim()) continue;

    let testCases = Array.isArray(q.testCases) ? q.testCases : [];
    // Allow examples to be promoted to test cases if needed.
    if (testCases.length === 0 && Array.isArray(q.examples)) {
      testCases = q.examples
        .filter((e) => e && (e.input !== undefined) && (e.expected !== undefined || e.output !== undefined))
        .map((e) => ({
          input: String(e.input ?? ""),
          expected: String(e.expected ?? e.output ?? ""),
          isHidden: false,
        }));
    }

    const validTestCases = testCases.filter(
      (tc) => tc && String(tc.input ?? "").length > 0 && String(tc.expected ?? tc.output ?? "").length > 0
    );

    if (validTestCases.length === 0) continue;

    out.push({
      title: q.title.trim(),
      description: q.description.trim(),
      difficulty: normalizeDifficulty(q.difficulty),
      inputFormat: q.inputFormat || "Standard Input",
      outputFormat: q.outputFormat || "Standard Output",
      constraints: q.constraints.trim(),
      examples: Array.isArray(q.examples) ? q.examples : [],
      testCases: validTestCases,
      expectedApproach: q.expectedApproach || "",
      topic: q.topic || "Data Structures & Algorithms",
    });
  }

  if (out.length === 0) throw new Error("No valid coding problems after validation");
  return out.slice(0, count);
}
