import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Company from "../models/Company.js";
import AptitudeQuestion from "../models/AptitudeQuestion.js";
import { loadAptitudeBank, getBank, upsertBankQuestion } from "../services/questionBank.js";
import { syncCodingQuestionsFromJson } from "../services/codingQuestionBank.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_COMPANIES = [
  { id: "tcs", name: "TCS", color: "#001F8E", difficulty: "Easy", description: "Tata Consultancy Services — global IT services leader", package: "3.5 - 7 LPA" },
  { id: "infosys", name: "Infosys", color: "#007CC3", difficulty: "Easy", description: "Infosys — digital services and consulting", package: "3.6 - 6.5 LPA" },
  { id: "wipro", name: "Wipro", color: "#341797", difficulty: "Easy", description: "Wipro — IT, consulting and business process services", package: "3.5 - 6 LPA" },
  { id: "accenture", name: "Accenture", color: "#A100FF", difficulty: "Medium", description: "Accenture — strategy, consulting and technology", package: "4.5 - 8 LPA" },
  { id: "capgemini", name: "Capgemini", color: "#009D6B", difficulty: "Medium", description: "Capgemini — technology consulting and engineering", package: "4 - 7 LPA" },
  { id: "cognizant", name: "Cognizant", color: "#0A6EB4", difficulty: "Medium", description: "Cognizant — engineering, AI and digital solutions", package: "4 - 7.5 LPA" },
  { id: "deloitte", name: "Deloitte", color: "#86BC25", difficulty: "Hard", description: "Deloitte — audit, consulting, tax and advisory", package: "6 - 12 LPA" },
  { id: "benchmark", name: "Benchmark", color: "#6366F1", difficulty: "Hard", description: "Benchmark — mixed difficulty mock placement drive", package: "Varies" },
];

export async function seedDefaultCompanies() {
  let created = 0;
  for (const company of DEFAULT_COMPANIES) {
    const exists = await Company.findOne({ id: company.id });
    if (!exists) {
      await Company.create({ ...company, status: "active", interviewType: "both" });
      created++;
    } else if (exists.isDeleted) {
      exists.isDeleted = false;
      exists.deletedAt = null;
      await exists.save();
    }
  }
  if (created > 0) console.log(`🏢 Seeded ${created} default companies`);
  return created;
}

export async function seedAptitudeQuestionsFromBank() {
  const bank = getBank();
  if (bank.length === 0) return 0;
  let inserted = 0;
  let updated = 0;
  for (const q of bank) {
    const existing = await AptitudeQuestion.findOne({ questionId: q.questionId });
    const doc = {
      category: q.category,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      difficulty: q.difficulty,
      explanation: q.explanation,
      marks: q.marks,
      companyId: q.companyId || "",
      companyName: q.companyName || "",
      isActive: true,
      isDeleted: false,
    };
    if (existing) {
      let changed = false;
      for (const [key, value] of Object.entries(doc)) {
        if (existing[key] !== value && (key === "question" || key === "options" || key === "correctAnswer")) {
          changed = true;
          break;
        }
      }
      if (changed) {
        existing.set(doc);
        await existing.save();
        updated++;
      }
    } else {
      await AptitudeQuestion.create({ ...doc, questionId: q.questionId });
      inserted++;
    }
  }
  if (inserted + updated > 0) console.log(`🧠 Aptitude bank synced to DB: ${inserted} inserted, ${updated} updated`);
  return inserted;
}

export async function seedCodingQuestionsFromJson() {
  const result = await syncCodingQuestionsFromJson();
  return result.inserted;
}

export async function syncAptitudeQuestionToBank(doc) {
  upsertBankQuestion({
    questionId: doc.questionId,
    category: doc.category,
    question: doc.question,
    options: doc.options,
    correctAnswer: doc.correctAnswer,
    explanation: doc.explanation,
    difficulty: doc.difficulty,
    marks: doc.marks,
    companyId: doc.companyId,
    companyName: doc.companyName,
    isActive: doc.isActive,
  });
}

export async function runSeeds() {
  loadAptitudeBank();
  await seedDefaultCompanies();
  await seedAptitudeQuestionsFromBank();
  await seedCodingQuestionsFromJson();
}
