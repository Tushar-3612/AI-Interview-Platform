import { parseSupportedLanguages, sanitizeText } from "./shared.js";

export function normalizeCodingProblem(raw) {
  const supportedLanguages = Array.isArray(raw.supportedLanguages)
    ? raw.supportedLanguages
    : parseSupportedLanguages(raw.supportedLanguages || "");

  const testCases = Array.isArray(raw.testCases)
    ? raw.testCases.map((tc) => ({
        input: sanitizeText(tc.input),
        expected: sanitizeText(tc.expectedOutput),
        isHidden: (tc.visibility || "").trim().toLowerCase() === "hidden",
      }))
    : [];

  return {
    questionId: sanitizeText(raw.problemId),
    title: sanitizeText(raw.title),
    problemStatement: sanitizeText(raw.description),
    description: sanitizeText(raw.description),
    marks: Number(raw.marks) || 10,
    difficulty: sanitizeText(raw.difficulty),
    constraints: sanitizeText(raw.constraints),
    inputFormat: sanitizeText(raw.inputFormat),
    outputFormat: sanitizeText(raw.outputFormat),
    sampleInput: sanitizeText(raw.sampleInput),
    sampleOutput: sanitizeText(raw.sampleOutput),
    supportedLanguages,
    testCases,
  };
}
