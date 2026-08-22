import { extractPdfText, fieldValue, splitBlocks, parseTestCasesInText, sanitizeText } from "./shared.js";

export async function parseCodingPdf(buffer) {
  const text = await extractPdfText(buffer);
  if (!text || !text.trim()) {
    throw new Error("We couldn't read this PDF. It may be scanned or image-based. Please use the official template.");
  }
  const blocks = splitBlocks(text, /^\s*problem\s*id\s*:/i, /^\s*problem\s*title\s*:/i);
  const problems = [];
  for (const block of blocks) {
    const problemId = fieldValue(block, "Problem ID");
    const title = fieldValue(block, "Problem Title");
    if (!problemId && !title) continue;
    const testCases = parseTestCasesInText(block);
    problems.push({
      problemId: sanitizeText(problemId),
      title: sanitizeText(title),
      marks: fieldValue(block, "Marks") || "0",
      difficulty: fieldValue(block, "Difficulty"),
      description: fieldValue(block, "Description"),
      constraints: fieldValue(block, "Constraints"),
      inputFormat: fieldValue(block, "Input Format"),
      outputFormat: fieldValue(block, "Output Format"),
      sampleInput: fieldValue(block, "Sample Input"),
      sampleOutput: fieldValue(block, "Sample Output"),
      supportedLanguages: fieldValue(block, "Supported Languages"),
      testCases,
    });
  }
  return problems;
}
