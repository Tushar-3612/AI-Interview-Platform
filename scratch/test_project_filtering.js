import { isProjectOrientedQuestion } from "../backend/services/individualRound/technical/individualTechnicalAI.js";

const testCases = [
  // INVALID Project Questions (Must return TRUE)
  { text: "Explain how you implemented authentication in your project.", expected: true },
  { text: "Why did you use MongoDB in your project?", expected: true },
  { text: "How does your project architecture work?", expected: true },
  { text: "What challenges did you face while building your project?", expected: true },
  { text: "Why did you choose React for your project?", expected: true },
  { text: "Walk me through your project.", expected: true },
  { text: "How did you implement feature X in your project?", expected: text => true },

  // VALID Pure Technical Questions (Must return FALSE)
  { text: "What is method overloading in Java?", expected: false },
  { text: "What is the difference between an interface and an abstract class?", expected: false },
  { text: "Why is String immutable in Java?", expected: false },
  { text: "How does HashMap work internally?", expected: false },
  { text: "What is the difference between let, const, and var?", expected: false },
  { text: "What is a closure in JavaScript?", expected: false },
  { text: "How does the event loop work?", expected: false },
  { text: "What are React props?", expected: false },
  { text: "What is the purpose of useEffect?", expected: false },
  { text: "Why does React use a virtual DOM?", expected: false },
  { text: "What is middleware in Express.js?", expected: false },
  { text: "What is the difference between INNER JOIN and LEFT JOIN?", expected: false },
  { text: "What is a primary key?", expected: false },
  { text: "Why are database indexes used?", expected: false },
  { text: "How would you debug a Node.js API returning a 500 error?", expected: false },
  { text: "How would you optimize a slow SQL query?", expected: false },
  { text: "When would you choose a SQL database instead of MongoDB?", expected: false },
];

console.log("=== RUNNING PROJECT QUESTION FILTERING TESTS ===");
let passed = 0;
let failed = 0;

for (let i = 0; i < testCases.length; i++) {
  const tc = testCases[i];
  const actual = isProjectOrientedQuestion(tc.text);
  const expectedBool = typeof tc.expected === "function" ? tc.expected(actual) : tc.expected;

  if (actual === expectedBool) {
    passed++;
    console.log(`[PASS] Case #${i + 1}: "${tc.text}" -> isProject=${actual}`);
  } else {
    failed++;
    console.log(`[FAIL] Case #${i + 1}: "${tc.text}" -> Expected isProject=${expectedBool}, Actual=${actual}`);
  }
}

console.log(`\n=== SUMMARY: Passed ${passed}/${testCases.length}, Failed ${failed} ===`);
process.exit(failed > 0 ? 1 : 0);
