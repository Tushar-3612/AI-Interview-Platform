import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import {
  generateAndProcessTechnicalQuestions,
  getNextTechnicalQuestion,
  submitTechnicalAnswer,
  evaluateTechnicalInterviewSession,
} from "../services/realInterview/technicalService.js";
import RealInterviewTechnicalQuestion from "../models/RealInterviewTechnicalQuestion.js";
import RealInterviewTechnicalSession from "../models/RealInterviewTechnicalSession.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

async function runTest() {
  console.log("\n=======================================================");
  console.log("🧪 TESTING REAL INTERVIEW TECHNICAL ROUND (EXACTLY 2 AI CALLS | 100 MARKS)");
  console.log("=======================================================\n");

  const techKey = process.env.REAL_INTERVIEW_TECHNICAL_API_KEY;
  console.log("1. Environment Verification:");
  console.log(`   - REAL_INTERVIEW_TECHNICAL_API_KEY: ${techKey ? "✅ Configured" : "❌ Missing"}`);
  if (!techKey) {
    throw new Error("REAL_INTERVIEW_TECHNICAL_API_KEY is missing from root .env");
  }

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error("MONGO_URI not configured");
  await mongoose.connect(mongoUri);
  console.log("✅ MongoDB Connected Successfully\n");

  const testSessionId = `test_tech_2calls_${Date.now()}`;

  await RealInterviewTechnicalQuestion.deleteMany({ sessionId: testSessionId });
  await RealInterviewTechnicalSession.deleteMany({ sessionId: testSessionId });

  const sampleCandidateProfile = {
    skills: ["Java", "React", "Node.js", "MongoDB", "MySQL", "AWS"],
    programmingLanguages: ["Java", "JavaScript"],
    frameworks: ["React", "Express"],
    databases: ["MongoDB", "MySQL"],
    tools: ["Git", "Postman"],
    cloud: ["AWS"],
    projects: [
      {
        name: "MERN Project Management System",
        description: "Full-stack project management app with authentication, task tracking, and real-time updates",
        technologies: ["MongoDB", "Express", "React", "Node.js"],
        role: "Full Stack Developer",
      },
    ],
  };

  // Step 2 & 3: Generation (AI CALL #1)
  console.log("2. Testing CALL #1: Question Generation...");
  const gen1 = await generateAndProcessTechnicalQuestions({
    sessionId: testSessionId,
    candidateProfile: sampleCandidateProfile,
  });

  console.log(`   - Questions generated: ${gen1.count}`);
  console.log(`   - Reused flag: ${gen1.reused}`);
  console.log(`   - aiGenerationCalls: ${gen1.aiGenerationCalls}`);

  if (gen1.count !== 15) {
    throw new Error(`Expected exactly 15 questions, got ${gen1.count}`);
  }
  if (gen1.aiGenerationCalls !== 1) {
    throw new Error(`Expected aiGenerationCalls = 1, got ${gen1.aiGenerationCalls}`);
  }

  // Generation Idempotency Check
  console.log("\n3. Testing Generation Idempotency (Calling generate AGAIN)...");
  const gen2 = await generateAndProcessTechnicalQuestions({
    sessionId: testSessionId,
    candidateProfile: sampleCandidateProfile,
  });

  console.log(`   - Reused flag: ${gen2.reused}`);
  console.log(`   - aiGenerationCalls: ${gen2.aiGenerationCalls}`);

  if (!gen2.reused || gen2.aiGenerationCalls !== 1) {
    throw new Error("Idempotency failed for generation!");
  }

  // DB Question Verification
  const questionsInDb = await RealInterviewTechnicalQuestion.find({ sessionId: testSessionId }).sort({
    orderIndex: 1,
  });
  console.log(`\n4. DB Question Verification: ${questionsInDb.length} questions persisted in DB.`);

  const easyCount = questionsInDb.filter((q) => q.difficulty === "easy").length;
  const mediumCount = questionsInDb.filter((q) => q.difficulty === "medium").length;
  const hardCount = questionsInDb.filter((q) => q.difficulty === "hard").length;
  const totalMaxMarks = questionsInDb.reduce((acc, q) => acc + (q.maxMarks || 0), 0);

  console.log(`   - Easy Questions (3 marks): ${easyCount}`);
  console.log(`   - Medium Questions (5 marks): ${mediumCount}`);
  console.log(`   - Hard Questions (13 marks): ${hardCount}`);
  console.log(`   - Total Max Marks in DB: ${totalMaxMarks} (Expected: 100)`);

  if (totalMaxMarks !== 100) {
    throw new Error(`Expected total max marks = 100, got ${totalMaxMarks}`);
  }

  // Submit answers for all 20 questions (ZERO AI CALLS)
  console.log("\n5. Submitting answers for all 20 questions (ZERO AI CALLS)...");
  for (let i = 0; i < questionsInDb.length; i++) {
    const qDoc = questionsInDb[i];
    const candidateAnswerText = `Candidate response for question ${i + 1} regarding ${qDoc.topic}: My technical approach uses standard principles, optimization, and sound architecture.`;

    const subResult = await submitTechnicalAnswer({
      sessionId: testSessionId,
      questionId: qDoc._id.toString(),
      candidateAnswer: candidateAnswerText,
    });

    if (!subResult.success) {
      throw new Error(`Failed to submit answer for question ${i + 1}`);
    }
  }

  const sessionAfterSubmit = await RealInterviewTechnicalSession.findOne({ sessionId: testSessionId });
  console.log(`   - Answers recorded in DB: ${sessionAfterSubmit.answers.length}`);
  console.log(`   - AI Evaluation Calls so far: ${sessionAfterSubmit.aiEvaluationCalls || 0}`);

  if ((sessionAfterSubmit.aiEvaluationCalls || 0) !== 0) {
    throw new Error("ERR: submit-answer made an AI call! Must be ZERO AI calls.");
  }

  // Pause for TPM rate limit reset
  console.log("\nWaiting 6 seconds for Groq TPM rate limit reset...");
  await new Promise((r) => setTimeout(r, 6000));

  // Complete Evaluation (AI CALL #2)
  console.log("6. Testing CALL #2: Complete Batch Evaluation...");
  const eval1 = await evaluateTechnicalInterviewSession({
    sessionId: testSessionId,
    candidateProfile: sampleCandidateProfile,
  });

  console.log(`   - Total Score: ${eval1.totalScore} / ${eval1.maxScore}`);
  console.log(`   - Percentage: ${eval1.percentage}%`);
  console.log(`   - Overall Rating: ${eval1.overallRating}`);
  console.log(`   - Evaluations count: ${eval1.evaluations.length}`);
  console.log(`   - aiEvaluationCalls: ${eval1.aiEvaluationCalls}`);

  if (eval1.evaluations.length !== 20 || eval1.aiEvaluationCalls !== 1) {
    throw new Error("Evaluation assertion failed!");
  }

  // Evaluation Idempotency
  console.log("\n7. Testing Evaluation Idempotency (Calling evaluate AGAIN)...");
  const eval2 = await evaluateTechnicalInterviewSession({
    sessionId: testSessionId,
    candidateProfile: sampleCandidateProfile,
  });

  console.log(`   - Reused flag: ${eval2.reused}`);
  console.log(`   - aiEvaluationCalls: ${eval2.aiEvaluationCalls}`);

  if (!eval2.reused || eval2.aiEvaluationCalls !== 1) {
    throw new Error("Idempotency failed for evaluation!");
  }

  const finalSession = await RealInterviewTechnicalSession.findOne({ sessionId: testSessionId });
  console.log("\n=======================================================");
  console.log("📊 FINAL TECHNICAL SESSION AI CALL AUDIT:");
  console.log(`   - aiGenerationCalls: ${finalSession.aiGenerationCalls} (Max allowed: 1)`);
  console.log(`   - aiEvaluationCalls: ${finalSession.aiEvaluationCalls} (Max allowed: 1)`);
  console.log(`   - TOTAL AI API CALLS: ${finalSession.aiGenerationCalls + finalSession.aiEvaluationCalls}`);
  console.log("=======================================================\n");

  await RealInterviewTechnicalQuestion.deleteMany({ sessionId: testSessionId });
  await RealInterviewTechnicalSession.deleteMany({ sessionId: testSessionId });

  console.log("🎉 ALL TESTS PASSED: Technical round AI API usage is EXACTLY 2 CALLS PER SESSION!\n");
  await mongoose.disconnect();
  process.exit(0);
}

runTest().catch((err) => {
  console.error("\n❌ TEST FAILED:", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
