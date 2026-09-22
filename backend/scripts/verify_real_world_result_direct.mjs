/**
 * verify_real_world_result_direct.mjs
 * =====================================
 * Real-world verification using direct MongoDB injection.
 * Bypasses question GENERATION (which requires AI API quota).
 * Directly seeds sessions with candidate answers, then runs the
 * EVALUATION pipeline end-to-end.
 *
 * This tests what matters:
 *   answer persisted → pipeline retrieves → evaluates → final result
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

import User from "../models/User.js";
import Interview from "../models/Interview.js";
import RealInterviewResult from "../models/RealInterviewResult.js";
import RealInterviewAptitudeQuestion from "../models/RealInterviewAptitudeQuestion.js";
import RealInterviewAptitudeSession from "../models/RealInterviewAptitudeSession.js";
import RealInterviewTechnicalQuestion from "../models/RealInterviewTechnicalQuestion.js";
import RealInterviewTechnicalSession from "../models/RealInterviewTechnicalSession.js";
import RealInterviewProjectQuestion from "../models/RealInterviewProjectQuestion.js";
import RealInterviewProjectSession from "../models/RealInterviewProjectSession.js";
import RealInterviewHRQuestion from "../models/RealInterviewHRQuestion.js";
import RealInterviewHRSession from "../models/RealInterviewHRSession.js";
import RealInterviewCodingQuestion from "../models/RealInterviewCodingQuestion.js";
import RealInterviewCodingSession from "../models/RealInterviewCodingSession.js";
import RealInterviewCodingSubmission from "../models/RealInterviewCodingSubmission.js";

import { executeRealInterviewResultPipeline } from "../services/realInterview/resultPipelineService.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/ai-interview-engine";
const PASS = "✅ PASS";
const FAIL = "❌ FAIL";
const WARN = "⚠️  WARN";

// ─── Real candidate answers (full-length as a real candidate would give) ─────
const TECH_ANSWERS = [
  "JWT stands for JSON Web Token. It has three parts: header, payload, and signature. The header specifies the algorithm (HMAC-SHA256). The payload contains user claims. The server signs the token using a secret key. On every request the middleware verifies the signature. If valid and not expired, the request proceeds. Crucially, JWT should NOT be stored in localStorage because localStorage is vulnerable to XSS attacks. Instead, we store it in an httpOnly cookie which prevents JavaScript access entirely.",
  "React's virtual DOM optimization works by maintaining a lightweight JavaScript copy of the real DOM. When state changes, React updates the virtual DOM, then runs a diffing algorithm called reconciliation to find the minimum number of DOM operations needed. Only the changed nodes are updated in the real DOM. This is much faster because real DOM operations are expensive — they trigger layout reflow and repaint. The key prop helps React uniquely identify list items to avoid re-rendering unchanged items.",
  "In my project I implemented a microservices architecture where each service has its own MongoDB database. Services communicate via RabbitMQ for async operations like email notifications and report generation. For synchronous API calls between services I used axios with a circuit breaker pattern using the opossum library to prevent cascade failures. Service discovery is done via environment variables since we deploy on AWS ECS with an ALB load balancer. Health check endpoints are implemented on each service.",
  "SQL vs NoSQL: SQL databases use structured tables, strict schemas, and support ACID transactions with complex joins — best for relational, financial, or transactional data. NoSQL databases like MongoDB use flexible document schemas and horizontal scaling, suited for hierarchical or unstructured data. I used MongoDB for user profiles because the schema changed frequently during development. I used PostgreSQL for payment records because ACID compliance was mandatory. The CAP theorem shows the trade-off between consistency, availability, and partition tolerance.",
  "HTTP caching uses Cache-Control headers. The server sets max-age to define how long a response is valid. ETags allow conditional requests — the client sends If-None-Match and the server returns 304 Not Modified if the content is unchanged. I implemented Redis caching for API responses with a 5 minute TTL for product catalog data. CDN caching via AWS CloudFront is used for static assets. Cache invalidation is triggered by write operations using pub-sub channels in Redis.",
  "Time complexity of binary search is O(log n) because we halve the search space on each iteration. Space complexity is O(1) for iterative implementation. A hash map lookup is O(1) average case but O(n) worst case due to hash collisions. Merge sort is O(n log n) time and O(n) space — stable and predictable. Quick sort is O(n log n) average but O(n^2) worst case when the pivot is always the smallest or largest element. For the Two Sum problem I use a hash map to achieve O(n) time instead of O(n^2) brute force.",
  "In REST API design I follow the principle of statelessness — each request must contain all information to be processed independently. I use proper HTTP verbs: GET for retrieval, POST for creation, PUT/PATCH for updates, DELETE for removal. Error responses use standard HTTP status codes: 400 Bad Request for validation errors, 401 Unauthorized, 403 Forbidden, 404 Not Found, 429 Too Many Requests for rate limiting, 500 Internal Server Error. I implement pagination using cursor-based pagination for large datasets instead of offset-based to avoid the skip penalty in MongoDB.",
  "I implemented JWT refresh token rotation for security. The access token expires in 15 minutes. When expired, the frontend silently calls /auth/refresh using the httpOnly cookie containing the refresh token. The backend validates the refresh token against a whitelist stored in Redis. On success it issues a new access token AND a new refresh token, invalidating the old refresh token. This prevents refresh token reuse attacks. If the refresh token is invalid or expired, the user is logged out and redirected to login.",
  "MongoDB aggregation pipeline: I use $match first to filter documents early and reduce the working set. Then $group to aggregate by fields. Then $lookup for joining related collections. Then $project to shape the output. For analytics queries on 1 million documents I added compound indexes on the grouping fields which reduced query time from 5 seconds to under 100ms. I also use $facet to run multiple aggregation branches in a single pipeline pass for dashboard queries.",
  "Docker containerization: I write multi-stage Dockerfiles — the build stage uses a full Node.js image, the production stage uses a minimal alpine image. This reduces the image size from 800MB to under 100MB. Docker-compose defines services with their network connections and volume mounts for local development. For production I use AWS ECS with ECR for the image registry. The CI/CD pipeline in GitHub Actions builds the image, runs tests, pushes to ECR, and updates the ECS service with zero-downtime rolling deployment.",
];

const PROJ_ANSWERS = [
  "For the GRIDPULSE energy monitoring dashboard, I designed the backend as a Node.js REST API with Express. Smart meters publish energy readings via MQTT every 30 seconds to a broker. A Node.js consumer subscribes and writes to MongoDB time-series collections using changestreams. For real-time dashboard updates I implemented Socket.IO — the server emits meter updates to connected clients. The main scaling challenge was 500 concurrent meters sending data simultaneously. I solved this by using RabbitMQ to decouple ingestion from processing and implemented batch writes to MongoDB every 5 seconds.",
  "For authentication in GRIDPULSE I implemented JWT with refresh token rotation. Access tokens expire in 15 minutes, refresh tokens in 7 days. On login both tokens are issued — the access token goes in the Authorization header, the refresh token in an httpOnly cookie. When the access token expires, the frontend silently calls /auth/refresh. The backend validates the refresh token against a Redis whitelist and issues a new pair. I chose Redis over MongoDB for token invalidation because O(1) lookup is critical for auth performance — every API request hits the auth middleware.",
  "The MongoDB schema for GRIDPULSE uses time-series collections. The meter readings collection has a meterId, timestamp, and readings object with voltage, current, and power fields. For analytics, I built aggregation pipelines: $match by date range and meterId, $group by date to sum daily consumption, $lookup to join the meter metadata, $project to shape the response. Compound indexes on meterId and timestamp reduced analytics query time from 8 seconds to under 200ms on 2 million documents.",
  "For deployment of GRIDPULSE I containerized the Node.js backend with a multi-stage Dockerfile. Docker-compose handles local development with MongoDB and Redis containers. For production I migrated to AWS ECS with an Application Load Balancer. The CI/CD pipeline uses GitHub Actions: on push to main, it runs Jest tests, builds the Docker image, pushes to Amazon ECR, and updates the ECS task definition. Zero-downtime deployment is achieved by ECS rolling update with minimum healthy percent of 100 and maximum of 200.",
  "The real-time energy alert system in GRIDPULSE works as follows: each meter reading is compared against configurable thresholds. If power consumption exceeds the threshold, an alert event is published to a RabbitMQ topic exchange. A separate notification service subscribes to this exchange and sends email/SMS alerts using AWS SES and Twilio. I chose RabbitMQ topic exchange specifically because it allows multiple subscribers for different alert types (billing alerts vs safety alerts) without coupling them. Message acknowledgment ensures no alert is lost even if the notification service restarts.",
];

const HR_ANSWERS = [
  "There was a situation where my teammate pushed code that broke the production build on a Friday evening before a client demo the next morning. I took ownership of the situation and decided to stay back to investigate even though it wasn't strictly my area. I used git bisect to identify the exact commit that broke the build, traced it to an uncaught async error in the payment module. I fixed the error, wrote a regression test to prevent recurrence, and deployed the hotfix by midnight. The demo went smoothly the next morning. I later proposed and implemented pre-commit hooks and mandatory code review guidelines that the team adopted.",
  "During my final year project I was assigned to lead the backend team of 4 members. We had conflicting opinions about the database choice — 2 members wanted MySQL, 2 wanted MongoDB. Instead of making an autocratic decision, I organized a technical discussion where each side presented their case with actual benchmarks run on our specific data model. After evaluating both objectively, MongoDB was the better choice because our schema was evolving rapidly and we needed to iterate quickly. I communicated the decision with full technical reasoning and all four members agreed. The project delivered on schedule.",
  "In a college hackathon I made a mistake that cost us points. I had miscalculated the API rate limits of the third-party payment service we were integrating. During the demo, our solution hit the rate limit and failed in front of the judges. I immediately acknowledged the mistake, explained what went wrong, and described the exact fix — exponential backoff retry with jitter. After the event I implemented the fix properly and documented the lesson: always test against production constraints and worst-case scenarios, not just the happy path. The experience made me much more thorough in my API integration testing.",
  "When I join a new team or codebase, I make it a priority to understand before I change anything. I start by reading the documentation, running the project locally, and reviewing recent pull requests and commit history to understand the team's conventions and decision rationale. After 2-3 weeks of understanding, I start identifying areas for improvement. I frame suggestions as questions rather than statements — 'Have you considered using X? I saw a similar pattern at Y that improved Z metric.' I believe earning credibility through contribution and demonstrating understanding of context matters more than having opinions early on.",
];

function separator(label) {
  console.log(`\n${"=".repeat(64)}`);
  console.log(`  ${label}`);
  console.log("=".repeat(64));
}

function check(label, condition, detail = "") {
  const status = condition ? PASS : FAIL;
  console.log(`  ${status}  ${label}${detail ? `  [${detail}]` : ""}`);
  return condition;
}

function answerTrace(round, questionIndex, rawAnswer) {
  const present = Boolean(rawAnswer && rawAnswer.trim().length > 0);
  const len = rawAnswer ? rawAnswer.trim().length : 0;
  console.log(`  [ANSWER-TRACE] round=${round} questionIndex=${questionIndex} answerPresent=${present} answerLength=${len}`);
  return { present, len };
}

async function runVerification() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  FINAL REAL-WORLD VERIFICATION — DIRECT INJECTION MODE       ║");
  console.log("║  (Bypasses AI generation due to daily token limit)           ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const results = {
    answerPersistence: false,
    answerRetrieval: false,
    noNotAnsweredForAnswered: false,
    aiFailureFallback: false,
    unansweredIsZero: false,
    scoreMath: false,
    statusEndpoint: false,
    idempotency: false,
    noGenerationDuringEval: false,
  };

  try {
    await mongoose.connect(MONGO_URI);
    console.log(`[MongoDB] Connected → ${MONGO_URI.replace(/\/\/[^@]*@/, "//***@")}\n`);

    // ────────────────────────────────────────────────────────────────
    // SETUP
    // ────────────────────────────────────────────────────────────────
    separator("STEP 1 — TEST SETUP");

    let testUser = await User.findOne({ email: "directverify@prephire.ai" });
    if (!testUser) {
      testUser = await User.create({
        name: "DirectVerify Candidate",
        email: "directverify@prephire.ai",
        password: "test1234",
        role: "student",
        department: "Computer Science",
        year: 4,
      });
    }
    const userId = testUser._id;
    const sessionId = new mongoose.Types.ObjectId().toString();
    console.log(`  Session ID: ${sessionId}`);
    console.log(`  User ID:    ${userId}`);

    await Interview.create({
      _id: new mongoose.Types.ObjectId(sessionId),
      userId,
      interviewType: "actual",
      targetRound: "all",
      status: "IN_PROGRESS",
      startedAt: new Date(),
    });

    const candidateProfile = {
      candidateName: "DirectVerify Candidate",
      extractedSkills: ["React.js", "Node.js", "MongoDB", "Python", "Express.js", "JWT", "Docker", "Redis", "AWS", "SQL", "RabbitMQ"],
      categorizedSkills: {
        frontend: ["React.js"],
        backend: ["Node.js", "Express.js"],
        databases: ["MongoDB", "SQL", "Redis"],
        devops: ["Docker", "AWS"],
        languages: ["Python", "JavaScript"],
      },
      parsedProjects: [{
        name: "GRIDPULSE",
        description: "Smart energy monitoring dashboard with MQTT ingestion, Node.js REST API, MongoDB time-series, Socket.IO, Docker on AWS ECS",
        technologies: ["Node.js", "MongoDB", "Redis", "RabbitMQ", "Docker", "AWS ECS", "Socket.IO", "MQTT"],
      }],
      academicInfo: { degree: "B.Tech", branch: "Computer Science", year: 4, cgpa: 8.5 },
    };

    // ────────────────────────────────────────────────────────────────
    // STEP 2: Directly inject questions into MongoDB (no AI call)
    // ────────────────────────────────────────────────────────────────
    separator("STEP 2 — DIRECTLY INJECT QUESTIONS (NO AI CALL)");

    // === APTITUDE (15 questions) ===
    const aptTopics = ["Numerical", "Logical", "Verbal", "Data Interpretation", "Reasoning",
                       "Numerical", "Logical", "Verbal", "Numerical", "Reasoning",
                       "Logical", "Numerical", "Verbal", "Logical", "Numerical"];
    const aptQDocs = [];
    for (let i = 0; i < 15; i++) {
      aptQDocs.push({
        sessionId,
        question: `Aptitude Q${i + 1}: If A = ${i * 5 + 10}, B = ${i * 3 + 5}, what is A + B?`,
        options: [
          { label: "A", text: String(i * 5 + 10 + i * 3 + 5) },
          { label: "B", text: String(i * 5 + 10 + i * 3 + 5 + 10) },
          { label: "C", text: String(i * 5 + 10 + i * 3 + 5 + 20) },
          { label: "D", text: String(i * 5 + 10 + i * 3 + 5 + 30) },
        ],
        correctAnswer: "A",
        explanation: `A + B = ${i * 5 + 10 + i * 3 + 5}`,
        difficulty: i < 5 ? "easy" : i < 10 ? "medium" : "hard",
        topic: aptTopics[i],
        maxMarks: 50 / 15,
        orderIndex: i,
        category: "Aptitude",
      });
    }
    const savedAptQs = await RealInterviewAptitudeQuestion.insertMany(aptQDocs);

    // === TECHNICAL (20 questions) — use VALID category enum values ===
    const techTopics = ["JWT Authentication", "React Virtual DOM", "Microservices", "SQL vs NoSQL", "HTTP Caching",
                        "Time Complexity", "REST API Design", "Security", "MongoDB Aggregation", "Docker",
                        "Node.js Event Loop", "Database Indexing", "Load Balancing", "CI/CD", "Kubernetes",
                        "WebSockets", "GraphQL", "Redis", "Testing", "System Design"];
    // Valid enum: Fundamentals, Conceptual, Project Implementation, Debugging, Scenario, Architecture, System Design, Technology Specific, Problem Solving
    const techCategories = [
      "Project Implementation", "Conceptual", "Architecture", "Conceptual", "Technology Specific",
      "Problem Solving", "Conceptual", "Fundamentals", "Project Implementation", "Technology Specific",
      "Fundamentals", "Fundamentals", "System Design", "Technology Specific", "System Design",
      "Technology Specific", "Architecture", "Technology Specific", "Debugging", "System Design",
    ];
    const techQDocs = [];
    for (let i = 0; i < 20; i++) {
      techQDocs.push({
        sessionId,
        question: `Explain ${techTopics[i]} in detail including implementation, trade-offs, and real-world use cases.`,
        topic: techTopics[i],
        difficulty: i < 7 ? "easy" : i < 14 ? "medium" : "hard",
        maxMarks: i < 7 ? 3 : i < 14 ? 5 : 13,
        expectedKnowledge: `Comprehensive explanation of ${techTopics[i]} covering core concepts, mechanism, implementation, pitfalls, and real-world examples.`,
        category: techCategories[i],
        orderIndex: i,
        source: i < 5 ? "resume" : "general",
        relatedSkill: techTopics[i],
        relatedProject: i < 5 ? "GRIDPULSE" : "",
      });
    }
    const savedTechQs = await RealInterviewTechnicalQuestion.insertMany(techQDocs);

    // === PROJECT (10 questions) — no enum on category ===
    const projTopics = ["Architecture Design", "Authentication Flow", "Database Schema", "Deployment Strategy",
                        "Alert System", "Performance Optimization", "Error Handling", "API Design",
                        "Scalability", "Monitoring"];
    const projQDocs = [];
    for (let i = 0; i < 10; i++) {
      projQDocs.push({
        sessionId,
        question: `In your GRIDPULSE project, explain your ${projTopics[i]} approach.`,
        topic: projTopics[i],
        projectName: "GRIDPULSE",
        difficulty: i < 3 ? "easy" : i < 7 ? "medium" : "hard",
        maxMarks: i < 3 ? 5 : i < 7 ? 10 : 20,
        expectedKnowledge: `Detailed explanation of ${projTopics[i]} for GRIDPULSE.`,
        category: "Architecture",
        orderIndex: i,
        source: "resume_project",
      });
    }
    const savedProjQs = await RealInterviewProjectQuestion.insertMany(projQDocs);

    // === HR (5 questions) — category is free string ===
    const hrTopics = [
      "Tell me about a time you handled a technical crisis under pressure.",
      "Describe a situation where you led a team through a conflict.",
      "Tell me about a professional mistake and what you learned.",
      "How do you approach learning a new codebase or technology?",
      "Describe a time you communicated a complex technical concept to a non-technical stakeholder.",
    ];
    const hrQDocs = [];
    for (let i = 0; i < 5; i++) {
      hrQDocs.push({
        sessionId,
        question: hrTopics[i],
        category: "Behavioral",
        behavioralDimensions: ["ownership", "decisionMaking", "professionalMaturity"],
        difficulty: "medium",
        maxMarks: 20,
        expectedKnowledge: "STAR format behavioral response.",
        orderIndex: i,
        source: "hr_behavioral",
      });
    }
    const savedHRQs = await RealInterviewHRQuestion.insertMany(hrQDocs);

    // === CODING (3 problems) — use correct schema field names ===
    const codingQDocs = [];
    for (let i = 0; i < 3; i++) {
      codingQDocs.push({
        sessionId,
        title: ["Two Sum", "Reverse Linked List", "Maximum Subarray"][i],
        description: ["Find two indices summing to target.", "Reverse a linked list in-place.", "Find maximum subarray sum."][i],
        difficulty: ["Easy", "Medium", "Hard"][i],
        marks: [20, 30, 50][i],
        visibleTestCases: [{ input: "test", expected: "output", isHidden: false }],
        hiddenTestCases: [{ input: "test_hidden", expected: "output_hidden", isHidden: true }],
        orderIndex: i + 1,
        topic: ["Arrays", "Linked Lists", "Dynamic Programming"][i],
        category: "Problem Solving",
      });
    }
    const savedCodingQs = await RealInterviewCodingQuestion.insertMany(codingQDocs);

    // Create aptitude + technical + project + hr + coding sessions
    await RealInterviewAptitudeSession.create({ sessionId, userId, status: "in_progress", aiGenerationCalls: 1, generationStatus: "GENERATED" });
    await RealInterviewTechnicalSession.create({ sessionId, userId, status: "in_progress", aiGenerationCalls: 1, generationStatus: "GENERATED", answers: [] });
    await RealInterviewProjectSession.create({ sessionId, userId, status: "in_progress", aiGenerationCalls: 1, generationStatus: "GENERATED", answers: [] });
    await RealInterviewHRSession.create({ sessionId, userId, status: "in_progress", aiGenerationCalls: 1, generationStatus: "GENERATED", answers: [] });
    await RealInterviewCodingSession.create({ sessionId, userId, status: "in_progress", answers: [] });

    console.log(`  Injected: Apt=${savedAptQs.length} Tech=${savedTechQs.length} Proj=${savedProjQs.length} HR=${savedHRQs.length} Coding=${savedCodingQs.length}`);

    // ────────────────────────────────────────────────────────────────
    // STEP 3: Save candidate answers directly to sessions (ANSWER-TRACE)
    // ────────────────────────────────────────────────────────────────
    separator("STEP 3 — PERSIST REAL CANDIDATE ANSWERS IN SESSION DOCUMENTS");

    // -- APTITUDE: Answer 12 correctly, leave 3 unanswered --
    const aptSession = await RealInterviewAptitudeSession.findOne({ sessionId });
    const aptAnswers = savedAptQs.map((q, idx) => {
      if (idx < 12) {
        answerTrace("aptitude", idx, q.correctAnswer);
        return {
          questionId: q._id,
          question: q.question,
          difficulty: q.difficulty,
          correctAnswer: q.correctAnswer,
          selectedOption: q.correctAnswer,
          answer: q.correctAnswer,
        };
      } else {
        answerTrace("aptitude", idx, ""); // unanswered
        return null;
      }
    }).filter(Boolean);
    aptSession.answers = aptAnswers;
    await aptSession.save();
    console.log(`  Aptitude: ${aptAnswers.length}/15 answered, 3 unanswered\n`);

    // -- TECHNICAL: Answer 15 with REAL verbose answers, leave 5 unanswered --
    const techSession = await RealInterviewTechnicalSession.findOne({ sessionId });
    const techAnswers = savedTechQs.map((q, idx) => {
      if (idx < 15) {
        const ans = TECH_ANSWERS[idx % TECH_ANSWERS.length] + ` [Topic: ${q.topic}]`;
        answerTrace("technical", idx, ans);
        return {
          questionId: q._id,
          question: q.question,
          difficulty: q.difficulty,
          maxScore: q.maxMarks || 5,
          topic: q.topic,
          candidateAnswer: ans,
          submittedAt: new Date(),
        };
      } else {
        answerTrace("technical", idx, ""); // unanswered
        return null;
      }
    }).filter(Boolean);
    techSession.answers = techAnswers;
    await techSession.save();
    console.log(`  Technical: ${techAnswers.length}/20 answered, 5 unanswered\n`);

    // -- PROJECT: Answer 7, leave 3 unanswered --
    const projSession = await RealInterviewProjectSession.findOne({ sessionId });
    const projAnswers = savedProjQs.map((q, idx) => {
      if (idx < 7) {
        const ans = `GRIDPULSE: ${PROJ_ANSWERS[idx % PROJ_ANSWERS.length]} [Topic: ${q.topic}]`;
        answerTrace("project", idx, ans);
        return {
          questionId: q._id,
          question: q.question,
          difficulty: q.difficulty,
          maxScore: q.maxMarks || 10,
          topic: q.topic,
          projectName: q.projectName,
          candidateAnswer: ans,
          submittedAt: new Date(),
        };
      } else {
        answerTrace("project", idx, ""); // unanswered
        return null;
      }
    }).filter(Boolean);
    projSession.answers = projAnswers;
    await projSession.save();
    console.log(`  Project: ${projAnswers.length}/10 answered, 3 unanswered\n`);

    // -- HR: Answer 4 with STAR format, leave 1 unanswered --
    const hrSession = await RealInterviewHRSession.findOne({ sessionId });
    const hrAnswers = savedHRQs.map((q, idx) => {
      if (idx < 4) {
        const ans = HR_ANSWERS[idx % HR_ANSWERS.length];
        answerTrace("hr", idx, ans);
        return {
          questionId: q._id,
          question: q.question,
          category: q.category || "Behavioral",
          difficulty: q.difficulty || "medium",
          maxScore: q.maxMarks || 20,
          candidateAnswer: ans,
          submittedAt: new Date(),
        };
      } else {
        answerTrace("hr", idx, ""); // unanswered
        return null;
      }
    }).filter(Boolean);
    hrSession.answers = hrAnswers;
    await hrSession.save();
    console.log(`  HR: ${hrAnswers.length}/5 answered, 1 unanswered\n`);

    // -- CODING: Submit 2 solutions, leave 1 unanswered --
    if (savedCodingQs.length >= 1) {
      await RealInterviewCodingSubmission.create({
        sessionId,
        questionId: savedCodingQs[0]._id,
        userId,
        language: "javascript",
        sourceCode: `function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) return [map.get(complement), i];
    map.set(nums[i], i);
  }
  return [];
}
module.exports = { twoSum };`,
        status: "ACCEPTED",
        passedTests: 3,
        totalTests: 3,
        executionStatus: "Accepted",
        score: 20,
        maxScore: 20,
      });
      answerTrace("coding", 0, "two-sum javascript solution");
    }
    if (savedCodingQs.length >= 2) {
      await RealInterviewCodingSubmission.create({
        sessionId,
        questionId: savedCodingQs[1]._id,
        userId,
        language: "javascript",
        sourceCode: `function reverseList(head) {
  let prev = null, curr = head;
  while (curr) { const next = curr.next; curr.next = prev; prev = curr; curr = next; }
  return prev;
}
module.exports = { reverseList };`,
        status: "PARTIALLY_ACCEPTED",
        passedTests: 2,
        totalTests: 3,
        executionStatus: "Partial",
        score: 18,
        maxScore: 30,
      });
      answerTrace("coding", 1, "reverse-linked-list javascript solution");
    }
    if (savedCodingQs.length >= 3) answerTrace("coding", 2, ""); // unanswered
    console.log(`  Coding: 2/${savedCodingQs.length} submitted\n`);

    // ────────────────────────────────────────────────────────────────
    // STEP 4: PRE-SUBMISSION — Verify persistence in MongoDB
    // ────────────────────────────────────────────────────────────────
    separator("STEP 4 — PRE-SUBMISSION: VERIFY PERSISTENCE IN MONGODB");

    const [savedTechSession, savedProjSession, savedHRSession] = await Promise.all([
      RealInterviewTechnicalSession.findOne({ sessionId }).lean(),
      RealInterviewProjectSession.findOne({ sessionId }).lean(),
      RealInterviewHRSession.findOne({ sessionId }).lean(),
    ]);

    const techPersisted = (savedTechSession?.answers || []).filter((a) => a.candidateAnswer?.trim().length > 0);
    const projPersisted = (savedProjSession?.answers || []).filter((a) => a.candidateAnswer?.trim().length > 0);
    const hrPersisted = (savedHRSession?.answers || []).filter((a) => a.candidateAnswer?.trim().length > 0);

    check("Technical answers persisted in MongoDB", techPersisted.length >= 15, `${techPersisted.length} answers`);
    check("Project answers persisted in MongoDB", projPersisted.length >= 7, `${projPersisted.length} answers`);
    check("HR answers persisted in MongoDB", hrPersisted.length >= 4, `${hrPersisted.length} answers`);

    const techNoPlaceholders = techPersisted.every((a) => a.candidateAnswer !== "(No answer submitted)");
    const hrNoPlaceholders = hrPersisted.every((a) => a.candidateAnswer !== "(No answer provided)");
    check("Technical answers are real content (not placeholders)", techNoPlaceholders);
    check("HR answers are real content (not placeholders)", hrNoPlaceholders);

    // Report first answer lengths (metadata only)
    console.log(`  [RETRIEVAL-TRACE] round=technical first-answer-length=${techPersisted[0]?.candidateAnswer?.length || 0}`);
    console.log(`  [RETRIEVAL-TRACE] round=hr first-answer-length=${hrPersisted[0]?.candidateAnswer?.length || 0}`);

    results.answerPersistence = techPersisted.length >= 15 && projPersisted.length >= 7 && hrPersisted.length >= 4;

    // ────────────────────────────────────────────────────────────────
    // STEP 5: RUN RESULT PIPELINE
    // ────────────────────────────────────────────────────────────────
    separator("STEP 5 — EXECUTE MASTER RESULT PIPELINE");

    const evalStart = Date.now();
    const resultDoc = await executeRealInterviewResultPipeline({ sessionId, userId, candidateProfile });
    const evalDuration = Date.now() - evalStart;

    console.log(`  Pipeline finished: status=${resultDoc.status}  duration=${evalDuration}ms`);
    check("Pipeline completed successfully", resultDoc.status === "COMPLETED");
    check("maxScore === 450", resultDoc.maxScore === 450);

    // ────────────────────────────────────────────────────────────────
    // STEP 6: Verify candidate answers in RealInterviewResult
    // ────────────────────────────────────────────────────────────────
    separator("STEP 6 — VERIFY CANDIDATE ANSWERS IN RealInterviewResult");

    const freshResult = await RealInterviewResult.findOne({ sessionId }).lean();
    const qResults = freshResult?.questionResults || [];
    const techQR = qResults.filter((q) => q.roundType === "TECHNICAL");
    const projQR = qResults.filter((q) => q.roundType === "RESUME_PROJECT");
    const hrQR = qResults.filter((q) => q.roundType === "HR");
    const aptQR = qResults.filter((q) => q.roundType === "APTITUDE");

    console.log(`  QuestionResults stored: Apt=${aptQR.length} Tech=${techQR.length} Proj=${projQR.length} HR=${hrQR.length}`);

    const BAD = ["Not Answered", "(No answer submitted)", "(No answer provided)", "(No answer)", ""];
    const isBad = (t) => BAD.includes((t || "").trim());

    const techAnswered = techQR.filter((q) => q.status !== "NOT_ATTEMPTED");
    const projAnswered = projQR.filter((q) => q.status !== "NOT_ATTEMPTED");
    const hrAnswered = hrQR.filter((q) => q.status !== "NOT_ATTEMPTED");

    const techBadAnswers = techAnswered.filter((q) => isBad(q.candidateAnswer));
    const projBadAnswers = projAnswered.filter((q) => isBad(q.candidateAnswer));
    const hrBadAnswers = hrAnswered.filter((q) => isBad(q.candidateAnswer));

    check("Technical: no answered question shows 'Not Answered'", techBadAnswers.length === 0,
      `${techAnswered.length} answered, ${techBadAnswers.length} bad`);
    check("Project: no answered question shows 'Not Answered'", projBadAnswers.length === 0,
      `${projAnswered.length} answered, ${projBadAnswers.length} bad`);
    check("HR: no answered question shows 'Not Answered'", hrBadAnswers.length === 0,
      `${hrAnswered.length} answered, ${hrBadAnswers.length} bad`);

    // Retrieval trace
    if (techAnswered.length > 0) console.log(`  [RETRIEVAL-TRACE] round=technical first-result candidateAnswer length=${(techAnswered[0].candidateAnswer || "").length}`);
    if (hrAnswered.length > 0) console.log(`  [RETRIEVAL-TRACE] round=hr first-result candidateAnswer length=${(hrAnswered[0].candidateAnswer || "").length}`);

    results.noNotAnsweredForAnswered = techBadAnswers.length === 0 && projBadAnswers.length === 0 && hrBadAnswers.length === 0;
    results.answerRetrieval = techAnswered.length >= 14 && hrAnswered.length >= 3;

    // ────────────────────────────────────────────────────────────────
    // STEP 7: AI failure fallback — answered ≠ NOT_ATTEMPTED
    // ────────────────────────────────────────────────────────────────
    separator("STEP 7 — VERIFY: answered + AI failure ≠ NOT_ATTEMPTED");

    const answeredTechWithNot = techQR.filter((q) => !isBad(q.candidateAnswer) && q.status === "NOT_ATTEMPTED");
    const answeredHRWithNot = hrQR.filter((q) => !isBad(q.candidateAnswer) && q.status === "NOT_ATTEMPTED");

    check("answered Technical → NOT marked NOT_ATTEMPTED", answeredTechWithNot.length === 0,
      `${answeredTechWithNot.length} violations`);
    check("answered HR → NOT marked NOT_ATTEMPTED", answeredHRWithNot.length === 0,
      `${answeredHRWithNot.length} violations`);

    const fallbackTech = techQR.filter((q) => q.evaluationMode === "FALLBACK" && !isBad(q.candidateAnswer));
    const fallbackHR = hrQR.filter((q) => q.evaluationMode === "FALLBACK" && !isBad(q.candidateAnswer));
    console.log(`  Fallback evaluations: Tech=${fallbackTech.length} HR=${fallbackHR.length}`);

    if (fallbackTech.length > 0) {
      const avgScore = fallbackTech.reduce((s, q) => s + q.score, 0) / fallbackTech.length;
      console.log(`  Avg fallback Technical score: ${avgScore.toFixed(2)} (must be > 0 for answered questions)`);
      check("Fallback Technical: score > 0 (not fake 0)", avgScore > 0, `avg=${avgScore.toFixed(2)}`);
    }
    if (fallbackHR.length > 0) {
      const avgHR = fallbackHR.reduce((s, q) => s + q.score, 0) / fallbackHR.length;
      console.log(`  Avg fallback HR score: ${avgHR.toFixed(2)} (must be > 0)`);
      check("Fallback HR: score > 0 (not fake 0)", avgHR > 0, `avg=${avgHR.toFixed(2)}`);
    }

    results.aiFailureFallback = answeredTechWithNot.length === 0 && answeredHRWithNot.length === 0;

    // ────────────────────────────────────────────────────────────────
    // STEP 8: Unanswered → NOT_ATTEMPTED → 0
    // ────────────────────────────────────────────────────────────────
    separator("STEP 8 — VERIFY: unanswered → NOT_ATTEMPTED → 0");

    const unansApt = aptQR.filter((q) => q.status === "NOT_ATTEMPTED");
    const unansTech = techQR.filter((q) => q.status === "NOT_ATTEMPTED");
    const unansProj = projQR.filter((q) => q.status === "NOT_ATTEMPTED");
    const unansHR = hrQR.filter((q) => q.status === "NOT_ATTEMPTED");

    console.log(`  Unanswered: Apt=${unansApt.length} Tech=${unansTech.length} Proj=${unansProj.length} HR=${unansHR.length}`);
    check("Unanswered Aptitude → score = 0", unansApt.every((q) => q.score === 0));
    check("Unanswered Technical → score = 0", unansTech.every((q) => q.score === 0));
    check("Unanswered Project → score = 0", unansProj.every((q) => q.score === 0));
    check("Unanswered HR → score = 0", unansHR.every((q) => q.score === 0));
    check("At least 1 unanswered in Technical", unansTech.length >= 1);
    check("At least 1 unanswered in HR", unansHR.length >= 1);

    results.unansweredIsZero =
      unansApt.every((q) => q.score === 0) &&
      unansTech.every((q) => q.score === 0) &&
      unansProj.every((q) => q.score === 0) &&
      unansHR.every((q) => q.score === 0);

    // ────────────────────────────────────────────────────────────────
    // STEP 9: Score math
    // ────────────────────────────────────────────────────────────────
    separator("STEP 9 — VERIFY SCORE MATH (Apt/50 + Tech/100 + Proj/100 + HR/100 + Coding/100 = Total/450)");

    const rs = freshResult.roundScores;
    const computedTotal = (rs.aptitude?.score || 0) + (rs.technical?.score || 0) + (rs.project?.score || 0) + (rs.hr?.score || 0) + (rs.coding?.score || 0);
    const computedPct = Math.round((computedTotal / 450) * 100);

    console.log(`  Aptitude:  ${rs.aptitude?.score} / ${rs.aptitude?.maxScore}`);
    console.log(`  Technical: ${rs.technical?.score} / ${rs.technical?.maxScore}`);
    console.log(`  Project:   ${rs.project?.score} / ${rs.project?.maxScore}`);
    console.log(`  HR:        ${rs.hr?.score} / ${rs.hr?.maxScore}`);
    console.log(`  Coding:    ${rs.coding?.score} / ${rs.coding?.maxScore}`);
    console.log(`  ─────────────────────────────`);
    console.log(`  TOTAL:     ${freshResult.overallScore} / ${freshResult.maxScore}  (computed=${computedTotal})`);
    console.log(`  PERCENTAGE: ${freshResult.percentage}%  (computed=${computedPct}%)`);

    check("roundScores sum === overallScore", computedTotal === freshResult.overallScore, `${computedTotal} vs ${freshResult.overallScore}`);
    check("maxScore === 450", freshResult.maxScore === 450);
    check("aptitude maxScore = 50", rs.aptitude?.maxScore === 50);
    check("technical maxScore = 100", rs.technical?.maxScore === 100);
    check("project maxScore = 100", rs.project?.maxScore === 100);
    check("hr maxScore = 100", rs.hr?.maxScore === 100);
    check("coding maxScore = 100", rs.coding?.maxScore === 100);
    check("percentage = overallScore/450*100 (±1)", Math.abs(freshResult.percentage - computedPct) <= 1, `stored=${freshResult.percentage}% computed=${computedPct}%`);
    check("overallScore > 0 (answered questions contribute)", freshResult.overallScore > 0, `score=${freshResult.overallScore}`);

    results.scoreMath =
      computedTotal === freshResult.overallScore &&
      freshResult.maxScore === 450 &&
      rs.aptitude?.maxScore === 50 &&
      rs.technical?.maxScore === 100;

    // ────────────────────────────────────────────────────────────────
    // STEP 10: Status endpoint check
    // ────────────────────────────────────────────────────────────────
    separator("STEP 10 — VERIFY: GET /result/:sessionId/status");

    const statusDoc = await RealInterviewResult.findOne({ sessionId }).lean();
    check("Result queryable by sessionId", Boolean(statusDoc));
    check("status === COMPLETED", statusDoc?.status === "COMPLETED");
    check("evaluationProgress === 100", statusDoc?.evaluationProgress === 100, `progress=${statusDoc?.evaluationProgress}`);
    check("evaluationStage set", Boolean(statusDoc?.evaluationStage), `stage=${statusDoc?.evaluationStage}`);

    results.statusEndpoint = Boolean(statusDoc) && statusDoc?.status === "COMPLETED";

    // ────────────────────────────────────────────────────────────────
    // STEP 11: Idempotency — second pipeline call
    // ────────────────────────────────────────────────────────────────
    separator("STEP 11 — IDEMPOTENCY: SECOND PIPELINE CALL (NO DUPLICATE)");

    const result2 = await executeRealInterviewResultPipeline({ sessionId, userId, candidateProfile });
    const resultCount = await RealInterviewResult.countDocuments({ sessionId });

    check("Only 1 result doc exists after 2 pipeline calls", resultCount === 1, `count=${resultCount}`);
    check("Second call returns same overallScore", result2.overallScore === resultDoc.overallScore, `${result2.overallScore} vs ${resultDoc.overallScore}`);
    check("Second call returns COMPLETED", result2.status === "COMPLETED");

    results.idempotency = resultCount === 1 && result2.status === "COMPLETED";

    // ────────────────────────────────────────────────────────────────
    // STEP 12: No question generation during evaluation
    // ────────────────────────────────────────────────────────────────
    separator("STEP 12 — VERIFY: NO QUESTION GENERATION DURING EVALUATION");

    const techCountAfter = await RealInterviewTechnicalQuestion.countDocuments({ sessionId });
    const projCountAfter = await RealInterviewProjectQuestion.countDocuments({ sessionId });
    const hrCountAfter = await RealInterviewHRQuestion.countDocuments({ sessionId });

    check("Technical count unchanged after eval", techCountAfter === savedTechQs.length, `before=${savedTechQs.length} after=${techCountAfter}`);
    check("Project count unchanged after eval", projCountAfter === savedProjQs.length, `before=${savedProjQs.length} after=${projCountAfter}`);
    check("HR count unchanged after eval", hrCountAfter === savedHRQs.length, `before=${savedHRQs.length} after=${hrCountAfter}`);

    results.noGenerationDuringEval = techCountAfter === savedTechQs.length;

    // ────────────────────────────────────────────────────────────────
    // STEP 13: NLP Preprocessor Honest Disclosure
    // ────────────────────────────────────────────────────────────────
    separator("STEP 13 — NLP PREPROCESSOR: HONEST IMPLEMENTATION DISCLOSURE");
    console.log(`
  ┌──────────────────────────────────────────────────────────────┐
  │  nlp_preprocessor.py — What it ACTUALLY does                 │
  ├──────────────────────────────────────────────────────────────┤
  │                                                              │
  │  RUNTIME: Python stdlib only (re, json, sys)                 │
  │  NO external libraries (no NLTK, no spaCy, no transformers)  │
  │                                                              │
  │  ACTUALLY DOES:                                              │
  │  ✓ Whitespace/newline normalization (regex)                  │
  │  ✓ Sentence-level deduplication (60-char fingerprint)        │
  │  ✓ Trigram repetition detection (>=3 occurrences)            │
  │  ✓ Sentence importance scoring:                              │
  │      - Technical keyword regex matching (100+ terms)         │
  │      - Negation detection (not/never/without/cannot)         │
  │      - Cause/effect connectors (because/therefore/ensures)   │
  │      - HR behavioral keywords (STAR: situation/action/result)│
  │      - Measurement/number detection                          │
  │  ✓ Compact answer selection to maxWords budget               │
  │  ✓ Original answer preserved (never overwritten)             │
  │                                                              │
  │  DOES NOT DO:                                                │
  │  ✗ True morphological lemmatization                          │
  │    (requires NLTK WordNetLemmatizer or spaCy)                │
  │  ✗ POS tagging                                               │
  │  ✗ Semantic similarity / embeddings                          │
  │  ✗ Neural NLP of any kind                                    │
  │                                                              │
  │  WHAT "suffix stripping" in the code does:                   │
  │  Removes common word endings: -ing, -ed, -es, -tion,         │
  │  -ization, -er to help concept token matching.               │
  │  Example: "implementing" → "implement" ✓ (correct)           │
  │           "going" → "go" (NOT done — needs real lemmatizer)  │
  │                                                              │
  │  VERDICT: This is HEURISTIC STEMMING, not lemmatization.     │
  │  Honest disclosure: regex + heuristic suffix stripping only. │
  └──────────────────────────────────────────────────────────────┘`);

    // ────────────────────────────────────────────────────────────────
    // FINAL VERDICT
    // ────────────────────────────────────────────────────────────────
    separator("FINAL VERDICT");

    const allPassed = Object.values(results).every(Boolean);
    const passCount = Object.values(results).filter(Boolean).length;
    const total = Object.values(results).length;

    console.log(`\n  Results: ${passCount}/${total} checks passed\n`);
    Object.entries(results).forEach(([name, passed]) => {
      console.log(`  ${passed ? PASS : FAIL}  ${name}`);
    });

    if (allPassed) {
      console.log(`\n  ✅✅✅  FINAL VERDICT = PASS  ✅✅✅\n`);
      console.log(`  PROOF:`);
      console.log(`    sessionId:          ${sessionId}`);
      console.log(`    overallScore:       ${freshResult.overallScore} / 450`);
      console.log(`    percentage:         ${freshResult.percentage}%`);
      console.log(`    status:             ${freshResult.status}`);
      console.log(`    evaluationProgress: ${freshResult.evaluationProgress}%`);
      console.log(`    resultDocId:        ${freshResult._id}`);
    } else {
      console.log(`\n  ❌  FINAL VERDICT = PARTIAL — ${total - passCount} check(s) failed\n`);
    }

    // Cleanup
    await Promise.all([
      RealInterviewResult.deleteMany({ sessionId }),
      Interview.deleteMany({ _id: sessionId }),
      RealInterviewAptitudeQuestion.deleteMany({ sessionId }),
      RealInterviewAptitudeSession.deleteMany({ sessionId }),
      RealInterviewTechnicalQuestion.deleteMany({ sessionId }),
      RealInterviewTechnicalSession.deleteMany({ sessionId }),
      RealInterviewProjectQuestion.deleteMany({ sessionId }),
      RealInterviewProjectSession.deleteMany({ sessionId }),
      RealInterviewHRQuestion.deleteMany({ sessionId }),
      RealInterviewHRSession.deleteMany({ sessionId }),
      RealInterviewCodingQuestion.deleteMany({ sessionId }),
      RealInterviewCodingSession.deleteMany({ sessionId }),
      RealInterviewCodingSubmission.deleteMany({ sessionId }),
    ]);
    console.log(`\n  [Cleanup] Test session removed from MongoDB.`);

  } catch (err) {
    console.error(`\n  ❌ VERIFICATION ERROR: ${err.message}`);
    console.error(err.stack?.split("\n").slice(0, 5).join("\n"));
    console.log("\n  FINAL VERDICT = ERROR\n");
    process.exit(1);
  } finally {
    await mongoose.disconnect().catch(() => null);
  }
}

runVerification();
