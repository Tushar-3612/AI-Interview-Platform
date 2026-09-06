import { callPythonGroqBridge } from "../backend/services/realInterviewAI/pythonGroqBridge.js";
import dotenv from "dotenv";
dotenv.config();

const prompt = `Generate a JSON object with key "questions" containing EXACTLY 15 placement-level aptitude questions.

JSON OUTPUT ONLY:
{
  "questions": [
    {
      "question": "Clear problem statement",
      "options": [
        { "label": "A", "text": "Option A" },
        { "label": "B", "text": "Option B" },
        { "label": "C", "text": "Option C" },
        { "label": "D", "text": "Option D" }
      ],
      "correctAnswer": "C",
      "explanation": "Direct derivation.",
      "difficulty": "easy",
      "topic": "Percentage",
      "questionType": "Numerical Aptitude"
    }
  ]
}`;

async function testModel(m) {
  try {
    const rawText = await callPythonGroqBridge({
      round: "aptitude",
      apiKey: process.env.REAL_INTERVIEW_APTITUDE_API_KEY || process.env.AI_API_KEY,
      model: m,
      messages: [
        { role: "system", content: "You are a JSON API endpoint. Output ONLY valid JSON starting immediately with {\"questions\": [...]} without any reasoning, thinking, or commentary." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 3000
    });
    console.log(m + " LENGTH: " + rawText.length);
    const cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```json\s*|```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    console.log(m + " SUCCESS, questions: " + parsed.questions?.length);
  } catch(e) {
    console.log(m + " FAILED: " + e.message);
  }
}

async function run() {
  console.log("Testing llama-3.3-70b-versatile...");
  await testModel("llama-3.3-70b-versatile");
  console.log("Testing llama-3.1-8b-instant...");
  await testModel("llama-3.1-8b-instant");
}
run();
