import Interview from "../../models/Interview.js";
import RealInterviewResult from "../../models/RealInterviewResult.js";
import RealInterviewAptitudeQuestion from "../../models/RealInterviewAptitudeQuestion.js";
import RealInterviewTechnicalQuestion from "../../models/RealInterviewTechnicalQuestion.js";
import RealInterviewProjectQuestion from "../../models/RealInterviewProjectQuestion.js";
import RealInterviewHRQuestion from "../../models/RealInterviewHRQuestion.js";
import RealInterviewCodingQuestion from "../../models/RealInterviewCodingQuestion.js";
import RealInterviewCodingSubmission from "../../models/RealInterviewCodingSubmission.js";

import { evaluateAptitudeSession } from "./aptitudeService.js";
import { evaluateTechnicalInterviewSession } from "./technicalService.js";
import { evaluateProjectInterviewSession } from "./projectService.js";
import { evaluateHRInterviewSession } from "./hrService.js";
import { evaluateCodingInterviewSession } from "./codingService.js";
import { getOrBuildCandidateResumeContext } from "../../utils/resumeContextBuilder.js";

/**
 * Runs the authoritative Real Interview Result Evaluation Pipeline.
 * 
 * SUBMIT -> SAVE ANSWERS -> EVALUATE APTITUDE -> EVALUATE TECHNICAL ->
 * EVALUATE PROJECT -> EVALUATE HR -> EVALUATE CODING -> CALCULATE TOTAL ->
 * SAVE RESULT -> VERIFY RESULT -> STATUS = COMPLETED
 */
export async function executeRealInterviewResultPipeline({ sessionId, userId, candidateProfile = null }) {
  if (!sessionId) {
    throw new Error("sessionId is required to run the result pipeline.");
  }

  // 1. Check existing result doc for idempotency
  let resultDoc = await RealInterviewResult.findOne({ sessionId });
  if (resultDoc && resultDoc.status === "COMPLETED") {
    console.log(`[ResultPipeline] Session ${sessionId} result already COMPLETED. Reusing stored result.`);
    return resultDoc;
  }

  // 2. Fetch main Interview session
  let interviewSession = null;
  if (Interview.db.models.Interview) {
    interviewSession = await Interview.findOne({ _id: sessionId }).catch(() => null);
  }

  const effectiveUserId = userId || interviewSession?.userId || resultDoc?.userId;
  if (!effectiveUserId) {
    throw new Error(`Cannot locate valid userId for sessionId=${sessionId}`);
  }

  // Build/retrieve candidate profile if needed
  const effectiveProfile = candidateProfile || (await getOrBuildCandidateResumeContext(effectiveUserId, interviewSession?.candidateProfile || {}));

  // Create or update result doc to SUBMITTED state
  if (!resultDoc) {
    resultDoc = await RealInterviewResult.create({
      sessionId,
      userId: effectiveUserId,
      interviewId: interviewSession?._id || null,
      status: "SUBMITTED",
      evaluationStage: "Saving interview responses",
      evaluationProgress: 10,
      submittedAt: new Date(),
    });
  } else {
    resultDoc.status = "SUBMITTED";
    resultDoc.evaluationStage = "Saving interview responses";
    resultDoc.evaluationProgress = 10;
    await resultDoc.save();
  }

  if (interviewSession) {
    interviewSession.status = "SUBMITTED";
    await interviewSession.save();
  }

  try {
    // -------------------------------------------------------------
    // STAGE 2: APTITUDE EVALUATION (15 Qs, 50 Marks, 0 AI Calls)
    // -------------------------------------------------------------
    resultDoc.status = "EVALUATING_APTITUDE";
    resultDoc.evaluationStage = "Evaluating Aptitude responses";
    resultDoc.evaluationProgress = 25;
    await resultDoc.save();

    console.log(`[ResultPipeline] Session ${sessionId} -> STAGE 2: EVALUATING_APTITUDE`);
    const aptitudeSessionResult = await evaluateAptitudeSession({
      sessionId,
      candidateAnswers: interviewSession?.answers || [],
      userId: effectiveUserId,
    });

    const aptitudeQuestions = await RealInterviewAptitudeQuestion.find({ sessionId }).lean();
    const aptitudeQuestionResults = [];
    let calculatedAptitudeScore = 0;

    for (const q of aptitudeQuestions) {
      const qIdStr = q._id.toString();
      let ansMatch = (aptitudeSessionResult.answers || []).find(
        (a) => String(a.questionId) === qIdStr
      );

      // Fallback check to interviewSession.answers if not matched
      if ((!ansMatch || !ansMatch.selectedOption) && interviewSession?.answers) {
        const rawMainAns = interviewSession.answers.find((a) => String(a.questionId) === qIdStr);
        if (rawMainAns) {
          const rawText = String(rawMainAns.answer || rawMainAns.transcript || "").trim();
          if (rawText) {
            const upperRaw = rawText.toUpperCase();
            let opt = ["A", "B", "C", "D"].includes(upperRaw) ? upperRaw : "";
            if (!opt) {
              const m = upperRaw.match(/^(?:OPTION\s+)?([A-D])(?:\b|:|\s)/);
              if (m) opt = m[1];
            }
            if (!opt && Array.isArray(q.options)) {
              const optObj = q.options.find(
                (o) => rawText.toLowerCase() === String(o.text || "").toLowerCase().trim() ||
                       rawText.toLowerCase() === `option ${String(o.label).toLowerCase()}: ${String(o.text).toLowerCase().trim()}`
              );
              if (optObj) opt = String(optObj.label).toUpperCase();
            }
            if (opt) ansMatch = { selectedOption: opt };
          }
        }
      }

      const selectedOpt = String(ansMatch?.selectedOption || "").toUpperCase().trim();
      const isAnswered = Boolean(selectedOpt && ["A", "B", "C", "D"].includes(selectedOpt));
      const isCorrect = isAnswered && selectedOpt === q.correctAnswer;
      const maxScore = q.maxMarks || (q.difficulty === "easy" ? 2 : q.difficulty === "hard" ? 5 : 3);
      const score = isCorrect ? maxScore : 0;
      calculatedAptitudeScore += score;

      let candidateAnswerText = "Not Answered";
      if (isAnswered && Array.isArray(q.options)) {
        const selectedOptObj = q.options.find((o) => o.label === selectedOpt);
        if (selectedOptObj) {
          candidateAnswerText = `Option ${selectedOpt}: ${selectedOptObj.text}`;
        } else {
          candidateAnswerText = selectedOpt;
        }
      } else if (isAnswered) {
        candidateAnswerText = selectedOpt;
      }

      let correctOptionText = q.correctAnswer;
      if (Array.isArray(q.options)) {
        const matchedOption = q.options.find((o) => o.label === q.correctAnswer);
        if (matchedOption) {
          correctOptionText = `Option ${q.correctAnswer}: ${matchedOption.text}`;
        }
      }

      aptitudeQuestionResults.push({
        questionId: qIdStr,
        roundType: "APTITUDE",
        question: q.question,
        candidateAnswer: candidateAnswerText,
        status: !isAnswered ? "NOT_ATTEMPTED" : isCorrect ? "CORRECT" : "INCORRECT",
        score,
        maxScore,
        evaluationMode: "DETERMINISTIC",
        correctAnswer: correctOptionText,
        expectedAnswer: correctOptionText,
        feedback: !isAnswered
          ? "Question was not attempted."
          : isCorrect
          ? "Correct answer selected."
          : `Incorrect choice. Selected option ${candidateAnswerText}.`,
        missingPoints: !isAnswered ? ["Question was not attempted"] : isCorrect ? [] : ["Incorrect answer selected"],
        improvedAnswer: q.explanation || `Correct option is ${q.correctAnswer}`,
      });
    }

    const aptitudeScoreTotal = Math.min(50, calculatedAptitudeScore);

    // -------------------------------------------------------------
    // STAGE 3: TECHNICAL EVALUATION (20 Qs, 100 Marks, Batch AI/Fallback)
    // -------------------------------------------------------------
    resultDoc.status = "EVALUATING_TECHNICAL";
    resultDoc.evaluationStage = "Evaluating Technical responses";
    resultDoc.evaluationProgress = 45;
    await resultDoc.save();

    console.log(`[ResultPipeline] Session ${sessionId} -> STAGE 3: EVALUATING_TECHNICAL`);
    const techSessionResult = await evaluateTechnicalInterviewSession({
      sessionId,
      candidateProfile: effectiveProfile,
    });

    const techQuestions = await RealInterviewTechnicalQuestion.find({ sessionId }).sort({ orderIndex: 1 }).lean();
    const techQuestionResults = [];
    let calculatedTechScore = 0;

    for (const q of techQuestions) {
      const qIdStr = q._id.toString();
      const evalMatch = (techSessionResult.evaluations || []).find(
        (e) => String(e.questionId) === qIdStr
      );

      const candidateAnsText = String(evalMatch?.candidateAnswer || "").trim();
      const isUnanswered =
        !candidateAnsText ||
        candidateAnsText === "(No answer submitted)" ||
        candidateAnsText.toLowerCase() === "not answered";

      const maxScore = q.maxMarks || (q.difficulty === "easy" ? 3 : q.difficulty === "hard" ? 13 : 5);
      let score = 0;
      let qStatus = "NOT_ATTEMPTED";
      const isFallback = techSessionResult.isFallback || evalMatch?.evaluationSource === "deterministic_fallback";

      if (!isUnanswered) {
        if (isFallback) {
          score = 0;
          qStatus = "FALLBACK_UNVERIFIED";
        } else {
          const rawScore = Number(evalMatch?.score);
          score = isNaN(rawScore) ? 0 : Math.max(0, Math.min(maxScore, Math.round(rawScore)));
          qStatus = score >= maxScore * 0.8 ? "CORRECT" : score >= maxScore * 0.4 ? "PARTIALLY_CORRECT" : "INCORRECT";
        }
      }

      calculatedTechScore += score;

      techQuestionResults.push({
        questionId: qIdStr,
        roundType: "TECHNICAL",
        question: q.question,
        candidateAnswer: isUnanswered ? "Not Answered" : candidateAnsText,
        status: isUnanswered ? "NOT_ATTEMPTED" : qStatus,
        score,
        maxScore,
        evaluationMode: isFallback ? "FALLBACK" : "AI",
        correctAnswer: q.expectedKnowledge || "Comprehensive technical explanation addressing core concepts.",
        expectedAnswer: q.expectedKnowledge || "Comprehensive technical explanation addressing core concepts.",
        feedback: isUnanswered ? "Question was not attempted." : (evalMatch?.feedback || "Evaluation complete."),
        missingPoints: isUnanswered ? ["Question was not attempted"] : (evalMatch?.missingPoints || []),
        improvedAnswer: isUnanswered ? (q.expectedKnowledge || "") : (evalMatch?.betterAnswer || ""),
      });
    }

    const techScoreTotal = Math.min(100, calculatedTechScore);

    // -------------------------------------------------------------
    // STAGE 4: PROJECT EVALUATION (10 Qs, 100 Marks, Batch AI/Fallback)
    // -------------------------------------------------------------
    resultDoc.status = "EVALUATING_PROJECT";
    resultDoc.evaluationStage = "Evaluating Project responses";
    resultDoc.evaluationProgress = 65;
    await resultDoc.save();

    console.log(`[ResultPipeline] Session ${sessionId} -> STAGE 4: EVALUATING_PROJECT`);
    const projectSessionResult = await evaluateProjectInterviewSession({
      sessionId,
      candidateProfile: effectiveProfile,
    });

    const projectQuestions = await RealInterviewProjectQuestion.find({ sessionId }).sort({ orderIndex: 1 }).lean();
    const projectQuestionResults = [];
    let calculatedProjectScore = 0;

    for (const q of projectQuestions) {
      const qIdStr = q._id.toString();
      const evalMatch = (projectSessionResult.evaluations || []).find(
        (e) => String(e.questionId) === qIdStr
      );

      const candidateAnsText = String(evalMatch?.candidateAnswer || "").trim();
      const isUnanswered =
        !candidateAnsText ||
        candidateAnsText === "(No answer submitted)" ||
        candidateAnsText.toLowerCase() === "not answered";

      const maxScore = q.maxMarks || (q.difficulty === "easy" ? 5 : q.difficulty === "hard" ? 20 : 10);
      let score = 0;
      let qStatus = "NOT_ATTEMPTED";
      const isFallback = projectSessionResult.isFallback || evalMatch?.evaluationSource === "deterministic_fallback";

      if (!isUnanswered) {
        if (isFallback) {
          score = 0;
          qStatus = "FALLBACK_UNVERIFIED";
        } else {
          const rawScore = Number(evalMatch?.score);
          score = isNaN(rawScore) ? 0 : Math.max(0, Math.min(maxScore, Math.round(rawScore)));
          qStatus = score >= maxScore * 0.8 ? "CORRECT" : score >= maxScore * 0.4 ? "PARTIALLY_CORRECT" : "INCORRECT";
        }
      }

      calculatedProjectScore += score;

      projectQuestionResults.push({
        questionId: qIdStr,
        roundType: "RESUME_PROJECT",
        question: q.question,
        candidateAnswer: isUnanswered ? "Not Answered" : candidateAnsText,
        status: isUnanswered ? "NOT_ATTEMPTED" : qStatus,
        score,
        maxScore,
        evaluationMode: isFallback ? "FALLBACK" : "AI",
        correctAnswer: q.expectedKnowledge || "Detailed project architectural explanation grounded in resume evidence.",
        expectedAnswer: q.expectedKnowledge || "Detailed project architectural explanation grounded in resume evidence.",
        feedback: isUnanswered ? "Question was not attempted." : (evalMatch?.feedback || "Evaluation complete."),
        missingPoints: isUnanswered ? ["Question was not attempted"] : (evalMatch?.missingPoints || []),
        improvedAnswer: isUnanswered ? (q.expectedKnowledge || "") : (evalMatch?.betterAnswer || ""),
      });
    }

    const projectScoreTotal = Math.min(100, calculatedProjectScore);

    // -------------------------------------------------------------
    // STAGE 5: HR EVALUATION (5 Qs, 100 Marks, Batch AI/Fallback)
    // -------------------------------------------------------------
    resultDoc.status = "EVALUATING_HR";
    resultDoc.evaluationStage = "Evaluating HR responses";
    resultDoc.evaluationProgress = 80;
    await resultDoc.save();

    console.log(`[ResultPipeline] Session ${sessionId} -> STAGE 5: EVALUATING_HR`);
    const hrSessionResult = await evaluateHRInterviewSession({
      sessionId,
      candidateProfile: effectiveProfile,
    });

    const hrQuestions = await RealInterviewHRQuestion.find({ sessionId }).sort({ orderIndex: 1 }).lean();
    const hrQuestionResults = [];
    let calculatedHRScore = 0;

    for (const q of hrQuestions) {
      const qIdStr = q._id.toString();
      const evalMatch = (hrSessionResult.evaluations || []).find(
        (e) => String(e.questionId) === qIdStr
      );

      const candidateAnsText = String(evalMatch?.candidateAnswer || "").trim();
      const isUnanswered =
        !candidateAnsText ||
        candidateAnsText === "(No answer submitted)" ||
        candidateAnsText.toLowerCase() === "not answered";

      const maxScore = q.maxMarks || 20;
      let score = 0;
      let qStatus = "NOT_ATTEMPTED";
      const isFallback = hrSessionResult.fallbackUsed || evalMatch?.evaluationSource === "deterministic_fallback";

      if (!isUnanswered) {
        if (isFallback) {
          score = 0;
          qStatus = "FALLBACK_UNVERIFIED";
        } else {
          const rawScore = Number(evalMatch?.score);
          score = isNaN(rawScore) ? 0 : Math.max(0, Math.min(maxScore, Math.round(rawScore)));
          qStatus = score >= maxScore * 0.8 ? "CORRECT" : score >= maxScore * 0.4 ? "PARTIALLY_CORRECT" : "INCORRECT";
        }
      }

      calculatedHRScore += score;

      hrQuestionResults.push({
        questionId: qIdStr,
        roundType: "HR",
        question: q.question,
        candidateAnswer: isUnanswered ? "Not Answered" : candidateAnsText,
        status: isUnanswered ? "NOT_ATTEMPTED" : qStatus,
        score,
        maxScore,
        evaluationMode: isFallback ? "FALLBACK" : "AI",
        correctAnswer: q.expectedKnowledge || "Strong behavioral response with STAR framework structure.",
        expectedAnswer: q.expectedKnowledge || "Strong behavioral response with STAR framework structure.",
        feedback: isUnanswered ? "Question was not attempted." : (evalMatch?.feedback || "Evaluation complete."),
        missingPoints: isUnanswered ? ["Question was not attempted"] : (evalMatch?.missingPoints || []),
        improvedAnswer: isUnanswered ? (q.expectedKnowledge || "") : (evalMatch?.betterAnswer || ""),
      });
    }

    const hrScoreTotal = Math.min(100, calculatedHRScore);

    // -------------------------------------------------------------
    // STAGE 6: CODING EVALUATION (3 Problems, 100 Marks, Judge0)
    // -------------------------------------------------------------
    resultDoc.status = "EVALUATING_CODING";
    resultDoc.evaluationStage = "Evaluating Coding performance";
    resultDoc.evaluationProgress = 90;
    await resultDoc.save();

    console.log(`[ResultPipeline] Session ${sessionId} -> STAGE 6: EVALUATING_CODING`);
    const codingSessionResult = await evaluateCodingInterviewSession({ sessionId });

    const codingQuestions = await RealInterviewCodingQuestion.find({ sessionId }).sort({ orderIndex: 1 }).lean();
    const codingSubmissions = await RealInterviewCodingSubmission.find({ sessionId }).lean();
    const codingQuestionResults = [];
    let calculatedCodingScore = 0;

    for (const q of codingQuestions) {
      const qIdStr = q._id.toString();
      const evalMatch = (codingSessionResult.evaluations || []).find(
        (e) => String(e.questionId) === qIdStr
      );
      const subMatch = codingSubmissions.find((s) => String(s.questionId) === qIdStr);

      const sourceCode = subMatch?.sourceCode || evalMatch?.sourceCode || "";
      const isUnsubmitted = !sourceCode || sourceCode.trim() === "";

      const maxScore = q.marks || (q.difficulty === "easy" ? 20 : q.difficulty === "hard" ? 50 : 30);
      let score = 0;
      let qStatus = "NOT_ATTEMPTED";

      if (!isUnsubmitted) {
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
        candidateAnswer: isUnsubmitted ? "Not Submitted" : sourceCode,
        status: isUnsubmitted ? "NOT_ATTEMPTED" : qStatus,
        score,
        maxScore,
        evaluationMode: "JUDGE0",
        correctAnswer: q.solutionExplanation || "Optimal reference approach and clean algorithmic solution.",
        expectedAnswer: q.solutionExplanation || "Optimal reference approach and clean algorithmic solution.",
        feedback: isUnsubmitted
          ? "No code was submitted for this problem."
          : `Execution result: ${evalMatch?.executionStatus || "Evaluated"}. Passed ${evalMatch?.passedTests || 0}/${evalMatch?.totalTests || 0} test cases.`,
        missingPoints: isUnsubmitted
          ? ["Problem was not attempted"]
          : (evalMatch?.passedTests < evalMatch?.totalTests ? ["Failed some test cases"] : []),
        improvedAnswer: q.solutionExplanation || "Review reference implementation for optimal time/space complexity.",
        submission: {
          sourceCode: isUnsubmitted ? "" : sourceCode,
          language: subMatch?.language || "javascript",
          executionStatus: isUnsubmitted ? "not_submitted" : (evalMatch?.executionStatus || "executed"),
          passedTests: evalMatch?.passedTests || 0,
          totalTests: evalMatch?.totalTests || (q.testCases?.length || 0),
        },
      });
    }

    const codingScoreTotal = Math.min(100, calculatedCodingScore);

    // -------------------------------------------------------------
    // STAGE 7: CALCULATING TOTAL & FINAL SCORE (Max 450)
    // -------------------------------------------------------------
    resultDoc.status = "CALCULATING_RESULT";
    resultDoc.evaluationStage = "Calculating final score";
    resultDoc.evaluationProgress = 95;
    await resultDoc.save();

    const overallTotalObtained = Math.min(
      450,
      aptitudeScoreTotal + techScoreTotal + projectScoreTotal + hrScoreTotal + codingScoreTotal
    );

    const percentage = Number(((overallTotalObtained / 450) * 100).toFixed(2));

    // Combine all question results
    const allQuestionResults = [
      ...aptitudeQuestionResults,
      ...techQuestionResults,
      ...projectQuestionResults,
      ...hrQuestionResults,
      ...codingQuestionResults,
    ];

    // Compute actual strengths & weaknesses from question results
    const strengths = [];
    const weaknesses = [];

    const highScoring = allQuestionResults.filter((q) => q.status === "CORRECT" || q.score / q.maxScore >= 0.8);
    const lowScoring = allQuestionResults.filter((q) => q.status === "INCORRECT" || q.status === "NOT_ATTEMPTED" || q.score / q.maxScore < 0.5);

    if (aptitudeScoreTotal >= 40) strengths.push("Strong logical reasoning and aptitude accuracy");
    if (techScoreTotal >= 80) strengths.push("Solid technical stack depth and core concept mastery");
    if (projectScoreTotal >= 80) strengths.push("Strong project architectural understanding and resume alignment");
    if (hrScoreTotal >= 80) strengths.push("Clear behavioral communication and structured decision-making");
    if (codingScoreTotal >= 80) strengths.push("High coding problem-solving efficiency and clean test execution");

    if (highScoring.length > 0 && strengths.length === 0) {
      strengths.push(`Demonstrated competence in ${highScoring[0].roundType.toLowerCase()} questions`);
    }
    if (strengths.length === 0) {
      strengths.push("Attempted full 5-round interview process under time pressure");
    }

    if (aptitudeScoreTotal < 35) weaknesses.push("Improve speed and accuracy in Aptitude MCQ problem solving");
    if (techScoreTotal < 65) weaknesses.push("Deepen conceptual clarity in Technical stack fundamentals");
    if (projectScoreTotal < 65) weaknesses.push("Provide more detailed technical rationale for project decisions");
    if (hrScoreTotal < 65) weaknesses.push("Structure behavioral responses clearly using the STAR framework");
    if (codingScoreTotal < 65) weaknesses.push("Practice algorithmic complexity optimization and edge-case handling");

    if (lowScoring.length > 0 && weaknesses.length === 0) {
      weaknesses.push(`Review unanswered or incorrect items in ${lowScoring[0].roundType.toLowerCase()}`);
    }
    if (weaknesses.length === 0) {
      weaknesses.push("Continue refining advanced system design and performance optimization skills");
    }

    let recommendation = "Needs Improvement";
    if (percentage >= 85) recommendation = "Strong Hire";
    else if (percentage >= 75) recommendation = "Hire";
    else if (percentage >= 60) recommendation = "Consider with Mentorship";
    else if (percentage >= 50) recommendation = "Borderline - Additional Practice Required";

    // -------------------------------------------------------------
    // STAGE 8: PERSIST & COMPLETE RESULT
    // -------------------------------------------------------------
    resultDoc.overallScore = overallTotalObtained;
    resultDoc.maxScore = 450;
    resultDoc.percentage = percentage;
    resultDoc.roundScores = {
      aptitude: {
        score: aptitudeScoreTotal,
        maxScore: 50,
        percentage: Math.round((aptitudeScoreTotal / 50) * 100),
        status: "COMPLETED",
      },
      technical: {
        score: techScoreTotal,
        maxScore: 100,
        percentage: Math.round((techScoreTotal / 100) * 100),
        status: "COMPLETED",
      },
      project: {
        score: projectScoreTotal,
        maxScore: 100,
        percentage: Math.round((projectScoreTotal / 100) * 100),
        status: "COMPLETED",
      },
      hr: {
        score: hrScoreTotal,
        maxScore: 100,
        percentage: Math.round((hrScoreTotal / 100) * 100),
        status: "COMPLETED",
      },
      coding: {
        score: codingScoreTotal,
        maxScore: 100,
        percentage: Math.round((codingScoreTotal / 100) * 100),
        status: "COMPLETED",
      },
    };
    resultDoc.questionResults = allQuestionResults;
    resultDoc.strengths = strengths;
    resultDoc.weaknesses = weaknesses;
    resultDoc.recommendation = recommendation;

    resultDoc.status = "COMPLETED";
    resultDoc.evaluationStage = "Completed";
    resultDoc.evaluationProgress = 100;
    resultDoc.completedAt = new Date();
    await resultDoc.save();

    if (interviewSession) {
      interviewSession.status = "COMPLETED";
      interviewSession.completedAt = new Date();
      interviewSession.overallScore = percentage;
      await interviewSession.save();
    }

    console.log(`[ResultPipeline] Session ${sessionId} evaluation SUCCESSFULLY COMPLETED! Score: ${overallTotalObtained}/450 (${percentage}%).`);
    return resultDoc;
  } catch (error) {
    console.error(`[ResultPipeline] Evaluation ERROR for session ${sessionId}:`, error.message);
    resultDoc.status = "EVALUATION_FAILED";
    resultDoc.evaluationStage = "Evaluation Failed";
    resultDoc.errorDetails = error.message || "Failed to complete evaluation pipeline";
    await resultDoc.save();

    if (interviewSession) {
      interviewSession.status = "EVALUATION_FAILED";
      await interviewSession.save();
    }

    throw error;
  }
}
