import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import CodingQuestion from "../models/CodingQuestion.js";
import Company from "../models/Company.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CODING_DIR_CANDIDATES = [
  path.resolve(process.cwd(), "backend/data/coding"),
  path.resolve(__dirname, "../data/coding"),
  path.resolve(__dirname, "../../backend/data/coding"),
];

const LEGACY_JSON_PATHS = [
  path.resolve(process.cwd(), "frontend/src/data/coding.json"),
  path.resolve(__dirname, "../../frontend/src/data/coding.json"),
];

export function resolveCodingDataDir() {
  for (const candidate of CODING_DIR_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function listCodingSourceFiles() {
  const dir = resolveCodingDataDir();
  if (!dir) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => ({
      file,
      company: file.replace(/\.json$/, ""),
      path: path.join(dir, file),
      count: 0,
    }));
}

export function loadCodingBank() {
  const dir = resolveCodingDataDir();
  const entries = dir ? listCodingSourceFiles() : [];

  if (entries.length > 0) {
    return entries.map((entry) => {
      try {
        const raw = JSON.parse(fs.readFileSync(entry.path, "utf8"));
        const questions = Array.isArray(raw) ? raw : Array.isArray(raw.questions) ? raw.questions : [];
        return { ...entry, questions };
      } catch (error) {
        console.error(`⚠️ Failed to parse ${entry.file}:`, error.message);
        return { ...entry, questions: [] };
      }
    });
  }

  for (const candidate of LEGACY_JSON_PATHS) {
    if (fs.existsSync(candidate)) {
      try {
        const raw = JSON.parse(fs.readFileSync(candidate, "utf8"));
        const questions = Array.isArray(raw) ? raw : Array.isArray(raw.questions) ? raw.questions : [];
        return [{ file: path.basename(candidate), company: "legacy", path: candidate, questions }];
      } catch (error) {
        console.error("⚠️ Failed to parse legacy coding.json:", error.message);
      }
    }
  }

  return [];
}

export function normalizeCodingQuestion(raw, { companyMap = {}, fallbackCompanyId = "" } = {}) {
  if (!raw || !raw.title || !raw.problemStatement) return null;

  const companyId = String(raw.companyId || raw.company || fallbackCompanyId || "");
  const companyName = companyMap[companyId] || raw.companyName || raw.company || "";

  const examples = Array.isArray(raw.examples) && raw.examples.length > 0
    ? raw.examples.map((ex) => ({
        input: String(ex.input ?? ""),
        output: String(ex.output ?? ""),
        explanation: String(ex.explanation ?? ""),
      }))
    : (raw.sampleInput || raw.sampleOutput)
      ? [{ input: String(raw.sampleInput ?? ""), output: String(raw.sampleOutput ?? ""), explanation: String(raw.explanation ?? "") }]
      : [];

  const firstExample = examples[0] || {};
  const publicTestCases = Array.isArray(raw.publicTestCases) ? raw.publicTestCases : [];
  const hiddenTestCases = Array.isArray(raw.hiddenTestCases) ? raw.hiddenTestCases : [];
  const legacyTestCases = Array.isArray(raw.testCases) ? raw.testCases : [];
  const testCases =
    publicTestCases.length > 0 || hiddenTestCases.length > 0
      ? [
          ...publicTestCases.map((tc) => ({ input: String(tc.input ?? ""), expected: String(tc.expected ?? ""), isHidden: false })),
          ...hiddenTestCases.map((tc) => ({ input: String(tc.input ?? ""), expected: String(tc.expected ?? ""), isHidden: true })),
        ]
      : legacyTestCases.map((tc) => ({ input: String(tc.input ?? ""), expected: String(tc.expected ?? ""), isHidden: Boolean(tc.isHidden) }));

  return {
    questionId: String(raw.id ?? raw.questionId ?? ""),
    title: String(raw.title).trim(),
    difficulty: ["Easy", "Medium", "Hard"].includes(raw.difficulty) ? raw.difficulty : "Medium",
    category: String(raw.category || ""),
    problemStatement: String(raw.problemStatement).trim(),
    description: String(raw.description || ""),
    inputFormat: String(raw.inputFormat || ""),
    outputFormat: String(raw.outputFormat || ""),
    constraints: String(raw.constraints || ""),
    sampleInput: String(raw.sampleInput ?? firstExample.input ?? ""),
    sampleOutput: String(raw.sampleOutput ?? firstExample.output ?? ""),
    explanation: String(raw.explanation || firstExample.explanation || ""),
    examples,
    starterCode: String(raw.starterCode || "function solution() {\n  // Write your code here\n}"),
    testCases,
    languages: Array.isArray(raw.supportedLanguages) && raw.supportedLanguages.length > 0
      ? raw.supportedLanguages
      : Array.isArray(raw.languages) && raw.languages.length > 0
        ? raw.languages
        : ["JavaScript", "Python", "Java", "C++"],
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    companyId,
    companyName,
    marks: Number(raw.marks) || 10,
    timeLimit: Number(raw.timeLimit) || 1000,
    memoryLimit: Number(raw.memoryLimit) || 256,
    isActive: raw.isActive !== false,
  };
}

export async function syncCodingQuestionsFromJson() {
  const sources = loadCodingBank();
  if (sources.length === 0) {
    console.warn("⚠️ No coding question JSON files found — nothing to sync.");
    return { files: 0, total: 0, inserted: 0, updated: 0, unchanged: 0, skipped: 0, sources: [] };
  }

  const companies = await Company.find().lean();
  const companyMap = Object.fromEntries(companies.flatMap((c) => [[c.id, c.name], [String(c.name).toLowerCase(), c.name]]));

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  const sourcesSummary = [];

  for (const source of sources) {
    let fileInserted = 0;
    let fileUpdated = 0;
    for (const raw of source.questions) {
      const doc = normalizeCodingQuestion(raw, { companyMap, fallbackCompanyId: source.company });
      if (!doc) {
        skipped++;
        continue;
      }

      const query = doc.questionId
        ? { questionId: doc.questionId }
        : { title: doc.title, companyId: doc.companyId };
      let existing = doc.questionId ? await CodingQuestion.findOne(query) : null;
      if (!existing) {
        existing = await CodingQuestion.findOne({ title: doc.title, companyId: doc.companyId });
      }

      if (!existing) {
        const timestamps = {};
        if (raw.createdAt) timestamps.createdAt = new Date(raw.createdAt);
        await CodingQuestion.create({ ...doc, isDeleted: false, deletedAt: null, ...timestamps });
        inserted++;
        fileInserted++;
        continue;
      }

      const contentFields = [
        "questionId", "title", "difficulty", "category", "problemStatement", "description",
        "inputFormat", "outputFormat", "constraints", "sampleInput", "sampleOutput",
        "explanation", "examples", "starterCode", "testCases", "languages", "tags",
        "companyId", "companyName", "marks", "timeLimit", "memoryLimit",
      ];
      const changed = contentFields.some((key) => JSON.stringify(doc[key]) !== JSON.stringify(existing[key]));
      if (changed) {
        await CodingQuestion.updateOne(
          { _id: existing._id },
          { ...doc, isDeleted: existing.isDeleted, deletedAt: existing.deletedAt, lastEditedAt: new Date() }
        );
        updated++;
        fileUpdated++;
      } else {
        unchanged++;
      }
    }
    sourcesSummary.push({ file: source.file, company: source.company, total: source.questions.length, inserted: fileInserted, updated: fileUpdated });
  }

  const total = inserted + updated + unchanged;
  console.log(`💻 Coding bank sync: ${sources.length} file(s), ${total} questions (${inserted} inserted, ${updated} updated, ${unchanged} unchanged, ${skipped} skipped)`);
  return { files: sources.length, total, inserted, updated, unchanged, skipped, sources: sourcesSummary };
}
