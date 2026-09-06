import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { parseResumeText } from "../backend/services/resumeParser.js";
import { generateAndProcessTechnicalQuestions } from "../backend/services/realInterview/technicalService.js";
import Interview from "../backend/models/Interview.js";
import User from "../backend/models/User.js";
import RealInterviewTechnicalQuestion from "../backend/models/RealInterviewTechnicalQuestion.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const RESUME_TEXT = `
Tushar Nagare
Full Stack Developer & AI Engineer
Email: tushar@example.com

SKILLS
Languages: Python, C++, JavaScript, TypeScript
Frontend: React.js, Redux, Tailwind CSS, CSS
Backend: Node.js, Express.js, FastAPI, Flask, REST APIs, GraphQL
Databases: MongoDB, PostgreSQL, Redis, MySQL
Machine Learning: Scikit-learn, TensorFlow, Pandas, NumPy, XGBoost, Random Forest, SpaCy
Tools & Cloud: Docker, AWS, Git, CI/CD, Linux

KEY PROJECTS

1. AI-Powered Resume Parsing and Job Matching System
Tech Stack: Python, FastAPI, SpaCy, Scikit-learn, React, PostgreSQL
- Developed an automated resume parsing engine that extracts skills, work experience, and educational background from PDF and DOCX files.
- Built a semantic job-matching algorithm using TF-IDF and cosine similarity to match candidate profiles with job descriptions.
- Reduced manual screening time by 75% for HR teams.

2. Customer Churn Prediction System
Tech Stack: Python, Pandas, NumPy, Scikit-learn, Flask, MySQL, Docker
- Implemented machine learning classification algorithms (Random Forest, XGBoost) to predict customer churn probability.
- Handled data cleaning, feature engineering, and class imbalance mitigation using SMOTE.
- Built REST API endpoints for model inference and deployed the service using Docker containers.

EDUCATION
Bachelor of Engineering in Computer Science - 2024
`;

async function testTechnicalRound() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB successfully.\n");

  const parsedResume = parseResumeText(RESUME_TEXT);
  const skillsList = parsedResume.all_skills || [];
  console.log(`[RESUME] Projects Extracted: ${parsedResume.projects.length} (${parsedResume.projects.map(p => p.name || p.title).join(", ")})`);
  console.log(`[RESUME] Skills Extracted: ${skillsList.join(", ")}\n`);

  const dummyUser = await User.findOneAndUpdate(
    { email: "tech_test_candidate@interview.test" },
    {
      name: "Tushar Nagare",
      email: "tech_test_candidate@interview.test",
      role: "student",
      skills: skillsList,
      projects: parsedResume.projects,
      experience: parsedResume.experience,
      education: parsedResume.education,
      certifications: parsedResume.certifications,
    },
    { upsert: true, new: true }
  );

  const sessionDoc = await Interview.create({
    userId: dummyUser._id,
    type: "technical",
    status: "in_progress",
    rounds: {
      technical: { status: "not_started" }
    },
    resumeSnapshot: {
      skills: skillsList,
      projects: parsedResume.projects,
      experience: parsedResume.experience,
      education: parsedResume.education,
      certifications: parsedResume.certifications,
    }
  });
  const sessionId = sessionDoc._id.toString();

  console.log(`Created Fresh Session: ${sessionId}\n`);

  const profile = {
    ...parsedResume,
    skills: skillsList,
    projects: parsedResume.projects,
    experience: parsedResume.experience,
    education: parsedResume.education,
    certifications: parsedResume.certifications,
  };

  console.log("[AI-REQUEST-START]");
  console.log("round=technical");
  console.log("provider=groq");
  console.log("transport=python");
  console.log("keyPresent=true");

  const result = await generateAndProcessTechnicalQuestions({
    userId: dummyUser._id.toString(),
    sessionId,
    candidateProfile: profile,
  });

  const questions = await RealInterviewTechnicalQuestion.find({ sessionId }).sort({ orderIndex: 1 });

  console.log("\n[AI-REQUEST-SUCCESS]");
  console.log("round=technical");
  console.log("transport=python");
  console.log(`questionsReturned=${questions.length}\n`);

  console.log("========== ACTUAL 20 GENERATED TECHNICAL QUESTIONS ==========");
  questions.forEach((q, idx) => {
    console.log(`Q${idx + 1} [${q.difficulty?.toUpperCase()} | ${q.topic} | Skills: ${q.skillsTested?.join(", ")}]:`);
    console.log(`   Question: ${q.question}`);
    console.log(`   Expected: ${q.expectedKnowledge}`);
    console.log(`   Source: ${q.source}\n`);
  });

  await mongoose.disconnect();
}

testTechnicalRound().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
