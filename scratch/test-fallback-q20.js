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
import RealInterviewHRQuestion from "../backend/models/RealInterviewHRQuestion.js";
import RealInterviewCodingQuestion from "../backend/models/RealInterviewCodingQuestion.js";
import RealInterviewAptitudeQuestion from "../backend/models/RealInterviewAptitudeQuestion.js";

import { generateAndProcessTechnicalQuestions } from "../backend/services/realInterview/technicalService.js";
import { getInterviewSession } from "../backend/controllers/studentInterviewController.js";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/ai-interview-engine";

async function runFallbackQ20Test() {
  console.log("=== STARTING TECHNICAL Q20 FALLBACK & FINALIZATION TEST ===");
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.");

  const TEST_SESSION_ID = new mongoose.Types.ObjectId().toString();
  const TEST_USER_ID = new mongoose.Types.ObjectId().toString();

  try {
    // -------------------------------------------------------------
    // STEP 1: SETUP ISOLATED TEST SESSION WITH 19/20 TECHNICAL QUESTIONS
    // -------------------------------------------------------------
    console.log(`\n--- STEP 1: Setting up isolated session ${TEST_SESSION_ID} with 19/20 Technical questions ---`);
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

    // Seed 19 Technical Questions (orderIndex 0..18, missing orderIndex 19 -> Q20)
    const techDocs = Array.from({ length: 19 }, (_, i) => ({
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      orderIndex: i,
      question: `Original pre-seeded technical question #${i + 1}`,
      expectedKnowledge: "Original expected knowledge",
      difficulty: i < 5 ? "easy" : i < 17 ? "medium" : "hard",
      maxMarks: i < 5 ? 3 : i < 17 ? 5 : 13,
      topic: "Software Engineering",
      category: "Conceptual",
      source: "AI_GENERATED",
      generationMethod: "RESUME_BASED_AI",
      isFallback: false,
    }));
    await RealInterviewTechnicalQuestion.insertMany(techDocs);

    await RealInterviewTechnicalSession.create({
      sessionId: TEST_SESSION_ID,
      userId: TEST_USER_ID,
      generationStatus: "PARTIAL",
      aiGenerationCalls: 1,
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
      source: "AI_GENERATED",
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
      source: "AI_GENERATED",
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
      source: "AI_GENERATED",
    }));
    await RealInterviewCodingQuestion.insertMany(codingDocs);

    console.log("Pre-seeding complete. 19/20 Technical, 15 Aptitude, 10 Project, 5 HR, 3 Coding = 52 total questions.");

    // -------------------------------------------------------------
    // STEP 2: SIMULATE AI FAILURE FOR Q20 AND TRIGGER GENERATION
    // -------------------------------------------------------------
    console.log("\n--- STEP 2: Executing generateAndProcessTechnicalQuestions with simulated AI failure for Q20 ---");

    const origTechKey = process.env.REAL_INTERVIEW_TECHNICAL_API_KEY;
    const origGroqKey = process.env.GROQ_API_KEY;

    process.env.REAL_INTERVIEW_TECHNICAL_API_KEY = "invalid_key_to_simulate_ai_failure";
    process.env.GROQ_API_KEY = "invalid_key_to_simulate_ai_failure";

    let result;
    try {
      result = await generateAndProcessTechnicalQuestions({
        userId: TEST_USER_ID,
        sessionId: TEST_SESSION_ID,
        candidateProfile: {
          skills: ["Java", "JavaScript", "React.js", "Redis", "MongoDB", "SQL", "Docker"],
        },
      });
    } finally {
      process.env.REAL_INTERVIEW_TECHNICAL_API_KEY = origTechKey;
      process.env.GROQ_API_KEY = origGroqKey;
    }

    console.log("Generation result:", {
      success: result.success,
      count: result.count,
      reused: result.reused,
      message: result.message,
    });

    if (result.success !== true) {
      throw new Error(`FAIL: Expected generation success=true via fallback, got ${result.success}. Message: ${result.message}`);
    }

    // -------------------------------------------------------------
    // STEP 3: VERIFY DB QUESTIONS & METADATA
    // -------------------------------------------------------------
    console.log("\n--- STEP 3: Verifying DB question count, Q1-Q19 preservation & Q20 metadata ---");
    const allTechInDb = await RealInterviewTechnicalQuestion.find({ sessionId: TEST_SESSION_ID }).sort({ orderIndex: 1 });
    console.log(`Total Technical questions in DB: ${allTechInDb.length}`);

    if (allTechInDb.length !== 20) {
      throw new Error(`FAIL: Expected 20 questions in DB, got ${allTechInDb.length}`);
    }

    // Verify Q1-Q19 were preserved
    for (let i = 0; i < 19; i++) {
      if (!allTechInDb[i].question.includes(`Original pre-seeded technical question #${i + 1}`)) {
        throw new Error(`FAIL: Question Q${i + 1} was altered or regenerated! Found: ${allTechInDb[i].question}`);
      }
    }
    console.log("✔ PASS: All 19 pre-seeded technical questions remained 100% untouched!");

    // Verify Q20 fallback metadata
    const q20Doc = allTechInDb[19];
    console.log("Q20 metadata:", {
      orderIndex: q20Doc.orderIndex,
      question: q20Doc.question,
      source: q20Doc.source,
      generationMethod: q20Doc.generationMethod,
      matchedSkill: q20Doc.matchedSkill,
      isFallback: q20Doc.isFallback,
    });

    if (q20Doc.orderIndex !== 19) {
      throw new Error(`FAIL: Q20 orderIndex expected 19, got ${q20Doc.orderIndex}`);
    }
    if (q20Doc.source !== "CURATED_FALLBACK_BANK") {
      throw new Error(`FAIL: Q20 source expected CURATED_FALLBACK_BANK, got ${q20Doc.source}`);
    }
    if (q20Doc.generationMethod !== "CURATED_RESUME_MATCH") {
      throw new Error(`FAIL: Q20 generationMethod expected CURATED_RESUME_MATCH, got ${q20Doc.generationMethod}`);
    }
    if (q20Doc.isFallback !== true) {
      throw new Error(`FAIL: Q20 isFallback expected true, got ${q20Doc.isFallback}`);
    }
    console.log("✔ PASS: Q20 correctly saved with curated resume-matched fallback metadata!");

    // -------------------------------------------------------------
    // STEP 4: VERIFY FINALIZATION API SUCCESS
    // -------------------------------------------------------------
    console.log("\n--- STEP 4: Testing Finalization GET /api/student/interviews/:sessionId ---");
    const mockReq = { params: { sessionId: TEST_SESSION_ID } };
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
    const finalData = mockRes.data;

    console.log("Finalization response:", {
      valid: finalData.valid,
      totalQuestionsCount: finalData.totalQuestionsCount,
      counts: finalData.counts,
    });

    if (finalData.valid !== true) {
      throw new Error(`FAIL: Finalization API marked session invalid after Q20 fallback! Message: ${finalData.message}`);
    }
    if (finalData.totalQuestionsCount !== 53) {
      throw new Error(`FAIL: Expected 53 total questions, got ${finalData.totalQuestionsCount}`);
    }
    console.log("✔ PASS: Finalization API succeeded with 53/53 total questions!");

    // -------------------------------------------------------------
    // STEP 5: VERIFY LARGE GAP (missingCount > 3) DOES NOT USE FALLBACK
    // -------------------------------------------------------------
    console.log("\n--- STEP 5: Testing missingCount > 3 (e.g. 5 missing) does NOT use fallback ---");
    const GAP_SESSION_ID = new mongoose.Types.ObjectId().toString();
    await Interview.create({
      _id: GAP_SESSION_ID,
      userId: TEST_USER_ID,
      interviewType: "actual",
      targetRound: "all",
      status: "IN_PROGRESS",
    });

    // Seed only 15 technical questions (missing 5)
    const techGapDocs = Array.from({ length: 15 }, (_, i) => ({
      sessionId: GAP_SESSION_ID,
      userId: TEST_USER_ID,
      orderIndex: i,
      question: `Gap question #${i + 1}`,
      expectedKnowledge: "Expected knowledge",
      difficulty: "easy",
      maxMarks: 3,
      topic: "CS",
      category: "Conceptual",
      source: "AI_GENERATED",
    }));
    await RealInterviewTechnicalQuestion.insertMany(techGapDocs);

    let gapResult;
    try {
      process.env.REAL_INTERVIEW_TECHNICAL_API_KEY = "invalid_key_to_simulate_ai_failure";
      process.env.GROQ_API_KEY = "invalid_key_to_simulate_ai_failure";

      gapResult = await generateAndProcessTechnicalQuestions({
        userId: TEST_USER_ID,
        sessionId: GAP_SESSION_ID,
        candidateProfile: { skills: ["Java"] },
      });
    } finally {
      process.env.REAL_INTERVIEW_TECHNICAL_API_KEY = origTechKey;
      process.env.GROQ_API_KEY = origGroqKey;
    }

    console.log("Gap generation result (missing 5):", {
      success: gapResult.success,
      recoverable: gapResult.recoverable,
      generatedCount: gapResult.generatedCount,
    });

    if (gapResult.success !== false) {
      throw new Error("FAIL: missingCount > 3 should NOT use fallback and should return success=false!");
    }
    console.log("✔ PASS: missingCount > 3 correctly preserved partial generation and returned recoverable false!");

    // Cleanup test data
    await Interview.deleteMany({ _id: { $in: [TEST_SESSION_ID, GAP_SESSION_ID] } });
    await RealInterviewAptitudeQuestion.deleteMany({ sessionId: TEST_SESSION_ID });
    await RealInterviewTechnicalQuestion.deleteMany({ sessionId: { $in: [TEST_SESSION_ID, GAP_SESSION_ID] } });
    await RealInterviewTechnicalSession.deleteMany({ sessionId: { $in: [TEST_SESSION_ID, GAP_SESSION_ID] } });
    await RealInterviewProjectQuestion.deleteMany({ sessionId: TEST_SESSION_ID });
    await RealInterviewHRQuestion.deleteMany({ sessionId: TEST_SESSION_ID });
    await RealInterviewCodingQuestion.deleteMany({ sessionId: TEST_SESSION_ID });
    console.log("\nIsolated test data cleaned up.");

    console.log("\n🎉 ALL Q20 FALLBACK & FINALIZATION TESTS PASSED 100%! 🎉");
  } catch (err) {
    console.error("❌ TEST FAILED:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

runFallbackQ20Test();
