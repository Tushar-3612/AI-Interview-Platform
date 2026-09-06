import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { generateAptitudeAI } from "../backend/services/realInterviewAI/aptitudeAI.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

console.log("Testing generateAptitudeAI() structure...");
try {
  const result = await generateAptitudeAI();
  console.log("Keys in result:", Object.keys(result));
  console.log("Full result structure:", JSON.stringify(result, null, 2));
} catch (err) {
  console.error("FAILED Error:", err.message);
}
