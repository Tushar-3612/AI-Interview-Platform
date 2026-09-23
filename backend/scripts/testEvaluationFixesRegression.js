import { resolveAptitudeOptionLetter } from "../services/realInterview/aptitudeService.js";
import { resolveCandidateAnswer } from "../services/realInterview/answerResolver.js";
import { generateDeterministicTechnicalEvaluation } from "../services/realInterviewAI/deterministicEvaluator.js";

console.log("==================================================");
console.log("RUNNING REGRESSION TESTS FOR EVALUATION FIXES");
console.log("==================================================\n");

let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  [PASS] ${message}`);
  } else {
    console.error(`  [FAIL] ${message}`);
  }
}

// ---------------------------------------------------------------
// APTITUDE REGRESSION TESTS
// ---------------------------------------------------------------
console.log("--- PART 1: APTITUDE REGRESSION TESTS ---");

// Test 1: Option B with text
{
  const options = [
    { label: "A", text: "All men are mortal" },
    { label: "B", text: "Socrates is mortal" },
    { label: "C", text: "Socrates is a man" },
    { label: "D", text: "None of these" },
  ];
  const candidateStr = "Option B: Socrates is mortal";
  const correctAnswer = "B";
  const maxMarks = 2;

  const resolvedOpt = resolveAptitudeOptionLetter(candidateStr, options);
  const isCorrect = resolvedOpt === correctAnswer;
  const score = isCorrect ? maxMarks : 0;
  const status = isCorrect ? "CORRECT" : "INCORRECT";

  assert(resolvedOpt === "B", `Option letter extracted: expected 'B', got '${resolvedOpt}'`);
  assert(status === "CORRECT", `Status: expected 'CORRECT', got '${status}'`);
  assert(score === 2, `Score: expected 2, got ${score}`);
}

// Test 2: Option A with text "480"
{
  const options = [
    { label: "A", text: "480" },
    { label: "B", text: "520" },
    { label: "C", text: "600" },
    { label: "D", text: "720" },
  ];
  const candidateStr = "Option A: 480";
  const correctAnswer = "A";
  const maxMarks = 3;

  const resolvedOpt = resolveAptitudeOptionLetter(candidateStr, options);
  const isCorrect = resolvedOpt === correctAnswer;
  const score = isCorrect ? maxMarks : 0;
  const status = isCorrect ? "CORRECT" : "INCORRECT";

  assert(resolvedOpt === "A", `Option letter extracted: expected 'A', got '${resolvedOpt}'`);
  assert(status === "CORRECT", `Status: expected 'CORRECT', got '${status}'`);
  assert(score === 3, `Score: expected 3, got ${score}`);
}

// Test 3: Incorrect option chosen
{
  const options = [
    { label: "A", text: "Wrong Option" },
    { label: "B", text: "Right Option" },
  ];
  const candidateStr = "Option A: Wrong Option";
  const correctAnswer = "B";
  const maxMarks = 5;

  const resolvedOpt = resolveAptitudeOptionLetter(candidateStr, options);
  const isCorrect = resolvedOpt === correctAnswer;
  const score = isCorrect ? maxMarks : 0;
  const status = isCorrect ? "CORRECT" : "INCORRECT";

  assert(resolvedOpt === "A", `Option letter extracted: expected 'A', got '${resolvedOpt}'`);
  assert(status === "INCORRECT", `Status: expected 'INCORRECT', got '${status}'`);
  assert(score === 0, `Score: expected 0, got ${score}`);
}

// Test 4: Unanswered
{
  const options = [{ label: "A", text: "Yes" }, { label: "B", text: "No" }];
  const candidateStr = "";
  const correctAnswer = "A";
  const maxMarks = 2;

  const resolvedOpt = resolveAptitudeOptionLetter(candidateStr, options);
  const isAnswered = Boolean(resolvedOpt);
  const status = !isAnswered ? "NOT_ATTEMPTED" : resolvedOpt === correctAnswer ? "CORRECT" : "INCORRECT";
  const score = status === "CORRECT" ? maxMarks : 0;

  assert(status === "NOT_ATTEMPTED", `Status: expected 'NOT_ATTEMPTED', got '${status}'`);
  assert(score === 0, `Score: expected 0, got ${score}`);
}

// Test 5: resolveCandidateAnswer for Aptitude
{
  const res = resolveCandidateAnswer({
    roundType: "APTITUDE",
    questionId: "apt_1",
    questionText: "What is 2+2?",
    options: [{ label: "A", text: "3" }, { label: "B", text: "4" }],
    roundSessionAnswers: [{ questionId: "apt_1", candidateAnswer: "Option B: 4" }],
  });
  assert(res.answerPresent === true, "Aptitude answerPresent should be true");
  assert(res.selectedOption === "B", `Aptitude selectedOption should be 'B', got '${res.selectedOption}'`);
}

// ---------------------------------------------------------------
// TECHNICAL REGRESSION TESTS (DETERMINISTIC FALLBACK)
// ---------------------------------------------------------------
console.log("\n--- PART 2: TECHNICAL FALLBACK REGRESSION TESTS ---");

const techTestCases = [
  // 1. Python empty list
  {
    id: "q16",
    question: "How do you declare and initialize an empty list in Python?",
    expectedKnowledge: "Use square brackets my_list = [] or the list() constructor to create an empty list in Python.",
    candidateAnswer: "my_list = []",
    difficulty: "easy",
    maxScore: 3,
    expectedScore: 3,
    expectedStatus: "CORRECT",
  },
  // 2. SQL select all
  {
    id: "q17",
    question: "Write a SQL query to retrieve all columns and all rows from a table named 'Products'.",
    expectedKnowledge: "SELECT * FROM Products; retrieves all columns and rows from the Products table.",
    candidateAnswer: "select * from Products;",
    difficulty: "easy",
    maxScore: 3,
    expectedScore: 3,
    expectedStatus: "CORRECT",
  },
  // 3. Git status
  {
    id: "q18",
    question: "What is the primary Git command used to check the current status of your working directory and staging area?",
    expectedKnowledge: "Use git status to inspect modified, untracked, and staged files.",
    candidateAnswer: "git status",
    difficulty: "easy",
    maxScore: 3,
    expectedScore: 3,
    expectedStatus: "CORRECT",
  },
  // 4. Python def keyword
  {
    id: "q19",
    question: "In Python, what keyword is used to define a function?",
    expectedKnowledge: "The def keyword is used to define functions in Python (e.g., def my_function():).",
    candidateAnswer: "def",
    difficulty: "easy",
    maxScore: 3,
    expectedScore: 3,
    expectedStatus: "CORRECT",
  },
  // 5. Git commit -m
  {
    id: "q20",
    question: "What is the Git command used to save changes from the staging area to the repository, along with a descriptive message?",
    expectedKnowledge: "Use git commit -m \"message\" to record changes in repository history with a commit message.",
    candidateAnswer: 'git commit -m "message"',
    difficulty: "easy",
    maxScore: 3,
    expectedScore: 3,
    expectedStatus: "CORRECT",
  },
  // 6. Python dictionary access
  {
    id: "q21",
    question: "In Python, how do you access the value associated with a specific key in a dictionary?",
    expectedKnowledge: "Access dictionary values using square bracket notation dict['key'] or dict.get('key').",
    candidateAnswer: 'my_dict = {"name": "Tushar", "age": 21}\nprint(my_dict["name"])',
    difficulty: "easy",
    maxScore: 3,
    expectedScore: 3,
    expectedStatus: "CORRECT",
  },
  // 7. Conceptual partial answer (Node.js Event Loop)
  {
    id: "q22",
    question: "Explain the role of the Event Loop in Node.js and how it enables non-blocking I/O operations.",
    expectedKnowledge: "The Node.js event loop uses libuv to handle async non-blocking I/O across timers, poll, and check phases using a single execution thread and worker pool.",
    candidateAnswer: "The event loop in Node.js handles asynchronous operations in a non-blocking way using single thread and libuv.",
    difficulty: "medium",
    maxScore: 5,
    minScore: 2,
    expectedStatus: "PARTIALLY_CORRECT",
  },
  // 8. Completely wrong answer
  {
    id: "q23",
    question: "Explain the role of the Event Loop in Node.js and how it enables non-blocking I/O operations.",
    expectedKnowledge: "The Node.js event loop uses libuv to handle async non-blocking I/O across timers, poll, and check phases using a single execution thread and worker pool.",
    candidateAnswer: "Photoshop filters allow color adjustment on photographic images.",
    difficulty: "medium",
    maxScore: 5,
    expectedScore: 0,
    expectedStatus: "INCORRECT",
  },
  // 9. Unanswered question
  {
    id: "q24",
    question: "Explain AWS Security Group vs NACL.",
    expectedKnowledge: "Security groups are stateful and operate at instance level; NACLs are stateless at subnet level.",
    candidateAnswer: "(No answer submitted)",
    difficulty: "hard",
    maxScore: 13,
    expectedScore: 0,
    expectedStatus: "NOT_ATTEMPTED",
  },
];

const evalBatch = techTestCases.map((tc) => ({
  questionId: tc.id,
  question: tc.question,
  expectedKnowledge: tc.expectedKnowledge,
  candidateAnswer: tc.candidateAnswer,
  difficulty: tc.difficulty,
  maxScore: tc.maxScore,
}));

const evalResult = generateDeterministicTechnicalEvaluation(evalBatch, "Test regression harness");

evalTestCases: for (const tc of techTestCases) {
  const itemEval = evalResult.evaluations.find((e) => e.questionId === tc.id);
  const score = itemEval ? itemEval.score : -1;
  const isAnswered = tc.candidateAnswer && tc.candidateAnswer !== "(No answer submitted)";
  const status = !isAnswered
    ? "NOT_ATTEMPTED"
    : score >= tc.maxScore * 0.8
    ? "CORRECT"
    : score >= tc.maxScore * 0.4 || score > 0
    ? "PARTIALLY_CORRECT"
    : "INCORRECT";

  if (tc.expectedScore !== undefined) {
    assert(score === tc.expectedScore, `${tc.id} (${tc.candidateAnswer.slice(0, 20)}...): score expected ${tc.expectedScore}, got ${score}`);
  } else if (tc.minScore !== undefined) {
    assert(score >= tc.minScore, `${tc.id}: score expected >= ${tc.minScore}, got ${score}`);
  }

  assert(status === tc.expectedStatus, `${tc.id}: status expected '${tc.expectedStatus}', got '${status}'`);
}

console.log("\n==================================================");
console.log(`REGRESSION TEST SUMMARY: ${passedCount}/${totalCount} tests PASSED!`);
console.log("==================================================");
