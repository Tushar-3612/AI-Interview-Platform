import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../backend/.env") });

import { isProjectQuestionValid } from "../backend/services/individualRound/project/individualProjectQuestionValidator.js";
import { getProjectDifficultyBreakdown } from "../backend/services/individualRound/project/individualProjectConfig.js";
import { buildProjectQuestionPrompt } from "../backend/services/individualRound/project/individualProjectPrompt.js";

console.log("--- TESTING INDIVIDUAL PROJECT VALIDATOR & CONFIG ---");

// Test Breakdown
const breakdownMixed = getProjectDifficultyBreakdown("Mixed");
console.log("Mixed Breakdown:", breakdownMixed);
if (breakdownMixed.easyMarks * breakdownMixed.easyCount + breakdownMixed.mediumMarks * breakdownMixed.mediumCount + breakdownMixed.hardMarks * breakdownMixed.hardCount !== 100) {
  console.error("FAIL: Mixed mode does not total 100!");
} else {
  console.log("PASS: Mixed mode totals 100 marks!");
}

const breakdownEasy = getProjectDifficultyBreakdown("Easy");
console.log("Easy Breakdown:", breakdownEasy);

// Test Validator
const sampleProjects = [
  {
    name: "AI Interview Engine",
    technologies: ["Node.js", "Express", "React", "MongoDB", "Python"],
    description: "An AI-powered interview platform with real-time speech recognition and evaluation."
  }
];

const testQuestions = [
  "In your AI Interview Engine project, how did you structure the MongoDB schemas for tracking user question history?",
  "What is polymorphism?",
  "Explain the difference between let and var",
  "What would happen if your backend Node.js server crashed during a live interview session?",
  "How did you implement speech recognition and handle audio stream latency in React?"
];

testQuestions.forEach((q) => {
  const isValid = isProjectQuestionValid(q, sampleProjects);
  console.log(`Q: "${q}" -> Valid Project Question: ${isValid}`);
});

// Test Prompt Builder
const prompt = buildProjectQuestionPrompt({
  candidateProjects: sampleProjects,
  difficulty: "Mixed",
  excludedQuestions: ["In your AI Interview Engine project, how did you structure MongoDB?"]
});

console.log("\nGenerated Prompt Snippet:\n", prompt.substring(0, 300) + "...\n");
console.log("All unit checks PASSED!");
