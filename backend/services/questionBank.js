import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const APTITUDE_JSON_PATHS = [
  path.resolve(process.cwd(), "frontend/src/data/aptitude.json"),
  path.resolve(__dirname, "../../frontend/src/data/aptitude.json"),
  path.resolve(__dirname, "../../../frontend/src/data/aptitude.json"),
];

let bank = [];
let bankMap = new Map();
let loadedFrom = null;

export function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function normalize(raw, index) {
  let difficulty = "easy";
  if (index >= Math.floor(raw.length / 3) * 2) difficulty = "hard";
  else if (index >= Math.floor(raw.length / 3)) difficulty = "medium";
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

export function loadAptitudeBank() {
  for (const candidate of APTITUDE_JSON_PATHS) {
    if (fs.existsSync(candidate)) {
      try {
        const raw = JSON.parse(fs.readFileSync(candidate, "utf8"));
        const source = Array.isArray(raw) ? raw : Array.isArray(raw.questions) ? raw.questions : [];
        bank = source.map(normalize).filter((q) => q.question && q.options.length > 0 && q.correctAnswer);
        bankMap = new Map(bank.map((q) => [q.questionId, q]));
        loadedFrom = candidate;
        console.log(`📚 Aptitude bank loaded: ${bank.length} questions in memory (${candidate})`);
        return bank.length;
      } catch (error) {
        console.error("Failed to parse aptitude.json:", error.message);
      }
    }
  }
  console.warn("⚠️ aptitude.json not found — in-memory bank is empty. Admin questions will still work.");
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

export function selectRandomQuestions({ count = 15, difficulty = "", companyId = "" }) {
  let pool = bank.filter((q) => q._active !== false);
  if (difficulty) {
    const wanted = String(difficulty).toLowerCase();
    const matched = pool.filter((q) => q.difficulty === wanted);
    if (matched.length > 0) pool = matched;
  }
  if (companyId) {
    const assigned = pool.filter((q) => q.companyId === companyId || q.companyName === companyId);
    if (assigned.length > 0) pool = assigned;
  }
  const shuffled = shuffleArray(pool);
  return shuffled.slice(0, count);
}
