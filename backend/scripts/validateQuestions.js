import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, "../data/companyMock");

const companies = fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isDirectory());

const typePatterns = /^(mcq|technical|coding|aptitude|descriptive|conceptual|behavioral|hr)$/i;

let totalQuestions = 0;
let totalIssues = 0;
const issues = [];

for (const company of companies) {
  const companyDir = path.join(dir, company);
  const seenCompanyIds = new Set();

  // 1. Check technical.json
  const techFile = path.join(companyDir, "technical.json");
  if (fs.existsSync(techFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(techFile, "utf8"));
      const arr = Array.isArray(raw) ? raw : Array.isArray(raw.questions) ? raw.questions : [];

      for (let i = 0; i < arr.length; i++) {
        const q = arr[i];
        totalQuestions++;
        const qId = q.questionId || q.id || `index-${i}`;
        const prefix = `[${company}:technical] ${qId}`;

        if (!q.questionId && !q.id) {
          issues.push(`${prefix}: Missing questionId`);
          totalIssues++;
        }

        if (seenCompanyIds.has(qId)) {
          issues.push(`${prefix}: Duplicate questionId within ${company}`);
          totalIssues++;
        }
        seenCompanyIds.add(qId);

        if (!q.question || (typeof q.question === "string" && q.question.trim() === "")) {
          issues.push(`${prefix}: Missing or empty 'question' field`);
          totalIssues++;
        }

        if (q.question && typeof q.question === "string") {
          const qLower = q.question.trim().toLowerCase();
          if (typePatterns.test(qLower)) {
            issues.push(`${prefix}: 'question' contains only type label: '${q.question}'`);
            totalIssues++;
          }
          if (q.question.trim().length < 10) {
            issues.push(`${prefix}: 'question' is too short (${q.question.trim().length} chars): '${q.question}'`);
            totalIssues++;
          }
        }

        if (!q.questionType) {
          issues.push(`${prefix}: Missing 'questionType'`);
          totalIssues++;
        }

        const hasOptions = Array.isArray(q.options) && q.options.length > 0;
        const hasCorrectAnswer = !!q.correctAnswer && String(q.correctAnswer).trim() !== "";
        if (!hasOptions && !hasCorrectAnswer && (!q.expectedAnswer || String(q.expectedAnswer).trim() === "")) {
          issues.push(`${prefix}: Non-MCQ question missing 'expectedAnswer'`);
          totalIssues++;
        }

        if (q.difficulty && !["Easy", "Medium", "Hard"].includes(q.difficulty)) {
          issues.push(`${prefix}: Invalid difficulty '${q.difficulty}'`);
          totalIssues++;
        }

        if (company === "tcs" || company === "celebal" || company === "accenture" || company === "benchmark" || company === "capgemini" || company === "cognizant" || company === "deloitte" || company === "infosys") {
          const validMarks = { Easy: 2, Medium: 3, Hard: 5 };
          if (validMarks[q.difficulty] && q.marks !== validMarks[q.difficulty]) {
            issues.push(`${prefix}: Invalid marks (${q.marks}) for difficulty ${q.difficulty}, expected ${validMarks[q.difficulty]}`);
            totalIssues++;
          }
        }
      }
    } catch (e) {
      issues.push(`[${company}:technical] Failed to parse: ${e.message}`);
      totalIssues++;
    }
  }

  // 2. Check mcq.json
  const mcqFile = path.join(companyDir, "mcq.json");
  if (fs.existsSync(mcqFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(mcqFile, "utf8"));
      const arr = Array.isArray(raw) ? raw : Array.isArray(raw.questions) ? raw.questions : [];

      for (let i = 0; i < arr.length; i++) {
        const q = arr[i];
        totalQuestions++;
        const qId = q.questionId || q.id || `mcq-index-${i}`;
        const prefix = `[${company}:mcq] ${qId}`;

        if (!q.questionId && !q.id) {
          issues.push(`${prefix}: Missing questionId`);
          totalIssues++;
        }

        if (seenCompanyIds.has(qId)) {
          issues.push(`${prefix}: Duplicate questionId within ${company}`);
          totalIssues++;
        }
        seenCompanyIds.add(qId);

        if (!q.question || (typeof q.question === "string" && q.question.trim() === "")) {
          issues.push(`${prefix}: Missing or empty 'question' field`);
          totalIssues++;
        }

        if (!Array.isArray(q.options) || q.options.length < 2) {
          issues.push(`${prefix}: MCQ must have at least 2 options, got ${q.options?.length}`);
          totalIssues++;
        }

        if (q.correctAnswer === undefined || String(q.correctAnswer).trim() === "") {
          issues.push(`${prefix}: MCQ missing 'correctAnswer'`);
          totalIssues++;
        }

        if (q.difficulty && !["Easy", "Medium", "Hard"].includes(q.difficulty)) {
          issues.push(`${prefix}: Invalid difficulty '${q.difficulty}'`);
          totalIssues++;
        }

        if (company === "tcs" || company === "celebal" || company === "accenture" || company === "benchmark" || company === "capgemini" || company === "cognizant" || company === "deloitte" || company === "infosys") {
          const validMarks = { Easy: 2, Medium: 3, Hard: 5 };
          if (validMarks[q.difficulty] && q.marks !== validMarks[q.difficulty]) {
            issues.push(`${prefix}: Invalid marks (${q.marks}) for difficulty ${q.difficulty}, expected ${validMarks[q.difficulty]}`);
            totalIssues++;
          }
        }
      }
    } catch (e) {
      issues.push(`[${company}:mcq] Failed to parse: ${e.message}`);
      totalIssues++;
    }
  }

  // 3. Check coding.json
  const codingFile = path.join(companyDir, "coding.json");
  if (fs.existsSync(codingFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(codingFile, "utf8"));
      const arr = Array.isArray(raw) ? raw : Array.isArray(raw.questions) ? raw.questions : [];

      for (let i = 0; i < arr.length; i++) {
        const q = arr[i];
        totalQuestions++;
        const qId = q.questionId || q.id || `coding-index-${i}`;
        const prefix = `[${company}:coding] ${qId}`;

        if (!q.questionId && !q.id) {
          issues.push(`${prefix}: Missing questionId`);
          totalIssues++;
        }

        if (seenCompanyIds.has(qId)) {
          issues.push(`${prefix}: Duplicate questionId within ${company}`);
          totalIssues++;
        }
        seenCompanyIds.add(qId);

        if (!q.problemStatement && !q.description && !q.title) {
          issues.push(`${prefix}: Missing problem statement / description / title`);
          totalIssues++;
        }

        if (!Array.isArray(q.publicTestCases) || q.publicTestCases.length === 0) {
          issues.push(`${prefix}: Missing publicTestCases`);
          totalIssues++;
        }

        if (!Array.isArray(q.hiddenTestCases) || q.hiddenTestCases.length === 0) {
          issues.push(`${prefix}: Missing hiddenTestCases`);
          totalIssues++;
        }

        if (!q.starterCode) {
          issues.push(`${prefix}: Missing starterCode`);
          totalIssues++;
        }

        if (q.difficulty && !["Easy", "Medium", "Hard"].includes(q.difficulty)) {
          issues.push(`${prefix}: Invalid difficulty '${q.difficulty}'`);
          totalIssues++;
        }

        if (q.marks !== undefined) {
          if (typeof q.marks !== "number" || q.marks <= 0) {
            issues.push(`${prefix}: Coding marks must be a positive number, got ${q.marks}`);
            totalIssues++;
          }
          if ((company === "tcs" || company === "accenture" || company === "benchmark" || company === "capgemini" || company === "cognizant" || company === "deloitte" || company === "infosys") && q.marks !== 10) {
            issues.push(`${prefix}: ${company} Coding marks should be 10, got ${q.marks}`);
            totalIssues++;
          }
        }
      }
    } catch (e) {
      issues.push(`[${company}:coding] Failed to parse: ${e.message}`);
      totalIssues++;
    }
  }
}

console.log("=== Company Mock Question Validation (All Companies, MCQ + Technical + Coding) ===");
console.log(`Total questions scanned: ${totalQuestions}`);
console.log(`Total issues found: ${totalIssues}`);
console.log(`Companies scanned: ${companies.length}`);
console.log();
if (issues.length > 0) {
  console.log("Issues:");
  issues.forEach((i) => console.log("  - " + i));
  process.exit(1);
} else {
  console.log("All questions valid!");
  process.exit(0);
}
