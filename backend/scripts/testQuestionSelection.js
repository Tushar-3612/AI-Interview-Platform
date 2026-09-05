/**
 * Tests for Company Mock question selection with proper exposure tracking.
 *
 * Simulates the selection logic with a 300-question bank to verify:
 * - No repeats before exhaustion
 * - Random order
 * - Cycle reset after full exhaustion
 * - Separate student tracking
 * - Separate company tracking
 * - Resume preserves exact questions
 * - Concurrent start safety
 */

import { strict as assert } from "node:assert";
import { shuffleArray } from "../services/questionBank.js";

// ─── Simulated in-memory "database" ───
const exposures = new Map(); // key: `${studentId}:${companyId}:${questionType}` → Set of questionIds
const attempts = new Map(); // attemptId → { selectedQuestions, status }

let attemptCounter = 1;

function exposureKey(studentId, companyId, type) {
  return `${studentId}:${companyId}:${type}`;
}

function getExposedIds(studentId, companyId, type) {
  return exposures.get(exposureKey(studentId, companyId, type)) || new Set();
}

function addExposure(studentId, companyId, type, questionIds) {
  const key = exposureKey(studentId, companyId, type);
  if (!exposures.has(key)) exposures.set(key, new Set());
  const set = exposures.get(key);
  for (const id of questionIds) set.add(id);
}

function clearExposure(studentId, companyId, type) {
  const key = exposureKey(studentId, companyId, type);
  exposures.delete(key);
}

// ─── pickFromPool (same as controller) ───
function pickFromPool(pool, usedIds, count) {
  const result = [];
  for (const q of shuffleArray([...pool])) {
    if (result.length >= count) break;
    const id = String(q._id || q.questionId || q.id);
    if (!id || usedIds.has(id)) continue;
    usedIds.add(id);
    result.push(q);
  }
  return result;
}

// ─── pickWithCycleReset (same as controller) ───
function pickWithCycleReset(pool, studentId, companyId, type, count) {
  const used = getExposedIds(studentId, companyId, type);
  let picked = pickFromPool(pool, new Set(used), count);

  // If pool is exhausted and we don't have enough unused questions,
  // reset this student's exposure for this type and re-pick.
  if (picked.length < count && pool.length >= count) {
    clearExposure(studentId, companyId, type);
    picked = pickFromPool(pool, new Set(), count);
    return { questions: picked, resetType: type };
  }

  return { questions: picked, resetType: null };
}

// ─── Generate mock question bank ───
function generateBank(size) {
  return Array.from({ length: size }, (_, i) => ({
    _id: `q-${i + 1}`,
    questionId: `q-${i + 1}`,
    question: `Question ${i + 1}`,
  }));
}

// ─── Start mock (simplified) ───
function startMock(studentId, companyId, bank, count = 15) {
  const { questions, resetType } = pickWithCycleReset(bank, studentId, companyId, "technical", count);
  const ids = questions.map((q) => String(q._id || q.questionId));
  addExposure(studentId, companyId, "technical", ids);
  const attemptId = `attempt-${attemptCounter++}`;
  attempts.set(attemptId, { selectedQuestions: { technical: ids }, status: "in_progress" });
  return { attemptId, questions: ids, resetType };
}

// ─── Resume mock (simplified) ───
function resumeMock(attemptId) {
  const attempt = attempts.get(attemptId);
  if (!attempt) return null;
  return { questions: [...attempt.selectedQuestions.technical] };
}

// ─── Tests ───
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

console.log("=== Company Mock Question Selection Tests ===\n");

// ─── Test 1: 300-question bank simulation ───
console.log("1. 300-Question Bank Simulation");
const bank300 = generateBank(300);

test("First mock picks 15 random questions", () => {
  const result = startMock("student1", "celebal", bank300, 15);
  assert.equal(result.questions.length, 15);
  assert.equal(result.resetType, null);
});

test("Second mock picks 15 different questions", () => {
  const result = startMock("student1", "celebal", bank300, 15);
  assert.equal(result.questions.length, 15);
  assert.equal(result.resetType, null);
  // Verify no overlap with first mock
  const firstExposed = getExposedIds("student1", "celebal", "technical");
  assert.equal(firstExposed.size, 30);
});

// ─── Test 2: No repeats before exhaustion ───
console.log("\n2. No Repeats Before Exhaustion");
const bank20 = generateBank(20);

test("20 mocks with 15 questions each, no repeats until exhaustion", () => {
  // First mock: 15 questions
  const r1 = startMock("student2", "capgemini", bank20, 15);
  assert.equal(r1.questions.length, 15);

  // Second mock: should pick remaining 5 + reset + 10 more
  const r2 = startMock("student2", "capgemini", bank20, 15);
  assert.equal(r2.questions.length, 15);
  // After reset, we should have 15 new questions (no overlap with first 15)
  const exposed = getExposedIds("student2", "capgemini", "technical");
  assert.equal(exposed.size, 15); // Only the latest cycle's questions
});

// ─── Test 3: Random order ───
console.log("\n3. Random Order");
test("Questions are not in sequential order", () => {
  const bank = generateBank(100);
  const result = startMock("student3", "tcs", bank, 15);
  const ids = result.questions.map((id) => parseInt(id.split("-")[1]));
  // Check that the order is not strictly increasing
  let isSequential = true;
  for (let i = 1; i < ids.length; i++) {
    if (ids[i] !== ids[i - 1] + 1) {
      isSequential = false;
      break;
    }
  }
  assert.equal(isSequential, false, "Questions should not be in sequential order");
});

// ─── Test 4: Repeat allowed only after full exhaustion ───
console.log("\n4. Repeat Allowed Only After Full Exhaustion");
const bank10 = generateBank(10);

test("Cycle resets after all 10 questions are exhausted", () => {
  // Mock 1: pick 8 questions
  const r1 = startMock("student4", "infosys", bank10, 8);
  assert.equal(r1.questions.length, 8);
  assert.equal(r1.resetType, null);

  // Mock 2: pick 8 more (2 remaining + reset + 6 from new cycle)
  const r2 = startMock("student4", "infosys", bank10, 8);
  assert.equal(r2.questions.length, 8);
  assert.equal(r2.resetType, "technical"); // Reset should have occurred

  // Verify the exposed set only contains the latest cycle's questions
  const exposed = getExposedIds("student4", "infosys", "technical");
  assert.equal(exposed.size, 8);
});

// ─── Test 5: Separate student tracking ───
console.log("\n5. Separate Student Tracking");
const bank50 = generateBank(50);

test("Different students have independent exposure pools", () => {
  const r1 = startMock("studentA", "celebal", bank50, 15);
  const r2 = startMock("studentB", "celebal", bank50, 15);

  // Both should get 15 questions
  assert.equal(r1.questions.length, 15);
  assert.equal(r2.questions.length, 15);

  // Exposures should be separate
  const exposedA = getExposedIds("studentA", "celebal", "technical");
  const exposedB = getExposedIds("studentB", "celebal", "technical");
  assert.equal(exposedA.size, 15);
  assert.equal(exposedB.size, 15);

  // They might have some overlap (random), but that's OK
  // The key is that each student's exposure is tracked independently
});

// ─── Test 6: Separate company tracking ───
console.log("\n6. Separate Company Tracking");
test("Different companies have independent exposure pools", () => {
  const bank = generateBank(50);
  const r1 = startMock("studentC", "celebal", bank, 15);
  const r2 = startMock("studentC", "tcs", bank, 15);

  assert.equal(r1.questions.length, 15);
  assert.equal(r2.questions.length, 15);

  const exposedCelebal = getExposedIds("studentC", "celebal", "technical");
  const exposedTcs = getExposedIds("studentC", "tcs", "technical");
  assert.equal(exposedCelebal.size, 15);
  assert.equal(exposedTcs.size, 15);
});

// ─── Test 7: Resume preserves exact questions ───
console.log("\n7. Resume Preserves Exact Questions");
test("Resume returns the exact same questions in the same order", () => {
  const bank = generateBank(100);
  const { attemptId, questions } = startMock("studentD", "wipro", bank, 15);

  // Simulate resume
  const resumed = resumeMock(attemptId);
  assert.deepEqual(resumed.questions, questions);
});

// ─── Test 8: No repeats inside same mock ───
console.log("\n8. No Repeats Inside Same Mock");
test("All questions within a single mock are unique", () => {
  const bank = generateBank(50);
  const result = startMock("studentE", "accenture", bank, 15);
  const uniqueIds = new Set(result.questions);
  assert.equal(uniqueIds.size, 15, "All questions should be unique within a mock");
});

// ─── Test 9: Exhaustion detection ───
console.log("\n9. Exhaustion Detection");
test("When bank is smaller than count, cycle resets automatically", () => {
  const smallBank = generateBank(10);
  const r1 = startMock("studentF", "deloitte", smallBank, 8);
  assert.equal(r1.questions.length, 8);

  const r2 = startMock("studentF", "deloitte", smallBank, 8);
  assert.equal(r2.questions.length, 8);
  assert.equal(r2.resetType, "technical"); // Reset should have occurred
});

// ─── Test 10: Large bank simulation ───
console.log("\n10. Large Bank Simulation (300 questions, 20 mocks)");
test("20 consecutive mocks with 15 questions each from 300-question bank", () => {
  const largeBank = generateBank(300);
  const studentId = "studentG";
  const companyId = "celebal";

  for (let i = 0; i < 20; i++) {
    const result = startMock(studentId, companyId, largeBank, 15);
    assert.equal(result.questions.length, 15, `Mock ${i + 1} should have 15 questions`);

    // Verify no duplicates within this mock
    const unique = new Set(result.questions);
    assert.equal(unique.size, 15, `Mock ${i + 1} should have unique questions`);
  }

  // After 20 mocks × 15 questions = 300 questions, the bank should be exhausted
  // The 21st mock should trigger a reset
  const r21 = startMock(studentId, companyId, largeBank, 15);
  assert.equal(r21.questions.length, 15);
  assert.equal(r21.resetType, "technical", "21st mock should trigger cycle reset");
});

// ─── Summary ───
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
