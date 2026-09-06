import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import User from '../backend/models/User.js';
import Interview from '../backend/models/Interview.js';
import RealInterviewQuestionHistory from '../backend/models/RealInterviewQuestionHistory.js';
import { createInterviewSession, getInterviewSession, saveInterviewAnswer, completeInterviewSession } from '../backend/controllers/studentInterviewController.js';
import { normalizeQuestionText } from '../backend/services/realInterview/questionHistoryService.js';
import { generateAndProcessAptitudeQuestions } from '../backend/services/realInterview/aptitudeService.js';
import { generateAndProcessTechnicalQuestions } from '../backend/services/realInterview/technicalService.js';
import { generateAndProcessProjectQuestions } from '../backend/services/realInterview/projectService.js';
import { generateAndProcessHRQuestions } from '../backend/services/realInterview/hrService.js';
import { generateAndProcessCodingQuestions } from '../backend/services/realInterview/codingService.js';

async function runTests() {
  console.log("🚀 STARTING REAL AI INTERVIEW PRODUCTION PERSISTENCE & UNIQ TEST SUITE...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ MongoDB Connected");

  const testEmail = `test_student_${Date.now()}@example.com`;
  const user = await User.create({
    name: "Test Student Persistence",
    email: testEmail,
    password: "Password123!",
    role: "student",
    department: "Computer Science",
    year: "4th Year",
    resumeFileName: "Sample_Software_Engineer_Resume.pdf",
    candidateProfile: {
      candidateName: "Test Student",
      skills: ["Java", "React", "Node.js", "MongoDB"],
      experienceYears: 2,
      projects: [{ title: "E-Commerce App", techStack: ["React", "Node.js", "MongoDB"], description: "Full stack shopping portal" }]
    }
  });

  const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET || "fallback-secret-for-tests-only");

  function createMockReqRes(body = {}, params = {}, reqUser = user) {
    const req = { body, params, user: reqUser };
    const res = {
      statusCode: 200,
      jsonPayload: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.jsonPayload = data; return this; }
    };
    return { req, res };
  }

  // --- TEST 1: CREATE FIRST REAL INTERVIEW SESSION ---
  console.log("\n--- TEST 1: SESSION CREATION & AI GENERATION ---");
  const { req: req1, res: res1 } = createMockReqRes({ interviewType: "actual" });
  await createInterviewSession(req1, res1);

  if (res1.statusCode !== 201 || !res1.jsonPayload.sessionId) {
    console.error("❌ Session creation failed:", res1.jsonPayload);
    process.exit(1);
  }

  const s1Data = res1.jsonPayload;
  console.log(`✅ Session 1 Created: ID=${s1Data.sessionId}`);

  // Run Real Interview 5-round generation pipeline
  const userId = user._id;
  const sessionId = s1Data.sessionId;
  await generateAndProcessAptitudeQuestions({ userId, sessionId });
  await generateAndProcessTechnicalQuestions({ userId, sessionId });
  await generateAndProcessProjectQuestions({ userId, sessionId });
  await generateAndProcessHRQuestions({ userId, sessionId });
  await generateAndProcessCodingQuestions({ userId, sessionId });

  // Trigger preparation / fetch questions
  const { req: req1Fetch, res: res1Fetch } = createMockReqRes({}, { sessionId: s1Data.sessionId });
  await getInterviewSession(req1Fetch, res1Fetch);

  const session1 = res1Fetch.jsonPayload;
  console.log(`   Session 1 Loaded: Status=${session1.status}, Questions Count: ${session1.generatedQuestions?.length}`);
  
  if (session1.generatedQuestions?.length !== 53) {
    console.error(`❌ Expected 53 questions, got ${session1.generatedQuestions?.length}`);
    process.exit(1);
  }

  const counts = { APTITUDE: 0, TECHNICAL: 0, RESUME_PROJECT: 0, HR: 0, CODING: 0 };
  session1.generatedQuestions.forEach(q => {
    counts[q.section] = (counts[q.section] || 0) + 1;
  });
  console.log("   Section breakdown:", counts);

  if (counts.APTITUDE !== 15 || counts.TECHNICAL !== 20 || counts.RESUME_PROJECT !== 10 || counts.HR !== 5 || counts.CODING !== 3) {
    console.error("❌ Invalid section breakdown!", counts);
    process.exit(1);
  }

  // --- TEST 2: REFRESH / IDEMPOTENT SESSION RECOVERY ---
  console.log("\n--- TEST 2: REFRESH / IDEMPOTENT SESSION RECOVERY ---");
  const { req: req2, res: res2 } = createMockReqRes({ interviewType: "actual" });
  await createInterviewSession(req2, res2);

  if (res2.jsonPayload.sessionId !== session1.sessionId) {
    console.error(`❌ Session idempotence failed! Expected ${session1.sessionId}, got ${res2.jsonPayload.sessionId}`);
    process.exit(1);
  }
  console.log("✅ Refresh detected active session and returned existing sessionId without creating duplicate doc!");

  // --- TEST 3: CONTINUOUS ANSWER PERSISTENCE ---
  console.log("\n--- TEST 3: CONTINUOUS ANSWER PERSISTENCE ---");
  const firstQ = session1.generatedQuestions[0];
  const { req: req3, res: res3 } = createMockReqRes({
    questionId: firstQ.id || firstQ.questionId,
    question: firstQ.question,
    category: firstQ.category || "aptitude",
    section: firstQ.section,
    answer: "Option B",
    status: "answered",
    currentQuestionIndex: 7
  }, { sessionId: session1.sessionId });

  await saveInterviewAnswer(req3, res3);
  console.log(`✅ Answer saved. Res payload:`, res3.jsonPayload);

  // Verify fetch session
  const { req: req4, res: res4 } = createMockReqRes({}, { sessionId: session1.sessionId });
  await getInterviewSession(req4, res4);
  console.log(`✅ Session loaded after refresh. Current Index: ${res4.jsonPayload.currentQuestionIndex}, Saved Answers: ${res4.jsonPayload.answers?.length}`);

  if (res4.jsonPayload.currentQuestionIndex !== 7 || res4.jsonPayload.answers?.[0]?.answer !== "Option B") {
    console.error("❌ Session state restoration failed!");
    process.exit(1);
  }

  // --- TEST 4: EXPLICIT SUBMISSION ---
  console.log("\n--- TEST 4: EXPLICIT SUBMISSION ---");
  const { req: req5, res: res5 } = createMockReqRes({}, { sessionId: session1.sessionId });
  await completeInterviewSession(req5, res5);
  console.log(`✅ Session 1 completed:`, res5.jsonPayload);

  // --- TEST 5: NEW SESSION FOR SAME USER HAS ZERO DUPLICATES ---
  console.log("\n--- TEST 5: USER-LEVEL QUESTION UNIQUENESS ACROSS SESSIONS ---");
  const { req: req6, res: res6 } = createMockReqRes({ interviewType: "actual" });
  await createInterviewSession(req6, res6);

  const s2Data = res6.jsonPayload;
  console.log(`✅ Session 2 Created: ID=${s2Data.sessionId}`);

  // Run Real Interview 5-round generation pipeline for Session 2
  const session2Id = s2Data.sessionId;
  await generateAndProcessAptitudeQuestions({ userId, sessionId: session2Id });
  await generateAndProcessTechnicalQuestions({ userId, sessionId: session2Id });
  await generateAndProcessProjectQuestions({ userId, sessionId: session2Id });
  await generateAndProcessHRQuestions({ userId, sessionId: session2Id });
  await generateAndProcessCodingQuestions({ userId, sessionId: session2Id });

  // Fetch session 2 questions
  const { req: req6Fetch, res: res6Fetch } = createMockReqRes({}, { sessionId: s2Data.sessionId });
  await getInterviewSession(req6Fetch, res6Fetch);
  const session2 = res6Fetch.jsonPayload;

  const historyEntries = await RealInterviewQuestionHistory.find({ userId: user._id });
  console.log(`✅ Total recorded history entries for user: ${historyEntries.length}`);

  const s1NormSet = new Set(session1.generatedQuestions.map(q => normalizeQuestionText(q.question || q.title || "")));
  let duplicateCount = 0;

  session2.generatedQuestions.forEach(q => {
    const norm = normalizeQuestionText(q.question || q.title || "");
    if (s1NormSet.has(norm)) {
      console.error(`⚠️ DUPLICATE QUESTION DETECTED IN SESSION 2: "${q.question}"`);
      duplicateCount++;
    }
  });

  if (duplicateCount > 0) {
    console.error(`❌ FAILED: Found ${duplicateCount} repeated questions across sessions for the same user!`);
    process.exit(1);
  }

  console.log("🎉 SUCCESS: 0 duplicate questions across consecutive Real Interview sessions!");

  // Clean up test data
  await User.deleteOne({ _id: user._id });
  await Interview.deleteMany({ userId: user._id });
  await RealInterviewQuestionHistory.deleteMany({ userId: user._id });
  await mongoose.disconnect();
  console.log("✅ Database disconnected. TEST PASSED SUCCESSFULLY!");
}

runTests().catch(err => {
  console.error("💥 TEST ERROR:", err);
  process.exit(1);
});
