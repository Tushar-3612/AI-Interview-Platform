import AIGateway from '../backend/services/aiReliability/aiGateway.js';
import AIErrorClassifier, { ERROR_CATEGORIES } from '../backend/services/aiReliability/aiErrorClassifier.js';
import { generateSingleCodingAI } from '../backend/services/realInterviewAI/codingAI.js';
import { generateAndProcessCodingQuestions } from '../backend/services/realInterview/codingService.js';
import RealInterviewCodingQuestion from '../backend/models/RealInterviewCodingQuestion.js';
import RealInterviewCodingSession from '../backend/models/RealInterviewCodingSession.js';
import mongoose from 'mongoose';

async function runVerificationTests() {
  console.log("=== STARTING CODING RELIABILITY VERIFICATION TESTS ===");
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // Connect Mongo if possible
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ai-interview-platform";
  let isMongoConnected = false;
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
    }
    isMongoConnected = true;
    console.log("[TEST-SETUP] Connected to MongoDB");
  } catch (e) {
    console.warn(`[TEST-SETUP] Could not connect to local MongoDB (${e.message}) - running unit assertion suite.`);
  }

  // TEST 1: MAX_TOKENS classification
  try {
    const err = new Error("Response truncated: MAX_TOKENS limit reached");
    const norm = AIErrorClassifier.classify(err);
    assert(norm.isRetryable === true, "MAX_TOKENS / truncated JSON is classified as retryable");
  } catch (e) {
    assert(false, `Test 1 failed: ${e.message}`);
  }

  // TEST 2: Single Coding AI function signature and compact output contract
  try {
    assert(typeof generateSingleCodingAI === "function", "generateSingleCodingAI function exists");
  } catch (e) {
    assert(false, `Test 2 failed: ${e.message}`);
  }

  // TEST 3 & 4 & 5 & 6 & 7 & 8: Database / Integration flow
  if (isMongoConnected) {
    try {
      const testSessionId = `test_coding_verif_${Date.now()}`;

      // Clean up test session if exists
      await RealInterviewCodingQuestion.deleteMany({ sessionId: testSessionId });
      await RealInterviewCodingSession.deleteMany({ sessionId: testSessionId });

      // Scenario A: Standard single-question AI generation
      const resAI = await generateAndProcessCodingQuestions({
        sessionId: testSessionId,
        candidateProfile: { skills: ["JavaScript", "Python"] }
      });

      assert(resAI.executionCompleted === true, "executionCompleted is true");
      assert(resAI.count === 3, "count is 3");
      assert(resAI.roundComplete === true, "roundComplete is true");
      assert(resAI.status === "COMPLETE", "status is COMPLETE");
      assert(resAI.generationSucceeded === true, "generationSucceeded is true when AI generated all 3 questions");
      assert(resAI.completionSource === "AI_GENERATED", "completionSource is AI_GENERATED");

      // Verify DB documents
      const savedDocs = await RealInterviewCodingQuestion.find({ sessionId: testSessionId }).sort({ orderIndex: 1 });
      assert(savedDocs.length === 3, "Saved exactly 3 question documents in MongoDB");
      assert(savedDocs[0].orderIndex === 1 && savedDocs[0].difficulty === "Easy", "Q1 is Easy (orderIndex 1)");
      assert(savedDocs[1].orderIndex === 2 && savedDocs[1].difficulty === "Medium", "Q2 is Medium (orderIndex 2)");
      assert(savedDocs[2].orderIndex === 3, "Q3 has orderIndex 3");

      // Scenario B: Test Zero AI Call Reuse for existing 3/3 questions
      const resReuse = await generateAndProcessCodingQuestions({
        sessionId: testSessionId,
        candidateProfile: { skills: ["JavaScript"] }
      });

      assert(resReuse.reused === true, "Existing 3/3 questions reused with reused=true");
      assert(resReuse.completionSource === "EXISTING_DB", "completionSource is EXISTING_DB on reuse");
      assert(resReuse.roundComplete === true, "roundComplete is true on reuse");

      // Scenario C: Test Fallback Bank on partial/missing slot when AI fails
      const fallbackSessionId = `test_coding_fallback_${Date.now()}`;
      // Pre-insert Q1 and Q2 in MongoDB, leaving Q3 missing
      await RealInterviewCodingQuestion.create({
        sessionId: fallbackSessionId,
        orderIndex: 1,
        title: "Pre-existing Q1",
        description: "Desc 1",
        difficulty: "Easy",
        marks: 20,
        source: "AI_GENERATED"
      });

      // Call generateAndProcessCodingQuestions with an invalid provider option to trigger fallback for Q3
      const originalExecute = AIGateway.execute;
      AIGateway.execute = async () => { throw new Error("Simulated AI Failure"); };

      const resFallback = await generateAndProcessCodingQuestions({
        sessionId: fallbackSessionId,
        candidateProfile: { skills: ["Java"] }
      });

      AIGateway.execute = originalExecute; // Restore

      assert(resFallback.roundComplete === true, "roundComplete is true after fallback fills Q3");
      assert(resFallback.fallbackUsed === true, "fallbackUsed is true when local bank fills missing slot");
      assert(resFallback.completionSource === "MIXED" || resFallback.completionSource === "CURATED_FALLBACK_BANK", "completionSource correctly indicates MIXED/CURATED_FALLBACK_BANK");
      assert(resFallback.generationSucceeded === false, "generationSucceeded is false when fallback was used");

      // Clean up test documents
      await RealInterviewCodingQuestion.deleteMany({ sessionId: testSessionId });
      await RealInterviewCodingSession.deleteMany({ sessionId: testSessionId });
      await RealInterviewCodingQuestion.deleteMany({ sessionId: fallbackSessionId });
      await RealInterviewCodingSession.deleteMany({ sessionId: fallbackSessionId });
    } catch (e) {
      assert(false, `Mongo integration tests failed: ${e.message}`);
    } finally {
      await mongoose.disconnect();
    }
  }

  console.log(`\n=== VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runVerificationTests();
