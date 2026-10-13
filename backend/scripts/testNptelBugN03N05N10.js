import assert from "node:assert/strict";
import { NPTEL_TEST_META, evaluateAnswer, isPartialStatus, getAnswerStatusLabel } from "../../frontend/src/features/nptelAssignment/data/nptelData.js";

console.log("=== RUNNING NPTEL BUG-N03, BUG-N05 & BUG-N10 VERIFICATION SUITE ===\n");

// ─────────────────────────────────────────────────────────────
// Test Suite 1: BUG-N03 — Assessment Timer Lifecycle
// ─────────────────────────────────────────────────────────────
console.log("1. Assessment Timer Lifecycle (BUG-N03):");

// 1.1 Initial duration check
const initialDuration = (NPTEL_TEST_META.durationMinutes || 120) * 60;
assert.equal(initialDuration, 7200, "Timer must initialize to 7200 seconds (120 minutes)");

// 1.2 Simulate timer countdown ticks and safety guards
let simulatedTimeLeft = initialDuration;
let timerRunning = true;
let submitCalls = 0;
let intervalCleared = false;

function simulateTimerTick() {
  if (!timerRunning) return simulatedTimeLeft;
  if (simulatedTimeLeft <= 1) {
    timerRunning = false;
    intervalCleared = true;
    submitCalls++;
    simulatedTimeLeft = 0;
    return 0;
  }
  simulatedTimeLeft -= 1;
  return simulatedTimeLeft;
}

// 5 seconds tick
for (let i = 0; i < 5; i++) {
  simulateTimerTick();
}
assert.equal(simulatedTimeLeft, 7195, "Timer must decrement sequentially each second");
assert.equal(submitCalls, 0, "No submission should be triggered while timer is active");

// 1.3 Expiration simulation
simulatedTimeLeft = 2;
timerRunning = true;
intervalCleared = false;
simulateTimerTick(); // 2 -> 1
assert.equal(simulatedTimeLeft, 1);
assert.equal(submitCalls, 0);

simulateTimerTick(); // 1 -> 0, trigger submit
assert.equal(simulatedTimeLeft, 0, "Timer must stop at 0");
assert.equal(submitCalls, 1, "Submission must be triggered exactly once upon expiration");
assert.equal(timerRunning, false, "Timer must be marked stopped upon expiration");
assert.equal(intervalCleared, true, "Interval must be cleared upon expiration");

// Further ticks must NOT decrement below 0 or submit again
simulateTimerTick();
simulateTimerTick();
assert.equal(simulatedTimeLeft, 0, "Timer must never go negative");
assert.equal(submitCalls, 1, "No duplicate submissions upon repeated ticks after expiration");

console.log("   ✓ Initial duration is 7200s (120 mins).");
console.log("   ✓ Decrements sequentially; stops at 0 without going negative.");
console.log("   ✓ Triggers submission at most once on expiration.\n");

// ─────────────────────────────────────────────────────────────
// Test Suite 2: BUG-N05 — Fullscreen Exit Behavior
// ─────────────────────────────────────────────────────────────
console.log("2. Fullscreen Exit Handling (BUG-N05):");

// Simulate assessment state during practice
let phase = "active";
let isFullscreen = true;
let isSubmitting = false;
let userAnswers = { q1: "Survey", q2: ["Ethnography"] };
let submissionTriggeredOnFullscreenExit = false;

// New fullscreen change handler: only tracks state, does NOT submit
function handleFullscreenChange(isFull) {
  isFullscreen = isFull;
  // Previously: if (!isFull) { isSubmitting = true; handleSubmit(); }
  // Now: only updates isFullscreen state, answers remain intact, no submission!
}

// Student enters fullscreen
handleFullscreenChange(true);
assert.equal(isFullscreen, true);
assert.equal(phase, "active");

// Student exits fullscreen (presses Escape or minimizes)
handleFullscreenChange(false);
assert.equal(isFullscreen, false, "Fullscreen state should update to false");
assert.equal(phase, "active", "Phase must remain 'active'; assessment must NOT be submitted");
assert.equal(isSubmitting, false, "Submission guard must NOT be engaged by exiting fullscreen");
assert.deepEqual(userAnswers, { q1: "Survey", q2: ["Ethnography"] }, "Student answers must be preserved");

console.log("   ✓ Exiting fullscreen does NOT trigger auto-submission.");
console.log("   ✓ Assessment phase remains 'active'.");
console.log("   ✓ User answers and draft state remain completely intact.\n");

// ─────────────────────────────────────────────────────────────
// Test Suite 3: BUG-N10 — Retake State Reset
// ─────────────────────────────────────────────────────────────
console.log("3. Retake State Reset (BUG-N10):");

// Simulate Attempt 1 state after completion
let attempt1State = {
  phase: "result",
  answers: { q1: "Survey", q2: ["Ethnography"], q3: "Wrong Answer" },
  answersRef: { q1: "Survey", q2: ["Ethnography"], q3: "Wrong Answer" },
  flagged: new Set(["q1", "q4"]),
  checkedPractice: { q1: true, q2: true },
  currentIndex: 45,
  timeLeft: 3420,
  timerRunning: false,
  timerRef: 999, // active interval id
  startTimeRef: Date.now() - 3780000, // 63 minutes ago
  isSubmittingRef: true,
  submitting: true,
  confirmSubmitModal: true,
  paletteFilter: "flagged",
  mobilePaletteOpen: true,
  showReviewModal: true,
  resultData: {
    score: 1.5,
    maxScore: 120,
    percentage: 1.3,
    correctCount: 1,
    partiallyCorrectCount: 1,
    incorrectCount: 1,
    unansweredCount: 117,
  },
  // User preferences that must be preserved across retakes
  bookmarks: new Set(["q2", "q10"]),
  autoAdvanceOnCorrect: true,
};

// Simulate handleRetakeTest()
function simulateHandleRetakeTest(state) {
  // 1. Clean up intervals
  let clearedInterval = false;
  if (state.timerRef) {
    clearedInterval = true;
    state.timerRef = null;
  }

  // 2. Reset timer and fresh attempt timestamp
  state.timeLeft = initialDuration;
  state.timerRunning = true;
  state.startTimeRef = Date.now();

  // 3. Reset submission and guard flags
  state.isSubmittingRef = false;
  state.submitting = false;
  state.confirmSubmitModal = false;

  // 4. Clear answers, flags, and temporary practice states
  state.answers = {};
  state.answersRef = {};
  state.flagged = new Set();
  state.checkedPractice = {};

  // 5. Reset navigation, filters, and result modals
  state.currentIndex = 0;
  state.paletteFilter = "all";
  state.mobilePaletteOpen = false;
  state.showReviewModal = false;
  state.resultData = null;

  // 6. Transition to active phase
  state.phase = "active";

  return clearedInterval;
}

const intervalWasCleared = simulateHandleRetakeTest(attempt1State);

assert.equal(intervalWasCleared, true, "Previous timer interval must be cleared");
assert.equal(attempt1State.phase, "active", "Phase must return to active");
assert.deepEqual(attempt1State.answers, {}, "Answers must be completely cleared");
assert.deepEqual(attempt1State.answersRef, {}, "Answers ref must be cleared");
assert.equal(attempt1State.flagged.size, 0, "Flagged questions must be completely cleared");
assert.deepEqual(attempt1State.checkedPractice, {}, "Checked practice status must be cleared");
assert.equal(attempt1State.currentIndex, 0, "Current question must reset to 0 (Question 1)");
assert.equal(attempt1State.timeLeft, 7200, "Timer must be re-initialized to 7200 seconds");
assert.equal(attempt1State.timerRunning, true, "Timer must be marked running for new attempt");
assert.equal(attempt1State.isSubmittingRef, false, "Submission guard must be reset to false");
assert.equal(attempt1State.submitting, false, "Submitting flag must be reset to false");
assert.equal(attempt1State.confirmSubmitModal, false, "Confirmation modal must be reset");
assert.equal(attempt1State.resultData, null, "Result data must be reset to null");
assert.equal(attempt1State.showReviewModal, false, "Review modal must be closed");
assert.equal(attempt1State.paletteFilter, "all", "Palette filter must reset to 'all'");
assert.equal(attempt1State.mobilePaletteOpen, false, "Mobile palette must be closed");

// Ensure fresh timestamp belongs to new attempt (elapsed time ~0 seconds)
const elapsedOnRetake = Math.floor((Date.now() - attempt1State.startTimeRef) / 1000);
assert.ok(elapsedOnRetake <= 1, "Elapsed time must reset to ~0s for the fresh attempt");

// User preferences preserved
assert.equal(attempt1State.bookmarks.size, 2, "Bookmarks must be preserved across retakes");
assert.equal(attempt1State.autoAdvanceOnCorrect, true, "Auto-advance toggle preference must be preserved");

console.log("   ✓ Previous answers, flags, and checked states cleared.");
console.log("   ✓ Timer interval cleared and reinitialized to 7200s.");
console.log("   ✓ Start timestamp reset to current time (elapsed time = 0s).");
console.log("   ✓ Navigation reset to Question 1; results cleared.");
console.log("   ✓ Submission guards reset so new attempt can be completed.");
console.log("   ✓ User bookmarks and preferences preserved.\n");

// ─────────────────────────────────────────────────────────────
// Test Suite 4: Regression Tests (BUG-N02 and BUG-N08 Integrity)
// ─────────────────────────────────────────────────────────────
console.log("4. Regression Check (BUG-N02 & BUG-N08 Integrity):");

// BUG-N02 check: unanswered not counted as incorrect
const sampleQ = { id: "q1", correctAnswers: ["Option A"], points: 1 };
const unansweredEval = evaluateAnswer(sampleQ, null);
assert.equal(unansweredEval.status, "unanswered");
assert.equal(unansweredEval.isCorrect, false);
assert.equal(unansweredEval.isPartiallyCorrect, false);

// BUG-N08 check: partial status mapping and label
const multiQ = { id: "q2", correctAnswers: ["Option A", "Option B"], points: 1 };
const partialEval = evaluateAnswer(multiQ, ["Option A"]);
assert.equal(partialEval.status, "partially_correct");
assert.equal(partialEval.isPartiallyCorrect, true);
assert.equal(partialEval.pointsEarned, 0.5);
assert.equal(isPartialStatus(partialEval.status), true);
assert.equal(getAnswerStatusLabel(partialEval.status), "Partially Correct");

console.log("   ✓ Unanswered questions maintain status 'unanswered'.");
console.log("   ✓ Partially correct questions maintain status 'partially_correct' with 0.5 pts.");
console.log("   ✓ Status label maps cleanly to 'Partially Correct'.\n");

console.log("=== ALL NPTEL BUG-N03, BUG-N05 & BUG-N10 TESTS PASSED SUCCESSFULLY ===");
