import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../../.env") });

/**
 * Retrieves the dedicated Individual Project API key.
 * Strictly checks process.env.INDIVIDUAL_PROJECT_API_KEY.
 * ABSOLUTELY NO FALLBACK to GROQ_API_KEY or REAL_INTERVIEW_* keys.
 */
export function getIndividualProjectApiKey() {
  const apiKey = (process.env.INDIVIDUAL_PROJECT_API_KEY || "").trim();
  if (!apiKey) {
    console.error("[IndividualProjectConfig] Missing INDIVIDUAL_PROJECT_API_KEY in environment");
    throw new Error("INDIVIDUAL_PROJECT_API_KEY is not configured in environment");
  }
  return apiKey;
}

/**
 * Retrieves the model for Individual Project AI calls.
 */
export function getIndividualProjectModel() {
  return (
    process.env.INDIVIDUAL_PROJECT_MODEL ||
    process.env.GROQ_MODEL ||
    "openai/gpt-oss-120b"
  ).trim();
}

/**
 * Returns question distribution & mark weights for 10 questions.
 * Always totals 100 marks.
 */
export function getProjectDifficultyBreakdown(difficulty = "Mixed") {
  const mode = String(difficulty).trim().toLowerCase();

  if (mode === "easy") {
    return {
      easyCount: 10,
      mediumCount: 0,
      hardCount: 0,
      easyMarks: 10,
      mediumMarks: 0,
      hardMarks: 0,
      totalMaxScore: 100,
    };
  }

  if (mode === "medium") {
    return {
      easyCount: 0,
      mediumCount: 10,
      hardCount: 0,
      easyMarks: 0,
      mediumMarks: 10,
      hardMarks: 0,
      totalMaxScore: 100,
    };
  }

  if (mode === "hard") {
    return {
      easyCount: 0,
      mediumCount: 0,
      hardCount: 10,
      easyMarks: 0,
      mediumMarks: 0,
      hardMarks: 10,
      totalMaxScore: 100,
    };
  }

  // Default: Mixed (4 Easy @ 5, 4 Medium @ 10, 2 Hard @ 20) -> 20 + 40 + 40 = 100
  return {
    easyCount: 4,
    mediumCount: 4,
    hardCount: 2,
    easyMarks: 5,
    mediumMarks: 10,
    hardMarks: 20,
    totalMaxScore: 100,
  };
}
