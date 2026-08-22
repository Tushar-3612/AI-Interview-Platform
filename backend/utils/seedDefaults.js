import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Company from "../models/Company.js";
import AptitudeQuestion from "../models/AptitudeQuestion.js";
import TechnicalQuestion from "../models/TechnicalQuestion.js";
import { loadAptitudeBank, getBank, upsertBankQuestion } from "../services/questionBank.js";
import { syncCodingQuestionsFromJson } from "../services/codingQuestionBank.js";
import { TECHNICAL_QUESTIONS, ALL_COMPANIES } from "../data/technicalBank.mjs";

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
        if (existing[key] !== value && (key === "question" || key === "options" || key === "correctAnswer" || key === "difficulty")) {
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

export async function purgeLegacyAptitudeRows() {
  const result = await AptitudeQuestion.deleteMany({ questionId: { $regex: /^apt-/ } });
  if (result.deletedCount > 0) {
    console.log(`🧹 Purged ${result.deletedCount} legacy aptitude seed rows (old question bank)`);
  }
  return result.deletedCount;
}

export async function seedCodingQuestionsFromJson() {
  const result = await syncCodingQuestionsFromJson();
  return result.inserted;
}

/**
 * Seed the curated local technical MCQ bank (backend/data/technicalBank.mjs)
 * into MongoDB. This is the single source of truth for Company Mock Interview
 * technical questions. Each question is eligible for every company listed in
 * its `companyIds` (broad CS fundamentals are associated with all companies).
 *
 * Legacy per-company free-text seed questions (TECH-<COMPANY>-NNN) are purged
 * first so they are never shown in the MCQ technical section.
 */
export async function seedTechnicalQuestions() {
  if (!Array.isArray(TECHNICAL_QUESTIONS) || TECHNICAL_QUESTIONS.length === 0) return 0;

  // Purge legacy non-MCQ technical seed questions (generated per company from
  // the old technical_seed.json which had no options/correctAnswer).
  const legacyResult = await TechnicalQuestion.deleteMany({
    questionId: { $regex: /^TECH-[A-Z]+-\d{3}$/ },
  });
  if (legacyResult.deletedCount > 0) {
    console.log(`🧹 Purged ${legacyResult.deletedCount} legacy free-text technical questions`);
  }

  const companies = await Company.find({ status: "active", isDeleted: false }).lean();
  const activeCompanyIds = (companies || []).map((c) => String(c.id).toLowerCase());

  let inserted = 0;
  let updated = 0;

  for (const q of TECHNICAL_QUESTIONS) {
    const questionId = String(q.questionId);
    if (!questionId) continue;

    // companyIds: use the bank's mapping if present, else all active companies.
    let companyIds = Array.isArray(q.companyIds) && q.companyIds.length
      ? q.companyIds.map((c) => String(c).toLowerCase())
      : (activeCompanyIds.length ? activeCompanyIds : ALL_COMPANIES.map((c) => String(c).toLowerCase()));

    const options = Array.isArray(q.options) ? q.options.map(String) : [];
    const correctAnswer = String(q.correctAnswer ?? "").trim();

    const doc = {
      questionId,
      companyId: "all",
      companyIds,
      companyName: "All Companies",
      topic: q.topic || "Other",
      subtopic: q.subtopic || "",
      difficulty: q.difficulty || "Medium",
      questionType: q.questionType || "Conceptual",
      question: q.question,
      options,
      correctAnswer,
      expectedAnswer: correctAnswer,
      explanation: q.explanation || "",
      marks: q.marks || 1,
      isActive: true,
      isDeleted: false,
    };

    const existing = await TechnicalQuestion.findOne({ questionId });
    if (!existing) {
      await TechnicalQuestion.create(doc);
      inserted++;
    } else if (!existing.isDeleted) {
      let changed = false;
      for (const key of ["question", "options", "correctAnswer", "topic", "difficulty", "companyIds", "explanation", "subtopic"]) {
        if (JSON.stringify(existing[key]) !== JSON.stringify(doc[key])) {
          changed = true;
          break;
        }
      }
      if (changed) {
        existing.set(doc);
        await existing.save();
        updated++;
      }
    }
  }

  // Also load questions from backend/data/technical/*.json
  const technicalDir = path.resolve(__dirname, "../data/technical");
  if (fs.existsSync(technicalDir)) {
    const jsonFiles = fs.readdirSync(technicalDir).filter(f => f.endsWith(".json"));
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(technicalDir, file);
        const fileData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        if (Array.isArray(fileData)) {
          for (const q of fileData) {
            const questionId = String(q.questionId);
            if (!questionId) continue;

            const doc = {
              questionId,
              companyId: "all",
              companyIds: activeCompanyIds.length ? activeCompanyIds : ALL_COMPANIES.map(c => String(c).toLowerCase()),
              companyName: "All Companies",
              topic: q.topic || "Programming & OOP",
              subtopic: q.subtopic || "",
              difficulty: q.difficulty || "Medium",
              questionType: q.questionType || "Conceptual",
              question: q.question,
              options: Array.isArray(q.options) ? q.options.map(String) : [],
              correctAnswer: String(q.correctAnswer || "").trim(),
              expectedAnswer: String(q.expectedAnswer || q.explanation || "").trim(),
              explanation: q.explanation || "",
              marks: q.marks || 1,
              isActive: true,
              isDeleted: false,
            };

            const existing = await TechnicalQuestion.findOne({ questionId });
            if (!existing) {
              await TechnicalQuestion.create(doc);
              inserted++;
            } else if (!existing.isDeleted) {
              let changed = false;
              for (const key of ["question", "topic", "subtopic", "difficulty", "questionType", "expectedAnswer", "explanation"]) {
                if (existing[key] !== doc[key]) {
                  changed = true;
                  break;
                }
              }
              if (changed) {
                existing.set(doc);
                await existing.save();
                updated++;
              }
            }
          }
        }
      } catch (err) {
        console.warn(`Error reading technical file ${file}:`, err.message);
      }
    }
  }

  if (inserted + updated > 0) {
    console.log(`🧩 Technical bank seeded: ${inserted} inserted, ${updated} updated (sources: technicalBank.mjs + backend/data/technical/*.json)`);
  }
  return inserted;
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
  await purgeLegacyAptitudeRows();
  await seedAptitudeQuestionsFromBank();
  await seedCodingQuestionsFromJson();
  await seedTechnicalQuestions();
}
