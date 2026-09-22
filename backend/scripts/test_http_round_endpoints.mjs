import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

const BASE_URL = "http://localhost:5000";
const secret = process.env.JWT_SECRET || "fallback_secret_key";
const testUserId = "66d92a1b9c9e1f0011223344";

const token = jwt.sign({ id: testUserId, role: "student" }, secret, { expiresIn: "1h" });

async function testHttp() {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const sessionId = "HTTP_TEST_" + Date.now();

  console.log("=== TESTING POST /api/real-interview/technical/generate ===");
  const techRes = await fetch(`${BASE_URL}/api/real-interview/technical/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ sessionId, candidateProfile: { candidateName: "Test Student" } }),
  });
  console.log("Technical Status:", techRes.status);
  const techData = await techRes.json();
  console.log("Technical Response Body:", techData);

  console.log("\n=== TESTING POST /api/real-interview/project/generate ===");
  const projRes = await fetch(`${BASE_URL}/api/real-interview/project/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ sessionId, candidateProfile: { candidateName: "Test Student" } }),
  });
  console.log("Project Status:", projRes.status);
  const projData = await projRes.json();
  console.log("Project Response Body:", projData);
}

testHttp();
