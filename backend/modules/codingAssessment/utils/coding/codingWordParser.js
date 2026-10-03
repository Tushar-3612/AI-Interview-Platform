import {
  extractDocxText,
  splitBlocks,
  fieldValue,
  parseTestCasesInText,
  sanitizeText,
  normalizeDifficulty,
} from "./shared.js";

export async function parseCodingDocx(buffer) {
  const text = await extractDocxText(buffer);
  if (!text || !text.trim()) {
    throw new Error("We couldn't read any text from this Word file. Please use the official .docx template.");
  }
  const blocks = splitBlocks(text, /^\s*problem\s*id\s*:/i, /^\s*problem\s*title\s*:/i);
  const problems = [];
  for (const block of blocks) {
    let problemId = fieldValue(block, "Problem ID");
    let title = fieldValue(block, "Problem Title");

    // Fallback to heading line e.g. "P001 — Sum of Two Numbers"
    const headingMatch = /^\s*(P\d{1,4})\s*[—–-]\s*(.+)$/m.exec(block);
    if (headingMatch) {
      if (!problemId) problemId = headingMatch[1].trim();
      if (!title) title = headingMatch[2].trim();
    }

    if (!problemId && !title) continue;

    let sampleOutput = fieldValue(block, "Sample Output");
    let sampleInput = fieldValue(block, "Sample Input");
    const testCases = parseTestCasesInText(block, sampleOutput);

    // Fallback: If sampleInput / sampleOutput are empty, extract from test case 1 (T001 Visible)
    if (!sampleInput && testCases.length > 0 && testCases[0].input) {
      sampleInput = testCases[0].input;
    }
    if (!sampleOutput && testCases.length > 0 && testCases[0].expectedOutput) {
      sampleOutput = testCases[0].expectedOutput;
    }

    const rawDiff = fieldValue(block, "Difficulty");
    const difficulty = normalizeDifficulty(rawDiff);

    problems.push({
      problemId: sanitizeText(problemId),
      title: sanitizeText(title),
      marks: fieldValue(block, "Marks") || "10",
      difficulty,
      description: fieldValue(block, "Description"),
      constraints: fieldValue(block, "Constraints"),
      inputFormat: fieldValue(block, "Input Format"),
      outputFormat: fieldValue(block, "Output Format"),
      sampleInput: sanitizeText(sampleInput),
      sampleOutput: sanitizeText(sampleOutput),
      supportedLanguages: fieldValue(block, "Supported Languages") || "Java, Python, C++, JavaScript, C",
      testCases,
    });
  }
  return problems;
}


