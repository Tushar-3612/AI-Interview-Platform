import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

import RealInterviewCodingQuestion from "../models/RealInterviewCodingQuestion.js";
import RealInterviewCodingSession from "../models/RealInterviewCodingSession.js";
import RealInterviewCodingSubmission from "../models/RealInterviewCodingSubmission.js";
import RealInterviewResult from "../models/RealInterviewResult.js";
import { evaluateCodingInterviewSession } from "../services/realInterview/codingService.js";
import { calculateRealInterviewResult } from "../services/realInterview/realInterviewResultService.js";

let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  [PASS] ${message}`);
  } else {
    console.error(`  [FAIL] ${message}`);
  }
}

async function runCodingTests() {
  console.log("==================================================");
  console.log("RUNNING CODING ROUND EVALUATION REGRESSION SUITE");
  console.log("==================================================");

  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/ai-interview-engine";
  await mongoose.connect(mongoUri);
  console.log("MongoDB connected successfully.\n");

  const testSessionId = `test_coding_reg_${Date.now()}`;
  const testUserId = new mongoose.Types.ObjectId();

  try {
    // 1. Setup 3 mock coding questions in DB: Q1 (20m), Q2 (30m), Q3 (50m)
    const q1 = await RealInterviewCodingQuestion.create({
      sessionId: testSessionId,
      userId: testUserId,
      orderIndex: 1,
      title: "Two Sum Problem",
      description: "Find two numbers that add up to target.",
      difficulty: "Easy",
      marks: 20,
      visibleTestCases: [
        { input: "[2, 7, 11, 15]\n9", expected: "[0, 1]", isHidden: false },
        { input: "[3, 2, 4]\n6", expected: "[1, 2]", isHidden: false },
      ],
      hiddenTestCases: [
        { input: "[3, 3]\n6", expected: "[0, 1]", isHidden: true },
        { input: "[1, 5, 8]\n9", expected: "[0, 2]", isHidden: true },
      ],
    });

    const q2 = await RealInterviewCodingQuestion.create({
      sessionId: testSessionId,
      userId: testUserId,
      orderIndex: 2,
      title: "Longest Substring Without Repeating Characters",
      description: "Find length of longest substring without repeating characters.",
      difficulty: "Medium",
      marks: 30,
      visibleTestCases: [
        { input: "abcabcbb", expected: "3", isHidden: false },
        { input: "bbbbb", expected: "1", isHidden: false },
      ],
      hiddenTestCases: [
        { input: "pwwkew", expected: "3", isHidden: true },
        { input: "", expected: "0", isHidden: true },
      ],
    });

    const q3 = await RealInterviewCodingQuestion.create({
      sessionId: testSessionId,
      userId: testUserId,
      orderIndex: 3,
      title: "Median of Two Sorted Arrays",
      description: "Find median of two sorted arrays in O(log(m+n)).",
      difficulty: "Hard",
      marks: 50,
      visibleTestCases: [
        { input: "[1, 3]\n[2]", expected: "2.0", isHidden: false },
        { input: "[1, 2]\n[3, 4]", expected: "2.5", isHidden: false },
      ],
      hiddenTestCases: [
        { input: "[0, 0]\n[0, 0]", expected: "0.0", isHidden: true },
        { input: "[]\n[1]", expected: "1.0", isHidden: true },
      ],
    });

    // 2. Setup Coding Session in DB
    const session = await RealInterviewCodingSession.create({
      sessionId: testSessionId,
      userId: testUserId,
      generationStatus: "GENERATED",
      status: "in_progress",
      problemScores: [
        {
          questionId: q1._id,
          orderIndex: 1,
          title: q1.title,
          difficulty: "Easy",
          maxMarks: 20,
          score: 20, // 4/4 passed (Full score)
          status: "Accepted",
          passedTests: 4,
          totalTests: 4,
          lastLanguage: "python",
        },
        {
          questionId: q2._id,
          orderIndex: 2,
          title: q2.title,
          difficulty: "Medium",
          maxMarks: 30,
          score: 15, // 2/4 passed (Partial score = 50% of 30 = 15)
          status: "Partial",
          passedTests: 2,
          totalTests: 4,
          lastLanguage: "javascript",
        },
        // Q3 is not in problemScores -> Unattempted
      ],
    });

    // Submissions in DB
    await RealInterviewCodingSubmission.create({
      sessionId: testSessionId,
      questionId: q1._id,
      userId: testUserId,
      language: "python",
      sourceCode: "def twoSum(nums, target):\n    lookup = {}\n    for i, num in enumerate(nums):\n        if target - num in lookup:\n            return [lookup[target - num], i]\n        lookup[num] = i",
      status: "Accepted",
      passedTests: 4,
      totalTests: 4,
      score: 20,
      maxMarks: 20,
    });

    await RealInterviewCodingSubmission.create({
      sessionId: testSessionId,
      questionId: q2._id,
      userId: testUserId,
      language: "javascript",
      sourceCode: "function lengthOfLongestSubstring(s) {\n    return s.length > 0 ? 3 : 0;\n}",
      status: "Partial",
      passedTests: 2,
      totalTests: 4,
      score: 15,
      maxMarks: 30,
    });

    console.log("--- PART 1: TEST evaluateCodingInterviewSession ---");
    const codingEvalResult = await evaluateCodingInterviewSession({ sessionId: testSessionId });

    assert(codingEvalResult.success === true, "evaluateCodingInterviewSession returns success: true");
    assert(Array.isArray(codingEvalResult.problems), "evaluateCodingInterviewSession returns problems array");
    assert(Array.isArray(codingEvalResult.evaluations), "evaluateCodingInterviewSession returns evaluations alias for compatibility");
    assert(codingEvalResult.totalScore === 35, `Total score should be 20 + 15 = 35, got ${codingEvalResult.totalScore}`);
    assert(codingEvalResult.maxScore === 100, `Max score should be 100, got ${codingEvalResult.maxScore}`);
    assert(codingEvalResult.percentage === 35, `Percentage should be 35%, got ${codingEvalResult.percentage}%`);

    console.log("\n--- PART 2: TEST calculateRealInterviewResult (End-to-End Extraction) ---");
    const fullResult = await calculateRealInterviewResult({ sessionId: testSessionId, userId: testUserId });

    assert(fullResult.status === "COMPLETED", "Full interview result status is COMPLETED");
    assert(fullResult.rounds?.coding?.obtained === 35, `Rounds.coding.obtained should be 35, got ${fullResult.rounds?.coding?.obtained}`);
    assert(fullResult.rounds?.coding?.maximum === 100, `Rounds.coding.maximum should be 100, got ${fullResult.rounds?.coding?.maximum}`);
    assert(fullResult.rounds?.coding?.attempted === 2, `Rounds.coding.attempted should be 2, got ${fullResult.rounds?.coding?.attempted}`);
    assert(fullResult.rounds?.coding?.totalQuestions === 3, `Rounds.coding.totalQuestions should be 3, got ${fullResult.rounds?.coding?.totalQuestions}`);

    const codingQResults = fullResult.questionResults.filter((q) => q.roundType === "CODING");
    assert(codingQResults.length === 3, `Should have exactly 3 coding question results, got ${codingQResults.length}`);

    // Q1 Checks (Full pass)
    const resQ1 = codingQResults.find((q) => String(q.questionId) === q1._id.toString());
    assert(resQ1 !== undefined, "Q1 result found");
    assert(resQ1.score === 20, `Q1 score should be 20/20, got ${resQ1.score}`);
    assert(resQ1.status === "CORRECT", `Q1 status should be CORRECT, got ${resQ1.status}`);
    assert(!resQ1.feedback.includes("0/0"), `Q1 feedback must NOT contain 0/0 test cases (got: "${resQ1.feedback}")`);
    assert(resQ1.feedback.includes("4/4"), `Q1 feedback must mention 4/4 test cases (got: "${resQ1.feedback}")`);

    // Q2 Checks (Partial pass)
    const resQ2 = codingQResults.find((q) => String(q.questionId) === q2._id.toString());
    assert(resQ2 !== undefined, "Q2 result found");
    assert(resQ2.score === 15, `Q2 score should be 15/30, got ${resQ2.score}`);
    assert(resQ2.status === "PARTIALLY_CORRECT", `Q2 status should be PARTIALLY_CORRECT, got ${resQ2.status}`);
    assert(!resQ2.feedback.includes("0/0"), `Q2 feedback must NOT contain 0/0 test cases (got: "${resQ2.feedback}")`);
    assert(resQ2.feedback.includes("2/4"), `Q2 feedback must mention 2/4 test cases (got: "${resQ2.feedback}")`);

    // Q3 Checks (Unattempted)
    const resQ3 = codingQResults.find((q) => String(q.questionId) === q3._id.toString());
    assert(resQ3 !== undefined, "Q3 result found");
    assert(resQ3.score === 0, `Q3 score should be 0/50, got ${resQ3.score}`);
    assert(resQ3.status === "NOT_ATTEMPTED", `Q3 status should be NOT_ATTEMPTED, got ${resQ3.status}`);
    assert(resQ3.feedback === "No code was submitted for this problem.", `Q3 feedback should be unattempted notice (got: "${resQ3.feedback}")`);

    console.log("\n--- PART 3: TEST COMPILATION & RUNTIME ERROR HANDLING ---");
    const testSessionId2 = `test_coding_err_${Date.now()}`;
    const qErr = await RealInterviewCodingQuestion.create({
      sessionId: testSessionId2,
      userId: testUserId,
      orderIndex: 1,
      title: "Syntax Error Problem",
      description: "Test compilation failure.",
      difficulty: "Easy",
      marks: 20,
      visibleTestCases: [{ input: "1", expected: "1", isHidden: false }],
      hiddenTestCases: [{ input: "2", expected: "2", isHidden: true }],
    });

    await RealInterviewCodingSession.create({
      sessionId: testSessionId2,
      userId: testUserId,
      generationStatus: "GENERATED",
      status: "in_progress",
      problemScores: [
        {
          questionId: qErr._id,
          orderIndex: 1,
          title: qErr.title,
          difficulty: "Easy",
          maxMarks: 20,
          score: 0,
          status: "Compilation Error",
          passedTests: 0,
          totalTests: 2,
          lastLanguage: "cpp",
        },
      ],
    });

    await RealInterviewCodingSubmission.create({
      sessionId: testSessionId2,
      questionId: qErr._id,
      userId: testUserId,
      language: "cpp",
      sourceCode: "int main() { syntax error }",
      status: "Compilation Error",
      passedTests: 0,
      totalTests: 2,
      score: 0,
      maxMarks: 20,
      compileOutput: "error: expected ';' before 'syntax'",
    });

    const errResult = await calculateRealInterviewResult({ sessionId: testSessionId2, userId: testUserId });
    const resErr = errResult.questionResults.find((q) => String(q.questionId) === qErr._id.toString());
    assert(resErr !== undefined, "Compilation error question found");
    assert(resErr.score === 0, `Compilation error score should be 0, got ${resErr.score}`);
    assert(resErr.status === "INCORRECT", `Compilation error status should be INCORRECT, got ${resErr.status}`);
    assert(resErr.feedback.includes("Compilation Error"), `Feedback should indicate Compilation Error (got: "${resErr.feedback}")`);

    // Clean up test documents
    await Promise.all([
      RealInterviewCodingQuestion.deleteMany({ sessionId: { $in: [testSessionId, testSessionId2] } }),
      RealInterviewCodingSession.deleteMany({ sessionId: { $in: [testSessionId, testSessionId2] } }),
      RealInterviewCodingSubmission.deleteMany({ sessionId: { $in: [testSessionId, testSessionId2] } }),
      RealInterviewResult.deleteMany({ sessionId: { $in: [testSessionId, testSessionId2] } }),
    ]);

    console.log("\n==================================================");
    console.log(`CODING REGRESSION TEST SUMMARY: ${passedCount}/${totalCount} tests PASSED!`);
    console.log("==================================================");
  } finally {
    await mongoose.disconnect();
  }
}

runCodingTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
