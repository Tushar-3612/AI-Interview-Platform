import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { generateHRAI } from "../backend/services/realInterviewAI/hrAI.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

async function test() {
  console.log("Testing generateHRAI()...");
  const result = await generateHRAI({
    candidateProfile: {
      fullName: "Tushar Nagare",
      education: "Bachelor of Engineering in Computer Science",
      skills: ["Python", "JavaScript", "React", "Node.js", "Docker"],
      projects: ["AI-Powered Resume Parsing and Job Matching System", "Customer Churn Prediction System"]
    },
    count: 5
  });
  console.log("Questions generated:", result.length);
  if (result && result.length >= 5) {
    result.forEach((q, idx) => {
      console.log(`Q${idx+1}: [${q.difficulty}] ${q.question} (Marks: ${q.maxMarks})`);
    });
  }
}

test().catch(console.error);
