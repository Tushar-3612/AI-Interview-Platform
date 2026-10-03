import { parseCodingCsv } from "./codingCsvParser.js";
import { parseCodingDocx } from "./codingWordParser.js";
import { parseCodingPdf } from "./codingPdfParser.js";
import { normalizeCodingProblem } from "./codingNormalizer.js";
import { validateCodingQuestions, findDuplicateCodingProblems, containsCodingPlaceholder } from "./codingValidator.js";
import { detectFileKind } from "./shared.js";

export async function parseCodingQuestions(buffer, kind) {
  if (kind === "csv") return parseCodingCsv(buffer);
  if (kind === "docx") return await parseCodingDocx(buffer);
  if (kind === "pdf") return await parseCodingPdf(buffer);
  throw new Error("Unsupported file type");
}

export {
  normalizeCodingProblem,
  validateCodingQuestions,
  findDuplicateCodingProblems,
  containsCodingPlaceholder,
  detectFileKind,
};
