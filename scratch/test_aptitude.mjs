import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { generateAptitudeAI } from "../backend/services/realInterviewAI/aptitudeAI.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

async function test() {
  console.log("Testing generateAptitudeAI()...");
  const result = await generateAptitudeAI();
  console.log("Questions generated:", result.questions?.length);
  if (result.questions && result.questions.length >= 15) {
    console.log("SUCCESS! Q1:", result.questions[0].question);
    console.log("SUCCESS! Q15:", result.questions[14].question);
  }
}

test().catch(console.error);
