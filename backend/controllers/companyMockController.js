import mongoose from "mongoose";
import CompanyMockAttempt from "../models/CompanyMockAttempt.js";
import TechnicalQuestion from "../models/TechnicalQuestion.js";
import QuestionExposure from "../models/QuestionExposure.js";
import CodingQuestion from "../models/CodingQuestion.js";
import PracticeAttempt from "../models/PracticeAttempt.js";
import Company from "../models/Company.js";
import { selectRandomQuestions, getBankMap, cleanPaperQuestion, shuffleArray } from "../services/questionBank.js";
import { evaluateCodingQuestion } from "../services/resultProcessor.js";

/**
 * Helper: Get unseen questions for a student in a company.
 * Returns question IDs that the student has NOT been exposed to.
 */
async function getUnseenQuestionIds(studentId, companyId, questionType, allQuestionIds) {
  const exposures = await QuestionExposure.find({
    studentId,
    companyId,
    questionType,
    questionId: { $in: allQuestionIds },
  })
    .select("questionId")
    .lean();

  const seenIds = new Set(exposures.map((e) => e.questionId));
  return allQuestionIds.filter((id) => !seenIds.has(id));
}

/**
 * Helper: Load question paper for an existing attempt.
 */
async function loadQuestionsForAttempt(attempt) {
  let aptitudeIds = attempt.selectedQuestions?.aptitude || [];
  let technicalIds = attempt.selectedQuestions?.technical || [];
  let codingIds = attempt.selectedQuestions?.coding || [];

  if (!aptitudeIds.length && !technicalIds.length && !codingIds.length) {
    const exposures = await QuestionExposure.find({ attemptId: attempt._id }).lean();
    aptitudeIds = exposures.filter((e) => e.questionType === "aptitude").map((e) => e.questionId);
    technicalIds = exposures.filter((e) => e.questionType === "technical").map((e) => e.questionId);
    codingIds = exposures.filter((e) => e.questionType === "coding").map((e) => e.questionId);
  }

  const bankMap = getBankMap();
  const aptitude = aptitudeIds
    .map((id) => {
      const q = bankMap.get(id);
      return q ? cleanPaperQuestion(q) : null;
    })
    .filter(Boolean);

  const technical = technicalIds.length
    ? await TechnicalQuestion.find({
        questionId: { $in: technicalIds },
        isDeleted: false,
      })
        .select("-expectedAnswer -explanation -usageCount -isDeleted -deletedAt -lastEditedBy -lastEditedAt")
        .lean()
    : [];

  const coding = codingIds.length
    ? await CodingQuestion.find({
        questionId: { $in: codingIds },
        isDeleted: { $ne: true },
      })
        .select(
          "questionId title difficulty problemStatement description inputFormat outputFormat constraints sampleInput sampleOutput examples starterCode languages timeLimit marks"
        )
        .lean()
    : [];

  return { aptitude, technical, coding };
}

function getDraftCode(codingDrafts, questionId, language) {
  const key = `${questionId}:${language}`;
  if (!codingDrafts) return "";
  if (typeof codingDrafts.get === "function") return codingDrafts.get(key) || "";
  return codingDrafts[key] || "";
}

// Pick the language that actually has a saved draft for a coding question.
// This supports per-language drafts (PART 15) so the final submission grades
// each problem with the language the student actually used, not a single global
// "currently selected" language.
const LANGUAGE_ORDER = ["java", "cpp", "c", "python"];
function pickDraftLanguage(codingDrafts, questionId, fallback = "java") {
  for (const lang of LANGUAGE_ORDER) {
    const code = getDraftCode(codingDrafts, questionId, lang);
    if (code && String(code).trim()) return { language: lang, code };
  }
  return { language: fallback, code: "" };
}

/**
 * Helper: Record question exposure for a student.
 */
async function recordExposure(studentId, companyId, questionId, questionType, attemptId) {
  try {
    await QuestionExposure.findOneAndUpdate(
      { studentId, companyId, questionId },
      {
        $setOnInsert: {
          studentId,
          companyId,
          questionId,
          questionType,
          attemptId,
          shownAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    // Ignore duplicate key errors (race condition)
    if (error.code !== 11000) {
      console.error("Record Exposure Error:", error.message);
    }
  }
}

/**
 * Helper: Compute remaining ACTIVE assessment time (ms) from server timestamps.
 * Paused periods are excluded. While paused, the value is frozen at the
 * moment the pause began (expiresAt - pausedAt).
 */
function computeRemainingMs(attempt, now = new Date()) {
  if (!attempt.startedAt || !attempt.expiresAt) return 0;
  if (attempt.status === "paused" && attempt.pausedAt) {
    return Math.max(0, new Date(attempt.expiresAt).getTime() - new Date(attempt.pausedAt).getTime());
  }
  if (attempt.status === "not_started") return attempt.config?.durationMinutes ? attempt.config.durationMinutes * 60 * 1000 : 0;
  return Math.max(0, new Date(attempt.expiresAt).getTime() - now.getTime());
}

/**
 * Helper: Persist a raw security event into the securityEvents array.
 */
function pushSecurityEvent(attempt, type, { section = null, questionId = null, metadata = {} } = {}) {
  attempt.securityEvents.push({
    type,
    timestamp: new Date(),
    section,
    questionId,
    metadata,
  });
}

/**
 * Helper: Whether the attempt is in a running (counting) state.
 */
function isRunning(status) {
  return status === "in_progress";
}

/**
 * POST /api/company-mock/start
 * Start a company-specific mock interview.
 * Selects questions without repetition for the student.
 */
export const startCompanyMock = async (req, res) => {
  try {
    const userId = req.user.id;
    const { companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required" });
    }

    // Check for existing attempt that has not been submitted
    const existingAttempt = await CompanyMockAttempt.findOne({
      userId,
      companyId,
      status: { $in: ["not_started", "in_progress", "paused", "abandoned"] },
    });

    if (existingAttempt) {
      const questions = await loadQuestionsForAttempt(existingAttempt);
      return res.json({
        attemptId: existingAttempt._id,
        resume: existingAttempt.status !== "not_started",
        status: existingAttempt.status,
        companyId: existingAttempt.companyId,
        companyName: existingAttempt.companyName,
        expiresAt: existingAttempt.expiresAt,
        startedAt: existingAttempt.startedAt,
        pausedAt: existingAttempt.pausedAt,
        totalPausedMs: existingAttempt.totalPausedMs,
        config: existingAttempt.config,
        attempt: existingAttempt,
        aptitude: questions.aptitude,
        technical: questions.technical,
        coding: questions.coding,
      });
    }

    // Get company details
    const company = await Company.findOne({ id: companyId, isDeleted: { $ne: true } }).lean();
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Configuration
    const config = {
      aptitudeCount: 15,
      technicalCount: 15,
      codingCount: 2,
      durationMinutes: 60,
    };

    // 1. Select Aptitude Questions (without repetition)
    // The in-memory aptitude bank holds all curated aptitude questions
    // (IDs use topic prefixes like DIT-/LR-/QT-..., not a single prefix).
    const allAptitudeIds = [...getBankMap().keys()];

    const unseenAptitudeIds = await getUnseenQuestionIds(userId, companyId, "aptitude", allAptitudeIds);
    
    let selectedAptitudeIds;
    if (unseenAptitudeIds.length >= config.aptitudeCount) {
      selectedAptitudeIds = shuffleArray(unseenAptitudeIds).slice(0, config.aptitudeCount);
    } else {
      // Fallback: use all available (including seen) if not enough unseen
      selectedAptitudeIds = shuffleArray(allAptitudeIds).slice(0, config.aptitudeCount);
    }

    const bankMap = getBankMap();
    const aptitudeQuestions = selectedAptitudeIds
      .map((id) => {
        const q = bankMap.get(id);
        return q ? cleanPaperQuestion(q) : null;
      })
      .filter(Boolean)
      .map((q) => ({ ...q, options: shuffleArray(q.options) }));

    // 2. Select Technical Questions (without repetition)
    const allTechnical = await TechnicalQuestion.find({
      companyIds: companyId,
      isActive: true,
      isDeleted: false,
    })
      .select("questionId")
      .lean();

    const allTechnicalIds = allTechnical.map((q) => q.questionId);
    const unseenTechnicalIds = await getUnseenQuestionIds(userId, companyId, "technical", allTechnicalIds);

    let selectedTechnicalIds;
    if (unseenTechnicalIds.length >= config.technicalCount) {
      selectedTechnicalIds = shuffleArray(unseenTechnicalIds).slice(0, config.technicalCount);
    } else if (unseenTechnicalIds.length > 0) {
      // Use all unseen + fill with seen
      const remaining = config.technicalCount - unseenTechnicalIds.length;
      const seenIds = allTechnicalIds.filter((id) => !unseenTechnicalIds.includes(id));
      selectedTechnicalIds = [...unseenTechnicalIds, ...shuffleArray(seenIds).slice(0, remaining)];
    } else {
      selectedTechnicalIds = shuffleArray(allTechnicalIds).slice(0, config.technicalCount);
    }

    const technicalQuestions = await TechnicalQuestion.find({
      questionId: { $in: selectedTechnicalIds },
      companyIds: companyId,
      isActive: true,
      isDeleted: false,
    })
      .select("-expectedAnswer -explanation -usageCount -isDeleted -deletedAt -lastEditedBy -lastEditedAt")
      .lean();

    // 3. Select Coding Questions (without repetition)
    const allCoding = await CodingQuestion.find({
      companyId,
      isActive: true,
      isDeleted: { $ne: true },
    })
      .select("questionId")
      .lean();

    const allCodingIds = allCoding.map((q) => q.questionId);
    const unseenCodingIds = await getUnseenQuestionIds(userId, companyId, "coding", allCodingIds);

    let selectedCodingIds;
    if (unseenCodingIds.length >= config.codingCount) {
      selectedCodingIds = shuffleArray(unseenCodingIds).slice(0, config.codingCount);
    } else {
      selectedCodingIds = shuffleArray(allCodingIds).slice(0, config.codingCount);
    }

    const codingQuestions = await CodingQuestion.find({
      questionId: { $in: selectedCodingIds },
      isActive: true,
      isDeleted: { $ne: true },
    })
      .select("questionId title difficulty problemStatement description inputFormat outputFormat constraints sampleInput sampleOutput examples starterCode languages timeLimit marks")
      .lean();

    // Check question availability
    const warnings = [];
    if (aptitudeQuestions.length < config.aptitudeCount) {
      warnings.push(`Only ${aptitudeQuestions.length} aptitude questions available (requested ${config.aptitudeCount})`);
    }
    if (technicalQuestions.length < config.technicalCount) {
      warnings.push(`Only ${technicalQuestions.length} technical questions available (requested ${config.technicalCount})`);
    }
    if (codingQuestions.length < config.codingCount) {
      warnings.push(`Only ${codingQuestions.length} coding questions available (requested ${config.codingCount})`);
    }

    // Create attempt (timer does NOT start until fullscreen is confirmed via /begin)
    const attempt = await CompanyMockAttempt.create({
      userId,
      companyId,
      companyName: company.name,
      status: "not_started",
      config: {
        aptitudeCount: aptitudeQuestions.length,
        technicalCount: technicalQuestions.length,
        codingCount: codingQuestions.length,
        durationMinutes: config.durationMinutes,
      },
      startedAt: null,
      expiresAt: null,
      pausedAt: null,
      totalPausedMs: 0,
      lastActiveAt: new Date(),
      selectedQuestions: {
        aptitude: selectedAptitudeIds,
        technical: selectedTechnicalIds,
        coding: selectedCodingIds,
      },
    });

    // Record exposure for all selected questions
    const exposurePromises = [
      ...aptitudeQuestions.map((q) => recordExposure(userId, companyId, q.questionId, "aptitude", attempt._id)),
      ...technicalQuestions.map((q) => recordExposure(userId, companyId, q.questionId, "technical", attempt._id)),
      ...codingQuestions.map((q) => recordExposure(userId, companyId, q.questionId, "coding", attempt._id)),
    ];
    await Promise.allSettled(exposurePromises);

    // Update usage counts
    await TechnicalQuestion.updateMany(
      { questionId: { $in: selectedTechnicalIds } },
      { $inc: { usageCount: 1 } }
    );

    res.status(201).json({
      attemptId: attempt._id,
      resume: false,
      companyId: company.id,
      companyName: company.name,
      color: company.color,
      config: attempt.config,
      expiresAt: attempt.expiresAt,
      aptitude: aptitudeQuestions,
      technical: technicalQuestions,
      coding: codingQuestions,
      warnings,
      instructions: [
        "This is a practice simulation, not an official company interview.",
        "Attempt all sections: Aptitude → Technical → Coding.",
        "The timer starts immediately and cannot be paused.",
        "Tab switching is monitored — stay on the exam window.",
        "Auto-save is enabled. You can resume if interrupted.",
      ],
    });
  } catch (error) {
    console.error("Start Company Mock Error:", error.message);
    res.status(500).json({ message: "Failed to start company mock interview" });
  }
};

/**
 * POST /api/company-mock/answer
 * Save an answer for aptitude or technical question (auto-save).
 */
export const saveAnswer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId, section, questionId, answer, timeTakenMs } = req.body;

    const attempt = await CompanyMockAttempt.findOne({ _id: attemptId, userId });
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    if (["completed", "auto_submitted", "expired"].includes(attempt.status)) {
      return res.status(400).json({ message: "Attempt is no longer in progress" });
    }

    // Check if expired (only while running)
    if (attempt.expiresAt && new Date() > attempt.expiresAt && attempt.status === "in_progress") {
      attempt.status = "expired";
      attempt.pausedAt = null;
      await attempt.save();
      return res.status(400).json({ message: "Time expired" });
    }

    // Update last active
    attempt.lastActiveAt = new Date();

    if (section === "aptitude") {
      // Find existing answer or add new
      const existingIndex = attempt.aptitudeAnswers.findIndex((a) => a.questionId === questionId);
      const answerData = {
        questionId,
        selectedOption: answer,
        timeTakenMs: timeTakenMs || 0,
      };

      if (existingIndex >= 0) {
        attempt.aptitudeAnswers[existingIndex] = answerData;
      } else {
        attempt.aptitudeAnswers.push(answerData);
      }
    } else if (section === "technical") {
      const existingIndex = attempt.technicalAnswers.findIndex((a) => a.questionId === questionId);
      const answerData = {
        questionId,
        answer: answer || "",
        timeTakenMs: timeTakenMs || 0,
      };

      if (existingIndex >= 0) {
        attempt.technicalAnswers[existingIndex] = answerData;
      } else {
        attempt.technicalAnswers.push(answerData);
      }
    }

    await attempt.save();

    // Update exposure
    await QuestionExposure.findOneAndUpdate(
      { studentId: userId, companyId: attempt.companyId, questionId },
      { $set: { answeredAt: new Date() } }
    );

    res.json({ message: "Answer saved" });
  } catch (error) {
    console.error("Save Answer Error:", error.message);
    res.status(500).json({ message: "Failed to save answer" });
  }
};

/**
 * POST /api/company-mock/coding-draft
 * Save coding draft (per language).
 */
export const saveCodingDraft = async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId, questionId, language, code } = req.body;

    const attempt = await CompanyMockAttempt.findOne({ _id: attemptId, userId });
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    const draftKey = `${questionId}:${language}`;
    attempt.codingDrafts.set(draftKey, code);
    attempt.selectedCodingLanguage = language;
    await attempt.save();

    res.json({ message: "Draft saved" });
  } catch (error) {
    console.error("Save Coding Draft Error:", error.message);
    res.status(500).json({ message: "Failed to save draft" });
  }
};

/**
 * GET /api/company-mock/draft/:attemptId/:questionId
 * Get coding draft for a specific question.
 */
export const getCodingDraft = async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId, questionId } = req.params;

    const attempt = await CompanyMockAttempt.findOne({ _id: attemptId, userId });
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    const language = attempt.selectedCodingLanguage || "java";
    const prefix = `${questionId}:`;
    const drafts = {};

    const draftSource = attempt.codingDrafts;
    if (draftSource) {
      if (typeof draftSource.entries === "function") {
        for (const [key, code] of draftSource.entries()) {
          if (key.startsWith(prefix)) drafts[key.slice(prefix.length)] = code;
        }
      } else {
        for (const [key, code] of Object.entries(draftSource)) {
          if (key.startsWith(prefix)) drafts[key.slice(prefix.length)] = code;
        }
      }
    }

    res.json({
      code: drafts[language] || "",
      language,
      drafts,
    });
  } catch (error) {
    console.error("Get Coding Draft Error:", error.message);
    res.status(500).json({ message: "Failed to get draft" });
  }
};

/**
 * POST /api/company-mock/tab-switch
 * Record a tab switch event.
 */
export const recordTabSwitch = async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId, questionId, remainingTime } = req.body;

    const attempt = await CompanyMockAttempt.findOne({ _id: attemptId, userId });
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    attempt.security.tabSwitchCount += 1;
    attempt.security.tabSwitches.push({
      timestamp: new Date(),
      questionId,
      remainingTime,
    });
    attempt.lastActiveAt = new Date();

    await attempt.save();

    res.json({
      tabSwitchCount: attempt.security.tabSwitchCount,
    });
  } catch (error) {
    console.error("Record Tab Switch Error:", error.message);
    res.status(500).json({ message: "Failed to record tab switch" });
  }
};

/**
 * POST /api/company-mock/fullscreen-exit
 * Record a fullscreen exit event.
 */
export const recordFullscreenExit = async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId, questionId } = req.body;

    const attempt = await CompanyMockAttempt.findOne({ _id: attemptId, userId });
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    attempt.security.fullscreenExitCount += 1;
    attempt.security.fullscreenExits.push({
      timestamp: new Date(),
      questionId,
    });

    await attempt.save();

    res.json({ fullscreenExitCount: attempt.security.fullscreenExitCount });
  } catch (error) {
    console.error("Record Fullscreen Exit Error:", error.message);
    res.status(500).json({ message: "Failed to record fullscreen exit" });
  }
};

/**
 * POST /api/company-mock/security-event
 * Record copy/paste/cut/right-click events.
 */
export const recordSecurityEvent = async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId, eventType } = req.body;

    const attempt = await CompanyMockAttempt.findOne({ _id: attemptId, userId });
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    switch (eventType) {
      case "copy_attempt":
        attempt.security.copyAttempts += 1;
        break;
      case "paste_attempt":
        attempt.security.pasteAttempts += 1;
        break;
      case "cut_attempt":
        attempt.security.cutAttempts += 1;
        break;
      case "right_click_attempt":
        attempt.security.rightClickAttempts += 1;
        break;
    }

    await attempt.save();

    res.json({ message: "Security event recorded" });
  } catch (error) {
    console.error("Record Security Event Error:", error.message);
    res.status(500).json({ message: "Failed to record security event" });
  }
};

/**
 * POST /api/company-mock/begin
 * Begin the assessment timer. MUST be called only after the client has
 * successfully entered fullscreen. Idempotent: if already running, returns
 * current state without resetting the timer.
 */
export const beginAttempt = async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId } = req.body;

    const attempt = await CompanyMockAttempt.findOne({ _id: attemptId, userId });
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    // If already running (idempotent), just return state.
    if (isRunning(attempt.status)) {
      return res.json({
        status: attempt.status,
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt,
        pausedAt: attempt.pausedAt,
        totalPausedMs: attempt.totalPausedMs,
        remainingMs: computeRemainingMs(attempt),
      });
    }

    const now = new Date();
    const durationMs = (attempt.config?.durationMinutes || 60) * 60 * 1000;

    attempt.status = "in_progress";
    if (!attempt.startedAt) attempt.startedAt = now;
    if (!attempt.expiresAt) attempt.expiresAt = new Date(now.getTime() + durationMs);
    attempt.pausedAt = null;
    attempt.lastActiveAt = now;

    pushSecurityEvent(attempt, "assessment_started", { metadata: { reason: "fullscreen_confirmed" } });
    pushSecurityEvent(attempt, "fullscreen_enter", {});
    await attempt.save();

    res.json({
      status: attempt.status,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      pausedAt: attempt.pausedAt,
      totalPausedMs: attempt.totalPausedMs,
      remainingMs: computeRemainingMs(attempt, now),
    });
  } catch (error) {
    console.error("Begin Attempt Error:", error.message);
    res.status(500).json({ message: "Failed to begin assessment" });
  }
};

/**
 * POST /api/company-mock/pause
 * Idempotent pause. Only transitions from running -> paused. If already
 * paused, returns current state (no extra pause period is recorded).
 * reason: fullscreen_exit | tab_switch | window_blur
 */
export const pauseAttempt = async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId, reason, section, questionId } = req.body;

    const attempt = await CompanyMockAttempt.findOne({ _id: attemptId, userId });
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    // Idempotency: already paused (or terminal) -> no new pause period.
    if (attempt.status !== "in_progress") {
      return res.json({
        status: attempt.status,
        pausedAt: attempt.pausedAt,
        remainingMs: computeRemainingMs(attempt),
      });
    }

    const now = new Date();
    attempt.status = "paused";
    attempt.pausedAt = now;
    attempt.lastActiveAt = now;

    if (reason === "fullscreen_exit") {
      attempt.security.fullscreenExitCount = (attempt.security.fullscreenExitCount || 0) + 1;
      attempt.security.fullscreenExits.push({ timestamp: now, questionId: questionId || null });
      pushSecurityEvent(attempt, "fullscreen_exit", { section, questionId, metadata: { reason } });
    } else if (reason === "tab_switch") {
      attempt.security.tabSwitchCount = (attempt.security.tabSwitchCount || 0) + 1;
      attempt.security.tabSwitches.push({
        timestamp: now,
        questionId: questionId || null,
        remainingTime: Math.round(computeRemainingMs(attempt, now) / 1000),
      });
      pushSecurityEvent(attempt, "tab_switch", { section, questionId, metadata: { reason } });
    } else {
      pushSecurityEvent(attempt, "assessment_paused", { section, questionId, metadata: { reason } });
    }

    await attempt.save();

    res.json({
      status: attempt.status,
      pausedAt: attempt.pausedAt,
      remainingMs: computeRemainingMs(attempt, now),
    });
  } catch (error) {
    console.error("Pause Attempt Error:", error.message);
    res.status(500).json({ message: "Failed to pause assessment" });
  }
};

/**
 * POST /api/company-mock/resume
 * Idempotent resume. Only transitions from paused -> running. Adds the paused
 * duration to totalPausedMs and shifts expiresAt forward so paused time never
 * counts toward the assessment duration.
 */
export const resumeAttempt = async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId, section, questionId } = req.body;

    const attempt = await CompanyMockAttempt.findOne({ _id: attemptId, userId });
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    // Idempotency: already running (or terminal) -> no time adjustment.
    if (attempt.status !== "paused" && attempt.status !== "abandoned") {
      return res.json({
        status: attempt.status,
        expiresAt: attempt.expiresAt,
        pausedAt: attempt.pausedAt,
        totalPausedMs: attempt.totalPausedMs,
        remainingMs: computeRemainingMs(attempt),
      });
    }

    const now = new Date();
    const pausedDuration = attempt.pausedAt ? now.getTime() - new Date(attempt.pausedAt).getTime() : 0;

    attempt.totalPausedMs = (attempt.totalPausedMs || 0) + pausedDuration;
    if (attempt.expiresAt) {
      attempt.expiresAt = new Date(new Date(attempt.expiresAt).getTime() + pausedDuration);
    }
    attempt.pausedAt = null;
    attempt.status = "in_progress";
    attempt.lastActiveAt = now;

    pushSecurityEvent(attempt, "assessment_resumed", { section, questionId, metadata: { pausedDurationMs: pausedDuration } });
    pushSecurityEvent(attempt, "fullscreen_enter", { section, questionId, metadata: { reason: "resume" } });
    await attempt.save();

    res.json({
      status: attempt.status,
      expiresAt: attempt.expiresAt,
      pausedAt: attempt.pausedAt,
      totalPausedMs: attempt.totalPausedMs,
      remainingMs: computeRemainingMs(attempt, now),
    });
  } catch (error) {
    console.error("Resume Attempt Error:", error.message);
    res.status(500).json({ message: "Failed to resume assessment" });
  }
};

/**
 * POST /api/company-mock/exit
 * Student chose to leave the (paused/locked) assessment via "Exit Mock Interview".
 * The attempt is preserved (marked abandoned) so it can be resumed later, the
 * timer is paused (frozen), a security event is recorded, and progress is saved.
 * The attempt is NEVER deleted.
 */
export const exitAttempt = async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId, section, questionId } = req.body;

    const attempt = await CompanyMockAttempt.findOne({ _id: attemptId, userId });
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    // Freeze the timer if it was still running.
    if (attempt.status === "in_progress") {
      attempt.status = "paused";
      attempt.pausedAt = new Date();
    }

    attempt.status = "abandoned";
    attempt.lastActiveAt = new Date();

    if (section) attempt.currentSection = section;
    if (typeof questionId !== "undefined") attempt.currentQuestionIndex = attempt.currentQuestionIndex;

    pushSecurityEvent(attempt, "assessment_exited", { section, questionId, metadata: { reason: "student_exit" } });
    await attempt.save();

    res.json({
      status: attempt.status,
      pausedAt: attempt.pausedAt,
      remainingMs: computeRemainingMs(attempt),
    });
  } catch (error) {
    console.error("Exit Attempt Error:", error.message);
    res.status(500).json({ message: "Failed to exit assessment" });
  }
};

/**
 * GET /api/company-mock/status/:attemptId
 * Authoritative status + remaining time. Used for refresh recovery and polling.
 */
export const getAttemptStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId } = req.params;

    const attempt = await CompanyMockAttempt.findOne({ _id: attemptId, userId });
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    // If running and time is up, mark expired (authoritative).
    let status = attempt.status;
    const remaining = computeRemainingMs(attempt);
    if (isRunning(status) && remaining <= 0) {
      status = "expired";
      attempt.status = "expired";
      attempt.pausedAt = null;
      await attempt.save();
    }

    res.json({
      status,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      pausedAt: attempt.pausedAt,
      totalPausedMs: attempt.totalPausedMs,
      remainingMs: computeRemainingMs(attempt),
      currentSection: attempt.currentSection,
      currentQuestionIndex: attempt.currentQuestionIndex,
      selectedCodingLanguage: attempt.selectedCodingLanguage,
      securityEventCount: attempt.securityEvents?.length || 0,
    });
  } catch (error) {
    console.error("Get Attempt Status Error:", error.message);
    res.status(500).json({ message: "Failed to get status" });
  }
};

/**
 * POST /api/company-mock/progress
 * Save current section, question index, and timer state.
 */
export const saveProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId, currentSection, currentQuestionIndex } = req.body;

    const attempt = await CompanyMockAttempt.findOne({ _id: attemptId, userId });
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    if (["completed", "auto_submitted", "expired"].includes(attempt.status)) {
      return res.status(400).json({ message: "Attempt is no longer in progress" });
    }

    if (currentSection) attempt.currentSection = currentSection;
    if (typeof currentQuestionIndex === "number") attempt.currentQuestionIndex = currentQuestionIndex;
    attempt.lastActiveAt = new Date();
    await attempt.save();

    res.json({
      currentSection: attempt.currentSection,
      currentQuestionIndex: attempt.currentQuestionIndex,
      expiresAt: attempt.expiresAt,
    });
  } catch (error) {
    console.error("Save Progress Error:", error.message);
    res.status(500).json({ message: "Failed to save progress" });
  }
};

/**
 * POST /api/company-mock/submit
 * Submit the company mock interview attempt.
 */
export const submitCompanyMock = async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId, codingLanguages } = req.body;

    const attempt = await CompanyMockAttempt.findOne({ _id: attemptId, userId });
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    if (["completed", "auto_submitted"].includes(attempt.status)) {
      return res.status(400).json({ message: "Attempt is already submitted" });
    }

    // Sync coding answers from saved drafts before grading
    let codingQuestionIds = attempt.selectedQuestions?.coding || [];
    if (!codingQuestionIds.length) {
      const exposures = await QuestionExposure.find({
        attemptId: attempt._id,
        questionType: "coding",
      })
        .select("questionId")
        .lean();
      codingQuestionIds = exposures.map((e) => e.questionId);
    }

    const selectedLang = req.body?.codingLanguages?.selected || attempt.selectedCodingLanguage || "java";
    for (const qId of codingQuestionIds) {
      const existingIndex = attempt.codingAnswers.findIndex((a) => a.questionId === qId);
      const existing = existingIndex >= 0 ? attempt.codingAnswers[existingIndex] : null;
      const alreadyGraded =
        existing &&
        Array.isArray(existing.results) &&
        existing.results.length > 0 &&
        existing.status &&
        existing.status !== "pending" &&
        existing.status !== "skipped";
      // Never overwrite a result already produced by a per-question submit.
      if (alreadyGraded) continue;

      const { language, code } = pickDraftLanguage(attempt.codingDrafts, qId, selectedLang);
      const entry = {
        questionId: qId,
        language,
        code,
        status: "pending",
      };
      if (existing) {
        attempt.codingAnswers[existingIndex] = { ...existing, ...entry };
      } else {
        attempt.codingAnswers.push(entry);
      }
    }

    // Grade aptitude answers
    const bankMap = getBankMap();
    let aptitudeCorrect = 0;
    let aptitudeWrong = 0;
    let aptitudeSkipped = 0;
    let aptitudeMarksObtained = 0;
    let aptitudeTotalMarks = 0;

    for (const answer of attempt.aptitudeAnswers) {
      const question = bankMap.get(answer.questionId);
      if (!question) continue;

      const marks = Number(question.marks) || 1;
      aptitudeTotalMarks += marks;

      if (answer.selectedOption == null || answer.selectedOption === "") {
        aptitudeSkipped++;
      } else if (answer.selectedOption === String(question.correctAnswer)) {
        aptitudeCorrect++;
        aptitudeMarksObtained += marks;
        answer.isCorrect = true;
      } else {
        aptitudeWrong++;
        answer.isCorrect = false;
      }
    }

    attempt.scores.aptitude = {
      total: attempt.aptitudeAnswers.length,
      correct: aptitudeCorrect,
      wrong: aptitudeWrong,
      skipped: aptitudeSkipped,
      percentage: attempt.aptitudeAnswers.length > 0
        ? Math.round((aptitudeCorrect / attempt.aptitudeAnswers.length) * 100)
        : 0,
      marksObtained: aptitudeMarksObtained,
      totalMarks: aptitudeTotalMarks,
    };

    // Grade technical answers (MCQ — compare selected option to correct answer)
    let technicalMarksObtained = 0;
    let technicalTotalMarks = 0;
    let technicalCorrect = 0;
    let technicalWrong = 0;
    let technicalSkipped = 0;
    let technicalAnswered = 0;

    for (const answer of attempt.technicalAnswers) {
      const question = await TechnicalQuestion.findOne({ questionId: answer.questionId }).lean();
      if (!question) continue;

      const marks = question.marks || 1;
      technicalTotalMarks += marks;
      answer.selectedOption = answer.answer || "";

      if (answer.answer && String(answer.answer).trim()) {
        technicalAnswered++;
        if (String(answer.answer).trim() === String(question.correctAnswer).trim()) {
          technicalCorrect++;
          technicalMarksObtained += marks;
          answer.isCorrect = true;
        } else {
          technicalWrong++;
          answer.isCorrect = false;
        }
      } else {
        technicalSkipped++;
        answer.isCorrect = false;
      }
    }

    attempt.scores.technical = {
      total: attempt.technicalAnswers.length,
      correct: technicalCorrect,
      wrong: technicalWrong,
      skipped: technicalSkipped,
      answered: technicalAnswered,
      percentage: attempt.technicalAnswers.length > 0
        ? Math.round((technicalCorrect / attempt.technicalAnswers.length) * 100)
        : 0,
      marksObtained: technicalMarksObtained,
      totalMarks: technicalTotalMarks,
    };

    // Grade coding answers using Docker execution
    let codingMarksObtained = 0;
    let codingTotalMarks = 0;
    let codingAccepted = 0;

    for (const codingAnswer of attempt.codingAnswers) {
      const question = await CodingQuestion.findOne({ questionId: codingAnswer.questionId }).lean();
      if (!question) continue;

      const marks = question.marks || 10;
      codingTotalMarks += marks;

      const totalCases = (question.testCases || []).length;

      // Reuse a result that was already produced by the per-question
      // "Submit" action (PART 20) instead of re-running Docker again.
      const hasSavedResult =
        Array.isArray(codingAnswer.results) &&
        codingAnswer.results.length > 0 &&
        codingAnswer.status &&
        codingAnswer.status !== "pending" &&
        codingAnswer.status !== "skipped";

      if (hasSavedResult) {
        if (codingAnswer.status === "accepted") {
          codingAccepted++;
          codingMarksObtained += marks;
        }
        continue;
      }

      if (codingAnswer.code && codingAnswer.code.trim()) {
        try {
          const language = codingAnswer.language || "java";
          const evaluation = await evaluateCodingQuestion(
            codingAnswer.code,
            language,
            question.testCases || [],
            question.timeLimit ? question.timeLimit * 1000 : 2000
          );

          codingAnswer.status = evaluation.status;
          codingAnswer.passedCount = evaluation.passedCount;
          codingAnswer.totalCount = evaluation.totalCount;
          codingAnswer.results = evaluation.results;

          if (evaluation.status === "accepted") {
            codingAccepted++;
            codingMarksObtained += marks;
          }
        } catch (error) {
          codingAnswer.status = "error";
          codingAnswer.passedCount = 0;
          codingAnswer.totalCount = totalCases;
        }
      } else {
        codingAnswer.status = "skipped";
        codingAnswer.passedCount = 0;
        codingAnswer.totalCount = totalCases;
      }
    }

    attempt.scores.coding = {
      attempted: attempt.codingAnswers.filter((a) => a.code && a.code.trim()).length,
      accepted: codingAccepted,
      total: attempt.codingAnswers.length,
      marksObtained: codingMarksObtained,
      totalMarks: codingTotalMarks,
    };

    // Calculate overall score
    const totalMarksObtained = aptitudeMarksObtained + technicalMarksObtained + codingMarksObtained;
    const totalMarks = aptitudeTotalMarks + technicalTotalMarks + codingTotalMarks;
    attempt.scores.overall = totalMarks > 0 ? Math.round((totalMarksObtained / totalMarks) * 100) : 0;

    // Mark attempt as completed
    attempt.status = "completed";
    attempt.submittedAt = new Date();

    // Update exposure completion status
    await QuestionExposure.updateMany(
      { studentId: userId, companyId: attempt.companyId, attemptId: attempt._id },
      { $set: { completedAt: new Date() } }
    );

    await attempt.save();

    // Persist aptitude as PracticeAttempt for analytics
    if (attempt.aptitudeAnswers.length > 0) {
      await PracticeAttempt.create({
        userId,
        companyId: attempt.companyId,
        companyName: attempt.companyName,
        questionCount: attempt.aptitudeAnswers.length,
        difficulty: "mixed",
        questions: attempt.aptitudeAnswers.map((a) => ({
          questionId: a.questionId,
          userAnswer: a.selectedOption,
          isCorrect: a.isCorrect,
        })),
        score: aptitudeCorrect,
        correct: aptitudeCorrect,
        wrong: aptitudeWrong,
        skipped: aptitudeSkipped,
        percentage: attempt.scores.aptitude.percentage,
        timeTaken: 0,
      });
    }

    // Generate feedback
    const weakAreas = [];
    const strongAreas = [];

    if (attempt.scores.aptitude.percentage < 50) weakAreas.push("Aptitude");
    else if (attempt.scores.aptitude.percentage >= 70) strongAreas.push("Aptitude");

    if (attempt.scores.technical.totalMarks > 0) {
      const techPct = Math.round((attempt.scores.technical.marksObtained / attempt.scores.technical.totalMarks) * 100);
      if (techPct < 50) weakAreas.push("Technical Knowledge");
      else if (techPct >= 70) strongAreas.push("Technical Knowledge");
    }

    if (attempt.scores.coding.total > 0) {
      const codePct = Math.round((codingAccepted / attempt.scores.coding.total) * 100);
      if (codePct < 50) weakAreas.push("Coding");
      else if (codePct >= 70) strongAreas.push("Coding");
    }

    attempt.feedback = {
      weakAreas,
      strongAreas,
      recommendation: attempt.scores.overall >= 70
        ? "Good performance! Continue practicing to maintain consistency."
        : "Focus on weak areas and practice more company-specific questions.",
    };

    await attempt.save();

    res.json({
      attemptId: attempt._id,
      scores: attempt.scores,
      feedback: attempt.feedback,
      security: {
        tabSwitchCount: attempt.security.tabSwitchCount,
        fullscreenExitCount: attempt.security.fullscreenExitCount,
      },
    });
  } catch (error) {
    console.error("Submit Company Mock Error:", error.message);
    res.status(500).json({ message: "Failed to submit mock interview" });
  }
};

/**
 * GET /api/company-mock/history
 * Get company mock interview history for a student.
 */
export const getCompanyMockHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { companyId } = req.query;

    const query = { userId };
    if (companyId) {
      query.companyId = companyId;
    }

    const attempts = await CompanyMockAttempt.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .select("-codingDrafts -technicalAnswers.answer")
      .lean();

    const formatted = attempts.map((a) => ({
      ...a,
      overallScore: a.scores?.overall ?? null,
      aptitudeScore: a.scores?.aptitude?.percentage ?? null,
      technicalScore:
        a.scores?.technical?.totalMarks > 0
          ? Math.round((a.scores.technical.marksObtained / a.scores.technical.totalMarks) * 100)
          : null,
      codingScore:
        a.scores?.coding?.total > 0
          ? Math.round((a.scores.coding.accepted / a.scores.coding.total) * 100)
          : null,
    }));

    res.json({ attempts: formatted });
  } catch (error) {
    console.error("Company Mock History Error:", error.message);
    res.status(500).json({ message: "Failed to load mock history" });
  }
};

/**
 * POST /api/company-mock/coding-submit
 * Evaluate a single coding question with the existing Docker execution service
 * and persist the result into the attempt's codingAnswers. This is the
 * "Submit" action for an individual coding problem (PART 20).
 *
 * The compiler is NOT replaced — it reuses `evaluateCodingQuestion` which in
 * turn uses the existing codeExecutionService + Docker. The result is saved so
 * the final mock submission does not need to re-run Docker redundantly.
 */
export const submitCodingAnswer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId, questionId, language, code } = req.body;

    if (!attemptId || !questionId || !language) {
      return res.status(400).json({ message: "attemptId, questionId and language are required" });
    }
    if (code == null || !String(code).trim()) {
      return res.status(400).json({ message: "Code is required to submit" });
    }

    const attempt = await CompanyMockAttempt.findOne({ _id: attemptId, userId });
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    const terminalStatuses = ["completed", "auto_submitted", "expired"];
    if (terminalStatuses.includes(attempt.status)) {
      return res.status(400).json({ message: "Attempt is no longer in progress" });
    }

    const question = await CodingQuestion.findOne({ questionId, isDeleted: { $ne: true } }).lean();
    if (!question) {
      return res.status(404).json({ message: "Coding question not found" });
    }

    const lang = language || attempt.selectedCodingLanguage || "java";
    const timeLimit = question.timeLimit ? question.timeLimit * 1000 : 2000;

    const evaluation = await evaluateCodingQuestion(
      String(code),
      lang,
      question.testCases || [],
      timeLimit
    );

    // Persist result on the attempt (upsert by questionId).
    const existingIndex = attempt.codingAnswers.findIndex((a) => a.questionId === questionId);
    const entry = {
      questionId,
      language: lang,
      code: String(code),
      status: evaluation.status,
      passedCount: evaluation.passedCount,
      totalCount: evaluation.totalCount,
      results: evaluation.results || [],
      timeTakenMs: evaluation.executionTime || 0,
      submittedAt: new Date(),
    };
    if (existingIndex >= 0) {
      attempt.codingAnswers[existingIndex] = {
        ...attempt.codingAnswers[existingIndex],
        ...entry,
      };
    } else {
      attempt.codingAnswers.push(entry);
    }

    // Also keep the latest selected language in sync.
    attempt.selectedCodingLanguage = lang;
    await attempt.save();

    // Sanitized execution log (PART 19) — never logs code content or secrets.
    console.log(
      `[CompanyMock CodingSubmit] lang=${lang} question=${questionId} status=${evaluation.status} passed=${evaluation.passedCount}/${evaluation.totalCount} timeMs=${evaluation.executionTime || 0}`
    );

    res.json({
      status: evaluation.status,
      passedCount: evaluation.passedCount,
      totalCount: evaluation.totalCount,
      results: evaluation.results || [],
      compileOutput: evaluation.status === "compile_error" ? "(see results)" : "",
    });
  } catch (error) {
    console.error("Submit Coding Answer Error:", error.message);
    res.status(500).json({ message: "Failed to evaluate coding answer" });
  }
};

/**
 * GET /api/company-mock/attempt/:attemptId
 * Get detailed attempt result.
 */
export const getAttemptResult = async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId } = req.params;

    const attempt = await CompanyMockAttempt.findOne({ _id: attemptId, userId }).lean();
    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    res.json({ attempt });
  } catch (error) {
    console.error("Get Attempt Result Error:", error.message);
    res.status(500).json({ message: "Failed to get attempt result" });
  }
};

/**
 * GET /api/company-mock/stats
 * Get company-specific statistics for a student.
 */
export const getCompanyMockStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { companyId } = req.query;

    const query = { userId, status: "completed" };
    if (companyId) {
      query.companyId = companyId;
    }

    const attempts = await CompanyMockAttempt.find(query)
      .select("companyId companyName scores.overall createdAt")
      .sort({ createdAt: -1 })
      .lean();

    // Group by company
    const stats = {};
    for (const attempt of attempts) {
      if (!stats[attempt.companyId]) {
        stats[attempt.companyId] = {
          companyId: attempt.companyId,
          companyName: attempt.companyName,
          totalAttempts: 0,
          avgScore: 0,
          bestScore: 0,
          scores: [],
        };
      }
      stats[attempt.companyId].totalAttempts++;
      stats[attempt.companyId].scores.push(attempt.scores.overall);
      stats[attempt.companyId].bestScore = Math.max(
        stats[attempt.companyId].bestScore,
        attempt.scores.overall
      );
    }

    // Calculate averages
    for (const key of Object.keys(stats)) {
      const s = stats[key];
      s.avgScore = s.scores.length > 0
        ? Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length)
        : 0;
      delete s.scores;
    }

    res.json({ stats: Object.values(stats) });
  } catch (error) {
    console.error("Company Mock Stats Error:", error.message);
    res.status(500).json({ message: "Failed to load stats" });
  }
};
