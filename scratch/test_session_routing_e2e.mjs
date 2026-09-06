import fetch from "node-fetch";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import User from "../backend/models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

async function runSessionRoutingTest() {
  console.log("\n=======================================================");
  console.log("🧪 TESTING REAL INTERVIEW ROUTING & SESSION ENDPOINTS");
  console.log("=======================================================\n");

  const BASE_URL = "http://localhost:5000";

  // Connect to DB to get or mock a test user token
  await mongoose.connect(process.env.MONGO_URI);
  const testUser = await User.findOne({});

  if (!testUser) {
    console.error("❌ No user found in DB for test authentication");
    process.exit(1);
  }

  const jwtSecret = process.env.JWT_SECRET || "fallback_secret";
  const token = jwt.sign({ id: testUser._id.toString(), role: "student" }, jwtSecret, { expiresIn: "1h" });
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    // Test 1: POST /api/student/interviews (Create Session)
    console.log("1. Testing POST /api/student/interviews (Create Session)...");
    const createRes = await fetch(`${BASE_URL}/api/student/interviews`, {
      method: "POST",
      headers,
      body: JSON.stringify({ interviewType: "actual", targetRound: "all" }),
    });

    console.log(`   - HTTP Status: ${createRes.status}`);
    const createData = await createRes.json();
    console.log(`   - Response:`, createData);

    if (createRes.status !== 201 || !createData.sessionId) {
      throw new Error(`POST /api/student/interviews failed with status ${createRes.status}`);
    }

    const createdSessionId = createData.sessionId;

    // Test 2: GET /api/student/interviews/:sessionId (Fetch Session)
    console.log(`\n2. Testing GET /api/student/interviews/${createdSessionId} (Fetch Session)...`);
    const getRes = await fetch(`${BASE_URL}/api/student/interviews/${createdSessionId}`, {
      method: "GET",
      headers,
    });

    console.log(`   - HTTP Status: ${getRes.status}`);
    const getData = await getRes.json();
    console.log(`   - Response sessionId: ${getData.sessionId}, targetRound: ${getData.targetRound}`);

    if (getRes.status !== 200 || !getData.sessionId) {
      throw new Error(`GET /api/student/interviews/${createdSessionId} failed with status ${getRes.status}`);
    }

    // Test 3: POST /api/student/interviews/:sessionId/complete (Complete Session)
    console.log(`\n3. Testing POST /api/student/interviews/${createdSessionId}/complete (Complete Session)...`);
    const completeRes = await fetch(`${BASE_URL}/api/student/interviews/${createdSessionId}/complete`, {
      method: "POST",
      headers,
    });

    console.log(`   - HTTP Status: ${completeRes.status}`);
    const completeData = await completeRes.json();
    console.log(`   - Response:`, completeData);

    if (completeRes.status !== 200) {
      throw new Error(`POST /api/student/interviews/${createdSessionId}/complete failed with status ${completeRes.status}`);
    }

    // Test 4: GET /api/student/interviews (List Interviews)
    console.log(`\n4. Testing GET /api/student/interviews (List Interviews)...`);
    const listRes = await fetch(`${BASE_URL}/api/student/interviews`, {
      method: "GET",
      headers,
    });

    console.log(`   - HTTP Status: ${listRes.status}`);
    const listData = await listRes.json();
    console.log(`   - Returned items: ${Array.isArray(listData) ? listData.length : "Not array"}`);

    if (listRes.status !== 200 || !Array.isArray(listData)) {
      throw new Error(`GET /api/student/interviews failed with status ${listRes.status}`);
    }

    // Test 5: GET /api/student/results (Fetch Results)
    console.log(`\n5. Testing GET /api/student/results (Fetch Results)...`);
    const resultsRes = await fetch(`${BASE_URL}/api/student/results`, {
      method: "GET",
      headers,
    });

    console.log(`   - HTTP Status: ${resultsRes.status}`);
    const resultsData = await resultsRes.json();
    console.log(`   - Returned results items: ${Array.isArray(resultsData) ? resultsData.length : "Not array"}`);

    if (resultsRes.status !== 200) {
      throw new Error(`GET /api/student/results failed with status ${resultsRes.status}`);
    }

    console.log("\n=======================================================");
    console.log("🎉 ALL ROUTING TESTS PASSED PERFECTLY (NO 404 ERRORS!)");
    console.log("=======================================================\n");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("\n❌ ROUTING TEST FAILED:", err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runSessionRoutingTest();
