import RealInterviewHRQuestion from "../../models/RealInterviewHRQuestion.js";
import RealInterviewHRSession from "../../models/RealInterviewHRSession.js";
import Interview from "../../models/Interview.js";
import { generateHRAI, evaluateHRAI } from "../realInterviewAI/hrAI.js";
import { withInFlightLock } from "./inFlightLock.js";
import {
  getUserQuestionHistorySet,
  recordUserQuestionHistory,
  filterUniqueQuestions,
} from "./questionHistoryService.js";

/**
 * Fallback static set of 5 deep HR questions if AI generation API fails (e.g. HTTP 429).
 */
const STATIC_FALLBACK_HR_QUESTIONS = [
  {
    questionIndex: 1,
    question: "You are in a team meeting where everyone supports a project approach that you believe has a major flaw. You are not 100% certain your alternative is perfect. Would you challenge the decision? How would you approach the situation?",
    category: "Self-Awareness & Confidence",
    difficulty: "easy",
    maxMarks: 20,
    behavioralDimensions: ["confidence", "selfAwareness", "communicationClarity"],
    resumeReference: "General Workplace Scenario",
  },
  {
    questionIndex: 2,
    question: "You discover a mistake in your recent work that no one else has noticed yet. Fixing it properly will delay your team's upcoming deadline. What would you do, and why?",
    category: "Accountability & Ownership",
    difficulty: "easy",
    maxMarks: 20,
    behavioralDimensions: ["accountability", "ownership", "integrity"],
    resumeReference: "Workplace Responsibility Scenario",
  },
  {
    questionIndex: 3,
    question: "A teammate publicly challenges your decision in front of others, claiming your approach caused unnecessary delay for their work. How would you respond in that moment, and what would you do afterward?",
    category: "Conflict Handling & Emotional Control",
    difficulty: "medium",
    maxMarks: 20,
    behavioralDimensions: ["conflictHandling", "emotionalControl", "professionalMaturity"],
    resumeReference: "Team Dynamics Scenario",
  },
  {
    questionIndex: 4,
    question: "Your manager unexpectedly changes the project's direction one day before implementation, rendering two weeks of your hard work obsolete. How would you handle this change?",
    category: "Adaptability & Resilience",
    difficulty: "medium",
    maxMarks: 20,
    behavioralDimensions: ["adaptability", "resilience", "professionalMaturity"],
    resumeReference: "Agile Workplace Scenario",
  },
  {
    questionIndex: 5,
    question: "You receive three urgent tasks from different stakeholders, but you only have time to complete two before the deadline. Explain your decision-making process, how you communicate with stakeholders, and what trade-offs you accept.",
    category: "Prioritization & Complex Decision Making",
    difficulty: "hard",
    maxMarks: 20,
    behavioralDimensions: ["prioritization", "decisionMaking", "judgment"],
    resumeReference: "Stakeholder Management Scenario",
  },
  {
    questionIndex: 6,
    question: "Describe a time when you received constructive criticism that you initially disagreed with. How did you digest the feedback, and what changes did you make?",
    category: "Professional Growth & Feedback Acceptance",
    difficulty: "easy",
    maxMarks: 20,
    behavioralDimensions: ["selfAwareness", "adaptability", "growthMindset"],
    resumeReference: "Performance Review Scenario",
  },
  {
    questionIndex: 7,
    question: "How do you build trust with new team members or cross-functional stakeholders when joining a project with high delivery pressure?",
    category: "Team Collaboration & Relationship Building",
    difficulty: "easy",
    maxMarks: 20,
    behavioralDimensions: ["teamwork", "communicationClarity", "trustBuilding"],
    resumeReference: "Cross-Functional Collaboration",
  },
  {
    questionIndex: 8,
    question: "Tell me about a situation where a project failed to meet its objective despite your best efforts. What was your personal takeaway, and how did you apply it to future projects?",
    category: "Resilience & Post-Mortem Learning",
    difficulty: "medium",
    maxMarks: 20,
    behavioralDimensions: ["resilience", "accountability", "learningAgility"],
    resumeReference: "Project Retrospective Scenario",
  },
  {
    questionIndex: 9,
    question: "When working under tight deadlines, how do you ensure code/work quality is not compromised while managing stress and preventing burnout?",
    category: "Workplace Stress & Quality Management",
    difficulty: "medium",
    maxMarks: 20,
    behavioralDimensions: ["stressManagement", "qualityFocus", "ownership"],
    resumeReference: "High-Pressure Delivery Scenario",
  },
  {
    questionIndex: 10,
    question: "Explain a situation where you had to lead an initiative or mentor a junior team member without having formal authority.",
    category: "Leadership & Mentorship",
    difficulty: "medium",
    maxMarks: 20,
    behavioralDimensions: ["leadership", "influence", "mentorship"],
    resumeReference: "Peer Leadership Scenario",
  },
  {
    questionIndex: 11,
    question: "Describe a scenario where technical trade-offs had to be communicated to non-technical business leaders. How did you tailor your communication?",
    category: "Business Acumen & Stakeholder Alignment",
    difficulty: "hard",
    maxMarks: 20,
    behavioralDimensions: ["businessAcumen", "communicationClarity", "stakeholderAlignment"],
    resumeReference: "Technical Leadership Scenario",
  },
  {
    questionIndex: 12,
    question: "How do you navigate working with a team member who consistently delivers below expectations and impacts your team's velocity?",
    category: "Peer Accountability & Team Dynamics",
    difficulty: "hard",
    maxMarks: 20,
    behavioralDimensions: ["peerAccountability", "professionalMaturity", "conflictHandling"],
    resumeReference: "Team Performance Scenario",
  },
  {
    questionIndex: 13,
    question: "Tell me about a time when you had to advocate for ethical considerations or user security over a requested product feature.",
    category: "Integrity & Professional Standards",
    difficulty: "hard",
    maxMarks: 20,
    behavioralDimensions: ["integrity", "ethics", "courage"],
    resumeReference: "Engineering Ethics Scenario",
  },
  {
    questionIndex: 14,
    question: "What motivates you to perform at your best, and how do you align your personal career goals with the company's long-term objectives?",
    category: "Career Vision & Alignment",
    difficulty: "easy",
    maxMarks: 20,
    behavioralDimensions: ["motivation", "careerVision", "alignment"],
    resumeReference: "Career Growth Scenario",
  },
  {
    questionIndex: 15,
    question: "Describe a project where requirements were highly ambiguous. How did you drive clarity and establish milestones?",
    category: "Ambiguity & Problem Solving",
    difficulty: "medium",
    maxMarks: 20,
    behavioralDimensions: ["initiative", "problemSolving", "clarity"],
    resumeReference: "Product Scoping Scenario",
  }
];

/**
 * 1. Generate & Process HR Questions (AI CALL #1)
 * Enforces EXACTLY 5 questions, 20 maxMarks each (Total 100 marks).
 * Enforces maximum 1 AI generation call per session.
 */
export async function generateAndProcessHRQuestions({ userId = null, sessionId, candidateProfile = {} }) {
  if (!sessionId) {
    throw new Error("sessionId is required to generate HR questions.");
  }

  const lockKey = `hr:${sessionId}`;
  return withInFlightLock(lockKey, async () => {
    // Check if session exists
    let session = await RealInterviewHRSession.findOne({ sessionId });

    if (session && (session.generationStatus === "GENERATED" || session.aiGenerationCalls >= 1)) {
      const existingQuestions = await RealInterviewHRQuestion.find({ sessionId }).sort({ orderIndex: 1 });
      if (existingQuestions.length === 5) {
        console.log(`[HRService] Session ${sessionId} already generated (5 questions, aiGenerationCalls: ${session.aiGenerationCalls}). Reusing existing questions.`);
        return {
          success: true,
          sessionId,
          questions: existingQuestions,
          reused: true,
          aiGenerationCalls: session.aiGenerationCalls,
        };
      }
    }

  if (!session) {
    session = new RealInterviewHRSession({
      sessionId,
      userId,
      candidateProfile,
      generationStatus: "GENERATING",
    });
  } else {
    session.generationStatus = "GENERATING";
  }

  session.aiGenerationCalls += 1;
  await session.save();

  console.log(`[HRService] Making AI CALL #1 for session ${sessionId}...`);

  let questionsData = [];
  let fallbackUsed = false;
  const userHistorySet = await getUserQuestionHistorySet(userId);

  try {
    const res = await generateHRAI({ candidateProfile, count: 5 });
    if (res && Array.isArray(res)) {
      questionsData = filterUniqueQuestions(res, userHistorySet);
    }
  } catch (err) {
    console.warn(`[HRService] AI generation call failed (${err.message}). Checking unique fallback pool.`);
  }

  if (questionsData.length < 5) {
    const currentHRSet = new Set(questionsData.map(q => (q.question || "").toLowerCase().trim()));
    const fallbackUnique = filterUniqueQuestions(STATIC_FALLBACK_HR_QUESTIONS, userHistorySet);
    for (const fbQ of fallbackUnique) {
      if (questionsData.length >= 5) break;
      const norm = (fbQ.question || "").toLowerCase().trim();
      currentHRSet.add(norm);
      questionsData.push(fbQ);
    }
    if (questionsData.length < 5) {
      for (const fbQ of STATIC_FALLBACK_HR_QUESTIONS) {
        if (questionsData.length >= 5) break;
        const norm = (fbQ.question || "").toLowerCase().trim();
        if (!currentHRSet.has(norm)) {
          currentHRSet.add(norm);
          questionsData.push(fbQ);
        }
      }
    }
    fallbackUsed = true;
  }

  // Ensure exactly 5 questions
  const finalQuestionsData = questionsData.slice(0, 5);

  // Clear existing questions for session if re-attempting
  await RealInterviewHRQuestion.deleteMany({ sessionId });

  const createdQuestions = [];
  for (let i = 0; i < finalQuestionsData.length; i++) {
    const item = finalQuestionsData[i];
    const qDoc = new RealInterviewHRQuestion({
      sessionId,
      userId,
      orderIndex: i + 1,
      question: item.question,
      category: item.category || "Behavioral",
      difficulty: i < 2 ? "easy" : i < 4 ? "medium" : "hard",
      maxMarks: 20,
      behavioralDimensions: item.behavioralDimensions || ["decisionMaking", "ownership"],
      resumeReference: item.resumeReference || "",
      source: fallbackUsed ? "static_fallback" : "ai_generated",
    });
    const saved = await qDoc.save();
    createdQuestions.push(saved);
  }

  if (userId && sessionId) {
    await recordUserQuestionHistory({ userId, sessionId, round: "hr", questions: createdQuestions });
  }

  session.generationStatus = "GENERATED";
  session.fallbackUsed = fallbackUsed;
  await session.save();

  return {
    success: true,
    sessionId,
    count: createdQuestions.length,
    questions: createdQuestions,
    reused: false,
    fallbackUsed,
    aiGenerationCalls: session.aiGenerationCalls,
  };
 });
}

/**
 * 2. Get Next HR Question (ZERO AI CALLS)
 */
export async function getNextHRQuestion({ sessionId }) {
  if (!sessionId) {
    throw new Error("sessionId is required to fetch next HR question.");
  }

  const session = await RealInterviewHRSession.findOne({ sessionId });
  if (!session) {
    throw new Error(`HR Session not found for ID: ${sessionId}`);
  }

  const allQuestions = await RealInterviewHRQuestion.find({ sessionId }).sort({ orderIndex: 1 });
  if (allQuestions.length === 0) {
    throw new Error("No HR questions found for this session. Please call /generate first.");
  }

  const answeredQuestionIds = new Set(session.answers.map((a) => String(a.questionId)));
  const nextQuestion = allQuestions.find((q) => !answeredQuestionIds.has(String(q._id)));

  if (!nextQuestion) {
    return {
      success: true,
      completed: true,
      message: "All 5 HR questions have been answered.",
      totalQuestions: allQuestions.length,
      questionsAnswered: session.answers.length,
    };
  }

  return {
    success: true,
    completed: false,
    question: {
      _id: nextQuestion._id,
      sessionId: nextQuestion.sessionId,
      orderIndex: nextQuestion.orderIndex,
      question: nextQuestion.question,
      category: nextQuestion.category,
      maxMarks: 20,
      behavioralDimensions: nextQuestion.behavioralDimensions,
      resumeReference: nextQuestion.resumeReference,
    },
    progress: {
      currentQuestionIndex: session.answers.length + 1,
      totalQuestions: allQuestions.length,
    },
  };
}

/**
 * 3. Submit HR Answer (ZERO AI CALLS)
 */
export async function submitHRAnswer({ sessionId, questionId, candidateAnswer, userId = null }) {
  if (!sessionId || !questionId) {
    throw new Error("sessionId and questionId are required to submit HR answer.");
  }

  const session = await RealInterviewHRSession.findOne({ sessionId });
  if (!session) {
    throw new Error(`HR Session not found for ID: ${sessionId}`);
  }

  const qDoc = await RealInterviewHRQuestion.findById(questionId);
  if (!qDoc) {
    throw new Error(`HR Question not found for ID: ${questionId}`);
  }

  const existingIdx = session.answers.findIndex((a) => String(a.questionId) === String(questionId));

  const answerPayload = {
    questionId: qDoc._id,
    question: qDoc.question,
    difficulty: qDoc.difficulty,
    maxScore: 20,
    category: qDoc.category,
    behavioralDimensions: qDoc.behavioralDimensions,
    resumeReference: qDoc.resumeReference,
    candidateAnswer: String(candidateAnswer || "").trim(),
    submittedAt: new Date(),
  };

  if (existingIdx >= 0) {
    session.answers[existingIdx] = { ...session.answers[existingIdx].toObject(), ...answerPayload };
  } else {
    session.answers.push(answerPayload);
  }

  session.questionsAnswered = session.answers.length;
  session.currentQuestionIndex = session.answers.length;
  if (userId && !session.userId) {
    session.userId = userId;
  }

  await session.save();

  return {
    success: true,
    message: "HR Answer recorded successfully (0 AI calls).",
    sessionId,
    questionId,
    questionsAnswered: session.answers.length,
    totalQuestions: 5,
  };
}

/**
 * Helper: Calculate overall HR rating from percentage
 */
function getHROverallRating(percentage) {
  if (percentage >= 90) return "Exceptional";
  if (percentage >= 80) return "Very Strong";
  if (percentage >= 70) return "Strong";
  if (percentage >= 60) return "Good";
  if (percentage >= 50) return "Average";
  if (percentage >= 40) return "Needs Improvement";
  return "Weak";
}

/**
 * 4. Complete Batch Evaluation for HR Session (AI CALL #2)
 * Evaluates all 5 answers in ONE request.
 * Backend strictly validates individual scores (0-20) and calculates totalScore & percentage itself.
 */
export async function evaluateHRInterviewSession({ sessionId, candidateProfile = {} }) {
  if (!sessionId) {
    throw new Error("sessionId parameter is required for evaluation.");
  }

  const session = await RealInterviewHRSession.findOne({ sessionId });
  if (!session) {
    throw new Error(`HR Session not found for ID: ${sessionId}`);
  }

  if (session.evaluationCompleted || session.evaluationStatus === "COMPLETED" || session.aiEvaluationCalls >= 1) {
    console.log(`[HRService] Session ${sessionId} already evaluated (aiEvaluationCalls: ${session.aiEvaluationCalls}). Reusing stored evaluation.`);
    return {
      success: true,
      sessionId,
      totalScore: session.totalScore,
      maxScore: session.maxScore,
      percentage: session.percentage,
      overallRating: session.overallRating,
      behavioralProfile: session.behavioralProfile,
      strengths: session.strengths,
      areasForImprovement: session.areasForImprovement,
      consistencyObservations: session.consistencyObservations,
      finalFeedback: session.finalFeedback,
      evaluations: session.answers,
      reused: true,
      fallbackUsed: session.fallbackUsed,
      aiEvaluationCalls: session.aiEvaluationCalls,
    };
  }

  const questionsWithAnswers = await RealInterviewHRQuestion.find({ sessionId }).sort({ orderIndex: 1 });
  if (questionsWithAnswers.length === 0) {
    throw new Error("No questions found for this session to evaluate.");
  }

  const mainInterviewDoc = await Interview.findById(sessionId).lean().catch(() => null);
  const mainInterviewAnswers = mainInterviewDoc?.answers || [];

  const qaPairs = questionsWithAnswers.map((q) => {
    const qIdStr = q._id.toString();
    const ansObj = session.answers.find((a) => String(a.questionId) === qIdStr);
    const mainAnsMatch = mainInterviewAnswers.find((a) => String(a.questionId) === qIdStr);
    const rawAns = (ansObj?.candidateAnswer || mainAnsMatch?.answer || mainAnsMatch?.transcript || "").trim();
    const finalAnsText = rawAns.length > 0 ? rawAns : "(No answer provided)";

    return {
      questionId: q._id,
      question: q.question,
      category: q.category,
      behavioralDimensions: q.behavioralDimensions,
      candidateAnswer: finalAnsText,
    };
  });

  session.evaluationStatus = "EVALUATING";
  session.aiEvaluationCalls += 1;
  session.evaluationStartedAt = new Date();
  await session.save();

  console.log(`[HRService] Making AI CALL #2 (complete evaluation) for session ${sessionId}...`);

  let evalResult;
  let fallbackUsed = false;

  try {
    evalResult = await evaluateHRAI({
      candidateProfile: candidateProfile && Object.keys(candidateProfile).length ? candidateProfile : session.candidateProfile,
      questionsWithAnswers: qaPairs,
    });
  } catch (err) {
    console.warn(`[HRService] AI evaluation call failed (${err.message}). Applying deterministic application-level fallback evaluation.`);
    fallbackUsed = true;
    
    console.log(`\n[REAL-INTERVIEW][EVALUATION-FALLBACK]\nround=hr\nreason=${err.message}\nevaluationSource=deterministic_fallback\n`);

    // Deterministic Application-level Fallback
    const fallbackEvals = qaPairs.map((pair) => {
      const ans = String(pair.candidateAnswer || "").trim();
      const isUnanswered = !ans || ans === "(No answer provided)" || ans.toLowerCase() === "not answered";

      return {
        questionId: pair.questionId,
        score: 0,
        maxScore: 20,
        evaluationSource: "deterministic_fallback",
        behavioralDimensions: { ownership: 0, decisionMaking: 0, professionalMaturity: 0 },
        reasoningStrengths: [],
        concerns: isUnanswered ? ["Question was not attempted"] : ["Automated AI evaluation was unavailable for this response"],
        feedback: isUnanswered
          ? "Question was not attempted."
          : "Automated detailed evaluation was unavailable for this response. Answer preserved for review.",
        betterAnswer: "Structured behavioral response addressing the scenario with decision reasoning and trade-offs.",
      };
    });

    evalResult = {
      evaluations: fallbackEvals,
      overallRating: "Unverified",
      behavioralProfile: { ownership: 0, decisionMaking: 0, professionalMaturity: 0 },
      consistencyObservations: [],
      strengths: ["Candidate HR answers preserved in session"],
      areasForImprovement: ["Automated AI evaluation service was unavailable"],
      finalFeedback: "Completed HR assessment with deterministic fallback because AI evaluation was unavailable.",
    };
  }

  // BACKEND VALIDATION & CALCULATION:
  // Validate individual question scores (0-20) and compute totalScore strictly on backend
  let totalScore = 0;
  const rawEvaluations = Array.isArray(evalResult.evaluations) ? evalResult.evaluations : [];

  qaPairs.forEach((pair) => {
    const matchingEval = rawEvaluations.find((e) => String(e.questionId) === String(pair.questionId)) || {};
    let score = typeof matchingEval.score === "number" ? matchingEval.score : 10;
    if (score < 0) score = 0;
    if (score > 20) score = 20;

    totalScore += score;

    const ansIdx = session.answers.findIndex((a) => String(a.questionId) === String(pair.questionId));
    if (ansIdx >= 0) {
      session.answers[ansIdx].candidateAnswer = (session.answers[ansIdx].candidateAnswer && session.answers[ansIdx].candidateAnswer !== "(No answer provided)")
        ? session.answers[ansIdx].candidateAnswer
        : pair.candidateAnswer;
      session.answers[ansIdx].score = score;
      session.answers[ansIdx].maxScore = 20;
      session.answers[ansIdx].rating = score >= 16 ? "Exceptional" : score >= 11 ? "Strong" : "Average";
      session.answers[ansIdx].reasoningStrengths = matchingEval.reasoningStrengths || [];
      session.answers[ansIdx].concerns = matchingEval.concerns || [];
      session.answers[ansIdx].feedback = matchingEval.feedback || "";
      session.answers[ansIdx].betterAnswer = matchingEval.betterAnswer || "";
    } else {
      session.answers.push({
        questionId: pair.questionId,
        question: pair.question,
        difficulty: pair.difficulty || "medium",
        category: pair.category,
        candidateAnswer: pair.candidateAnswer,
        score,
        maxScore: 20,
        rating: score >= 16 ? "Exceptional" : score >= 11 ? "Strong" : "Average",
        reasoningStrengths: matchingEval.reasoningStrengths || [],
        concerns: matchingEval.concerns || [],
        feedback: matchingEval.feedback || "",
        betterAnswer: matchingEval.betterAnswer || "",
      });
    }
  });

  const maxScore = 100; // 5 questions x 20 maxMarks
  const percentage = Math.round((totalScore / maxScore) * 100);
  const overallRating = getHROverallRating(percentage);

  session.totalScore = totalScore;
  session.maxScore = maxScore;
  session.percentage = percentage;
  session.overallRating = overallRating;
  session.behavioralProfile = evalResult.behavioralProfile || {};
  session.consistencyObservations = evalResult.consistencyObservations || [];
  session.strengths = evalResult.strengths || ["Constructive communication", "Accountability"];
  session.areasForImprovement = evalResult.areasForImprovement || ["Elaborate trade-offs"];
  session.finalFeedback = evalResult.finalFeedback || "Completed HR behavioral interview.";
  session.evaluationCompleted = true;
  session.evaluationStatus = "COMPLETED";
  session.status = "completed";
  session.fallbackUsed = fallbackUsed;
  session.evaluationCompletedAt = new Date();

  await session.save();

  console.log(`[HRService] Evaluation complete for session ${sessionId}. Total score: ${totalScore}/100 (${percentage}%). Fallback used: ${fallbackUsed}`);

  return {
    success: true,
    sessionId,
    totalScore,
    maxScore,
    percentage,
    overallRating,
    behavioralProfile: session.behavioralProfile,
    consistencyObservations: session.consistencyObservations,
    strengths: session.strengths,
    areasForImprovement: session.areasForImprovement,
    finalFeedback: session.finalFeedback,
    evaluations: session.answers,
    reused: false,
    fallbackUsed,
    aiEvaluationCalls: session.aiEvaluationCalls,
  };
}
