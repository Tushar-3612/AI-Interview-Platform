import { callPythonGroqBridge } from "../../realInterviewAI/pythonGroqBridge.js";
import { extractJsonFromText } from "../../realInterviewAI/jsonExtractor.js";
import {
  getIndividualProjectApiKey,
  getIndividualProjectModel,
  getProjectDifficultyBreakdown,
} from "./individualProjectConfig.js";

/**
 * Evaluates candidate responses for an Individual Project / Resume practice session.
 * @param {Object} params { session, candidateProfile }
 * @returns {Promise<Object>} Formatted evaluation result object ready for DB persistence
 */
export async function evaluateIndividualProjectSession({ session, candidateProfile = {} }) {
  const apiKey = getIndividualProjectApiKey();
  const model = getIndividualProjectModel();
  const breakdown = getProjectDifficultyBreakdown(session.difficulty);

  const questions = session.questions || [];
  const answers = session.answers || [];
  const answerMap = new Map();
  answers.forEach((a) => answerMap.set(String(a.questionId), a.candidateAnswer));

  // Prepare input for AI call
  const formattedQuestions = questions.map((q, idx) => {
    const ansText = (answerMap.get(String(q.questionId)) || "").trim();
    return {
      i: idx + 1,
      id: String(q.questionId),
      q: String(q.question),
      diff: String(q.difficulty || "Medium"),
      max: Number(q.marks || (q.difficulty === "Easy" ? 5 : q.difficulty === "Hard" ? 20 : 10)),
      exp: String(q.expectedKnowledge || ""),
      ans: ansText || "(No answer provided)",
    };
  });

  const prompt = `You are a fair technical interviewer evaluating candidate responses for an Individual Project & Resume Practice round.

QUESTIONS & CANDIDATE RESPONSES:
${JSON.stringify(formattedQuestions, null, 2)}

FAIR EVALUATION INSTRUCTIONS:
1. PROJECT UNDERSTANDING FIRST: Judge project architecture, workflow, data flow, choices, and trade-offs. Do NOT penalize grammar heavily if technical logic is sound.
2. Unattempted or blank responses score 0 marks.
3. MARKS: Each question max marks is specified in input (max field).
4. Provide constructive feedback, strengths, missing points, and an improved candidate answer for each question.
5. Provide overall performance insights, what went well, weak areas, and recommended next steps.

JSON SCHEMA OUTPUT ONLY:
{
  "evaluations": [
    {
      "questionId": "string matching id",
      "score": 8,
      "maxScore": 10,
      "difficulty": "Medium",
      "rating": "Strong",
      "correctPoints": ["Valid architectural choice"],
      "missingPoints": ["Missing error handling detail"],
      "feedback": "Concise feedback on candidate answer",
      "betterAnswer": "Refined candidate answer"
    }
  ],
  "performanceInsight": "Overall assessment of project understanding",
  "whatWentWell": ["Clear API workflow design"],
  "weakAreas": ["Shallow error handling in server failure scenarios"],
  "whatToImprove": ["Detail database migration strategies"],
  "recommendedNextStep": "Practice database optimization and failure resilience"
}`;

  const messages = [
    {
      role: "system",
      content: "You are a project interview evaluator. Output ONLY valid JSON matching schema for all 10 questions without any intro or commentary.",
    },
    { role: "user", content: prompt },
  ];

  console.log(`[IndividualProjectEvaluator] Evaluating session=${session.sessionId} with ${formattedQuestions.length} questions`);

  const rawText = await callPythonGroqBridge({
    round: "individual_project_evaluation",
    apiKey,
    model,
    messages,
    temperature: 0.2,
    max_tokens: 3000,
    timeoutMs: 90000,
  });

  const parsed = extractJsonFromText(rawText);

  if (!parsed || !Array.isArray(parsed.evaluations) || parsed.evaluations.length === 0) {
    console.error("[IndividualProjectEvaluator] Failed to extract valid evaluations array from AI response");
    throw new Error("Could not extract valid JSON evaluation from AI response");
  }

  const evalMap = new Map();
  parsed.evaluations.forEach((e) => {
    if (e && e.questionId) evalMap.set(String(e.questionId), e);
  });

  let rawTotalScore = 0;
  let rawMaxPossibleScore = 0;
  let attemptedCount = 0;

  const questionResults = questions.map((q) => {
    const qId = String(q.questionId);
    const candidateAns = (answerMap.get(qId) || "").trim();
    const isAttempted = Boolean(candidateAns && candidateAns !== "(No answer provided)");
    if (isAttempted) attemptedCount++;

    const itemEval = evalMap.get(qId) || {};
    const maxMarks = Number(q.marks || (q.difficulty === "Easy" ? 5 : q.difficulty === "Hard" ? 20 : 10));
    rawMaxPossibleScore += maxMarks;

    let score = isAttempted ? Number(itemEval.score) : 0;
    if (isNaN(score) || score < 0) score = 0;
    if (score > maxMarks) score = maxMarks;

    rawTotalScore += score;

    return {
      questionId: qId,
      question: q.question,
      difficulty: q.difficulty || "Medium",
      topic: q.topic || "Project Architecture",
      projectName: q.projectName || "Project",
      attempted: isAttempted,
      candidateAnswer: candidateAns,
      rawScore: score,
      rawMaxScore: maxMarks,
      normalizedScore: score,
      feedback: itemEval.feedback || (isAttempted ? "Answer evaluated." : "No answer provided."),
      strengths: Array.isArray(itemEval.correctPoints) ? itemEval.correctPoints : [],
      missingPoints: Array.isArray(itemEval.missingPoints) ? itemEval.missingPoints : [],
      improvedAnswer: itemEval.betterAnswer || "",
    };
  });

  // Calculate final score out of 100
  let finalObtainedScore = rawTotalScore;
  const maxScore = 100;

  if (rawMaxPossibleScore > 0 && rawMaxPossibleScore !== 100) {
    // Normalize to 100 if raw sum was different (e.g. Easy-only or Medium-only mode)
    finalObtainedScore = Math.round((rawTotalScore / rawMaxPossibleScore) * 100);
  }

  if (finalObtainedScore > 100) finalObtainedScore = 100;
  if (finalObtainedScore < 0) finalObtainedScore = 0;

  const percentage = finalObtainedScore; // Max score is always 100

  let performanceStatus = "Needs Significant Improvement";
  if (percentage >= 80) performanceStatus = "Strong Performance";
  else if (percentage >= 50) performanceStatus = "Developing";

  const unattemptedCount = Math.max(0, 10 - attemptedCount);

  return {
    obtainedScore: finalObtainedScore,
    maxScore: 100,
    percentage,
    attemptedCount,
    unattemptedCount,
    performanceStatus,
    feedback: {
      performanceInsight: parsed.performanceInsight || `Candidate completed ${attemptedCount}/10 questions.`,
      whatWentWell: Array.isArray(parsed.whatWentWell) ? parsed.whatWentWell : [],
      weakAreas: Array.isArray(parsed.weakAreas) ? parsed.weakAreas : [],
      whatToImprove: Array.isArray(parsed.whatToImprove) ? parsed.whatToImprove : [],
      recommendedNextStep: parsed.recommendedNextStep || "Review architectural principles and failure recovery.",
    },
    questionResults,
  };
}
