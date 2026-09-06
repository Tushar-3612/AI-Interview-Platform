import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import { generateAndProcessTechnicalQuestions } from "../services/realInterview/technicalService.js";
import { generateAndProcessProjectQuestions } from "../services/realInterview/projectService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function debug() {
  await connectDB();

  console.log("--- DEBUGGING TECHNICAL GENERATION ---");
  try {
    const resTech = await generateAndProcessTechnicalQuestions({
      sessionId: "DEBUG_SESSION_" + Date.now(),
      candidateProfile: { candidateName: "Debug User", skills: ["React", "Node.js"] },
    });
    console.log("Tech Success:", resTech.success, "Count:", resTech.count);
  } catch (err) {
    console.error("Tech Error Stack:", err);
  }

  console.log("\n--- DEBUGGING PROJECT GENERATION ---");
  try {
    const resProj = await generateAndProcessProjectQuestions({
      sessionId: "DEBUG_SESSION_" + Date.now(),
      candidateProfile: { candidateName: "Debug User", skills: ["React", "Node.js"] },
    });
    console.log("Proj Success:", resProj.success, "Count:", resProj.count);
  } catch (err) {
    console.error("Proj Error Stack:", err);
  }

  process.exit(0);
}

debug();
