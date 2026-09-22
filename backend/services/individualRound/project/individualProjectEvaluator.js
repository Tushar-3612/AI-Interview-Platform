import { callPythonGroqBridge } from "../../realInterviewAI/pythonGroqBridge.js";
import { extractJsonFromText } from "../../realInterviewAI/jsonExtractor.js";
import {
  getIndividualProjectApiKey,
  getIndividualProjectModel,
} from "./individualProjectConfig.js";
import { buildProjectBatchEvaluationPrompt } from "./individualProjectPrompt.js";

/**
 * Derives authoritative max score from question difficulty or marks.
 * Easy = 5, Medium = 10, Hard = 20
 */
function getAuthoritativeMaxScore(q) {
  if (q.marks && typeof q.marks === "number" && q.marks > 0) {
    return q.marks;
  }
  const diff = String(q.difficulty || "Medium").toLowerCase();
  if (diff === "easy") return 5;
  if (diff === "hard") return 20;
  return 10;
}

/**
 * Evaluates candidate responses for an Individual Project / Resume practice session.
 * @param {Object} params { session, candidateProfile }
 * @returns {Promise<Object>} Formatted evaluation result object ready for DB persistence
 */
export async function evaluateIndividualProjectSession({ session }) {
  const apiKey = getIndividualProjectApiKey();
  const model = getIndividualProjectModel();

  const questions = session.questions || [];
  const answers = session.answers || [];
  const answerMap = new Map();
  answers.forEach((a) => {
    if (a.questionId && a.candidateAnswer && a.candidateAnswer.trim()) {
      answerMap.set(String(a.questionId), a.candidateAnswer.trim());
    }
  });

  const questionData = [];
  let attemptedCount = 0;
  let rawMaxPossibleScore = 0;

  for (let idx = 0; idx < questions.length; idx++) {
    const q = questions[idx];
    const qId = String(q.questionId);
    const candidateAns = answerMap.get(qId) || "";
    const trimmedAns = candidateAns.trim();
    const isAttempted = Boolean(
      trimmedAns.length > 0 &&
      trimmedAns !== "(No answer provided)" &&
      trimmedAns !== "Not Attempted"
    );
    const qMaxScore = getAuthoritativeMaxScore(q);

    rawMaxPossibleScore += qMaxScore;
    if (isAttempted) attemptedCount++;

    questionData.push({
      questionId: qId,
      question: q.question,
      difficulty: q.difficulty || "Medium",
      topic: q.topic || "Project Architecture",
      projectName: q.projectName || "Project",
      expectedKnowledge: q.expectedKnowledge || "",
      maxScore: qMaxScore,
      attempted: isAttempted,
      candidateAnswer: isAttempted ? candidateAns : "Not Attempted",
    });
  }

  const unattemptedCount = questions.length - attemptedCount;

  // RULE 1: ZERO ATTEMPT — Do NOT call Groq. Return completed result directly.
  if (attemptedCount === 0) {
    console.log(`[IndividualProjectEvaluator] Session ${session.sessionId} has 0 attempted questions. Returning NOT ASSESSED.`);
    return {
      obtainedScore: 0,
      maxScore: 100,
      percentage: 0,
      attemptedCount: 0,
      unattemptedCount: questions.length,
      performanceStatus: "NOT ASSESSED",
      feedback: {
        performanceInsight: "No questions were attempted in this session. Submit answers to receive evaluation.",
        whatWentWell: [],
        weakAreas: [],
        whatToImprove: [],
        recommendedNextStep: "Attempt the project practice questions to receive detailed feedback.",
      },
      questionResults: questionData.map((q) => ({
        questionId: q.questionId,
        question: q.question,
        difficulty: q.difficulty,
        topic: q.topic,
        projectName: q.projectName,
        attempted: false,
        candidateAnswer: "Not Attempted",
        rawScore: 0,
        rawMaxScore: q.maxScore,
        normalizedScore: 0,
        feedback: "Not assessed because no answer was submitted.",
        strengths: [],
        missingPoints: [],
        improvedAnswer: q.expectedKnowledge
          ? `Expected key concepts: ${q.expectedKnowledge}`
          : "A complete answer should address key project implementation and architectural concepts clearly.",
      })),
    };
  }

  // RULE 2: Attempted Questions — Evaluate via Python AI Bridge / Groq
  const attemptedQuestions = questionData.filter((q) => q.attempted);

  const prompt = buildProjectBatchEvaluationPrompt({ attemptedQuestions });
  const messages = [
    {
      role: "system",
      content: "You are a project interview evaluator. Output ONLY valid JSON matching schema without any intro or commentary.",
    },
    { role: "user", content: prompt },
  ];

  console.log(`[IndividualProjectEvaluation] sessionFound=true sessionId=${session.sessionId} attemptedCount=${attemptedCount} unattemptedCount=${unattemptedCount} evaluationStarted=true aiRequestStarted=true`);

  let rawText = "";
  try {
    rawText = await callPythonGroqBridge({
      round: "individual_project_evaluation",
      apiKey,
      model,
      messages,
      temperature: 0.1,
      max_tokens: 3500,
      timeoutMs: 60000,
    });
    console.log(`[IndividualProjectEvaluation] aiResponseReceived=true sessionId=${session.sessionId}`);
  } catch (bridgeErr) {
    console.error(`[IndividualProjectEvaluation] evaluationFailed=true errorType=AI_BRIDGE_ERROR sessionId=${session.sessionId} message=${bridgeErr.message}`);
    throw bridgeErr;
  }

  console.log(`[IndividualProjectEvaluation] jsonExtractionStarted=true sessionId=${session.sessionId}`);
  const parsed = extractJsonFromText(rawText);

  // STRICT VALIDATION: If evaluation JSON cannot be parsed or lacks evaluations array, THROW ERROR. No fallback score!
  if (!parsed || !Array.isArray(parsed.evaluations) || parsed.evaluations.length === 0) {
    console.error(`[IndividualProjectEvaluation] evaluationFailed=true errorType=JSON_EXTRACTION_FAILED sessionId=${session.sessionId}`);
    throw new Error("Could not extract valid JSON evaluation from response");
  }

  console.log(`[IndividualProjectEvaluation] jsonExtractionSucceeded=true evaluationValidated=true sessionId=${session.sessionId}`);

  const evalMap = new Map();
  parsed.evaluations.forEach((e) => {
    if (e && e.questionId) {
      evalMap.set(String(e.questionId), e);
    }
  });

  let rawTotalScore = 0;

  const questionResults = questionData.map((q) => {
    if (!q.attempted) {
      return {
        questionId: q.questionId,
        question: q.question,
        difficulty: q.difficulty,
        topic: q.topic,
        projectName: q.projectName,
        attempted: false,
        candidateAnswer: "Not Attempted",
        rawScore: 0,
        rawMaxScore: q.maxScore,
        normalizedScore: 0,
        feedback: "Not assessed because no answer was submitted.",
        strengths: [],
        missingPoints: [],
        improvedAnswer: q.expectedKnowledge
          ? `Expected key concepts: ${q.expectedKnowledge}`
          : "A complete answer should address key project implementation details.",
      };
    }

    const itemEval = evalMap.get(q.questionId) || {};
    const parsedAiScore = Number(itemEval.score);

    // Backend is authoritative for max score: 0 <= score <= q.maxScore
    let score = 0;
    if (!isNaN(parsedAiScore) && parsedAiScore >= 0) {
      score = Math.min(Math.round(parsedAiScore), q.maxScore);
    } else {
      score = Math.round(q.maxScore * 0.5); // Safe proportional score if individual item score is missing
    }

    rawTotalScore += score;

    const normItemScore = rawMaxPossibleScore > 0
      ? Number(((score / rawMaxPossibleScore) * 100).toFixed(2))
      : 0;

    const strengthsList = Array.isArray(itemEval.strengths)
      ? itemEval.strengths
      : Array.isArray(itemEval.correctPoints)
      ? itemEval.correctPoints
      : [];

    const missingList = Array.isArray(itemEval.missingConcepts)
      ? itemEval.missingConcepts
      : Array.isArray(itemEval.missingPoints)
      ? itemEval.missingPoints
      : [];

    return {
      questionId: q.questionId,
      question: q.question,
      difficulty: q.difficulty,
      topic: q.topic,
      projectName: q.projectName,
      attempted: true,
      candidateAnswer: q.candidateAnswer,
      rawScore: score,
      rawMaxScore: q.maxScore,
      normalizedScore: normItemScore,
      feedback: itemEval.feedback || "Answer evaluated based on project relevance.",
      strengths: strengthsList,
      missingPoints: missingList,
      improvedAnswer: itemEval.improvedAnswer || itemEval.betterAnswer || "",
    };
  });

  // Calculate final score out of 100
  let finalObtainedScore = rawTotalScore;
  if (rawMaxPossibleScore > 0 && rawMaxPossibleScore !== 100) {
    finalObtainedScore = Math.round((rawTotalScore / rawMaxPossibleScore) * 100);
  }

  if (finalObtainedScore > 100) finalObtainedScore = 100;
  if (finalObtainedScore < 0) finalObtainedScore = 0;

  const percentage = finalObtainedScore;

  // Performance status rules
  let performanceStatus = "NEEDS IMPROVEMENT";
  if (percentage >= 70) performanceStatus = "STRONG";
  else if (percentage >= 35) performanceStatus = "DEVELOPING";

  const summary = parsed.summary || {};

  return {
    obtainedScore: finalObtainedScore,
    maxScore: 100,
    percentage,
    attemptedCount,
    unattemptedCount,
    performanceStatus,
    feedback: {
      performanceInsight: summary.overallFeedback || summary.performanceInsight || `Completed ${attemptedCount}/10 project questions.`,
      whatWentWell: Array.isArray(summary.strengths) ? summary.strengths : Array.isArray(summary.whatWentWell) ? summary.whatWentWell : [],
      weakAreas: Array.isArray(summary.weakAreas) ? summary.weakAreas : [],
      whatToImprove: Array.isArray(summary.whatToImprove) ? summary.whatToImprove : [],
      recommendedNextStep: summary.recommendedNextStep || "Review project architecture principles and trade-offs.",
    },
    questionResults,
  };
}
