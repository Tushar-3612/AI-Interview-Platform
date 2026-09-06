import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../.env") });

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function getAptitudeApiKey() {
  const apiKey = (process.env.REAL_INTERVIEW_APTITUDE_API_KEY || "").trim();
  if (!apiKey) {
    console.error("[RealInterviewAI][Aptitude] Missing REAL_INTERVIEW_APTITUDE_API_KEY");
    throw new Error("REAL_INTERVIEW_APTITUDE_API_KEY is not configured in environment");
  }
  return apiKey;
}

function getAptitudeModel() {
  return (process.env.REAL_INTERVIEW_APTITUDE_MODEL || "openai/gpt-oss-120b").trim();
}

/**
 * Dedicated Real Interview Aptitude AI Generator.
 * Uses STRICTLY process.env.REAL_INTERVIEW_APTITUDE_API_KEY.
 * Makes EXACTLY 1 AI API request (Attempt 1).
 */
export async function generateAptitudeAI() {
  console.log("\n[REAL-INTERVIEW][AI-CALL]\nround=aptitude\noperation=generation\nattempt=1");

  const apiKey = getAptitudeApiKey();
  const model = getAptitudeModel();

  const prompt = `Generate a JSON object with key "questions" containing EXACTLY 15 placement-level aptitude questions. Use clear, integer or simple decimal values.

DIFFICULTY BREAKDOWN (EXACTLY 15 QUESTIONS):
- Questions 1 to 5: "difficulty": "easy"
- Questions 6 to 10: "difficulty": "medium"
- Questions 11 to 15: "difficulty": "hard"

CRITICAL FORMATTING CONSTRAINTS:
1. "questions" MUST be an array of EXACTLY 15 objects.
2. Correct answer choices ("A", "B", "C", "D") MUST be balanced across the 15 questions (approx 3 to 4 of each label).
3. "options": Array of 4 objects: [{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}].
4. "explanation": 1 short concise sentence stating the formula/step.
5. "topic": Specific topic name (e.g. "Percentage", "Time & Work", "Probability").
6. "questionType": "Numerical Aptitude", "Logical Reasoning", "Data Interpretation", or "Verbal Reasoning".

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
        content: "You are a JSON API endpoint. Output ONLY a valid JSON object matching the requested schema. Ensure all mathematical calculations and options are verified beforehand.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.1,
    max_tokens: 2800,
    max_completion_tokens: 2800,
    response_format: { type: "json_object" },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  let response;
  try {
    response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err?.name === "AbortError") {
      throw new Error("Aptitude AI request timed out");
    }
    console.error("[RealInterviewAI][Aptitude] Fetch error:", err.message);
    throw new Error(`Failed to connect to Aptitude AI provider: ${err.message}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("[RealInterviewAI][Aptitude] HTTP Error:", response.status, errorText);
    throw new Error(`Aptitude AI request failed with status ${response.status}: ${errorText}`);
  }

  const responseData = await response.json();
  const rawText = responseData?.choices?.[0]?.message?.content || "";

  if (!rawText.trim()) {
    throw new Error("Aptitude AI returned an empty response");
  }

  let parsed;
  try {
    const cleanJson = rawText.replace(/```json\s*|\s*```/g, "").trim();
    parsed = JSON.parse(cleanJson);
  } catch (parseErr) {
    console.error("[RealInterviewAI][Aptitude] JSON Parse error:", parseErr.message);
    throw new Error("Aptitude AI returned invalid JSON format");
  }

  console.log("[RealInterviewAI][Aptitude] Generated 15 questions successfully");
  return parsed;
}
