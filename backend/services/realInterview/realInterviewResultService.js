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
 * Reads actual persisted interview data from MongoDB.
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
  if (Interview.db.models.Interview) {
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
      RealInterviewAptitudeQuestion.find({ sessionId }).lean(),
      RealInterviewTechnicalQuestion.find({ sessionId }).sort({ orderIndex: 1 }).lean(),
      RealInterviewProjectQuestion.find({ sessionId }).sort({ orderIndex: 1 }).lean(),
      RealInterviewHRQuestion.find({ sessionId }).sort({ orderIndex: 1 }).lean(),
      RealInterviewCodingQuestion.find({ sessionId }).sort({ orderIndex: 1 }).lean(),
      RealInterviewAptitudeSession.findOne({ sessionId }).lean().catch(() => null),
      RealInterviewTechnicalSession.findOne({ sessionId }).lean().catch(() => null),
      RealInterviewProjectSession.findOne({ sessionId }).lean().catch(() => null),
      RealInterviewHRSession.findOne({ sessionId }).lean().catch(() => null),
      RealInterviewCodingSubmission.find({ sessionId }).lean().catch(() => []),
      RealInterviewCodingSession.findOne({ sessionId }).lean().catch(() => null),
    ]);

    // Precheck resolved candidate answers count
    const precheckApt = aptitudeQuestions.filter((q) =>
      resolveCandidateAnswer({
        roundType: "APTITUDE",
        questionId: q._id.toString(),
        questionText: q.question,
        options: q.options,
        roundSessionAnswers: aptSessionDoc?.answers || [],
        mainInterviewAnswers,
      }).answerPresent
    ).length;

    const precheckTech = techQuestions.filter((q) =>
      resolveCandidateAnswer({
        roundType: "TECHNICAL",
        questionId: q._id.toString(),
        questionText: q.question,
        roundSessionAnswers: techSessionDoc?.answers || [],
        mainInterviewAnswers,
      }).answerPresent
    ).length;

    const precheckProj = projectQuestions.filter((q) =>
      resolveCandidateAnswer({
        roundType: "RESUME_PROJECT",
        questionId: q._id.toString(),
        questionText: q.question,
        roundSessionAnswers: projSessionDoc?.answers || [],
        mainInterviewAnswers,
      }).answerPresent
    ).length;

    const precheckHR = hrQuestions.filter((q) =>
      resolveCandidateAnswer({
        roundType: "HR",
        questionId: q._id.toString(),
        questionText: q.question,
        roundSessionAnswers: hrSessionDoc?.answers || [],
        mainInterviewAnswers,
      }).answerPresent
    ).length;

    const precheckCoding = codingQuestions.filter((q) =>
      resolveCandidateAnswer({
        roundType: "CODING",
        questionId: q._id.toString(),
        questionText: q.title || q.question || q.description,
        roundSessionAnswers: codingSubmissions.length > 0 ? codingSubmissions : codingSessionDoc?.answers || [],
        mainInterviewAnswers,
      }).answerPresent
    ).length;

    console.log(`\n[RESULT-PRECHECK]\naptitudeAnswered=${precheckApt}/${aptitudeQuestions.length || 15}\ntechnicalAnswered=${precheckTech}/${techQuestions.length || 20}\nprojectAnswered=${precheckProj}/${projectQuestions.length || 10}\nhrAnswered=${precheckHR}/${hrQuestions.length || 5}\ncodingSubmitted=${precheckCoding}/${codingQuestions.length || 3}\n`);

    const validInterviewAnswersCount = mainInterviewAnswers.filter((a) => a.answer && String(a.answer).trim().length > 0).length;
    const aptRoundAnswersCount = (aptSessionDoc?.answers || []).filter((a) => a.selectedOption || a.candidateAnswer || a.answer).length;
    const techRoundAnswersCount = (techSessionDoc?.answers || []).filter((a) => a.candidateAnswer || a.answer).length;
    const projRoundAnswersCount = (projSessionDoc?.answers || []).filter((a) => a.candidateAnswer || a.answer).length;
    const hrRoundAnswersCount = (hrSessionDoc?.answers || []).filter((a) => a.candidateAnswer || a.answer).length;
    const codingRoundAnswersCount = codingSubmissions.length;

    console.log(`[RESULT-DATA-SOURCES]\ninterviewAnswers=${validInterviewAnswersCount}\naptitudeRoundAnswers=${aptRoundAnswersCount}\ntechnicalRoundAnswers=${techRoundAnswersCount}\nprojectRoundAnswers=${projRoundAnswersCount}\nhrRoundAnswers=${hrRoundAnswersCount}\ncodingRoundAnswers=${codingRoundAnswersCount}\n`);

    // Verify answer data integrity: If Interview.answers contains valid answers for a round, resolver must not return 0
    const hasSectionAnswersInMain = (sec) =>
      mainInterviewAnswers.some(
        (a) =>
          String(a.section || a.category || "").toUpperCase().includes(sec) &&
          a.answer &&
          String(a.answer).trim().length > 0
      );

    if (hasSectionAnswersInMain("APTITUDE") && precheckApt === 0 && aptitudeQuestions.length > 0) {
      throw new Error("ANSWER_DATA_UNAVAILABLE: Valid Aptitude answers exist in Interview.answers but resolver returned 0.");
    }
    if (hasSectionAnswersInMain("TECHNICAL") && precheckTech === 0 && techQuestions.length > 0) {
      throw new Error("ANSWER_DATA_UNAVAILABLE: Valid Technical answers exist in Interview.answers but resolver returned 0.");
    }
    if ((hasSectionAnswersInMain("PROJECT") || hasSectionAnswersInMain("RESUME")) && precheckProj === 0 && projectQuestions.length > 0) {
      throw new Error("ANSWER_DATA_UNAVAILABLE: Valid Project answers exist in Interview.answers but resolver returned 0.");
    }
    if (hasSectionAnswersInMain("HR") && precheckHR === 0 && hrQuestions.length > 0) {
      throw new Error("ANSWER_DATA_UNAVAILABLE: Valid HR answers exist in Interview.answers but resolver returned 0.");
    }

    // =============================================================
    // 1. APTITUDE ROUND CALCULATION (15 Qs, Max 50 Marks, Exact MCQ match)
    // =============================================================
    const aptitudeSessionResult = await evaluateAptitudeSession({
      sessionId,
      candidateAnswers: mainInterviewAnswers,
      userId: effectiveUserId,
    });

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
        roundSessionAnswers: aptSessionDoc?.answers || aptitudeSessionResult.answers || [],
        mainInterviewAnswers,
      });

      const selectedOpt = String(resolved.selectedOption || "").toUpperCase().trim();
      const isAnswered = resolved.answerPresent && ["A", "B", "C", "D"].includes(selectedOpt);
      if (isAnswered) aptitudeAttemptedCount++;

      const correctOpt = String(q.correctAnswer || "").toUpperCase().trim();
      const isCorrect = isAnswered && selectedOpt === correctOpt;

      const maxScore = q.maxMarks || (q.difficulty === "easy" ? 2 : q.difficulty === "hard" ? 5 : 3);
      const score = isCorrect ? maxScore : 0;
      calculatedAptitudeScore += score;

      let candidateAnswerText = "Not Answered";
      if (isAnswered && Array.isArray(q.options)) {
        const selectedOptObj = q.options.find((o) => String(o.label).toUpperCase() === selectedOpt);
        if (selectedOptObj) {
          candidateAnswerText = `Option ${selectedOpt}: ${selectedOptObj.text}`;
        } else {
          candidateAnswerText = selectedOpt;
        }
      } else if (isAnswered) {
        candidateAnswerText = selectedOpt;
      }

      let correctOptionText = correctOpt;
      if (Array.isArray(q.options)) {
        const matchedOption = q.options.find((o) => String(o.label).toUpperCase() === correctOpt);
        if (matchedOption) {
          correctOptionText = `Option ${correctOpt}: ${matchedOption.text}`;
        }
      }

      aptitudeQuestionResults.push({
        questionId: qIdStr,
        roundType: "APTITUDE",
        question: q.question,
        candidateAnswer: candidateAnswerText,
        correctAnswer: correctOptionText,
        score,
        maxScore,
        status: !isAnswered ? "NOT_ATTEMPTED" : isCorrect ? "CORRECT" : "INCORRECT",
        evaluationMode: "DETERMINISTIC",
        feedback: !isAnswered
          ? "Question was not attempted."
          : isCorrect
          ? "Correct answer selected."
          : `Incorrect choice. Selected option ${candidateAnswerText}.`,
        improvedAnswer: q.explanation || `Correct option is ${correctOpt}`,
      });
    }

    const aptitudeScoreTotal = Math.min(50, calculatedAptitudeScore);

    // =============================================================
    // 2. TECHNICAL ROUND CALCULATION (20 Qs, Max 100 Marks, AI / NLP Fallback)
    // =============================================================
    const techSessionResult = await evaluateTechnicalInterviewSession({
      sessionId,
      candidateProfile: effectiveProfile,
    });

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
    // 3. PROJECT ROUND CALCULATION (10 Qs, Max 100 Marks, AI / NLP Fallback)
    // =============================================================
    const projectSessionResult = await evaluateProjectInterviewSession({
      sessionId,
      candidateProfile: effectiveProfile,
    });

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
    // 4. HR ROUND CALCULATION (5 Qs, Max 100 Marks, AI / NLP Fallback)
    // =============================================================
    const hrSessionResult = await evaluateHRInterviewSession({
      sessionId,
      candidateProfile: effectiveProfile,
    });

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

    const hrScoreTotal = Math.min(100, calculatedHRScore);

    // =============================================================
    // 5. CODING ROUND CALCULATION (3 Problems, Max 100 Marks, Judge0 Results)
    // =============================================================
    const codingSessionResult = await evaluateCodingInterviewSession({ sessionId });

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
    // 6. TOTAL & FINAL SCORE MATHEMATICAL CALCULATION
    // =============================================================
    const overallTotalObtained = Math.min(
      450,
      aptitudeScoreTotal + techScoreTotal + projectScoreTotal + hrScoreTotal + codingScoreTotal
    );

    const percentage = Number(((overallTotalObtained / 450) * 100).toFixed(2));

    const attemptedQuestionsCount = aptitudeAttemptedCount + techAttemptedCount + projectAttemptedCount + hrAttemptedCount + codingAttemptedCount;
    const totalQuestionsCount = 53;
    const unattemptedQuestionsCount = Math.max(0, totalQuestionsCount - attemptedQuestionsCount);

    const allQuestionResults = [
      ...aptitudeQuestionResults,
      ...techQuestionResults,
      ...projectQuestionResults,
      ...hrQuestionResults,
      ...codingQuestionResults,
    ];

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
        totalQuestions: 20,
      },
      project: {
        obtained: projectScoreTotal,
        maximum: 100,
        attempted: projectAttemptedCount,
        totalQuestions: 10,
      },
      hr: {
        obtained: hrScoreTotal,
        maximum: 100,
        attempted: hrAttemptedCount,
        totalQuestions: 5,
      },
      coding: {
        obtained: codingScoreTotal,
        maximum: 100,
        attempted: codingAttemptedCount,
        totalQuestions: 3,
      },
    };

    resultDoc.totalObtained = overallTotalObtained;
    resultDoc.maximumMarks = 450;
    resultDoc.percentage = percentage;

    resultDoc.attemptedQuestionsCount = attemptedQuestionsCount;
    resultDoc.unattemptedQuestionsCount = unattemptedQuestionsCount;
    resultDoc.totalQuestionsCount = totalQuestionsCount;

    resultDoc.questionResults = allQuestionResults;

    resultDoc.status = "COMPLETED";
    resultDoc.completedAt = new Date();
    await resultDoc.save();

    if (mainInterviewSession) {
      mainInterviewSession.status = "completed";
      mainInterviewSession.completedAt = new Date();
      mainInterviewSession.overallScore = percentage;
      await mainInterviewSession.save();
    }

    console.log(`[RealInterviewResultService] Session ${sessionId} RESULT CALCULATED & PERSISTED! Score: ${overallTotalObtained}/450 (${percentage}%).`);
    return resultDoc;
  } catch (error) {
    console.error(`[RealInterviewResultService] Calculation ERROR for session ${sessionId}:`, error.message);
    resultDoc.status = "EVALUATION_FAILED";
    resultDoc.errorDetails = error.message || "Failed to calculate interview result";
    await resultDoc.save();

    if (mainInterviewSession) {
      mainInterviewSession.status = "EVALUATION_FAILED";
      await mainInterviewSession.save();
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
