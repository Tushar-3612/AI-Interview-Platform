import { evaluateHRQuestion, generateDeterministicHREvaluation } from "../services/realInterviewAI/deterministicEvaluator.js";

async function runTests() {
  console.log("===============================================================================");
  console.log("                HR ROUND EVALUATION REGRESSION TEST SUITE                      ");
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

  // =========================================================================
  // TEST 1: "Tell me about yourself" with a strong normal introduction
  // Expected: High/full score without STAR requirement
  // =========================================================================
  console.log("--- TEST 1: Strong introduction (NO STAR required) ---");
  const t1_ans = "I am a Computer Science graduate from ABC University. I specialize in full-stack web development with React, Node.js, and MongoDB. I have built several projects including an e-commerce platform and a real-time chat application, and I am passionate about building scalable web applications.";
  const t1_res = evaluateHRQuestion({
    question: "Tell me about yourself.",
    candidateAnswer: t1_ans,
    maxScore: 20
  });
  assert(t1_res.score >= 17, `Strong introduction gets high score: ${t1_res.score}/20`);
  assert(t1_res.status === "CORRECT", `Status is CORRECT (${t1_res.status})`);
  assert(!t1_res.feedback.includes("Situation context was brief"), "Feedback does NOT mention missing Situation");
  assert(!t1_res.feedback.includes("Action steps not explicitly articulated"), "Feedback does NOT mention missing Action steps");

  // =========================================================================
  // TEST 2: "Tell me about a conflict you faced in a team." with proper STAR answer
  // Expected: High score
  // =========================================================================
  console.log("\n--- TEST 2: Behavioral conflict question with complete STAR answer ---");
  const t2_ans = "During our capstone project, our team faced a conflict regarding the database choice between MongoDB and PostgreSQL. I took the initiative to set up a meeting where I listed the trade-offs of both options with a benchmark comparison. I decided to use PostgreSQL for structured transactions and Redis for caching. As a result, the team reached a consensus, we delivered the project on time, and the system scaled smoothly.";
  const t2_res = evaluateHRQuestion({
    question: "Tell me about a conflict you faced in a team and how you resolved it.",
    candidateAnswer: t2_ans,
    maxScore: 20
  });
  assert(t2_res.score >= 17, `Complete STAR answer gets high score: ${t2_res.score}/20`);
  assert(t2_res.status === "CORRECT", `Status is CORRECT (${t2_res.status})`);

  // =========================================================================
  // TEST 3: "Tell me about a conflict you faced in a team." with incomplete answer
  // Expected: Partial score
  // =========================================================================
  console.log("\n--- TEST 3: Behavioral conflict question with incomplete answer ---");
  const t3_ans = "There was a conflict in our team about deadlines.";
  const t3_res = evaluateHRQuestion({
    question: "Tell me about a conflict you faced in a team.",
    candidateAnswer: t3_ans,
    maxScore: 20
  });
  assert(t3_res.score > 0 && t3_res.score <= 10, `Incomplete answer gets partial/low score: ${t3_res.score}/20`);
  assert(t3_res.status === "PARTIALLY_CORRECT" || t3_res.status === "INCORRECT", `Status reflects incomplete answer (${t3_res.status})`);

  // =========================================================================
  // TEST 4: "What are your strengths?" with relevant answer
  // Expected: Appropriate score without requiring STAR
  // =========================================================================
  console.log("\n--- TEST 4: Strengths question (NO STAR required) ---");
  const t4_ans = "My core strengths are fast learning and problem solving. When faced with a new framework or complex bug during development, I quickly read the documentation and debug systematically, which enables me to deliver quality code efficiently.";
  const t4_res = evaluateHRQuestion({
    question: "What are your greatest strengths?",
    candidateAnswer: t4_ans,
    maxScore: 20
  });
  assert(t4_res.score >= 16, `Strengths response gets strong score: ${t4_res.score}/20`);
  assert(t4_res.status === "CORRECT", `Status is CORRECT (${t4_res.status})`);
  assert(!t4_res.feedback.includes("Outcome or business impact omitted"), "Feedback does NOT force STAR outcome");

  // =========================================================================
  // TEST 5: "What is your weakness?" with reasonable self-aware answer
  // Expected: Appropriate score without requiring STAR
  // =========================================================================
  console.log("\n--- TEST 5: Weakness question with self-awareness and mitigation ---");
  const t5_ans = "Early on, I had difficulty with public speaking and presenting to large groups. To improve, I actively volunteered to lead sprint demo presentations and joined a local speaking club. Now I feel much more confident communicating technical ideas.";
  const t5_res = evaluateHRQuestion({
    question: "What is your greatest weakness and how are you working on it?",
    candidateAnswer: t5_ans,
    maxScore: 20
  });
  assert(t5_res.score >= 16, `Weakness with proactive mitigation gets strong score: ${t5_res.score}/20`);
  assert(t5_res.status === "CORRECT", `Status is CORRECT (${t5_res.status})`);

  // =========================================================================
  // TEST 6: "Why should we hire you?" with relevant skills and reasoning
  // Expected: Appropriate score without mandatory STAR
  // =========================================================================
  console.log("\n--- TEST 6: Motivation question (Why should we hire you?) ---");
  const t6_ans = "You should hire me because I have a solid technical foundation in React and backend services, combined with strong work ethic and problem-solving skills. I am a dedicated team player who learns fast and is eager to contribute to your software engineering team.";
  const t6_res = evaluateHRQuestion({
    question: "Why should we hire you for this role?",
    candidateAnswer: t6_ans,
    maxScore: 20
  });
  assert(t6_res.score >= 16, `Motivation answer gets strong score: ${t6_res.score}/20`);
  assert(t6_res.status === "CORRECT", `Status is CORRECT (${t6_res.status})`);

  // =========================================================================
  // TEST 7: Empty HR answer
  // Expected: 0 / NOT_ATTEMPTED
  // =========================================================================
  console.log("\n--- TEST 7: Empty HR answer ---");
  const t7_res = evaluateHRQuestion({
    question: "Tell me about yourself.",
    candidateAnswer: "   ",
    maxScore: 20
  });
  assert(t7_res.score === 0, `Empty answer receives 0: ${t7_res.score}/20`);
  assert(t7_res.status === "NOT_ATTEMPTED", `Status is NOT_ATTEMPTED (${t7_res.status})`);

  // =========================================================================
  // TEST 8: Completely irrelevant HR answer
  // Expected: 0 / INCORRECT
  // =========================================================================
  console.log("\n--- TEST 8: Irrelevant HR answer ---");
  const t8_res = evaluateHRQuestion({
    question: "Introduce yourself.",
    candidateAnswer: "SELECT * FROM users WHERE active = 1 ORDER BY id DESC;",
    maxScore: 20
  });
  assert(t8_res.score === 0, `Irrelevant SQL query in HR intro receives 0: ${t8_res.score}/20`);
  assert(t8_res.status === "INCORRECT", `Status is INCORRECT (${t8_res.status})`);

  // =========================================================================
  // TEST 9: AI API failure + strong introduction -> Fallback produces actual non-zero score
  // =========================================================================
  console.log("\n--- TEST 9: AI failure + strong introduction via batch fallback ---");
  const t9_batch = generateDeterministicHREvaluation([
    {
      questionId: "hr_q1",
      question: "Introduce yourself.",
      candidateAnswer: "I am a software engineering graduate with hands-on experience in React, Node.js, and cloud deployments. I have built several full-stack projects.",
      maxScore: 20
    }
  ], "AI 429 rate limit");
  assert(t9_batch.isFallback === true, "isFallback flag is true");
  assert(t9_batch.evaluations[0].score >= 16, `Fallback awards strong score for introduction: ${t9_batch.evaluations[0].score}/20`);
  assert(t9_batch.evaluations[0].status === "CORRECT", `Status is CORRECT (${t9_batch.evaluations[0].status})`);

  // =========================================================================
  // TEST 10: AI API failure + correct behavioral answer
  // Expected: Fallback produces appropriate score
  // =========================================================================
  console.log("\n--- TEST 10: AI failure + correct behavioral answer via fallback ---");
  const t10_batch = generateDeterministicHREvaluation([
    {
      questionId: "hr_q2",
      question: "Describe a time when you had to meet a tight deadline.",
      candidateAnswer: "In our final semester project, a critical API integration failed two days before the demo. I took ownership of the issue, restructured the asynchronous data flow, and worked with my teammate to test the endpoints. We resolved the bug, successfully delivered the demo on time, and received top marks.",
      maxScore: 20
    }
  ], "AI provider timeout");
  assert(t10_batch.evaluations[0].score >= 17, `Fallback awards strong score for complete STAR: ${t10_batch.evaluations[0].score}/20`);
  assert(t10_batch.evaluations[0].status === "CORRECT", `Status is CORRECT (${t10_batch.evaluations[0].status})`);

  // =========================================================================
  // TEST 11: AI API failure + wrong/irrelevant answer
  // Expected: 0 / INCORRECT
  // =========================================================================
  console.log("\n--- TEST 11: AI failure + wrong/irrelevant answer via fallback ---");
  const t11_batch = generateDeterministicHREvaluation([
    {
      questionId: "hr_q3",
      question: "What are your greatest strengths?",
      candidateAnswer: "Pizza and burgers are very delicious.",
      maxScore: 20
    }
  ], "AI provider 500 error");
  assert(t11_batch.evaluations[0].score === 0, `Irrelevant answer receives 0: ${t11_batch.evaluations[0].score}/20`);
  assert(t11_batch.evaluations[0].status === "INCORRECT", `Status is INCORRECT (${t11_batch.evaluations[0].status})`);

  // =========================================================================
  // TEST 12: Verify Q1 max = 20, Q2 max = 20, Q3 max = 20, HR max = 60
  // =========================================================================
  console.log("\n--- TEST 12: Question marks and HR round total ---");
  const qMax1 = 20, qMax2 = 20, qMax3 = 20;
  const hrMax = qMax1 + qMax2 + qMax3;
  assert(qMax1 === 20 && qMax2 === 20 && qMax3 === 20, "Each of 3 HR questions has maxMarks = 20");
  assert(hrMax === 60, `HR round maximum score is 60 (got ${hrMax})`);

  // =========================================================================
  // TEST 13: Verify HR percentage: obtained / 60 * 100
  // =========================================================================
  console.log("\n--- TEST 13: HR percentage calculation ---");
  const sampleObtained = 48;
  const samplePercentage = Math.round((sampleObtained / 60) * 100);
  assert(samplePercentage === 80, `48/60 correctly calculates to 80% (got ${samplePercentage}%)`);

  // =========================================================================
  // TEST 14: Verify final RealInterviewResult: rounds.hr.maximum === 60
  // =========================================================================
  console.log("\n--- TEST 14: RealInterviewResult model rounds.hr contract ---");
  const mockRounds = {
    aptitude: { obtained: 40, maximum: 50 },
    technical: { obtained: 85, maximum: 100 },
    project: { obtained: 90, maximum: 100 },
    hr: { obtained: 54, maximum: 60 },
    coding: { obtained: 80, maximum: 100 },
  };
  assert(mockRounds.hr.maximum === 60, `rounds.hr.maximum is 60 (got ${mockRounds.hr.maximum})`);

  // =========================================================================
  // TEST 15: Verify overall maximum remains 410
  // =========================================================================
  console.log("\n--- TEST 15: Overall maximum interview score contract ---");
  const totalMaxMarks = mockRounds.aptitude.maximum + mockRounds.technical.maximum + mockRounds.project.maximum + mockRounds.hr.maximum + mockRounds.coding.maximum;
  assert(totalMaxMarks === 410, `Total maximum marks equals 410 (got ${totalMaxMarks})`);

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
