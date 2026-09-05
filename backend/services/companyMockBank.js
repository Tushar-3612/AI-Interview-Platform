import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import AptitudeQuestion from "../models/AptitudeQuestion.js";
import TechnicalQuestion from "../models/TechnicalQuestion.js";
import CodingQuestion from "../models/CodingQuestion.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Company Mock question bank loader.
 *
 * The authoritative source of truth for Celebal Company Mock questions is:
 *   backend/data/celebal/technical.json
 *
 * This single file contains BOTH:
 *   - MCQ questions (have options[] + correctAnswer)
 *   - Free-text / Technical questions (no MCQ options, AI-evaluated)
 *
 * Question type is auto-detected from the data:
 *   - If options[] is non-empty and correctAnswer exists → MCQ
 *   - Otherwise → Technical (AI evaluated)
 *
 * For other companies, the legacy path is used:
 *   backend/data/companyMock/<Company>/technical.json
 *
 * Aptitude is intentionally NOT stored here — it uses the existing
 * common aptitude bank (backend/data/aptitude + DB).
 *
 * Question selection must NEVER mix technical/coding questions between
 * companies: only the selected company's folder is read.
 */

// Path candidates for the companyMock folder (legacy companies)
const COMPANY_MOCK_DIR_CANDIDATES = [
  path.resolve(process.cwd(), "backend/data/companyMock"),
  path.resolve(__dirname, "../data/companyMock"),
  path.resolve(__dirname, "../../backend/data/companyMock"),
];

function companyMockDir() {
  for (const candidate of COMPANY_MOCK_DIR_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

// Normalize a folder/base name (e.g. "Accenture" or "accenture") to the folder
// slug used on disk (lowercased). Celebal → "celebal".
export function toFolderName(company) {
  return String(company || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

/**
 * Normalize raw string for safe, whitespace-collapsed, case-insensitive comparison.
 */
export function normalizeQuestionText(text) {
  if (!text) return "";
  return String(text)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normalize a raw question object from the question bank into the standard
 * internal format used by Company Mock.
 */
function normalizeQuestion(q, company) {
  const hasOptions = Array.isArray(q.options) && q.options.length > 0;
  const hasCorrectAnswer = !!q.correctAnswer && String(q.correctAnswer).trim() !== "";
  const isMCQ = hasOptions && hasCorrectAnswer;

  // Normalize questionType from source data
  let qType = q.questionType || (isMCQ ? "MCQ" : "Technical");
  if (qType === "Descriptive") qType = "Technical";
  if (qType === "Conceptual") qType = isMCQ ? "MCQ" : "Technical";
  if (isMCQ) qType = "MCQ";

  return {
    questionId: String(q.questionId || q._id || ""),
    topic: q.topic || q.category || q.subtopic || "Technical Fundamentals",
    subtopic: q.subtopic || "",
    difficulty: q.difficulty || "Medium",
    questionType: qType,
    question: q.question || q.title || "",
    options: isMCQ ? q.options.map(String) : [],
    correctAnswer: isMCQ ? String(q.correctAnswer) : "",
    expectedAnswer: String(q.expectedAnswer || q.correctAnswer || ""),
    explanation: q.explanation || "",
    betterAnswer: q.betterAnswer || "",
    marks: q.marks || 3,
    companyId: String(q.companyId || company || ""),
    source: q.source || "company_mock",
    questionStatus: q.questionStatus || null,
    isAiEvaluated: !isMCQ,
    isDeleted: !!q.isDeleted,
    isActive: q.isActive !== false,
  };
}

/**
 * Load company questions from companyMock/<folder>/:
 *   - mcq.json (MCQ questions)
 *   - technical.json (free-text or technical questions)
 */
export function loadCompanyQuestionsFromFolder(folder) {
  const dir = companyMockDir();
  if (!dir) return [];
  const compDir = path.join(dir, folder);
  if (!fs.existsSync(compDir)) return [];
  const results = [];

  // Load MCQ questions
  const mcqFile = path.join(compDir, "mcq.json");
  if (fs.existsSync(mcqFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(mcqFile, "utf8"));
      const arr = Array.isArray(raw) ? raw : Array.isArray(raw.questions) ? raw.questions : [];
      results.push(...arr.filter((q) => q && (q.question || q.title) && !!q.questionId).map((q) => normalizeQuestion(q, folder)));
    } catch (error) {
      console.warn(`[COMPANY MOCK] Failed to parse ${folder}/mcq.json:`, error.message);
    }
  }

  // Load free-text / technical questions
  const techFile = path.join(compDir, "technical.json");
  if (fs.existsSync(techFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(techFile, "utf8"));
      const arr = Array.isArray(raw) ? raw : Array.isArray(raw.questions) ? raw.questions : [];
      results.push(...arr.filter((q) => q && (q.question || q.title) && !!q.questionId).map((q) => normalizeQuestion(q, folder)));
    } catch (error) {
      console.warn(`[COMPANY MOCK] Failed to parse ${folder}/technical.json:`, error.message);
    }
  }

  return results;
}

/**
 * Synchronous legacy loader reading static disk files for technical/MCQ questions.
 */
export function loadCompanyMockTechnical(company) {
  const folder = toFolderName(company);
  return loadCompanyQuestionsFromFolder(folder);
}

/**
 * Async merged loader for technical/MCQ questions:
 * Combines static JSON questions with MongoDB overrides & dynamic questions,
 * respecting suppressions (isDeleted: true).
 */
export async function loadCompanyMockTechnicalAsync(company) {
  const folder = toFolderName(company);
  const baseJsonQuestions = loadCompanyQuestionsFromFolder(folder);

  // Fetch MongoDB documents matching companyId
  const dbTechDocs = await TechnicalQuestion.find({
    $or: [
      { companyId: folder },
      { companyId: { $regex: new RegExp("^" + folder + "$", "i") } },
      { companyIds: folder },
    ],
  }).lean();

  const map = new Map();
  // 1. Seed with base JSON
  for (const q of baseJsonQuestions) {
    if (q.questionId) {
      map.set(q.questionId, q);
    }
  }

  // 2. Overlay MongoDB records (overrides, new questions, and suppressions)
  for (const doc of dbTechDocs) {
    const qId = String(doc.questionId || doc._id);
    const norm = normalizeQuestion(doc, folder);
    norm._id = doc._id;
    norm.questionId = qId;

    if (doc.isDeleted || doc.isActive === false) {
      map.delete(qId);
    } else {
      map.set(qId, norm);
    }
  }

  return Array.from(map.values());
}

/**
 * Synchronous legacy loader reading static disk files for coding questions.
 */
export function loadCompanyMockCoding(company) {
  const dir = companyMockDir();
  if (!dir) return [];
  const file = path.join(dir, toFolderName(company), "coding.json");
  if (!fs.existsSync(file)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const arr = Array.isArray(raw) ? raw : Array.isArray(raw.questions) ? raw.questions : [];
    return arr
      .filter((q) => q && (q.title || q.problemStatement) && !!q.questionId)
      .map((q) => ({
        questionId: String(q.questionId),
        title: q.title || q.problemStatement || "",
        company: String(q.company || company || ""),
        difficulty: q.difficulty || "Medium",
        category: q.category || "",
        tags: Array.isArray(q.tags) ? q.tags : [],
        marks: q.marks || 1,
        problemStatement: q.problemStatement || q.title || "",
        description: q.description || "",
        constraints: q.constraints || "",
        inputFormat: q.inputFormat || "",
        outputFormat: q.outputFormat || "",
        examples: Array.isArray(q.examples) ? q.examples : [],
        explanation: q.explanation || "",
        starterCode: q.starterCode || "",
        languages: Array.isArray(q.supportedLanguages)
          ? q.supportedLanguages
          : Array.isArray(q.languages) && q.languages.length
            ? q.languages
            : ["JavaScript", "Python", "Java", "C++"],
        supportedLanguages: Array.isArray(q.supportedLanguages)
          ? q.supportedLanguages
          : Array.isArray(q.languages) && q.languages.length
            ? q.languages
            : ["JavaScript", "Python", "Java", "C++"],
        publicTestCases: Array.isArray(q.publicTestCases) ? q.publicTestCases : [],
        hiddenTestCases: Array.isArray(q.hiddenTestCases) ? q.hiddenTestCases : [],
        testCases: Array.isArray(q.testCases) ? q.testCases : [],
        timeLimit: q.timeLimit || 1000,
        memoryLimit: q.memoryLimit || 256,
        isDeleted: !!q.isDeleted,
        isActive: q.isActive !== false,
      }));
  } catch (error) {
    console.warn(`[COMPANY MOCK] Failed to parse coding.json for ${company}:`, error.message);
    return [];
  }
}

/**
 * Async merged loader for coding questions:
 * Combines static JSON coding questions with MongoDB CodingQuestion documents,
 * respecting suppressions (isDeleted: true).
 */
export async function loadCompanyMockCodingAsync(company) {
  const folder = toFolderName(company);
  const baseJsonCoding = loadCompanyMockCoding(folder);

  const dbCodingDocs = await CodingQuestion.find({
    $or: [
      { companyId: folder },
      { companyId: { $regex: new RegExp("^" + folder + "$", "i") } },
    ],
  }).lean();

  const map = new Map();
  for (const q of baseJsonCoding) {
    if (q.questionId) {
      map.set(q.questionId, q);
    }
  }

  for (const doc of dbCodingDocs) {
    const qId = String(doc.questionId || doc._id);
    if (doc.isDeleted || doc.isActive === false) {
      map.delete(qId);
    } else {
      map.set(qId, {
        ...doc,
        _id: doc._id,
        questionId: qId,
        company: folder,
        companyId: folder,
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Helper to fetch all questions for Admin view/management (including MCQ, Technical, Coding).
 * Strictly isolated per company — never includes generic or unrelated practice questions.
 */
export async function loadMergedCompanyQuestions(company, type = "all") {
  const folder = toFolderName(company);
  const results = {
    mcq: [],
    technical: [],
    coding: [],
  };

  // Technical & MCQ loaded from company's static JSON + company-specific MongoDB TechnicalQuestion overrides/additions
  const techPool = await loadCompanyMockTechnicalAsync(folder);
  for (const q of techPool) {
    if (q.questionType === "MCQ" || (Array.isArray(q.options) && q.options.length > 0 && q.correctAnswer)) {
      results.mcq.push(q);
    } else {
      results.technical.push(q);
    }
  }

  // Aptitude MCQs from DB created specifically for this company
  const dbAptitude = await AptitudeQuestion.find({
    isDeleted: { $ne: true },
    isActive: true,
    $or: [
      { companyId: folder },
      { companyName: { $regex: new RegExp("^" + folder + "$", "i") } },
    ],
  }).lean();

  for (const apt of dbAptitude) {
    // Only include if explicitly associated with this company
    if (apt.companyId && toFolderName(apt.companyId) === folder) {
      results.mcq.push({
        _id: apt._id,
        questionId: String(apt.questionId || apt._id),
        question: apt.question,
        options: apt.options || [],
        correctAnswer: apt.correctAnswer,
        explanation: apt.explanation || "",
        difficulty: apt.difficulty || "Medium",
        marks: apt.marks || 1,
        topic: apt.category || "Aptitude",
        companyId: folder,
        questionType: "MCQ",
        source: "aptitude_db",
      });
    }
  }

  // Coding questions loaded from company's static JSON + company-specific MongoDB CodingQuestion overrides/additions
  const codingPool = await loadCompanyMockCodingAsync(folder);
  results.coding = codingPool;

  if (type === "mcq") return results.mcq;
  if (type === "technical") return results.technical;
  if (type === "coding") return results.coding;

  return results;
}

/**
 * Whether a company has its own dedicated mock folder on disk or in DB.
 */
export function hasCompanyMockData(company) {
  const dir = companyMockDir();
  if (!dir) return false;
  const folder = toFolderName(company);
  return fs.existsSync(path.join(dir, folder, "technical.json")) ||
    fs.existsSync(path.join(dir, folder, "mcq.json")) ||
    fs.existsSync(path.join(dir, folder, "coding.json"));
}

