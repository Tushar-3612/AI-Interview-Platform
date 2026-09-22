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

import { evaluateAptitudeSession, resolveAptitudeOptionLetter } from "./aptitudeService.js";
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
      aptitudeSessionResult = await evaluateAptitudeSession({
        sessionId,
        candidateAnswers: aptSessionDoc?.answers || mainInterviewAnswers,
        userId: effectiveUserId,
      });
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
      const resolved = resolveCandidateAnswer({
        roundType: "APTITUDE",
        questionId: qIdStr,
        questionText: q.question,
        options: q.options,
        roundSessionAnswers: aptSessionDoc?.answers || [],
        mainInterviewAnswers,
      });

      if (resolved.answerPresent) aptitudeAttemptedCount++;

      const correctOpt = String(q.correctAnswer || "").trim().toUpperCase();
      let candidateSelectedOpt = String(resolved.selectedOption || "").trim().toUpperCase();
      if (!candidateSelectedOpt && resolved.answerPresent) {
        candidateSelectedOpt = resolveAptitudeOptionLetter(resolved.answer, q.options || []);
      }

      const isAnswered = resolved.answerPresent && candidateSelectedOpt !== "" && candidateSelectedOpt !== "NOT ANSWERED";
      const isCorrect = isAnswered && candidateSelectedOpt === correctOpt;

      const maxScore = q.maxMarks || (q.difficulty === "easy" ? 2 : q.difficulty === "hard" ? 5 : 3);
      const score = isCorrect ? maxScore : 0;

      if (isCorrect) calculatedAptitudeScore += score;

      aptitudeQuestionResults.push({
        questionId: qIdStr,
        roundType: "APTITUDE",
        question: q.question,
        candidateAnswer: isAnswered ? (resolved.answer || `Option ${candidateSelectedOpt}`) : "Not Answered",
        correctAnswer: q.explanation || `Correct option is Option ${correctOpt}`,
        score,
        maxScore,
        status: !isAnswered ? "NOT_ATTEMPTED" : isCorrect ? "CORRECT" : "INCORRECT",
        evaluationMode: "DETERMINISTIC",
        feedback: !isAnswered
          ? "Question was not attempted."
          : isCorrect
          ? `Correct answer selected (Option ${correctOpt}).`
          : `Incorrect choice. Selected Option ${candidateSelectedOpt || "unknown"}, correct option is Option ${correctOpt}.`,
        improvedAnswer: q.explanation || `Correct option is Option ${correctOpt}`,
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
        qStatus = score >= maxScore * 0.8 ? "CORRECT" : score >= maxScore * 0.4 ? "PARTIALLY_CORRECT" : score > 0 ? "PARTIALLY_CORRECT" : "INCORRECT";
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
        qStatus = score >= maxScore * 0.8 ? "CORRECT" : score >= maxScore * 0.4 ? "PARTIALLY_CORRECT" : score > 0 ? "PARTIALLY_CORRECT" : "INCORRECT";
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

    const projectQuestionsMaxSum = projectQuestions.reduce(
      (sum, q) => sum + (q.maxMarks || (q.difficulty === "easy" ? 5 : q.difficulty === "hard" ? 20 : 10)),
      0
    ) || 50;

    // Normalize question marks sum (e.g. 50) to the 100-mark round max so no candidate is capped at 50
    const projectScoreTotal = projectQuestionsMaxSum > 0
      ? Math.min(100, Math.round((calculatedProjectScore / projectQuestionsMaxSum) * 100))
      : Math.min(100, calculatedProjectScore);

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
        qStatus = score >= maxScore * 0.8 ? "CORRECT" : score >= maxScore * 0.4 ? "PARTIALLY_CORRECT" : score > 0 ? "PARTIALLY_CORRECT" : "INCORRECT";
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
      });
    }

    const hrScoreTotal = Math.min(60, calculatedHRScore);

    // =============================================================
    // 5. CODING ROUND CALCULATION (Non-Fatal, Judge0 Results)
    // =============================================================
    let codingSessionResult = { problems: [], evaluations: [] };
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

    const codingProblemList = Array.isArray(codingSessionResult?.problems) && codingSessionResult.problems.length > 0
      ? codingSessionResult.problems
      : Array.isArray(codingSessionResult?.evaluations)
      ? codingSessionResult.evaluations
      : [];

    for (const q of codingQuestions) {
      const qIdStr = q._id.toString();
      const evalMatch = codingProblemList.find(
        (e) => String(e.questionId || e._id) === qIdStr
      );

      // Find latest submission for this question (if any)
      const matchingSubmissions = (codingSubmissions || []).filter((s) => String(s.questionId) === qIdStr);
      const latestSub = matchingSubmissions.length > 0 ? matchingSubmissions[matchingSubmissions.length - 1] : null;

      const resolved = resolveCandidateAnswer({
        roundType: "CODING",
        questionId: qIdStr,
        questionText: q.title || q.question || q.description,
        roundSessionAnswers: matchingSubmissions.length > 0 ? matchingSubmissions : codingSessionDoc?.answers || [],
        mainInterviewAnswers,
      });

      const hasSubmission = Boolean(latestSub && latestSub.sourceCode && latestSub.sourceCode.trim());
      const hasResolvedAnswer = Boolean(resolved.answerPresent && resolved.answer && resolved.answer.trim());
      const isAttempted = hasSubmission || hasResolvedAnswer || Boolean(evalMatch && evalMatch.status !== "Not Attempted" && evalMatch.status !== "NOT_ATTEMPTED");

      if (isAttempted) codingAttemptedCount++;

      const sourceCode = hasSubmission ? latestSub.sourceCode : hasResolvedAnswer ? resolved.answer : "";
      const maxScore = q.marks || (String(q.difficulty).toLowerCase() === "easy" ? 20 : String(q.difficulty).toLowerCase() === "hard" ? 50 : 30);

      const passedTests = evalMatch ? Number(evalMatch.passedTests || 0) : latestSub ? Number(latestSub.passedTests || 0) : 0;
      const totalTests = evalMatch && evalMatch.totalTests > 0
        ? Number(evalMatch.totalTests)
        : latestSub && latestSub.totalTests > 0
        ? Number(latestSub.totalTests)
        : ((q.visibleTestCases?.length || 0) + (q.hiddenTestCases?.length || 0));

      const rawScore = evalMatch ? Number(evalMatch.score) : latestSub ? Number(latestSub.score) : 0;
      const score = isAttempted && !isNaN(rawScore) ? Math.max(0, Math.min(maxScore, Math.round(rawScore))) : 0;

      let qStatus = "NOT_ATTEMPTED";
      let feedback = "No code was submitted for this problem.";

      if (isAttempted) {
        const subStatus = evalMatch?.status || latestSub?.status || "Evaluated";
        const compileOut = latestSub?.compileOutput || "";

        if (subStatus === "Compilation Error" || subStatus === "compile_error") {
          qStatus = "INCORRECT";
          feedback = compileOut ? `Compilation Error: ${compileOut.slice(0, 300)}` : `Compilation Error. Code could not be compiled. (Passed 0/${totalTests} test cases).`;
        } else if (subStatus === "Time Limit Exceeded" || subStatus === "time_limit") {
          qStatus = "INCORRECT";
          feedback = `Time Limit Exceeded. Program exceeded execution time limit. Passed ${passedTests}/${totalTests} test cases.`;
        } else if (subStatus === "Runtime Error" || subStatus === "runtime_error") {
          qStatus = "INCORRECT";
          feedback = `Runtime Error. Program terminated with an execution error. Passed ${passedTests}/${totalTests} test cases.`;
        } else if (passedTests === totalTests && totalTests > 0) {
          qStatus = "CORRECT";
          feedback = `Accepted. Passed all ${passedTests}/${totalTests} test cases. Full marks awarded.`;
        } else if (passedTests > 0) {
          qStatus = "PARTIALLY_CORRECT";
          feedback = `Partially Accepted. Passed ${passedTests}/${totalTests} test cases.`;
        } else {
          qStatus = "INCORRECT";
          feedback = `Wrong Answer. Output did not match expected testcase output. Passed 0/${totalTests} test cases.`;
        }
      }

      calculatedCodingScore += score;

      codingQuestionResults.push({
        questionId: qIdStr,
        roundType: "CODING",
        question: q.title || q.description || "Coding Problem",
        candidateAnswer: isAttempted ? sourceCode : "Not Submitted",
        correctAnswer: q.solutionExplanation || "Optimal reference solution and clean algorithmic logic.",
        score,
        maxScore,
        status: qStatus,
        evaluationMode: "JUDGE0",
        feedback,
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

    console.log(`[RealInterviewResultService] Session ${sessionId} RESULT CALCULATED & PERSISTED! Score: ${overallTotalObtained}/410 (${percentage}%). ResultStatus: ${resultStatus}.`);
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
