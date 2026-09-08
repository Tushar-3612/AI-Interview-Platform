import RealInterviewAptitudeQuestion from "../../models/RealInterviewAptitudeQuestion.js";
import RealInterviewAptitudeSession from "../../models/RealInterviewAptitudeSession.js";
import { loadAptitudeBank, getBank } from "../questionBank.js";
import { withInFlightLock } from "./inFlightLock.js";
import {
  getUserQuestionHistorySet,
  recordUserQuestionHistory,
  normalizeQuestionText,
  isDuplicateQuestion,
} from "./questionHistoryService.js";

function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function inferQuestionType(q) {
  if (q.questionType && typeof q.questionType === "string") {
    return q.questionType.trim();
  }
  const qId = String(q.questionId || q.id || "").toUpperCase();
  const cat = String(q.category || q.topic || "").toLowerCase();
  if (
    qId.startsWith("LRG") ||
    qId.startsWith("PZL") ||
    cat.includes("logical") ||
    cat.includes("relation") ||
    cat.includes("coding") ||
    cat.includes("puzzle") ||
    cat.includes("direction") ||
    cat.includes("series")
  ) {
    return "Logical Reasoning";
  }
  if (
    qId.startsWith("DIT") ||
    cat.includes("data") ||
    cat.includes("interpretation") ||
    cat.includes("table") ||
    cat.includes("chart") ||
    cat.includes("graph")
  ) {
    return "Data Interpretation";
  }
  if (
    qId.startsWith("VRB") ||
    cat.includes("verbal") ||
    cat.includes("grammar") ||
    cat.includes("reading") ||
    cat.includes("vocab")
  ) {
    return "Verbal Reasoning";
  }
  return "Numerical Aptitude";
}

/**
 * Loads and validates local Aptitude JSON question bank as source of truth.
 */
function getLocalAptitudeBankPool() {
  let bank = getBank();
  if (!bank || bank.length === 0) {
    loadAptitudeBank();
    bank = getBank();
  }

  const validPool = [];
  for (const item of bank) {
    const text = String(item.question || "").trim();
    if (!text) continue;

    let rawOpts = item.options;
    let formattedOptions = [];
    if (Array.isArray(rawOpts) && rawOpts.length === 4) {
      formattedOptions = rawOpts.map((opt, optIdx) => {
        const expectedLabel = ["A", "B", "C", "D"][optIdx];
        let optText = "";
        if (typeof opt === "string") {
          optText = opt.trim();
        } else if (opt && typeof opt === "object") {
          optText = String(opt.text || opt.option || "").trim();
        }
        return { label: expectedLabel, text: optText };
      });
    }

    if (formattedOptions.length !== 4 || formattedOptions.some((o) => !o.text)) {
      continue;
    }

    let correctAns = "";
    const rawAns = String(item.correctAnswer || item.answer || "").trim();
    if (["A", "B", "C", "D"].includes(rawAns.toUpperCase())) {
      correctAns = rawAns.toUpperCase();
    } else if (rawAns) {
      const lowerAns = rawAns.toLowerCase();
      for (const opt of formattedOptions) {
        if (opt.text.toLowerCase() === lowerAns) {
          correctAns = opt.label;
          break;
        }
      }
    }

    if (!correctAns || !["A", "B", "C", "D"].includes(correctAns)) {
      continue;
    }

    const exp = String(item.explanation || "").trim();
    if (!exp) continue;

    const diff = String(item.difficulty || "").toLowerCase().trim();
    const validDiff = ["easy", "medium", "hard"].includes(diff) ? diff : "medium";
    const maxMarks = validDiff === "easy" ? 2 : validDiff === "hard" ? 5 : 3;

    validPool.push({
      questionId: String(item.questionId || item.id || `aq_${validPool.length + 1}`),
      question: text,
      options: formattedOptions,
      correctAnswer: correctAns,
      explanation: exp,
      difficulty: validDiff,
      maxMarks,
      topic: String(item.topic || item.category || "General Aptitude").trim(),
      questionType: inferQuestionType(item),
    });
  }

  return validPool;
}

/**
 * Validates, persists, and formats Real Interview Aptitude Questions from local JSON bank.
 * Assigns maxMarks: Easy = 2, Medium = 3, Hard = 5 (Exactly 5 Easy, 5 Medium, 5 Hard, Total = 50 Marks).
 * ZERO AI CALLS.
 */
export async function generateAndProcessAptitudeQuestions({ userId = null, sessionId = null } = {}) {
  const lockKey = `aptitude:${sessionId || "global"}`;
  return withInFlightLock(lockKey, async () => {
    // Check if questions already generated for this session
    if (sessionId) {
      const existing = await RealInterviewAptitudeQuestion.find({ sessionId });
      if (existing.length >= 15) {
        console.log(`[AptitudeService] Session ${sessionId} already has 15 aptitude questions. Reusing existing.`);
        const studentQuestions = existing.map((doc) => ({
          id: doc._id.toString(),
          question: doc.question,
          options: doc.options.map((o) => ({ label: o.label, text: o.text })),
          difficulty: doc.difficulty,
          maxMarks: doc.maxMarks || (doc.difficulty === "easy" ? 2 : doc.difficulty === "hard" ? 5 : 3),
          topic: doc.topic,
          questionType: doc.questionType,
          source: doc.source || "local_json_bank",
        }));
        return {
          success: true,
          message: "Reused existing 15 aptitude questions",
          count: studentQuestions.length,
          questions: studentQuestions,
          reused: true,
        };
      }
    }

    const userHistorySet = await getUserQuestionHistorySet(userId);
    const pool = getLocalAptitudeBankPool();

    // Partition pool by difficulty
    const easyCandidates = pool.filter((q) => q.difficulty === "easy");
    const mediumCandidates = pool.filter((q) => q.difficulty === "medium");
    const hardCandidates = pool.filter((q) => q.difficulty === "hard");

    const currentSessionPoolSet = new Set();

    const selectForDifficulty = (candidates, count, diffLabel) => {
      // 1. First preference: fresh questions candidate has NOT seen in past history
      const freshCandidates = candidates.filter(
        (q) => !isDuplicateQuestion(q.question, userHistorySet, currentSessionPoolSet)
      );

      let selected = [];
      if (freshCandidates.length >= count) {
        selected = shuffleArray(freshCandidates).slice(0, count);
      } else {
        // Fallback: candidate has seen many questions in past history.
        // Still enforce strict uniqueness within currentSessionPoolSet!
        const shuffled = shuffleArray(candidates);
        for (const q of shuffled) {
          if (!isDuplicateQuestion(q.question, new Set(), currentSessionPoolSet)) {
            selected.push(q);
            const norm = normalizeQuestionText(q.question);
            if (norm) currentSessionPoolSet.add(norm);
            if (selected.length === count) break;
          }
        }
      }

      if (selected.length < count) {
        throw new Error(
          `Failed to select ${count} valid '${diffLabel}' questions from local JSON bank (found ${selected.length}/${count})`
        );
      }

      // Add selected questions to currentSessionPoolSet if not already added
      for (const q of selected) {
        const norm = normalizeQuestionText(q.question);
        if (norm) currentSessionPoolSet.add(norm);
      }

      return selected;
    };

    const selectedEasy = selectForDifficulty(easyCandidates, 5, "easy");
    const selectedMedium = selectForDifficulty(mediumCandidates, 5, "medium");
    const selectedHard = selectForDifficulty(hardCandidates, 5, "hard");

    const selectedQuestions = [...selectedEasy, ...selectedMedium, ...selectedHard];

    // Final verification of 15 questions and difficulty breakdown
    const diffCounts = { easy: 0, medium: 0, hard: 0 };
    const answerCounts = { A: 0, B: 0, C: 0, D: 0 };
    const finalSeenSet = new Set();
    const validatedDocs = [];

    for (const q of selectedQuestions) {
      const normText = normalizeQuestionText(q.question);
      if (finalSeenSet.has(normText)) {
        throw new Error(`Duplicate question detected in selected batch: "${q.question}"`);
      }
      finalSeenSet.add(normText);

      diffCounts[q.difficulty]++;
      answerCounts[q.correctAnswer]++;

      validatedDocs.push({
        sessionId,
        userId,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        maxMarks: q.maxMarks,
        topic: q.topic,
        questionType: q.questionType,
        source: "local_json_bank",
      });
    }

    if (validatedDocs.length !== 15) {
      throw new Error(`Failed to select exactly 15 Aptitude questions from local bank (selected ${validatedDocs.length})`);
    }

    console.log(`\n[QUESTION-SOURCE]\nround=aptitude\nsource=local_json_bank\ncount=${validatedDocs.length}\ndistribution=easy:${diffCounts.easy},medium:${diffCounts.medium},hard:${diffCounts.hard}\n`);

    const savedDocs = await RealInterviewAptitudeQuestion.insertMany(validatedDocs);
    if (userId && sessionId) {
      await recordUserQuestionHistory({ userId, sessionId, round: "aptitude", questions: savedDocs });
    }

    // STRIP correctAnswer & explanation from active interview candidate response
    const studentQuestions = savedDocs.map((doc) => ({
      id: doc._id.toString(),
      question: doc.question,
      options: doc.options.map((o) => ({ label: o.label, text: o.text })),
      difficulty: doc.difficulty,
      maxMarks: doc.maxMarks,
      topic: doc.topic,
      questionType: doc.questionType,
    }));

    return {
      success: true,
      message: "15 placement-level aptitude questions selected from local JSON bank successfully",
      count: studentQuestions.length,
      distribution: diffCounts,
      answerDistribution: answerCounts,
      questions: studentQuestions,
      reused: false,
    };
  });
}

/**
 * Robust option letter resolver for Aptitude questions.
 * Handles "Option B: 30", "Option B", "B", "30", "b", etc.
 */
function resolveAptitudeOptionLetter(rawAns, options = []) {
  if (!rawAns || typeof rawAns !== "string") return "";
  const trimmed = rawAns.trim();
  if (!trimmed) return "";

  const upper = trimmed.toUpperCase();

  // 1. Direct match on A, B, C, D
  if (["A", "B", "C", "D"].includes(upper)) {
    return upper;
  }

  // 2. Starts with OPTION A, OPTION B, OPTION C, OPTION D or A:, B:, C:, D:
  const match = upper.match(/^(?:OPTION\s+)?([A-D])(?:\b|:|\s)/);
  if (match && ["A", "B", "C", "D"].includes(match[1])) {
    return match[1];
  }

  // 3. Match text against options array
  const lower = trimmed.toLowerCase();
  for (const o of options) {
    const label = String(o.label || "").toUpperCase().trim();
    const text = String(o.text || "").toLowerCase().trim();
    if (!label) continue;

    if (
      lower === text ||
      lower === `option ${label.toLowerCase()}: ${text}` ||
      lower === `option ${label.toLowerCase()}` ||
      lower === `${label.toLowerCase()}: ${text}`
    ) {
      return label;
    }
  }

  // 4. Pure option text fallback match
  for (const o of options) {
    const label = String(o.label || "").toUpperCase().trim();
    const text = String(o.text || "").toLowerCase().trim();
    if (text && text === lower) {
      return label;
    }
  }

  return "";
}

/**
 * Deterministically evaluates candidate's Aptitude round (ZERO AI CALLS).
 * Easy = 2 marks, Medium = 3 marks, Hard = 5 marks. Total Max Score = 50.
 */
export async function evaluateAptitudeSession({ sessionId, candidateAnswers = [], userId = null }) {
  if (!sessionId) {
    throw new Error("sessionId is required for aptitude evaluation");
  }

  let session = await RealInterviewAptitudeSession.findOne({ sessionId });
  if (session && session.evaluationCompleted) {
    console.log(`[AptitudeService] Session ${sessionId} already evaluated. Reusing stored result.`);
    return {
      success: true,
      message: "Reused existing aptitude evaluation result",
      sessionId,
      totalScore: session.totalScore,
      maxScore: session.maxScore || 50,
      percentage: session.percentage,
      overallRating: session.overallRating,
      answers: session.answers,
      reused: true,
    };
  }

  const questions = await RealInterviewAptitudeQuestion.find({ sessionId });
  if (questions.length === 0) {
    throw new Error("No aptitude questions found for evaluation in this session");
  }

  let calculatedTotalScore = 0;
  const maxScoreTotal = 50;
  const processedAnswers = [];

  for (const q of questions) {
    const qIdStr = q._id.toString();
    const subAns = candidateAnswers.find(
      (a) => String(a.questionId || a.id) === qIdStr
    );

    const rawAns = String(subAns?.selectedOption || subAns?.answer || "").trim();
    const resolvedOption = resolveAptitudeOptionLetter(rawAns, q.options || []);

    const isCorrect = Boolean(resolvedOption) && resolvedOption === q.correctAnswer;
    const maxMarks = q.maxMarks || (q.difficulty === "easy" ? 2 : q.difficulty === "hard" ? 5 : 3);
    const score = isCorrect ? maxMarks : 0;

    calculatedTotalScore += score;

    processedAnswers.push({
      questionId: q._id,
      question: q.question,
      selectedOption: resolvedOption || "", // Must be strictly A, B, C, D, or "" to satisfy Mongoose enum
      correctAnswer: q.correctAnswer,
      isCorrect,
      score,
      maxMarks,
      difficulty: q.difficulty,
      explanation: q.explanation,
    });
  }

  const percentage = Math.round((calculatedTotalScore / maxScoreTotal) * 100);

  let overallRating = "Weak";
  if (percentage >= 90) overallRating = "Excellent";
  else if (percentage >= 80) overallRating = "Very Strong";
  else if (percentage >= 70) overallRating = "Strong";
  else if (percentage >= 60) overallRating = "Good";
  else if (percentage >= 50) overallRating = "Average";
  else if (percentage >= 40) overallRating = "Needs Improvement";

  if (!session) {
    session = await RealInterviewAptitudeSession.create({
      sessionId,
      userId,
      answers: processedAnswers,
      questionsAnswered: processedAnswers.filter((a) => a.selectedOption !== "").length,
      status: "completed",
      totalScore: calculatedTotalScore,
      maxScore: maxScoreTotal,
      percentage,
      overallRating,
      evaluationCompleted: true,
      evaluatedAt: new Date(),
    });
  } else {
    session.answers = processedAnswers;
    session.questionsAnswered = processedAnswers.filter((a) => a.selectedOption !== "").length;
    session.status = "completed";
    session.totalScore = calculatedTotalScore;
    session.maxScore = maxScoreTotal;
    session.percentage = percentage;
    session.overallRating = overallRating;
    session.evaluationCompleted = true;
    session.evaluatedAt = new Date();
    await session.save();
  }

  return {
    success: true,
    message: "Aptitude round evaluated deterministically in 0 AI calls",
    sessionId,
    totalScore: session.totalScore,
    maxScore: session.maxScore,
    percentage: session.percentage,
    overallRating: session.overallRating,
    answers: session.answers,
    reused: false,
  };
}
