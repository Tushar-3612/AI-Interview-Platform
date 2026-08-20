import { extractDocxText, splitBlocks, sanitizeText, LABELS, regexEscape } from "./shared.js";

function readField(block, label) {
  const re = new RegExp(`(?:^|\\n)\\s*${regexEscape(label)}\\s*:\\s*`, "i");
  const m = re.exec(block);
  if (!m) return "";
  const start = m.index + m[0].length;
  let end = block.length;
  for (const l of LABELS) {
    if (l === label) continue;
    const r2 = new RegExp(`(?:^|\\n)\\s*${regexEscape(l)}\\s*:[ \\t]*`, "i");
    const m2 = r2.exec(block.slice(start));
    if (m2) {
      const candidate = start + m2.index;
      if (candidate < end) end = candidate;
    }
  }
  return sanitizeText(block.slice(start, end).replace(/\s+/g, " "));
}

function parseTestCases(block) {
  const marker = /^\s*test\s*case\s*id\s*:/im;
  const lines = (block || "").split(/\r?\n/);
  const idx = [];
  lines.forEach((line, i) => { if (marker.test(line)) idx.push(i); });
  if (idx.length === 0) return [];
  const blocks = [];
  for (let i = 0; i < idx.length; i++) {
    const startLine = idx[i];
    const endLine = i < idx.length - 1 ? idx[i + 1] : lines.length;
    const b = lines.slice(startLine, endLine).join("\n");
    if (b.trim()) blocks.push(b);
  }
  return blocks
    .map((b) => ({
      testCaseId: readField(b, "Test Case ID"),
      visibility: readField(b, "Visibility"),
      input: readField(b, "Input"),
      expectedOutput: readField(b, "Expected Output"),
    }))
    .filter((tc) => tc.testCaseId || tc.input || tc.expectedOutput || tc.visibility);
}

export async function parseCodingDocx(buffer) {
  const text = await extractDocxText(buffer);
  if (!text || !text.trim()) {
    throw new Error("We couldn't read any text from this Word file. Please use the official .docx template.");
  }
  const blocks = splitBlocks(text, /^\s*problem\s*id\s*:/i, /^\s*problem\s*title\s*:/i);
  const problems = [];
  for (const block of blocks) {
    const problemId = readField(block, "Problem ID");
    const title = readField(block, "Problem Title");
    if (!problemId && !title) continue;
    const testCases = parseTestCases(block);
    problems.push({
      problemId: sanitizeText(problemId),
      title: sanitizeText(title),
      marks: readField(block, "Marks") || "0",
      difficulty: readField(block, "Difficulty"),
      description: readField(block, "Description"),
      constraints: readField(block, "Constraints"),
      inputFormat: readField(block, "Input Format"),
      outputFormat: readField(block, "Output Format"),
      sampleInput: readField(block, "Sample Input"),
      sampleOutput: readField(block, "Sample Output"),
      supportedLanguages: readField(block, "Supported Languages"),
      testCases,
    });
  }
  return problems;
}
