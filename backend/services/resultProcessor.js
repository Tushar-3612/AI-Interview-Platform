import TestAttempt from "../models/TestAttempt.js";
import TestAssignment from "../models/TestAssignment.js";
import User from "../models/User.js";
import TestResult from "../models/TestResult.js";
import { calculateGrade, calculatePassFail } from "../utils/gradeCalculator.js";
import {
  buildQuestionResult,
  computeSectionSummary,
  computeOverallSummary,
} from "../utils/scoringEngine.js";
import { computeRankings } from "../utils/rankingEngine.js";

export async function processResult(attemptId) {
  const existing = await TestResult.findOne({ attemptId });
  if (existing) {
    return { result: existing, isNew: false };
  }

  const attempt = await TestAttempt.findById(attemptId)
    .populate("testId")
    .lean();
  if (!attempt) {
    throw new Error("Attempt not found");
  }

  if (attempt.status !== "completed" && attempt.status !== "auto_submitted") {
    throw new Error("Attempt is not completed yet");
  }

  const test = attempt.testId;
  if (!test) {
    throw new Error("Test not found");
  }

  const user = await User.findById(attempt.userId).lean();
  if (!user) {
    throw new Error("User not found");
  }

  const questionResults = [];
  const sectionMap = {};

  for (const answerEntry of attempt.answers) {
    const question = test.questions[answerEntry.questionIndex];
    if (!question) continue;

    const qr = buildQuestionResult(question, answerEntry, attempt.startTime, attempt.endTime);
    questionResults.push(qr);

    const subject = question.subject || "general";
    if (!sectionMap[subject]) sectionMap[subject] = [];
    sectionMap[subject].push(qr);
  }

  const overall = computeOverallSummary(questionResults);

  const sections = Object.entries(sectionMap).map(([sectionName, qResults]) =>
    computeSectionSummary(sectionName, qResults)
  );

  const grade = calculateGrade(overall.percentage);
  const passed = calculatePassFail(overall.percentage, test.passingMarks);

  const timeTaken = attempt.startTime && attempt.submittedAt
    ? Math.round((new Date(attempt.submittedAt) - new Date(attempt.startTime)) / 1000)
    : 0;

  const audit = {
    startedAt: attempt.startTime || undefined,
    submittedAt: attempt.submittedAt || undefined,
    timeTaken,
    autoSubmitted: attempt.status === "auto_submitted",
    autoSubmitReason: attempt.autoSubmitReason || "",
    tabSwitchCount: attempt.tabSwitchCount || 0,
    browserCloseDetected: false,
    networkFailureDetected: false,
  };

  const testResult = new TestResult({
    attemptId: attempt._id,
    testId: test._id,
    userId: attempt.userId,

    audit,

    totalQuestions: overall.totalQuestions,
    attempted: overall.attempted,
    correct: overall.correct,
    wrong: overall.wrong,
    skipped: overall.skipped,
    notVisited: overall.notVisited,
    pendingEvaluation: overall.pendingEvaluation,
    totalMarks: overall.totalMarks,
    obtainedMarks: overall.obtainedMarks,
    percentage: overall.percentage,
    passed,
    grade,

    questions: questionResults,
    sections,

    studentInfo: {
      name: user.name || "",
      email: user.email || "",
      department: user.department || "",
      year: user.year || "",
    },

    processedAt: new Date(),
    processingVersion: "1.0",
    aiEvaluationReady: false,
    aiEvaluationDone: false,
  });

  await testResult.save();

  await TestAssignment.findByIdAndUpdate(attempt.assignmentId, {
    $inc: { completedCount: 0 },
    averageScore: overall.obtainedMarks,
  });

  const ranking = await computeRankings(
    test._id,
    attempt.userId,
    user.department || "",
    TestResult
  );
  testResult.ranking = ranking;
  await testResult.save();

  return { result: testResult, isNew: true };
}
