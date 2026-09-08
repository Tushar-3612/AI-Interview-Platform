import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../../.env") });

/**
 * Retrieves the dedicated Individual Technical API key.
 * Strictly checks process.env.INDIVIDUAL_TECHNICAL_API_KEY.
 * ABSOLUTELY NO FALLBACK to GROQ_API_KEY or REAL_INTERVIEW_* keys.
 */
export function getIndividualTechnicalApiKey() {
  const apiKey = (process.env.INDIVIDUAL_TECHNICAL_API_KEY || "").trim();
  if (!apiKey) {
    console.error("[IndividualTechnicalConfig] Missing INDIVIDUAL_TECHNICAL_API_KEY in environment");
    throw new Error("INDIVIDUAL_TECHNICAL_API_KEY is not configured in environment");
  }
  return apiKey;
}

/**
 * Retrieves the model for Individual Technical AI calls.
 */
export function getIndividualTechnicalModel() {
  return (
    process.env.INDIVIDUAL_TECHNICAL_MODEL ||
    process.env.GROQ_MODEL ||
    "openai/gpt-oss-120b"
  ).trim();
}

/**
 * Raw difficulty weights.
 * Easy = 3, Medium = 5, Hard = 13.
 */
export const DIFFICULTY_WEIGHTS = {
  Easy: 3,
  Medium: 5,
  Hard: 13,
};

/**
 * Batch specifications for controlled 20-question generation.
 */
export function getBatchSpecsForDifficulty(difficulty = "Mixed") {
  const mode = String(difficulty).trim().toLowerCase();

  if (mode === "easy") {
    return [
      { batchIndex: 1, count: 3, easy: 3, medium: 0, hard: 0, range: "Q1-Q3" },
      { batchIndex: 2, count: 3, easy: 3, medium: 0, hard: 0, range: "Q4-Q6" },
      { batchIndex: 3, count: 3, easy: 3, medium: 0, hard: 0, range: "Q7-Q9" },
      { batchIndex: 4, count: 3, easy: 3, medium: 0, hard: 0, range: "Q10-Q12" },
      { batchIndex: 5, count: 3, easy: 3, medium: 0, hard: 0, range: "Q13-Q15" },
      { batchIndex: 6, count: 3, easy: 3, medium: 0, hard: 0, range: "Q16-Q18" },
      { batchIndex: 7, count: 2, easy: 2, medium: 0, hard: 0, range: "Q19-Q20" },
    ];
  }

  if (mode === "medium") {
    return [
      { batchIndex: 1, count: 3, easy: 0, medium: 3, hard: 0, range: "Q1-Q3" },
      { batchIndex: 2, count: 3, easy: 0, medium: 3, hard: 0, range: "Q4-Q6" },
      { batchIndex: 3, count: 3, easy: 0, medium: 3, hard: 0, range: "Q7-Q9" },
      { batchIndex: 4, count: 3, easy: 0, medium: 3, hard: 0, range: "Q10-Q12" },
      { batchIndex: 5, count: 3, easy: 0, medium: 3, hard: 0, range: "Q13-Q15" },
      { batchIndex: 6, count: 3, easy: 0, medium: 3, hard: 0, range: "Q16-Q18" },
      { batchIndex: 7, count: 2, easy: 0, medium: 2, hard: 0, range: "Q19-Q20" },
    ];
  }

  if (mode === "hard") {
    return [
      { batchIndex: 1, count: 3, easy: 0, medium: 0, hard: 3, range: "Q1-Q3" },
      { batchIndex: 2, count: 3, easy: 0, medium: 0, hard: 3, range: "Q4-Q6" },
      { batchIndex: 3, count: 3, easy: 0, medium: 0, hard: 3, range: "Q7-Q9" },
      { batchIndex: 4, count: 3, easy: 0, medium: 0, hard: 3, range: "Q10-Q12" },
      { batchIndex: 5, count: 3, easy: 0, medium: 0, hard: 3, range: "Q13-Q15" },
      { batchIndex: 6, count: 3, easy: 0, medium: 0, hard: 3, range: "Q16-Q18" },
      { batchIndex: 7, count: 2, easy: 0, medium: 0, hard: 2, range: "Q19-Q20" },
    ];
  }

  // Default: Mixed (8 Easy, 10 Medium, 2 Hard)
  return [
    { batchIndex: 1, count: 3, easy: 3, medium: 0, hard: 0, range: "Q1-Q3" },
    { batchIndex: 2, count: 3, easy: 3, medium: 0, hard: 0, range: "Q4-Q6" },
    { batchIndex: 3, count: 3, easy: 2, medium: 1, hard: 0, range: "Q7-Q9" },
    { batchIndex: 4, count: 3, easy: 0, medium: 3, hard: 0, range: "Q10-Q12" },
    { batchIndex: 5, count: 3, easy: 0, medium: 3, hard: 0, range: "Q13-Q15" },
    { batchIndex: 6, count: 3, easy: 0, medium: 3, hard: 0, range: "Q16-Q18" },
    { batchIndex: 7, count: 2, easy: 0, medium: 0, hard: 2, range: "Q19-Q20" },
  ];
}
