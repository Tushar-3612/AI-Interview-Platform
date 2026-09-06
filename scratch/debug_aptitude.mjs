import { callPythonGroqBridge } from "../backend/services/realInterviewAI/pythonGroqBridge.js";
import dotenv from "dotenv";
dotenv.config();

const prompt = `Generate a JSON object with key "questions" containing EXACTLY 15 placement-level aptitude questions.

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

async function test() {
  const rawText = await callPythonGroqBridge({
    round: "aptitude",
    apiKey: process.env.AI_API_KEY,
    model: "openai/gpt-oss-20b",
    messages: [
      { role: "system", content: "You are a JSON API endpoint. Output ONLY valid JSON starting immediately with {\"questions\": [...]} without any reasoning, thinking, or commentary." },
      { role: "user", content: prompt }
    ],
    temperature: 0.1,
    max_tokens: 3000
  });

  console.log("--- RAW LENGTH:", rawText.length);
  console.log("--- RAW TEXT START:\n", rawText.slice(0, 400));
  console.log("--- RAW TEXT END:\n", rawText.slice(-400));
}

test().catch(console.error);
