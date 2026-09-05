import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { mcqQuestions } from "./benchmark_data/mcqs.js";
import { technicalQuestions } from "./benchmark_data/technical.js";
import { codingQuestions } from "./benchmark_data/coding.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetDir = path.resolve(__dirname, "../data/companyMock/benchmark");

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

console.log("=== Generating Benchmark IT Solutions Question Bank ===");

// 1. Write mcq.json
const mcqPath = path.join(targetDir, "mcq.json");
fs.writeFileSync(mcqPath, JSON.stringify(mcqQuestions, null, 2), "utf8");
console.log(`Generated ${mcqQuestions.length} MCQs -> ${mcqPath}`);

// 2. Write technical.json
const techPath = path.join(targetDir, "technical.json");
fs.writeFileSync(techPath, JSON.stringify(technicalQuestions, null, 2), "utf8");
console.log(`Generated ${technicalQuestions.length} Technical/TITA questions -> ${techPath}`);

// 3. Write coding.json
const codingPath = path.join(targetDir, "coding.json");
fs.writeFileSync(codingPath, JSON.stringify(codingQuestions, null, 2), "utf8");
console.log(`Generated ${codingQuestions.length} Coding questions -> ${codingPath}`);

console.log("Question banks written successfully.");
