import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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
function toFolderName(company) {
  return String(company || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

/**
 * Normalize a raw question object from the question bank into the standard
 * internal format used by Company Mock.
 *
 * Auto-detects question type:
 *   - Has options[] + correctAnswer → MCQ (questionType: "MCQ")
 *   - Otherwise → Technical (questionType: "Technical", AI evaluated)
 */
function normalizeQuestion(q, company) {
  const hasOptions = Array.isArray(q.options) && q.options.length > 0;
  const hasCorrectAnswer = !!q.correctAnswer && String(q.correctAnswer).trim() !== "";
  const isMCQ = hasOptions && hasCorrectAnswer;

  // Normalize questionType from source data
  let qType = q.questionType || "Technical";
  if (qType === "Descriptive") qType = "Technical";
  if (qType === "Conceptual") qType = isMCQ ? "MCQ" : "Technical";
  if (isMCQ) qType = "MCQ";

  return {
    questionId: String(q.questionId),
    topic: q.topic || q.subtopic || "Technical Fundamentals",
    subtopic: q.subtopic || "",
    difficulty: q.difficulty || "Medium",
    questionType: qType,
    question: q.question,
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
  };
}

/**
 * Load Celebal questions from companyMock/celebal/:
 *   - mcq.json (MCQ questions)
 *   - technical.json (free-text questions)
 *
 * Both files are combined into a single pool.
 * Returns [] if files are absent.
 */
/**
 * Load company questions from companyMock/<folder>/:
 *   - mcq.json (MCQ questions)
 *   - technical.json (free-text or technical questions)
 *
 * Both files are combined into a single pool.
 * Returns [] if files are absent.
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
      results.push(...arr.filter((q) => q && q.question && !!q.questionId).map((q) => normalizeQuestion(q, folder)));
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
      results.push(...arr.filter((q) => q && q.question && !!q.questionId).map((q) => normalizeQuestion(q, folder)));
    } catch (error) {
      console.warn(`[COMPANY MOCK] Failed to parse ${folder}/technical.json:`, error.message);
    }
  }

  return results;
}

/**
 * Load the company-specific technical question pool for a company.
 *
 * Reads from backend/data/companyMock/<folder>/ (mcq.json + technical.json).
 * Returns [] if files are absent.
 */
export function loadCompanyMockTechnical(company) {
  const folder = toFolderName(company);
  return loadCompanyQuestionsFromFolder(folder);
}

/**
 * Load the company-specific coding question pool (real problems) for a company.
 * Returns [] if the file is absent.
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
      }));
  } catch (error) {
    console.warn(`[COMPANY MOCK] Failed to parse coding.json for ${company}:`, error.message);
    return [];
  }
}

/**
 * Whether a company has its own dedicated mock folder on disk.
 * For Celebal, checks the canonical path.
 */
export function hasCompanyMockData(company) {
  const dir = companyMockDir();
  if (!dir) return false;
  const folder = toFolderName(company);
  return fs.existsSync(path.join(dir, folder, "technical.json")) ||
    fs.existsSync(path.join(dir, folder, "mcq.json")) ||
    fs.existsSync(path.join(dir, folder, "coding.json"));
}
