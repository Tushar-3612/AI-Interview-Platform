import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

async function checkModels() {
  const keys = {
    APTITUDE: process.env.REAL_INTERVIEW_APTITUDE_API_KEY,
    TECHNICAL: process.env.REAL_INTERVIEW_TECHNICAL_API_KEY,
    PROJECT: process.env.REAL_INTERVIEW_PROJECT_API_KEY,
    CODING: process.env.REAL_INTERVIEW_CODING_API_KEY,
    HR: process.env.REAL_INTERVIEW_HR_API_KEY,
  };

  for (const [name, key] of Object.entries(keys)) {
    console.log(`\n=== Checking models for ${name} API Key ===`);
    try {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        const data = await res.json();
        const modelIds = (data.data || []).map((m) => m.id);
        console.log(`Status 200. Available models (${modelIds.length}):`, modelIds.join(", "));
      } else {
        const text = await res.text();
        console.log(`Status ${res.status}:`, text);
      }
    } catch (err) {
      console.error(`Fetch error for ${name}:`, err.message);
    }
  }
}

checkModels();
