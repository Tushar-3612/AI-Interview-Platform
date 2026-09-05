import mongoose from "mongoose";
import CompanyMockAttempt from "../models/CompanyMockAttempt.js";
import Company from "../models/Company.js";
import AptitudeQuestion from "../models/AptitudeQuestion.js";
import TechnicalQuestion from "../models/TechnicalQuestion.js";
import CodingQuestion from "../models/CodingQuestion.js";
import QuestionExposure from "../models/QuestionExposure.js";
import { shuffleArray, selectRandomQuestions } from "../services/questionBank.js";
import { TECHNICAL_QUESTIONS } from "../data/technicalBank.mjs";
import { loadCodingBank, normalizeCodingQuestion } from "../services/codingQuestionBank.js";
import {
  loadCompanyMockTechnical,
  loadCompanyMockCoding,
} from "../services/companyMockBank.js";
import {
  evaluateSingleAnswer,
  getRecentPerformance,
  pickAdaptiveTechnicalWithCycleReset,
} from "../services/companyMock/index.js";

const shuffle = (arr = []) => shuffleArray(arr);

// Deterministic no-repeat picker across DB docs and local bank objects.
function pickFromPool(pool, usedIds, count) {
  const result = [];
  for (const q of shuffle(pool)) {
    if (result.length >= count) break;
    const id = String(q._id || q.questionId || q.id);
    if (!id || usedIds.has(id)) continue;
    usedIds.add(id);
    result.push(q);
  }
  return result;
}

// Client-safe shapes the Company Mock page renders (text/options/title/description).
const toClientAptitude = (q) => ({
  _id: q._id,
  questionId: q.questionId || String(q._id),
  question: q.question,
  text: q.question,
  options: Array.isArray(q.options) ? q.options : [],
  category: q.category || "General",
  difficulty: q.difficulty,
  marks: q.marks,
});

const toClientTechnical = (q) => {
  // Normalize questionType: "Descriptive" → "Technical", MCQ stays as-is
  let qType = q.questionType || "Technical";
  if (qType === "Descriptive") qType = "Technical";
  if (qType === "Conceptual") qType = Array.isArray(q.options) && q.options.length > 0 ? "MCQ" : "Technical";
  const isAi = q.isAiEvaluated ?? !(Array.isArray(q.options) && q.options.length > 0);
  if (isAi && qType === "MCQ") qType = "Technical";

  return {
    _id: q._id,
    questionId: q.questionId || String(q._id),
    question: q.question,
    text: q.question,
    options: Array.isArray(q.options) ? q.options : [],
    topic: q.topic || q.subtopic || "Technical Fundamentals",
    questionType: qType,
    difficulty: q.difficulty,
    marks: q.marks,
    expectedAnswer: q.expectedAnswer || "",
    source: q.source || "company_mock",
    questionStatus: q.questionStatus || null,
    isAiEvaluated: isAi,
  };
};

// Resolve a list of stored question ids (ObjectId hex OR legacy `questionId`
// strings) back into their live DB documents, preserving the stored order.
// Stored ids that no longer exist in the DB (e.g. purged by a re-seed) are
// topped-up with real, live DB questions so a section ALWAYS returns its full
// configured count — never 0/0 on resume and never fabricated content.
async function resolveSectionQuestions({ ids, total, queryByObjectIds, queryByQuestionIds, substitutePool }) {
  const idKeys = [...new Set((ids || []).map((raw) => String(raw).trim()).filter(Boolean))];
  const need = Math.max(Number(total) || 0, idKeys.length);
  const keyed = new Map();

  // 1) Match by MongoDB _id.
  const objectKeys = idKeys.filter((k) => mongoose.Types.ObjectId.isValid(k));
  if (objectKeys.length) {
    for (const doc of await queryByObjectIds(objectKeys)) {
      keyed.set(String(doc._id), doc);
      if (doc.questionId) keyed.set(String(doc.questionId), doc);
    }
  }
  // 2) Match legacy ids by the `questionId` field (old attempts store this
  //    exactly as it exists on the re-seeded docs).
  const legacyKeys = idKeys.filter((k) => !keyed.has(k));
  if (legacyKeys.length) {
    for (const doc of await queryByQuestionIds(legacyKeys)) {
      keyed.set(String(doc._id), doc);
      if (doc.questionId) keyed.set(String(doc.questionId), doc);
    }
  }

  // 3) Top-up slots whose id is gone (or missing entirely) with real live
  //    questions from the substitute pool, never reusing a doc already picked.
  const used = new Set(idKeys.filter((k) => keyed.has(k)).map((k) => String(keyed.get(k)._id)));
  const fillers = [];
  for (const q of substitutePool || []) {
    if (fillers.length >= need) break;
    const k = String(q._id || q.questionId || q.id);
    if (!k || used.has(k)) continue;
    used.add(k);
    fillers.push(q);
  }

  let fillerIdx = 0;
  const ordered = idKeys.map((k) => keyed.get(k) || fillers[fillerIdx++]).filter(Boolean);
  while (ordered.length < need && fillerIdx < fillers.length) {
    ordered.push(fillers[fillerIdx++]);
  }

  return {
    docs: ordered,
    normalizedIds: ordered.map((d) => String(d._id || d.questionId || d.id)),
  };
}

// Re-fetch the exact questions previously selected for an attempt so a resume
// shows the identical set of questions (option values/order preserved). Also
// returns the resolved id lists so the attempt can be normalized to ids that
// grade correctly on submit.
async function fetchQuestionsByIds(attempt) {
  const config = attempt.config || {};
  const idsOf = (arr) => (arr || []).map((id) => String(id)).filter(Boolean);
  const aptitudeIds = idsOf(attempt.selectedQuestions?.aptitude);
  const technicalIds = idsOf(attempt.selectedQuestions?.technical);
  const codingIds = idsOf(attempt.selectedQuestions?.coding);

  const [aptitudeMap, technicalMap, codingMap] = await Promise.all([
    resolveSectionQuestions({
      ids: aptitudeIds,
      total: config.aptitudeCount,
      queryByObjectIds: (keys) => AptitudeQuestion.find({ _id: { $in: keys } }).lean(),
      queryByQuestionIds: (keys) => AptitudeQuestion.find({ questionId: { $in: keys }, isDeleted: { $ne: true } }).lean(),
      substitutePool: await AptitudeQuestion.find({ isActive: { $ne: false }, isDeleted: { $ne: true } }).lean(),
    }),
    resolveSectionQuestions({
      ids: technicalIds,
      total: config.technicalCount,
      queryByObjectIds: (keys) => TechnicalQuestion.find({ _id: { $in: keys } }).lean(),
      queryByQuestionIds: (keys) => TechnicalQuestion.find({ questionId: { $in: keys }, isDeleted: { $ne: true } }).lean(),
      substitutePool: await TechnicalQuestion.find({ isDeleted: { $ne: true }, isActive: { $ne: false }, options: { $ne: [] } }).lean(),
    }),
    resolveSectionQuestions({
      ids: codingIds,
      total: config.codingCount,
      queryByObjectIds: (keys) => CodingQuestion.find({ _id: { $in: keys } }).lean(),
      queryByQuestionIds: (keys) => CodingQuestion.find({ questionId: { $in: keys }, isDeleted: { $ne: true } }).lean(),
      substitutePool: await CodingQuestion.find({ isDeleted: { $ne: true }, isActive: { $ne: false } }).lean(),
    }),
  ]);

  return {
    aptitude: aptitudeMap.docs.map(toClientAptitude),
    technical: technicalMap.docs.map(toClientTechnical),
    coding: codingMap.docs.map(toClientCoding),
    aptitudeIds: aptitudeMap.normalizedIds,
    technicalIds: technicalMap.normalizedIds,
    codingIds: codingMap.normalizedIds,
  };
}

const toClientCoding = (q) => ({
  _id: q._id,
  questionId: q.questionId || String(q._id),
  title: q.title || q.problemStatement || q.question || "",
  text: q.problemStatement || q.question || q.title || "",
  description: q.description || "",
  problemStatement: q.problemStatement || q.question || q.title || "",
  starterCode: q.starterCode || "",
  languages:
    Array.isArray(q.languages) && q.languages.length
      ? q.languages
      : ["JavaScript", "Python", "Java", "C++"],
  difficulty: q.difficulty,
  category: q.category || "",
  constraints: q.constraints || "",
  inputFormat: q.inputFormat || "",
  outputFormat: q.outputFormat || "",
  sampleInput: q.sampleInput || "",
  sampleOutput: q.sampleOutput || "",
  explanation: q.explanation || "",
  examples: Array.isArray(q.examples) ? q.examples : [],
  testCases: Array.isArray(q.testCases) ? q.testCases : [],
  tags: Array.isArray(q.tags) ? q.tags : [],
  timeLimit: q.timeLimit || 1000,
  memoryLimit: q.memoryLimit || 256,
});

export const startMockInterview = async (req, res) => {
  try {
    const { companyId } = req.body || {};
    const userId = req.user.id;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required" });
    }

    // Company lookup supports the app's custom string id (e.g. "tcs") as well as
    // a Mongo ObjectId — identical to the placement/aptitude flows.
    const rawId = String(companyId).trim();
    let company = mongoose.Types.ObjectId.isValid(rawId)
      ? await Company.findById(rawId).lean()
      : null;
    if (!company) {
      company = await Company.findOne({ id: rawId.toLowerCase(), isDeleted: { $ne: true } }).lean();
    }
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Enforce the "maximum 2 unfinished Company Mock attempts" rule.
    // Completed/submitted mocks do not count toward this limit.
    const unfinishedCount = await CompanyMockAttempt.countDocuments({
      userId,
      status: { $in: ["in_progress", "paused"] },
    });
    if (unfinishedCount >= 2) {
      return res.status(400).json({
        message: "You have 2 unfinished mock interviews. Complete one before starting another.",
        limitReached: true,
      });
    }

    // Fixed assessment config: 15 Aptitude + 15 Technical + 3 Coding.
    const config = {
      aptitudeCount: 15,
      technicalCount: 15,
      codingCount: 3,
      durationMinutes: 60,
    };

    /* ── Exposure-aware question selection with automatic cycle reset ──
       For each question type (aptitude, technical, coding):
       1. Load the full company-specific pool.
       2. Load previously exposed question IDs for this (student, company, type).
       3. Try to pick unused questions from the pool.
       4. If the pool is exhausted (unused < required), reset the student's
          exposure for that type and re-pick from the full pool.
       5. No question repeats inside the same mock.
       6. Different companies have independent exposure pools. ── */

    // Load all previously exposed question IDs for this (student, company).
    const exposures = await QuestionExposure.find({ studentId: userId, companyId: company.id });
    const seenIdsFor = (type) =>
      new Set(exposures.filter((e) => e.questionType === type).map((e) => String(e.questionId)));

    // Helper: pick questions with automatic cycle reset when pool is exhausted.
    // Returns { questions, resetType } where resetType is the type that was reset (if any).
    async function pickWithCycleReset(pool, seenIds, count, type, companyId) {
      const used = new Set(seenIds);
      let picked = pickFromPool(pool, used, count);

      // If pool is exhausted and we don't have enough unused questions,
      // reset this student's exposure for this type and re-pick.
      if (picked.length < count && pool.length >= count) {
        // Delete all exposure records for this student+company+type
        await QuestionExposure.deleteMany({ studentId: userId, companyId, questionType: type });
        // Re-pick from the full pool with a clean slate
        const freshUsed = new Set();
        picked = pickFromPool(pool, freshUsed, count);
        return { questions: picked, resetType: type };
      }

      return { questions: picked, resetType: null };
    }

    /* ── 1) APTITUDE — existing local DB bank, topped up from the in-memory bank ── */
    const aptitudePool = (
      await AptitudeQuestion.find({ isActive: true, isDeleted: false }).lean()
    ).map((q) => ({ ...q, _id: String(q._id || q.questionId) }));
    let { questions: aptitudeQuestions, resetType: aptitudeReset } = await pickWithCycleReset(
      aptitudePool, seenIdsFor("aptitude"), config.aptitudeCount, "aptitude", company.id
    );
    // Top up from the in-memory bank if needed
    if (aptitudeQuestions.length < config.aptitudeCount) {
      const bankPool = selectRandomQuestions({ count: config.aptitudeCount }).map((q) => ({
        ...q,
        _id: q.questionId,
      }));
      aptitudeQuestions = aptitudeQuestions.concat(
        pickFromPool(bankPool, new Set(aptitudeQuestions.map((q) => String(q._id))), config.aptitudeCount - aptitudeQuestions.length)
      );
    }

    /* ── 2) TECHNICAL — Adaptive difficulty question selection from company-specific pool.
           Difficulty distribution is tailored to student's recent performance on this company.
           No questions are repeated while unused ones remain in the pool.
           When the entire bank is exhausted, a new cycle starts. ── */
    const perf = await getRecentPerformance(userId, company.id);
    const accuracyLabel = perf.accuracy !== null ? `${Math.round(perf.accuracy * 100)}%` : "none";
    console.log(`[Adaptive] student=${userId} company=${company.id} accuracy=${accuracyLabel} target=${perf.tier}`);

    const allCompanyTechnical = loadCompanyMockTechnical(company.id).map((q) => ({ ...q, _id: q.questionId }));
    const { questions: technicalQuestions, resetType: technicalReset } = await pickAdaptiveTechnicalWithCycleReset(
      allCompanyTechnical,
      seenIdsFor("technical"),
      config.technicalCount,
      company.id,
      userId,
      perf.distribution,
      perf.tier
    );
    // Safety: if after reset we still can't fill (shouldn't happen if bank >= count)
    if (technicalQuestions.length < config.technicalCount) {
      return res.status(400).json({
        message: `Not enough technical questions for ${company.name}. Available: ${allCompanyTechnical.length}, Required: ${config.technicalCount}.`,
        insufficientQuestions: true,
        available: allCompanyTechnical.length,
        required: config.technicalCount,
      });
    }

    /* ── 3) CODING — Company-specific companyMock pool, then DB coding questions, then local bank.
           Only the selected company's pool is used — coding questions are NEVER mixed between companies. ── */
    const codingPool = loadCompanyMockCoding(company.id).map((q) => ({ ...q, _id: q.questionId }));
    let { questions: codingQuestions, resetType: codingReset } = await pickWithCycleReset(
      codingPool, seenIdsFor("coding"), config.codingCount, "coding", company.id
    );
    // Top up from DB and bank if needed
    if (codingQuestions.length < config.codingCount) {
      const usedIds = new Set(codingQuestions.map((q) => String(q._id)));
      codingQuestions = codingQuestions.concat(
        pickFromPool(
          await CodingQuestion.find({ isDeleted: { $ne: true }, isActive: true, companyId: company.id }).lean(),
          usedIds,
          config.codingCount - codingQuestions.length
        )
      );
    }
    if (codingQuestions.length < config.codingCount) {
      const usedIds = new Set(codingQuestions.map((q) => String(q._id)));
      codingQuestions = codingQuestions.concat(
        pickFromPool(
          await CodingQuestion.find({ isDeleted: { $ne: true }, isActive: true }).lean(),
          usedIds,
          config.codingCount - codingQuestions.length
        )
      );
    }
    if (codingQuestions.length < config.codingCount) {
      const bankQuestions = [];
      for (const entry of loadCodingBank()) {
        for (const raw of entry.questions || []) {
          const norm = normalizeCodingQuestion(raw, { fallbackCompanyId: entry.company });
          if (norm && norm.title && norm.problemStatement && norm.questionId) {
            bankQuestions.push({ ...norm, _id: norm.questionId });
          }
        }
      }
      const usedIds = new Set(codingQuestions.map((q) => String(q._id)));
      codingQuestions = codingQuestions.concat(
        pickFromPool(bankQuestions, usedIds, config.codingCount - codingQuestions.length)
      );
    }

    const aptitudeIds = aptitudeQuestions.map((q) => String(q._id));
    const technicalIds = technicalQuestions.map((q) => String(q._id));
    const codingIds = codingQuestions.map((q) => String(q._id));

    // Record exposures so future attempts avoid repeats
    const newExposures = [
      ...aptitudeIds.map((questionId) => ({ studentId: userId, companyId: company.id, questionId, questionType: "aptitude" })),
      ...technicalIds.map((questionId) => ({ studentId: userId, companyId: company.id, questionId, questionType: "technical" })),
      ...codingIds.map((questionId) => ({ studentId: userId, companyId: company.id, questionId, questionType: "coding" })),
    ];
    if (newExposures.length > 0) {
      await QuestionExposure.insertMany(newExposures, { ordered: false }).catch(() => {});
    }

    // Create the attempt
    const newAttempt = new CompanyMockAttempt({
      userId,
      companyId: company.id,
      companyName: company.name,
      status: "in_progress",
      config,
      startedAt: Date.now(),
      expiresAt: new Date(Date.now() + config.durationMinutes * 60000),
      selectedQuestions: {
        aptitude: aptitudeIds,
        technical: technicalIds,
        coding: codingIds,
      },
    });

    await newAttempt.save();

    res.status(201).json({
      attemptId: newAttempt._id,
      companyId: company.id,
      companyName: company.name,
      status: newAttempt.status,
      expiresAt: newAttempt.expiresAt,
      aptitude: aptitudeQuestions.map(toClientAptitude),
      technical: technicalQuestions.map(toClientTechnical),
      coding: codingQuestions.map(toClientCoding),
    });
  } catch (error) {
    console.error("Start mock interview error:", error);
    res.status(500).json({ message: "Error starting mock interview", error: error.message });
  }
};

// Exit/pass threshold for the Company Mock, matching the existing project
// pass criterion (percentage >= 40).
const MOCK_PASS_PERCENTAGE = 40;

/**
 * SINGLE AUTHORITATIVE FINAL-SCORING FUNCTION for the Company Mock Interview.
 *
 * Both manual "End Mock Interview" and automatic timer expiry MUST go through
 * this exact function so they can never produce different results.
 *
 * @param {import("mongoose").Document} attempt - CompanyMockAttempt doc with its
 *   answers (aptitude/technical/coding) already populated. It is graded in place
 *   and persisted as "completed" with the finalized scores.
 * @param {object} opts
 * @param {string} [opts.status="completed"] - final status to write (used for
 *   auto-submitted / expired finalizations).
 * @returns {Promise<object>} the updated attempt document.
 *
 * Scoring rules (question counts are fixed: 15 aptitude + 15 technical + 3 coding = 33):
 *  - Aptitude  : correct MCQ = 1, wrong = 0, unanswered = 0  (max 15)
 *  - Technical : correct MCQ = 1, wrong = 0, unanswered = 0  (max 15)
 *  - Coding    : each problem is worth exactly 1 point, awarded ONLY when the
 *                submitted solution is ACCEPTED (ALL judge/test cases pass).
 *                Partial passing (e.g. 7/10) = 0. (max 3)
 *  - totalScore = aptitudeScore + technicalScore + codingScore
 *  - maxScore   = 33
 *  - percentage = Math.round((totalScore / maxScore) * 100 * 100) / 100  (2 dp)
 *  - result     = percentage >= 40 → passed
 */
async function gradeAndFinalizeMock(attempt, { status = "completed" } = {}) {
  const idsOf = (arr) => (arr || []).map((id) => String(id)).filter(Boolean);
  const aptitudeIds = idsOf(attempt.selectedQuestions?.aptitude);
  const technicalIds = idsOf(attempt.selectedQuestions?.technical);
  const codingIds = idsOf(attempt.selectedQuestions?.coding);

  // Resolve grading docs by `_id` (live DB ids) OR legacy `questionId` strings,
  // so every stored question grades — including attempts created before a
  // re-seed. Maps are keyed by BOTH forms for lookup.
  const resolveGradingDocs = async (Model, ids) => {
    const byId = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    const docs = await Model.find({
      $or: [{ _id: { $in: byId } }, { questionId: { $in: ids } }],
    }).lean();
    const map = new Map();
    for (const q of docs) {
      map.set(String(q._id), q);
      if (q.questionId) map.set(String(q.questionId), q);
    }
    return map;
  };

  const [aptitudeById, technicalDbById] = await Promise.all([
    resolveGradingDocs(AptitudeQuestion, aptitudeIds),
    resolveGradingDocs(TechnicalQuestion, technicalIds),
  ]);

  // Also load company-specific JSON questions (MCQ + free-text) into the grading map.
  // JSON questions have string IDs (questionId), not MongoDB ObjectIds.
  const technicalById = new Map(technicalDbById);
  if (attempt.companyId) {
    const companyJsonQuestions = loadCompanyMockTechnical(attempt.companyId);
    for (const q of companyJsonQuestions) {
      const qid = String(q.questionId);
      if (technicalIds.includes(qid)) {
        technicalById.set(qid, q);
      }
    }
  }

  // ── Aptitude grading: correct MCQ = 1, wrong / unanswered = 0 ──
  let aptitudeCorrect = 0;
  (attempt.aptitudeAnswers || []).forEach((a) => {
    const q = aptitudeById.get(String(a.questionId));
    a.isCorrect = !!(q && a.selectedOption && a.selectedOption === q.correctAnswer);
    if (a.isCorrect) aptitudeCorrect++;
  });

  // ── Technical grading: MCQ = correct/wrong; free-text = AI evaluation. ──
  let technicalCorrect = 0;
  let technicalMcqMarks = 0;
  let technicalAiMarks = 0;
  let technicalAiMaxMarks = 0;
  let technicalTotalMarks = 0;
  const freeTextAnswers = [];

  for (const a of attempt.technicalAnswers || []) {
    const q = technicalById.get(String(a.questionId));
    const hasOptions = Array.isArray(q?.options) && q.options.length > 0;
    const qMarks = q?.marks || 3;

    if (hasOptions) {
      // MCQ: traditional correct/wrong grading — each MCQ worth its question's marks
      a.isCorrect = !!(q && a.selectedOption && a.selectedOption === q.correctAnswer);
      if (a.isCorrect) {
        technicalCorrect++;
        technicalMcqMarks += qMarks;
      }
      a.evaluationStatus = "not_evaluated";
    } else {
      // Free-text: queue for AI evaluation
      freeTextAnswers.push({ answer: a, question: q });
    }
  }

  // Evaluate free-text answers with AI (sequentially to avoid rate limits)
  for (const { answer: a, question: q } of freeTextAnswers) {
    if (!a.answer || !String(a.answer).trim()) {
      // No answer submitted
      a.aiScore = 0;
      a.aiMaxMarks = q?.marks || 3;
      a.aiEvaluation = "No answer provided.";
      a.aiStrengths = [];
      a.aiWeaknesses = ["No answer was submitted."];
      a.aiBetterAnswer = q?.expectedAnswer || "";
      a.expectedAnswer = q?.expectedAnswer || "";
      a.evaluationStatus = "fallback";
      a.isCorrect = false;
    } else {
      try {
        const evalResult = await evaluateSingleAnswer({
          companyId: attempt.companyId,
          question: q?.question || "",
          topic: q?.topic || "",
          difficulty: q?.difficulty || "Medium",
          candidateAnswer: String(a.answer),
          expectedAnswer: q?.expectedAnswer || "",
          explanation: q?.explanation || "",
          betterAnswer: q?.betterAnswer || "",
          marks: q?.marks || 3,
        });
        a.aiScore = evalResult.score;
        a.aiMaxMarks = evalResult.maxMarks;
        a.aiEvaluation = evalResult.evaluation;
        a.aiStrengths = evalResult.strengths;
        a.aiWeaknesses = evalResult.weaknesses;
        a.aiBetterAnswer = evalResult.betterAnswer;
        a.expectedAnswer = q?.expectedAnswer || "";
        a.evaluationStatus = evalResult.status;
        a.isCorrect = evalResult.status === "ai_evaluated" && evalResult.score > 0;
      } catch (err) {
        console.error(`[COMPANY MOCK] AI eval failed for ${a.questionId}:`, err.message);
        a.aiScore = null;
        a.aiMaxMarks = q?.marks || 3;
        a.aiEvaluation = "AI evaluation temporarily unavailable.";
        a.aiStrengths = [];
        a.aiWeaknesses = [];
        a.aiBetterAnswer = q?.expectedAnswer || "";
        a.expectedAnswer = q?.expectedAnswer || "";
        a.evaluationStatus = "fallback";
        a.isCorrect = false;
      }
    }
    if (typeof a.aiScore === "number" && a.aiScore !== null) {
      technicalAiMarks += a.aiScore;
    }
    technicalAiMaxMarks += a.aiMaxMarks || q?.marks || 3;
  }

  // Calculate total marks for ALL selected technical questions (not just answered ones)
  for (const qid of technicalIds) {
    const q = technicalById.get(qid);
    technicalTotalMarks += q?.marks || 3;
  }

  // ── Coding grading: exactly 1 point per problem, awarded ONLY when ALL judge
  //    test cases pass (accepted). Partial (7/10), Wrong Answer, Compiler Error,
  //    Runtime Error, Time Limit Exceeded, and no-submission all earn 0. ──
  let codingAccepted = 0;
  (attempt.codingAnswers || []).forEach((c) => {
    if (!c.code || !c.code.trim()) return; // no submission = 0
    const total = Number(c.totalCount) || 0;
    const passed = Number(c.passedCount) || 0;
    const status = String(c.status || "").toLowerCase();
    // A problem is accepted only when the full suite passed.
    const allPassed = total > 0 && passed >= total;
    const legacyAccepted = total === 0 && ["accepted", "completed"].includes(status);
    if (allPassed || legacyAccepted) codingAccepted++;
  });
  const codingMarks = codingAccepted; // integer — never fractional/partial credit

  const aptitudeTotal = (attempt.selectedQuestions?.aptitude || []).length || aptitudeIds.length || 15;
  const technicalTotal = technicalTotalMarks || (attempt.selectedQuestions?.technical || []).length || technicalIds.length || 15;
  const codingTotal = (attempt.selectedQuestions?.coding || []).length || codingIds.length || 3;

  const aptitudeAttempted = (attempt.aptitudeAnswers || []).length;
  const technicalAttempted = (attempt.technicalAnswers || []).length;
  const codingAttempted = (attempt.codingAnswers || []).filter((c) => c.code && c.code.trim()).length;

  const aptitudeMarks = aptitudeCorrect;
  // Technical marks: MCQ marks (per-question value) + AI-evaluated free-text marks
  const technicalMarks = technicalMcqMarks + technicalAiMarks;

  const totalScore = aptitudeMarks + technicalMarks + codingMarks;
  const maxScore = aptitudeTotal + technicalTotal + codingTotal;
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100 * 100) / 100 : 0;
  const passed = percentage >= MOCK_PASS_PERCENTAGE;

  attempt.scores = {
    aptitude: {
      total: aptitudeTotal,
      attempted: aptitudeAttempted,
      correct: aptitudeCorrect,
      wrong: Math.max(0, aptitudeAttempted - aptitudeCorrect),
      unanswered: Math.max(0, aptitudeTotal - aptitudeAttempted),
      skipped: Math.max(0, aptitudeTotal - aptitudeAttempted),
      percentage: aptitudeTotal ? Math.round((aptitudeCorrect / aptitudeTotal) * 100) : 0,
      marksObtained: aptitudeMarks,
      totalMarks: aptitudeTotal,
    },
    technical: {
      total: technicalTotal,
      attempted: technicalAttempted,
      correct: technicalCorrect,
      wrong: Math.max(0, technicalAttempted - technicalCorrect),
      unanswered: Math.max(0, (attempt.selectedQuestions?.technical || []).length - technicalAttempted),
      skipped: Math.max(0, (attempt.selectedQuestions?.technical || []).length - technicalAttempted),
      percentage: technicalTotal ? Math.round((technicalMarks / technicalTotal) * 100) : 0,
      marksObtained: technicalMarks,
      totalMarks: technicalTotal,
      mcqMarks: technicalMcqMarks,
      aiEvaluatedMarks: technicalAiMarks,
      aiMaxMarks: technicalAiMaxMarks,
      // Also store correct count for backward compatibility
      correctCount: technicalCorrect,
    },
    coding: {
      attempted: codingAttempted,
      accepted: codingAccepted,
      total: codingTotal,
      marksObtained: codingMarks,
      totalMarks: codingTotal,
    },
    overall: totalScore,
    totalMarks: maxScore,
    percentage,
    passed,
  };

  attempt.status = status;
  attempt.submittedAt = attempt.submittedAt || Date.now();
  attempt.pausedAt = null;

  // Atomic final save — only transition from "completing" to final status.
  // This prevents any concurrent progress save from overwriting the result.
  await CompanyMockAttempt.findOneAndUpdate(
    { _id: attempt._id, status: "completing" },
    {
      $set: {
        status,
        submittedAt: attempt.submittedAt,
        pausedAt: null,
        scores: attempt.scores,
        aptitudeAnswers: attempt.aptitudeAnswers,
        technicalAnswers: attempt.technicalAnswers,
        codingAnswers: attempt.codingAnswers,
      },
    }
  );

  return attempt;
}

export const submitMockInterview = async (req, res) => {
  try {
    const { attemptId, aptitudeAnswers, technicalAnswers, codingAnswers } = req.body;
    const userId = req.user.id;

    // ── Atomic claim: only one submission can win ──
    // Use findOneAndUpdate to atomically transition status from non-completed
    // to "completing". This prevents double-submission races.
    const claimed = await CompanyMockAttempt.findOneAndUpdate(
      {
        _id: attemptId,
        userId,
        status: { $nin: ["completed", "auto_submitted", "expired"] },
      },
      { $set: { status: "completing" } },
      { new: true }
    );

    if (!claimed) {
      // Check if already completed (idempotent response)
      const existing = await CompanyMockAttempt.findOne({ _id: attemptId, userId })
        .select("status scores companyId companyName submittedAt selectedQuestions")
        .lean();
      if (!existing) return res.status(404).json({ message: "Attempt not found" });
      if (["completed", "auto_submitted", "expired"].includes(existing.status)) {
        return res.status(200).json({ message: "Already submitted", completed: true, result: existing });
      }
      return res.status(400).json({ message: "Cannot submit at this time" });
    }

    // We own the attempt now — proceed with grading using the claimed document.
    // Reload full document for grading (atomic update returned minimal fields).
    const attempt = await CompanyMockAttempt.findById(claimed._id);
    if (!attempt) {
      // Should never happen — we just claimed it
      return res.status(500).json({ message: "Internal error" });
    }

    // Normalize incoming answers into the schema shape (preserve everything).
    attempt.aptitudeAnswers = (aptitudeAnswers || []).map((a) => ({
      questionId: a.questionId,
      selectedOption: a.selectedOption,
    }));
    attempt.technicalAnswers = (technicalAnswers || []).map((a) => ({
      questionId: a.questionId,
      selectedOption: a.selectedOption || null,
      answer: a.answer || a.selectedOption || "",
    }));

    // Merge coding answers from the incoming submit payload with the results
    // already persisted during active saves (status/passedCount/totalCount come
    // from the ACTUAL Judge0/result-processor execution run).
    const mergedCoding = new Map(
      (attempt.codingAnswers || []).map((c) => [
        String(c.questionId),
        { ...c },
      ])
    );
    (codingAnswers || []).forEach((a) => {
      if (!a || a.questionId == null) return;
      const existing = mergedCoding.get(String(a.questionId)) || {};
      mergedCoding.set(String(a.questionId), {
        questionId: a.questionId,
        language: a.language || existing.language,
        code: a.code ?? existing.code ?? "",
        status: a.status || existing.status,
        passedCount: a.passedCount ?? existing.passedCount,
        totalCount: a.totalCount ?? existing.totalCount,
        score: a.score ?? existing.score ?? 0,
        results: existing.results || a.results,
        submittedAt: a.submittedAt || existing.submittedAt,
      });
    });
    attempt.codingAnswers = Array.from(mergedCoding.values());

    // Grade the attempt with the SINGLE authoritative scoring function.
    await gradeAndFinalizeMock(attempt, { status: "completed" });

    res.status(200).json({
      message: "Mock interview submitted successfully",
      completed: true,
      result: {
        attemptId: attempt._id,
        companyId: attempt.companyId,
        companyName: attempt.companyName,
        status: attempt.status,
        submittedAt: attempt.submittedAt,
        selectedQuestions: attempt.selectedQuestions,
        scores: attempt.scores,
      },
    });
  } catch (error) {
    console.error("Submit mock interview error:", error);
    res.status(500).json({ message: "Error submitting mock interview", error: error.message });
  }
};

// Save current progress WITHOUT completing the attempt. Used on answer/nav/
// section changes, fullscreen exit, and tab close to persist session state.
export const saveMockInterviewProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      attemptId,
      companyId,
      currentSection,
      currentQuestionIndex,
      aptitudeAnswers = {},
      technicalAnswers = {},
      codingAnswers = {},
      codingSubmissions = [],
      selectedCodingLanguage,
      securityEvents = [],
    } = req.body;

    // ── Build answer arrays ──
    const aptArr = [];
    for (const [qid, opt] of Object.entries(aptitudeAnswers || {})) {
      if (opt === undefined || opt === null) continue;
      aptArr.push({ questionId: qid, selectedOption: opt });
    }
    const techArr = [];
    for (const [qid, val] of Object.entries(technicalAnswers || {})) {
      if (val === undefined || val === null) continue;
      const answerText = typeof val === "object" && val !== null ? (val.answer || "") : String(val);
      const selectedOption = typeof val === "object" && val !== null ? (val.selectedOption || answerText) : String(val);
      techArr.push({ questionId: qid, selectedOption, answer: answerText });
    }

    // Coding answers (keyed by questionId).
    const codingArr = [];
    for (const [qid, entry] of Object.entries(codingAnswers || {})) {
      if (!entry) continue;
      codingArr.push({
        questionId: qid,
        language: entry.language || "java",
        code: entry.code || "",
      });
    }
    const codingByQid = new Map(codingArr.map((c) => [String(c.questionId), c]));
    for (const sub of codingSubmissions || []) {
      const existing = codingByQid.get(String(sub.questionId));
      if (existing) {
        existing.status = sub.status;
        existing.passedCount = sub.passedCount;
        existing.totalCount = sub.totalCount;
        existing.score = sub.score || 0;
        existing.submittedAt = sub.submittedAt || new Date();
      }
    }

    // ── Build atomic $set update ──
    const now = new Date();
    const $set = {
      lastActiveAt: now,
      status: "paused",
      aptitudeAnswers: aptArr,
      technicalAnswers: techArr,
      codingAnswers: Array.from(codingByQid.values()),
    };
    if (currentSection) $set.currentSection = currentSection;
    if (typeof currentQuestionIndex === "number") $set.currentQuestionIndex = currentQuestionIndex;
    if (selectedCodingLanguage) $set.selectedCodingLanguage = selectedCodingLanguage;
    // Server-authoritative pause timing
    $set.pausedAt = now;
    // startedAt only set once — use $setOnInsert handled separately if needed

    // ── Build $push operations for security events ──
    const securityPushOps = {};
    const counterKey = {
      TAB_SWITCH: "tabSwitchCount",
      COPY_ATTEMPT: "copyAttempts",
      CUT_ATTEMPT: "cutAttempts",
      CONTEXT_MENU: "rightClickAttempts",
      PASTE_ATTEMPT: "pasteAttempts",
    };
    const counterInc = {};
    const tabSwitchesToPush = [];

    for (const ev of securityEvents || []) {
      if (!ev || !ev.type) continue;
      const ts = ev.timestamp ? new Date(ev.timestamp) : now;
      if (!securityPushOps.$push) securityPushOps.$push = {};
      securityPushOps.$push.securityEvents = {
        $each: [{
          type: ev.type,
          timestamp: ts,
          section: ev.section || currentSection || null,
          questionId: ev.questionId || null,
          metadata: ev.metadata || {},
        }],
      };
      const key = counterKey[ev.type];
      if (key) {
        counterInc[`security.${key}`] = (counterInc[`security.${key}`] || 0) + 1;
        if (ev.type === "TAB_SWITCH") {
          tabSwitchesToPush.push({
            timestamp: ts,
            questionId: ev.questionId || null,
            remainingTime: ev.metadata?.remainingSeconds ?? null,
          });
        }
      }
    }
    if (tabSwitchesToPush.length > 0) {
      if (!securityPushOps.$push) securityPushOps.$push = {};
      securityPushOps.$push.security.tabSwitches = { $each: tabSwitchesToPush };
    }

    // ── Atomic update: only if NOT completed ──
    const updateOps = { $set };
    if (Object.keys(counterInc).length > 0) updateOps.$inc = counterInc;
    if (securityPushOps.$push) updateOps.$push = securityPushOps.$push;
    // Set startedAt only if not already set
    updateOps.$setOnInsert = { startedAt: now };

    const attempt = await CompanyMockAttempt.findOneAndUpdate(
      { _id: attemptId, userId, status: { $ne: "completed" } },
      updateOps,
      { new: true }
    );

    if (!attempt) {
      // Either not found, or already completed — check which
      const exists = await CompanyMockAttempt.findOne({ _id: attemptId, userId }).select("status").lean();
      if (!exists) return res.status(404).json({ message: "Attempt not found" });
      if (exists.status === "completed") {
        return res.status(400).json({ message: "Attempt already completed" });
      }
      return res.status(400).json({ message: "Cannot save progress" });
    }

    // Return the remaining ACTIVE time so the client can render it.
    const nowMs = Date.now();
    const remainingMs = Math.max(0, (attempt.expiresAt ? attempt.expiresAt.getTime() : 0) - nowMs);
    res.status(200).json({ saved: true, status: "paused", remainingSeconds: Math.floor(remainingMs / 1000) });
  } catch (error) {
    console.error("Save mock interview progress error:", error);
    res.status(500).json({ message: "Error saving mock interview progress", error: error.message });
  }
};

// Resume: return the latest unfinished attempt for the user with full question
// content, saved progress, and remaining time.
export const resumeMockInterview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId } = req.query || {};

    let attempt;
    if (attemptId) {
      // Resume a specific unfinished attempt (e.g. picking a company from the
      // Resume list or History).
      attempt = await CompanyMockAttempt.findOne({
        _id: attemptId,
        userId,
        status: { $in: ["in_progress", "paused"] },
      });
      if (!attempt) {
        return res.status(404).json({ message: "Unfinished mock interview not found" });
      }
    } else {
      // Back-compat: resume the most recently active unfinished attempt.
      attempt = await CompanyMockAttempt.findOne({ userId, status: { $in: ["in_progress", "paused"] } }).sort({ updatedAt: -1 });
    }

    if (!attempt) {
      return res.status(200).json({ hasAttempt: false });
    }

    // Shift expiresAt forward by the paused duration so remaining time is exact.
    const now = new Date();
    if (attempt.pausedAt) {
      const pausedMs = now.getTime() - attempt.pausedAt.getTime();
      attempt.totalPausedMs = (attempt.totalPausedMs || 0) + pausedMs;
      if (attempt.expiresAt) {
        attempt.expiresAt = new Date(attempt.expiresAt.getTime() + pausedMs);
      }
      attempt.pausedAt = null;
    }
    attempt.status = "in_progress";
    attempt.lastActiveAt = now;

    // Automatic timer-expiry finalization: if the ACTIVE assessment time has
    // fully elapsed, grade and finalize the attempt with the SAME authoritative
    // scoring function used by manual submission — producing an identical
    // result. The stored (persisted) result is returned so the UI can show it
    // instead of continuing an already-finished attempt.
    if (attempt.expiresAt && now.getTime() >= attempt.expiresAt.getTime()) {
      // Atomically claim the attempt to prevent double-finalization.
      const claimed = await CompanyMockAttempt.findOneAndUpdate(
        { _id: attempt._id, userId, status: { $nin: ["completed", "auto_submitted", "expired"] } },
        { $set: { status: "completing" } },
        { new: true }
      );
      if (!claimed) {
        // Already finalized by another request — return existing result
        const existing = await CompanyMockAttempt.findById(attempt._id)
          .select("companyId companyName status submittedAt selectedQuestions scores")
          .lean();
        return res.status(200).json({ completed: true, result: existing });
      }
      const finalized = await gradeAndFinalizeMock(attempt, { status: "auto_submitted" });
      return res.status(200).json({
        completed: true,
        result: {
          attemptId: finalized._id,
          companyId: finalized.companyId,
          companyName: finalized.companyName,
          status: finalized.status,
          submittedAt: finalized.submittedAt,
          selectedQuestions: finalized.selectedQuestions,
          scores: finalized.scores,
        },
      });
    }

    // Capture the ORIGINAL stored ids before they are normalized below, so
    // saved answers (keyed by whatever id form was used at answer time) can be
    // re-keyed onto the resolved live-DB ids.
    const idsOf = (arr) => (arr || []).map((id) => String(id)).filter(Boolean);
    const storedIds = {
      aptitude: idsOf(attempt.selectedQuestions?.aptitude),
      technical: idsOf(attempt.selectedQuestions?.technical),
      coding: idsOf(attempt.selectedQuestions?.coding),
    };

    const qMap = await fetchQuestionsByIds(attempt);

    // Normalize the stored ids to the resolved live-DB ids so grading and any
    // later resume resolve cleanly (never stale/dummy references).
    const $setUpdate = {
      status: "in_progress",
      lastActiveAt: now,
      pausedAt: null,
    };
    if (qMap.aptitudeIds?.length) $setUpdate["selectedQuestions.aptitude"] = qMap.aptitudeIds;
    if (qMap.technicalIds?.length) $setUpdate["selectedQuestions.technical"] = qMap.technicalIds;
    if (qMap.codingIds?.length) $setUpdate["selectedQuestions.coding"] = qMap.codingIds;
    if (attempt.totalPausedMs) $setUpdate.totalPausedMs = attempt.totalPausedMs;
    if (attempt.expiresAt) $setUpdate.expiresAt = attempt.expiresAt;

    await CompanyMockAttempt.findOneAndUpdate(
      { _id: attempt._id, userId, status: { $nin: ["completed", "auto_submitted", "expired"] } },
      { $set: $setUpdate }
    );

    const remainingMs = Math.max(0, (attempt.expiresAt ? attempt.expiresAt.getTime() : 0) - now.getTime());
    const roundAnswer = (arr, field = "selectedOption") =>
      (arr || []).reduce((acc, a) => {
        acc[String(a.questionId)] = a[field];
        return acc;
      }, {});

    // Re-key saved answers/submissions from the stored id forms onto the
    // resolved ids so restored questions show their previously-saved state.
    const remapKey = (key, stored, resolved) => {
      const k = String(key);
      const i = stored.indexOf(k);
      return i >= 0 && resolved && resolved[i] ? String(resolved[i]) : k;
    };
    const translateAnswers = (answers, stored, resolved) => {
      const out = {};
      for (const [k, v] of Object.entries(answers || {})) {
        const rk = remapKey(k, stored, resolved);
        out[rk] = v;
      }
      return out;
    };

    res.status(200).json({
      hasAttempt: true,
      resume: {
        attemptId: attempt._id,
        companyId: attempt.companyId,
        companyName: attempt.companyName,
        currentSection: attempt.currentSection || "aptitude",
        currentQuestionIndex: attempt.currentQuestionIndex || 0,
        config: attempt.config,
        selectedCodingLanguage: attempt.selectedCodingLanguage || "java",
        remainingSeconds: Math.floor(remainingMs / 1000),
        progress: {
          aptitude: {
            answered: (attempt.aptitudeAnswers || []).length,
            total: (attempt.selectedQuestions?.aptitude || []).length || qMap.aptitude.length,
          },
          technical: {
            answered: (attempt.technicalAnswers || []).length,
            total: (attempt.selectedQuestions?.technical || []).length || qMap.technical.length,
          },
          coding: {
            answered: attempt.codingAnswers.filter((c) => c.code && c.code.trim()).length,
            total: (attempt.selectedQuestions?.coding || []).length || qMap.coding.length,
          },
        },
        answers: {
          aptitude: translateAnswers(roundAnswer(attempt.aptitudeAnswers), storedIds.aptitude, qMap.aptitudeIds),
          technical: translateAnswers(roundAnswer(attempt.technicalAnswers), storedIds.technical, qMap.technicalIds),
          coding: translateAnswers(
            (attempt.codingAnswers || []).reduce((acc, c) => {
              acc[String(c.questionId)] = c.code || "";
              return acc;
            }, {}),
            storedIds.coding,
            qMap.codingIds
          ),
        },
        codingSubmissions: (attempt.codingAnswers || []).map((c) => ({
          questionId: remapKey(c.questionId, storedIds.coding, qMap.codingIds),
          status: c.status,
          passedCount: c.passedCount,
          totalCount: c.totalCount,
          score: c.score,
          language: c.language,
          code: c.code,
        })),
      },
      aptitude: qMap.aptitude,
      technical: qMap.technical,
      coding: qMap.coding,
    });
  } catch (error) {
    console.error("Resume mock interview error:", error);
    res.status(500).json({ message: "Error resuming mock interview", error: error.message });
  }
};

// List ALL unfinished (in_progress / paused) Company Mock attempts so the
// Resume section can render each one separately with its company + progress.
export const listUnfinishedMocks = async (req, res) => {
  try {
    const userId = req.user.id;
    const attempts = await CompanyMockAttempt.find({
      userId,
      status: { $in: ["in_progress", "paused"] },
    }).sort({ updatedAt: -1 });

    const rows = [];
    const now = Date.now();
    for (const attempt of attempts) {
      // Active time is NOT consumed while an attempt is paused. A paused
      // attempt keeps its expiresAt fixed until it is resumed, so the paused
      // duration must be added back to get the real remaining assessment time.
      const pausedMs =
        attempt.status === "paused" && attempt.pausedAt
          ? Math.max(0, now - attempt.pausedAt.getTime())
          : 0;
      const remainingMs = Math.max(
        0,
        (attempt.expiresAt ? attempt.expiresAt.getTime() : 0) - now + pausedMs
      );
      const apt = attempt.scores?.aptitude || {};
      rows.push({
        attemptId: attempt._id,
        companyId: attempt.companyId,
        companyName: attempt.companyName,
        status: attempt.status,
        currentSection: attempt.currentSection || "aptitude",
        currentQuestionIndex: attempt.currentQuestionIndex || 0,
        remainingSeconds: Math.floor(remainingMs / 1000),
        expiresAt: attempt.expiresAt,
        startedAt: attempt.startedAt,
        updatedAt: attempt.updatedAt,
        progress: {
          aptitude: {
            answered: (attempt.aptitudeAnswers || []).length,
            total: (attempt.selectedQuestions?.aptitude || []).length || 15,
          },
          technical: {
            answered: (attempt.technicalAnswers || []).length,
            total: (attempt.selectedQuestions?.technical || []).length || 15,
          },
          coding: {
            answered: attempt.codingAnswers.filter((c) => c.code && c.code.trim()).length,
            total: (attempt.selectedQuestions?.coding || []).length || 3,
          },
        },
        scores: attempt.scores,
      });
    }

    res.status(200).json({
      hasUnfinished: rows.length > 0,
      count: rows.length,
      maxUnfinished: 2,
      rows,
    });
  } catch (error) {
    console.error("List unfinished mock error:", error);
    res.status(500).json({ message: "Error listing unfinished mocks", error: error.message });
  }
};

// History: the logged-in student's COMPLETED Company Mock attempts, grouped by
// company, plus overall statistics. Only actual stored, finalized attempts
// (status "completed" | "auto_submitted") are included — unfinished, abandoned,
// paused or in-progress attempts never appear, and no synthetic/dummy records
// are ever fabricated. Each attempt appears exactly once, so a resumed-and-later
// submitted mock yields a single history record.
const COMPLETED_MOCK_STATUSES = ["completed", "auto_submitted"];

function aptTotalOf(attempt, apt, tech, cod) {
  const a = Number(apt.total) || (attempt.selectedQuestions?.aptitude || []).length || 15;
  const t = Number(tech.total) || (attempt.selectedQuestions?.technical || []).length || 15;
  const c = Number(cod.total) || Number(cod.totalMarks) || (attempt.selectedQuestions?.coding || []).length || 3;
  return a + t + c;
}

// Pure aggregation: given a list of lean, completed CompanyMockAttempt documents
// (assumed newest-first by submittedAt), returns the grouped-by-company history
// and overall statistics computed ONLY from the stored scores. Exported for
// direct unit testing.
export function computeMockHistory(attempts) {
  // Normalize ordering: newest submission first, independent of input order.
  const ordered = [...attempts].sort(
    (a, b) => new Date(b.submittedAt || b.startedAt || 0) - new Date(a.submittedAt || a.startedAt || 0)
  );

  const built = ordered.map((attempt) => {
    const s = attempt.scores || {};
    const apt = s.aptitude || {};
    const tech = s.technical || {};
    const cod = s.coding || {};

    const startedAt = attempt.startedAt ? new Date(attempt.startedAt).getTime() : null;
    const submittedAt = attempt.submittedAt ? new Date(attempt.submittedAt).getTime() : null;
    const totalPausedMs = Number(attempt.totalPausedMs) || 0;
    let durationSeconds = 0;
    if (startedAt && submittedAt) {
      durationSeconds = Math.max(0, Math.round((submittedAt - startedAt - totalPausedMs) / 1000));
    }

    const overall = Number(s.overall) || 0;
    const totalMarks = Number(s.totalMarks) || aptTotalOf(attempt, apt, tech, cod);
    const percentage =
      s.percentage !== undefined && s.percentage !== null
        ? Number(s.percentage)
        : totalMarks > 0
          ? Math.round((overall / totalMarks) * 10000) / 100
          : 0;
    const passed = !!s.passed;

    return {
      attemptId: attempt._id,
      companyId: attempt.companyId,
      companyName: attempt.companyName,
      status: attempt.status,
      attemptNumber: 0, // 0 = not yet assigned; set to newest-first ordinal per company below
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      durationSeconds,
      aptitudeScore: {
        correct: apt.correct || 0,
        total: apt.total || (attempt.selectedQuestions?.aptitude || []).length || 15,
      },
      technicalScore: {
        correct: tech.correct || 0,
        total: tech.total || (attempt.selectedQuestions?.technical || []).length || 15,
      },
      codingScore: {
        accepted: cod.accepted || 0,
        total: cod.total || cod.totalMarks || (attempt.selectedQuestions?.coding || []).length || 3,
      },
      overall,
      totalMarks,
      percentage,
      passed,
    };
  });

  // Group by company, preserving submission order (newest first).
  const companyMap = new Map();
  for (const item of built) {
    const key = String(item.companyId);
    if (!companyMap.has(key)) {
      companyMap.set(key, []);
    }
    companyMap.get(key).push(item);
  }

  // Assign Mock #N (newest = #count ... oldest = #1) and build per-company
  // summary + overall statistics from actual stored attempt data.
  const companies = [];
  const allPercentages = [];
  const allScores = [];
  let totalPassed = 0;
  let totalFailed = 0;

  for (const group of companyMap.values()) {
    const newestFirst = group; // already sorted newest-first
    const count = newestFirst.length;
    newestFirst.forEach((item, i) => {
      item.attemptNumber = count - i; // newest -> count, oldest -> 1
    });

    const scores = newestFirst.map((a) => a.overall);
    const percentages = newestFirst.map((a) => a.percentage);
    const bestScore = Math.max(...scores);
    const latestScore = newestFirst[0].overall;
    const averagePercentage =
      percentages.length > 0
        ? Math.round((percentages.reduce((acc, p) => acc + (Number(p) || 0), 0) / percentages.length) * 100) / 100
        : 0;
    const passed = newestFirst.filter((a) => a.passed).length;
    const failed = count - passed;
    const lastAttemptedAt = newestFirst[0].submittedAt;

    totalPassed += passed;
    totalFailed += failed;
    allPercentages.push(...percentages);
    allScores.push(...scores);

    companies.push({
      companyId: group[0].companyId,
      companyName: group[0].companyName,
      count,
      bestScore,
      latestScore,
      averagePercentage,
      passed,
      failed,
      lastAttemptedAt,
      attempts: newestFirst,
    });
  }

  // Sort companies alphabetically by name for a stable, clean layout.
  companies.sort((a, b) => String(a.companyName).localeCompare(String(b.companyName)));

  const totalCompleted = built.length;
  const bestScore = allScores.length > 0 ? Math.max(...allScores) : 0;
  const averageScore =
    allScores.length > 0
      ? Math.round((allScores.reduce((acc, v) => acc + (Number(v) || 0), 0) / allScores.length) * 100) / 100
      : 0;
  const averagePercentage =
    allPercentages.length > 0
      ? Math.round((allPercentages.reduce((acc, p) => acc + (Number(p) || 0), 0) / allPercentages.length) * 100) / 100
      : 0;

  return {
    count: totalCompleted,
    stats: {
      totalMockInterviews: totalCompleted,
      totalCompleted,
      totalPassed,
      totalFailed,
      averageScore,
      bestScore,
      averagePercentage,
    },
    companies,
  };
}

export const listMockHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const attempts = await CompanyMockAttempt.find({
      userId,
      status: { $in: COMPLETED_MOCK_STATUSES },
    })
      .sort({ submittedAt: -1 })
      .lean();

    res.status(200).json(computeMockHistory(attempts));
  } catch (error) {
    console.error("List mock history error:", error);
    res.status(500).json({ message: "Error listing mock history", error: error.message });
  }
};

// Build the per-question review data for a completed Company Mock attempt.
// It resolves each stored question (Aptitude/Technical/Coding) and joins the
// student's actual saved answer so the result page can render an accurate,
// scannable review. Only student-facing fields are exposed — never internal
// database/ObjectId internals. No dummy data is ever fabricated.
async function buildMockReviewData(attempt) {
  const idsOf = (arr) => (arr || []).map((id) => String(id)).filter(Boolean);

  // Resolve Grading-style maps: keyed by BOTH Mongo _id and legacy questionId.
  const buildMap = (docs) => {
    const map = new Map();
    for (const q of docs) {
      map.set(String(q._id), q);
      if (q.questionId) map.set(String(q.questionId), q);
    }
    return map;
  };
  const resolve = async (Model, ids) => {
    const byId = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    const docs = await Model.find({
      $or: [{ _id: { $in: byId } }, { questionId: { $in: ids } }],
    }).lean();
    return buildMap(docs);
  };

  const aptitudeMap = await resolve(AptitudeQuestion, idsOf(attempt.selectedQuestions?.aptitude));
  const technicalDbMap = await resolve(TechnicalQuestion, idsOf(attempt.selectedQuestions?.technical));
  const codingMap = await resolve(CodingQuestion, idsOf(attempt.selectedQuestions?.coding));

  // Also load company-specific JSON questions (MCQ + free-text) into the review map.
  const technicalMap = new Map(technicalDbMap);
  if (attempt.companyId) {
    const companyJsonQuestions = loadCompanyMockTechnical(attempt.companyId);
    for (const q of companyJsonQuestions) {
      const qid = String(q.questionId);
      const selectedIds = (attempt.selectedQuestions?.technical || []).map(String);
      if (selectedIds.includes(qid)) {
        technicalMap.set(qid, q);
      }
    }
  }

  const answerByKey = (answers) => {
    const m = new Map();
    (answers || []).forEach((a) => m.set(String(a.questionId), a));
    return m;
  };
  const aptAnswers = answerByKey(attempt.aptitudeAnswers);
  const techAnswers = answerByKey(attempt.technicalAnswers);
  const codingAnswers = answerByKey(attempt.codingAnswers);

  const idOf = (doc) => (doc ? String(doc._id) : "");
  const matches = (key, doc) => key === idOf(doc) || (doc && doc.questionId && key === String(doc.questionId));

  // Aptitude review — MCQ only.
  const aptitude = (attempt.selectedQuestions?.aptitude || []).map((rawKey, i) => {
    const key = String(rawKey);
    const doc = aptitudeMap.get(key);
    const docKey = idOf(doc);
    const answer = [...aptAnswers.entries()].find(([k]) => matches(k, doc))?.[1];
    const selectedOption = answer ? answer.selectedOption : null;
    const isCorrect = !!(answer && answer.isCorrect);
    const attempted = !!(answer && selectedOption !== undefined && selectedOption !== null && String(selectedOption).trim() !== "");
    const status = attempted ? (isCorrect ? "correct" : "wrong") : "skipped";
    return {
      qn: i + 1,
      question: doc ? doc.question || "" : "",
      options: Array.isArray(doc?.options) ? doc.options : [],
      correctAnswer: doc ? doc.correctAnswer || "" : "",
      selectedOption: attempted ? selectedOption : null,
      status,
      answerKey: docKey || key,
    };
  });

  // Technical review — MCQ or AI-evaluated free-text.
  const technical = (attempt.selectedQuestions?.technical || []).map((rawKey, i) => {
    const key = String(rawKey);
    const doc = technicalMap.get(key);
    const docKey = idOf(doc);
    const answer = [...techAnswers.entries()].find(([k]) => matches(k, doc))?.[1];
    const selectedOption = answer ? answer.selectedOption ?? answer.answer : null;
    const hasOptions = Array.isArray(doc?.options) && doc.options.length > 0;
    const isCorrect = !!(answer && answer.isCorrect);
    const attempted = !!(answer && selectedOption !== undefined && selectedOption !== null && String(selectedOption).trim() !== "");
    const evalStatus = answer?.evaluationStatus || (hasOptions ? "not_evaluated" : "pending");
    // Normalize questionType
    let qType = doc?.questionType || "Technical";
    if (qType === "Descriptive") qType = "Technical";
    if (qType === "Conceptual") qType = hasOptions ? "MCQ" : "Technical";
    if (!hasOptions && qType === "MCQ") qType = "Technical";
    return {
      qn: i + 1,
      question: doc ? doc.question || "" : "",
      options: hasOptions ? doc.options : [],
      questionType: qType,
      difficulty: doc?.difficulty || "Medium",
      marks: doc?.marks || 3,
      questionStatus: doc?.questionStatus || null,
      correctAnswer: doc ? doc.correctAnswer || doc.expectedAnswer || "" : "",
      selectedOption: attempted ? selectedOption : null,
      status: attempted ? (isCorrect ? "correct" : "wrong") : "skipped",
      answerKey: docKey || key,
      isAiEvaluated: !hasOptions,
      candidateAnswer: answer?.answer || "",
      aiScore: answer?.aiScore ?? null,
      aiMaxMarks: answer?.aiMaxMarks ?? doc?.marks ?? null,
      aiEvaluation: answer?.aiEvaluation || "",
      aiStrengths: answer?.aiStrengths || [],
      aiWeaknesses: answer?.aiWeaknesses || [],
      aiBetterAnswer: answer?.aiBetterAnswer || "",
      expectedAnswer: answer?.expectedAnswer || doc?.expectedAnswer || "",
      evaluationStatus: evalStatus,
    };
  });

  // Coding review — each problem separately.
  const coding = (attempt.selectedQuestions?.coding || []).map((rawKey, i) => {
    const key = String(rawKey);
    const doc = codingMap.get(key);
    const docKey = idOf(doc);
    const answer = [...codingAnswers.entries()].find(([k]) => matches(k, doc))?.[1];
    const code = (answer && answer.code) || "";
    const submitted = !!(code && String(code).trim());
    const totalCount = Number(answer?.totalCount) || 0;
    const passedCount = Number(answer?.passedCount) || 0;
    const status = String(answer?.status || "").toLowerCase();
    const accepted = submitted && totalCount > 0 && passedCount >= totalCount;
    // Reproduce the exact per-problem score used by the authoritative grader.
    const perProblemScore = accepted ? 1 : 0;
    // Execution time (ms) derived from the actual Judge0 per-test results when present.
    let executionTimeMs = 0;
    if (Array.isArray(answer?.results)) {
      answer.results.forEach((r) => {
        const ms = Number(r?.timeMs) || 0;
        if (ms > executionTimeMs) executionTimeMs = ms;
      });
    }
    return {
      qn: i + 1,
      title: doc ? doc.title || doc.problemStatement || "Coding Problem" : "Coding Problem",
      description: doc ? doc.description || doc.problemStatement || "" : "",
      language: submitted ? answer.language || "" : "",
      code: submitted ? code : "",
      status: submitted
        ? accepted
          ? "accepted"
          : status === "compile_error"
            ? "compile_error"
            : "failed"
        : "not_attempted",
      passedCount: submitted ? passedCount : 0,
      totalCount: submitted ? totalCount : 0,
      score: perProblemScore,
      scoreText: `${perProblemScore}/1`,
      executionTimeMs,
      answerKey: docKey || key,
    };
  });

  return { aptitude, technical, coding };
}

// Fetch a stored result for the result page (survives refresh).
export const getMockResult = async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId } = req.params;
    const attempt = await CompanyMockAttempt.findOne({ _id: attemptId, userId });
    if (!attempt) {
      return res.status(404).json({ message: "Result not found" });
    }
    const review = await buildMockReviewData(attempt);
    res.status(200).json({
      result: {
        attemptId: attempt._id,
        companyId: attempt.companyId,
        companyName: attempt.companyName,
        status: attempt.status,
        submittedAt: attempt.submittedAt,
        startedAt: attempt.startedAt,
        selectedQuestions: attempt.selectedQuestions,
        scores: attempt.scores,
        review,
      },
    });
  } catch (error) {
    console.error("Get mock result error:", error);
    res.status(500).json({ message: "Error loading mock result", error: error.message });
  }
};