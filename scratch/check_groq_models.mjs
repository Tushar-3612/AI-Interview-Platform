import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const key = process.env.REAL_INTERVIEW_TECHNICAL_API_KEY;

const candidateModels = [
  "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-20b",
  "groq/compound"
];

for (const m of candidateModels) {
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: m,
        messages: [{ role: "user", content: "Output a JSON object: {\"status\": \"ok\"}" }],
        response_format: { type: "json_object" }
      })
    });
    const status = res.status;
    const body = await res.text();
    console.log(`Model "${m}": Status ${status} - ${body.slice(0, 150)}`);
  } catch (err) {
    console.log(`Model "${m}": Error ${err.message}`);
  }
}
