import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  generateAndProcessHRQuestions,
  getNextHRQuestion,
  submitHRAnswer,
  evaluateHRInterviewSession,
} from "../services/realInterview/hrService.js";
import RealInterviewHRQuestion from "../models/RealInterviewHRQuestion.js";
import RealInterviewHRSession from "../models/RealInterviewHRSession.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

async function runHRTest() {
  console.log("\n=======================================================");
  console.log("🧪 TESTING REAL INTERVIEW HR ROUND (EXACTLY 3 QUESTIONS | 2 AI CALLS | 60 MARKS)");
  console.log("=======================================================\n");

  console.log("1. Environment Verification:");
  console.log(`   - REAL_INTERVIEW_HR_API_KEY: ${process.env.REAL_INTERVIEW_HR_API_KEY ? "✅ Configured" : "❌ Missing"}`);

  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI missing in .env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB Connected Successfully\n");

  const sessionId = `test_hr_3q_${Date.now()}`;
  const candidateProfile = {
    fullName: "Rohan Sharma",
    education: "B.Tech Computer Science (Final Year)",
    internships: [{ company: "TechCorp", role: "Software Engineering Intern", duration: "3 Months" }],
    leadership: ["President, College Coding Club", "Team Lead, Final Year Project"],
    achievements: ["1st Place, Regional Hackathon 2025"],
  };

  try {
    // Clean up any pre-existing test data for sessionId
    await RealInterviewHRQuestion.deleteMany({ sessionId });
    await RealInterviewHRSession.deleteMany({ sessionId });

    // Step 2: Test CALL #1 (Question Generation)
    console.log("2. Testing CALL #1: HR Question Generation (Target: Exactly 3 questions)...");
    const genResult = await generateAndProcessHRQuestions({
      sessionId,
      candidateProfile,
    });

    console.log(`   - Questions generated: ${genResult.questions.length}`);
    console.log(`   - Reused flag: ${genResult.reused}`);
    console.log(`   - aiGenerationCalls: ${genResult.aiGenerationCalls}`);

    if (genResult.questions.length !== 3) {
      throw new Error(`Expected exactly 3 HR questions, got ${genResult.questions.length}`);
    }
    if (genResult.questions[0].question !== "Introduce yourself.") {
      throw new Error(`Expected Q1 to be 'Introduce yourself.', got '${genResult.questions[0].question}'`);
    }
    if (genResult.aiGenerationCalls !== 1) {
      throw new Error(`Expected aiGenerationCalls to be 1, got ${genResult.aiGenerationCalls}`);
    }

    // Step 3: Test Generation Idempotency
    console.log("\n3. Testing Generation Idempotency (Calling generate AGAIN)...");
    const genRepeatResult = await generateAndProcessHRQuestions({
      sessionId,
      candidateProfile,
    });

    console.log(`   - Reused flag: ${genRepeatResult.reused}`);
    console.log(`   - aiGenerationCalls: ${genRepeatResult.aiGenerationCalls}`);

    if (!genRepeatResult.reused || genRepeatResult.aiGenerationCalls !== 1) {
      throw new Error("Generation idempotency failed: duplicate AI call triggered!");
    }

    // Step 4: DB Question & Marks Verification
    console.log("\n4. DB Question & Marks Verification...");
    const dbQuestions = await RealInterviewHRQuestion.find({ sessionId }).sort({ orderIndex: 1 });
    console.log(`   - Total persisted questions: ${dbQuestions.length}`);

    let totalMaxMarks = 0;
    dbQuestions.forEach((q, idx) => {
      totalMaxMarks += q.maxMarks;
      console.log(`     Q${idx + 1} [Order ${q.orderIndex}]: "${q.question.substring(0, 75)}..." (${q.maxMarks} marks)`);
      if (q.maxMarks !== 20) {
        throw new Error(`Question #${q.orderIndex} maxMarks is ${q.maxMarks}, expected 20!`);
      }
    });

    console.log(`   - Total Max Marks in DB: ${totalMaxMarks} (Expected: 60)`);
    if (totalMaxMarks !== 60) {
      throw new Error(`Total max marks in DB is ${totalMaxMarks}, expected 60!`);
    }

    // Step 5: Submitting Answers (ZERO AI Calls)
    console.log("\n5. Submitting answers for all 3 HR questions (ZERO AI CALLS)...");

    const candidateSampleAnswers = [
      "Hello, I am Rohan Sharma, a final-year Computer Science student passionate about building scalable web software...",
      "I will first talk privately with the team and understand their perspective constructively.",
      "I will immediately inform my manager and team about the mistake and deliver a clean fix.",
    ];

    for (let i = 0; i < dbQuestions.length; i++) {
      const qDoc = dbQuestions[i];
      const ansText = candidateSampleAnswers[i];

      const subResult = await submitHRAnswer({
        sessionId,
        questionId: qDoc._id,
        candidateAnswer: ansText,
      });

      if (!subResult.success) {
        throw new Error(`Failed to submit answer for question #${i + 1}`);
      }
    }

    const updatedSession = await RealInterviewHRSession.findOne({ sessionId });
    console.log(`   - Answers recorded in DB: ${updatedSession.answers.length}`);
    console.log(`   - AI Evaluation Calls so far: ${updatedSession.aiEvaluationCalls}`);

    if (updatedSession.aiEvaluationCalls !== 0) {
      throw new Error("Answer submission triggered unexpected AI call!");
    }

    // Step 6: Test CALL #2 (Complete Batch Evaluation)
    console.log("\n6. Testing CALL #2: Complete Batch Evaluation (60 Marks)...");
    const evalResult = await evaluateHRInterviewSession({
      sessionId,
      candidateProfile,
    });

    console.log(`   - Total Score: ${evalResult.totalScore} / ${evalResult.maxScore}`);
    console.log(`   - Percentage: ${evalResult.percentage}%`);
    console.log(`   - Overall Rating: ${evalResult.overallRating}`);
    console.log(`   - Fallback Used: ${evalResult.fallbackUsed}`);
    console.log(`   - aiEvaluationCalls: ${evalResult.aiEvaluationCalls}`);

    if (evalResult.totalScore < 0 || evalResult.totalScore > 60) {
      throw new Error(`Invalid total score: ${evalResult.totalScore}`);
    }
    if (evalResult.maxScore !== 60) {
      throw new Error(`Expected maxScore 60, got ${evalResult.maxScore}`);
    }
    if (evalResult.aiEvaluationCalls !== 1) {
      throw new Error(`Expected aiEvaluationCalls to be 1, got ${evalResult.aiEvaluationCalls}`);
    }

    // Verify individual scores <= 20
    evalResult.evaluations.forEach((ans, idx) => {
      console.log(`     Q${idx + 1} Score: ${ans.score}/20 (${ans.rating})`);
      if (ans.score < 0 || ans.score > 20) {
        throw new Error(`Individual question #${idx + 1} score out of range: ${ans.score}`);
      }
    });

    // Step 7: Test Evaluation Idempotency
    console.log("\n7. Testing Evaluation Idempotency (Calling evaluate AGAIN)...");
    const evalRepeatResult = await evaluateHRInterviewSession({
      sessionId,
      candidateProfile,
    });

    console.log(`   - Reused flag: ${evalRepeatResult.reused}`);
    console.log(`   - aiEvaluationCalls: ${evalRepeatResult.aiEvaluationCalls}`);

    if (!evalRepeatResult.reused || evalRepeatResult.aiEvaluationCalls !== 1) {
      throw new Error("Evaluation idempotency failed: duplicate AI call triggered!");
    }

    // Step 8: Final AI Call Audit
    const finalSessionDoc = await RealInterviewHRSession.findOne({ sessionId });
    const totalAICalls = finalSessionDoc.aiGenerationCalls + finalSessionDoc.aiEvaluationCalls;

    console.log("\n=======================================================");
    console.log("📊 FINAL HR SESSION AI CALL AUDIT:");
    console.log(`   - aiGenerationCalls: ${finalSessionDoc.aiGenerationCalls} (Max allowed: 1)`);
    console.log(`   - aiEvaluationCalls: ${finalSessionDoc.aiEvaluationCalls} (Max allowed: 1)`);
    console.log(`   - TOTAL AI API CALLS: ${totalAICalls}`);
    console.log("=======================================================\n");

    if (totalAICalls > 2) {
      throw new Error(`EXCEEDED AI BUDGET: Made ${totalAICalls} calls (Max allowed: 2)`);
    }

    console.log("🎉 ALL TESTS PASSED: HR round generates EXACTLY 3 questions (Q1 fixed) and uses EXACTLY 2 AI CALLS PER SESSION!\n");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("\n❌ HR TEST FAILED:", err.message);
    console.error(err.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runHRTest();
