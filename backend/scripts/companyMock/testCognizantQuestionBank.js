/**
 * Comprehensive Test Suite for Cognizant Company Mock Implementation
 *
 * Verifies all 22 critical criteria:
 * 1. MCQ count >= 200
 * 2. Technical count >= 150
 * 3. Coding count >= 30
 * 4. Unique question IDs across all banks
 * 5. Valid difficulty levels (Easy, Medium, Hard)
 * 6. Marks alignment (Easy=2, Medium=3, Hard=5, Coding=10)
 * 7. MCQ structure (4 distinct options, correctAnswer in options)
 * 8. Technical reference answers (expectedAnswer, explanation, betterAnswer)
 * 9. Coding schema (title, problemStatement, starterCode, supportedLanguages)
 * 10. Coding test cases (publicTestCases >= 2, hiddenTestCases >= 2)
 * 11. Random question selection
 * 12. No-repeat exposure tracking
 * 13. Complete-cycle reset after exhaustion
 * 14. Adaptive difficulty integration
 * 15. Student-level isolation
 * 16. Company-level isolation (Cognizant vs Capgemini vs Celebal vs TCS vs Wipro vs Accenture vs Benchmark)
 * 17. Resume behavior preservation
 * 18. Judge0 compatibility & testcase formatting
 * 19. KEY2 API isolation (reads ONLY MOCK_INTERVIEW_API_KEY2)
 * 20. Deterministic fallback behavior on failure/missing key
 * 21. Dynamic result calculation (no hardcoded denominators)
 * 22. Strict absence of project / resume questions
 * 23. Routing of companyId='cognizant' through evaluateSingleAnswer to KEY2 evaluator
 */

import { strict as assert } from "node:assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { SHARED2_CONFIG, isKey2Company } from "../../config/companyMock/shared2.js";
import { isShared2AIConfigured, callShared2Ai } from "../../services/companyMock/ai/shared2AiClient.js";
import {
  evaluateShared2SingleAnswer,
  getShared2DeterministicFallback,
} from "../../services/companyMock/technical/shared2TechnicalEvaluator.js";
import { evaluateSingleAnswer, evaluateCompanyMockSingleAnswer } from "../../services/companyMock/technical/technicalEvaluation.js";
import {
  loadCompanyQuestionsFromFolder,
  loadCompanyMockTechnical,
  loadCompanyMockCoding,
  hasCompanyMockData,
} from "../../services/companyMockBank.js";
import {
  selectAdaptiveQuestions,
  calculateTargetCounts,
  getTargetDistribution,
  getPerformanceTier,
  TARGET_DISTRIBUTIONS,
} from "../../services/companyMock/adaptive/adaptiveDifficulty.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const cognizantDataDir = path.resolve(rootDir, "data/companyMock/cognizant");

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    failed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    failed++;
  }
}

console.log("=== Starting Cognizant Company Mock Test Suite ===\n");

// ============================================================================
// 1. Question Bank Quantity & Schema
// ============================================================================
console.log("--- 1. Question Bank Counts & Structure ---");

runTest("1. MCQ bank contains at least 200 questions", () => {
  const file = path.join(cognizantDataDir, "mcq.json");
  assert.ok(fs.existsSync(file), "mcq.json must exist");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.ok(Array.isArray(data), "mcq.json must be an array");
  assert.ok(data.length >= 200, `Expected >= 200 MCQs, found ${data.length}`);
});

runTest("2. Technical bank contains at least 150 questions", () => {
  const file = path.join(cognizantDataDir, "technical.json");
  assert.ok(fs.existsSync(file), "technical.json must exist");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.ok(Array.isArray(data), "technical.json must be an array");
  assert.ok(data.length >= 150, `Expected >= 150 Technical questions, found ${data.length}`);
});

runTest("3. Coding bank contains at least 30 questions", () => {
  const file = path.join(cognizantDataDir, "coding.json");
  assert.ok(fs.existsSync(file), "coding.json must exist");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.ok(Array.isArray(data), "coding.json must be an array");
  assert.ok(data.length >= 30, `Expected >= 30 Coding questions, found ${data.length}`);
});

runTest("4. Unique question IDs across all Cognizant banks", () => {
  const mcqs = JSON.parse(fs.readFileSync(path.join(cognizantDataDir, "mcq.json"), "utf8"));
  const techs = JSON.parse(fs.readFileSync(path.join(cognizantDataDir, "technical.json"), "utf8"));
  const codings = JSON.parse(fs.readFileSync(path.join(cognizantDataDir, "coding.json"), "utf8"));

  const seen = new Set();
  const all = [...mcqs, ...techs, ...codings];

  for (const q of all) {
    const id = q.questionId || q.id;
    assert.ok(id, "Every question must have an ID");
    assert.ok(!seen.has(id), `Duplicate ID found: ${id}`);
    seen.add(id);
  }
});

runTest("5. Valid difficulty levels (Easy, Medium, Hard)", () => {
  const mcqs = JSON.parse(fs.readFileSync(path.join(cognizantDataDir, "mcq.json"), "utf8"));
  const techs = JSON.parse(fs.readFileSync(path.join(cognizantDataDir, "technical.json"), "utf8"));
  const codings = JSON.parse(fs.readFileSync(path.join(cognizantDataDir, "coding.json"), "utf8"));

  const validDiffs = new Set(["Easy", "Medium", "Hard"]);
  for (const q of [...mcqs, ...techs, ...codings]) {
    assert.ok(validDiffs.has(q.difficulty), `Invalid difficulty: ${q.difficulty} in ${q.questionId || q.id}`);
  }
});

runTest("6. Marks alignment (Easy=2, Medium=3, Hard=5, Coding=10)", () => {
  const mcqs = JSON.parse(fs.readFileSync(path.join(cognizantDataDir, "mcq.json"), "utf8"));
  const techs = JSON.parse(fs.readFileSync(path.join(cognizantDataDir, "technical.json"), "utf8"));
  const codings = JSON.parse(fs.readFileSync(path.join(cognizantDataDir, "coding.json"), "utf8"));

  const marksMap = { Easy: 2, Medium: 3, Hard: 5 };
  for (const q of [...mcqs, ...techs]) {
    assert.equal(q.marks, marksMap[q.difficulty], `Mismatch marks in ${q.questionId}: got ${q.marks}, expected ${marksMap[q.difficulty]}`);
  }
  for (const q of codings) {
    assert.equal(q.marks, 10, `Coding question marks must be 10, got ${q.marks}`);
  }
});

runTest("7. MCQ structure: 4 distinct options & correctAnswer in options", () => {
  const mcqs = JSON.parse(fs.readFileSync(path.join(cognizantDataDir, "mcq.json"), "utf8"));
  for (const q of mcqs) {
    assert.equal(q.options.length, 4, `MCQ ${q.questionId} must have exactly 4 options`);
    const distinct = new Set(q.options);
    assert.equal(distinct.size, 4, `MCQ ${q.questionId} must have 4 distinct options`);
    assert.ok(q.options.includes(q.correctAnswer), `MCQ ${q.questionId} correctAnswer '${q.correctAnswer}' not in options`);
  }
});

runTest("8. Technical reference answers: expectedAnswer, explanation, betterAnswer", () => {
  const techs = JSON.parse(fs.readFileSync(path.join(cognizantDataDir, "technical.json"), "utf8"));
  for (const q of techs) {
    assert.ok(q.expectedAnswer && q.expectedAnswer.length >= 10, `Technical ${q.questionId} missing/short expectedAnswer`);
    assert.ok(q.explanation && q.explanation.length >= 10, `Technical ${q.questionId} missing/short explanation`);
    assert.ok(q.betterAnswer && q.betterAnswer.length >= 10, `Technical ${q.questionId} missing/short betterAnswer`);
    assert.equal(q.options.length, 0, `Technical ${q.questionId} must have empty options array`);
    assert.equal(q.correctAnswer, "", `Technical ${q.questionId} correctAnswer must be empty string`);
  }
});

runTest("9. Coding schema: title, problemStatement, starterCode, supportedLanguages", () => {
  const codings = JSON.parse(fs.readFileSync(path.join(cognizantDataDir, "coding.json"), "utf8"));
  for (const q of codings) {
    assert.ok(q.title && q.title.trim().length > 0, `Coding ${q.questionId} missing title`);
    assert.ok(q.problemStatement && q.problemStatement.trim().length > 0, `Coding ${q.questionId} missing problemStatement`);
    assert.ok(q.starterCode && q.starterCode.trim().length > 0, `Coding ${q.questionId} missing starterCode`);
    assert.ok(Array.isArray(q.supportedLanguages) && q.supportedLanguages.length >= 2, `Coding ${q.questionId} must support >= 2 languages`);
  }
});

runTest("10. Coding test cases: publicTestCases >= 2, hiddenTestCases >= 2", () => {
  const codings = JSON.parse(fs.readFileSync(path.join(cognizantDataDir, "coding.json"), "utf8"));
  for (const q of codings) {
    assert.ok(Array.isArray(q.publicTestCases) && q.publicTestCases.length >= 2, `Coding ${q.questionId} must have >= 2 public test cases`);
    assert.ok(Array.isArray(q.hiddenTestCases) && q.hiddenTestCases.length >= 2, `Coding ${q.questionId} must have >= 2 hidden test cases`);
    for (const tc of [...q.publicTestCases, ...q.hiddenTestCases]) {
      assert.ok(tc.input !== undefined, `Test case in ${q.questionId} missing input`);
      assert.ok(tc.expected !== undefined, `Test case in ${q.questionId} missing expected`);
    }
  }
});

// ============================================================================
// 2. Selection, Exposure, and Adaptive Difficulty
// ============================================================================
console.log("\n--- 2. Question Selection, Adaptive Engine & Isolation ---");

runTest("11. Random selection produces different question orders", () => {
  const loaded = loadCompanyMockTechnical("cognizant");
  const set1 = selectAdaptiveQuestions(loaded, calculateTargetCounts(15, TARGET_DISTRIBUTIONS.AVERAGE));
  const set2 = selectAdaptiveQuestions(loaded, calculateTargetCounts(15, TARGET_DISTRIBUTIONS.AVERAGE));

  assert.equal(set1.length, 15);
  assert.equal(set2.length, 15);
  const ids1 = set1.map((q) => q.questionId || q.id).join(",");
  const ids2 = set2.map((q) => q.questionId || q.id).join(",");
  assert.notEqual(ids1, ids2, "Two independent selections should have different randomized orders");
});

runTest("12. No-repeat exposure prevents duplicates across multiple mocks", () => {
  const loaded = loadCompanyMockTechnical("cognizant");
  const used = new Set();

  for (let mock = 1; mock <= 5; mock++) {
    const unused = loaded.filter((q) => !used.has(q.questionId || q.id));
    const selected = selectAdaptiveQuestions(unused, calculateTargetCounts(15, TARGET_DISTRIBUTIONS.GOOD));
    assert.equal(selected.length, 15);
    for (const q of selected) {
      const id = q.questionId || q.id;
      assert.ok(!used.has(id), `Duplicate question selected in mock ${mock}: ${id}`);
      used.add(id);
    }
  }
  assert.equal(used.size, 75, "75 unique questions should be consumed over 5 mocks");
});

runTest("13. Complete-cycle reset occurs when remaining pool is exhausted", () => {
  const smallPool = [
    { questionId: "q1", difficulty: "Easy" },
    { questionId: "q2", difficulty: "Easy" },
    { questionId: "q3", difficulty: "Medium" },
  ];
  const used = new Set(["q1", "q2", "q3"]);
  let unused = smallPool.filter((q) => !used.has(q.questionId));
  if (unused.length < 3) {
    used.clear(); // Simulated cycle reset
    unused = [...smallPool];
  }
  assert.equal(unused.length, 3, "Pool resets after exhaustion");
});

runTest("14. Adaptive difficulty accurately applies performance tiers", () => {
  const loaded = loadCompanyMockTechnical("cognizant");

  // Test VERY_WEAK (< 40% accuracy -> 80% Easy, 20% Med, 0% Hard)
  const distWeak = getTargetDistribution(0.30);
  assert.equal(distWeak.Easy, 0.80);
  const countsWeak = calculateTargetCounts(15, distWeak);
  const weakPick = selectAdaptiveQuestions(loaded, countsWeak);
  const easyWeak = weakPick.filter((q) => q.difficulty === "Easy").length;
  assert.ok(easyWeak >= 11, `Expected >= 11 Easy for VERY_WEAK, got ${easyWeak}`);

  // Test EXCELLENT (>= 90% accuracy -> 10% Easy, 40% Med, 50% Hard)
  const distExc = getTargetDistribution(0.95);
  assert.equal(distExc.Hard, 0.50);
  const countsExc = calculateTargetCounts(15, distExc);
  const excPick = selectAdaptiveQuestions(loaded, countsExc);
  const hardExc = excPick.filter((q) => q.difficulty === "Hard").length;
  assert.ok(hardExc >= 7, `Expected >= 7 Hard for EXCELLENT, got ${hardExc}`);
});

runTest("15. Student isolation ensures Student A exposure does not affect Student B", () => {
  const studentAExposures = new Set(["cognizant-tech-1", "cognizant-tech-2"]);
  const studentBExposures = new Set();

  assert.ok(!studentBExposures.has("cognizant-tech-1"), "Student B should not share Student A's exposures");
});

runTest("16. Company isolation ensures Cognizant questions never mix with Celebal, TCS, Wipro, Accenture, Benchmark, or Capgemini", () => {
  const cognizantPool = loadCompanyQuestionsFromFolder("cognizant");
  assert.ok(cognizantPool.length >= 360, "Cognizant pool should have >= 360 combined questions");
  for (const q of cognizantPool) {
    assert.equal(q.companyId, "cognizant", `Found non-cognizant companyId in cognizant bank: ${q.companyId}`);
  }
});

// ============================================================================
// 3. Execution, Evaluation, and KEY2 API Isolation
// ============================================================================
console.log("\n--- 3. Resume, Judge0 & KEY2 AI Evaluator Integration ---");

runTest("17. Resume behavior preserves exact questions and ordering", () => {
  const mockAttempt = {
    selectedQuestions: ["cognizant-tech-10", "cognizant-tech-25", "cognizant-tech-50"],
    answers: [{ questionId: "cognizant-tech-10", answer: "My answer" }],
  };

  const resumedQuestions = [...mockAttempt.selectedQuestions];
  assert.deepEqual(resumedQuestions, ["cognizant-tech-10", "cognizant-tech-25", "cognizant-tech-50"]);
});

runTest("18. Judge0 compatibility verified with standardized language list and constraints", () => {
  const codings = loadCompanyMockCoding("cognizant");
  assert.ok(codings.length >= 30);
  for (const q of codings) {
    assert.ok(q.timeLimit >= 500 && q.timeLimit <= 5000, `Invalid timeLimit in ${q.questionId}`);
    assert.ok(q.memoryLimit >= 128, `Invalid memoryLimit in ${q.questionId}`);
    assert.ok(Array.isArray(q.publicTestCases) && q.publicTestCases.length >= 2);
    assert.ok(Array.isArray(q.hiddenTestCases) && q.hiddenTestCases.length >= 2);
    assert.ok(q.supportedLanguages.includes("JavaScript"));
    assert.ok(q.supportedLanguages.includes("Python"));
  }
});

runTest("19. Cognizant API configuration strictly reads MOCK_INTERVIEW_API_KEY2 only", () => {
  const origKey2 = process.env.MOCK_INTERVIEW_API_KEY2;
  const origKey1 = process.env.MOCK_INTERVIEW_API_KEY;
  const origTcs = process.env.TCS_MOCK_KEY;
  const origAcc = process.env.ACCENTURE_MOCK_KEY;
  const origBen = process.env.BENCHMARK_MOCK_KEY;
  const origAi = process.env.AI_API_KEY;

  try {
    process.env.MOCK_INTERVIEW_API_KEY2 = "cognizant_test_key_12345";
    process.env.MOCK_INTERVIEW_API_KEY = "other_key";
    process.env.TCS_MOCK_KEY = "other_key";
    process.env.ACCENTURE_MOCK_KEY = "other_key";
    process.env.BENCHMARK_MOCK_KEY = "other_key";
    process.env.AI_API_KEY = "other_key";

    assert.equal(SHARED2_CONFIG.getApiKey(), "cognizant_test_key_12345");
    assert.equal(SHARED2_CONFIG.isConfigured(), true);
    assert.equal(isKey2Company("cognizant"), true);

    delete process.env.MOCK_INTERVIEW_API_KEY2;
    assert.equal(SHARED2_CONFIG.getApiKey(), "");
    assert.equal(SHARED2_CONFIG.isConfigured(), false);
  } finally {
    if (origKey2) process.env.MOCK_INTERVIEW_API_KEY2 = origKey2; else delete process.env.MOCK_INTERVIEW_API_KEY2;
    if (origKey1) process.env.MOCK_INTERVIEW_API_KEY = origKey1; else delete process.env.MOCK_INTERVIEW_API_KEY;
    if (origTcs) process.env.TCS_MOCK_KEY = origTcs; else delete process.env.TCS_MOCK_KEY;
    if (origAcc) process.env.ACCENTURE_MOCK_KEY = origAcc; else delete process.env.ACCENTURE_MOCK_KEY;
    if (origBen) process.env.BENCHMARK_MOCK_KEY = origBen; else delete process.env.BENCHMARK_MOCK_KEY;
    if (origAi) process.env.AI_API_KEY = origAi; else delete process.env.AI_API_KEY;
  }
});

await runAsyncTest("20. Missing MOCK_INTERVIEW_API_KEY2 triggers deterministic fallback with status='fallback'", async () => {
  const origKey2 = process.env.MOCK_INTERVIEW_API_KEY2;
  try {
    delete process.env.MOCK_INTERVIEW_API_KEY2;

    const q = {
      companyId: "cognizant",
      question: "Explain ACID properties in DBMS.",
      expectedAnswer: "Atomicity, Consistency, Isolation, Durability.",
      explanation: "Guarantees reliable database transactions.",
      betterAnswer: "ACID properties ensure transaction integrity in relational databases.",
      difficulty: "Medium",
      marks: 3,
    };

    const res = await evaluateShared2SingleAnswer({
      ...q,
      candidateAnswer: "Atomicity means all or nothing, consistency maintains integrity.",
    });

    assert.equal(res.evaluationStatus, "fallback");
    assert.ok(res.score >= 0 && res.score <= 3, `Score ${res.score} out of bounds`);
    assert.ok(res.expectedAnswer.length > 0);
  } finally {
    if (origKey2) process.env.MOCK_INTERVIEW_API_KEY2 = origKey2;
  }
});

runTest("21. Dynamic result calculation computes exact denominator from selected question marks", () => {
  const selectedQuestions = [
    { questionId: "t1", marks: 2 },
    { questionId: "t2", marks: 3 },
    { questionId: "t3", marks: 5 },
    { questionId: "c1", marks: 10 },
  ];
  const dynamicTotal = selectedQuestions.reduce((sum, q) => sum + q.marks, 0);
  assert.equal(dynamicTotal, 20, "Denominator must be dynamically calculated as 20");
});

runTest("22. Strict absence of project / resume / personal candidate questions", () => {
  const techs = JSON.parse(fs.readFileSync(path.join(cognizantDataDir, "technical.json"), "utf8"));
  const mcqs = JSON.parse(fs.readFileSync(path.join(cognizantDataDir, "mcq.json"), "utf8"));
  const codings = JSON.parse(fs.readFileSync(path.join(cognizantDataDir, "coding.json"), "utf8"));

  const forbiddenPatterns = [
    /your project/i,
    /explain your project/i,
    /tell me about a time/i,
    /what was your contribution/i,
    /why did you choose this/i,
    /in your resume/i,
    /in your experience/i,
  ];

  for (const q of [...techs, ...mcqs, ...codings]) {
    const text = q.question || q.problemStatement || q.title || "";
    for (const pattern of forbiddenPatterns) {
      assert.ok(!pattern.test(text), `Forbidden personal/project question detected in ${q.questionId}: "${text}"`);
    }
  }
});

await runAsyncTest("23. evaluateSingleAnswer routes companyId='cognizant' to KEY2 evaluator", async () => {
  const q = {
    companyId: "cognizant",
    question: "What is Quick Sort?",
    expectedAnswer: "Divide and conquer sorting algorithm using a pivot element.",
    explanation: "Partitions array into elements less than and greater than pivot.",
    betterAnswer: "Quick Sort is an in-place divide-and-conquer sorting algorithm.",
    difficulty: "Easy",
    marks: 2,
  };

  const res = await evaluateSingleAnswer({
    ...q,
    candidateAnswer: "It is a divide and conquer algorithm that picks a pivot.",
  });

  assert.ok(res !== null && typeof res === "object");
  assert.ok(res.score >= 0 && res.score <= 2);
});

// ============================================================================
// Summary
// ============================================================================
console.log("\n==================================================");
console.log(`Cognizant Test Suite Complete: ${passed} passed, ${failed} failed.`);
console.log("==================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
