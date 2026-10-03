import { parseCsvRows, sanitizeText, parseSupportedLanguages } from "./shared.js";

export function parseCodingCsv(buffer) {
  const rows = parseCsvRows(buffer.toString("utf8"));
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const headers = Object.keys(rows[0]).map((h) => h.trim().toLowerCase());
  const isMultiRow = headers.some((h) => h === "test_case_id");

  if (isMultiRow) {
    return parseMultiRow(rows);
  }
  if (headers.includes("test_cases")) {
    return rows.map(parseSingleRowWithTestCases).filter(Boolean);
  }
  // Fallback: treat each row as one problem with no usable test-case structure.
  return rows.map((r) => buildProblem({
    problemId: r.problem_id,
    title: r.title,
    marks: r.marks,
    difficulty: r.difficulty,
    description: r.description,
    constraints: r.constraints,
    inputFormat: r.input_format,
    outputFormat: r.output_format,
    sampleInput: r.sample_input,
    sampleOutput: r.sample_output,
    supportedLanguages: r.supported_languages,
    testCasesRaw: [],
  })).filter(Boolean);
}

function cell(row, key) {
  const k = Object.keys(row).find((h) => h.trim().toLowerCase() === key);
  if (!k) return "";
  const v = row[k];
  return v === undefined || v === null ? "" : String(v).trim();
}

function buildProblem(p) {
  const supportedLanguages = p.supportedLanguages;
  return {
    problemId: sanitizeText(p.problemId),
    title: sanitizeText(p.title),
    marks: sanitizeText(p.marks) || "0",
    difficulty: sanitizeText(p.difficulty),
    description: sanitizeText(p.description),
    constraints: sanitizeText(p.constraints),
    inputFormat: sanitizeText(p.inputFormat),
    outputFormat: sanitizeText(p.outputFormat),
    sampleInput: sanitizeText(p.sampleInput),
    sampleOutput: sanitizeText(p.sampleOutput),
    supportedLanguages: typeof supportedLanguages === "string" ? supportedLanguages : (supportedLanguages || ""),
    testCases: Array.isArray(p.testCasesRaw)
      ? p.testCasesRaw.map((t) => ({
          testCaseId: sanitizeText(t.testCaseId),
          visibility: sanitizeText(t.visibility),
          input: sanitizeText(t.input),
          expectedOutput: sanitizeText(t.expectedOutput),
        })).filter((t) => t.testCaseId || t.input || t.expectedOutput || t.visibility)
      : [],
  };
}

function parseMultiRow(rows) {
  const grouped = new Map();
  for (const r of rows) {
    const pid = sanitizeText(cell(r, "problem_id"));
    if (!pid) continue;
    if (!grouped.has(pid)) {
      grouped.set(pid, {
        problemId: pid,
        title: cell(r, "title"),
        marks: cell(r, "marks"),
        difficulty: cell(r, "difficulty"),
        description: cell(r, "description"),
        constraints: cell(r, "constraints"),
        inputFormat: cell(r, "input_format"),
        outputFormat: cell(r, "output_format"),
        sampleInput: cell(r, "sample_input"),
        sampleOutput: cell(r, "sample_output"),
        supportedLanguages: cell(r, "supported_languages"),
        testCasesRaw: [],
      });
    }
    const tc = {
      testCaseId: cell(r, "test_case_id"),
      visibility: cell(r, "test_case_visibility"),
      input: cell(r, "test_case_input"),
      expectedOutput: cell(r, "test_case_output"),
    };
    if (tc.testCaseId || tc.input || tc.expectedOutput || tc.visibility) {
      grouped.get(pid).testCasesRaw.push(tc);
    }
  }
  return Array.from(grouped.values()).map(buildProblem);
}

function parseSingleRowWithTestCases(r) {
  const raw = cell(r, "test_cases");
  const testCasesRaw = parseTestCasesString(raw);
  return buildProblem({
    problemId: cell(r, "problem_id"),
    title: cell(r, "title"),
    marks: cell(r, "marks"),
    difficulty: cell(r, "difficulty"),
    description: cell(r, "description"),
    constraints: cell(r, "constraints"),
    inputFormat: cell(r, "input_format"),
    outputFormat: cell(r, "output_format"),
    sampleInput: cell(r, "sample_input"),
    sampleOutput: cell(r, "sample_output"),
    supportedLanguages: cell(r, "supported_languages"),
    testCasesRaw,
  });
}

export function parseTestCasesString(raw) {
  if (!raw) return [];
  return raw
    .split(/\s*\|\|\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const fields = part.split("|").map((f) => f.trim());
      const [testCaseId, visibility, input, expectedOutput] = fields;
      return {
        testCaseId: sanitizeText(testCaseId),
        visibility: sanitizeText(visibility),
        input: sanitizeText(input),
        expectedOutput: sanitizeText(expectedOutput),
      };
    })
    .filter((t) => t.testCaseId || t.input || t.expectedOutput || t.visibility);
}
