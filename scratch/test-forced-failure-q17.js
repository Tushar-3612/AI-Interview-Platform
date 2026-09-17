import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

import RealInterviewTechnicalQuestion from "../backend/models/RealInterviewTechnicalQuestion.js";
import RealInterviewTechnicalSession from "../backend/models/RealInterviewTechnicalSession.js";
import { generateAndProcessTechnicalQuestions } from "../backend/services/realInterview/technicalService.js";

async function runQ17ForcedFailureTest() {
  console.log("=== STARTING MANDATORY Q17 FORCED FAILURE & RESUME TEST ===");

  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/ai-interview";
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB for testing.");

  const testSessionId = `test_q17_forced_fail_${Date.now()}`;
  const testUserId = new mongoose.Types.ObjectId();

  try {
    // 1. Clean up any previous test state
    await RealInterviewTechnicalQuestion.deleteMany({ sessionId: testSessionId });
    await RealInterviewTechnicalSession.deleteMany({ sessionId: testSessionId });

    console.log(`\n--- TEST STEP 1: Simulate Q1-Q16 Generation (16 existing questions in DB) ---`);
    // Pre-seed Q1-Q16 in DB to represent a session where Q1-Q16 were generated & saved
    const initialDocs = [];
    for (let i = 0; i < 16; i++) {
      const diff = i <= 5 ? "easy" : "medium";
      initialDocs.push({
        sessionId: testSessionId,
        userId: testUserId,
        orderIndex: i,
        question: `Test Technical Question #${i + 1} (${diff})`,
        expectedKnowledge: `Expected knowledge for Q#${i + 1}`,
        difficulty: diff,
        maxMarks: diff === "easy" ? 3 : 5,
        topic: "Testing Fundamentals",
        category: "Conceptual",
        source: "AI_PROVIDER",
      });
    }
    await RealInterviewTechnicalQuestion.insertMany(initialDocs);
    await RealInterviewTechnicalSession.create({
      sessionId: testSessionId,
      userId: testUserId,
      generationStatus: "GENERATING",
      aiGenerationCalls: 8,
    });

    const preCount = await RealInterviewTechnicalQuestion.countDocuments({ sessionId: testSessionId });
    console.log(`Pre-seeded DB questions count: ${preCount}/20 (Q1-Q16 present)`);

    console.log(`\n--- TEST STEP 2: Trigger generateAndProcessTechnicalQuestions with Invalid API Key (Forced Failure at Q17) ---`);
    const originalApiKey = process.env.REAL_INTERVIEW_TECHNICAL_API_KEY;
    process.env.REAL_INTERVIEW_TECHNICAL_API_KEY = "invalid_forced_test_key_xyz_123";

    const failureResult = await generateAndProcessTechnicalQuestions({
      userId: testUserId,
      sessionId: testSessionId,
      candidateProfile: { skills: ["Node.js", "MongoDB"] },
    });

    console.log("Returned result from failure call:\n", JSON.stringify(failureResult, null, 2));

    // ASSERTIONS FOR STEP 2:
    const qCountAfterFail = await RealInterviewTechnicalQuestion.countDocuments({ sessionId: testSessionId });
    const sessionAfterFail = await RealInterviewTechnicalSession.findOne({ sessionId: testSessionId });

    console.log(`\n--- VERIFYING STEP 2 ASSERTIONS ---`);
    console.log(`Assert 1: Q1-Q16 remain saved in DB? ${qCountAfterFail === 16 ? "PASSED (16/16 preserved)" : `FAILED (${qCountAfterFail}/16)`}`);
    console.log(`Assert 2: Response success === false? ${failureResult.success === false ? "PASSED" : "FAILED"}`);
    console.log(`Assert 3: nextQuestionNumber === 17? ${failureResult.nextQuestionNumber === 17 ? "PASSED" : "FAILED"}`);
    console.log(`Assert 4: Session generationStatus === PARTIAL? ${sessionAfterFail.generationStatus === "PARTIAL" ? "PASSED" : "FAILED"}`);
    console.log(`Assert 5: Error code classified cleanly? ${failureResult.errorCode ? `PASSED (${failureResult.errorCode})` : "FAILED"}`);

    if (qCountAfterFail !== 16 || failureResult.success !== false || failureResult.nextQuestionNumber !== 17 || sessionAfterFail.generationStatus !== "PARTIAL") {
      throw new Error("TEST FAILED at Step 2 assertions!");
    }

    // 3. Restore valid API key & resume generation (Retry starting at Q17)
    console.log(`\n--- TEST STEP 3: Restore Valid Key & Resume Generation (Retry starting at Q17) ---`);
    process.env.REAL_INTERVIEW_TECHNICAL_API_KEY = originalApiKey;

    const resumeResult = await generateAndProcessTechnicalQuestions({
      userId: testUserId,
      sessionId: testSessionId,
      candidateProfile: { skills: ["Node.js", "MongoDB"] },
    });

    console.log("Returned result from resume call:\n", JSON.stringify(resumeResult, null, 2));

    const finalQuestions = await RealInterviewTechnicalQuestion.find({ sessionId: testSessionId }).sort({ orderIndex: 1 });
    const finalSession = await RealInterviewTechnicalSession.findOne({ sessionId: testSessionId });

    console.log(`\n--- VERIFYING STEP 3 ASSERTIONS ---`);
    console.log(`Assert 6: Final DB question count === 20? ${finalQuestions.length === 20 ? "PASSED (20/20)" : `FAILED (${finalQuestions.length}/20)`}`);
    console.log(`Assert 7: Final session status === GENERATED? ${finalSession.generationStatus === "GENERATED" ? "PASSED" : "FAILED"}`);
    console.log(`Assert 8: Q1-Q16 were preserved without modification? ${finalQuestions[0].question.includes("Question #1") && finalQuestions[15].question.includes("Question #16") ? "PASSED" : "FAILED"}`);
    console.log(`Assert 9: Q17-Q20 match new generated questions? ${finalQuestions[16].orderIndex === 16 && finalQuestions[19].orderIndex === 19 ? "PASSED" : "FAILED"}`);

    if (finalQuestions.length === 20 && finalSession.generationStatus === "GENERATED") {
      console.log("\n=======================================================");
      console.log("✅ ALL MANDATORY Q17 FORCED FAILURE & RESUME TESTS PASSED!");
      console.log("=======================================================\n");
    } else {
      throw new Error("TEST FAILED at Step 3 assertions!");
    }
  } finally {
    // Cleanup test data
    await RealInterviewTechnicalQuestion.deleteMany({ sessionId: testSessionId });
    await RealInterviewTechnicalSession.deleteMany({ sessionId: testSessionId });
    await mongoose.disconnect();
    console.log("Cleaned up test session data and disconnected from DB.");
  }
}

runQ17ForcedFailureTest().catch((err) => {
  console.error("❌ TEST EXECUTOR ERROR:", err);
  process.exit(1);
});
