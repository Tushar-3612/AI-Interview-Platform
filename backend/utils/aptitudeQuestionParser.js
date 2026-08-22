import mammoth from "mammoth";
import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.standardFontDataUrl = new URL(
  "pdfjs-dist/standard_fonts/",
  import.meta.url
).toString();

/* ============================================================
   CONSTANTS
   ============================================================ */

export const ALLOWED_TYPES = ["MCQ"];
export const ALLOWED_DIFFICULTIES = ["Easy", "Medium", "Hard"];
const OPTION_KEYS = ["A", "B", "C", "D"];

const LABELS = [
  "Question ID",
  "Question",
  "Type",
  "Marks",
  "Negative Marks",
  "Difficulty",
  "Options",
  "Correct Answer",
  "Explanation",
];

/* ============================================================
   HELPERS
   ============================================================ */

function regexEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeText(value) {
  if (!value) return "";
  return String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .trim();
}

function normalizeType(raw) {
  const t = sanitizeTextType(raw);
  if (!t) return "";
  if (t.toLowerCase().includes("mcq") || t.toLowerCase().includes("multiple choice")) return "MCQ";
  return t;
}

function sanitizeTextType(value) {
  if (!value) return "";
  return String(value).replace(/<[^>]*>/g, "").trim();
}

function normalizeAnswer(raw) {
  const a = sanitizeText(raw);
  if (!a) return "";
  const m = a.match(/^([A-Da-d])\s*[.)]?\s*$/);
  return m ? m[1].toUpperCase() : a.toUpperCase();
}

/* ============================================================
   CSV PARSER (uses xlsx for robust quote/comma handling)
   ============================================================ */

function parseCSV(text) {
  let rows;
  try {
    const wb = XLSX.read(text, { type: "string" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
  } catch {
    throw new Error("Could not read the CSV file. Please use the official aptitude template.");
  }
  if (!Array.isArray(rows) || rows.length === 0) return [];

  return rows.map((r) => {
    const get = (k) => (r[k] === undefined || r[k] === null ? "" : String(r[k]).trim());
    return {
      questionId: get("question_id"),
      question: get("question"),
      type: normalizeType(get("type")),
      marks: get("marks") || "0",
      negativeMarks: get("negative_marks") || "0",
      difficulty: get("difficulty"),
      options: {
        A: get("option_a"),
        B: get("option_b"),
        C: get("option_c"),
        D: get("option_d"),
      },
      correctAnswer: normalizeAnswer(get("correct_answer")),
      explanation: get("explanation"),
    };
  });
}

/* ============================================================
   LABEL-BASED PARSER (DOCX + PDF) — Aptitude has no Subject
   ============================================================ */

function fieldValue(block, label) {
  const re = new RegExp(`\\n\\s*${regexEscape(label)}\\s*:\\s*`, "i");
  const m = re.exec(block);
  if (!m) return "";
  const start = m.index + m[0].length;
  let end = block.length;
  for (const l of LABELS) {
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

function parseOptions(text) {
  const opts = {};
  if (!text) return opts;
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
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
    opts[matches[i].letter] = sanitizeText(normalized.slice(contentStart, nextMarkerStart).trim());
  }
  return opts;
}

function parseBlock(block) {
  try {
    const qidMatch = block.match(/^\s*question\s*id\s*:\s*(\S+)/i);
    const questionId = qidMatch ? sanitizeText(qidMatch[1]) : "";
    const question = fieldValue(block, "Question");
    const type = normalizeType(fieldValue(block, "Type"));
    const optionsText = fieldValue(block, "Options");
    const options = parseOptions(optionsText);
    return {
      questionId,
      question,
      type,
      marks: fieldValue(block, "Marks") || "0",
      negativeMarks: fieldValue(block, "Negative Marks") || "0",
      difficulty: fieldValue(block, "Difficulty"),
      options,
      correctAnswer: normalizeAnswer(fieldValue(block, "Correct Answer")),
      explanation: fieldValue(block, "Explanation"),
    };
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
  const blocks = splitBlocks(text);
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
  return result.value || "";
}

async function extractPDFText(buffer) {
  const uint8 = new Uint8Array(buffer);
  const pdf = await pdfjsLib.getDocument({ data: uint8 }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    await pdf.getPage(i);
  }
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

/* ============================================================
   MAIN DISPATCH
   ============================================================ */

export async function parseQuestions(buffer, kind) {
  if (kind === "csv") return parseCSV(buffer.toString("utf8"));
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
   VALIDATION LAYER (Aptitude MCQ)
   ============================================================ */

export function validateQuestions(questions) {
  const valid = [];
  const invalid = [];
  questions.forEach((q, i) => {
    const errors = [];
    const label = q.questionId || `Q${String(i + 1).padStart(3, "0")}`;

    if (!q.questionId || !q.questionId.trim()) errors.push("Question ID is missing");
    if (!q.question || !q.question.trim()) errors.push("Question text is empty");
    if (!q.type || !ALLOWED_TYPES.includes(q.type)) errors.push("Type must be MCQ");
    const marks = Number(q.marks);
    if (q.marks === undefined || q.marks === null || q.marks === "" || isNaN(marks) || marks < 0) {
      errors.push("Marks must be a number greater than or equal to 0");
    }
    const neg = Number(q.negativeMarks);
    if (q.negativeMarks !== undefined && q.negativeMarks !== null && q.negativeMarks !== "" && (isNaN(neg) || neg < 0)) {
      errors.push("Negative Marks must be a number greater than or equal to 0");
    }
    if (!q.difficulty || !ALLOWED_DIFFICULTIES.includes(q.difficulty)) {
      errors.push("Difficulty must be Easy, Medium or Hard");
    }
    const ca = q.correctAnswer ? q.correctAnswer.toString().trim() : "";
    if (!ca) {
      errors.push("Correct Answer is missing");
    } else if (!["A", "B", "C", "D"].includes(ca.toUpperCase())) {
      errors.push("Correct Answer must be A, B, C or D");
    }
    OPTION_KEYS.forEach((k) => {
      if (!q.options?.[k] || !q.options[k].trim()) errors.push(`Option ${k} is missing`);
    });

    if (errors.length > 0) invalid.push({ index: i, label, question: q.question || "", errors });
    else valid.push(q);
  });
  return { valid, invalid };
}

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

export function toAptitudeQuestion(q) {
  const type = "MCQ";
  const options = OPTION_KEYS.map((k) => (q.options?.[k] || "").trim());
  const caLetter = (q.correctAnswer || "").toString().trim().toUpperCase();
  const correctAnswer = options[OPTION_KEYS.indexOf(caLetter)] || "";
  return {
    questionId: sanitizeText(q.questionId),
    question: sanitizeText(q.question),
    type,
    options,
    correctAnswer,
    difficulty: (q.difficulty || "Medium").toLowerCase(),
    marks: Number(q.marks) || 1,
    negativeMarks: Number(q.negativeMarks) || 0,
    explanation: sanitizeText(q.explanation),
    category: "General",
  };
}

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
