import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { createRequire } from "module";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

function getStandardFontDataUrl() {
  try {
    const req = createRequire(import.meta.url);
    const pkg = req.resolve("pdfjs-dist/package.json");
    const fontsDir = path.join(path.dirname(pkg), "standard_fonts");
    if (fs.existsSync(fontsDir)) {
      return pathToFileURL(fontsDir).toString() + "/";
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/* ============================================================
   CONSTANTS
   ============================================================ */

export const ALLOWED_TYPES = ["MCQ", "True/False", "Short Answer"];
export const ALLOWED_DIFFICULTIES = ["Easy", "Medium", "Hard"];
const OPTION_KEYS = ["A", "B", "C", "D"];

const LABELS = [
  "Question ID",
  "Question",
  "Type",
  "Subject",
  "Marks",
  "Negative Marks",
  "Difficulty",
  "Options",
  "Correct Answer",
  "Explanation",
];

/* ============================================================
   HELPERS & NOISE CLEANING
   ============================================================ */

export function isNoiseLine(line) {
  const t = (line || "").trim();
  if (!t) return false;
  // Horizontal divider rules
  if (/^[—\-_=\*\.]{3,}$/.test(t)) return true;
  // Page number / footer lines like:
  // "Direction Sense Question Import Template • Page 2"
  // "Technical Question Import Template • Page 2"
  // "• Page 3", "Page 2 of 8", "Page 2"
  if (/(?:•|\||-|–)?\s*Page\s*\d+(?:\s*(?:of|\/)\s*\d+)?\s*$/i.test(t)) return true;
  if (/^\s*Page\s*\d+(?:\s*(?:of|\/)\s*\d+)?\s*$/i.test(t)) return true;
  // Platform banner / template title lines outside questions:
  if (/^AI-Powered Interview & Assessment Platform/i.test(t)) return true;
  if (/.*Question Import Template.*$/i.test(t)) return true;
  if (/^Use only the official template for reliable question import\./i.test(t)) return true;
  if (/^Subject:\s*[^|]+\|\s*Question Type:\s*[^|]+\|\s*Marks:/i.test(t)) return true;
  if (/^The following questions follow the field structure/i.test(t)) return true;
  if (/^\s*(?:TECHNICAL|APTITUDE|CODING)\s+QUESTION(?:\s+FORMAT)?\s*$/i.test(t)) return true;
  return false;
}

export function cleanExtractedText(text) {
  if (!text) return "";
  return text
    .split(/\r?\n/)
    .filter((l) => !isNoiseLine(l))
    .join("\n");
}

function regexEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeText(value) {
  if (!value) return "";
  // Strip any HTML/script tags to prevent injection
  return String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .trim();
}

function normalizeType(raw) {
  const t = sanitizeText(raw);
  if (!t) return "";
  const lower = t.toLowerCase();
  if (lower.includes("mcq") || lower.includes("multiple choice")) return "MCQ";
  if (lower.includes("true") && lower.includes("false")) return "True/False";
  if (lower.includes("short")) return "Short Answer";
  if (lower.includes("descriptive")) return "Short Answer";
  return t;
}

function normalizeAnswer(raw, type = "MCQ", options = {}) {
  const a = sanitizeText(raw);
  if (!a) return "";
  if (type === "True/False") {
    const lower = a.toLowerCase();
    if (["a", "true", "t"].includes(lower) || lower.startsWith("true")) return "A";
    if (["b", "false", "f"].includes(lower) || lower.startsWith("false")) return "B";
    return a.toUpperCase();
  }
  if (type === "Short Answer" || type === "Descriptive") {
    return a;
  }

  // 1. Starts with option letter like "A", "B.", "C)", "(D)", "Option C", "Option: C"
  const startMatch = a.match(/^\s*(?:option\s*)?\(?([A-Da-d])\)?(?:\s*[.):\-\s]|$)/i);
  if (startMatch) return startMatch[1].toUpperCase();

  // 2. Contains standalone option letter
  const tokenMatch = a.match(/\b([A-Da-d])\b/);
  if (tokenMatch) return tokenMatch[1].toUpperCase();

  // 3. Answer is the option text itself (e.g. "0 metres" -> "C")
  if (options && typeof options === "object") {
    const cleanA = a.toLowerCase().trim();
    for (const [k, v] of Object.entries(options)) {
      if (v && sanitizeText(v).toLowerCase().trim() === cleanA) {
        return k.toUpperCase();
      }
    }
  }

  return a.toUpperCase();
}

/* ============================================================
   CSV PARSER
   ============================================================ */

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (c === "\r") {
        /* ignore */
      } else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseCSV(text) {
  const rows = parseCsvRows(text || "");
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => sanitizeText(h).toLowerCase());
  const col = (name) => header.indexOf(name);

  const map = {
    question: col("question"),
    type: col("type"),
    subject: col("subject"),
    marks: col("marks"),
    neg: col("negative_marks"),
    difficulty: col("difficulty"),
    oa: col("option_a"),
    ob: col("option_b"),
    oc: col("option_c"),
    od: col("option_d"),
    ans: col("correct_answer"),
    exp: col("explanation"),
  };

  const required = ["question", "type", "subject", "marks", "difficulty", "ans", "oa", "ob", "oc", "od"];
  const missing = required.filter((k) => map[k] < 0);
  if (missing.length > 0) {
    throw new Error(
      "CSV is missing required columns. Please download the official template and use the exact headers."
    );
  }

  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length === 1 && !r[0].trim()) continue;
    const get = (idx) => (idx >= 0 && r[idx] !== undefined ? sanitizeText(r[idx]) : "");
    const type = normalizeType(get(map.type));
    out.push({
      question: get(map.question),
      type,
      subject: get(map.subject),
      marks: get(map.marks) || "0",
      negativeMarks: map.neg >= 0 ? get(map.neg) || "0" : "0",
      difficulty: get(map.difficulty),
      options: {
        A: get(map.oa),
        B: get(map.ob),
        C: get(map.oc),
        D: get(map.od),
      },
      correctAnswer: normalizeAnswer(get(map.ans), type),
      explanation: map.exp >= 0 ? get(map.exp) : "",
    });
  }
  return out;
}

/* ============================================================
   LABEL-BASED PARSER (DOCX + PDF)
   ============================================================ */

function fieldValue(block, label, singleLine = false) {
  const re = new RegExp(`(?:^|\\n)\\s*${regexEscape(label)}\\s*:\\s*`, "i");
  const m = re.exec(block);
  if (!m) return "";
  const start = m.index + m[0].length;
  let end = block.length;
  for (const l of LABELS) {
    if (l.toLowerCase() === label.toLowerCase()) continue;
    const r2 = new RegExp(`(?:^|\\n)\\s*${regexEscape(l)}\\s*:[ \\t]*`, "i");
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

function parseOptions(text) {
  const opts = {};
  if (!text) return opts;

  // Normalize whitespace but preserve line boundaries so both
  // line-based and single-line option layouts are handled.
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Find every option marker A./A) B./B) C./C) D./D) whether it sits at a
  // line start or mid-line (single-line extraction from PDF/Word).
  const markerRe = /(?:^|[\n\r\s])([A-Da-d])\s*[\.\)]\s*/g;
  const matches = [];
  let m;
  while ((m = markerRe.exec(normalized)) !== null) {
    matches.push({
      letter: m[1].toUpperCase(),
      contentStart: m.index + m[0].length,
      markerStart: m.index,
    });
  }

  if (matches.length === 0) return opts;

  for (let i = 0; i < matches.length; i++) {
    const contentStart = matches[i].contentStart;
    const nextMarkerStart = i + 1 < matches.length ? matches[i + 1].markerStart : normalized.length;
    let content = normalized.slice(contentStart, nextMarkerStart).trim();
    // For the last option (e.g. D), remove any footer/noise lines that might follow it before the next label
    if (i === matches.length - 1) {
      const lines = content.split(/\r?\n/).filter((l) => !isNoiseLine(l));
      content = lines.join(" ").trim();
    }
    opts[matches[i].letter] = sanitizeText(content);
  }

  return opts;
}

function parseBlock(block) {
  try {
    const qidMatch = block.match(/^\s*question\s*id\s*:\s*(\S+)/i);
    const questionId = qidMatch ? sanitizeText(qidMatch[1]) : fieldValue(block, "Question ID", true);
    const question = fieldValue(block, "Question");
    const type = normalizeType(fieldValue(block, "Type", true));
    const optionsText = fieldValue(block, "Options");
    const options = parseOptions(optionsText);
    const rawAnswer = fieldValue(block, "Correct Answer", true);

    const raw = {
      questionId,
      question,
      type,
      subject: fieldValue(block, "Subject", true),
      marks: fieldValue(block, "Marks", true) || "0",
      negativeMarks: fieldValue(block, "Negative Marks", true) || "0",
      difficulty: fieldValue(block, "Difficulty", true),
      options,
      correctAnswer: normalizeAnswer(rawAnswer, type, options),
      explanation: fieldValue(block, "Explanation"),
    };
    return raw;
  } catch {
    return null;
  }
}

function splitBlocks(text) {
  const lines = (text || "").split(/\r?\n/);
  const idRegex = /^\s*question\s*id\s*:/i;
  const qRegex = /^\s*question\s*:/i;

  const idIndices = [];
  const qIndices = [];
  lines.forEach((line, i) => {
    if (idRegex.test(line)) idIndices.push(i);
    else if (qRegex.test(line)) qIndices.push(i);
  });

  const splits = idIndices.length >= 1 ? idIndices : qIndices.length >= 1 ? qIndices : [];
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

function parseLabeled(text) {
  const cleaned = cleanExtractedText(text);
  const blocks = splitBlocks(cleaned);
  const out = [];
  for (const block of blocks) {
    const parsed = parseBlock(block);
    if (parsed && parsed.question) out.push(parsed);
  }
  return out;
}

/* ============================================================
   DOCX + PDF EXTRACTION
   ============================================================ */

async function extractDocxText(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return cleanExtractedText(result.value || "");
}

async function extractPDFText(buffer) {
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

/* ============================================================
   MAIN DISPATCH
   ============================================================ */

export async function parseQuestions(buffer, kind) {
  if (kind === "csv") {
    return parseCSV(buffer.toString("utf8"));
  }
  if (kind === "docx") {
    const text = await extractDocxText(buffer);
    if (!text || !text.trim()) {
      throw new Error("We couldn't read any text from this Word file. Please use the official .docx template.");
    }
    return parseLabeled(text);
  }
  if (kind === "pdf") {
    const text = await extractPDFText(buffer);
    if (!text || !text.trim()) {
      throw new Error("We couldn't read this PDF. It may be scanned or image-based. Please use the official template.");
    }
    return parseLabeled(text);
  }
  throw new Error("Unsupported file type");
}

/* ============================================================
   VALIDATION LAYER (shared)
   ============================================================ */

export function validateQuestions(questions) {
  const valid = [];
  const invalid = [];

  questions.forEach((q, i) => {
    const errors = [];
    const label = q.questionId || `Q${String(i + 1).padStart(3, "0")}`;

    if (!q.question || !q.question.trim()) errors.push("Question text is empty");

    if (!q.type || !ALLOWED_TYPES.includes(q.type)) {
      errors.push("Type must be MCQ, True/False or Short Answer");
    }

    if (!q.subject || !q.subject.trim()) errors.push("Subject is missing");

    const marks = Number(q.marks);
    if (
      q.marks === undefined ||
      q.marks === null ||
      q.marks === "" ||
      isNaN(marks) ||
      marks < 0
    ) {
      errors.push("Marks must be a number greater than or equal to 0");
    }

    if (!q.difficulty || !ALLOWED_DIFFICULTIES.includes(q.difficulty)) {
      errors.push("Difficulty must be Easy, Medium or Hard");
    }

    const ca = q.correctAnswer ? q.correctAnswer.toString().trim() : "";
    if (!ca) {
      errors.push("Correct Answer is missing");
    } else if (q.type === "MCQ" && !["A", "B", "C", "D"].includes(ca.toUpperCase())) {
      errors.push("Correct Answer must be A, B, C or D");
    }

    if (q.type === "MCQ") {
      const opts = q.options || {};
      OPTION_KEYS.forEach((k) => {
        if (!opts[k] || !opts[k].trim()) errors.push(`Option ${k} is missing`);
      });
    }

    const neg = Number(q.negativeMarks);
    if (
      q.negativeMarks !== undefined &&
      q.negativeMarks !== null &&
      q.negativeMarks !== "" &&
      (isNaN(neg) || neg < 0)
    ) {
      errors.push("Negative Marks must be a number greater than or equal to 0");
    }

    if (errors.length > 0) {
      invalid.push({ index: i, label, question: q.question || "", errors });
    } else {
      valid.push(q);
    }
  });

  return { valid, invalid };
}

/* ============================================================
   DUPLICATE DETECTION (within a single upload)
   ============================================================ */

export function findDuplicates(questions) {
  const seen = new Map();
  const duplicates = [];
  questions.forEach((q, i) => {
    const key = sanitizeText(q.question).toLowerCase();
    if (!key) return;
    const label = q.questionId || `Q${String(i + 1).padStart(3, "0")}`;
    if (seen.has(key)) {
      duplicates.push({ index: i, label, firstLabel: seen.get(key) });
    } else {
      seen.set(key, label);
    }
  });
  return duplicates;
}

/* ============================================================
   NORMALIZE TO APP QUESTION MODEL (QuestionEditor shape)
   ============================================================ */

export function toAppQuestion(q) {
  const type = q.type === "Short Answer" ? "Descriptive" : q.type;
  let options = [];
  let correctAnswer = (q.correctAnswer || "").toString().trim();

  if (q.type === "MCQ") {
    options = OPTION_KEYS.map((k) => (q.options?.[k] || "").trim());
  } else if (q.type === "True/False") {
    options = ["True", "False"];
    if (correctAnswer.toUpperCase() === "A") correctAnswer = "true";
    else if (correctAnswer.toUpperCase() === "B") correctAnswer = "false";
  }

  return {
    type,
    question: sanitizeText(q.question),
    options,
    correctAnswer,
    marks: Number(q.marks) || 0,
    negativeMarks: Number(q.negativeMarks) || 0,
    explanation: sanitizeText(q.explanation),
    subject: sanitizeText(q.subject),
    difficulty: (q.difficulty || "Medium").toLowerCase(),
    source: "import",
  };
}

/* ============================================================
   FILE TYPE DETECTION
   ============================================================ */

export function detectFileKind(originalname = "", mimetype = "") {
  const name = (originalname || "").toLowerCase();
  const mime = (mimetype || "").toLowerCase();
  if (name.endsWith(".csv") || mime.includes("csv")) return "csv";
  if (name.endsWith(".docx") || mime.includes("officedocument")) return "docx";
  if (name.endsWith(".pdf") || mime.includes("pdf")) return "pdf";
  return null;
}

const PLACEHOLDER_RE = /\[|\]/;

export function containsPlaceholder(questions) {
  if (!Array.isArray(questions)) return false;
  return questions.some((q) => {
    const fields = [
      q.questionId,
      q.question,
      q.subject,
      q.options?.A,
      q.options?.B,
      q.options?.C,
      q.options?.D,
      q.correctAnswer,
      q.explanation,
      q.difficulty,
      q.type,
      q.marks,
      q.negativeMarks,
    ];
    return fields.some((f) => f != null && PLACEHOLDER_RE.test(String(f)));
  });
}
