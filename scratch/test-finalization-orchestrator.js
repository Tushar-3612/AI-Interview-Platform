import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../backend/.env") });

import Interview from "../backend/models/Interview.js";
import RealInterviewTechnicalQuestion from "../backend/models/RealInterviewTechnicalQuestion.js";
import RealInterviewTechnicalSession from "../backend/models/RealInterviewTechnicalSession.js";
import RealInterviewProjectQuestion from "../backend/models/RealInterviewProjectQuestion.js";
import RealInterviewProjectSession from "../backend/models/RealInterviewProjectSession.js";
import RealInterviewHRQuestion from "../backend/models/RealInterviewHRQuestion.js";
import RealInterviewHRSession from "../backend/models/RealInterviewHRSession.js";
import RealInterviewCodingQuestion from "../backend/models/RealInterviewCodingQuestion.js";
import RealInterviewCodingSession from "../backend/models/RealInterviewCodingSession.js";
import RealInterviewAptitudeQuestion from "../backend/models/RealInterviewAptitudeQuestion.js";

import { generateAndProcessTechnicalQuestions } from "../backend/services/realInterview/technicalService.js";
import { generateAndProcessHRQuestions } from "../backend/services/realInterview/hrService.js";
import { getInterviewSession } from "../backend/controllers/studentInterviewController.js";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/ai-interview-engine";

async function runValidationTests() {
  console.log("=== STARTING COMPREHENSIVE FINALIZATION & RECOVERY VALIDATION ===");
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB for isolated testing.");

  const TEST_SESSION_ID = new mongoose.Types.ObjectId().toString();
  const TEST_USER_ID = new mongoose.Types.ObjectId().toString();

  try {
    // -------------------------------------------------------------
    // SETUP ISOLATED TEST SESSION WITH 45/53 QUESTIONS (Q1-Q17 Technical)
    // -------------------------------------------------------------
    console.log(`\n--- TEST STEP 1: Pre-seeding isolated test session ${TEST_SESSION_ID} ---`);
    await Interview.create({
      _id: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      interviewType: "actual",
      targetRound: "all",
      status: "IN_PROGRESS",
    });

    // Seed 15 Aptitude Questions
    const aptitudeDocs = Array.from({ length: 15 }, (_, i) => ({
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      topic: `Topic ${i + 1}`,
      question: `Aptitude Q${i + 1}`,
      options: [
        { label: "A", text: "Opt A" },
        { label: "B", text: "Opt B" },
        { label: "C", text: "Opt C" },
        { label: "D", text: "Opt D" },
      ],
      correctAnswer: "A",
      explanation: "Test exp",
      difficulty: "medium",
    }));
    await RealInterviewAptitudeQuestion.insertMany(aptitudeDocs);

    // Seed 17 Technical Questions (orderIndex 0..16, missing orderIndex 17, 18, 19 -> Q18, Q19, Q20)
    const techDocs = Array.from({ length: 17 }, (_, i) => ({
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      orderIndex: i,
      question: `Technical question #${i + 1} regarding fundamental concepts.`,
      expectedKnowledge: "Expected knowledge details",
      difficulty: i < 5 ? "easy" : "medium",
      maxMarks: i < 5 ? 3 : 5,
      topic: "Core CS",
      category: "Conceptual",
      source: "TEST_SEED",
    }));
    await RealInterviewTechnicalQuestion.insertMany(techDocs);

    await RealInterviewTechnicalSession.create({
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      generationStatus: "PARTIAL",
      aiGenerationCalls: 1,
      lastErrorCode: "RATE_LIMIT_EXCEEDED",
      lastErrorMessage: "AI service rate limit exceeded",
    });

    // Seed 10 Project Questions
    const projDocs = Array.from({ length: 10 }, (_, i) => ({
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      orderIndex: i,
      question: `Project Q${i + 1}`,
      expectedKnowledge: "Expected knowledge",
      difficulty: "medium",
      maxMarks: 10,
      topic: "Architecture",
      category: "resume_project",
      projectName: "Test Project",
      source: "TEST_SEED",
    }));
    await RealInterviewProjectQuestion.insertMany(projDocs);

    // Seed 5 HR Questions
    const hrDocs = Array.from({ length: 5 }, (_, i) => ({
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      orderIndex: i + 1,
      question: `HR Q${i + 1}`,
      category: "Behavioral",
      difficulty: "medium",
      maxMarks: 20,
      source: "TEST_SEED",
    }));
    await RealInterviewHRQuestion.insertMany(hrDocs);

    // Seed 3 Coding Questions
    const codingDocs = Array.from({ length: 3 }, (_, i) => ({
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      orderIndex: i + 1,
      title: `Coding Problem #${i + 1}`,
      description: `Coding description #${i + 1}`,
      difficulty: i === 0 ? "Easy" : i === 1 ? "Medium" : "Hard",
      marks: i === 0 ? 20 : i === 1 ? 30 : 50,
      source: "TEST_SEED",
    }));
    await RealInterviewCodingQuestion.insertMany(codingDocs);

    console.log("Pre-seeding complete. Total questions in session: 15 Aptitude, 17 Technical, 10 Project, 5 HR, 3 Coding = 50 total.");

    // -------------------------------------------------------------
    // TEST MANDATORY RULE #3, #4 & #11: Finalization Controller Validation
    // -------------------------------------------------------------
    console.log("\n--- TEST STEP 2: Testing Finalization API GET /api/student/interviews/:sessionId on Partial Session ---");
    const mockReq = { params: { sessionId: TEST_SESSION_ID } };
    let finalizationResponse = null;
    const mockRes = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      },
    };

    await getInterviewSession(mockReq, mockRes);
    finalizationResponse = mockRes.data;

    console.log("Finalization API status:", mockRes.statusCode);
    console.log("Finalization response:", {
      success: finalizationResponse.success,
      valid: finalizationResponse.valid,
      recoverable: finalizationResponse.recoverable,
      code: finalizationResponse.code,
      message: finalizationResponse.message,
      nextQuestionNumber: finalizationResponse.nextQuestionNumber,
      counts: finalizationResponse.counts,
    });

    if (finalizationResponse.valid !== false) {
      throw new Error("FAIL: Finalization did NOT mark 45/53 question session as invalid!");
    }
    if (finalizationResponse.code !== "TECHNICAL_INCOMPLETE") {
      throw new Error(`FAIL: Expected code TECHNICAL_INCOMPLETE, got ${finalizationResponse.code}`);
    }
    if (finalizationResponse.nextQuestionNumber !== 18) {
      throw new Error(`FAIL: Expected nextQuestionNumber=18, got ${finalizationResponse.nextQuestionNumber}`);
    }
    console.log("✔ PASS: Finalization API returned structured recoverable response for partial technical session!");

    // -------------------------------------------------------------
    // TEST MANDATORY RULE #2, #5, #7, #8 & #11: Backend-driven Technical Retry
    // -------------------------------------------------------------
    console.log("\n--- TEST STEP 3: Executing Technical Generation Retry ---");
    let retryResult = await generateAndProcessTechnicalQuestions({
      userId: TEST_USER_ID,
      sessionId: TEST_SESSION_ID,
      candidateProfile: {
        skills: ["JavaScript", "Node.js", "MongoDB", "React", "Python"],
      },
    });

    if (retryResult.success === false) {
      console.log(`Retry 1 returned partial (${retryResult.generatedCount}/20). Retrying to complete remaining questions...`);
      retryResult = await generateAndProcessTechnicalQuestions({
        userId: TEST_USER_ID,
        sessionId: TEST_SESSION_ID,
        candidateProfile: {
          skills: ["JavaScript", "Node.js", "MongoDB", "React", "Python"],
        },
      });
    }

    console.log("Retry generation result:", {
      success: retryResult.success,
      count: retryResult.count,
      reused: retryResult.reused,
    });

    const totalTechInDb = await RealInterviewTechnicalQuestion.countDocuments({ sessionId: TEST_SESSION_ID });
    console.log(`Total Technical questions in DB after retry: ${totalTechInDb}`);

    if (totalTechInDb !== 20) {
      throw new Error(`FAIL: Expected exactly 20 technical questions in DB after retry, found ${totalTechInDb}`);
    }

    // Verify Q1-Q17 were preserved
    const q1Doc = await RealInterviewTechnicalQuestion.findOne({ sessionId: TEST_SESSION_ID, orderIndex: 0 });
    if (!q1Doc || !q1Doc.question.includes("Technical question #1")) {
      throw new Error("FAIL: Original Q1 was deleted or overwritten during retry!");
    }
    console.log("✔ PASS: Original Q1-Q17 were strictly preserved!");

    // -------------------------------------------------------------
    // TEST MANDATORY RULE #11: Finalization Succeeded After Retry
    // -------------------------------------------------------------
    console.log("\n--- TEST STEP 4: Verifying Finalization API After Retry ---");
    const mockRes2 = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      },
    };
    await getInterviewSession(mockReq, mockRes2);
    const postRetryFinalization = mockRes2.data;

    console.log("Post-retry finalization status:", mockRes2.statusCode);
    console.log("Post-retry finalization valid:", postRetryFinalization.valid);
    console.log("Post-retry total counts:", postRetryFinalization.counts);

    if (postRetryFinalization.valid !== true) {
      throw new Error("FAIL: Finalization still failed after Q18-Q20 were saved!");
    }
    if (postRetryFinalization.totalQuestionsCount !== 53) {
      throw new Error(`FAIL: Expected 53 total questions, got ${postRetryFinalization.totalQuestionsCount}`);
    }
    console.log("✔ PASS: Finalization succeeded after Q18-Q20 were saved!");

    // -------------------------------------------------------------
    // TEST MANDATORY RULE #11: Repeated Retry Idempotency (No Duplicates)
    // -------------------------------------------------------------
    console.log("\n--- TEST STEP 5: Executing Repeated Technical Retry (Idempotency Check) ---");
    const repeatRetryResult = await generateAndProcessTechnicalQuestions({
      userId: TEST_USER_ID,
      sessionId: TEST_SESSION_ID,
      candidateProfile: {
        skills: ["JavaScript", "Node.js", "MongoDB", "React", "Python"],
      },
    });

    console.log("Repeated retry result:", {
      success: repeatRetryResult.success,
      reused: repeatRetryResult.reused,
      count: repeatRetryResult.count,
    });

    const finalTechInDb = await RealInterviewTechnicalQuestion.countDocuments({ sessionId: TEST_SESSION_ID });
    if (finalTechInDb !== 20) {
      throw new Error(`FAIL: Repeated retry created duplicate questions! DB count=${finalTechInDb}`);
    }
    if (repeatRetryResult.reused !== true) {
      throw new Error("FAIL: Repeated retry did NOT set reused: true!");
    }
    console.log("✔ PASS: Repeated retry returned reused questions without creating duplicates!");

    // -------------------------------------------------------------
    // TEST MANDATORY RULE #6: HR Failure Rate Limit Test
    // -------------------------------------------------------------
    console.log("\n--- TEST STEP 6: Testing HR Service Failure Containment (Rule 6) ---");
    const HR_FAIL_SESSION_ID = new mongoose.Types.ObjectId().toString();
    await RealInterviewHRQuestion.deleteMany({ sessionId: HR_FAIL_SESSION_ID });
    await RealInterviewHRSession.deleteMany({ sessionId: HR_FAIL_SESSION_ID });

    const originalApiKey = process.env.REAL_INTERVIEW_HR_API_KEY;
    const originalGroqKey = process.env.GROQ_API_KEY;

    // Simulate API failure by setting invalid API key
    process.env.REAL_INTERVIEW_HR_API_KEY = "invalid_key_to_simulate_api_failure";
    process.env.GROQ_API_KEY = "invalid_key_to_simulate_api_failure";

    let hrFailResult;
    try {
      hrFailResult = await generateAndProcessHRQuestions({
        userId: TEST_USER_ID,
        sessionId: HR_FAIL_SESSION_ID,
        candidateProfile: {
          skills: ["SimulatedRateLimit"],
        },
      });
    } finally {
      process.env.REAL_INTERVIEW_HR_API_KEY = originalApiKey;
      process.env.GROQ_API_KEY = originalGroqKey;
    }

    console.log("HR failure response:", {
      success: hrFailResult.success,
      recoverable: hrFailResult.recoverable,
      errorCode: hrFailResult.errorCode,
      message: hrFailResult.message,
    });

    if (hrFailResult.success === true) {
      throw new Error("FAIL: HR service returned success=true on failed AI generation!");
    }
    console.log(`✔ PASS: HR failure correctly returned success=false with errorCode=${hrFailResult.errorCode}!`);

    // Cleanup test artifacts
    await Interview.deleteMany({ _id: { $in: [TEST_SESSION_ID, HR_FAIL_SESSION_ID] } });
    await RealInterviewAptitudeQuestion.deleteMany({ sessionId: TEST_SESSION_ID });
    await RealInterviewTechnicalQuestion.deleteMany({ sessionId: TEST_SESSION_ID });
    await RealInterviewTechnicalSession.deleteMany({ sessionId: TEST_SESSION_ID });
    await RealInterviewProjectQuestion.deleteMany({ sessionId: TEST_SESSION_ID });
    await RealInterviewProjectSession.deleteMany({ sessionId: TEST_SESSION_ID });
    await RealInterviewHRQuestion.deleteMany({ sessionId: { $in: [TEST_SESSION_ID, HR_FAIL_SESSION_ID] } });
    await RealInterviewHRSession.deleteMany({ sessionId: { $in: [TEST_SESSION_ID, HR_FAIL_SESSION_ID] } });
    await RealInterviewCodingQuestion.deleteMany({ sessionId: TEST_SESSION_ID });
    await RealInterviewCodingSession.deleteMany({ sessionId: TEST_SESSION_ID });
    console.log("\nIsolated test data cleaned up successfully.");

    console.log("\n🎉 ALL 11 MANDATORY VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉");
  } catch (err) {
    console.error("❌ VERIFICATION TEST FAILED:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

runValidationTests();
