import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const question = "What is inheritance in Java?";

const studentAnswer =
  "Inheritance means one class can use properties and methods of another class.";

async function evaluateAnswer() {
  const prompt = `
You are a technical interview evaluator for Java developer interviews.

Evaluate the student's answer fairly and consistently.

QUESTION:
${question}

STUDENT ANSWER:
${studentAnswer}

Evaluate using these criteria:
- Technical Accuracy: 0 to 10
- Relevance: 0 to 10
- Clarity: 0 to 10
- Completeness: 0 to 10

Return ONLY valid JSON.

Use exactly this format:

{
  "technicalAccuracy": 0,
  "relevance": 0,
  "clarity": 0,
  "completeness": 0,
  "strength": "",
  "weakness": "",
  "feedback": "",
  "nextDifficulty": "easy | medium | hard"
}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const evaluation = JSON.parse(response.text);

    const finalScore =
      evaluation.technicalAccuracy * 0.40 +
      evaluation.relevance * 0.25 +
      evaluation.clarity * 0.20 +
      evaluation.completeness * 0.15;

    const finalPercentage = finalScore * 10;

    console.log("\n===== AI INTERVIEW EVALUATION =====\n");

    console.log(
      "Technical Accuracy:",
      evaluation.technicalAccuracy
    );

    console.log(
      "Relevance:",
      evaluation.relevance
    );

    console.log(
      "Clarity:",
      evaluation.clarity
    );

    console.log(
      "Completeness:",
      evaluation.completeness
    );

    console.log(
      "\nStrength:",
      evaluation.strength
    );

    console.log(
      "\nWeakness:",
      evaluation.weakness
    );

    console.log(
      "\nFeedback:",
      evaluation.feedback
    );

    console.log(
      "\nNext Difficulty:",
      evaluation.nextDifficulty
    );

    console.log(
      "\nFinal Score:",
      finalScore.toFixed(2),
      "/ 10"
    );

    console.log(
      "Final Percentage:",
      finalPercentage.toFixed(2),
      "%"
    );

  } catch (error) {
    console.error("Evaluation Error:", error.message);
  }
}

evaluateAnswer();