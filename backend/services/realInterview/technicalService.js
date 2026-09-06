import {
  generateTechnicalAI,
  evaluateTechnicalInterviewAI,
} from "../realInterviewAI/technicalAI.js";
import RealInterviewTechnicalQuestion from "../../models/RealInterviewTechnicalQuestion.js";
import RealInterviewTechnicalSession from "../../models/RealInterviewTechnicalSession.js";
import Interview from "../../models/Interview.js";
import { withInFlightLock } from "./inFlightLock.js";
import {
  getUserQuestionHistorySet,
  recordUserQuestionHistory,
  filterUniqueQuestions,
  normalizeQuestionText,
} from "./questionHistoryService.js";
import { isQuestionGroundedInResume, getOrBuildCandidateResumeContext } from "../../utils/resumeContextBuilder.js";

const STATIC_TECHNICAL_FALLBACK = [
  { question: "Explain the difference between process and thread in operating systems, including memory sharing and context switching overhead.", expectedKnowledge: "Process has separate virtual memory space; threads share process heap and code segment with lower context switch cost.", difficulty: "easy", maxMarks: 3, topic: "Operating Systems", category: "Core Fundamentals", relatedSkill: "Operating Systems" },
  { question: "What is the Virtual DOM in React, and how does the reconciliation algorithm compute UI updates efficiently?", expectedKnowledge: "In-memory JS representation of real DOM; diffing algorithm compares trees and batches minimal real DOM mutations.", difficulty: "easy", maxMarks: 3, topic: "Frontend Development", category: "Frameworks", relatedSkill: "React" },
  { question: "Describe how indexing works in relational databases and MongoDB, specifically B-Tree vs Hash indexes.", expectedKnowledge: "B-Trees support range queries and order lookups; Hash indexes provide O(1) exact match lookups.", difficulty: "easy", maxMarks: 3, topic: "Databases", category: "Data Storage", relatedSkill: "MongoDB" },
  { question: "Explain the HTTP protocol lifecycle for a GET request from DNS resolution, TCP/TLS handshake, to response parsing.", expectedKnowledge: "DNS maps domain to IP; TCP 3-way handshake; TLS negotiation; HTTP GET sent and parsed by browser renderer.", difficulty: "easy", maxMarks: 3, topic: "Computer Networks", category: "Web Architecture", relatedSkill: "Networking" },
  { question: "How does asynchronous event loop execution work in Node.js? Detail call stack, event loop phases, and microtask queues.", expectedKnowledge: "Single thread stack; libuv handles I/O callbacks; process.nextTick and Promise microtasks run before timer/poll phases.", difficulty: "medium", maxMarks: 5, topic: "Node.js Architecture", category: "Backend Engineering", relatedSkill: "Node.js" },
  { question: "What are SOLID design principles? Explain Dependency Inversion and Single Responsibility with real code structure examples.", expectedKnowledge: "SRP: class has 1 reason to change; DIP: high-level modules depend on abstractions, not concrete implementations.", difficulty: "medium", maxMarks: 5, topic: "Software Design", category: "System Design", relatedSkill: "Software Architecture" },
  { question: "Explain the difference between SQL transactions (ACID properties) and eventual consistency in NoSQL systems (BASE).", expectedKnowledge: "ACID guarantees immediate strict consistency; BASE prioritizes availability and partition tolerance (CAP theorem).", difficulty: "medium", maxMarks: 5, topic: "Databases", category: "Data Storage", relatedSkill: "SQL" },
  { question: "How does JWT authentication work securely, and how do you mitigate XSS and CSRF risks when storing tokens?", expectedKnowledge: "Signed JSON tokens; store in HttpOnly SameSite cookies to mitigate XSS/CSRF theft; handle token expiration.", difficulty: "medium", maxMarks: 5, topic: "Web Security", category: "Security", relatedSkill: "Security" },
  { question: "Describe the memoization pattern in React using useMemo and useCallback. When does over-memoization hurt performance?", expectedKnowledge: "Caches calculated values and function references between re-renders; overhead exceeds benefits for cheap operations.", difficulty: "medium", maxMarks: 5, topic: "React Performance", category: "Frontend Engineering", relatedSkill: "React" },
  { question: "Explain database deadlock conditions and how transaction isolation levels (Read Committed vs Serializable) affect concurrency.", expectedKnowledge: "Deadlock occurs with cyclic lock wait; higher isolation levels prevent anomalies like phantom reads but reduce concurrency.", difficulty: "medium", maxMarks: 5, topic: "Databases", category: "Data Storage", relatedSkill: "Databases" },
  { question: "How do garbage collection algorithms (Generational Mark-and-Sweep) work in V8 JavaScript engine?", expectedKnowledge: "Scavenger collector handles short-lived young generation; Mark-Sweep-Compact handles old generation.", difficulty: "medium", maxMarks: 5, topic: "JavaScript Engine", category: "Language Mechanics", relatedSkill: "JavaScript" },
  { question: "What is CORS (Cross-Origin Resource Sharing), and why do browsers send preflight OPTIONS requests?", expectedKnowledge: "Browser security mechanism; preflight OPTIONS check permissions before non-simple HTTP requests across origins.", difficulty: "medium", maxMarks: 5, topic: "Web Security", category: "Networking", relatedSkill: "Web Architecture" },
  { question: "Explain Docker containerization vs Virtual Machines, highlighting OS kernel sharing and resource isolation mechanisms.", expectedKnowledge: "Containers share host OS kernel using cgroups/namespaces; VMs run full guest OS on hypervisor.", difficulty: "medium", maxMarks: 5, topic: "DevOps & Cloud", category: "Infrastructure", relatedSkill: "Docker" },
  { question: "Describe Redis caching strategies: Cache-Aside, Write-Through, and Write-Behind, along with cache eviction policies.", expectedKnowledge: "Cache-Aside checks cache first then DB; LRU/LFU evict keys when memory cap is reached.", difficulty: "medium", maxMarks: 5, topic: "System Architecture", category: "Caching", relatedSkill: "Redis" },
  { question: "How do WebSocket connections establish and maintain bidirectional real-time communication over HTTP Upgrade headers?", expectedKnowledge: "Starts with standard HTTP GET with Upgrade: websocket header; switches to full-duplex TCP framing.", difficulty: "medium", maxMarks: 5, topic: "Web Protocols", category: "Networking", relatedSkill: "Node.js" },
  { question: "Explain optimistic concurrency control vs pessimistic locking in high-throughput concurrent database operations.", expectedKnowledge: "Pessimistic locks resources on read; Optimistic uses version numbers/timestamps and validates before commit.", difficulty: "medium", maxMarks: 5, topic: "Databases", category: "Concurrency", relatedSkill: "Databases" },
  { question: "How do microservices implement distributed transaction management using the Saga Pattern (Choreography vs Orchestration)?", expectedKnowledge: "Local transactions with compensating events; Orchestration uses central coordinator; Choreography relies on event pub-sub.", difficulty: "hard", maxMarks: 13, topic: "Distributed Systems", category: "Architecture", relatedSkill: "System Design" },
  { question: "Design a rate-limiting algorithm for an API Gateway. Compare Token Bucket, Leaky Bucket, and Fixed/Sliding Window Log.", expectedKnowledge: "Token Bucket handles bursts; Leaky Bucket smooths rate; Sliding Window Log accurately limits requests per time window.", difficulty: "hard", maxMarks: 13, topic: "System Design", category: "API Gateway", relatedSkill: "System Design" },
  { question: "Explain how Message Queues (Kafka vs RabbitMQ) achieve message delivery guarantees (At-least-once, Exactly-once).", expectedKnowledge: "Kafka uses persistent append log with offset tracking and idempotent producers; RabbitMQ uses acknowledgments.", difficulty: "hard", maxMarks: 13, topic: "Messaging Systems", category: "Distributed Systems", relatedSkill: "Backend Engineering" },
  { question: "How do CDN edge networks optimize global latency using Anycast routing, SSL termination, and cache invalidation strategies?", expectedKnowledge: "Anycast routes request to geographically nearest POP; SSL terminated at edge; purge requests invalidate stale assets.", difficulty: "hard", maxMarks: 13, topic: "Cloud Architecture", category: "Performance", relatedSkill: "Cloud" },
  { question: "Explain Java Memory Model (JMM), Heap vs Stack allocation, and how volatile keyword guarantees visibility and ordering.", expectedKnowledge: "Stack holds thread execution frames; Heap holds object instances; volatile prevents instruction reordering.", difficulty: "easy", maxMarks: 3, topic: "Java Fundamentals", category: "Language Mechanics", relatedSkill: "Java" },
  { question: "How does HashMap work internally in Java? Detail bucket array, hashing collision resolution, and treeification in Java 8.", expectedKnowledge: "Uses hash() modulo capacity; collisions handled via linked list, converted to Red-Black tree when threshold exceeded.", difficulty: "medium", maxMarks: 5, topic: "Java Collections", category: "Data Structures", relatedSkill: "Java" },
  { question: "Describe React Server Components (RSC) vs Client Components. How does streaming SSR reduce Time-to-Interactive?", expectedKnowledge: "RSC render exclusively on server sending zero JS bundle to client; streaming SSR sends HTML chunks early.", difficulty: "medium", maxMarks: 5, topic: "React Architecture", category: "Frontend Engineering", relatedSkill: "React" },
  { question: "Explain PostgreSQL MVCC (Multi-Version Concurrency Control) and how tuple versioning prevents read locks during writes.", expectedKnowledge: "Writes create new row versions (tuples) with xmin/xmax timestamps, allowing concurrent reads without blocking.", difficulty: "medium", maxMarks: 5, topic: "Relational Databases", category: "Data Storage", relatedSkill: "SQL" },
  { question: "How do Python GIL (Global Interpreter Lock) constraints affect multithreading vs multiprocessing for CPU-bound tasks?", expectedKnowledge: "GIL allows only 1 OS thread to execute Python bytecode at once; CPU tasks require multiprocessing or C extensions.", difficulty: "medium", maxMarks: 5, topic: "Python Core", category: "Language Mechanics", relatedSkill: "Python" },
  { question: "Explain GraphQL query execution, resolver functions, and N+1 query problem resolution using DataLoader caching.", expectedKnowledge: "Resolvers evaluate fields hierarchically; DataLoader batches individual ID queries into single SQL IN clause.", difficulty: "medium", maxMarks: 5, topic: "API Architecture", category: "Backend Engineering", relatedSkill: "API Design" },
  { question: "How do CSS Layout engines compute Flexbox vs Grid containers, and when would you choose CSS Grid over Flexbox?", expectedKnowledge: "Flexbox is 1-dimensional content-driven layout; CSS Grid is 2-dimensional structural layout.", difficulty: "easy", maxMarks: 3, topic: "Frontend Layout", category: "Frameworks", relatedSkill: "React" },
  { question: "Explain OAuth 2.0 Authorization Code Flow with PKCE (Proof Key for Code Exchange) for public single-page applications.", expectedKnowledge: "SPAs generate code_verifier and code_challenge; authorization server exchanges code + verifier for tokens.", difficulty: "hard", maxMarks: 13, topic: "Web Security", category: "Security", relatedSkill: "Security" },
  { question: "How does Connection Pooling (e.g. HikariCP / Mongoose Connection Pool) optimize database socket reuse under high load?", expectedKnowledge: "Maintains pre-allocated DB sockets; eliminates TCP 3-way handshake overhead per HTTP request.", difficulty: "medium", maxMarks: 5, topic: "Database Optimization", category: "Performance", relatedSkill: "MongoDB" },
  { question: "Describe MongoDB Aggregation Pipeline stages ($match, $group, $lookup, $unwind) and indexing requirements for pipeline performance.", expectedKnowledge: "$match should be first stage to utilize indexes; $lookup performs left outer joins across collections.", difficulty: "medium", maxMarks: 5, topic: "MongoDB Data Analytics", category: "Data Storage", relatedSkill: "MongoDB" },
  { question: "Explain C++ RAII (Resource Acquisition Is Initialization) and how smart pointers (std::unique_ptr, std::shared_ptr) prevent memory leaks.", expectedKnowledge: "Object lifecycle binds resource cleanup to destructor invocation; shared_ptr uses reference counting.", difficulty: "medium", maxMarks: 5, topic: "C++ Memory Management", category: "Core Fundamentals", relatedSkill: "C++" },
  { question: "How do Kubernetes Pods implement sidecar pattern containers for logging, metrics collection, and proxying?", expectedKnowledge: "Sidecar containers share network namespace and storage volumes with main application container in same Pod.", difficulty: "hard", maxMarks: 13, topic: "Cloud Native Architecture", category: "Infrastructure", relatedSkill: "DevOps" },
  { question: "Design an Idempotent API endpoint for payment processing. How do client-provided Idempotency Keys prevent double charges?", expectedKnowledge: "Client sends unique key header; server records key state in Redis/DB; retried requests return cached response.", difficulty: "hard", maxMarks: 13, topic: "API Design", category: "System Design", relatedSkill: "System Design" },
  { question: "Explain browser critical rendering path: DOM, CSSOM, Render Tree, Layout, and Paint steps for optimizing FPS.", expectedKnowledge: "HTML creates DOM; CSS creates CSSOM; combined into Render Tree; Layout calculates geometry; Paint draws pixels.", difficulty: "easy", maxMarks: 3, topic: "Browser Performance", category: "Frontend Engineering", relatedSkill: "React" },
  { question: "How do TLS 1.3 handshakes complete in 1-RTT compared to 2-RTT in TLS 1.2, and how does 0-RTT resumption work?", expectedKnowledge: "TLS 1.3 combines key exchange parameters into initial ClientHello, cutting round-trip latency in half.", difficulty: "hard", maxMarks: 13, topic: "Networking & Security", category: "Web Architecture", relatedSkill: "Networking" }
];

/**
 * Generates or retrieves existing 20 Technical questions for a Real Interview session (AI CALL #1).
 * Enforces IDEMPOTENCY: Does NOT re-generate questions if aiGenerationCalls >= 1 or 20 questions already exist for sessionId.
 */
export async function generateAndProcessTechnicalQuestions({
  userId = null,
  sessionId = null,
  candidateProfile = {},
} = {}) {
  if (!sessionId) {
    throw new Error("sessionId is required for technical question generation");
  }

  const lockKey = `technical:${sessionId}`;
  return withInFlightLock(lockKey, async () => {
    let session = await RealInterviewTechnicalSession.findOne({ sessionId });

    const existingQuestions = await RealInterviewTechnicalQuestion.find({ sessionId }).sort({
      orderIndex: 1,
    });

  if (
    (session && (session.aiGenerationCalls >= 1 || session.generationStatus === "GENERATED")) ||
    existingQuestions.length >= 20
  ) {
    console.log(
      `[TechnicalService] Session ${sessionId} already generated (${existingQuestions.length} questions, aiGenerationCalls: ${session?.aiGenerationCalls || 1}). Reusing existing questions without AI call.`
    );

    if (!session) {
      session = await RealInterviewTechnicalSession.create({
        sessionId,
        userId,
        currentQuestionIndex: 0,
        strongAnswerCount: 0,
        hardUnlocked: false,
        questionsAnswered: 0,
        answers: [],
        status: "in_progress",
        generationStatus: "GENERATED",
        aiGenerationCalls: 1,
      });
    }

    const studentQuestions = existingQuestions.map((q) => ({
      id: q._id.toString(),
      question: q.question,
      difficulty: q.difficulty,
      maxMarks: q.maxMarks || (q.difficulty === "easy" ? 3 : q.difficulty === "hard" ? 13 : 5),
      topic: q.topic,
      category: q.category,
      source: q.source,
      relatedSkill: q.relatedSkill,
      relatedProject: q.relatedProject,
    }));

    return {
      success: true,
      message: "Reused existing 20 technical questions",
      count: studentQuestions.length,
      questions: studentQuestions,
      reused: true,
      aiGenerationCalls: session.aiGenerationCalls || 1,
    };
  }

  console.log(`[TechnicalService] Making AI CALL #1 for session ${sessionId}...`);
  const effectiveProfile = await getOrBuildCandidateResumeContext(userId, candidateProfile);
  let aiResult;
  const userHistorySet = await getUserQuestionHistorySet(userId);

  try {
    aiResult = await generateTechnicalAI(effectiveProfile);
  } catch (genErr) {
    console.warn(`[TechnicalService] AI generation call warning (${genErr.message}). Using fault-tolerant technical question pool.`);
    aiResult = { questions: [] };
  }

  const currentPoolSet = new Set();
  const rawAiQuestions = (aiResult?.questions || []).filter((q) => isQuestionGroundedInResume(q, "technical", effectiveProfile));
  let rawQuestions = filterUniqueQuestions(rawAiQuestions, userHistorySet, currentPoolSet);
  rawQuestions.forEach((q) => { q.source = q.source || "ai_generated"; });

  if (rawQuestions.length < 20) {
    console.log(`[TechnicalService] AI returned ${rawQuestions.length}/20 grounded unique questions. Using static fallback pool for remainder.`);

    const fallbackGrounded = STATIC_TECHNICAL_FALLBACK.filter((fbQ) => isQuestionGroundedInResume(fbQ, "technical", effectiveProfile));
    const fallbackUnique = filterUniqueQuestions(fallbackGrounded, userHistorySet, currentPoolSet);

    // Pass 1: Try non-historical grounded fallbacks
    for (const fbQ of fallbackUnique) {
      if (rawQuestions.length >= 20) break;
      currentPoolSet.add(normalizeQuestionText(fbQ.question));
      rawQuestions.push({ ...fbQ, source: "static_fallback" });
    }

    // Pass 2: If still < 20, fill from static pool ignoring history (only current session unique)
    if (rawQuestions.length < 20) {
      for (const fbQ of STATIC_TECHNICAL_FALLBACK) {
        if (rawQuestions.length >= 20) break;
        const norm = normalizeQuestionText(fbQ.question);
        if (!currentPoolSet.has(norm)) {
          currentPoolSet.add(norm);
          rawQuestions.push({ ...fbQ, source: "static_fallback" });
        }
      }
    }

    // Pass 3: Dynamic templates for candidate skills
    if (rawQuestions.length < 20) {
      const candidateSkillsList = effectiveProfile.skills?.length
        ? effectiveProfile.skills
        : ["Python", "JavaScript", "SQL", "React", "Node.js"];

      const DYNAMIC_SKILL_TEMPLATES = [
        (s) => ({
          question: `What are the primary use cases, core features, and practical implementation patterns when working with ${s}?`,
          expectedKnowledge: `Explain the core concepts of ${s}, its main use cases, code organization, and integration into modern applications.`,
          difficulty: "medium",
          topic: s,
          category: "Technology Specific",
          relatedSkill: s,
          source: "static_fallback"
        }),
        (s) => ({
          question: `What are the best practices for performance optimization, testing, and debugging when building with ${s}?`,
          expectedKnowledge: `Cover performance bottlenecks, resource management, unit/integration testing strategies, and standard debugging techniques for ${s}.`,
          difficulty: "medium",
          topic: s,
          category: "Debugging",
          relatedSkill: s,
          source: "static_fallback"
        }),
        (s) => ({
          question: `How do you handle error management, state or data consistency, and edge cases when utilizing ${s}?`,
          expectedKnowledge: `Detail error boundaries/handlers, data validation mechanisms, edge case management, and maintainability for ${s}.`,
          difficulty: "medium",
          topic: s,
          category: "Project Implementation",
          relatedSkill: s,
          source: "static_fallback"
        }),
        (s) => ({
          question: `What are the key advantages, potential trade-offs, and alternative choices when using ${s}?`,
          expectedKnowledge: `Compare ${s} with alternative tools/libraries, detailing trade-offs in performance, developer productivity, and ecosystem fit.`,
          difficulty: "medium",
          topic: s,
          category: "Architecture",
          relatedSkill: s,
          source: "static_fallback"
        }),
      ];

      for (const skill of candidateSkillsList) {
        if (rawQuestions.length >= 20) break;
        for (const templateFn of DYNAMIC_SKILL_TEMPLATES) {
          if (rawQuestions.length >= 20) break;
          const qObj = templateFn(skill);
          const norm = normalizeQuestionText(qObj.question);
          if (!currentPoolSet.has(norm)) {
            currentPoolSet.add(norm);
            rawQuestions.push(qObj);
          }
        }
      }
    }
  }

  const selectedQuestions = rawQuestions.slice(0, 20);
  const fallbackUsed = selectedQuestions.some((q) => q.source === "static_fallback");
  const aiCount = selectedQuestions.filter((q) => q.source === "ai_generated").length;

  console.log(
    `\n[REAL-INTERVIEW][QUESTION-SOURCE]\nround=technical\nsource=${fallbackUsed ? (aiCount > 0 ? "partial_static_fallback" : "static_fallback") : "ai_generated"}\nresumeContext=${Boolean(effectiveProfile && (effectiveProfile.skills?.length > 0 || effectiveProfile.projects?.length > 0))}\nreason=${fallbackUsed ? `AI generated ${aiCount}/20 grounded questions` : "AI generated 20 grounded questions successfully"}\n`
  );

  const validatedDocs = selectedQuestions.map((q, idx) => {
    const questionText = String(q.question || "").trim();
    if (!questionText) {
      throw new Error(`Technical Question #${idx + 1} has empty question text`);
    }

    const topic = String(q.topic || "General Technical").trim();
    const expectedKnowledge = String(
      q.expectedKnowledge ||
        q.expected_knowledge ||
        q.expectedAnswer ||
        q.expected_answer ||
        q.answer ||
        q.explanation ||
        `Comprehensive technical explanation addressing core principles, practical application, and architecture for ${topic}.`
    ).trim();

    const diff = String(q.difficulty || "medium").toLowerCase().trim();
    const validDiff = ["easy", "medium", "hard"].includes(diff) ? diff : "medium";
    const maxMarks = validDiff === "easy" ? 3 : validDiff === "hard" ? 13 : 5;

    const categoryCandidate = String(q.category || "Conceptual").trim();
    const validCategories = [
      "Fundamentals",
      "Conceptual",
      "Project Implementation",
      "Debugging",
      "Scenario",
      "Architecture",
      "System Design",
      "Technology Specific",
      "Problem Solving",
    ];
    const category = validCategories.includes(categoryCandidate)
      ? categoryCandidate
      : "Conceptual";

    return {
      sessionId,
      userId,
      orderIndex: idx,
      question: questionText,
      expectedKnowledge,
      difficulty: validDiff,
      maxMarks,
      topic,
      category,
      source: "resume",
      relatedSkill: String(q.relatedSkill || "").trim(),
      relatedProject: String(q.relatedProject || "").trim(),
    };
  });

  const savedQuestions = await RealInterviewTechnicalQuestion.insertMany(validatedDocs);
  if (userId && sessionId) {
    await recordUserQuestionHistory({ userId, sessionId, round: "technical", questions: savedQuestions });
  }

  if (!session) {
    session = await RealInterviewTechnicalSession.create({
      sessionId,
      userId,
      currentQuestionIndex: 0,
      strongAnswerCount: 0,
      hardUnlocked: false,
      questionsAnswered: 0,
      answers: [],
      status: "in_progress",
      generationStatus: "GENERATED",
      aiGenerationCalls: 1,
    });
  } else {
    session.generationStatus = "GENERATED";
    session.aiGenerationCalls = 1;
    await session.save();
  }

  const studentQuestions = savedQuestions.map((q) => ({
    id: q._id.toString(),
    question: q.question,
    difficulty: q.difficulty,
    maxMarks: q.maxMarks,
    topic: q.topic,
    category: q.category,
    source: q.source,
    relatedSkill: q.relatedSkill,
    relatedProject: q.relatedProject,
  }));

    return {
      success: true,
      message: "20 resume-driven technical questions generated successfully",
      count: studentQuestions.length,
      questions: studentQuestions,
      reused: false,
      aiGenerationCalls: 1,
    };
  });
}

/**
 * Selects the candidate's next adaptive technical question.
 * ZERO AI CALLS.
 */
export async function getNextTechnicalQuestion({ sessionId }) {
  if (!sessionId) {
    throw new Error("sessionId is required");
  }

  const session = await RealInterviewTechnicalSession.findOne({ sessionId });
  if (!session) {
    throw new Error("Technical session not found for this sessionId");
  }

  if (session.status === "completed" || session.questionsAnswered >= 20) {
    return {
      success: true,
      completed: true,
      message: "Technical round completed",
    };
  }

  const allQuestions = await RealInterviewTechnicalQuestion.find({ sessionId }).sort({
    orderIndex: 1,
  });

  if (allQuestions.length === 0) {
    throw new Error("No technical questions found for this session. Generate questions first.");
  }

  const answeredQuestionIds = (session.answers || []).map((a) => a.questionId.toString());
  const unanswered = allQuestions.filter((q) => !answeredQuestionIds.includes(q._id.toString()));

  if (unanswered.length === 0) {
    session.status = "completed";
    await session.save();
    return {
      success: true,
      completed: true,
      message: "All technical questions answered",
    };
  }

  let candidatePool = unanswered;
  if (!session.hardUnlocked) {
    const easyMediumPool = unanswered.filter((q) => q.difficulty !== "hard");
    if (easyMediumPool.length > 0) {
      candidatePool = easyMediumPool;
    }
  }

  const selectedQuestion = candidatePool[0];

  return {
    success: true,
    completed: false,
    question: {
      id: selectedQuestion._id.toString(),
      question: selectedQuestion.question,
      difficulty: selectedQuestion.difficulty,
      maxMarks: selectedQuestion.maxMarks || (selectedQuestion.difficulty === "easy" ? 3 : selectedQuestion.difficulty === "hard" ? 13 : 5),
      topic: selectedQuestion.topic,
      category: selectedQuestion.category,
      source: selectedQuestion.source,
      relatedSkill: selectedQuestion.relatedSkill,
      relatedProject: selectedQuestion.relatedProject,
      questionNumber: session.questionsAnswered + 1,
      totalQuestions: 20,
    },
    adaptiveState: {
      strongAnswerCount: session.strongAnswerCount,
      hardUnlocked: session.hardUnlocked,
      questionsAnswered: session.questionsAnswered,
      totalQuestions: 20,
    },
  };
}

/**
 * Submits candidate's answer to database.
 * STRICTLY ZERO AI CALLS.
 */
export async function submitTechnicalAnswer({
  sessionId,
  questionId,
  candidateAnswer,
  userId = null,
}) {
  if (!sessionId || !questionId) {
    throw new Error("sessionId and questionId are required");
  }

  const questionDoc = await RealInterviewTechnicalQuestion.findById(questionId);
  if (!questionDoc) {
    throw new Error("Question not found");
  }

  const session = await RealInterviewTechnicalSession.findOne({ sessionId });
  if (!session) {
    throw new Error("Technical session not found");
  }

  const existingAnswerIndex = session.answers.findIndex(
    (a) => a.questionId.toString() === questionId
  );
  if (existingAnswerIndex !== -1) {
    return {
      success: true,
      message: "Answer already recorded previously",
      questionId,
      adaptiveState: {
        strongAnswerCount: session.strongAnswerCount,
        hardUnlocked: session.hardUnlocked,
        questionsAnswered: session.questionsAnswered,
        totalQuestions: 20,
        completed: session.questionsAnswered >= 20 || session.status === "completed",
      },
    };
  }

  const cleanAnswer = String(candidateAnswer || "").trim();

  const isSubstantialAnswer = cleanAnswer.length >= 15;
  if (isSubstantialAnswer) {
    session.strongAnswerCount += 1;
  }

  if (session.strongAnswerCount >= 2) {
    session.hardUnlocked = true;
  }

  session.questionsAnswered += 1;
  session.currentQuestionIndex = session.questionsAnswered;

  if (session.questionsAnswered >= 20) {
    session.status = "completed";
  }

  const maxScore = questionDoc.maxMarks || (questionDoc.difficulty === "easy" ? 3 : questionDoc.difficulty === "hard" ? 13 : 5);

  const answerRecord = {
    questionId: questionDoc._id,
    question: questionDoc.question,
    difficulty: questionDoc.difficulty,
    maxScore,
    topic: questionDoc.topic,
    category: questionDoc.category,
    candidateAnswer: cleanAnswer,
    submittedAt: new Date(),
  };

  session.answers.push(answerRecord);
  await session.save();

  return {
    success: true,
    message: "Candidate answer stored successfully (No AI call executed)",
    questionId,
    adaptiveState: {
      strongAnswerCount: session.strongAnswerCount,
      hardUnlocked: session.hardUnlocked,
      questionsAnswered: session.questionsAnswered,
      totalQuestions: 20,
      completed: session.questionsAnswered >= 20 || session.status === "completed",
    },
  };
}

/**
 * Evaluates ALL 20 candidate answers in ONE SINGLE AI API Request after completion (AI CALL #2).
 * Includes safe deterministic application-level fallback if AI request fails (e.g. rate limit/network error).
 */
export async function evaluateTechnicalInterviewSession({ sessionId, candidateProfile = {} }) {
  if (!sessionId) {
    throw new Error("sessionId is required for evaluation");
  }

  const session = await RealInterviewTechnicalSession.findOne({ sessionId });
  if (!session) {
    throw new Error("Technical session not found for evaluation");
  }

  if (
    session.aiEvaluationCalls >= 1 ||
    session.evaluationStatus === "COMPLETED" ||
    session.evaluationCompleted
  ) {
    console.log(
      `[TechnicalService] Session ${sessionId} already evaluated (aiEvaluationCalls: ${session.aiEvaluationCalls}). Reusing stored evaluation without AI call.`
    );
    return {
      success: true,
      message: "Reused existing technical evaluation result",
      sessionId,
      totalScore: session.totalScore || session.overallScore || 0,
      maxScore: session.maxScore || 100,
      percentage: session.percentage || 0,
      overallRating: session.overallRating || "N/A",
      strengths: session.strengths || [],
      weaknesses: session.weaknesses || [],
      finalFeedback: session.finalFeedback || "",
      evaluations: session.answers.map((a) => ({
        questionId: a.questionId.toString(),
        question: a.question,
        candidateAnswer: a.candidateAnswer,
        score: a.score || 0,
        maxScore: a.maxScore || (a.difficulty === "easy" ? 3 : a.difficulty === "hard" ? 13 : 5),
        difficulty: a.difficulty,
        rating: a.rating || "weak",
        correctPoints: a.correctPoints || [],
        missingPoints: a.missingPoints || [],
        incorrectPoints: a.incorrectPoints || [],
        grammarIssues: a.grammarIssues || [],
        feedback: a.feedback || "",
        betterAnswer: a.betterAnswer || "",
      })),
      reused: true,
      aiEvaluationCalls: session.aiEvaluationCalls,
    };
  }

  const allQuestions = await RealInterviewTechnicalQuestion.find({ sessionId }).sort({
    orderIndex: 1,
  });

  if (allQuestions.length === 0) {
    throw new Error("No technical questions found for evaluation in this session");
  }

  const mainInterviewDoc = await Interview.findById(sessionId).lean().catch(() => null);
  const mainInterviewAnswers = mainInterviewDoc?.answers || [];

  const questionsToEvaluate = allQuestions.map((q) => {
    const qIdStr = q._id.toString();
    const matchedAnswer = (session.answers || []).find(
      (a) => a.questionId.toString() === qIdStr
    );
    const mainAnsMatch = mainInterviewAnswers.find(
      (a) => String(a.questionId) === qIdStr
    );

    const rawAns = (matchedAnswer?.candidateAnswer || mainAnsMatch?.answer || mainAnsMatch?.transcript || "").trim();
    const finalAnsText = rawAns.length > 0 ? rawAns : "(No answer submitted)";
    const maxScore = q.maxMarks || (q.difficulty === "easy" ? 3 : q.difficulty === "hard" ? 13 : 5);

    return {
      questionId: qIdStr,
      question: q.question,
      difficulty: q.difficulty,
      maxScore,
      topic: q.topic,
      category: q.category,
      expectedKnowledge: q.expectedKnowledge || `Detailed technical explanation covering key principles and practical implementation of ${q.topic || q.question}.`,
      candidateAnswer: finalAnsText,
    };
  });

  session.evaluationStatus = "EVALUATING";
  session.evaluationStartedAt = new Date();
  await session.save();

  console.log(`[TechnicalService] Making AI CALL #2 (complete evaluation) for session ${sessionId}...`);
  let evalResult;
  let isFallback = false;

  try {
    evalResult = await evaluateTechnicalInterviewAI({
      candidateProfile,
      questions: questionsToEvaluate,
    });
  } catch (evalErr) {
    console.warn(`[TechnicalService] AI evaluation call failed (${evalErr.message}). Applying deterministic application-level fallback evaluation.`);
    isFallback = true;
    evalResult = generateDeterministicTechnicalFallback(questionsToEvaluate, evalErr.message);
  }

  const evaluationsList = Array.isArray(evalResult.evaluations) ? evalResult.evaluations : [];
  let calculatedTotalScore = 0;

  for (const q of allQuestions) {
    const qIdStr = q._id.toString();
    const itemEval = evaluationsList.find((e) => String(e.questionId) === qIdStr) || {};
    const mainAnsMatch = mainInterviewAnswers.find((a) => String(a.questionId) === qIdStr);
    const maxScore = q.maxMarks || (q.difficulty === "easy" ? 3 : q.difficulty === "hard" ? 13 : 5);

    const rawScore = Number(itemEval.score);
    const score = isNaN(rawScore) ? 0 : Math.max(0, Math.min(maxScore, Math.round(rawScore)));
    calculatedTotalScore += score;

    const ratingCandidate = String(itemEval.rating || "").trim();
    const rating = ratingCandidate || (
      score >= maxScore * 0.8 ? "Strong" : score >= maxScore * 0.5 ? "Acceptable" : "Weak"
    );

    const existingAnsIndex = session.answers.findIndex(
      (a) => a.questionId.toString() === qIdStr
    );

    const answerData = {
      questionId: q._id,
      question: q.question,
      difficulty: q.difficulty,
      maxScore,
      topic: q.topic,
      category: q.category,
      candidateAnswer: (existingAnsIndex !== -1 && session.answers[existingAnsIndex].candidateAnswer && session.answers[existingAnsIndex].candidateAnswer !== "(No answer submitted)")
        ? session.answers[existingAnsIndex].candidateAnswer
        : (mainAnsMatch?.answer || mainAnsMatch?.transcript || "(No answer submitted)"),
      score,
      rating,
      evaluationSource: itemEval.evaluationSource || (isFallback ? "deterministic_fallback" : "ai_evaluated"),
      correctPoints: Array.isArray(itemEval.correctPoints) ? itemEval.correctPoints : [],
      missingPoints: Array.isArray(itemEval.missingPoints) ? itemEval.missingPoints : [],
      incorrectPoints: Array.isArray(itemEval.incorrectPoints) ? itemEval.incorrectPoints : [],
      grammarIssues: Array.isArray(itemEval.grammarIssues) ? itemEval.grammarIssues : [],
      feedback: String(itemEval.feedback || "Evaluation complete.").trim(),
      betterAnswer: String(
        itemEval.betterAnswer || q.expectedKnowledge || "Interview-ready response based on candidate answer."
      ).trim(),
      submittedAt: existingAnsIndex !== -1 ? session.answers[existingAnsIndex].submittedAt : new Date(),
    };

    if (existingAnsIndex !== -1) {
      session.answers[existingAnsIndex] = answerData;
    } else {
      session.answers.push(answerData);
    }
  }

  const maxScoreTotal = 100;
  const percentage = Math.round((calculatedTotalScore / maxScoreTotal) * 100);

  let overallRating = "Weak";
  if (percentage >= 90) overallRating = "Excellent";
  else if (percentage >= 80) overallRating = "Very Strong";
  else if (percentage >= 70) overallRating = "Strong";
  else if (percentage >= 60) overallRating = "Good";
  else if (percentage >= 50) overallRating = "Average";
  else if (percentage >= 40) overallRating = "Needs Improvement";

  session.totalScore = calculatedTotalScore;
  session.overallScore = calculatedTotalScore;
  session.maxScore = maxScoreTotal;
  session.percentage = percentage;
  session.overallRating = evalResult.overallRating || overallRating;
  session.strengths = Array.isArray(evalResult.strengths) ? evalResult.strengths : ["Candidate answer recorded"];
  session.weaknesses = Array.isArray(evalResult.weaknesses) ? evalResult.weaknesses : ["Automated AI evaluation was unavailable"];
  session.finalFeedback = String(evalResult.finalFeedback || "Technical interview evaluated using deterministic application fallback.").trim();

  session.evaluationStatus = "COMPLETED";
  session.evaluationCompleted = true;
  session.aiEvaluationCalls = 1;
  session.evaluationCompletedAt = new Date();
  session.status = "completed";

  await session.save();

  console.log(`[TechnicalService] Evaluation complete for session ${sessionId}. Total score: ${calculatedTotalScore}/100 (${percentage}%). Fallback used: ${isFallback}`);

  return {
    success: true,
    message: isFallback
      ? "Technical interview evaluated using deterministic application fallback (0 extra AI calls)"
      : "Technical interview evaluated successfully in 1 AI call",
    sessionId,
    totalScore: session.totalScore,
    maxScore: session.maxScore,
    percentage: session.percentage,
    overallRating: session.overallRating,
    strengths: session.strengths,
    weaknesses: session.weaknesses,
    finalFeedback: session.finalFeedback,
    evaluations: session.answers.map((a) => ({
      questionId: a.questionId.toString(),
      question: a.question,
      candidateAnswer: a.candidateAnswer,
      score: a.score,
      maxScore: a.maxScore,
      difficulty: a.difficulty,
      rating: a.rating,
      evaluationSource: a.evaluationSource || (isFallback ? "deterministic_fallback" : "ai_evaluated"),
      correctPoints: a.correctPoints,
      missingPoints: a.missingPoints,
      incorrectPoints: a.incorrectPoints,
      grammarIssues: a.grammarIssues,
      feedback: a.feedback,
      betterAnswer: a.betterAnswer,
    })),
    reused: false,
    aiEvaluationCalls: 1,
    isFallback,
  };
}

/**
 * Deterministic application-level fallback evaluation generator.
 * Does NOT fabricate semantic correctness or positive marks if AI is unavailable.
 */
function generateDeterministicTechnicalFallback(questionsToEvaluate, reason = "AI provider unavailable") {
  console.log(`\n[REAL-INTERVIEW][EVALUATION-FALLBACK]\nround=technical\nreason=${reason}\nevaluationSource=deterministic_fallback\n`);

  const evaluations = questionsToEvaluate.map((q) => {
    const ans = String(q.candidateAnswer || "").trim();
    const maxScore = Number(q.maxScore || (q.difficulty === "easy" ? 3 : q.difficulty === "hard" ? 13 : 5));
    const isUnanswered = !ans || ans === "(No answer submitted)" || ans.toLowerCase() === "not answered";

    return {
      questionId: q.questionId,
      score: 0,
      maxScore,
      difficulty: q.difficulty,
      rating: isUnanswered ? "Not Attempted" : "Unverified (AI Unavailable)",
      evaluationSource: "deterministic_fallback",
      correctPoints: [],
      missingPoints: isUnanswered ? ["Question was not attempted"] : ["Automated AI evaluation was unavailable for this response"],
      incorrectPoints: [],
      grammarIssues: [],
      feedback: isUnanswered
        ? "Question was not attempted."
        : "Automated detailed evaluation was unavailable for this response. Answer preserved for review.",
      betterAnswer: q.expectedKnowledge || "Comprehensive technical explanation addressing core concepts.",
    };
  });

  return {
    evaluations,
    totalScore: 0,
    maxScore: 100,
    percentage: 0,
    overallRating: "Unverified",
    strengths: ["Candidate answers preserved in session"],
    weaknesses: ["Automated AI evaluation service was unavailable"],
    finalFeedback: "Technical interview completed with deterministic fallback because AI evaluation was unavailable.",
  };
}
