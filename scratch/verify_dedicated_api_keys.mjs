import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

console.log("\n=======================================================");
console.log("🔑 DEDICATED REAL INTERVIEW API KEY AUDIT");
console.log("=======================================================");

const keys = [
  { name: "Aptitude key", envVar: "REAL_INTERVIEW_APTITUDE_API_KEY" },
  { name: "Technical key", envVar: "REAL_INTERVIEW_TECHNICAL_API_KEY" },
  { name: "Project key", envVar: "REAL_INTERVIEW_PROJECT_API_KEY" },
  { name: "HR key", envVar: "REAL_INTERVIEW_HR_API_KEY" },
  { name: "Coding key", envVar: "REAL_INTERVIEW_CODING_API_KEY" },
];

keys.forEach(({ name, envVar }) => {
  const val = (process.env[envVar] || "").trim();
  console.log(`${name}: ${val ? "PRESENT" : "MISSING"}`);
});

console.log("=======================================================\n");
