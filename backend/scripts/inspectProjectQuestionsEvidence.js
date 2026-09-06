import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import User from "../models/User.js";
import { getOrBuildCandidateResumeContext, isQuestionGroundedInResume } from "../utils/resumeContextBuilder.js";
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
  "Java Swing", "JDBC", "Streamlit", "Linear Regression", "Random Forest", "IoT", "Gemini APIkey"
];

async function run() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(mongoUri);

  const user = await User.findOne({ name: { $regex: /Roshan/i } });
  if (!user) {
    console.error("User Roshan Langhi not found.");
    process.exit(1);
  }

  const candidateContext = await getOrBuildCandidateResumeContext(user);
  const testSessionId = `evidence_session_${Date.now()}`;

  const projRes = await generateAndProcessProjectQuestions({
    userId: null,
    sessionId: testSessionId,
    candidateProfile: candidateContext,
  });

  const questions = projRes.questions || [];

  let syntheticProjectsCount = 0;
  let inventedDetailsCount = 0;
  let unsupportedQuestionsCount = 0;

  console.log("\n========================================");
  console.log("PROJECT QUESTIONS GROUNDING EVIDENCE");
  console.log("========================================\n");

  questions.forEach((q, idx) => {
    const qText = q.question || "";
    const projName = q.projectName || "Unknown Project";

    if (projName.toLowerCase().includes("full-stack web") || projName.toLowerCase().includes("primary project")) {
      syntheticProjectsCount++;
    }

    // Match matched project in resume
    const matchedResumeProject = (candidateContext.projects || []).find(p => {
      const pName = (p.name || p.title || "").toLowerCase();
      const targetName = projName.toLowerCase();
      return pName.includes(targetName) || targetName.includes(pName);
    });

    const resumeEvidenceText = matchedResumeProject
      ? `Project "${matchedResumeProject.name}" listed in resume. Description: "${matchedResumeProject.description || "N/A"}"`
      : "None found in resume";

    const actualTechList = matchedResumeProject
      ? (matchedResumeProject.technologies || [])
      : [];

    // Extract techs mentioned in question
    const techsUsedInQ = [];
    const unsupportedClaims = [];

    KNOWN_TECH_KEYWORDS.forEach(kw => {
      const regex = new RegExp(`\\b${kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (regex.test(qText.toLowerCase())) {
        techsUsedInQ.push(kw);

        // Check if actualTechList or candidateTechSet has it
        const hasTech = actualTechList.some(t => t.toLowerCase().includes(kw.toLowerCase()) || kw.toLowerCase().includes(t.toLowerCase())) ||
          candidateContext.allCandidateTechSet.has(kw.toLowerCase());

        if (!hasTech) {
          unsupportedClaims.push(`Unmentioned technology '${kw}'`);
        }
      }
    });

    if (unsupportedClaims.length > 0) {
      inventedDetailsCount++;
      unsupportedQuestionsCount++;
    }

    const isGrounded = isQuestionGroundedInResume(q, "project", candidateContext) && unsupportedClaims.length === 0;

    console.log(`--- Q${idx + 1} ---`);
    console.log(`QUESTION: ${qText}`);
    console.log(`PROJECT: ${projName}`);
    console.log(`EXACT RESUME EVIDENCE: ${resumeEvidenceText}`);
    console.log(`TECHNOLOGIES USED IN QUESTION: ${techsUsedInQ.length > 0 ? techsUsedInQ.join(", ") : "None specified"}`);
    console.log(`TECHNOLOGIES ACTUALLY PRESENT IN PROJECT: ${actualTechList.length > 0 ? actualTechList.join(", ") : "None listed"}`);
    console.log(`UNSUPPORTED CLAIMS: ${unsupportedClaims.length > 0 ? unsupportedClaims.join("; ") : "None"}`);
    console.log(`GROUNDING: ${isGrounded ? "PASS" : "FAIL"}\n`);
  });

  console.log("========================================");
  console.log(`Synthetic projects: ${syntheticProjectsCount}`);
  console.log(`Invented project details: ${inventedDetailsCount}`);
  console.log(`Unsupported project questions: ${unsupportedQuestionsCount}`);
  console.log("========================================\n");

  // Clean up
  if (mongoose.models.RealInterviewProjectSession) {
    await mongoose.models.RealInterviewProjectSession.deleteMany({ sessionId: testSessionId });
  }
  if (mongoose.models.RealInterviewProjectQuestion) {
    await mongoose.models.RealInterviewProjectQuestion.deleteMany({ sessionId: testSessionId });
  }

  await mongoose.disconnect();
}

run();
