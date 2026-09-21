import Interview from "../../models/Interview.js";
import RealInterviewResult from "../../models/RealInterviewResult.js";

import RealInterviewAptitudeQuestion from "../../models/RealInterviewAptitudeQuestion.js";
import RealInterviewAptitudeSession from "../../models/RealInterviewAptitudeSession.js";

import RealInterviewTechnicalQuestion from "../../models/RealInterviewTechnicalQuestion.js";
import RealInterviewTechnicalSession from "../../models/RealInterviewTechnicalSession.js";

import RealInterviewProjectQuestion from "../../models/RealInterviewProjectQuestion.js";
import RealInterviewProjectSession from "../../models/RealInterviewProjectSession.js";

import RealInterviewHRQuestion from "../../models/RealInterviewHRQuestion.js";
import RealInterviewHRSession from "../../models/RealInterviewHRSession.js";

import RealInterviewCodingQuestion from "../../models/RealInterviewCodingQuestion.js";
import RealInterviewCodingSession from "../../models/RealInterviewCodingSession.js";
import RealInterviewCodingSubmission from "../../models/RealInterviewCodingSubmission.js";

import { evaluateAptitudeSession } from "./aptitudeService.js";
import { evaluateTechnicalInterviewSession } from "./technicalService.js";
import { evaluateProjectInterviewSession } from "./projectService.js";
import { evaluateHRInterviewSession } from "./hrService.js";
import { evaluateCodingInterviewSession } from "./codingService.js";
import { resolveCandidateAnswer } from "./answerResolver.js";
import { getOrBuildCandidateResumeContext } from "../../utils/resumeContextBuilder.js";

/**
 * Single authoritative backend service for Real Interview result calculation.
 * Reads actual persisted interview data from MongoDB. Non-fatal for individual round/question AI failures.
 */
export async function calculateRealInterviewResult({ sessionId, userId, candidateProfile = null }) {
  if (!sessionId) {
    throw new Error("sessionId is required to calculate interview result");
  }

  // 1. Idempotency check: Return existing result if completed
  let resultDoc = await RealInterviewResult.findOne({ sessionId });
  if (resultDoc && resultDoc.status === "COMPLETED") {
    console.log(`[RealInterviewResultService] Session ${sessionId} result already COMPLETED. Reusing stored result.`);
    return resultDoc;
  }

  // 2. Fetch main Interview session if available
  let mainInterviewSession = null;
  if (Interview.db?.models?.Interview) {
    mainInterviewSession = await Interview.findOne({ _id: sessionId }).catch(() => null);
  }

  const effectiveUserId = userId || mainInterviewSession?.userId || resultDoc?.userId;
  if (!effectiveUserId) {
    throw new Error(`Cannot locate valid userId for sessionId=${sessionId}`);
  }

  const effectiveProfile = candidateProfile || (await getOrBuildCandidateResumeContext(effectiveUserId, mainInterviewSession?.candidateProfile || {}));

  // Create or update result doc to CALCULATING state
  if (!resultDoc) {
    resultDoc = await RealInterviewResult.create({
      sessionId,
      userId: effectiveUserId,
      interviewId: mainInterviewSession?._id || null,
      status: "CALCULATING",
      submittedAt: new Date(),
    });
  } else {
    resultDoc.status = "CALCULATING";
    await resultDoc.save();
  }

  if (mainInterviewSession) {
    mainInterviewSession.status = "SUBMITTED";
    await mainInterviewSession.save();
  }

  const successfulRounds = [];
  const failedRounds = [];
  const evaluationWarnings = [];

  try {
    const mainInterviewAnswers = mainInterviewSession?.answers || [];

    // Fetch questions and round session documents for precheck
    const [
      aptitudeQuestions,
      techQuestions,
      projectQuestions,
      hrQuestions,
      codingQuestions,
      aptSessionDoc,
      techSessionDoc,
      projSessionDoc,
      hrSessionDoc,
      codingSubmissions,
      codingSessionDoc,
    ] = await Promise.all([
      RealInterviewAptitudeQuestion.find({ sessionId }).lean().catch(() => []),
      RealInterviewTechnicalQuestion.find({ sessionId }).sort({ orderIndex: 1 }).lean().catch(() => []),
      RealInterviewProjectQuestion.find({ sessionId }).sort({ orderIndex: 1 }).lean().catch(() => []),
      RealInterviewHRQuestion.find({ sessionId }).sort({ orderIndex: 1 }).lean().catch(() => []),
      RealInterviewCodingQuestion.find({ sessionId }).sort({ orderIndex: 1 }).lean().catch(() => []),
      RealInterviewAptitudeSession.findOne({ sessionId }).lean().catch(() => null),
      RealInterviewTechnicalSession.findOne({ sessionId }).lean().catch(() => null),
      RealInterviewProjectSession.findOne({ sessionId }).lean().catch(() => null),
      RealInterviewHRSession.findOne({ sessionId }).lean().catch(() => null),
      RealInterviewCodingSubmission.find({ sessionId }).lean().catch(() => []),
      RealInterviewCodingSession.findOne({ sessionId }).lean().catch(() => null),
    ]);

    // =============================================================
    // 1. APTITUDE ROUND CALCULATION (Deterministic)
    // =============================================================
    let aptitudeSessionResult = { evaluations: [] };
    try {
      aptitudeSessionResult = await evaluateAptitudeSession({ sessionId });
      successfulRounds.push("aptitude");
    } catch (err) {
      console.warn(`[RESULT-EVALUATION] round=aptitude status=AI_FAILED errorCode=${err.message} fallback=LOCAL_OR_UNAVAILABLE`);
      console.log(`[RESULT-EVALUATION] round=aptitude status=CONTINUING_AFTER_FAILURE`);
      failedRounds.push("aptitude");
      evaluationWarnings.push(`Aptitude evaluation note: ${err.message}`);
    }

    const aptitudeQuestionResults = [];
    let calculatedAptitudeScore = 0;
    let aptitudeAttemptedCount = 0;

    for (const q of aptitudeQuestions) {
      const qIdStr = q._id.toString();
      const evalMatch = (aptitudeSessionResult.evaluations || []).find(
        (e) => String(e.questionId) === qIdStr
      );

      const resolved = resolveCandidateAnswer({
        roundType: "APTITUDE",
        questionId: qIdStr,
        questionText: q.question,
        options: q.options,
        roundSessionAnswers: aptSessionDoc?.answers || [],
        mainInterviewAnswers,
      });

      if (resolved.answerPresent) aptitudeAttemptedCount++;

      const correctOpt = (q.correctOption || q.answer || "").toString().trim().toUpperCase();
      const candidateAnswerText = (resolved.answer || "").toString().trim().toUpperCase();

      const isAnswered = resolved.answerPresent && candidateAnswerText !== "" && candidateAnswerText !== "NOT ANSWERED";
      const isCorrect = isAnswered && (
        candidateAnswerText === correctOpt ||
        (q.options && q.options.find(opt => opt.key?.toUpperCase() === candidateAnswerText && opt.isCorrect))
      );

      const score = isCorrect ? (q.marks || 3.33) : 0;
      const maxScore = q.marks || 3.33;

      if (isCorrect) calculatedAptitudeScore += score;

      aptitudeQuestionResults.push({
        questionId: qIdStr,
        roundType: "APTITUDE",
        question: q.question,
        candidateAnswer: candidateAnswerText,
        correctAnswer: q.explanation || `Correct option is ${correctOpt}`,
        score,
        maxScore,
        status: !isAnswered ? "NOT_ATTEMPTED" : isCorrect ? "CORRECT" : "INCORRECT",
        evaluationMode: "DETERMINISTIC",
        feedback: !isAnswered ? "Question was not attempted." : isCorrect ? "Correct answer selected." : `Incorrect choice. Selected option ${candidateAnswerText}.`,
        improvedAnswer: q.explanation || `Correct option is ${correctOpt}`,
      });
    }

    const aptitudeScoreTotal = Math.min(50, calculatedAptitudeScore);

    // =============================================================
    // 2. TECHNICAL ROUND CALCULATION (Non-Fatal)
    // =============================================================
    let techSessionResult = { evaluations: [] };
    try {
      techSessionResult = await evaluateTechnicalInterviewSession({
        sessionId,
        candidateProfile: effectiveProfile,
      });
      successfulRounds.push("technical");
    } catch (err) {
      console.warn(`[RESULT-EVALUATION] round=technical status=AI_FAILED errorCode=${err.message} fallback=LOCAL_OR_UNAVAILABLE`);
      console.log(`[RESULT-EVALUATION] round=technical status=CONTINUING_AFTER_FAILURE`);
      failedRounds.push("technical");
      evaluationWarnings.push(`Technical AI evaluation unavailable for some answers.`);
    }

    const techQuestionResults = [];
    let calculatedTechScore = 0;
    let techAttemptedCount = 0;

    for (const q of techQuestions) {
      const qIdStr = q._id.toString();
      const evalMatch = (techSessionResult.evaluations || []).find(
        (e) => String(e.questionId) === qIdStr
      );

      const resolved = resolveCandidateAnswer({
        roundType: "TECHNICAL",
        questionId: qIdStr,
        questionText: q.question,
        roundSessionAnswers: techSessionDoc?.answers || [],
        mainInterviewAnswers,
      });

      if (resolved.answerPresent) techAttemptedCount++;

      const maxScore = q.maxMarks || (q.difficulty === "easy" ? 3 : q.difficulty === "hard" ? 13 : 5);
      let score = 0;
      let qStatus = "NOT_ATTEMPTED";
      const isFallback = techSessionResult.isFallback || evalMatch?.evaluationSource === "deterministic_fallback" || evalMatch?.evaluationSource === "deterministic_nlp";

      if (resolved.answerPresent) {
        const rawScore = Number(evalMatch?.score);
        score = isNaN(rawScore) ? 0 : Math.max(0, Math.min(maxScore, Math.round(rawScore)));
        qStatus = score >= maxScore * 0.8 ? "CORRECT" : score >= maxScore * 0.4 ? "PARTIALLY_CORRECT" : "INCORRECT";
        if (isFallback) qStatus = score > 0 ? "PARTIALLY_CORRECT" : "INCORRECT";
      }

      calculatedTechScore += score;

      techQuestionResults.push({
        questionId: qIdStr,
        roundType: "TECHNICAL",
        question: q.question,
        candidateAnswer: resolved.answerPresent ? resolved.answer : "Not Answered",
        correctAnswer: q.expectedKnowledge || "Comprehensive technical explanation covering core concepts.",
        score,
        maxScore,
        status: !resolved.answerPresent ? "NOT_ATTEMPTED" : qStatus,
        evaluationMode: isFallback ? "FALLBACK" : "AI",
        feedback: !resolved.answerPresent ? "Question was not attempted." : (evalMatch?.feedback || "Evaluation complete."),
        improvedAnswer: !resolved.answerPresent ? (q.expectedKnowledge || "") : (evalMatch?.betterAnswer || ""),
      });
    }

    const techScoreTotal = Math.min(100, calculatedTechScore);

    // =============================================================
    // 3. PROJECT ROUND CALCULATION (Non-Fatal)
    // =============================================================
    let projectSessionResult = { evaluations: [] };
    try {
      projectSessionResult = await evaluateProjectInterviewSession({
        sessionId,
        candidateProfile: effectiveProfile,
      });
      successfulRounds.push("project");
    } catch (err) {
      console.warn(`[RESULT-EVALUATION] round=project status=AI_FAILED errorCode=${err.message} fallback=LOCAL_OR_UNAVAILABLE`);
      console.log(`[RESULT-EVALUATION] round=project status=CONTINUING_AFTER_FAILURE`);
      failedRounds.push("project");
      evaluationWarnings.push(`Project AI evaluation unavailable for some answers.`);
    }

    const projectQuestionResults = [];
    let calculatedProjectScore = 0;
    let projectAttemptedCount = 0;

    for (const q of projectQuestions) {
      const qIdStr = q._id.toString();
      const evalMatch = (projectSessionResult.evaluations || []).find(
        (e) => String(e.questionId) === qIdStr
      );

      const resolved = resolveCandidateAnswer({
        roundType: "RESUME_PROJECT",
        questionId: qIdStr,
        questionText: q.question,
        roundSessionAnswers: projSessionDoc?.answers || [],
        mainInterviewAnswers,
      });

      if (resolved.answerPresent) projectAttemptedCount++;

      const maxScore = q.maxMarks || (q.difficulty === "easy" ? 5 : q.difficulty === "hard" ? 20 : 10);
      let score = 0;
      let qStatus = "NOT_ATTEMPTED";
      const isFallback = projectSessionResult.isFallback || evalMatch?.evaluationSource === "deterministic_fallback" || evalMatch?.evaluationSource === "deterministic_nlp";

      if (resolved.answerPresent) {
        const rawScore = Number(evalMatch?.score);
        score = isNaN(rawScore) ? 0 : Math.max(0, Math.min(maxScore, Math.round(rawScore)));
        qStatus = score >= maxScore * 0.8 ? "CORRECT" : score >= maxScore * 0.4 ? "PARTIALLY_CORRECT" : "INCORRECT";
        if (isFallback) qStatus = score > 0 ? "PARTIALLY_CORRECT" : "INCORRECT";
      }

      calculatedProjectScore += score;

      projectQuestionResults.push({
        questionId: qIdStr,
        roundType: "RESUME_PROJECT",
        question: q.question,
        candidateAnswer: resolved.answerPresent ? resolved.answer : "Not Answered",
        correctAnswer: q.expectedKnowledge || "Detailed project architectural explanation grounded in resume evidence.",
        score,
        maxScore,
        status: !resolved.answerPresent ? "NOT_ATTEMPTED" : qStatus,
        evaluationMode: isFallback ? "FALLBACK" : "AI",
        feedback: !resolved.answerPresent ? "Question was not attempted." : (evalMatch?.feedback || "Evaluation complete."),
        improvedAnswer: !resolved.answerPresent ? (q.expectedKnowledge || "") : (evalMatch?.betterAnswer || ""),
      });
    }

    const projectScoreTotal = Math.min(100, calculatedProjectScore);

    // =============================================================
    // 4. HR ROUND CALCULATION (Non-Fatal)
    // =============================================================
    let hrSessionResult = { evaluations: [] };
    try {
      hrSessionResult = await evaluateHRInterviewSession({
        sessionId,
        candidateProfile: effectiveProfile,
      });
      successfulRounds.push("hr");
    } catch (err) {
      console.warn(`[RESULT-EVALUATION] round=hr status=AI_FAILED errorCode=${err.message} fallback=LOCAL_OR_UNAVAILABLE`);
      console.log(`[RESULT-EVALUATION] round=hr status=CONTINUING_AFTER_FAILURE`);
      failedRounds.push("hr");
      evaluationWarnings.push(`HR AI evaluation unavailable for some answers.`);
    }

    const hrQuestionResults = [];
    let calculatedHRScore = 0;
    let hrAttemptedCount = 0;

    for (const q of hrQuestions) {
      const qIdStr = q._id.toString();
      const evalMatch = (hrSessionResult.evaluations || []).find(
        (e) => String(e.questionId) === qIdStr
      );

      const resolved = resolveCandidateAnswer({
        roundType: "HR",
        questionId: qIdStr,
        questionText: q.question,
        roundSessionAnswers: hrSessionDoc?.answers || [],
        mainInterviewAnswers,
      });

      if (resolved.answerPresent) hrAttemptedCount++;

      const maxScore = q.maxMarks || 20;
      let score = 0;
      let qStatus = "NOT_ATTEMPTED";
      const isFallback = hrSessionResult.fallbackUsed || evalMatch?.evaluationSource === "deterministic_fallback" || evalMatch?.evaluationSource === "deterministic_nlp";

      if (resolved.answerPresent) {
        const rawScore = Number(evalMatch?.score);
        score = isNaN(rawScore) ? 0 : Math.max(0, Math.min(maxScore, Math.round(rawScore)));
        qStatus = score >= maxScore * 0.8 ? "CORRECT" : score >= maxScore * 0.4 ? "PARTIALLY_CORRECT" : "INCORRECT";
        if (isFallback) qStatus = score > 0 ? "PARTIALLY_CORRECT" : "INCORRECT";
      }

      calculatedHRScore += score;

      hrQuestionResults.push({
        questionId: qIdStr,
        roundType: "HR",
        question: q.question,
        candidateAnswer: resolved.answerPresent ? resolved.answer : "Not Answered",
        correctAnswer: q.expectedKnowledge || "Strong behavioral response with STAR framework structure.",
        score,
        maxScore,
        status: !resolved.answerPresent ? "NOT_ATTEMPTED" : qStatus,
        evaluationMode: isFallback ? "FALLBACK" : "AI",
        feedback: !resolved.answerPresent ? "Question was not attempted." : (evalMatch?.feedback || "Evaluation complete."),
        improvedAnswer: !resolved.answerPresent ? (q.expectedKnowledge || "") : (evalMatch?.betterAnswer || ""),
      });
    }

    const hrScoreTotal = Math.min(60, calculatedHRScore);

    // =============================================================
    // 5. CODING ROUND CALCULATION (Non-Fatal, Judge0 Results)
    // =============================================================
    let codingSessionResult = { evaluations: [] };
    try {
      codingSessionResult = await evaluateCodingInterviewSession({ sessionId });
      successfulRounds.push("coding");
    } catch (err) {
      console.warn(`[RESULT-EVALUATION] round=coding status=AI_FAILED errorCode=${err.message} fallback=LOCAL_OR_UNAVAILABLE`);
      console.log(`[RESULT-EVALUATION] round=coding status=CONTINUING_AFTER_FAILURE`);
      failedRounds.push("coding");
      evaluationWarnings.push(`Coding evaluation note: ${err.message}`);
    }

    const codingQuestionResults = [];
    let calculatedCodingScore = 0;
    let codingAttemptedCount = 0;

    for (const q of codingQuestions) {
      const qIdStr = q._id.toString();
      const evalMatch = (codingSessionResult.evaluations || []).find(
        (e) => String(e.questionId) === qIdStr
      );

      const resolved = resolveCandidateAnswer({
        roundType: "CODING",
        questionId: qIdStr,
        questionText: q.title || q.question || q.description,
        roundSessionAnswers: codingSubmissions.length > 0 ? codingSubmissions : codingSessionDoc?.answers || [],
        mainInterviewAnswers,
      });

      if (resolved.answerPresent) codingAttemptedCount++;

      const sourceCode = resolved.answerPresent ? resolved.answer : "";
      const maxScore = q.marks || (q.difficulty === "easy" ? 20 : q.difficulty === "hard" ? 50 : 30);
      let score = 0;
      let qStatus = "NOT_ATTEMPTED";

      if (resolved.answerPresent) {
        const rawScore = Number(evalMatch?.score);
        score = isNaN(rawScore) ? 0 : Math.max(0, Math.min(maxScore, Math.round(rawScore)));
        qStatus = evalMatch?.passedTests === evalMatch?.totalTests && evalMatch?.totalTests > 0
          ? "CORRECT"
          : score > 0 ? "PARTIALLY_CORRECT" : "INCORRECT";
      }

      calculatedCodingScore += score;

      codingQuestionResults.push({
        questionId: qIdStr,
        roundType: "CODING",
        question: q.title || q.description || "Coding Problem",
        candidateAnswer: resolved.answerPresent ? sourceCode : "Not Submitted",
        correctAnswer: q.solutionExplanation || "Optimal reference solution and clean algorithmic logic.",
        score,
        maxScore,
        status: !resolved.answerPresent ? "NOT_ATTEMPTED" : qStatus,
        evaluationMode: "JUDGE0",
        feedback: !resolved.answerPresent
          ? "No code was submitted for this problem."
          : `Execution result: ${evalMatch?.executionStatus || "Evaluated"}. Passed ${evalMatch?.passedTests || 0}/${evalMatch?.totalTests || 0} test cases.`,
        improvedAnswer: q.solutionExplanation || "Review reference solution for time and space optimization.",
      });
    }

    const codingScoreTotal = Math.min(100, calculatedCodingScore);

    // =============================================================
    // 6. AGGREGATE TOTAL & RESULT STATUS
    // =============================================================
    const overallTotalObtained = Math.min(
      410,
      aptitudeScoreTotal + techScoreTotal + projectScoreTotal + hrScoreTotal + codingScoreTotal
    );

    const percentage = Number(((overallTotalObtained / 410) * 100).toFixed(2));

    const attemptedQuestionsCount = aptitudeAttemptedCount + techAttemptedCount + projectAttemptedCount + hrAttemptedCount + codingAttemptedCount;
    const totalQuestionsCount = 41;
    const unattemptedQuestionsCount = Math.max(0, totalQuestionsCount - attemptedQuestionsCount);

    const allQuestionResults = [
      ...aptitudeQuestionResults,
      ...techQuestionResults,
      ...projectQuestionResults,
      ...hrQuestionResults,
      ...codingQuestionResults,
    ];

    let resultStatus = "COMPLETE";
    if (failedRounds.length === 5) {
      resultStatus = "EVALUATION_UNAVAILABLE";
    } else if (failedRounds.length > 0) {
      resultStatus = "PARTIAL_EVALUATION";
    }

    console.log(`\n[RESULT-AGGREGATION]\nstatus=${resultStatus}\nfailedRounds=${failedRounds.join(",") || "none"}\nsuccessfulRounds=${successfulRounds.join(",") || "none"}\n`);

    // =============================================================
    // 7. PERSIST AUTHORITATIVE RESULT DOCUMENT
    // =============================================================
    resultDoc.rounds = {
      aptitude: {
        obtained: aptitudeScoreTotal,
        maximum: 50,
        attempted: aptitudeAttemptedCount,
        totalQuestions: 15,
      },
      technical: {
        obtained: techScoreTotal,
        maximum: 100,
        attempted: techAttemptedCount,
        totalQuestions: 15,
      },
      project: {
        obtained: projectScoreTotal,
        maximum: 100,
        attempted: projectAttemptedCount,
        totalQuestions: 5,
      },
      hr: {
        obtained: hrScoreTotal,
        maximum: 60,
        attempted: hrAttemptedCount,
        totalQuestions: 3,
      },
      coding: {
        obtained: codingScoreTotal,
        maximum: 100,
        attempted: codingAttemptedCount,
        totalQuestions: 3,
      },
    };

    resultDoc.totalObtained = overallTotalObtained;
    resultDoc.maximumMarks = 410;
    resultDoc.percentage = percentage;

    resultDoc.attemptedQuestionsCount = attemptedQuestionsCount;
    resultDoc.unattemptedQuestionsCount = unattemptedQuestionsCount;
    resultDoc.totalQuestionsCount = totalQuestionsCount;

    resultDoc.questionResults = allQuestionResults;
    resultDoc.resultStatus = resultStatus;
    resultDoc.evaluationWarnings = evaluationWarnings;

    resultDoc.status = "COMPLETED";
    resultDoc.completedAt = new Date();
    await resultDoc.save();

    if (mainInterviewSession) {
      mainInterviewSession.status = "completed";
      mainInterviewSession.completedAt = new Date();
      mainInterviewSession.overallScore = percentage;
      await mainInterviewSession.save();
    }

    console.log(`[RealInterviewResultService] Session ${sessionId} RESULT CALCULATED & PERSISTED! Score: ${overallTotalObtained}/450 (${percentage}%). ResultStatus: ${resultStatus}.`);
    return resultDoc;
  } catch (error) {
    console.error(`[RealInterviewResultService] Unrecoverable calculation ERROR for session ${sessionId}:`, error.message);
    resultDoc.status = "COMPLETED";
    resultDoc.resultStatus = "EVALUATION_UNAVAILABLE";
    resultDoc.errorDetails = error.message || "Partial evaluation unavailable";
    await resultDoc.save().catch(() => {});

    if (mainInterviewSession) {
      mainInterviewSession.status = "completed";
      await mainInterviewSession.save().catch(() => {});
    }

    return resultDoc;
  }
}

/**
 * Gets stored authoritative result for sessionId.
 */
export async function getRealInterviewResult(sessionId) {
  if (!sessionId) return null;
  return await RealInterviewResult.findOne({ sessionId }).lean();
}
