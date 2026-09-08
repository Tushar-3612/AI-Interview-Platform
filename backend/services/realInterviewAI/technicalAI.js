import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../.env") });

import { callPythonGroqBridge } from "./pythonGroqBridge.js";
import { extractJsonFromText } from "./jsonExtractor.js";

function getTechnicalApiKey() {
  const apiKey = (process.env.REAL_INTERVIEW_TECHNICAL_API_KEY || process.env.GROQ_API_KEY || "").trim();
  if (!apiKey) {
    console.error("[RealInterviewAI][Technical] Missing API Key");
    throw new Error("REAL_INTERVIEW_TECHNICAL_API_KEY is not configured in environment");
  }
  return apiKey;
}

function getTechnicalModel() {
  return (process.env.REAL_INTERVIEW_TECHNICAL_MODEL || process.env.GROQ_MODEL || "openai/gpt-oss-120b").trim();
}

/**
 * Generates EXACTLY 20 resume-driven technical questions using 7 AI requests (Max 3 questions per batch).
 * Batch 1: Q1-Q3 (3 Easy)
 * Batch 2: Q4-Q6 (3 Easy)
 * Batch 3: Q7-Q9 (2 Easy, 1 Medium) -> Total 8 Easy, 1 Medium
 * Batch 4: Q10-Q12 (3 Medium)
 * Batch 5: Q13-Q15 (3 Medium)
 * Batch 6: Q16-Q18 (3 Medium) -> Total 10 Medium
 * Batch 7: Q19-Q20 (2 Hard) -> Total 2 Hard
 */
export async function generateTechnicalAI(candidateProfile = {}) {
  console.log("\n[REAL-INTERVIEW][AI-CALL]\nround=technical\noperation=batch_generation\ntotal_batches=7");
  const apiKey = getTechnicalApiKey();
  const model = getTechnicalModel();

  // Extract lightweight skill context (avoid sending full resume details in every request)
  const skillsList = [
    ...(candidateProfile.skills || []),
    ...(candidateProfile.programmingLanguages || []),
    ...(candidateProfile.frameworks || []),
    ...(candidateProfile.databases || []),
    ...(candidateProfile.tools || []),
    ...(candidateProfile.cloud || []),
  ].map((s) => String(s).trim()).filter(Boolean);

  const uniqueSkills = Array.from(new Set(skillsList));
  const skillsContextStr = uniqueSkills.length > 0
    ? uniqueSkills.slice(0, 15).join(", ")
    : "Computer Science Fundamentals, Data Structures, OOP, Software Engineering Principles";

  console.log(`[REAL-INTERVIEW][TECHNICAL-CONTEXT]\nskills=[${skillsContextStr}]\n`);

  const BATCH_SPECS = [
    { batchIndex: 1, count: 3, easy: 3, medium: 0, hard: 0, range: "Q1-Q3" },
    { batchIndex: 2, count: 3, easy: 3, medium: 0, hard: 0, range: "Q4-Q6" },
    { batchIndex: 3, count: 3, easy: 2, medium: 1, hard: 0, range: "Q7-Q9" },
    { batchIndex: 4, count: 3, easy: 0, medium: 3, hard: 0, range: "Q10-Q12" },
    { batchIndex: 5, count: 3, easy: 0, medium: 3, hard: 0, range: "Q13-Q15" },
    { batchIndex: 6, count: 3, easy: 0, medium: 3, hard: 0, range: "Q16-Q18" },
    { batchIndex: 7, count: 2, easy: 0, medium: 0, hard: 2, range: "Q19-Q20" },
  ];

  const allBatchQuestions = [];

  for (const spec of BATCH_SPECS) {
    console.log(`[TechnicalAI] Executing AI Call for Batch ${spec.batchIndex}/7 (${spec.range})...`);

    const prompt = `You are generating placement-level technical interview questions for a candidate with these explicit technical skills: ${skillsContextStr}.
Generate EXACTLY ${spec.count} technical interview question(s) for batch ${spec.range}.

DIFFICULTY REQUIREMENTS FOR THIS BATCH (${spec.count} questions total):
${spec.easy > 0 ? `- ${spec.easy} Easy question(s) (3 marks each)` : ""}
${spec.medium > 0 ? `- ${spec.medium} Medium question(s) (5 marks each)` : ""}
${spec.hard > 0 ? `- ${spec.hard} Hard question(s) (13 marks each)` : ""}

RULES:
1. ONLY ask about the candidate's explicit technical skills listed above.
2. Test deep conceptual understanding, WHY, HOW, and trade-offs.
3. Do NOT invent unmentioned technologies.
4. Output ONLY valid JSON starting immediately with {"questions": [...]}.

JSON SCHEMA:
{
  "questions": [
    {
      "question": "Deep technical question",
      "expectedKnowledge": "Evaluation criteria and key expected points",
      "difficulty": "easy",
      "topic": "Core Principle",
      "skillsTested": ["Node.js"]
    }
  ]
}`;

    try {
      const rawText = await callPythonGroqBridge({
        round: "technical",
        apiKey,
        model,
        messages: [
          {
            role: "system",
            content: "You are a JSON API endpoint. Output ONLY valid JSON starting immediately with {\"questions\": [...]} without any markdown or commentary.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 1200,
        timeoutMs: 45000,
      });

      const parsed = extractJsonFromText(rawText);
      if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        throw new Error(`Batch ${spec.batchIndex} returned invalid or empty questions array`);
      }

      const batchQuestions = parsed.questions.slice(0, spec.count).map((q, qIdx) => {
        let diff = "medium";
        if (spec.easy > 0 && qIdx < spec.easy) diff = "easy";
        else if (spec.hard > 0 && qIdx >= (spec.count - spec.hard)) diff = "hard";
        else if (spec.medium > 0) diff = "medium";

        const validDiff = ["easy", "medium", "hard"].includes(diff) ? diff : "medium";
        const maxMarks = validDiff === "easy" ? 3 : validDiff === "hard" ? 13 : 5;

        return {
          question: String(q.question || "").trim(),
          expectedKnowledge: String(q.expectedKnowledge || q.expected_knowledge || q.expectedAnswer || "Comprehensive technical explanation.").trim(),
          difficulty: validDiff,
          maxMarks,
          topic: String(q.topic || "Technical Concept").trim(),
          skillsTested: Array.isArray(q.skillsTested) ? q.skillsTested : [skillsContextStr.split(",")[0] || "General"],
        };
      });

      allBatchQuestions.push(...batchQuestions);
      console.log(`[TechnicalAI] Batch ${spec.batchIndex}/7 (${spec.range}) SUCCESS: ${batchQuestions.length} questions generated.`);
    } catch (err) {
      console.error(`[TechnicalAI] Batch ${spec.batchIndex}/7 FAILED: ${err.message}`);
      // Immediately stop generation on 429 or quota/network error — do not retry repeatedly or use fake fallback
      throw new Error(`Technical AI generation failed on Batch ${spec.batchIndex} (${spec.range}): ${err.message}`);
    }
  }

  if (allBatchQuestions.length < 20) {
    throw new Error(`Technical AI batch generation produced ${allBatchQuestions.length} questions (expected 20)`);
  }

  console.log(`[TechnicalAI] All 7 batches completed successfully! Combined total: ${allBatchQuestions.length} questions.`);
  return { questions: allBatchQuestions };
}

/**
 * Evaluates candidate technical answers in ONE single AI API Request (Attempt 1).
 */
export async function evaluateTechnicalInterviewAI({ candidateProfile = {}, questions = [] }) {
  console.log("\n[REAL-INTERVIEW][AI-CALL]\nround=technical\noperation=evaluation\nattempt=1");

  const skillsPassed = candidateProfile.skills || [];
  if (skillsPassed.length > 0) {
    console.log(`[REAL-INTERVIEW][TECHNICAL-EVAL-CONTEXT]\nskills=[${skillsPassed.join(", ")}]\n`);
  } else {
    console.log(`[REAL-INTERVIEW][TECHNICAL-EVAL-CONTEXT]\nskills=[] (Resume context unavailable)\n`);
  }

  const apiKey = getTechnicalApiKey();
  const model = getTechnicalModel();

  const formattedQuestions = questions.map((q, idx) => ({
    i: idx + 1,
    id: String(q.questionId || q.id || idx),
    q: String(q.question || ""),
    diff: String(q.difficulty || "medium"),
    max: Number(q.maxScore || q.maxMarks || (q.difficulty === "easy" ? 3 : q.difficulty === "hard" ? 13 : 5)),
    ans: String(q.candidateAnswer || "(No answer provided)").trim(),
  }));

  const prompt = `You are a fair technical interviewer evaluating candidate responses for a Technical Interview session in ONE assessment.

QUESTIONS & CANDIDATE ANSWERS:
${JSON.stringify(formattedQuestions, null, 2)}

FAIR EVALUATION INSTRUCTIONS:
1. TECHNICAL UNDERSTANDING FIRST: Judge candidate's technical knowledge and core concepts.
2. DIFFICULTY MARKS:
   - Easy (maxScore 3): 0=incorrect, 1=partial, 2=mostly correct, 3=correct
   - Medium (maxScore 5): 0=incorrect, 1=very limited, 2=partial, 3=acceptable, 4=strong, 5=excellent
   - Hard (maxScore 13): 0=incorrect, 1-3=weak, 4-6=partial, 7-9=acceptable, 10-11=strong, 12-13=excellent
3. UNANSWERED ITEMS: Set score = 0, missingPoints = ["Question was not attempted"].
4. OVERALL METRICS: totalScore (sum of scores out of 100), maxScore: 100, percentage, overallRating, strengths, weaknesses, finalFeedback.

JSON SCHEMA ONLY:
{
  "evaluations": [
    {
      "questionId": "string matching id",
      "score": 4,
      "maxScore": 5,
      "difficulty": "medium",
      "rating": "Strong",
      "correctPoints": ["Valid point"],
      "missingPoints": ["Missing point"],
      "incorrectPoints": [],
      "grammarIssues": [],
      "feedback": "Concise feedback",
      "betterAnswer": "Refined answer preserving candidate ideas"
    }
  ],
  "totalScore": 78,
  "maxScore": 100,
  "percentage": 78,
  "overallRating": "Strong",
  "strengths": ["Solid React state understanding"],
  "weaknesses": ["Shallow async error handling"],
  "finalFeedback": "Overall candidate summary..."
}`;

  const requestBody = {
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a technical interviewer evaluator. Output ONLY valid JSON matching the requested schema.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 2560,
  };

  const rawText = await callPythonGroqBridge({
    round: "technical",
    apiKey,
    model,
    messages: requestBody.messages,
    temperature: requestBody.temperature,
    max_tokens: requestBody.max_tokens,
    timeoutMs: 90000,
  });

  const parsed = extractJsonFromText(rawText);

  if (!parsed || !Array.isArray(parsed.evaluations)) {
    throw new Error("Technical evaluation AI response missing 'evaluations' array");
  }

  console.log(`[RealInterviewAI][Technical] Complete evaluation finished for ${parsed.evaluations.length} questions`);
  return parsed;
}
