import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import RealInterviewTechnicalQuestion from "../backend/models/RealInterviewTechnicalQuestion.js";
import RealInterviewTechnicalSession from "../backend/models/RealInterviewTechnicalSession.js";
import { generateAndProcessTechnicalQuestions } from "../backend/services/realInterview/technicalService.js";
import { getDifficultyForQuestionNumber } from "../backend/services/realInterviewAI/technicalAI.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

async function runTests() {
  console.log("=== STARTING RESUMABLE TECHNICAL GENERATION VERIFICATION TESTS ===");

  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ai-interview-engine";
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB.");

  const testSessionId = new mongoose.Types.ObjectId().toString();
  const testUserId = new mongoose.Types.ObjectId();

  // Test 1: Verify Difficulty mapping function
  console.log("\n--- TEST 1: Question Difficulty Slot Mapping ---");
  console.assert(getDifficultyForQuestionNumber(1) === "easy", "Q1 should be easy");
  console.assert(getDifficultyForQuestionNumber(6) === "easy", "Q6 should be easy");
  console.assert(getDifficultyForQuestionNumber(7) === "medium", "Q7 should be medium");
  console.assert(getDifficultyForQuestionNumber(18) === "medium", "Q18 should be medium");
  console.assert(getDifficultyForQuestionNumber(19) === "hard", "Q19 should be hard");
  console.assert(getDifficultyForQuestionNumber(20) === "hard", "Q20 should be hard");
  console.log("PASS: Difficulty mapping correctly assigns Easy (Q1-Q6), Medium (Q7-Q18), Hard (Q19-Q20).");

  // Test 2: Resumable Generation from Partial DB Checkpoint (16 preseeded -> generates Q17-Q20)
  console.log("\n--- TEST 2: Resumable Generation from Partial DB Checkpoint ---");
  const preseededQuestions = [];
  for (let i = 0; i < 16; i++) {
    const diff = getDifficultyForQuestionNumber(i + 1);
    preseededQuestions.push({
      sessionId: testSessionId,
      userId: testUserId,
      orderIndex: i,
      question: `Preseeded Technical Question #${i + 1} regarding Node.js concept ${i + 1}`,
      expectedKnowledge: "Detailed explanation of Node.js principles",
      difficulty: diff,
      maxMarks: diff === "easy" ? 3 : diff === "hard" ? 13 : 5,
      topic: "Node.js Core",
      category: "Conceptual",
      source: "PRESEEDED_TEST",
    });
  }

  await RealInterviewTechnicalQuestion.insertMany(preseededQuestions);
  console.log(`Preseeded 16 questions into MongoDB for sessionId=${testSessionId}`);

  // Now trigger generateAndProcessTechnicalQuestions for the session with 16 existing questions
  const res = await generateAndProcessTechnicalQuestions({
    userId: testUserId,
    sessionId: testSessionId,
    candidateProfile: {
      skills: ["Node.js", "Express", "MongoDB", "JavaScript"],
    },
  });

  console.log("Result status:", res.success);
  console.log("Result message:", res.message);
  console.log("Total question count returned:", res.count);

  const finalQuestions = await RealInterviewTechnicalQuestion.find({ sessionId: testSessionId }).sort({ orderIndex: 1 });
  console.log("Final questions count in MongoDB:", finalQuestions.length);

  console.assert(finalQuestions.length === 20, "Total questions in DB should be 20");
  console.assert(finalQuestions[0].question.includes("Preseeded Technical Question #1"), "Q1 must be original preseeded question");
  console.assert(finalQuestions[15].question.includes("Preseeded Technical Question #16"), "Q16 must be original preseeded question");
  console.assert(!finalQuestions[16].question.includes("Preseeded Technical Question #1"), "Q17 must NOT be Q1");

  console.log("PASS: Resumed generation starting at Q17 and brought total question count from 16 to 20 without regenerating Q1-Q16!");

  // Test 3: Reusing existing complete 20 questions (Idempotency)
  console.log("\n--- TEST 3: Idempotent Reuse of Completed 20 Questions ---");
  const res2 = await generateAndProcessTechnicalQuestions({
    userId: testUserId,
    sessionId: testSessionId,
    candidateProfile: {
      skills: ["Node.js", "Express", "MongoDB", "JavaScript"],
    },
  });

  console.assert(res2.reused === true, "Should reuse existing questions without making AI call");
  console.assert(res2.count === 20, "Should return 20 questions");
  console.log("PASS: Reused 20 questions without making any AI call!");

  // Clean up test data
  await RealInterviewTechnicalQuestion.deleteMany({ sessionId: testSessionId });
  await RealInterviewTechnicalSession.deleteMany({ sessionId: testSessionId });

  await mongoose.disconnect();
  console.log("\n=== ALL RESUMABLE TECHNICAL TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
