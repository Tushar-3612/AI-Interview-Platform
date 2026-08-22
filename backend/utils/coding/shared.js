import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.standardFontDataUrl = new URL(
  "pdfjs-dist/standard_fonts/",
  import.meta.url
).toString();

export const LABELS = [
  "Problem ID", "Problem Title", "Marks", "Difficulty", "Description", "Constraints",
  "Input Format", "Output Format", "Sample Input", "Sample Output", "Supported Languages",
  "Test Cases", "Test Case ID", "Visibility", "Input", "Expected Output",
];

export const ALLOWED_DIFFICULTIES = ["Easy", "Medium", "Hard"];
export const ALLOWED_VISIBILITY = ["Visible", "Hidden"];

export function regexEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sanitizeText(value) {
  if (!value) return "";
  return String(value)
    .replace(/<[^>]*>/g, "")
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
  return result.value || "";
}

export async function extractPdfText(buffer) {
  const uint8 = new Uint8Array(buffer);
  const pdf = await pdfjsLib.getDocument({ data: uint8 }).promise;
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
    text += pageText + "\n\n";
  }
  return text;
}

export function parseCsvRows(text) {
  const wb = XLSX.read(text, { type: "string" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
}

export function fieldValue(block, label, stopLabels = LABELS) {
  const re = new RegExp(`\\n\\s*${regexEscape(label)}\\s*:\\s*`, "i");
  const m = re.exec(block);
  if (!m) return "";
  const start = m.index + m[0].length;
  let end = block.length;
  for (const l of stopLabels) {
    if (l === label) continue;
    const r2 = new RegExp(`\\n\\s*${regexEscape(l)}\\s*:[ \\t]*`, "i");
    const m2 = r2.exec(block.slice(start));
    if (m2) {
      const candidate = start + m2.index;
      if (candidate < end) end = candidate;
    }
  }
  return sanitizeText(block.slice(start, end).replace(/\s+/g, " "));
}

export function splitBlocks(text, startRegex, fallbackRegex) {
  const lines = (text || "").split(/\r?\n/);
  const sIndices = [];
  const fIndices = [];
  lines.forEach((line, i) => {
    if (startRegex.test(line)) sIndices.push(i);
    else if (fallbackRegex.test(line)) fIndices.push(i);
  });
  const splits = sIndices.length >= 1 ? sIndices : fIndices.length >= 1 ? fIndices : [];
  if (splits.length === 0) return [];
  const blocks = [];
  for (let s = 0; s < splits.length; s++) {
    const startLine = splits[s];
    const endLine = s < splits.length - 1 ? splits[s + 1] : lines.length;
    const block = lines.slice(startLine, endLine).join("\n");
    if (block.trim()) blocks.push(block);
  }
  return blocks;
}

export function parseTestCasesInText(text) {
  const marker = /^\s*test\s*case\s*id\s*:/im;
  const lines = (text || "").split(/\r?\n/);
  const idx = [];
  lines.forEach((line, i) => { if (marker.test(line)) idx.push(i); });
  if (idx.length === 0) return [];
  const blocks = [];
  for (let i = 0; i < idx.length; i++) {
    const start = idx[i];
    const end = i < idx.length - 1 ? idx[i + 1] : lines.length;
    blocks.push(lines.slice(start, end).join("\n"));
  }
  return blocks
    .map((b) => ({
      testCaseId: fieldValue(b, "Test Case ID"),
      visibility: fieldValue(b, "Visibility"),
      input: fieldValue(b, "Input"),
      expectedOutput: fieldValue(b, "Expected Output"),
    }))
    .filter((tc) => tc.testCaseId || tc.input || tc.expectedOutput || tc.visibility);
}

export function parseSupportedLanguages(value) {
  if (!value) return [];
  return String(value)
    .split(/[|;,]/)
    .map((s) => sanitizeText(s))
    .filter(Boolean);
}
