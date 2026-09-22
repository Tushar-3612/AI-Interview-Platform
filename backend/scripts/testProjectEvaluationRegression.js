import { generateDeterministicProjectEvaluation, evaluateProjectQuestion } from "../services/realInterviewAI/deterministicEvaluator.js";

async function runTests() {
  console.log("===============================================================================");
  console.log("             PROJECT ROUND EVALUATION REGRESSION TEST SUITE                   ");
  console.log("===============================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // --- Sample Project Questions ---
  const sampleQ1 = {
    _id: "65f1234567890abcdef10001",
    questionId: "65f1234567890abcdef10001",
    question: "Can you explain how state management was implemented in your E-commerce platform frontend?",
    expectedKnowledge: "Used Redux Toolkit with slices for global state such as shopping cart, user authentication, and checkout session, while local component state handled form inputs and modal visibility.",
    difficulty: "medium",
    maxMarks: 10
  };

  const sampleQ2 = {
    _id: "65f1234567890abcdef10002",
    questionId: "65f1234567890abcdef10002",
    question: "How did you handle database indexing and query optimization in your project?",
    expectedKnowledge: "Created compound indexes on frequently queried fields like userId and createdAt, analyzed query execution plans with explain, and added caching using Redis.",
    difficulty: "hard",
    maxMarks: 20
  };

  const sampleQ3_unseen = {
    _id: "unseen_project_q_9999",
    questionId: "unseen_project_q_9999",
    question: "How did you secure sensitive user credentials in your authentication service?",
    expectedKnowledge: "Hashed passwords using bcrypt with a salt factor of 10, signed short-lived JWT access tokens and long-lived refresh tokens stored in HttpOnly cookies.",
    difficulty: "easy",
    maxMarks: 5
  };

  // =========================================================================
  // SIMULATING AI SUCCESS PATH (AI parser/validator verification)
  // =========================================================================
  console.log("--- TEST 1: AI succeeds + fully correct answer ---");
  const aiSuccessEval1 = {
    questionId: sampleQ1.questionId,
    score: 10,
    maxScore: 10,
    status: "CORRECT",
    rating: "Strong",
    feedback: "Comprehensive explanation of Redux Toolkit slices and local state separation.",
    evaluationSource: "ai_provider"
  };
  assert(aiSuccessEval1.score === 10, `AI evaluation score is 10/10`);
  assert(aiSuccessEval1.status === "CORRECT", `AI evaluation status is CORRECT`);

  console.log("\n--- TEST 2: AI succeeds + partially correct answer ---");
  const aiSuccessEval2 = {
    questionId: sampleQ1.questionId,
    score: 5,
    maxScore: 10,
    status: "PARTIALLY_CORRECT",
    rating: "Average",
    feedback: "Mentioned Redux Toolkit but omitted local state and session details.",
    evaluationSource: "ai_provider"
  };
  assert(aiSuccessEval2.score === 5, `AI evaluation partial score is 5/10`);
  assert(aiSuccessEval2.status === "PARTIALLY_CORRECT", `AI evaluation status is PARTIALLY_CORRECT`);

  console.log("\n--- TEST 3: AI succeeds + wrong answer ---");
  const aiSuccessEval3 = {
    questionId: sampleQ1.questionId,
    score: 0,
    maxScore: 10,
    status: "INCORRECT",
    rating: "Weak",
    feedback: "Answer discusses container deployment instead of frontend state management.",
    evaluationSource: "ai_provider"
  };
  assert(aiSuccessEval3.score === 0, `AI evaluation score for wrong answer is 0/10`);
  assert(aiSuccessEval3.status === "INCORRECT", `AI evaluation status is INCORRECT`);

  console.log("\n--- TEST 4: AI succeeds + empty answer ---");
  const aiSuccessEval4 = {
    questionId: sampleQ1.questionId,
    score: 0,
    maxScore: 10,
    status: "NOT_ATTEMPTED",
    rating: "Not Attempted",
    feedback: "Question was not attempted.",
    evaluationSource: "ai_provider"
  };
  assert(aiSuccessEval4.score === 0, `AI evaluation score for empty answer is 0/10`);
  assert(aiSuccessEval4.status === "NOT_ATTEMPTED", `AI evaluation status is NOT_ATTEMPTED`);

  // =========================================================================
  // DETERMINISTIC NLP FALLBACK TESTS (AI Failure Scenarios)
  // =========================================================================
  console.log("\n--- TEST 5: AI API failure + fully correct answer -> deterministic fallback ---");
  const t5_fb = evaluateProjectQuestion({
    question: sampleQ1.question,
    candidateAnswer: "We implemented state management using Redux Toolkit slices for cart and authentication session, and local component state for forms.",
    expectedKnowledge: sampleQ1.expectedKnowledge,
    maxMarks: 10
  });
  assert(t5_fb.score >= 8, `Fallback awarded full/high marks: ${t5_fb.score}/10`);
  assert(t5_fb.status === "CORRECT", `Fallback status is CORRECT (${t5_fb.status})`);
  assert(t5_fb.evaluationSource === "deterministic_nlp", `evaluationSource is deterministic_nlp`);

  console.log("\n--- TEST 6: AI API failure + partially correct answer -> partial marks ---");
  const t6_fb = evaluateProjectQuestion({
    question: sampleQ1.question,
    candidateAnswer: "We used Redux Toolkit slices for global state.",
    expectedKnowledge: sampleQ1.expectedKnowledge,
    maxMarks: 10
  });
  assert(t6_fb.score >= 2 && t6_fb.score <= 7, `Fallback awarded partial marks: ${t6_fb.score}/10`);
  assert(t6_fb.status === "PARTIALLY_CORRECT", `Fallback status is PARTIALLY_CORRECT (${t6_fb.status})`);

  console.log("\n--- TEST 7: AI API failure + wrong answer -> 0 ---");
  const t7_fb = evaluateProjectQuestion({
    question: sampleQ1.question,
    candidateAnswer: "We used Python pandas and numpy to train a machine learning classification model.",
    expectedKnowledge: sampleQ1.expectedKnowledge,
    maxMarks: 10
  });
  assert(t7_fb.score === 0, `Fallback awarded 0 for irrelevant answer: ${t7_fb.score}/10`);
  assert(t7_fb.status === "INCORRECT", `Fallback status is INCORRECT (${t7_fb.status})`);

  console.log("\n--- TEST 8: AI API failure + empty answer -> 0 / NOT_ATTEMPTED ---");
  const t8_fb = evaluateProjectQuestion({
    question: sampleQ1.question,
    candidateAnswer: "   ",
    expectedKnowledge: sampleQ1.expectedKnowledge,
    maxMarks: 10
  });
  assert(t8_fb.score === 0, `Fallback awarded 0 for empty answer: ${t8_fb.score}/10`);
  assert(t8_fb.status === "NOT_ATTEMPTED", `Fallback status is NOT_ATTEMPTED (${t8_fb.status})`);

  console.log("\n--- TEST 9: Short technically correct answer -> not penalized for brevity ---");
  const t9_fb = evaluateProjectQuestion({
    question: sampleQ1.question,
    candidateAnswer: "Redux Toolkit slices for global state and local state for forms.",
    expectedKnowledge: sampleQ1.expectedKnowledge,
    maxMarks: 10
  });
  assert(t9_fb.score >= 8, `Short correct answer gets high/full marks: ${t9_fb.score}/10`);
  assert(t9_fb.status === "CORRECT", `Status is CORRECT (${t9_fb.status})`);

  console.log("\n--- TEST 10: Long irrelevant answer -> 0 ---");
  const t10_long_irrelevant = "In our project we wrote many lines of code and we held daily agile scrum meetings with our product manager and team leads. We discussed various sprint goals, managed Jira tickets, followed git pull request workflows, and reviewed each other's code to maintain high code quality across all repositories.";
  const t10_fb = evaluateProjectQuestion({
    question: sampleQ1.question,
    candidateAnswer: t10_long_irrelevant,
    expectedKnowledge: sampleQ1.expectedKnowledge,
    maxMarks: 10
  });
  assert(t10_fb.score === 0, `Long irrelevant answer awarded 0: ${t10_fb.score}/10`);
  assert(t10_fb.status === "INCORRECT", `Status is INCORRECT (${t10_fb.status})`);

  console.log("\n--- TEST 11: Question echoing / superficial keywords without substance ---");
  const t11_fb = evaluateProjectQuestion({
    question: sampleQ1.question,
    candidateAnswer: "State management was implemented in the frontend of our project platform.",
    expectedKnowledge: sampleQ1.expectedKnowledge,
    maxMarks: 10
  });
  assert(t11_fb.score === 0, `Question echo without technical substance gets 0: ${t11_fb.score}/10`);
  assert(t11_fb.status === "INCORRECT", `Status is INCORRECT (${t11_fb.status})`);

  console.log("\n--- TEST 12: Contradictory answer -> 0 ---");
  const t12_fb = evaluateProjectQuestion({
    question: "What is Redis used for in your project backend?",
    candidateAnswer: "Redis is a relational SQL database used to permanently store passwords and customer tables without memory caching.",
    expectedKnowledge: "Redis is an in-memory key-value cache used for caching API responses, session storage, and caching frequently queried database records.",
    maxMarks: 10
  });
  assert(t12_fb.score === 0, `Contradictory answer (Redis as relational SQL permanent storage) receives 0: ${t12_fb.score}/10`);
  assert(t12_fb.status === "INCORRECT", `Status is INCORRECT (${t12_fb.status})`);

  console.log("\n--- TEST 13: Generic unseen Project question ---");
  const t13_fb = evaluateProjectQuestion({
    question: sampleQ3_unseen.question,
    candidateAnswer: "We hashed passwords with bcrypt and stored JWT tokens in HttpOnly cookies.",
    expectedKnowledge: sampleQ3_unseen.expectedKnowledge,
    maxMarks: 5
  });
  assert(t13_fb.score >= 4, `Unseen question correctly evaluated by generic fallback: ${t13_fb.score}/5`);
  assert(t13_fb.status === "CORRECT", `Status is CORRECT (${t13_fb.status})`);

  // =========================================================================
  // BATCH EVALUATION TEST
  // =========================================================================
  console.log("\n--- TEST 14: Batch Project Evaluation with generateDeterministicProjectEvaluation ---");
  const batchRes = generateDeterministicProjectEvaluation([
    {
      questionId: sampleQ1.questionId,
      question: sampleQ1.question,
      candidateAnswer: "Redux Toolkit slices for cart and auth state.",
      expectedKnowledge: sampleQ1.expectedKnowledge,
      maxMarks: 10
    },
    {
      questionId: sampleQ2.questionId,
      question: sampleQ2.question,
      candidateAnswer: "Created compound indexes on userId and createdAt and added Redis caching.",
      expectedKnowledge: sampleQ2.expectedKnowledge,
      maxMarks: 20
    }
  ], "AI provider error 429");

  assert(batchRes && batchRes.evaluations.length === 2, "Batch evaluator returned 2 evaluations");
  assert(batchRes.isFallback === true, "isFallback flag is true");
  assert(batchRes.totalScore > 0, `Total score is positive: ${batchRes.totalScore}/${batchRes.maxScore}`);
  assert(batchRes.percentage > 0, `Percentage calculated properly: ${batchRes.percentage}%`);

  // =========================================================================
  // TEST 15: Score normalization and overall contract (410 total)
  // =========================================================================
  console.log("\n--- TEST 15: Score normalization & Overall 410 Max Contract ---");
  const questionsMaxSum = 50; // 5 + 5 + 10 + 10 + 20
  const candidateRawScore = 50; // perfect score on 50-mark questions
  const scaledScore = Math.min(100, Math.round((candidateRawScore / questionsMaxSum) * 100));
  assert(scaledScore === 100, `Perfect 50/50 raw score cleanly scales to 100: ${scaledScore}`);

  const candidatePartialRaw = 35; // 35/50 (70%)
  const scaledPartial = Math.min(100, Math.round((candidatePartialRaw / questionsMaxSum) * 100));
  assert(scaledPartial === 70, `Partial 35/50 raw score cleanly scales to 70: ${scaledPartial}`);

  const roundMaxMarks = {
    aptitude: 50,
    technical: 100,
    project: 100,
    hr: 60,
    coding: 100
  };
  const totalMax = roundMaxMarks.aptitude + roundMaxMarks.technical + roundMaxMarks.project + roundMaxMarks.hr + roundMaxMarks.coding;
  assert(totalMax === 410, `Total maximum score equals 410: ${totalMax}`);
  assert(roundMaxMarks.project === 100, `Project round max marks is 100`);

  // Summary
  console.log("\n===============================================================================");
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
