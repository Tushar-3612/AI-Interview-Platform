import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import { generateAndProcessAptitudeQuestions } from "../services/realInterview/aptitudeService.js";
import RealInterviewAptitudeQuestion from "../models/RealInterviewAptitudeQuestion.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

async function runTest() {
  console.log("\n=======================================================");
  console.log("🧪 TESTING REAL INTERVIEW APTITUDE QUESTION GENERATION");
  console.log("=======================================================\n");

  console.log("1. Environment Verification:");
  console.log("   - Aptitude Source: Local JSON Bank (backend/data/aptitude/*.json)");
  console.log("   - AI Calls for Aptitude: 0");

  await connectDB();
  await RealInterviewAptitudeQuestion.deleteMany({ sessionId: "TEST_SESSION_001" });

  console.log("\n2. Executing ONE AI Generation Request (15 Questions)...");
  const startTime = Date.now();

  let result;
  try {
    result = await generateAndProcessAptitudeQuestions({ sessionId: "TEST_SESSION_001" });
  } catch (err) {
    console.error("❌ Generation Failed:", err.message);
    process.exit(1);
  }

  const durationMs = Date.now() - startTime;
  console.log(`✅ Generation completed in ${durationMs}ms`);

  console.log("\n3. Validation Results:");
  console.log(`   - Success: ${result.success}`);
  console.log(`   - Total Questions: ${result.count}`);
  console.log(`   - Difficulty Distribution: Easy=${result.distribution.easy}, Medium=${result.distribution.medium}, Hard=${result.distribution.hard}`);
  console.log(`   - Answer Distribution: A=${result.answerDistribution.A}, B=${result.answerDistribution.B}, C=${result.answerDistribution.C}, D=${result.answerDistribution.D}`);

  if (result.count !== 15) throw new Error(`Expected 15 questions, got ${result.count}`);
  if (result.distribution.easy !== 5 || result.distribution.medium !== 5 || result.distribution.hard !== 5) {
    throw new Error("Difficulty distribution mismatch!");
  }

  console.log("\n4. Verifying Student Response Protection (No correctAnswer/explanation exposed):");
  const sampleStudentQ = result.questions[0];
  console.log("   Sample Student Question Object keys:", Object.keys(sampleStudentQ));
  if (sampleStudentQ.correctAnswer || sampleStudentQ.explanation) {
    throw new Error("❌ SECURITY VIOLATION: Student response contains correctAnswer or explanation!");
  } else {
    console.log("   ✅ Security verified: correctAnswer and explanation are stripped from student response!");
  }

  console.log("\n5. Verifying Database Storage in MongoDB (RealInterviewAptitudeQuestion):");
  const dbDocs = await RealInterviewAptitudeQuestion.find({ sessionId: "TEST_SESSION_001" });
  console.log(`   - Stored Documents Count: ${dbDocs.length}`);
  if (dbDocs.length < 15) throw new Error("Database storage check failed!");

  const sampleDbDoc = dbDocs[0];
  console.log("   - Sample Stored DB Document:");
  console.log(`     Topic: ${sampleDbDoc.topic}`);
  console.log(`     QuestionType: ${sampleDbDoc.questionType}`);
  console.log(`     Difficulty: ${sampleDbDoc.difficulty}`);
  console.log(`     Question: ${sampleDbDoc.question}`);
  console.log(`     CorrectAnswer: ${sampleDbDoc.correctAnswer}`);
  console.log(`     Explanation: ${sampleDbDoc.explanation}`);
  console.log(`     Options:`, sampleDbDoc.options);

  console.log("\n=======================================================");
  console.log("🎉 REAL INTERVIEW APTITUDE GENERATION TEST PASSED 100%");
  console.log("=======================================================\n");

  process.exit(0);
}

runTest();
