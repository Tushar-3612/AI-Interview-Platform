import {
  generateProjectAI,
  evaluateProjectInterviewAI,
} from "../realInterviewAI/projectAI.js";
import RealInterviewProjectQuestion from "../../models/RealInterviewProjectQuestion.js";
import RealInterviewProjectSession from "../../models/RealInterviewProjectSession.js";
import Interview from "../../models/Interview.js";
import { withInFlightLock } from "./inFlightLock.js";
import {
  getUserQuestionHistorySet,
  recordUserQuestionHistory,
  filterUniqueQuestions,
  normalizeQuestionText,
} from "./questionHistoryService.js";
import { isQuestionGroundedInResume, getOrBuildCandidateResumeContext } from "../../utils/resumeContextBuilder.js";

/**
 * Generates or retrieves existing 10 Project/Resume questions for a Real Interview session (AI CALL #1).
 * Enforces IDEMPOTENCY: Does NOT re-generate questions if aiGenerationCalls >= 1 or 10 questions exist.
 */
export async function generateAndProcessProjectQuestions({
  userId = null,
  sessionId = null,
  candidateProfile = {},
} = {}) {
  if (!sessionId) {
    throw new Error("sessionId is required for project question generation");
  }

  const lockKey = `project:${sessionId}`;
  return withInFlightLock(lockKey, async () => {
    let session = await RealInterviewProjectSession.findOne({ sessionId });

    const existingQuestions = await RealInterviewProjectQuestion.find({ sessionId }).sort({
      orderIndex: 1,
    });

  if (
    (session && (session.aiGenerationCalls >= 1 || session.generationStatus === "GENERATED")) ||
    existingQuestions.length >= 10
  ) {
    console.log(
      `[ProjectService] Session ${sessionId} already generated (${existingQuestions.length} questions, aiGenerationCalls: ${session?.aiGenerationCalls || 1}). Reusing existing questions without AI call.`
    );

    if (!session) {
      session = await RealInterviewProjectSession.create({
        sessionId,
        userId,
        currentQuestionIndex: 0,
        strongAnswerCount: 0,
        hardUnlocked: false,
        questionsAnswered: 0,
        answers: [],
        status: "in_progress",
        generationStatus: "GENERATED",
        aiGenerationCalls: 1,
      });
    }

    const studentQuestions = existingQuestions.slice(0, 10).map((q) => ({
      id: q._id.toString(),
      question: q.question,
      difficulty: q.difficulty,
      maxMarks: q.maxMarks || (q.difficulty === "easy" ? 5 : q.difficulty === "hard" ? 20 : 10),
      topic: q.topic,
      category: q.category,
      projectName: q.projectName,
      source: q.source,
    }));

    return {
      success: true,
      message: "Reused existing 10 project questions",
      count: studentQuestions.length,
      questions: studentQuestions,
      reused: true,
      aiGenerationCalls: session.aiGenerationCalls || 1,
    };
  }

  // AI CALL #1: Generate 10 deep project questions
  console.log(`[ProjectService] Making AI CALL #1 for session ${sessionId}...`);
  const effectiveProfile = await getOrBuildCandidateResumeContext(userId, candidateProfile);
  let aiResult;
  const userHistorySet = await getUserQuestionHistorySet(userId);

  try {
    aiResult = await generateProjectAI(effectiveProfile);
  } catch (genErr) {
    console.warn(`[ProjectService] AI generation failed (${genErr.message}). Using fault-tolerant project question pool.`);
    aiResult = { questions: [] };
  }

  const currentPoolSet = new Set();
  const rawAiQuestions = (aiResult?.questions || []).filter((q) => isQuestionGroundedInResume(q, "project", effectiveProfile));
  const userProjects = Array.isArray(effectiveProfile.projects) && effectiveProfile.projects.length > 0
    ? effectiveProfile.projects
    : [];
  let rawQuestions = filterUniqueQuestions(rawAiQuestions, userHistorySet, currentPoolSet);
  rawQuestions.forEach((q) => { q.source = q.source || "ai_generated"; });

  if (rawQuestions.length < 10) {
    console.log(`[ProjectService] AI returned ${rawQuestions.length}/10 questions. Using static fallback pool for remainder.`);

    const buildGroundedFallbackQuestions = (projects) => {
      const fallbacks = [];
      if (!projects || projects.length === 0) {
        const openEndedList = [
          "Can you describe the primary software engineering project you worked on recently and its key technical objectives?",
          "What was the most challenging technical roadblock you encountered during project development, and how did you resolve it?",
          "How did you structure your components and modularize source code for maintainability?",
          "What was your approach to testing, debugging, and verifying functionality in your software projects?",
          "How did you handle environment variables, configuration parameters, and sensitive credentials safely?",
          "What trade-offs did you consider when selecting programming languages and framework technologies for your project?",
          "How did you handle error logging, exception boundaries, and user feedback in your application?",
          "If you were to refactor your recent project today, what architectural decisions or tooling would you change and why?",
          "Describe how you collaborated, managed version control, and tracked technical tasks during project development.",
          "What key software engineering practices or lessons did you learn from completing your software projects?"
        ];
        openEndedList.forEach((qText, idx) => {
          fallbacks.push({
            question: qText,
            difficulty: idx < 4 ? "easy" : idx < 8 ? "medium" : "hard",
            category: "resume_project",
            topic: "Project Engineering",
            projectName: "Software Project",
            expectedKnowledge: "Clean software engineering practices, problem solving, and architecture reasoning."
          });
        });
        return fallbacks;
      }

      projects.forEach((proj) => {
        const name = proj.name || proj.title || "Project";
        const desc = proj.description || "";
        const techs = Array.isArray(proj.technologies) ? proj.technologies : [];
        const techStr = techs.length > 0 ? techs.join(", ") : "the core technologies listed";

        fallbacks.push({
          question: `Can you explain the high-level architecture of your "${name}" project and the rationale behind using ${techStr}?`,
          difficulty: "easy",
          category: "resume_project",
          topic: "System Architecture",
          projectName: name,
          expectedKnowledge: "Component hierarchy, tech selection rationale, and system workflow."
        });

        fallbacks.push({
          question: `What was the most challenging technical problem you encountered while developing "${name}", and how did you resolve it?`,
          difficulty: "easy",
          category: "resume_project",
          topic: "Problem Solving",
          projectName: name,
          expectedKnowledge: "Debugging workflow, root cause investigation, and structural resolution."
        });

        if (techs.length > 0) {
          fallbacks.push({
            question: `How did you integrate and utilize ${techs.slice(0, 2).join(" and ")} within your "${name}" project?`,
            difficulty: "medium",
            category: "resume_project",
            topic: "Technology Integration",
            projectName: name,
            expectedKnowledge: "Framework usage, API flow, and data handling details."
          });
        }

        fallbacks.push({
          question: `Reflecting on "${name}", what technical trade-offs did you make during development, and what would you change if rebuilding it today?`,
          difficulty: "hard",
          category: "resume_project",
          topic: "Architecture Trade-offs",
          projectName: name,
          expectedKnowledge: "Technical debt evaluation, modern tool adoption rationale, and engineering maturity."
        });
      });

      const defaultProj = projects[0]?.name || projects[0]?.title || "your project";
      const extraList = [
        `How did you structure your source code directories and module boundaries in "${defaultProj}"?`,
        `What strategy did you use for input validation and error handling across components in "${defaultProj}"?`,
        `How did you test and verify functionality before completing "${defaultProj}"?`,
        `Describe the data flow when a user initiates a main action or request in "${defaultProj}".`
      ];
      extraList.forEach((qText, idx) => {
        fallbacks.push({
          question: qText,
          difficulty: idx % 2 === 0 ? "medium" : "hard",
          category: "resume_project",
          topic: "Code Architecture",
          projectName: defaultProj,
          expectedKnowledge: "Clean code structure and validation."
        });
      });

      return fallbacks;
    };

    const STATIC_PROJECT_FALLBACK = buildGroundedFallbackQuestions(userProjects);

    const fallbackUnique = filterUniqueQuestions(STATIC_PROJECT_FALLBACK, userHistorySet, currentPoolSet);
    for (const fbQ of fallbackUnique) {
      if (rawQuestions.length >= 10) break;
      currentPoolSet.add(normalizeQuestionText(fbQ.question));
      rawQuestions.push({ ...fbQ, source: "static_fallback" });
    }

    if (rawQuestions.length < 10) {
      for (const fbQ of STATIC_PROJECT_FALLBACK) {
        if (rawQuestions.length >= 10) break;
        const norm = normalizeQuestionText(fbQ.question);
        if (!currentPoolSet.has(norm)) {
          currentPoolSet.add(norm);
          rawQuestions.push({ ...fbQ, source: "static_fallback" });
        }
      }
    }
  }

  // Ensure rawQuestions has at least 10 unique valid entries
  if (rawQuestions.length < 10) {
    const defaultProjName = userProjects.length > 0 ? (userProjects[0].title || userProjects[0].name || "your project") : "your project";
    const backupList = [
      `Walk through your project directory structure for "${defaultProjName}" and explain how you modularized your code.`,
      `How did you handle environment variables and sensitive configuration credentials in "${defaultProjName}"?`,
      `What technical challenges or responsive layout issues did you solve in "${defaultProjName}"?`,
      `Describe how you optimized database or data processing response times in "${defaultProjName}".`,
      `How did you handle error logging and debugging in "${defaultProjName}"?`
    ];
    for (const bText of backupList) {
      if (rawQuestions.length >= 10) break;
      const norm = normalizeQuestionText(bText);
      if (!currentPoolSet.has(norm)) {
        currentPoolSet.add(norm);
        rawQuestions.push({
          question: bText,
          difficulty: rawQuestions.length < 4 ? "easy" : rawQuestions.length < 8 ? "medium" : "hard",
          category: "resume_project",
          topic: "Project Engineering",
          projectName: defaultProjName,
          expectedKnowledge: "Clean code structure, security, and optimization.",
          source: "static_fallback"
        });
      }
    }
  }

  // Sort raw questions by difficulty preference ("easy" -> "medium" -> "hard")
  const easyPool = rawQuestions.filter((q) => String(q.difficulty).toLowerCase() === "easy");
  const mediumPool = rawQuestions.filter((q) => String(q.difficulty).toLowerCase() === "medium");
  const hardPool = rawQuestions.filter((q) => String(q.difficulty).toLowerCase() === "hard");
  const otherPool = rawQuestions.filter(
    (q) => !["easy", "medium", "hard"].includes(String(q.difficulty).toLowerCase())
  );

  const poolCombined = [...easyPool, ...mediumPool, ...hardPool, ...otherPool];
  const selectedQuestions = poolCombined.slice(0, 10);
  const fallbackUsed = selectedQuestions.some((q) => q.source === "static_fallback");
  const aiCount = selectedQuestions.filter((q) => q.source === "ai_generated").length;

  console.log(
    `\n[REAL-INTERVIEW][QUESTION-SOURCE]\nround=project\nsource=${fallbackUsed ? (aiCount > 0 ? "partial_static_fallback" : "static_fallback") : "ai_generated"}\nresumeContext=${Boolean(effectiveProfile && effectiveProfile.projects?.length > 0)}\nreason=${fallbackUsed ? `AI generated ${aiCount}/10 grounded questions` : "AI generated 10 grounded questions successfully"}\n`
  );

  // Enforce EXACTLY 4 Easy (5m), 4 Medium (10m), 2 Hard (20m) -> Total = 100 Marks
  const validatedDocs = selectedQuestions.map((q, idx) => {
    const questionText = String(q.question || "").trim();
    if (!questionText) {
      throw new Error(`Project Question #${idx + 1} has empty question text`);
    }

    const expectedKnowledge = String(
      q.expectedKnowledge ||
        q.expected_knowledge ||
        q.expectedAnswer ||
        "Demonstrate clear project workflow, architecture reasoning, and technical implementation details."
    ).trim();

    // Assign difficulty strictly based on index slot to guarantee 100 max marks (4 Easy, 4 Medium, 2 Hard)
    const validDiff = idx < 4 ? "easy" : idx < 8 ? "medium" : "hard";
    const maxMarks = validDiff === "easy" ? 5 : validDiff === "hard" ? 20 : 10;

    const topic = String(q.topic || "Project Workflow & Architecture").trim();
    const category = String(q.category || "Architecture").trim();
    const projectName = String(q.projectName || "").trim();

    return {
      sessionId,
      userId,
      orderIndex: idx,
      question: questionText,
      expectedKnowledge,
      difficulty: validDiff,
      maxMarks,
      topic,
      category,
      projectName,
      source: "resume_project",
    };
  });

  const savedQuestions = await RealInterviewProjectQuestion.insertMany(validatedDocs);
  if (userId && sessionId) {
    await recordUserQuestionHistory({ userId, sessionId, round: "resume_project", questions: savedQuestions });
  }

  if (!session) {
    session = await RealInterviewProjectSession.create({
      sessionId,
      userId,
      currentQuestionIndex: 0,
      strongAnswerCount: 0,
      hardUnlocked: false,
      questionsAnswered: 0,
      answers: [],
      status: "in_progress",
      generationStatus: "GENERATED",
      aiGenerationCalls: 1,
    });
  } else {
    session.generationStatus = "GENERATED";
    session.aiGenerationCalls = 1;
    await session.save();
  }

  const studentQuestions = savedQuestions.map((q) => ({
    id: q._id.toString(),
    question: q.question,
    difficulty: q.difficulty,
    maxMarks: q.maxMarks,
    topic: q.topic,
    category: q.category,
    projectName: q.projectName,
    source: q.source,
  }));

    return {
      success: true,
      message: "10 resume-project questions generated successfully",
      count: studentQuestions.length,
      questions: studentQuestions,
      reused: false,
      aiGenerationCalls: 1,
    };
  });
}

/**
 * Retrieves candidate's next adaptive Project question.
 * ZERO AI CALLS.
 */
export async function getNextProjectQuestion({ sessionId }) {
  if (!sessionId) {
    throw new Error("sessionId is required");
  }

  const session = await RealInterviewProjectSession.findOne({ sessionId });
  if (!session) {
    throw new Error("Project session not found for this sessionId");
  }

  if (session.status === "completed" || session.questionsAnswered >= 10) {
    return {
      success: true,
      completed: true,
      message: "Project round completed",
    };
  }

  const allQuestions = await RealInterviewProjectQuestion.find({ sessionId }).sort({
    orderIndex: 1,
  });

  if (allQuestions.length === 0) {
    throw new Error("No project questions found for this session. Generate questions first.");
  }

  const answeredQuestionIds = (session.answers || []).map((a) => a.questionId.toString());
  const unanswered = allQuestions.filter((q) => !answeredQuestionIds.includes(q._id.toString()));

  if (unanswered.length === 0) {
    session.status = "completed";
    await session.save();
    return {
      success: true,
      completed: true,
      message: "All project questions answered",
    };
  }

  let candidatePool = unanswered;
  if (!session.hardUnlocked) {
    const easyMediumPool = unanswered.filter((q) => q.difficulty !== "hard");
    if (easyMediumPool.length > 0) {
      candidatePool = easyMediumPool;
    }
  }

  const selectedQuestion = candidatePool[0];

  return {
    success: true,
    completed: false,
    question: {
      id: selectedQuestion._id.toString(),
      question: selectedQuestion.question,
      difficulty: selectedQuestion.difficulty,
      maxMarks: selectedQuestion.maxMarks || (selectedQuestion.difficulty === "easy" ? 5 : selectedQuestion.difficulty === "hard" ? 20 : 10),
      topic: selectedQuestion.topic,
      category: selectedQuestion.category,
      projectName: selectedQuestion.projectName,
      source: selectedQuestion.source,
      questionNumber: session.questionsAnswered + 1,
      totalQuestions: 10,
    },
    adaptiveState: {
      strongAnswerCount: session.strongAnswerCount,
      hardUnlocked: session.hardUnlocked,
      questionsAnswered: session.questionsAnswered,
      totalQuestions: 10,
    },
  };
}

/**
 * Submits candidate's project answer.
 * STRICTLY ZERO AI CALLS.
 */
export async function submitProjectAnswer({
  sessionId,
  questionId,
  candidateAnswer,
  userId = null,
}) {
  if (!sessionId || !questionId) {
    throw new Error("sessionId and questionId are required");
  }

  const questionDoc = await RealInterviewProjectQuestion.findById(questionId);
  if (!questionDoc) {
    throw new Error("Question not found");
  }

  const session = await RealInterviewProjectSession.findOne({ sessionId });
  if (!session) {
    throw new Error("Project session not found");
  }

  const existingAnswerIndex = session.answers.findIndex(
    (a) => a.questionId.toString() === questionId
  );
  if (existingAnswerIndex !== -1) {
    return {
      success: true,
      message: "Answer already recorded previously",
      questionId,
      adaptiveState: {
        strongAnswerCount: session.strongAnswerCount,
        hardUnlocked: session.hardUnlocked,
        questionsAnswered: session.questionsAnswered,
        totalQuestions: 10,
        completed: session.questionsAnswered >= 10 || session.status === "completed",
      },
    };
  }

  const cleanAnswer = String(candidateAnswer || "").trim();

  const isSubstantialAnswer = cleanAnswer.length >= 15;
  if (isSubstantialAnswer) {
    session.strongAnswerCount += 1;
  }

  if (session.strongAnswerCount >= 2) {
    session.hardUnlocked = true;
  }

  session.questionsAnswered += 1;
  session.currentQuestionIndex = session.questionsAnswered;

  if (session.questionsAnswered >= 10) {
    session.status = "completed";
  }

  const maxScore = questionDoc.maxMarks || (questionDoc.difficulty === "easy" ? 5 : questionDoc.difficulty === "hard" ? 20 : 10);

  const answerRecord = {
    questionId: questionDoc._id,
    question: questionDoc.question,
    difficulty: questionDoc.difficulty,
    maxScore,
    topic: questionDoc.topic,
    category: questionDoc.category,
    projectName: questionDoc.projectName,
    candidateAnswer: cleanAnswer,
    submittedAt: new Date(),
  };

  session.answers.push(answerRecord);
  await session.save();

  return {
    success: true,
    message: "Candidate answer stored successfully (No AI call executed)",
    questionId,
    adaptiveState: {
      strongAnswerCount: session.strongAnswerCount,
      hardUnlocked: session.hardUnlocked,
      questionsAnswered: session.questionsAnswered,
      totalQuestions: 10,
      completed: session.questionsAnswered >= 10 || session.status === "completed",
    },
  };
}

/**
 * Evaluates ALL 10 candidate project answers in ONE SINGLE AI API Request after completion (AI CALL #2).
 * Includes safe deterministic application-level fallback if AI request fails (e.g. rate limit/network error).
 */
export async function evaluateProjectInterviewSession({ sessionId, candidateProfile = {} }) {
  if (!sessionId) {
    throw new Error("sessionId is required for evaluation");
  }

  const session = await RealInterviewProjectSession.findOne({ sessionId });
  if (!session) {
    throw new Error("Project session not found for evaluation");
  }

  // Idempotency Check
  if (
    session.aiEvaluationCalls >= 1 ||
    session.evaluationStatus === "COMPLETED" ||
    session.evaluationCompleted
  ) {
    console.log(
      `[ProjectService] Session ${sessionId} already evaluated (aiEvaluationCalls: ${session.aiEvaluationCalls}). Reusing stored evaluation without AI call.`
    );
    return {
      success: true,
      message: "Reused existing project evaluation result",
      sessionId,
      totalScore: session.totalScore || session.overallScore || 0,
      maxScore: session.maxScore || 100,
      percentage: session.percentage || 0,
      overallRating: session.overallRating || "N/A",
      strengths: session.strengths || [],
      weaknesses: session.weaknesses || [],
      finalFeedback: session.finalFeedback || "",
      evaluations: session.answers.map((a) => ({
        questionId: a.questionId.toString(),
        question: a.question,
        candidateAnswer: a.candidateAnswer,
        score: a.score || 0,
        maxScore: a.maxScore || (a.difficulty === "easy" ? 5 : a.difficulty === "hard" ? 20 : 10),
        difficulty: a.difficulty,
        rating: a.rating || "weak",
        correctPoints: a.correctPoints || [],
        missingPoints: a.missingPoints || [],
        incorrectPoints: a.incorrectPoints || [],
        grammarIssues: a.grammarIssues || [],
        feedback: a.feedback || "",
        betterAnswer: a.betterAnswer || "",
      })),
      reused: true,
      aiEvaluationCalls: session.aiEvaluationCalls,
    };
  }

  const allQuestions = await RealInterviewProjectQuestion.find({ sessionId }).sort({
    orderIndex: 1,
  });

  if (allQuestions.length === 0) {
    throw new Error("No project questions found for evaluation in this session");
  }

  const mainInterviewDoc = await Interview.findById(sessionId).lean().catch(() => null);
  const mainInterviewAnswers = mainInterviewDoc?.answers || [];

  const questionsToEvaluate = allQuestions.map((q) => {
    const qIdStr = q._id.toString();
    const matchedAnswer = (session.answers || []).find(
      (a) => a.questionId.toString() === qIdStr
    );
    const mainAnsMatch = mainInterviewAnswers.find(
      (a) => String(a.questionId) === qIdStr
    );

    const rawAns = (matchedAnswer?.candidateAnswer || mainAnsMatch?.answer || mainAnsMatch?.transcript || "").trim();
    const finalAnsText = rawAns.length > 0 ? rawAns : "(No answer submitted)";
    const maxScore = q.maxMarks || (q.difficulty === "easy" ? 5 : q.difficulty === "hard" ? 20 : 10);

    return {
      questionId: qIdStr,
      question: q.question,
      difficulty: q.difficulty,
      maxScore,
      topic: q.topic,
      category: q.category,
      projectName: q.projectName,
      expectedKnowledge: q.expectedKnowledge || `Architectural and technical implementation details for ${q.projectName || q.topic || "project"}.`,
      candidateAnswer: finalAnsText,
    };
  });

  session.evaluationStatus = "EVALUATING";
  session.evaluationStartedAt = new Date();
  await session.save();

  console.log(`[ProjectService] Making AI CALL #2 (complete evaluation) for session ${sessionId}...`);
  let evalResult;
  let isFallback = false;

  try {
    evalResult = await evaluateProjectInterviewAI({
      candidateProfile,
      questions: questionsToEvaluate,
    });
  } catch (evalErr) {
    console.warn(`[ProjectService] AI evaluation call failed (${evalErr.message}). Applying deterministic application-level fallback evaluation.`);
    isFallback = true;
    evalResult = generateDeterministicProjectFallback(questionsToEvaluate, evalErr.message);
  }

  const evaluationsList = Array.isArray(evalResult.evaluations) ? evalResult.evaluations : [];
  let calculatedTotalScore = 0;

  for (const q of allQuestions) {
    const qIdStr = q._id.toString();
    const itemEval = evaluationsList.find((e) => String(e.questionId) === qIdStr) || {};
    const mainAnsMatch = mainInterviewAnswers.find((a) => String(a.questionId) === qIdStr);
    const maxScore = q.maxMarks || (q.difficulty === "easy" ? 5 : q.difficulty === "hard" ? 20 : 10);

    const rawScore = Number(itemEval.score);
    const score = isNaN(rawScore) ? 0 : Math.max(0, Math.min(maxScore, Math.round(rawScore)));
    calculatedTotalScore += score;

    const ratingCandidate = String(itemEval.rating || "").trim();
    const rating = ratingCandidate || (
      score >= maxScore * 0.8 ? "Strong" : score >= maxScore * 0.5 ? "Acceptable" : "Weak"
    );

    const existingAnsIndex = session.answers.findIndex(
      (a) => a.questionId.toString() === qIdStr
    );

    const answerData = {
      questionId: q._id,
      question: q.question,
      difficulty: q.difficulty,
      maxScore,
      topic: q.topic,
      category: q.category,
      projectName: q.projectName,
      candidateAnswer: (existingAnsIndex !== -1 && session.answers[existingAnsIndex].candidateAnswer && session.answers[existingAnsIndex].candidateAnswer !== "(No answer submitted)")
        ? session.answers[existingAnsIndex].candidateAnswer
        : (mainAnsMatch?.answer || mainAnsMatch?.transcript || "(No answer submitted)"),
      score,
      rating,
      evaluationSource: itemEval.evaluationSource || (isFallback ? "deterministic_fallback" : "ai_evaluated"),
      correctPoints: Array.isArray(itemEval.correctPoints) ? itemEval.correctPoints : [],
      missingPoints: Array.isArray(itemEval.missingPoints) ? itemEval.missingPoints : [],
      incorrectPoints: Array.isArray(itemEval.incorrectPoints) ? itemEval.incorrectPoints : [],
      grammarIssues: Array.isArray(itemEval.grammarIssues) ? itemEval.grammarIssues : [],
      feedback: String(itemEval.feedback || "Evaluation complete.").trim(),
      betterAnswer: String(
        itemEval.betterAnswer || q.expectedKnowledge || "Interview-ready response based on candidate answer."
      ).trim(),
      submittedAt: existingAnsIndex !== -1 ? session.answers[existingAnsIndex].submittedAt : new Date(),
    };

    if (existingAnsIndex !== -1) {
      session.answers[existingAnsIndex] = answerData;
    } else {
      session.answers.push(answerData);
    }
  }

  const maxScoreTotal = 100;
  const percentage = Math.round((calculatedTotalScore / maxScoreTotal) * 100);

  let overallRating = "Weak";
  if (percentage >= 90) overallRating = "Excellent";
  else if (percentage >= 80) overallRating = "Very Strong";
  else if (percentage >= 70) overallRating = "Strong";
  else if (percentage >= 60) overallRating = "Good";
  else if (percentage >= 50) overallRating = "Average";
  else if (percentage >= 40) overallRating = "Needs Improvement";

  session.totalScore = calculatedTotalScore;
  session.overallScore = calculatedTotalScore;
  session.maxScore = maxScoreTotal;
  session.percentage = percentage;
  session.overallRating = evalResult.overallRating || overallRating;
  session.strengths = Array.isArray(evalResult.strengths) ? evalResult.strengths : ["Candidate project answer recorded"];
  session.weaknesses = Array.isArray(evalResult.weaknesses) ? evalResult.weaknesses : ["Automated AI evaluation was unavailable"];
  session.finalFeedback = String(evalResult.finalFeedback || "Project interview evaluated using deterministic application fallback.").trim();

  session.evaluationStatus = "COMPLETED";
  session.evaluationCompleted = true;
  session.aiEvaluationCalls = 1;
  session.evaluationCompletedAt = new Date();
  session.status = "completed";

  await session.save();

  console.log(`[ProjectService] Evaluation complete for session ${sessionId}. Total score: ${calculatedTotalScore}/100 (${percentage}%). Fallback used: ${isFallback}`);

  return {
    success: true,
    message: isFallback
      ? "Project interview evaluated using deterministic application fallback (0 extra AI calls)"
      : "Project interview evaluated successfully in 1 AI call",
    sessionId,
    totalScore: session.totalScore,
    maxScore: session.maxScore,
    percentage: session.percentage,
    overallRating: session.overallRating,
    strengths: session.strengths,
    weaknesses: session.weaknesses,
    finalFeedback: session.finalFeedback,
    evaluations: session.answers.map((a) => ({
      questionId: a.questionId.toString(),
      question: a.question,
      candidateAnswer: a.candidateAnswer,
      score: a.score,
      maxScore: a.maxScore,
      difficulty: a.difficulty,
      rating: a.rating,
      evaluationSource: a.evaluationSource || (isFallback ? "deterministic_fallback" : "ai_evaluated"),
      correctPoints: a.correctPoints,
      missingPoints: a.missingPoints,
      incorrectPoints: a.incorrectPoints,
      grammarIssues: a.grammarIssues,
      feedback: a.feedback,
      betterAnswer: a.betterAnswer,
    })),
    reused: false,
    aiEvaluationCalls: 1,
    isFallback,
  };
}

/**
 * Deterministic application-level fallback evaluation generator.
 * Does NOT fabricate semantic correctness or positive marks if AI is unavailable.
 */
function generateDeterministicProjectFallback(questionsToEvaluate, reason = "AI provider unavailable") {
  console.log(`\n[REAL-INTERVIEW][EVALUATION-FALLBACK]\nround=project\nreason=${reason}\nevaluationSource=deterministic_fallback\n`);

  const evaluations = questionsToEvaluate.map((q) => {
    const ans = String(q.candidateAnswer || "").trim();
    const maxScore = Number(q.maxScore || (q.difficulty === "easy" ? 5 : q.difficulty === "hard" ? 20 : 10));
    const isUnanswered = !ans || ans === "(No answer submitted)" || ans.toLowerCase() === "not answered";

    return {
      questionId: q.questionId,
      score: 0,
      maxScore,
      difficulty: q.difficulty,
      rating: isUnanswered ? "Not Attempted" : "Unverified (AI Unavailable)",
      evaluationSource: "deterministic_fallback",
      correctPoints: [],
      missingPoints: isUnanswered ? ["Question was not attempted"] : ["Automated AI evaluation was unavailable for this response"],
      incorrectPoints: [],
      grammarIssues: [],
      feedback: isUnanswered
        ? "Question was not attempted."
        : "Automated detailed evaluation was unavailable for this response. Answer preserved for review.",
      betterAnswer: q.expectedKnowledge || "Detailed project architectural explanation grounded in resume evidence.",
    };
  });

  return {
    evaluations,
    totalScore: 0,
    maxScore: 100,
    percentage: 0,
    overallRating: "Unverified",
    strengths: ["Candidate project answers preserved in session"],
    weaknesses: ["Automated AI evaluation service was unavailable"],
    finalFeedback: "Project interview completed with deterministic fallback because AI evaluation was unavailable.",
  };
}
