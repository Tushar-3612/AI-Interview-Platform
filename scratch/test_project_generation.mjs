import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { generateAndProcessProjectQuestions } from "../backend/services/realInterview/projectService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/ai-interview-engine";

async function testProjectGen() {
  console.log("=== TESTING PROJECT GENERATION DIRECTLY ===");
  console.log("Checking REAL_INTERVIEW_PROJECT_API_KEY presence...");
  const key = process.env.REAL_INTERVIEW_PROJECT_API_KEY;
  console.log("PROJECT KEY PRESENT:", Boolean(key && key.trim()));

  console.log("Connecting to MongoDB:", MONGO_URI);
  await mongoose.connect(MONGO_URI);

  const testSessionId = `TEST_PROJECT_GEN_${Date.now()}`;
  console.log("Test Session ID:", testSessionId);

  const testCases = [
    { name: "Empty Candidate Profile", profile: {} },
    { name: "Empty Projects Array", profile: { projects: [] } },
    { name: "String Projects Array", profile: { projects: ["AI Interview Platform", "E-Commerce App"] } },
    { name: "Object Projects Array", profile: { projects: [{ title: "AI Interview Platform", description: "Demo app" }] } }
  ];

  for (const tc of testCases) {
    const testSessionId = `TEST_PROJECT_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    console.log(`\n--- Testing Case: ${tc.name} ---`);
    try {
      const result = await generateAndProcessProjectQuestions({
        userId: new mongoose.Types.ObjectId().toString(),
        sessionId: testSessionId,
        candidateProfile: tc.profile,
      });
      console.log(`✅ Success for '${tc.name}':`, result.questions?.length, "questions generated");
    } catch (err) {
      console.error(`❌ FAILED for '${tc.name}':`, err.message);
    }
  }

  await mongoose.disconnect();
  console.log("Done.");
}

testProjectGen();
