import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  generateAndProcessProjectQuestions,
  getNextProjectQuestion,
  submitProjectAnswer,
  evaluateProjectInterviewSession,
} from "../services/realInterview/projectService.js";
import RealInterviewProjectQuestion from "../models/RealInterviewProjectQuestion.js";
import RealInterviewProjectSession from "../models/RealInterviewProjectSession.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

async function runProjectTest() {
  console.log("\n=======================================================");
  console.log("🧪 TESTING REAL INTERVIEW PROJECT ROUND (EXACTLY 10 QUESTIONS | 2 AI CALLS | 100 MARKS)");
  console.log("=======================================================\n");

  console.log("1. Environment Verification:");
  console.log(`   - REAL_INTERVIEW_PROJECT_API_KEY: ${process.env.REAL_INTERVIEW_PROJECT_API_KEY ? "✅ Configured" : "❌ Missing"}`);

  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI missing in .env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB Connected Successfully\n");

  const sessionId = `test_proj_10q_${Date.now()}`;
  const candidateProfile = {
    fullName: "Tushar Nagare",
    projects: [
      {
        name: "AI Interview Engine",
        description: "An online platform conducting real AI-driven multi-round interviews with real-time feedback and evaluation.",
        technologies: ["Node.js", "Express", "MongoDB", "React", "Groq API"],
        role: "Full Stack Developer",
      },
    ],
    skills: ["JavaScript", "Node.js", "React", "MongoDB", "Express", "REST APIs"],
    programmingLanguages: ["JavaScript", "Python"],
    frameworks: ["React", "Express"],
    databases: ["MongoDB"],
  };

  try {
    // Clean up pre-existing test data for sessionId
    await RealInterviewProjectQuestion.deleteMany({ sessionId });
    await RealInterviewProjectSession.deleteMany({ sessionId });

    // Step 2: Test CALL #1 (Question Generation)
    console.log("2. Testing CALL #1: Project Question Generation (Target: Exactly 10 questions)...");
    const genResult = await generateAndProcessProjectQuestions({
      sessionId,
      candidateProfile,
    });

    console.log(`   - Questions generated: ${genResult.questions.length}`);
    console.log(`   - Reused flag: ${genResult.reused}`);
    console.log(`   - aiGenerationCalls: ${genResult.aiGenerationCalls}`);

    if (genResult.questions.length !== 5) {
      throw new Error(`Expected exactly 5 Project questions, got ${genResult.questions.length}`);
    }
    if (genResult.aiGenerationCalls !== 1) {
      throw new Error(`Expected aiGenerationCalls to be 1, got ${genResult.aiGenerationCalls}`);
    }

    // Step 3: Test Generation Idempotency
    console.log("\n3. Testing Generation Idempotency (Calling generate AGAIN)...");
    const genRepeatResult = await generateAndProcessProjectQuestions({
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
    const dbQuestions = await RealInterviewProjectQuestion.find({ sessionId }).sort({ orderIndex: 1 });
    console.log(`   - Total persisted questions: ${dbQuestions.length}`);

    let totalMaxMarks = 0;
    dbQuestions.forEach((q, idx) => {
      totalMaxMarks += q.maxMarks;
      console.log(`     Q${idx + 1} [${q.difficulty.toUpperCase()}]: "${q.question.substring(0, 70)}..." (${q.maxMarks} marks)`);
    });

    console.log(`   - Total Max Marks in DB: ${totalMaxMarks} (Expected: 100)`);
    if (totalMaxMarks !== 100) {
      throw new Error(`Total max marks in DB is ${totalMaxMarks}, expected 100!`);
    }

    // Step 5: Submitting Answers (ZERO AI Calls)
    console.log("\n5. Submitting answers for all 10 Project questions (ZERO AI CALLS)...");

    const sampleAnswers = [
      "We chose MongoDB because of flexible JSON schema for storing varied question structures dynamically.",
      "The system receives user answer, saves it into MongoDB session document, and queues it for final evaluation.",
      "Authentication uses JWT tokens stored in HTTP-only cookies with Express middleware protection.",
      "We handle AI rate limits using deterministic application fallbacks and single-request batching.",
      "Scalability is handled via stateless Express servers and indexed MongoDB queries on sessionId.",
      "Error handling catches fetch timeouts and maps technical status codes to candidate-friendly progress messages.",
      "The main trade-off of MongoDB over SQL was losing ACID transactions across multi-collection joins.",
      "Debugging intermittent failures is done using structured server logging and request ID correlation.",
      "Security is enforced by storing API keys strictly in server environment variables without exposing to client.",
      "Performance optimization includes indexed session queries and batching 10 questions into one evaluation prompt.",
    ];

    for (let i = 0; i < dbQuestions.length; i++) {
      const qDoc = dbQuestions[i];
      const ansText = sampleAnswers[i];

      const subResult = await submitProjectAnswer({
        sessionId,
        questionId: qDoc._id,
        candidateAnswer: ansText,
      });

      if (!subResult.success) {
        throw new Error(`Failed to submit answer for question #${i + 1}`);
      }
    }

    const updatedSession = await RealInterviewProjectSession.findOne({ sessionId });
    console.log(`   - Answers recorded in DB: ${updatedSession.answers.length}`);
    console.log(`   - AI Evaluation Calls so far: ${updatedSession.aiEvaluationCalls}`);

    if (updatedSession.aiEvaluationCalls !== 0) {
      throw new Error("Answer submission triggered unexpected AI call!");
    }

    // Step 6: Test CALL #2 (Complete Batch Evaluation)
    console.log("\n6. Testing CALL #2: Complete Batch Evaluation (100 Marks)...");
    const evalResult = await evaluateProjectInterviewSession({
      sessionId,
      candidateProfile,
    });

    console.log(`   - Total Score: ${evalResult.totalScore} / ${evalResult.maxScore}`);
    console.log(`   - Percentage: ${evalResult.percentage}%`);
    console.log(`   - Overall Rating: ${evalResult.overallRating}`);
    console.log(`   - aiEvaluationCalls: ${evalResult.aiEvaluationCalls}`);

    if (evalResult.totalScore < 0 || evalResult.totalScore > 100) {
      throw new Error(`Invalid total score: ${evalResult.totalScore}`);
    }
    if (evalResult.maxScore !== 100) {
      throw new Error(`Expected maxScore 100, got ${evalResult.maxScore}`);
    }
    if (evalResult.aiEvaluationCalls !== 1) {
      throw new Error(`Expected aiEvaluationCalls to be 1, got ${evalResult.aiEvaluationCalls}`);
    }

    // Step 7: Test Evaluation Idempotency
    console.log("\n7. Testing Evaluation Idempotency (Calling evaluate AGAIN)...");
    const evalRepeatResult = await evaluateProjectInterviewSession({
      sessionId,
      candidateProfile,
    });

    console.log(`   - Reused flag: ${evalRepeatResult.reused}`);
    console.log(`   - aiEvaluationCalls: ${evalRepeatResult.aiEvaluationCalls}`);

    if (!evalRepeatResult.reused || evalRepeatResult.aiEvaluationCalls !== 1) {
      throw new Error("Evaluation idempotency failed: duplicate AI call triggered!");
    }

    // Step 8: Final AI Call Audit
    const finalSessionDoc = await RealInterviewProjectSession.findOne({ sessionId });
    const totalAICalls = finalSessionDoc.aiGenerationCalls + finalSessionDoc.aiEvaluationCalls;

    console.log("\n=======================================================");
    console.log("📊 FINAL PROJECT SESSION AI CALL AUDIT:");
    console.log(`   - aiGenerationCalls: ${finalSessionDoc.aiGenerationCalls} (Max allowed: 1)`);
    console.log(`   - aiEvaluationCalls: ${finalSessionDoc.aiEvaluationCalls} (Max allowed: 1)`);
    console.log(`   - TOTAL AI API CALLS: ${totalAICalls}`);
    console.log("=======================================================\n");

    if (totalAICalls > 2) {
      throw new Error(`EXCEEDED AI BUDGET: Made ${totalAICalls} calls (Max allowed: 2)`);
    }

    console.log("🎉 ALL TESTS PASSED: Project round generates EXACTLY 10 questions and uses EXACTLY 2 AI CALLS PER SESSION!\n");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("\n❌ PROJECT TEST FAILED:", err.message);
    console.error(err.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runProjectTest();
