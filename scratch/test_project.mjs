import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { generateProjectAI } from "../backend/services/realInterviewAI/projectAI.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

async function test() {
  console.log("Testing generateProjectAI()...");
  const result = await generateProjectAI({
    projects: [
      {
        name: "AI-Powered Resume Parsing and Job Matching System",
        technologies: ["Python", "FastAPI", "SpaCy", "Scikit-learn", "React", "PostgreSQL"],
        description: "Developed an automated resume parsing engine that extracts skills, work experience, and educational background from PDF and DOCX files."
      },
      {
        name: "Customer Churn Prediction System",
        technologies: ["Python", "Pandas", "NumPy", "Scikit-learn", "Flask", "MySQL", "Docker"],
        description: "Implemented machine learning classification algorithms (Random Forest, XGBoost) to predict customer churn probability."
      }
    ]
  });
  console.log("Questions generated:", result.questions?.length);
  if (result.questions && result.questions.length >= 10) {
    console.log("SUCCESS! Q1:", result.questions[0].question);
    console.log("SUCCESS! Q10:", result.questions[9].question);
  }
}

test().catch(console.error);
