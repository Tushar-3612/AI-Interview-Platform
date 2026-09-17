import AIGateway from '../backend/services/aiReliability/aiGateway.js';
import AIErrorClassifier, { ERROR_CATEGORIES } from '../backend/services/aiReliability/aiErrorClassifier.js';
import { calculateRealInterviewResult } from '../backend/services/realInterview/realInterviewResultService.js';
import { evaluateTechnicalInterviewSession } from '../backend/services/realInterview/technicalService.js';
import { evaluateProjectInterviewSession } from '../backend/services/realInterview/projectService.js';
import { evaluateHRInterviewSession } from '../backend/services/realInterview/hrService.js';
import { sessionManager } from '../backend/services/aiReliability/aiSessionManager.js';
import RealInterviewResult from '../backend/models/RealInterviewResult.js';
import RealInterviewTechnicalSession from '../backend/models/RealInterviewTechnicalSession.js';
import RealInterviewTechnicalQuestion from '../backend/models/RealInterviewTechnicalQuestion.js';
import mongoose from 'mongoose';

async function runNonFatalVerificationTests() {
  console.log("=== STARTING NON-FATAL AI RELIABILITY & EVALUATION VERIFICATION TESTS ===");
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

  // Connect to MongoDB
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ai-interview-platform";
  let isMongoConnected = false;
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
    }
    isMongoConnected = true;
    console.log("[TEST-SETUP] Connected to MongoDB");
  } catch (e) {
    console.warn(`[TEST-SETUP] Could not connect to local MongoDB (${e.message})`);
  }

  // TEST 1: Granular Error Categories in AIErrorClassifier
  try {
    assert(ERROR_CATEGORIES.AI_PROVIDER_AUTH_ERROR === "AI_PROVIDER_AUTH_ERROR", "ERROR_CATEGORIES includes AI_PROVIDER_AUTH_ERROR");
    assert(ERROR_CATEGORIES.AI_INVALID_JSON === "AI_INVALID_JSON", "ERROR_CATEGORIES includes AI_INVALID_JSON");
    assert(ERROR_CATEGORIES.AI_EVALUATION_UNAVAILABLE === "AI_EVALUATION_UNAVAILABLE", "ERROR_CATEGORIES includes AI_EVALUATION_UNAVAILABLE");
  } catch (e) {
    assert(false, `Test 1 failed: ${e.message}`);
  }

  // TEST 2: BYOK Mode strict provider lock (no silent platform fallback)
  try {
    const testSessionId = `test_byok_lock_${Date.now()}`;
    sessionManager.setSessionBYOK(testSessionId, "gemini", "AIzaSyMockKeyForStrictBYOKValidation12345");

    const sessionBYOK = sessionManager.getSessionBYOK(testSessionId);
    assert(sessionBYOK.providerName === "gemini", "BYOK session records provider = gemini");
    assert(sessionBYOK.apiKey === "AIzaSyMockKeyForStrictBYOKValidation12345", "BYOK session records valid key");
  } catch (e) {
    assert(false, `Test 2 failed: ${e.message}`);
  }

  // TEST 3: Technical AI evaluation failure degrades to deterministic NLP fallback without throwing exception
  if (isMongoConnected) {
    try {
      const evalSessionId = `test_tech_eval_${Date.now()}`;

      // Create dummy technical session & questions in MongoDB
      await RealInterviewTechnicalSession.create({
        sessionId: evalSessionId,
        userId: new mongoose.Types.ObjectId(),
        generationStatus: "GENERATED",
        answers: [
          {
            questionId: new mongoose.Types.ObjectId(),
            question: "What is closure in JavaScript?",
            candidateAnswer: "A closure is the combination of a function bundled together with references to its surrounding state or lexical environment.",
            difficulty: "easy"
          }
        ]
      });

      await RealInterviewTechnicalQuestion.create({
        sessionId: evalSessionId,
        orderIndex: 1,
        question: "What is closure in JavaScript?",
        difficulty: "easy",
        topic: "JavaScript Core",
        maxMarks: 5,
        expectedKnowledge: "Function combined with lexical environment reference."
      });

      // Mock AI call failure
      const origExecute = AIGateway.execute;
      AIGateway.execute = async () => { throw new Error("Simulated BYOK Key Quota Exceeded"); };

      const resTechEval = await evaluateTechnicalInterviewSession({
        sessionId: evalSessionId,
        candidateProfile: { skills: ["JavaScript"] }
      });

      AIGateway.execute = origExecute; // Restore

      assert(resTechEval.success === true, "Technical evaluation returned success=true despite AI failure");
      assert(resTechEval.evaluations && resTechEval.evaluations.length > 0, "Technical evaluation returned non-empty evaluations array");
      assert(typeof resTechEval.evaluations[0].score === "number", "Technical evaluation fallback computed a valid numeric score");

      // Clean up
      await RealInterviewTechnicalSession.deleteMany({ sessionId: evalSessionId });
      await RealInterviewTechnicalQuestion.deleteMany({ sessionId: evalSessionId });
    } catch (e) {
      assert(false, `Test 3 failed: ${e.message}`);
    }
  }

  // TEST 4: Result Aggregation handles individual round AI failure cleanly
  if (isMongoConnected) {
    try {
      const resultSessionId = `test_res_agg_${Date.now()}`;
      const dummyUserId = new mongoose.Types.ObjectId();

      const origExecute = AIGateway.execute;
      AIGateway.execute = async () => { throw new Error("Simulated Provider Unavailable"); };

      const finalResult = await calculateRealInterviewResult({
        sessionId: resultSessionId,
        userId: dummyUserId,
        candidateProfile: { skills: ["Node.js"] }
      });

      AIGateway.execute = origExecute; // Restore

      assert(finalResult.status === "COMPLETED", "RealInterviewResult document status is COMPLETED");
      assert(finalResult.resultStatus === "COMPLETE" || finalResult.resultStatus === "PARTIAL_EVALUATION" || finalResult.resultStatus === "EVALUATION_UNAVAILABLE", "resultStatus is a valid non-fatal status");
      assert(typeof finalResult.totalObtained === "number", "totalObtained score is a valid number");
      assert(finalResult.maximumMarks === 450, "maximumMarks is 450");

      // Clean up
      await RealInterviewResult.deleteMany({ sessionId: resultSessionId });
    } catch (e) {
      assert(false, `Test 4 failed: ${e.message}`);
    }
  }

  if (isMongoConnected) {
    await mongoose.disconnect();
  }

  console.log(`\n=== VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runNonFatalVerificationTests();
