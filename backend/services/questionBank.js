import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const APTITUDE_DIR_CANDIDATES = [
  path.resolve(process.cwd(), "backend/data/aptitude"),
  path.resolve(__dirname, "../data/aptitude"),
  path.resolve(__dirname, "../../backend/data/aptitude"),
];

const LEGACY_JSON_PATHS = [
  path.resolve(process.cwd(), "frontend/src/data/aptitude.json"),
  path.resolve(__dirname, "../../frontend/src/data/aptitude.json"),
  path.resolve(__dirname, "../../../frontend/src/data/aptitude.json"),
];

let bank = [];
let bankMap = new Map();
let loadedFrom = null;

const VALID_DIFFICULTY_SET = new Set(["easy", "medium", "hard"]);

export function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function resolveAptitudeDir() {
  for (const candidate of APTITUDE_DIR_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function listAptitudeSourceFiles() {
  const dir = resolveAptitudeDir();
  if (!dir) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => path.join(dir, file));
}

function normalize(raw, index, sourceLength) {
  let difficulty = "easy";
  const total = Number(sourceLength) || 0;
  if (total > 0) {
    if (index >= Math.floor(total / 3) * 2) difficulty = "hard";
    else if (index >= Math.floor(total / 3)) difficulty = "medium";
  }
  return {
    questionId: String(raw.id ?? raw.questionId ?? raw._id ?? `AQ${String(index + 1).padStart(4, "0")}`),
    category: raw.category || "General",
    question: raw.question,
    options: Array.isArray(raw.options) ? raw.options.map(String) : [],
    correctAnswer: String(raw.answer ?? raw.correctAnswer ?? ""),
    explanation: raw.explanation || "",
    difficulty: String(raw.difficulty || difficulty).toLowerCase(),
    marks: Number(raw.marks) || 1,
    companyId: raw.companyId || "",
    companyName: raw.companyName || "",
  };
}

function dedupeQuestions(questions) {
  const seenIds = new Set();
  const seenSignature = new Set();
  const result = [];
  for (const q of questions) {
    const key = String(q.questionId);
    const signature = JSON.stringify([
      String(q.question || "").trim().toLowerCase().replace(/\s+/g, " "),
      (q.options || []).map((o) => String(o).trim().toLowerCase().replace(/\s+/g, " ")).sort(),
      String(q.correctAnswer || "").trim().toLowerCase().replace(/\s+/g, " "),
    ]);
    if (seenIds.has(key) || seenSignature.has(signature)) continue;
    seenIds.add(key);
    seenSignature.add(signature);
    result.push(q);
  }
  return result;
}

export function loadAptitudeBank() {
  // Preferred source: backend/data/aptitude/*.json (topic-grouped question bank)
  const sourceFiles = listAptitudeSourceFiles();
  if (sourceFiles.length > 0) {
    const all = [];
    for (const filePath of sourceFiles) {
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
        const source = Array.isArray(raw) ? raw : Array.isArray(raw.questions) ? raw.questions : [];
        all.push(
          ...source.map((q, index) => normalize(q, index, source.length)).filter((q) => q.question && q.options.length > 0 && q.correctAnswer)
        );
      } catch (error) {
        console.error(`⚠️ Failed to parse aptitude bank file ${path.basename(filePath)}:`, error.message);
      }
    }
    bank = dedupeQuestions(all);
    bankMap = new Map(bank.map((q) => [q.questionId, q]));
    loadedFrom = path.basename(sourceFiles[0]) + " (+" + (sourceFiles.length - 1) + " more)";
    const byDifficulty = bank.reduce((acc, q) => { acc[q.difficulty] = (acc[q.difficulty] || 0) + 1; return acc; }, {});
    const byCategory = bank.reduce((acc, q) => { acc[q.category] = (acc[q.category] || 0) + 1; return acc; }, {});
    console.log(`📚 Aptitude bank loaded: ${bank.length} unique questions from backend/data/aptitude/`);
    console.log(`   Difficulty mix: easy=${byDifficulty.easy || 0}, medium=${byDifficulty.medium || 0}, hard=${byDifficulty.hard || 0}`);
    console.log(`   Topics: ${Object.entries(byCategory).map(([c, n]) => `${c} (${n})`).join(", ")}`);
    return bank.length;
  }

  // Fallback: legacy single-file bank
  for (const candidate of LEGACY_JSON_PATHS) {
    if (fs.existsSync(candidate)) {
      try {
        const raw = JSON.parse(fs.readFileSync(candidate, "utf8"));
        const source = Array.isArray(raw) ? raw : Array.isArray(raw.questions) ? raw.questions : [];
        bank = dedupeQuestions(
          source.map((q, index) => normalize(q, index, source.length)).filter((q) => q.question && q.options.length > 0 && q.correctAnswer)
        );
        bankMap = new Map(bank.map((q) => [q.questionId, q]));
        loadedFrom = candidate;
        const byDifficulty = bank.reduce((acc, q) => { acc[q.difficulty] = (acc[q.difficulty] || 0) + 1; return acc; }, {});
        console.log(`📚 Aptitude bank loaded: ${bank.length} unique questions in memory (legacy ${candidate})`);
        console.log(`   Difficulty mix: easy=${byDifficulty.easy || 0}, medium=${byDifficulty.medium || 0}, hard=${byDifficulty.hard || 0}`);
        return bank.length;
      } catch (error) {
        console.error("Failed to parse aptitude.json:", error.message);
      }
    }
  }
  console.warn("⚠️ aptitude question bank not found — in-memory bank is empty. Admin questions will still work.");
  return 0;
}

export function getBank() {
  return bank;
}

export function getBankMap() {
  return bankMap;
}

export function getQuestionById(questionId) {
  if (!questionId) return null;
  return bankMap.get(String(questionId)) || null;
}

export function upsertBankQuestion(question) {
  if (!question || !question.questionId) return;
  const existing = bankMap.get(String(question.questionId));
  if (existing) {
    Object.assign(existing, {
      category: question.category || existing.category,
      question: question.question,
      options: question.options || existing.options,
      correctAnswer: question.correctAnswer || existing.correctAnswer,
      explanation: question.explanation !== undefined ? question.explanation : existing.explanation,
      difficulty: String(question.difficulty || existing.difficulty).toLowerCase(),
      marks: Number(question.marks) || existing.marks,
      companyId: question.companyId || "",
      companyName: question.companyName || "",
      _active: question.isActive !== false,
    });
  } else {
    bank.push({
      questionId: String(question.questionId),
      category: question.category || "General",
      question: question.question,
      options: question.options || [],
      correctAnswer: question.correctAnswer || "",
      explanation: question.explanation || "",
      difficulty: String(question.difficulty || "easy").toLowerCase(),
      marks: Number(question.marks) || 1,
      companyId: question.companyId || "",
      companyName: question.companyName || "",
      _active: question.isActive !== false,
    });
    bankMap.set(String(question.questionId), bank[bank.length - 1]);
  }
}

export function deactivateBankQuestion(questionId) {
  const q = bankMap.get(String(questionId));
  if (q) q._active = false;
}

export function selectRandomQuestions({ count = 15, difficulty = "", companyId = "", excludeIds = [], distribution = null } = {}) {
  const excluded = new Set((excludeIds || []).map((id) => String(id)));
  const picked = new Set();

  const basePool = bank.filter((q) => q._active !== false);
  let pool = basePool;
  if (companyId) {
    const assigned = basePool.filter((q) => q.companyId === companyId || q.companyName === companyId);
    if (assigned.length > 0) pool = assigned;
  }

  const needs = { easy: 0, medium: 0, hard: 0 };
  if (distribution) {
    needs.easy = Math.max(0, Math.floor(Number(distribution.easy) || 0));
    needs.medium = Math.max(0, Math.floor(Number(distribution.medium) || 0));
    needs.hard = Math.max(0, Math.floor(Number(distribution.hard) || 0));
  } else if (difficulty && VALID_DIFFICULTY_SET.has(String(difficulty).toLowerCase())) {
    needs[String(difficulty).toLowerCase()] = Math.max(0, Math.floor(Number(count) || 0));
  } else {
    const base = Math.max(0, Math.floor(Number(count) || 0) / 3);
    const remainder = Math.max(0, Math.floor(Number(count) || 0)) - Math.floor(base) * 3;
    needs.easy = Math.floor(base) + (remainder > 0 ? 1 : 0);
    needs.medium = Math.floor(base) + (remainder > 1 ? 1 : 0);
    needs.hard = Math.floor(base);
  }

  const results = [];
  for (const diff of ["easy", "medium", "hard"]) {
    const want = needs[diff];
    if (want <= 0) continue;
    const byDifficulty = pool.filter((q) => q.difficulty === diff);
    // Priority 1: questions never used by this student before
    let candidates = byDifficulty.filter((q) => !excluded.has(String(q.questionId)) && !picked.has(String(q.questionId)));
    if (candidates.length < want) {
      // Priority 2: fall back to recently used questions, but never within the same paper
      const topUp = byDifficulty.filter((q) => !picked.has(String(q.questionId)));
      const seen = new Set(candidates.map((q) => String(q.questionId)));
      for (const q of topUp) if (!seen.has(String(q.questionId))) { candidates.push(q); seen.add(String(q.questionId)); }
    }
    const chosen = shuffleArray(candidates).slice(0, want);
    chosen.forEach((q) => picked.add(String(q.questionId)));
    results.push(...chosen);
  }

  return shuffleArray(results);
}
