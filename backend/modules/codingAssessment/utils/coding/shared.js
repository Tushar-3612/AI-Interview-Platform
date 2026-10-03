import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

import { pathToFileURL } from "url";
import { createRequire } from "module";

function getStandardFontDataUrl() {
  try {
    const req = createRequire(import.meta.url);
    const pkg = req.resolve("pdfjs-dist/package.json");
    const fontsDir = path.resolve(path.dirname(pkg), "standard_fonts").replaceAll("\\", "/") + "/";
    if (fs.existsSync(fontsDir)) {
      return fontsDir;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

export const LABELS = [
  "Problem ID", "Problem Title", "Marks", "Difficulty", "Description", "Constraints",
  "Input Format", "Output Format", "Sample Input", "Sample Output", "Supported Languages",
  "Test Cases", "Test Case ID", "Visibility", "Input", "Expected Output",
];

export const ALLOWED_DIFFICULTIES = ["Easy", "Medium", "Hard"];
export const ALLOWED_VISIBILITY = ["Visible", "Hidden"];

export function normalizeDifficulty(val) {
  if (!val) return "Medium";
  const s = String(val).toLowerCase();
  if (s.includes("easy")) return "Easy";
  if (s.includes("hard")) return "Hard";
  if (s.includes("medium")) return "Medium";
  return "Medium";
}

export function isNoiseLine(line) {
  const t = (line || "").trim();
  if (!t) return false;
  if (/^[—\-_=\*\.]{3,}$/.test(t)) return true;
  if (/(?:•|\||-|–)?\s*Page\s*\d+(?:\s*(?:of|\/)\s*\d+)?\s*$/i.test(t)) return true;
  if (/^\s*Page\s*\d+(?:\s*(?:of|\/)\s*\d+)?\s*$/i.test(t)) return true;
  if (/^AI-Powered Interview & Assessment Platform/i.test(t)) return true;
  if (/.*Question Import Template.*$/i.test(t)) return true;
  if (/^Use only the official template for reliable question import\./i.test(t)) return true;
  if (/^\s*(?:TECHNICAL|APTITUDE|CODING)\s+QUESTION(?:\s+FORMAT)?\s*$/i.test(t)) return true;
  return false;
}

export function cleanExtractedText(text) {
  if (!text) return "";
  // Strip real HTML / XML formatting tags (like <b>, </b>, <strong>, </td>, etc.)
  // without destroying mathematical expressions like <= or <
  let cleaned = text
    .replace(/<\/?\s*[a-zA-Z][a-zA-Z0-9\-_]*\s*>/gs, " ")
    .replace(/<\s*\/\s*[a-zA-Z0-9\-_]+\s*>/gs, " ")
    .replace(/<\s*[a-zA-Z0-9\-_]+\s*>/gs, " ");

  // Fix field labels split across lines or excessive whitespace in tables
  cleaned = cleaned.replace(/Problem\s*\n+\s*ID\s*:/gi, "Problem ID:");
  cleaned = cleaned.replace(/Problem\s*\n+\s*Title\s*:/gi, "Problem Title:");
  cleaned = cleaned.replace(/Input\s*\n+\s*Format\s*:/gi, "Input Format:");
  cleaned = cleaned.replace(/Output\s*\n+\s*Format\s*:/gi, "Output Format:");
  cleaned = cleaned.replace(/Sample\s*Input\s*:/gi, "Sample Input:");
  cleaned = cleaned.replace(/Sample\s*Output\s*:/gi, "Sample Output:");
  cleaned = cleaned.replace(/Supported\s*\n+\s*Languages\s*:/gi, "Supported Languages:");
  cleaned = cleaned.replace(/Test\s*\n+\s*Cases\s*:/gi, "Test Cases:");
  cleaned = cleaned.replace(/Test\s*Case\s*\n+\s*ID\s*:/gi, "Test Case ID:");
  cleaned = cleaned.replace(/Expected\s*\n+\s*Output\s*:/gi, "Expected Output:");
  cleaned = cleaned.replace(/Marks\s*\n+\s*:/gi, "Marks:");
  cleaned = cleaned.replace(/Difficulty\s*\n+\s*:/gi, "Difficulty:");
  cleaned = cleaned.replace(/Visibility\s*\n+\s*:/gi, "Visibility:");
  cleaned = cleaned.replace(/Description\s*\n+\s*:/gi, "Description:");
  cleaned = cleaned.replace(/Constraints\s*\n+\s*:/gi, "Constraints:");

  return cleaned
    .split(/\r?\n/)
    .filter((l) => !isNoiseLine(l))
    .join("\n");
}

export function regexEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sanitizeText(value) {
  if (!value) return "";
  return String(value)
    .replace(/<\/?\s*[a-zA-Z][a-zA-Z0-9\-_]*\s*>/gs, " ")
    .replace(/<\s*\/\s*[a-zA-Z0-9\-_]+\s*>/gs, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .trim();
}

export function pngSize(buf) {
  try {
    if (buf.slice(1, 4).toString() === "PNG") {
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
  } catch {
    /* ignore */
  }
  return { w: 400, h: 400 };
}

export function loadLogo() {
  const candidates = [
    path.resolve(process.cwd(), "frontend/public/images/metadata.png"),
    path.resolve(process.cwd(), "public/images/metadata.png"),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p);
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function detectFileKind(originalname = "", mimetype = "") {
  const name = (originalname || "").toLowerCase();
  const mime = (mimetype || "").toLowerCase();
  if (name.endsWith(".csv") || mime.includes("csv")) return "csv";
  if (name.endsWith(".docx") || mime.includes("officedocument")) return "docx";
  if (name.endsWith(".pdf") || mime.includes("pdf")) return "pdf";
  return null;
}

export async function extractDocxText(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return cleanExtractedText(result.value || "");
}

export async function extractPdfText(buffer) {
  const uint8 = new Uint8Array(buffer);
  const standardFontDataUrl = getStandardFontDataUrl();
  const pdf = await pdfjsLib.getDocument({
    data: uint8,
    ...(standardFontDataUrl ? { standardFontDataUrl } : {}),
  }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let lastY = null;
    let pageText = "";
    for (const item of content.items) {
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 5) pageText += "\n";
      pageText += item.str + " ";
      lastY = y;
    }
    const cleanedPage = pageText
      .split(/\r?\n/)
      .filter((l) => !isNoiseLine(l))
      .join("\n");
    text += cleanedPage + "\n\n";
  }
  return cleanExtractedText(text);
}

export function parseCsvRows(text) {
  const wb = XLSX.read(text, { type: "string" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
}

export function fieldValue(block, label, stopLabels = LABELS, singleLine = false) {
  const re = new RegExp(`(?:^|\\n|\\s)${regexEscape(label)}\\s*:\\s*`, "i");
  const m = re.exec(block);
  if (!m) return "";
  const start = m.index + m[0].length;
  let end = block.length;
  for (const l of stopLabels) {
    if (l.toLowerCase() === label.toLowerCase()) continue;
    const r2 = new RegExp(`(?:^|\\n|\\s)${regexEscape(l)}\\s*:[ \\t]*`, "i");
    const m2 = r2.exec(block.slice(start));
    if (m2) {
      const candidate = start + m2.index;
      if (candidate < end) end = candidate;
    }
  }
  let raw = block.slice(start, end).trim();
  if (singleLine) {
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    raw = lines[0] || "";
  }
  return sanitizeText(raw.replace(/\s+/g, " "));
}

export function splitBlocks(text, startRegex, fallbackRegex) {
  const lines = (text || "").split(/\r?\n/);
  const pHeadingRegex = /^\s*P\d{1,4}\s*[—–-]/i;
  const probIdRegex = /^\s*Problem\s*ID\s*:/i;
  const probTitleRegex = /^\s*Problem\s*Title\s*:/i;
  const probNumRegex = /^\s*(?:Coding\s+)?Problem\s*#?\d+\s*[:—–-]/i;

  let chosenRegex = null;
  const countMatches = (rx) => (rx ? lines.filter((l) => rx.test(l)).length : 0);

  if (countMatches(pHeadingRegex) >= 1) chosenRegex = pHeadingRegex;
  else if (countMatches(startRegex) >= 1) chosenRegex = startRegex;
  else if (countMatches(probIdRegex) >= 1) chosenRegex = probIdRegex;
  else if (countMatches(probTitleRegex) >= 1) chosenRegex = probTitleRegex;
  else if (countMatches(fallbackRegex) >= 1) chosenRegex = fallbackRegex;
  else if (countMatches(probNumRegex) >= 1) chosenRegex = probNumRegex;
  else chosenRegex = /(?:^|\n)\s*(?:Problem\s*ID|Problem\s*Title)/i;

  const indices = [];
  lines.forEach((line, i) => {
    if (chosenRegex.test(line)) indices.push(i);
  });

  if (indices.length === 0) return [];
  const blocks = [];
  for (let s = 0; s < indices.length; s++) {
    const startLine = indices[s];
    const endLine = s < indices.length - 1 ? indices[s + 1] : lines.length;
    const block = lines.slice(startLine, endLine).join("\n");
    if (block.trim()) blocks.push(block);
  }
  return blocks;
}

export function parseTestCasesInText(text, sampleOutput = "") {
  // Check Format A (Label-based: Test Case ID:)
  const marker = /Test\s*Case\s*ID\s*:/i;
  if (marker.test(text)) {
    const lines = (text || "").split(/\r?\n/);
    const idx = [];
    lines.forEach((line, i) => {
      if (/^\s*test\s*case\s*id\s*:/i.test(line)) idx.push(i);
    });
    if (idx.length > 0) {
      const bList = [];
      for (let i = 0; i < idx.length; i++) {
        const start = idx[i];
        const end = i < idx.length - 1 ? idx[i + 1] : lines.length;
        bList.push(lines.slice(start, end).join("\n"));
      }
      return bList
        .map((b) => ({
          testCaseId: fieldValue(b, "Test Case ID"),
          visibility: fieldValue(b, "Visibility"),
          input: fieldValue(b, "Input"),
          expectedOutput: fieldValue(b, "Expected Output"),
        }))
        .filter((tc) => tc.testCaseId || tc.input || tc.expectedOutput || tc.visibility);
    }
  }

  // Check Format B (Table/row-based: T001 Visible/Hidden ...)
  const tcMarker = /(?:^|\n)\s*Test\s*Cases\s*:\s*/i;
  const match = tcMarker.exec(text);
  const tcSection = match ? text.slice(match.index + match[0].length) : text;

  const rowRegex = /(?:^|\n)\s*(T\d{1,4})\s+(Visible|Hidden)\b/gi;
  const matches = [];
  let m;
  while ((m = rowRegex.exec(tcSection)) !== null) {
    matches.push({
      testCaseId: m[1],
      visibility: m[2],
      startIndex: m.index,
      endIndex: m.index + m[0].length,
    });
  }

  if (matches.length === 0) return [];

  const expectedTokenCount = sampleOutput ? sampleOutput.trim().split(/\s+/).length : 1;

  const testCases = [];
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const nextStart = i < matches.length - 1 ? matches[i + 1].startIndex : tcSection.length;
    let content = tcSection.slice(cur.endIndex, nextStart).trim();
    content = content.replace(/Page\s+\d+.*$/gi, "").trim();

    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let input = "";
    let expectedOutput = "";

    if (lines.length > 1) {
      expectedOutput = lines[lines.length - 1];
      input = lines.slice(0, lines.length - 1).join("\n");
    } else if (lines.length === 1) {
      const tokens = lines[0].split(/\s+/);
      if (tokens.length <= 1) {
        input = tokens[0] || "";
        expectedOutput = "";
      } else {
        const count = Math.min(expectedTokenCount, tokens.length - 1);
        expectedOutput = tokens.slice(tokens.length - count).join(" ");
        input = tokens.slice(0, tokens.length - count).join(" ");
      }
    }

    testCases.push({
      testCaseId: cur.testCaseId,
      visibility: cur.visibility,
      input,
      expectedOutput,
    });
  }

  return testCases;
}

export function parseSupportedLanguages(value) {
  if (!value) return [];
  return String(value)
    .split(/[|;,]/)
    .map((s) => sanitizeText(s))
    .filter(Boolean);
}
