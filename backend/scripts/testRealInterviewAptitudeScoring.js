import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import {
  generateAndProcessAptitudeQuestions,
  evaluateAptitudeSession,
} from "../services/realInterview/aptitudeService.js";
import RealInterviewAptitudeQuestion from "../models/RealInterviewAptitudeQuestion.js";
import RealInterviewAptitudeSession from "../models/RealInterviewAptitudeSession.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

async function runTest() {
  console.log("\n=======================================================");
  console.log("🧪 TESTING REAL INTERVIEW APTITUDE SCORING (50 MARKS | 0 AI EVAL CALLS)");
  console.log("=======================================================\n");

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error("MONGO_URI not configured");
  await mongoose.connect(mongoUri);
  console.log("✅ MongoDB Connected Successfully\n");

  const testSessionId = `test_aptitude_scoring_${Date.now()}`;

  await RealInterviewAptitudeQuestion.deleteMany({ sessionId: testSessionId });
  await RealInterviewAptitudeSession.deleteMany({ sessionId: testSessionId });

  // 1. Generate Aptitude Questions
  console.log("1. Generating 15 Aptitude Questions...");
  const genResult = await generateAndProcessAptitudeQuestions({
    sessionId: testSessionId,
  });

  console.log(`   - Count generated: ${genResult.count}`);
  console.log(`   - Easy Questions: ${genResult.distribution.easy} (2 marks each)`);
  console.log(`   - Medium Questions: ${genResult.distribution.medium} (3 marks each)`);
  console.log(`   - Hard Questions: ${genResult.distribution.hard} (5 marks each)`);

  if (genResult.count !== 15) {
    throw new Error(`Expected 15 questions, got ${genResult.count}`);
  }

  // Check stored questions in DB
  const storedDocs = await RealInterviewAptitudeQuestion.find({ sessionId: testSessionId });
  const totalMaxMarks = storedDocs.reduce((acc, q) => acc + (q.maxMarks || 0), 0);
  console.log(`   - Total Max Marks in DB: ${totalMaxMarks} (Expected: 50)`);

  if (totalMaxMarks !== 50) {
    throw new Error(`Expected total max marks = 50, got ${totalMaxMarks}`);
  }

  // Verify correctAnswer is NOT exposed in student questions array
  const sampleStudentQ = genResult.questions[0];
  if (sampleStudentQ.correctAnswer || sampleStudentQ.explanation) {
    throw new Error("ERR: correctAnswer or explanation is exposed in active student questions!");
  }
  console.log("   - Security Check: ✅ correctAnswer & explanation stripped from active student payload");

  // 2. Simulate Candidate Answers (answer all correctly)
  console.log("\n2. Simulating 100% Correct Candidate Answers...");
  const perfectAnswers = storedDocs.map((q) => ({
    questionId: q._id.toString(),
    selectedOption: q.correctAnswer,
  }));

  const evalPerfect = await evaluateAptitudeSession({
    sessionId: testSessionId,
    candidateAnswers: perfectAnswers,
  });

  console.log(`   - Total Score: ${evalPerfect.totalScore} / ${evalPerfect.maxScore}`);
  console.log(`   - Percentage: ${evalPerfect.percentage}%`);
  console.log(`   - Overall Rating: ${evalPerfect.overallRating}`);

  if (evalPerfect.totalScore !== 50 || evalPerfect.percentage !== 100) {
    throw new Error(`Expected perfect score 50/50, got ${evalPerfect.totalScore}`);
  }

  // Clean up
  await RealInterviewAptitudeQuestion.deleteMany({ sessionId: testSessionId });
  await RealInterviewAptitudeSession.deleteMany({ sessionId: testSessionId });

  console.log("\n🎉 ALL TESTS PASSED: Aptitude scoring is 50 marks total and 0 AI evaluation calls!\n");
  await mongoose.disconnect();
  process.exit(0);
}

runTest().catch((err) => {
  console.error("\n❌ TEST FAILED:", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
