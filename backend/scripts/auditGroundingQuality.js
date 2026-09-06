import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import User from "../models/User.js";
import RealInterviewTechnicalSession from "../models/RealInterviewTechnicalSession.js";
import RealInterviewTechnicalQuestion from "../models/RealInterviewTechnicalQuestion.js";
import RealInterviewProjectSession from "../models/RealInterviewProjectSession.js";
import RealInterviewProjectQuestion from "../models/RealInterviewProjectQuestion.js";
import { getOrBuildCandidateResumeContext, isQuestionGroundedInResume } from "../utils/resumeContextBuilder.js";
import { generateAndProcessTechnicalQuestions } from "../services/realInterview/technicalService.js";
import { generateAndProcessProjectQuestions } from "../services/realInterview/projectService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const KNOWN_TECH_KEYWORDS = [
  "Python", "Java", "C++", "C#", "C", "JavaScript", "TypeScript", "SQL", "Go", "Rust", "Kotlin", "Swift", "PHP", "Ruby", "R", "Scala", "Dart",
  "React", "React.js", "Next.js", "Node.js", "Express", "Express.js", "FastAPI", "Django", "Flask", "Spring Boot", "Spring", "Angular", "Vue.js", "Vue",
  "MySQL", "PostgreSQL", "MongoDB", "SQLite", "Redis", "Cassandra", "Oracle", "DynamoDB", "Firebase", "Supabase",
  "AWS", "Amazon Web Services", "Azure", "GCP", "Google Cloud Platform", "Heroku", "Vercel", "Netlify",
  "Docker", "Kubernetes", "K8s", "CI/CD", "Jenkins", "Terraform", "Ansible", "Linux", "Nginx",
  "Redux", "Axios", "Prisma", "Mongoose", "GraphQL", "REST APIs", "WebSockets", "Kafka", "RabbitMQ",
  "Pandas", "NumPy", "Matplotlib", "Seaborn", "Scikit-learn", "XGBoost", "TensorFlow", "Keras", "PyTorch", "OpenCV", "NLTK", "Spacy", "Transformers", "BERT", "Power BI", "Tableau",
  "Embedded C", "Linear Regression", "Random Forest", "Gemini API"
];

const sortedKeywords = [...KNOWN_TECH_KEYWORDS].sort((a, b) => b.length - a.length);

async function run() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGO_URI missing");
    process.exit(1);
  }
  await mongoose.connect(mongoUri);

  const user = await User.findOne({ name: { $regex: /Roshan/i } }) || await User.findOne({});
  if (!user) {
    console.error("User not found");
    process.exit(1);
  }

  console.log(`Auditing candidate: ${user.name} (${user.email})`);
  const resumeContext = await getOrBuildCandidateResumeContext(user._id, {});

  console.log(`\nExtracted Skills: [${resumeContext.skills.join(", ")}]`);
  console.log(`Extracted Projects (${resumeContext.projects.length}):`);
  resumeContext.projects.forEach((p, i) => {
    console.log(`  ${i + 1}. "${p.name}" - Tech: [${(p.technologies || []).join(", ")}]`);
  });

  const testSessionId = `quality_audit_${Date.now()}`;

  // 1. Generate Technical Questions
  const techRes = await generateAndProcessTechnicalQuestions({
    userId: user._id,
    sessionId: testSessionId,
    candidateProfile: resumeContext,
  });

  // 2. Generate Project Questions
  const projRes = await generateAndProcessProjectQuestions({
    userId: user._id,
    sessionId: testSessionId,
    candidateProfile: resumeContext,
  });

  const techQuestions = techRes.questions || [];
  const projQuestions = projRes.questions || [];

  let unsupportedCount = 0;
  let syntheticProjectCount = 0;
  let inventedTechCount = 0;

  console.log("\n========================================");
  console.log("TECHNICAL QUESTIONS EVIDENCE AUDIT (20 QUESTIONS)");
  console.log("========================================\n");

  techQuestions.forEach((q, idx) => {
    const qText = q.question || "";
    const source = q.source || "ai_generated";
    const candidateTechs = resumeContext.skills || [];

    const techsUsed = [];
    sortedKeywords.forEach(kw => {
      const kwLower = kw.toLowerCase();
      let regex;
      if (kwLower === "c" || kwLower === "r") {
        regex = new RegExp(`(^|[^a-zA-Z0-9+#])${kwLower}($|[^a-zA-Z0-9+#])`, "i");
      } else {
        regex = new RegExp(`\\b${kwLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      }
      if (regex.test(qText.toLowerCase())) {
        if (!techsUsed.includes(kw)) techsUsed.push(kw);
      }
    });

    const unmentionedTechs = techsUsed.filter(t => !resumeContext.allCandidateTechSet.has(t.toLowerCase()) && !["Operating Systems", "Computer Networks", "Data Structures", "Software Engineering"].includes(t));
    if (unmentionedTechs.length > 0) {
      inventedTechCount++;
    }

    const isSupported = isQuestionGroundedInResume(q, "technical", resumeContext) && unmentionedTechs.length === 0;
    if (!isSupported) unsupportedCount++;

    console.log(`${idx + 1}. QUESTION: "${qText}"`);
    console.log(`   SOURCE: ${source}`);
    console.log(`   EVIDENCE: Listed skills [${candidateTechs.join(", ")}]`);
    console.log(`   TECHNOLOGIES MENTIONED: [${techsUsed.length > 0 ? techsUsed.join(", ") : "CS Fundamentals"}]`);
    console.log(`   SUPPORTED: ${isSupported ? "YES" : "NO"}\n`);
  });

  console.log("\n========================================");
  console.log("PROJECT QUESTIONS EVIDENCE AUDIT (10 QUESTIONS)");
  console.log("========================================\n");

  projQuestions.forEach((q, idx) => {
    const qText = q.question || "";
    const projName = q.projectName || "Project";
    const source = q.source || "ai_generated";

    if (projName.toLowerCase().includes("full-stack web") || projName.toLowerCase().includes("primary project")) {
      syntheticProjectCount++;
    }

    const matchedProject = resumeContext.projects.find(p => {
      const pName = (p.name || p.title || "").toLowerCase();
      const target = projName.toLowerCase();
      return pName.includes(target) || target.includes(pName);
    });

    const projectEvidenceStr = matchedProject
      ? `Project "${matchedProject.name}" in resume. Tech stack: [${(matchedProject.technologies || []).join(", ")}]`
      : "No matching project in candidate resume";

    const techsUsed = [];
    sortedKeywords.forEach(kw => {
      const kwLower = kw.toLowerCase();
      let regex;
      if (kwLower === "c" || kwLower === "r") {
        regex = new RegExp(`(^|[^a-zA-Z0-9+#])${kwLower}($|[^a-zA-Z0-9+#])`, "i");
      } else {
        regex = new RegExp(`\\b${kwLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      }
      if (regex.test(qText.toLowerCase())) {
        if (!techsUsed.includes(kw)) techsUsed.push(kw);
      }
    });

    const projTechSet = new Set((matchedProject?.technologies || []).map(t => t.toLowerCase()));
    const unmentionedProjTechs = techsUsed.filter(t => !projTechSet.has(t.toLowerCase()) && !resumeContext.allCandidateTechSet.has(t.toLowerCase()) && !["project", "software", "code", "architecture", "system", "testing", "design", "performance"].includes(t.toLowerCase()));

    if (unmentionedProjTechs.length > 0) {
      inventedTechCount++;
    }

    const isSupported = isQuestionGroundedInResume(q, "project", resumeContext) && unmentionedProjTechs.length === 0;
    if (!isSupported) unsupportedCount++;

    console.log(`${idx + 1}. QUESTION: "${qText}"`);
    console.log(`   PROJECT: "${projName}"`);
    console.log(`   SOURCE: ${source}`);
    console.log(`   EVIDENCE: ${projectEvidenceStr}`);
    console.log(`   SUPPORTED: ${isSupported ? "YES" : "NO"}\n`);
  });

  console.log("========================================");
  console.log("SUMMARY OF QUALITY METRICS");
  console.log("========================================");
  console.log(`Technical questions generated: ${techQuestions.length} / 20`);
  console.log(`Project questions generated: ${projQuestions.length} / 10`);
  console.log(`Unsupported questions count: ${unsupportedCount}`);
  console.log(`Synthetic project count: ${syntheticProjectCount}`);
  console.log(`Invented technology count: ${inventedTechCount}`);
  console.log(`Technical AI calls: ${techRes.aiGenerationCalls || 1}`);
  console.log(`Project AI calls: ${projRes.aiGenerationCalls || 1}`);
  console.log("========================================\n");

  // Cleanup test session DB records
  await RealInterviewTechnicalSession.deleteMany({ sessionId: testSessionId });
  await RealInterviewTechnicalQuestion.deleteMany({ sessionId: testSessionId });
  await RealInterviewProjectSession.deleteMany({ sessionId: testSessionId });
  await RealInterviewProjectQuestion.deleteMany({ sessionId: testSessionId });

  await mongoose.disconnect();
}

run();
