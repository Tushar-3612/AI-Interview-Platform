import { isSemanticallyDuplicate, isDuplicateQuestion } from "../backend/services/realInterview/questionHistoryService.js";

console.log("=== RUNNING DUPLICATE DETECTION VERIFICATION TESTS ===");

const tests = [
  {
    name: "Test 1: Reordered words in let/var question",
    a: "What is the difference between let and var in JavaScript?",
    b: "What is the difference between var and let in JavaScript?",
    expectedDuplicate: true,
  },
  {
    name: "Test 2: Near duplicate rephrasing (middleware in Express)",
    a: "Why do we use middleware in Express.js?",
    b: "What is the purpose of middleware in Express?",
    expectedDuplicate: true,
  },
  {
    name: "Test 3: Minor wording change (indexes in MySQL)",
    a: "Why do we use indexes in MySQL?",
    b: "Why are indexes used in MySQL?",
    expectedDuplicate: true,
  },
  {
    name: "Test 4: Explain vs what are props (React props)",
    a: "Explain React props.",
    b: "What are props used for in React?",
    expectedDuplicate: true,
  },
  {
    name: "Test 5: Completely different questions (Primary Key vs Indexes)",
    a: "What is a primary key in MySQL?",
    b: "How do database indexes improve query performance?",
    expectedDuplicate: false,
  },
];

let passed = 0;
let failed = 0;

for (const t of tests) {
  const isDup = isSemanticallyDuplicate(t.a, t.b);
  const resultOk = isDup === t.expectedDuplicate;
  if (resultOk) {
    console.log(`[PASS] ${t.name}`);
    console.log(`       A: "${t.a}"`);
    console.log(`       B: "${t.b}"`);
    console.log(`       Detected duplicate=${isDup} (Expected=${t.expectedDuplicate})\n`);
    passed++;
  } else {
    console.error(`[FAIL] ${t.name}`);
    console.error(`       A: "${t.a}"`);
    console.error(`       B: "${t.b}"`);
    console.error(`       Detected duplicate=${isDup} (Expected=${t.expectedDuplicate})\n`);
    failed++;
  }
}

console.log(`=== SUMMARY: Passed ${passed}/${tests.length}, Failed ${failed} ===`);
if (failed > 0) process.exit(1);
