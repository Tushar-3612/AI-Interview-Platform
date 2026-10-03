import { ALLOWED_DIFFICULTIES, ALLOWED_VISIBILITY, sanitizeText } from "./shared.js";

const CODING_PLACEHOLDERS = [
  "[Enter problem title]",
  "[Enter detailed problem description]",
  "[Enter constraints]",
  "[Describe the input format]",
  "[Describe the output format]",
  "[Enter sample input]",
  "[Enter sample output]",
  "[Enter test case input]",
  "[Enter expected output]",
];

export function containsCodingPlaceholder(problems) {
  if (!Array.isArray(problems)) return false;
  return problems.some((p) => {
    const fields = [
      p.problemId, p.title, p.description, p.constraints, p.inputFormat,
      p.outputFormat, p.sampleInput, p.sampleOutput, p.supportedLanguages, p.marks, p.difficulty,
    ];
    if (fields.some((f) => f != null && CODING_PLACEHOLDERS.some((ph) => String(f).includes(ph)))) return true;
    return Array.isArray(p.testCases) && p.testCases.some((tc) =>
      [tc.testCaseId, tc.visibility, tc.input, tc.expectedOutput].some((f) => f != null && CODING_PLACEHOLDERS.some((ph) => String(f).includes(ph)))
    );
  });
}

export function validateCodingQuestions(problems) {
  const valid = [];
  const invalid = [];
  problems.forEach((p, i) => {
    const errors = [];
    const label = p.problemId || p.title || `Problem ${i + 1}`;
    if (!p.problemId || !p.problemId.trim()) errors.push("Problem ID is missing");
    if (!p.title || !p.title.trim()) errors.push("Problem title is missing");
    if (!p.description || !p.description.trim()) errors.push("Description (problem statement) is missing");
    if (!p.constraints || !p.constraints.trim()) errors.push("Constraints are missing");
    if (!p.inputFormat || !p.inputFormat.trim()) errors.push("Input Format is missing");
    if (!p.outputFormat || !p.outputFormat.trim()) errors.push("Output Format is missing");
    if (!p.sampleInput || !p.sampleInput.trim()) errors.push("Sample Input is missing");
    if (!p.sampleOutput || !p.sampleOutput.trim()) errors.push("Sample Output is missing");

    const marks = Number(p.marks);
    if (p.marks === undefined || p.marks === null || p.marks === "" || isNaN(marks) || marks < 0) {
      errors.push("Marks must be a number greater than or equal to 0");
    }
    if (!p.difficulty || !ALLOWED_DIFFICULTIES.includes(p.difficulty)) {
      errors.push("Difficulty must be Easy, Medium or Hard");
    }

    const langs = typeof p.supportedLanguages === "string"
      ? p.supportedLanguages.split(/[|;,]/).map((s) => s.trim()).filter(Boolean)
      : Array.isArray(p.supportedLanguages) ? p.supportedLanguages : [];
    if (langs.length === 0) errors.push("At least one supported language is required");

    const testCases = Array.isArray(p.testCases) ? p.testCases : [];
    const testCaseErrors = [];
    if (testCases.length === 0) {
      errors.push("At least one test case is required");
    } else {
      testCases.forEach((tc) => {
        const tcErr = [];
        if (!tc.testCaseId || !tc.testCaseId.trim()) tcErr.push("Test Case ID is missing");
        if (!tc.visibility || !ALLOWED_VISIBILITY.includes(tc.visibility)) {
          tcErr.push("Visibility must be Visible or Hidden");
        }
        if (!tc.input || !tc.input.trim()) tcErr.push("Input is missing");
        if (!tc.expectedOutput || !tc.expectedOutput.trim()) tcErr.push("Expected Output is missing");
        if (tcErr.length > 0) {
          testCaseErrors.push({ id: `${label} / ${tc.testCaseId || "?" }`, errors: tcErr });
        }
      });
    }

    if (errors.length > 0 || testCaseErrors.length > 0) {
      invalid.push({ index: i, label, title: p.title || "", errors, testCaseErrors });
    } else {
      valid.push(p);
    }
  });
  return { valid, invalid };
}

export function findDuplicateCodingProblems(problems) {
  const seenIds = new Map();
  const seenTitles = new Map();
  const duplicates = [];
  problems.forEach((p, i) => {
    const pid = sanitizeText(p.problemId);
    const title = sanitizeText(p.title).toLowerCase();
    const label = p.problemId || p.title || `Problem ${i + 1}`;
    if (pid) {
      if (seenIds.has(pid)) duplicates.push({ index: i, label, firstLabel: seenIds.get(pid), type: "id" });
      else seenIds.set(pid, label);
    }
    if (title) {
      if (seenTitles.has(title)) duplicates.push({ index: i, label, firstLabel: seenTitles.get(title), type: "title" });
      else seenTitles.set(title, label);
    }
  });
  return duplicates;
}
