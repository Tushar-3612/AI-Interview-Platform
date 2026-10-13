import assert from "node:assert/strict";
import {
  evaluateAnswer,
  isPartialStatus,
  getAnswerStatusLabel,
} from "../../frontend/src/features/nptelAssignment/data/nptelData.js";

// Sample questions mirroring NPTEL assignment structures (single and multiple choice)
const mockQuestions = [
  {
    id: "q1",
    questionNumber: 1,
    questionText: "Which of the following is a primary data collection method?",
    type: "single",
    options: ["Survey", "Literature Review", "Meta-analysis", "Encyclopedia"],
    correctAnswers: ["Survey"],
    points: 1,
  },
  {
    id: "q2",
    questionNumber: 2,
    questionText: "Select all qualitative research methodologies:",
    type: "multiple",
    options: ["Ethnography", "Ground Theory", "Randomized Controlled Trial", "Focus Group"],
    correctAnswers: ["Ethnography", "Focus Group"],
    points: 1,
  },
  {
    id: "q3",
    questionNumber: 3,
    questionText: "What does ANOVA stand for?",
    type: "single",
    options: ["Analysis of Variables", "Analysis of Variance", "Array of Values", "Assessment of Variance"],
    correctAnswers: ["Analysis of Variance"],
    points: 1,
  },
  {
    id: "q4",
    questionNumber: 4,
    questionText: "Which sampling methods are probabilistic?",
    type: "multiple",
    options: ["Simple Random", "Stratified", "Convenience", "Quota"],
    correctAnswers: ["Simple Random", "Stratified"],
    points: 2,
  },
  {
    id: "q5",
    questionNumber: 5,
    questionText: "Is a hypothesis testable?",
    type: "single",
    options: ["Yes", "No"],
    correctAnswers: ["Yes"],
    points: 1,
  },
];

/**
 * Simulates client/frontend evaluation as implemented in NptelAssignmentTest.jsx
 */
function simulateClientEvaluation(questionsList, userAnswers) {
  let totalScore = 0;
  let correctCount = 0;
  let partiallyCorrectCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  const evaluated = questionsList.map((q) => {
    const userSel = userAnswers[q.id];
    const evalRes = evaluateAnswer(q, userSel);

    totalScore += evalRes.pointsEarned;
    if (evalRes.isCorrect) {
      correctCount++;
    } else if (evalRes.isPartiallyCorrect) {
      partiallyCorrectCount++;
    } else if (evalRes.status === "unanswered") {
      unansweredCount++;
    } else {
      incorrectCount++;
    }

    return {
      id: q.id,
      pointsEarned: evalRes.pointsEarned,
      maxPoints: q.points || 1,
      status: evalRes.status,
    };
  });

  totalScore = Number(totalScore.toFixed(2));
  const totalQuestionsCount = questionsList.length;
  const answeredCount = totalQuestionsCount - unansweredCount;
  const percentage = totalQuestionsCount > 0 ? Number(((totalScore / totalQuestionsCount) * 100).toFixed(1)) : 0;

  return {
    score: totalScore,
    totalQuestions: totalQuestionsCount,
    answeredCount,
    unansweredCount,
    correctCount,
    partiallyCorrectCount,
    incorrectCount,
    percentage,
    results: evaluated,
  };
}

/**
 * Simulates backend evaluation as implemented in nptelController.js
 */
function normalizeAnswers(val) {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map((s) => String(s).trim()).filter(Boolean);
  }
  return [String(val).trim()];
}

function evaluateQuestionBackend(q, userSelection) {
  const selected = normalizeAnswers(userSelection);
  const correct = normalizeAnswers(q.correctAnswers);

  if (selected.length === 0) {
    return {
      pointsEarned: 0,
      isCorrect: false,
      isPartiallyCorrect: false,
      status: "unanswered",
    };
  }

  const correctSet = new Set(correct);
  const hasWrongOption = selected.some((opt) => !correctSet.has(opt));

  if (hasWrongOption) {
    return {
      pointsEarned: 0,
      isCorrect: false,
      isPartiallyCorrect: false,
      status: "incorrect",
    };
  }

  if (selected.length === correct.length) {
    return {
      pointsEarned: q.points || 1,
      isCorrect: true,
      isPartiallyCorrect: false,
      status: "correct",
    };
  }

  const partialPoints = Number(((selected.length / correct.length) * (q.points || 1)).toFixed(2));
  return {
    pointsEarned: partialPoints,
    isCorrect: false,
    isPartiallyCorrect: true,
    status: "partially_correct",
  };
}

function simulateBackendEvaluation(activeQuestions, answers) {
  let totalScore = 0;
  let correctCount = 0;
  let partiallyCorrectCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  const evaluatedQuestions = activeQuestions.map((q) => {
    const userSelection = answers[q.id];
    const evaluation = evaluateQuestionBackend(q, userSelection);

    totalScore += evaluation.pointsEarned;
    if (evaluation.isCorrect) {
      correctCount++;
    } else if (evaluation.isPartiallyCorrect) {
      partiallyCorrectCount++;
    } else if (evaluation.status === "unanswered") {
      unansweredCount++;
    } else {
      incorrectCount++;
    }

    return {
      id: q.id,
      pointsEarned: evaluation.pointsEarned,
      maxPoints: q.points || 1,
      status: evaluation.status,
    };
  });

  totalScore = Number(totalScore.toFixed(2));
  const totalQuestions = activeQuestions.length;
  const answeredCount = totalQuestions - unansweredCount;
  const maxScore = activeQuestions.reduce((sum, q) => sum + (q.points || 1), 0);
  const percentage = maxScore > 0 ? Number(((totalScore / maxScore) * 100).toFixed(1)) : 0;

  return {
    score: totalScore,
    maxScore,
    totalQuestions,
    percentage,
    correctCount,
    partiallyCorrectCount,
    incorrectCount,
    unansweredCount,
    answeredCount,
    results: evaluatedQuestions,
  };
}

console.log("=== RUNNING NPTEL BUG-N02 & BUG-N08 VERIFICATION SUITE ===\n");

// ─────────────────────────────────────────────────────────────
// Test Suite 1: Status Mapping & Helpers (BUG-N08)
// ─────────────────────────────────────────────────────────────
console.log("1. Status mapping and label helpers test (BUG-N08):");
assert.equal(isPartialStatus("partially_correct"), true, "partially_correct must be recognized as partial");
assert.equal(isPartialStatus("partial"), true, "partial must be recognized as partial");
assert.equal(isPartialStatus("correct"), false);
assert.equal(isPartialStatus("incorrect"), false);
assert.equal(isPartialStatus("unanswered"), false);

assert.equal(getAnswerStatusLabel("partially_correct"), "Partially Correct");
assert.equal(getAnswerStatusLabel("partial"), "Partially Correct");
assert.equal(getAnswerStatusLabel("correct"), "Correct");
assert.equal(getAnswerStatusLabel("incorrect"), "Incorrect");
assert.equal(getAnswerStatusLabel("unanswered"), "Unanswered");
console.log("   ✓ All status helpers correctly map partially_correct and other statuses to distinct user labels.\n");

// ─────────────────────────────────────────────────────────────
// Test Suite 2: All Questions Unanswered (BUG-N02)
// ─────────────────────────────────────────────────────────────
console.log("2. Entirely unanswered assessment (BUG-N02):");
const emptyAnswers = {};
const clientAllUnanswered = simulateClientEvaluation(mockQuestions, emptyAnswers);
const backendAllUnanswered = simulateBackendEvaluation(mockQuestions, emptyAnswers);

assert.equal(clientAllUnanswered.unansweredCount, 5, "All 5 questions must be counted as unanswered");
assert.equal(clientAllUnanswered.incorrectCount, 0, "Unanswered questions must NOT be counted as incorrect");
assert.equal(clientAllUnanswered.answeredCount, 0, "answeredCount must be 0");
assert.equal(clientAllUnanswered.correctCount, 0);
assert.equal(clientAllUnanswered.partiallyCorrectCount, 0);
assert.equal(clientAllUnanswered.score, 0);
assert.equal(clientAllUnanswered.percentage, 0);
assert.equal(
  clientAllUnanswered.correctCount +
    clientAllUnanswered.partiallyCorrectCount +
    clientAllUnanswered.incorrectCount +
    clientAllUnanswered.unansweredCount,
  5,
  "Sum of categories must equal total questions"
);

// Verify backend consistency
assert.equal(backendAllUnanswered.unansweredCount, 5);
assert.equal(backendAllUnanswered.incorrectCount, 0);
assert.equal(backendAllUnanswered.answeredCount, 0);
assert.equal(backendAllUnanswered.correctCount, 0);
assert.equal(backendAllUnanswered.partiallyCorrectCount, 0);
assert.equal(backendAllUnanswered.score, 0);
assert.equal(backendAllUnanswered.percentage, 0);
console.log("   ✓ Unanswered questions are not counted as incorrect; answeredCount = 0; no division-by-zero errors.\n");

// ─────────────────────────────────────────────────────────────
// Test Suite 3: All Questions Correct
// ─────────────────────────────────────────────────────────────
console.log("3. All questions answered correctly:");
const allCorrectAnswers = {
  q1: "Survey",
  q2: ["Ethnography", "Focus Group"],
  q3: "Analysis of Variance",
  q4: ["Simple Random", "Stratified"],
  q5: "Yes",
};
const clientAllCorrect = simulateClientEvaluation(mockQuestions, allCorrectAnswers);
const backendAllCorrect = simulateBackendEvaluation(mockQuestions, allCorrectAnswers);

assert.equal(clientAllCorrect.correctCount, 5);
assert.equal(clientAllCorrect.partiallyCorrectCount, 0);
assert.equal(clientAllCorrect.incorrectCount, 0);
assert.equal(clientAllCorrect.unansweredCount, 0);
assert.equal(clientAllCorrect.answeredCount, 5);
assert.equal(backendAllCorrect.correctCount, 5);
assert.equal(backendAllCorrect.incorrectCount, 0);
assert.equal(backendAllCorrect.unansweredCount, 0);
assert.equal(backendAllCorrect.percentage, 100);
console.log("   ✓ All correct answered correctly; 0 incorrect, 0 unanswered, 100% score.\n");

// ─────────────────────────────────────────────────────────────
// Test Suite 4: All Questions Answered Incorrectly
// ─────────────────────────────────────────────────────────────
console.log("4. All questions answered incorrectly:");
const allIncorrectAnswers = {
  q1: "Literature Review",
  q2: ["Randomized Controlled Trial"],
  q3: "Array of Values",
  q4: ["Convenience", "Quota"],
  q5: "No",
};
const clientAllIncorrect = simulateClientEvaluation(mockQuestions, allIncorrectAnswers);
const backendAllIncorrect = simulateBackendEvaluation(mockQuestions, allIncorrectAnswers);

assert.equal(clientAllIncorrect.correctCount, 0);
assert.equal(clientAllIncorrect.partiallyCorrectCount, 0);
assert.equal(clientAllIncorrect.incorrectCount, 5, "All 5 must be incorrect");
assert.equal(clientAllIncorrect.unansweredCount, 0, "0 unanswered");
assert.equal(clientAllIncorrect.answeredCount, 5, "5 answered");
assert.equal(backendAllIncorrect.incorrectCount, 5);
assert.equal(backendAllIncorrect.unansweredCount, 0);
assert.equal(backendAllIncorrect.answeredCount, 5);
console.log("   ✓ All questions evaluated as incorrect; 0 unanswered; answeredCount = 5.\n");

// ─────────────────────────────────────────────────────────────
// Test Suite 5: Mixed Attempt with Correct, Partial, Incorrect, and Unanswered (BUG-N02 + BUG-N08)
// ─────────────────────────────────────────────────────────────
console.log("5. Mixed assessment (BUG-N02 + BUG-N08):");
const mixedAnswers = {
  q1: "Survey", // Correct (1 pt)
  q2: ["Ethnography"], // Partially Correct: 1 of 2 correct options, no wrong option (0.5 pt)
  q3: "Analysis of Variables", // Incorrect: wrong option (0 pt)
  // q4 is left UNANSWERED: (0 pt)
  q5: "Yes", // Correct (1 pt)
};
const clientMixed = simulateClientEvaluation(mockQuestions, mixedAnswers);
const backendMixed = simulateBackendEvaluation(mockQuestions, mixedAnswers);

// Expected:
// q1: correct (1 pt)
// q2: partially_correct (0.5 pt)
// q3: incorrect (0 pt)
// q4: unanswered (0 pt)
// q5: correct (1 pt)
// Total Score: 2.5
// correctCount: 2
// partiallyCorrectCount: 1
// incorrectCount: 1  (MUST NOT BE 2! Unanswered q4 must NOT increment incorrectCount)
// unansweredCount: 1
// answeredCount: 4   (totalQuestions 5 - unansweredCount 1 = 4)

assert.equal(clientMixed.correctCount, 2, "Expected 2 correct");
assert.equal(clientMixed.partiallyCorrectCount, 1, "Expected 1 partially correct");
assert.equal(clientMixed.incorrectCount, 1, "Expected strictly 1 incorrect (q3 only, NOT q4)");
assert.equal(clientMixed.unansweredCount, 1, "Expected strictly 1 unanswered (q4)");
assert.equal(clientMixed.answeredCount, 4, "answeredCount must be 5 - 1 = 4");
assert.equal(clientMixed.score, 2.5, "Score must be 2.5");
assert.equal(
  clientMixed.correctCount + clientMixed.partiallyCorrectCount + clientMixed.incorrectCount + clientMixed.unansweredCount,
  5,
  "Sum of all 4 categories must equal total questions"
);

// Verify results list statuses and points
const q2Result = clientMixed.results.find((r) => r.id === "q2");
assert.equal(q2Result.status, "partially_correct");
assert.equal(q2Result.pointsEarned, 0.5);
assert.equal(isPartialStatus(q2Result.status), true);
assert.equal(getAnswerStatusLabel(q2Result.status), "Partially Correct");

const q4Result = clientMixed.results.find((r) => r.id === "q4");
assert.equal(q4Result.status, "unanswered");
assert.equal(getAnswerStatusLabel(q4Result.status), "Unanswered");

// Verify backend matches client exactly
assert.equal(backendMixed.correctCount, 2);
assert.equal(backendMixed.partiallyCorrectCount, 1);
assert.equal(backendMixed.incorrectCount, 1);
assert.equal(backendMixed.unansweredCount, 1);
assert.equal(backendMixed.answeredCount, 4);
assert.equal(backendMixed.score, 2.5);

console.log("   ✓ Mixed attempt correctly categorizes all 4 states without double counting:");
console.log(`     Correct: ${clientMixed.correctCount}`);
console.log(`     Partially Correct: ${clientMixed.partiallyCorrectCount} (retained 0.5 pts)`);
console.log(`     Incorrect: ${clientMixed.incorrectCount}`);
console.log(`     Unanswered: ${clientMixed.unansweredCount}`);
console.log(`     Answered Count: ${clientMixed.answeredCount}`);
console.log(`     Total Questions: ${clientMixed.totalQuestions}\n`);

// ─────────────────────────────────────────────────────────────
// Test Suite 6: Edge Case: Zero Questions Division Guard
// ─────────────────────────────────────────────────────────────
console.log("6. Zero questions edge case (Division by zero check):");
const emptyTestClient = simulateClientEvaluation([], {});
const emptyTestBackend = simulateBackendEvaluation([], {});
assert.equal(emptyTestClient.percentage, 0);
assert.equal(emptyTestBackend.percentage, 0);
assert.equal(Number.isNaN(emptyTestClient.percentage), false);
assert.equal(Number.isNaN(emptyTestBackend.percentage), false);
console.log("   ✓ Empty question bank does not cause NaN or division-by-zero errors.\n");

console.log("=== ALL NPTEL BUG-N02 & BUG-N08 TESTS PASSED SUCCESSFULLY ===");
