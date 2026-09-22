import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });

import mongoose from "mongoose";
import User from "../models/User.js";

const BASE_URL = "http://localhost:5000";
const secret = process.env.JWT_SECRET || "fallback_secret_key";
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function runTest() {
  console.log("=================================================");
  console.log("🧪 TESTING FRESH REAL INTERVIEW SESSION & DATA FLOW");
  console.log("=================================================\n");

  await mongoose.connect(process.env.MONGO_URI);
  let user = await User.findOne({ email: "tusharnagare2006@gmail.com" });
  if (!user) user = await User.findOne();
  const token = jwt.sign({ id: user._id, role: user.role || "student" }, secret, { expiresIn: "1h" });
  console.log(`Using User: ${user._id} (${user.email})`);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // 1. Create session via POST /api/student/interviews
  console.log("[1] Creating new session via POST /api/student/interviews ...");
  const createRes = await fetch(`${BASE_URL}/api/student/interviews`, {
    method: "POST",
    headers,
    body: JSON.stringify({ interviewType: "actual", targetRound: "all" }),
  });

  const createData = await createRes.json();
  console.log("   - Response Status:", createRes.status);
  console.log("   - Response Data:", createData);

  const sessionId = createData.sessionId || createData.interviewId;
  if (!sessionId || sessionId === "undefined") {
    console.error("❌ FAILED: Session creation did not return a valid sessionId!");
    process.exit(1);
  }

  console.log(`\n✅ Session created successfully: sessionId=${sessionId}`);

  // 2. Call all 5 round generation endpoints using the SAME sessionId
  const rounds = [
    { stage: "aptitude", endpoint: "/api/real-interview/aptitude/generate" },
    { stage: "technical", endpoint: "/api/real-interview/technical/generate" },
    { stage: "project", endpoint: "/api/real-interview/project/generate" },
    { stage: "hr", endpoint: "/api/real-interview/hr/generate" },
    { stage: "coding", endpoint: "/api/real-interview/coding/generate" },
  ];

  for (const r of rounds) {
    await delay(1000);
    console.log(`\n[2] Generating ${r.stage} round (sessionId=${sessionId}) ...`);
    const res = await fetch(`${BASE_URL}${r.endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        sessionId,
        candidateProfile: {
          candidateName: "Test Student",
          resumeFileName: "resume.pdf",
          skills: ["JavaScript", "React", "Node.js"],
        },
      }),
    });

    console.log(`   - ${r.stage} Status: ${res.status}`);
    const data = await res.json();
    console.log(`   - ${r.stage} Success: ${data.success !== false}`);
  }

  // 3. Finalization GET request
  await delay(1000);
  console.log(`\n[3] Finalizing & Validating session via GET /api/student/interviews/${sessionId} ...`);
  const finalRes = await fetch(`${BASE_URL}/api/student/interviews/${sessionId}`, { headers });
  console.log("   - Final GET Status:", finalRes.status);

  const finalData = await finalRes.json();
  console.log("   - isValidRealInterview:", finalData.isValidRealInterview);
  console.log("   - totalQuestionsCount:", finalData.totalQuestionsCount);
  console.log("   - sectionCounts:", finalData.sectionCounts);

  const qs = finalData.generatedQuestions || [];
  const aptitudeQs = qs.filter((q) => q.section === "APTITUDE");
  const techQs = qs.filter((q) => q.section === "TECHNICAL");
  const projectQs = qs.filter((q) => q.section === "RESUME_PROJECT");
  const hrQs = qs.filter((q) => q.section === "HR");
  const codingQs = qs.filter((q) => q.section === "CODING");

  console.log("\n=================================================");
  console.log("📊 FINAL VERIFICATION REPORT");
  console.log("=================================================");
  console.log(`- Aptitude Question Count: ${aptitudeQs.length} (Expected: 15)`);
  console.log(`- Technical Question Count: ${techQs.length} (Expected: 20)`);
  console.log(`- Resume Project Question Count: ${projectQs.length} (Expected: 10)`);
  console.log(`- HR Question Count: ${hrQs.length} (Expected: 5)`);
  console.log(`- Coding Question Count: ${codingQs.length} (Expected: 3)`);
  console.log(`- Total Questions: ${qs.length} (Expected: 53)`);

  const invalidAptitude = aptitudeQs.some((q) => !q.options || q.options.length !== 4);
  console.log(`- All Aptitude Questions have 4 choices (A/B/C/D): ${!invalidAptitude}`);

  if (
    finalRes.status === 200 &&
    finalData.isValidRealInterview &&
    qs.length === 53 &&
    !invalidAptitude
  ) {
    await mongoose.disconnect();
    console.log("\n🎉 SUCCESS: All 53 Real Interview questions generated and validated with a single canonical sessionId!");
  } else {
    await mongoose.disconnect();
    console.error("\n❌ FAILED: Session validation did not meet expectations.");
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
