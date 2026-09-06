import { generateAptitudeAI } from "../realInterviewAI/aptitudeAI.js";
import RealInterviewAptitudeQuestion from "../../models/RealInterviewAptitudeQuestion.js";
import RealInterviewAptitudeSession from "../../models/RealInterviewAptitudeSession.js";
import { withInFlightLock } from "./inFlightLock.js";
import {
  getUserQuestionHistorySet,
  recordUserQuestionHistory,
  filterUniqueQuestions,
} from "./questionHistoryService.js";

/**
 * Validates, persists, and formats Real Interview Aptitude Questions.
 * Assigns maxMarks: Easy = 2, Medium = 3, Hard = 5 (Total = 50 Marks).
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
          source: doc.source || "AI_PROVIDER",
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

    let rawQuestions = [];
    const userHistorySet = await getUserQuestionHistorySet(userId);

    const requestId = `apt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const modelName = process.env.REAL_INTERVIEW_APTITUDE_MODEL || "openai/gpt-oss-20b";
    const hasKey = Boolean(process.env.REAL_INTERVIEW_APTITUDE_API_KEY?.trim());

    console.log(`\n[AI-REQUEST-START]\nround=aptitude\nprovider=groq\nmodel=${modelName}\nkeyPresent=${hasKey}\nrequestId=${requestId}`);

    try {
      const aiResult = await generateAptitudeAI();
      if (aiResult && Array.isArray(aiResult.questions) && aiResult.questions.length >= 15) {
        rawQuestions = filterUniqueQuestions(aiResult.questions, userHistorySet);
        if (rawQuestions.length < 15) {
          // If historical filter removed too many, take original AI output
          rawQuestions = aiResult.questions.slice(0, 15);
        }
      } else {
        throw new Error(`Aptitude AI returned ${aiResult?.questions?.length || 0} questions (expected 15)`);
      }
    } catch (err) {
      console.error(`\n[AI-REQUEST-FAILED]\nround=aptitude\nprovider=groq\nrequestId=${requestId}\nerror=${err.message}`);
      throw new Error(`Aptitude AI generation failed: ${err.message}`);
    }

    if (rawQuestions.length < 15) {
      console.error(`\n[AI-REQUEST-FAILED]\nround=aptitude\nprovider=groq\nrequestId=${requestId}\nerror=Insufficient AI questions returned (${rawQuestions.length}/15)`);
      throw new Error(`Insufficient Aptitude AI questions generated (${rawQuestions.length}/15)`);
    }

    console.log(`\n[AI-REQUEST-SUCCESS]\nround=aptitude\nprovider=groq\nrequestId=${requestId}\nquestionsReturned=${rawQuestions.length}`);

    const selectedQuestions = rawQuestions.slice(0, 15);
    const diffCounts = { easy: 0, medium: 0, hard: 0 };
    const answerCounts = { A: 0, B: 0, C: 0, D: 0 };
    const seenTexts = new Set();
    const validatedDocs = [];

    for (let idx = 0; idx < selectedQuestions.length; idx++) {
      const q = selectedQuestions[idx];

      const text = String(q.question || "").trim();
      if (!text) {
        throw new Error(`Question #${idx + 1} has empty question text`);
      }

      let normText = text.toLowerCase().replace(/\s+/g, " ").trim();
      if (seenTexts.has(normText)) {
        console.warn(`[AptitudeService] Duplicate question text detected in batch: "${text.slice(0, 40)}...". Preserving question.`);
        normText = normText + "_" + idx;
      }
      seenTexts.add(normText);

      const diff = String(q.difficulty || "").toLowerCase().trim();
      const validDiff = ["easy", "medium", "hard"].includes(diff) ? diff : "medium";
      diffCounts[validDiff]++;

      const maxMarks = validDiff === "easy" ? 2 : validDiff === "hard" ? 5 : 3;

      let rawOpts = q.options;
      if (rawOpts && !Array.isArray(rawOpts) && typeof rawOpts === "object") {
        const keys = Object.keys(rawOpts);
        if (keys.length === 4) {
          rawOpts = keys.map((k, i) => ({
            label: ["A", "B", "C", "D"][i],
            text: String(rawOpts[k])
          }));
        }
      }

      if (!Array.isArray(rawOpts) || rawOpts.length !== 4) {
        throw new Error(`Question #${idx + 1} must have exactly 4 options`);
      }

      const formattedOptions = rawOpts.map((opt, optIdx) => {
        const expectedLabel = ["A", "B", "C", "D"][optIdx];
        let parsedOpt = opt;
        if (typeof opt === "string" && opt.trim().startsWith("{")) {
          try {
            parsedOpt = JSON.parse(opt);
          } catch (e) {}
        }
        const optText = typeof parsedOpt === "string" ? parsedOpt.trim() : String(parsedOpt.text || parsedOpt.option || "").trim();

        if (!optText) {
          throw new Error(`Question #${idx + 1} Option ${expectedLabel} is empty`);
        }
        return { label: expectedLabel, text: optText };
      });

      const correctAns = String(q.correctAnswer || "").toUpperCase().trim();
      if (!["A", "B", "C", "D"].includes(correctAns)) {
        throw new Error(`Question #${idx + 1} has invalid correctAnswer: "${q.correctAnswer}"`);
      }
      answerCounts[correctAns]++;

      const exp = String(q.explanation || "").trim();
      if (!exp) {
        throw new Error(`Question #${idx + 1} has empty explanation`);
      }

      const topic = String(q.topic || "General Aptitude").trim();
      const questionType = String(q.questionType || "Numerical Aptitude").trim();

      validatedDocs.push({
        sessionId,
        userId,
        question: text,
        options: formattedOptions,
        correctAnswer: correctAns,
        explanation: exp,
        difficulty: validDiff,
        maxMarks,
        topic,
        questionType,
        source: "AI_PROVIDER",
      });
    }

    if (validatedDocs.length < 15) {
      throw new Error(`Aptitude AI question validation resulted in ${validatedDocs.length}/15 questions`);
    }

    console.log(`\n[QUESTION-SOURCE]\nround=aptitude\nsource=AI_PROVIDER\ncount=${validatedDocs.length}\n`);

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
      message: "15 placement-level aptitude questions generated successfully",
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
