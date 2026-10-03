import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../.env") });

import { callPythonGroqBridge } from "./pythonGroqBridge.js";
import { extractJsonFromText } from "./jsonExtractor.js";

function getAptitudeApiKey(attempt = 1) {
  const keys = [
    process.env.REAL_INTERVIEW_APTITUDE_API_KEY,
    process.env.AI_API_KEY,
    process.env.MOCK_INTERVIEW_API_KEY,
    process.env.REAL_INTERVIEW_TECHNICAL_API_KEY,
    process.env.REAL_INTERVIEW_PROJECT_API_KEY,
    process.env.REAL_INTERVIEW_CODING_API_KEY,
  ].map((k) => (k || "").trim()).filter(Boolean);
  const uniqueKeys = Array.from(new Set(keys));
  const apiKey = uniqueKeys[(attempt - 1) % uniqueKeys.length];
  if (!apiKey) {
    console.error("[RealInterviewAI][Aptitude] Missing API key");
    throw new Error("REAL_INTERVIEW_APTITUDE_API_KEY is not configured in environment");
  }
  return apiKey;
}

function getAptitudeModel(attempt = 1) {
  const custom = (process.env.REAL_INTERVIEW_APTITUDE_MODEL || "").trim();
  if (custom) return custom;
  if (attempt === 1) return "openai/gpt-oss-120b";
  if (attempt === 2) return "openai/gpt-oss-20b";
  return "openai/gpt-oss-120b";
}

export async function generateAptitudeAI() {
  console.log("\n[REAL-INTERVIEW][AI-CALL]\nround=aptitude\noperation=generation\nattempt=1");

  const apiKey = getAptitudeApiKey();
  const model = getAptitudeModel(1);

  const prompt = `Generate a JSON object with key "questions" containing EXACTLY 15 placement-level aptitude questions. Use clear, integer or simple decimal values.

DIFFICULTY BREAKDOWN (EXACTLY 15 QUESTIONS):
- Questions 1 to 5: "difficulty": "easy"
- Questions 6 to 10: "difficulty": "medium"
- Questions 11 to 15: "difficulty": "hard"

CRITICAL FORMATTING CONSTRAINTS:
1. "questions" MUST be an array of EXACTLY 15 objects.
2. "options": Array of 4 objects: [{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}].
3. "explanation": 1 short concise sentence stating the formula/step.
4. "topic": Specific topic name (e.g. "Percentage", "Time & Work", "Probability").
5. "questionType": "Numerical Aptitude", "Logical Reasoning", "Data Interpretation", or "Verbal Reasoning".

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
      "explanation": "Direct one-sentence derivation.",
      "difficulty": "easy",
      "topic": "Percentage",
      "questionType": "Numerical Aptitude"
    }
  ]
}`;

  const requestBody = {
    model,
    messages: [
      {
        role: "system",
        content: "You are a JSON API endpoint. Output ONLY valid JSON starting immediately with {\"questions\": [...]} without any reasoning, thinking, or commentary.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.1,
    max_tokens: 3500,
  };

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const currentApiKey = getAptitudeApiKey(attempt);
    const currentModel = getAptitudeModel(attempt);
    let rawText = "";
    try {
      rawText = await callPythonGroqBridge({
        round: "aptitude",
        apiKey: currentApiKey,
        model: currentModel,
        messages: requestBody.messages,
        temperature: requestBody.temperature,
        max_tokens: requestBody.max_tokens,
        timeoutMs: 60000,
      });

      const parsed = extractJsonFromText(rawText);

      if (parsed && Array.isArray(parsed.questions) && parsed.questions.length >= 15) {
        console.log("[RealInterviewAI][Aptitude] Generated 15 questions successfully");
        return parsed;
      }
      throw new Error(`AI returned ${parsed?.questions?.length || 0} questions (expected 15)`);
    } catch (err) {
      lastError = err;
      console.warn(`[RealInterviewAI][Aptitude] Generation attempt ${attempt} failed: ${err.message}`);
      if (rawText) {
        console.log("DEBUG RAW LENGTH:", rawText.length);
        console.log("DEBUG RAW START:", rawText.slice(0, 300));
        console.log("DEBUG RAW END:", rawText.slice(-300));
      }
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 8000));
      }
    }
  }

  throw lastError || new Error("Aptitude AI generation failed after 3 attempts");
}
