import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { generateCodingAI } from "../backend/services/realInterviewAI/codingAI.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

async function test() {
  console.log("Testing generateCodingAI()...");
  const result = await generateCodingAI({
    candidateProfile: {
      fullName: "Tushar Nagare",
      skills: ["Python", "C++", "JavaScript", "Data Structures", "Algorithms"]
    },
    count: 3
  });
  console.log("Problems generated:", result.length);
  if (result && result.length >= 3) {
    result.forEach((p, idx) => {
      console.log(`\nProblem ${idx+1}: [${p.difficulty} | ${p.marks} marks] - ${p.title}`);
      console.log(`Description: ${p.description.slice(0, 100)}...`);
      console.log(`Languages supported: ${p.supportedLanguages.join(", ")}`);
      console.log(`Visible Test Cases: ${p.visibleTestCases.length}`);
      console.log(`Hidden Test Cases: ${p.hiddenTestCases.length}`);
    });
  }
}

test().catch(console.error);
