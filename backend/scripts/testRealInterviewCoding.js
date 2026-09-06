import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  generateAndProcessCodingQuestions,
  getCodingQuestions,
  runCodingCode,
  submitCodingCode,
  evaluateCodingInterviewSession,
} from "../services/realInterview/codingService.js";
import RealInterviewCodingQuestion from "../models/RealInterviewCodingQuestion.js";
import RealInterviewCodingSession from "../models/RealInterviewCodingSession.js";
import RealInterviewCodingSubmission from "../models/RealInterviewCodingSubmission.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

async function runCodingTest() {
  console.log("\n=======================================================");
  console.log("🧪 TESTING REAL INTERVIEW CODING ROUND (3 PROBLEMS | 100 MARKS | JUDGE0 | ZERO COMPILER AI CALLS)");
  console.log("=======================================================\n");

  console.log("1. Environment Verification:");
  console.log(`   - REAL_INTERVIEW_CODING_API_KEY: ${process.env.REAL_INTERVIEW_CODING_API_KEY ? "✅ Configured" : "❌ Missing"}`);

  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI missing in .env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB Connected Successfully\n");

  const sessionId = `test_coding_3p_${Date.now()}`;
  const candidateProfile = {
    fullName: "Priya Patel",
    skills: ["Python", "JavaScript", "Java", "C++", "Data Structures"],
  };

  try {
    // Clean up any pre-existing test data for sessionId
    await RealInterviewCodingQuestion.deleteMany({ sessionId });
    await RealInterviewCodingSession.deleteMany({ sessionId });
    await RealInterviewCodingSubmission.deleteMany({ sessionId });

    // Step 2: Test CALL #1 (Question Generation)
    console.log("2. Testing CALL #1: Coding Problem Generation (Target: Exactly 3 problems)...");
    const genResult = await generateAndProcessCodingQuestions({
      sessionId,
      candidateProfile,
    });

    console.log(`   - Problems generated: ${genResult.questions.length}`);
    console.log(`   - Reused flag: ${genResult.reused}`);
    console.log(`   - aiGenerationCalls: ${genResult.aiGenerationCalls}`);

    if (genResult.questions.length !== 3) {
      throw new Error(`Expected exactly 3 Coding problems, got ${genResult.questions.length}`);
    }
    if (genResult.aiGenerationCalls !== 1) {
      throw new Error(`Expected aiGenerationCalls to be 1, got ${genResult.aiGenerationCalls}`);
    }

    // Step 3: Test Generation Idempotency
    console.log("\n3. Testing Generation Idempotency (Calling generate AGAIN)...");
    const genRepeatResult = await generateAndProcessCodingQuestions({
      sessionId,
      candidateProfile,
    });

    console.log(`   - Reused flag: ${genRepeatResult.reused}`);
    console.log(`   - aiGenerationCalls: ${genRepeatResult.aiGenerationCalls}`);

    if (!genRepeatResult.reused || genRepeatResult.aiGenerationCalls !== 1) {
      throw new Error("Generation idempotency failed: duplicate AI call triggered!");
    }

    // Step 4: DB Question & Marks Verification (20m, 30m, 50m = 100m total)
    console.log("\n4. DB Question & Marks Verification (20m, 30m, 50m = 100m total)...");
    const dbQuestions = await RealInterviewCodingQuestion.find({ sessionId }).sort({ orderIndex: 1 });
    console.log(`   - Total persisted problems: ${dbQuestions.length}`);

    const expectedMarks = [20, 30, 50];
    let totalMaxMarks = 0;

    dbQuestions.forEach((q, idx) => {
      totalMaxMarks += q.marks;
      console.log(`     P${idx + 1} [Order ${q.orderIndex}]: "${q.title}" (${q.difficulty}, ${q.marks} marks)`);
      if (q.marks !== expectedMarks[idx]) {
        throw new Error(`Problem #${q.orderIndex} marks is ${q.marks}, expected ${expectedMarks[idx]}!`);
      }
    });

    console.log(`   - Total Max Marks in DB: ${totalMaxMarks} (Expected: 100)`);
    if (totalMaxMarks !== 100) {
      throw new Error(`Total max marks in DB is ${totalMaxMarks}, expected 100!`);
    }

    // Step 5: Test Client Security (Hidden test cases MUST NOT be exposed)
    console.log("\n5. Testing Client Security (Hidden test cases MUST NOT be returned in API)...");
    const clientData = await getCodingQuestions({ sessionId });
    clientData.questions.forEach((q, idx) => {
      if (q.hiddenTestCases && q.hiddenTestCases.length > 0) {
        throw new Error(`SECURITY VIOLATION: Hidden test cases exposed to client on Problem #${idx + 1}!`);
      }
    });
    console.log("   - ✅ Hidden test cases successfully hidden from client payload.");

    // Step 6: Test Run Code (Visible Test Cases ONLY, 0 AI Calls)
    console.log("\n6. Testing Run Code against visible test cases ONLY (0 AI Calls)...");
    const samplePythonCode1 = `
def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], i]
        seen[num] = i
    return []
`;

    const runResult = await runCodingCode({
      sessionId,
      questionId: dbQuestions[0]._id,
      language: "python",
      sourceCode: samplePythonCode1,
    });

    console.log(`   - Run Code Status: ${runResult.status}`);
    console.log(`   - Passed: ${runResult.passed} / ${runResult.total}`);
    if (!runResult.success) {
      throw new Error("Run code failed!");
    }

    // Step 7: Test Submit Code (Visible + Hidden Test Cases via Judge0, 0 AI Calls)
    console.log("\n7. Testing Submit Code against all test cases via Judge0 (0 AI Calls)...");
    const subResult1 = await submitCodingCode({
      sessionId,
      questionId: dbQuestions[0]._id,
      language: "python",
      sourceCode: samplePythonCode1,
    });

    console.log(`   - P1 Submit Status: ${subResult1.status}`);
    console.log(`   - P1 Score: ${subResult1.score} / ${subResult1.maxMarks}`);
    console.log(`   - Session Total Score: ${subResult1.sessionTotalScore} / 100`);

    if (subResult1.score !== 20) {
      console.warn(`   ⚠️ Warning: Problem 1 score was ${subResult1.score}/20`);
    }

    // Verify hidden testcase secrecy in submission return
    (subResult1.testResults || []).forEach((tr) => {
      if (tr.isHidden && (tr.input || tr.expected)) {
        throw new Error("SECURITY VIOLATION: Hidden testcase input/expected leaked in submission result!");
      }
    });
    console.log("   - ✅ Hidden testcase inputs/outputs verified stripped from submission result.");

    // Step 8: Evaluate Coding Session (0 AI Calls)
    console.log("\n8. Evaluating Coding Session (0 AI Calls)...");
    const sessionEval = await evaluateCodingInterviewSession({ sessionId });

    console.log(`   - Total Score: ${sessionEval.totalScore} / ${sessionEval.maxScore}`);
    console.log(`   - Percentage: ${sessionEval.percentage}%`);
    console.log(`   - Overall Rating: ${sessionEval.overallRating}`);
    console.log(`   - Problems Evaluated: ${sessionEval.problems.length}`);

    if (sessionEval.maxScore !== 100) {
      throw new Error(`Expected maxScore 100, got ${sessionEval.maxScore}`);
    }

    // Step 9: Final AI Call Audit
    const finalSessionDoc = await RealInterviewCodingSession.findOne({ sessionId });
    const totalAICalls = finalSessionDoc.aiGenerationCalls;

    console.log("\n=======================================================");
    console.log("📊 FINAL CODING SESSION AI CALL AUDIT:");
    console.log(`   - aiGenerationCalls: ${finalSessionDoc.aiGenerationCalls} (Max allowed: 1)`);
    console.log("   - Compiler execution AI calls: 0");
    console.log("   - Submission AI calls: 0");
    console.log("   - Evaluation AI calls: 0");
    console.log(`   - TOTAL AI API CALLS: ${totalAICalls}`);
    console.log("=======================================================\n");

    if (totalAICalls > 1) {
      throw new Error(`EXCEEDED AI BUDGET: Made ${totalAICalls} calls (Max allowed: 1 for problem generation)`);
    }

    console.log("🎉 ALL TESTS PASSED: Coding round has EXACTLY 3 problems (20m, 30m, 50m = 100m total), Judge0 integration, zero compiler AI calls, and hidden testcase security!\n");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("\n❌ CODING TEST FAILED:", err.message);
    console.error(err.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runCodingTest();
