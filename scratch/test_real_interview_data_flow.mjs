import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import Interview from "../backend/models/Interview.js";
import RealInterviewAptitudeQuestion from "../backend/models/RealInterviewAptitudeQuestion.js";
import RealInterviewTechnicalQuestion from "../backend/models/RealInterviewTechnicalQuestion.js";
import RealInterviewProjectQuestion from "../backend/models/RealInterviewProjectQuestion.js";
import RealInterviewHRQuestion from "../backend/models/RealInterviewHRQuestion.js";
import RealInterviewCodingQuestion from "../backend/models/RealInterviewCodingQuestion.js";
import { getInterviewSession, createInterviewSession } from "../backend/controllers/studentInterviewController.js";
import { generateAndProcessAptitudeQuestions } from "../backend/services/realInterview/aptitudeService.js";
import { generateAndProcessTechnicalQuestions } from "../backend/services/realInterview/technicalService.js";
import { generateAndProcessProjectQuestions } from "../backend/services/realInterview/projectService.js";
import { generateAndProcessHRQuestions } from "../backend/services/realInterview/hrService.js";
import { generateAndProcessCodingQuestions } from "../backend/services/realInterview/codingService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/ai-interview-engine";

async function runTest() {
  console.log("=== REAL INTERVIEW DATA FLOW TEST ===");
  console.log("Connecting to MongoDB:", MONGO_URI);
  await mongoose.connect(MONGO_URI);

  const testSessionId = `TEST_DATAFLOW_SESSION_${Date.now()}`;
  console.log("Test Session ID:", testSessionId);

  const mockUser = { id: new mongoose.Types.ObjectId().toString() };

  // 1. Create Session
  console.log("\n1. Creating Session via Controller...");
  const mockReqCreate = { user: mockUser, body: { interviewType: "actual" } };
  let createStatus = 0;
  let createBody = null;
  const mockResCreate = {
    status(code) { createStatus = code; return this; },
    json(data) { createBody = data; return this; }
  };
  await createInterviewSession(mockReqCreate, mockResCreate);
  console.log("Create Session Status:", createStatus, createBody);

  const sessionId = createBody.sessionId;

  // 2. Generate 5 Rounds
  console.log("\n2. Triggering 5 Round Generations with session ID:", sessionId);

  console.log("-> Aptitude generation...");
  const aptRes = await generateAndProcessAptitudeQuestions({ userId: mockUser.id, sessionId });
  console.log("Aptitude generated:", aptRes.count || aptRes.questions?.length, "questions");

  console.log("-> Technical generation...");
  const techRes = await generateAndProcessTechnicalQuestions({ userId: mockUser.id, sessionId, candidateProfile: { skills: ["JavaScript", "Node.js"] } });
  console.log("Technical generated:", techRes.questions?.length, "questions");

  console.log("-> Project generation...");
  const projRes = await generateAndProcessProjectQuestions({ userId: mockUser.id, sessionId, candidateProfile: { projects: [{ title: "E-Commerce", techStack: ["React", "Express"] }] } });
  console.log("Project generated:", projRes.questions?.length, "questions");

  console.log("-> HR generation...");
  const hrRes = await generateAndProcessHRQuestions({ userId: mockUser.id, sessionId, candidateProfile: {} });
  console.log("HR generated:", hrRes.questions?.length, "questions");

  console.log("-> Coding generation...");
  const codingRes = await generateAndProcessCodingQuestions({ userId: mockUser.id, sessionId, candidateProfile: {} });
  console.log("Coding generated:", codingRes.questions?.length, "questions");

  // 3. Retrieve Session via Controller
  console.log("\n3. Fetching Session via getInterviewSession Controller...");
  const mockReqGet = { params: { sessionId } };
  let getStatus = 0;
  let getBody = null;
  const mockResGet = {
    status(code) { getStatus = code; return this; },
    json(data) { getBody = data; return this; }
  };
  await getInterviewSession(mockReqGet, mockResGet);

  console.log("Get Session Status:", getStatus);
  const questions = getBody.generatedQuestions || [];
  console.log("Total aggregated questions returned to student:", questions.length);

  const sections = {};
  questions.forEach(q => {
    sections[q.section] = (sections[q.section] || 0) + 1;
  });
  console.log("Question counts per section:", sections);

  const firstApt = questions.find(q => q.section === "APTITUDE");
  console.log("\nSample Aptitude Question Payload:");
  console.log("Question:", firstApt?.question);
  console.log("Options:", firstApt?.options);
  console.log("Has correctAnswer exposed?", firstApt?.correctAnswer !== undefined);
  console.log("Has explanation exposed?", firstApt?.explanation !== undefined);

  const firstTech = questions.find(q => q.section === "TECHNICAL");
  console.log("\nSample Technical Question Payload:");
  console.log("Question:", firstTech?.question);
  console.log("Section:", firstTech?.section);

  // Clean up test data
  console.log("\n4. Cleaning up test session data...");
  await Interview.deleteOne({ _id: sessionId });
  await RealInterviewAptitudeQuestion.deleteMany({ sessionId });
  await RealInterviewTechnicalQuestion.deleteMany({ sessionId });
  await RealInterviewProjectQuestion.deleteMany({ sessionId });
  await RealInterviewHRQuestion.deleteMany({ sessionId });
  await RealInterviewCodingQuestion.deleteMany({ sessionId });

  await mongoose.disconnect();
  console.log("=== TEST FINISHED SUCCESSFULLY ===");
}

runTest().catch(err => {
  console.error("Test failed:", err);
  mongoose.disconnect();
  process.exit(1);
});
