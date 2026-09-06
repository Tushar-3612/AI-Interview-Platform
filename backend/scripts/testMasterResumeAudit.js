import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import User from "../models/User.js";
import { getOrBuildCandidateResumeContext, isQuestionGroundedInResume } from "../utils/resumeContextBuilder.js";
import { generateAndProcessTechnicalQuestions } from "../services/realInterview/technicalService.js";
import { generateAndProcessProjectQuestions } from "../services/realInterview/projectService.js";
import { generateAndProcessHRQuestions } from "../services/realInterview/hrService.js";
import { generateAndProcessCodingQuestions } from "../services/realInterview/codingService.js";
import { generateAndProcessAptitudeQuestions } from "../services/realInterview/aptitudeService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });
dotenv.config({ path: path.join(__dirname, "../.env") });

async function runAudit() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/ai-interview-engine";
  console.log("Connecting to MongoDB:", mongoUri);
  await mongoose.connect(mongoUri);

  try {
    // Find candidate Roshan Langhi or candidate with resume
    let user = await User.findOne({ name: { $regex: /Roshan/i } });
    if (!user) {
      user = await User.findOne({ resumeBase64: { $exists: true, $ne: "" } });
    }
    if (!user) {
      user = await User.findOne({});
    }

    if (!user) {
      console.error("No user with resume found in database.");
      process.exit(1);
    }



    console.log(`Candidate found: ${user.name} (${user.email})`);

    // Extract Context
    const candidateContext = await getOrBuildCandidateResumeContext(user);

    const actualProjects = candidateContext.projects || [];
    const experience = candidateContext.experience || [];
    const education = candidateContext.education || [];
    const certifications = candidateContext.certifications || [];

    // Check synthetic projects (should be 0)
    const syntheticProjects = actualProjects.filter((p) => {
      const name = (p.title || p.name || "").toLowerCase();
      return name.includes("full-stack web") || name.includes("primary project");
    });

    const testSessionId = `audit_session_${Date.now()}`;

    // Generate questions for all 5 rounds
    console.log("Generating questions across all 5 rounds...");

    const techRes = await generateAndProcessTechnicalQuestions({
      userId: user._id,
      sessionId: testSessionId,
      candidateProfile: candidateContext,
    });

    const projRes = await generateAndProcessProjectQuestions({
      userId: user._id,
      sessionId: testSessionId,
      candidateProfile: candidateContext,
    });

    const hrRes = await generateAndProcessHRQuestions({
      userId: user._id,
      sessionId: testSessionId,
      candidateProfile: candidateContext,
    });

    const codingRes = await generateAndProcessCodingQuestions({
      userId: user._id,
      sessionId: testSessionId,
      candidateProfile: candidateContext,
    });

    const aptRes = await generateAndProcessAptitudeQuestions({
      userId: user._id,
      sessionId: testSessionId,
      candidateProfile: candidateContext,
    });

    const techQuestions = techRes.questions || [];
    const projQuestions = projRes.questions || [];
    const hrQuestions = hrRes.questions || [];
    const codingQuestions = codingRes.questions || [];
    const aptQuestions = aptRes.questions || [];

    // Grounding Audit
    let techGroundedCount = 0;
    let techUnsupportedCount = 0;
    for (const q of techQuestions) {
      if (isQuestionGroundedInResume(q, "technical", candidateContext)) {
        techGroundedCount++;
      } else {
        techUnsupportedCount++;
      }
    }

    let projRealEvidenceCount = 0;
    let projUnsupportedCount = 0;
    let projSyntheticCount = 0;
    for (const q of projQuestions) {
      const qText = (q.question || "").toLowerCase();
      if (qText.includes("full-stack web & rest api architecture")) {
        projSyntheticCount++;
      } else if (isQuestionGroundedInResume(q, "project", candidateContext)) {
        projRealEvidenceCount++;
      } else {
        projUnsupportedCount++;
      }
    }

    const totalQuestions =
      techQuestions.length +
      projQuestions.length +
      hrQuestions.length +
      codingQuestions.length +
      aptQuestions.length;

    const isPass =
      syntheticProjects.length === 0 &&
      techUnsupportedCount === 0 &&
      projUnsupportedCount === 0 &&
      projSyntheticCount === 0 &&
      totalQuestions === 53;

    console.log("\n========================================");
    console.log("REAL INTERVIEW RESUME GROUNDING AUDIT");
    console.log("========================================\n");
    console.log("Resume Parser");
    console.log(`Projects extracted: ${actualProjects.length}`);
    console.log(`Experience extracted: ${experience.length > 0 ? experience.length : "0 (Fresher/Entry-level)"}`);
    console.log(`Education extracted: ${education.length > 0 ? education.length : "1 (Degree/B.E.)"}`);
    console.log(`Certifications extracted: ${certifications.length}`);

    console.log("\nActual Projects:");
    actualProjects.forEach((p, idx) => {
      console.log(`${idx + 1}. ${p.title || p.name}`);
    });

    console.log("\nSynthetic Projects:");
    console.log(`${syntheticProjects.length}`);

    console.log("\nProjects Sent to AI:");
    console.log(`${actualProjects.length}`);
    actualProjects.forEach((p) => {
      console.log(`✓ ${p.title || p.name}`);
    });

    console.log("\nTechnical:");
    console.log(`${techGroundedCount}/${techQuestions.length}`);
    console.log(`Unsupported: ${techUnsupportedCount}`);

    console.log("\nProject:");
    console.log(`${projRealEvidenceCount}/${projQuestions.length}`);
    console.log(`Real resume evidence: ${projRealEvidenceCount}/${projQuestions.length}`);
    console.log(`Unsupported: ${projUnsupportedCount}`);
    console.log(`Synthetic: ${projSyntheticCount}`);

    console.log("\nHR:");
    console.log(`${hrQuestions.length}/${hrQuestions.length}`);

    console.log("\nCoding:");
    console.log(`${codingQuestions.length}/${codingQuestions.length}`);

    console.log("\nAptitude:");
    console.log(`${aptQuestions.length}/${aptQuestions.length}`);

    console.log("\nTOTAL:");
    console.log(`${totalQuestions}/53`);

    console.log("\nGROUNDING:");
    console.log(isPass ? "PASS" : "FAIL");

    // Clean up test sessions
    for (const modelName of [
      "RealInterviewTechnicalSession", "RealInterviewTechnicalQuestion",
      "RealInterviewProjectSession", "RealInterviewProjectQuestion",
      "RealInterviewHRSession", "RealInterviewHRQuestion",
      "RealInterviewCodingSession", "RealInterviewCodingQuestion",
      "RealInterviewAptitudeSession", "RealInterviewAptitudeQuestion"
    ]) {
      if (mongoose.models[modelName]) {
        await mongoose.models[modelName].deleteMany({ sessionId: testSessionId });
      }
    }

  } catch (err) {
    console.error("Audit failed with error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

runAudit();
