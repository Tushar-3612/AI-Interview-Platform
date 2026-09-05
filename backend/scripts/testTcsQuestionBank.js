/**
 * Comprehensive Test Suite for TCS Company Mock Question Bank and AI Evaluation
 */

import { strict as assert } from "node:assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { tcsConfig } from "../config/companyMock/tcs.js";
import { callTcsAi, isTcsAiConfigured } from "../services/companyMock/ai/tcsAiClient.js";
import { evaluateTcsTechnicalAnswer, getTcsDeterministicFallback } from "../services/companyMock/technical/tcsTechnicalEvaluator.js";
import { evaluateCompanyMockSingleAnswer } from "../services/companyMock/technical/technicalEvaluation.js";
import { loadCompanyQuestionsFromFolder, loadCompanyMockTechnical } from "../services/companyMockBank.js";
import {
  selectAdaptiveQuestions,
  calculateTargetCounts,
  getPerformanceTier,
  getTargetDistribution,
  TARGET_DISTRIBUTIONS,
} from "../services/companyMock/adaptive/adaptiveDifficulty.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const tcsDataDir = path.resolve(rootDir, "data/companyMock/tcs");

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

console.log("=== Starting TCS Company Mock Test Suite ===\n");

// ============================================================================
// Group 1: Question Bank Loading & Integrity
// ============================================================================
console.log("--- 1. Question Bank Loading & Integrity ---");

runTest("TCS MCQ bank exists and contains at least 150 questions", () => {
  const mcqPath = path.join(tcsDataDir, "mcq.json");
  assert.ok(fs.existsSync(mcqPath), "mcq.json must exist");
  const questions = JSON.parse(fs.readFileSync(mcqPath, "utf8"));
  assert.ok(Array.isArray(questions), "mcq.json must be an array");
  assert.ok(questions.length >= 150, `Expected at least 150 MCQs, got ${questions.length}`);
});

runTest("TCS Technical bank exists and contains at least 150 questions", () => {
  const techPath = path.join(tcsDataDir, "technical.json");
  assert.ok(fs.existsSync(techPath), "technical.json must exist");
  const questions = JSON.parse(fs.readFileSync(techPath, "utf8"));
  assert.ok(Array.isArray(questions), "technical.json must be an array");
  assert.ok(questions.length >= 150, `Expected at least 150 technical questions, got ${questions.length}`);
});

runTest("TCS Coding bank exists and contains at least 30 questions", () => {
  const codingPath = path.join(tcsDataDir, "coding.json");
  assert.ok(fs.existsSync(codingPath), "coding.json must exist");
  const questions = JSON.parse(fs.readFileSync(codingPath, "utf8"));
  assert.ok(Array.isArray(questions), "coding.json must be an array");
  assert.ok(questions.length >= 30, `Expected at least 30 coding questions, got ${questions.length}`);
});

runTest("All TCS question IDs are unique across all TCS banks", () => {
  const mcqs = JSON.parse(fs.readFileSync(path.join(tcsDataDir, "mcq.json"), "utf8"));
  const techs = JSON.parse(fs.readFileSync(path.join(tcsDataDir, "technical.json"), "utf8"));
  const codings = JSON.parse(fs.readFileSync(path.join(tcsDataDir, "coding.json"), "utf8"));

  const seenIds = new Set();
  for (const q of [...mcqs, ...techs, ...codings]) {
    const id = q.questionId || q.id;
    assert.ok(id, "Question must have an id or questionId");
    assert.ok(!seenIds.has(id), `Duplicate ID detected: ${id}`);
    seenIds.add(id);
  }
});

runTest("TCS MCQ questions have valid marks, difficulty, 4 options, and correctAnswer", () => {
  const mcqs = JSON.parse(fs.readFileSync(path.join(tcsDataDir, "mcq.json"), "utf8"));
  const expectedMarks = { Easy: 2, Medium: 3, Hard: 5 };

  for (const q of mcqs) {
    assert.ok(["Easy", "Medium", "Hard"].includes(q.difficulty), `Invalid difficulty in ${q.questionId}`);
    assert.equal(q.marks, expectedMarks[q.difficulty], `Incorrect marks for ${q.difficulty} in ${q.questionId}`);
    assert.ok(Array.isArray(q.options) && q.options.length === 4, `Expected 4 options in ${q.questionId}`);
    assert.ok(q.correctAnswer, `Missing correctAnswer in ${q.questionId}`);
    assert.ok(q.options.includes(q.correctAnswer), `correctAnswer must be in options in ${q.questionId}`);
  }
});

runTest("TCS Technical questions have valid marks, difficulty, and reference answers", () => {
  const techs = JSON.parse(fs.readFileSync(path.join(tcsDataDir, "technical.json"), "utf8"));
  const expectedMarks = { Easy: 2, Medium: 3, Hard: 5 };

  for (const q of techs) {
    assert.ok(["Easy", "Medium", "Hard"].includes(q.difficulty), `Invalid difficulty in ${q.questionId}`);
    assert.equal(q.marks, expectedMarks[q.difficulty], `Incorrect marks for ${q.difficulty} in ${q.questionId}`);
    assert.ok(q.expectedAnswer && q.expectedAnswer.trim().length > 10, `Missing expectedAnswer in ${q.questionId}`);
    assert.ok(q.explanation && q.explanation.trim().length > 10, `Missing explanation in ${q.questionId}`);
  }
});

runTest("TCS Coding questions have valid test cases, starter code, and 10 marks", () => {
  const codings = JSON.parse(fs.readFileSync(path.join(tcsDataDir, "coding.json"), "utf8"));

  for (const q of codings) {
    assert.ok(["Easy", "Medium", "Hard"].includes(q.difficulty), `Invalid difficulty in ${q.questionId}`);
    assert.equal(q.marks, 10, `Expected 10 marks for coding question ${q.questionId}`);
    assert.ok(Array.isArray(q.publicTestCases) && q.publicTestCases.length >= 2, `Missing publicTestCases in ${q.questionId}`);
    assert.ok(Array.isArray(q.hiddenTestCases) && q.hiddenTestCases.length >= 2, `Missing hiddenTestCases in ${q.questionId}`);
    assert.ok(q.starterCode && q.starterCode.includes("function"), `Missing starterCode in ${q.questionId}`);
  }
});

// ============================================================================
// Group 2: Dynamic Bank Loading via companyMockBank
// ============================================================================
console.log("\n--- 2. Dynamic Bank Loading ---");

runTest("loadCompanyQuestionsFromFolder loads both mcq and technical questions for TCS", () => {
  const loaded = loadCompanyQuestionsFromFolder("tcs");
  assert.ok(Array.isArray(loaded), "Loaded result must be an array");
  const mcqs = loaded.filter((q) => q.questionType?.toLowerCase() === "mcq");
  const techs = loaded.filter((q) => q.questionType?.toLowerCase() !== "mcq");
  assert.ok(mcqs.length >= 150, `Expected >= 150 MCQs loaded, got ${mcqs.length}`);
  assert.ok(techs.length >= 150, `Expected >= 150 Tech loaded, got ${techs.length}`);
});

runTest("loadCompanyMockTechnical loads technical questions for TCS", () => {
  const loaded = loadCompanyMockTechnical("tcs");
  assert.ok(Array.isArray(loaded), "Loaded result must be an array");
  assert.ok(loaded.length >= 150, `Expected >= 150 items loaded, got ${loaded.length}`);
});

// ============================================================================
// Group 3: API Key & Configuration Isolation
// ============================================================================
console.log("\n--- 3. API Key & Configuration Isolation ---");

runTest("TCS configuration strictly reads TCS_MOCK_KEY and TCS_MOCK_MODEL", () => {
  const origTcsKey = process.env.TCS_MOCK_KEY;
  const origTcsModel = process.env.TCS_MOCK_MODEL;
  const origMockKey = process.env.MOCK_INTERVIEW_API_KEY;
  const origAiKey = process.env.AI_API_KEY;

  try {
    process.env.TCS_MOCK_KEY = "test_tcs_key_12345";
    process.env.TCS_MOCK_MODEL = "gemini-2.5-flash";
    process.env.MOCK_INTERVIEW_API_KEY = "celebal_secret_key";
    process.env.AI_API_KEY = "real_interview_secret_key";

    assert.equal(tcsConfig.getApiKey(), "test_tcs_key_12345");
    assert.equal(tcsConfig.getModel(), "gemini-2.5-flash");
    assert.equal(tcsConfig.isConfigured(), true);

    // Verify it NEVER reads Celebal or Real Interview keys
    delete process.env.TCS_MOCK_KEY;
    assert.equal(tcsConfig.getApiKey(), "");
    assert.equal(tcsConfig.isConfigured(), false);
  } finally {
    if (origTcsKey) process.env.TCS_MOCK_KEY = origTcsKey; else delete process.env.TCS_MOCK_KEY;
    if (origTcsModel) process.env.TCS_MOCK_MODEL = origTcsModel; else delete process.env.TCS_MOCK_MODEL;
    if (origMockKey) process.env.MOCK_INTERVIEW_API_KEY = origMockKey; else delete process.env.MOCK_INTERVIEW_API_KEY;
    if (origAiKey) process.env.AI_API_KEY = origAiKey; else delete process.env.AI_API_KEY;
  }
});

// ============================================================================
// Group 4: Technical Evaluator & Deterministic Fallback
// ============================================================================
console.log("\n--- 4. Technical Evaluator & Fallback Behavior ---");

runTest("Deterministic fallback generates expected structure and bounded score", () => {
  const q = {
    question: "Explain what is a static method in Java.",
    expectedAnswer: "A static method belongs to the class rather than instances and is called without creating an object.",
    explanation: "Static methods cannot access non-static members directly.",
    betterAnswer: "Static methods are utility methods loaded into method area when class is loaded.",
    difficulty: "Easy",
    marks: 2,
  };

  const fb1 = getTcsDeterministicFallback(q, "A static method belongs to the class and can be called without an object.");
  assert.equal(fb1.evaluationStatus, "fallback");
  assert.ok(fb1.score >= 0 && fb1.score <= 2, `Score ${fb1.score} out of bounds for Easy (max 2)`);
  assert.ok(fb1.evaluation, "Evaluation text must be present");
  assert.ok(Array.isArray(fb1.strengths), "Strengths must be an array");
  assert.ok(Array.isArray(fb1.weaknesses), "Weaknesses must be an array");

  const fbEmpty = getTcsDeterministicFallback(q, "");
  assert.equal(fbEmpty.score, 0);
  assert.equal(fbEmpty.evaluationStatus, "fallback");
});

await runAsyncTest("TCS Technical evaluation falls back gracefully when TCS_MOCK_KEY is not set", async () => {
  const origTcsKey = process.env.TCS_MOCK_KEY;
  try {
    delete process.env.TCS_MOCK_KEY;

    const q = {
      question: "What is polymorphism in OOP?",
      expectedAnswer: "Polymorphism allows objects to take multiple forms through method overriding and overloading.",
      explanation: "Compile time is overloading and runtime is overriding.",
      difficulty: "Medium",
      marks: 3,
    };

    const res = await evaluateTcsTechnicalAnswer(q, "Polymorphism means many forms like overloading and overriding.");
    assert.equal(res.evaluationStatus, "fallback");
    assert.ok(res.score >= 0 && res.score <= 3, `Score must be between 0 and 3, got ${res.score}`);
  } finally {
    if (origTcsKey) process.env.TCS_MOCK_KEY = origTcsKey;
  }
});

await runAsyncTest("TCS Technical evaluation enforces strict upper bound for Easy (max 2), Medium (max 3), Hard (max 5)", async () => {
  // Test Easy boundary
  const qEasy = { difficulty: "Easy", marks: 2, expectedAnswer: "Ans", explanation: "Exp" };
  const fbEasy = getTcsDeterministicFallback(qEasy, "Ans");
  assert.ok(fbEasy.score <= 2, `Easy score ${fbEasy.score} exceeded 2`);

  // Test Medium boundary
  const qMed = { difficulty: "Medium", marks: 3, expectedAnswer: "Ans", explanation: "Exp" };
  const fbMed = getTcsDeterministicFallback(qMed, "Ans");
  assert.ok(fbMed.score <= 3, `Med score ${fbMed.score} exceeded 3`);

  // Test Hard boundary
  const qHard = { difficulty: "Hard", marks: 5, expectedAnswer: "Ans", explanation: "Exp" };
  const fbHard = getTcsDeterministicFallback(qHard, "Ans");
  assert.ok(fbHard.score <= 5, `Hard score ${fbHard.score} exceeded 5`);
});

// ============================================================================
// Group 5: Company Routing via evaluateCompanyMockSingleAnswer
// ============================================================================
console.log("\n--- 5. Company Routing ---");

await runAsyncTest("evaluateCompanyMockSingleAnswer routes companyId='tcs' to TCS evaluator", async () => {
  const q = {
    question: "What is deadlock in OS?",
    expectedAnswer: "A situation where two or more processes are blocked waiting for resources held by each other.",
    difficulty: "Medium",
    marks: 3,
  };

  const res = await evaluateCompanyMockSingleAnswer(q, "Deadlock happens when processes wait for each other.", {
    companyId: "tcs",
  });
  assert.ok(res.evaluationStatus, "Must return an evaluation status");
  assert.ok(res.score <= 3, "Score must not exceed marks");
});

await runAsyncTest("evaluateCompanyMockSingleAnswer routes companyId='celebal' to Celebal evaluator without error", async () => {
  const q = {
    question: "What is Spark DataFrame?",
    expectedAnswer: "A distributed collection of data organized into named columns.",
    difficulty: "Easy",
    marks: 2,
  };

  const res = await evaluateCompanyMockSingleAnswer(q, "Distributed data organized in columns.", {
    companyId: "celebal",
  });
  assert.ok(res.evaluationStatus, "Must return an evaluation status");
  assert.ok(res.score <= 2, "Score must not exceed marks");
});

// ============================================================================
// Group 6: Adaptive Difficulty Integration with TCS Questions
// ============================================================================
console.log("\n--- 6. Adaptive Difficulty Integration ---");

runTest("TCS Technical question bank seamlessly integrates with selectAdaptiveQuestions", () => {
  const tcsTechQuestions = loadCompanyMockTechnical("tcs");
  const dist = getTargetDistribution("NO_HISTORY");
  const targetCounts = calculateTargetCounts(15, dist);

  // Simulate picking 15 technical questions for a student with NO_HISTORY
  const selected = selectAdaptiveQuestions(tcsTechQuestions, targetCounts);

  assert.equal(selected.length, 15, `Expected 15 questions, got ${selected.length}`);
  const easyCount = selected.filter((q) => q.difficulty === "Easy").length;
  const medCount = selected.filter((q) => q.difficulty === "Medium").length;
  const hardCount = selected.filter((q) => q.difficulty === "Hard").length;

  assert.equal(easyCount + medCount + hardCount, 15, "All questions must have valid difficulty");
  assert.ok(easyCount >= 6, `Expected at least 6 Easy for NO_HISTORY, got ${easyCount}`);
});

runTest("TCS Adaptive selection supports repeated attempts without duplicates until exhausted", () => {
  const tcsTechQuestions = loadCompanyMockTechnical("tcs");
  const usedIds = new Set();
  const dist = getTargetDistribution(0.85); // Good tier
  const targetCounts = calculateTargetCounts(15, dist);

  for (let attempt = 1; attempt <= 5; attempt++) {
    const unusedPool = tcsTechQuestions.filter((q) => !usedIds.has(q.questionId || q.id));
    const selected = selectAdaptiveQuestions(unusedPool, targetCounts);

    assert.equal(selected.length, 15, `Attempt ${attempt}: Expected 15 questions`);
    for (const q of selected) {
      const qId = q.questionId || q.id;
      assert.ok(!usedIds.has(qId), `Duplicate question selected in attempt ${attempt}: ${qId}`);
      usedIds.add(qId);
    }
  }

  assert.equal(usedIds.size, 75, "75 unique questions must have been exposed over 5 mocks");
});

// ============================================================================
// Summary
// ============================================================================
console.log("\n==================================================");
console.log(`TCS Test Suite Complete: ${passed} passed, ${failed} failed.`);
console.log("==================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
