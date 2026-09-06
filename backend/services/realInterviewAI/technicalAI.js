import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../.env") });

import { callPythonGroqBridge } from "./pythonGroqBridge.js";
import { extractJsonFromText } from "./jsonExtractor.js";

function getTechnicalApiKey(attempt = 1) {
  const keys = [
    process.env.REAL_INTERVIEW_TECHNICAL_API_KEY,
    process.env.AI_API_KEY,
    process.env.MOCK_INTERVIEW_API_KEY,
    process.env.REAL_INTERVIEW_PROJECT_API_KEY,
    process.env.REAL_INTERVIEW_CODING_API_KEY,
    process.env.REAL_INTERVIEW_APTITUDE_API_KEY,
  ].map((k) => (k || "").trim()).filter(Boolean);
  const uniqueKeys = Array.from(new Set(keys));
  const apiKey = uniqueKeys[(attempt - 1) % uniqueKeys.length];
  if (!apiKey) {
    console.error("[RealInterviewAI][Technical] Missing API Key");
    throw new Error("REAL_INTERVIEW_TECHNICAL_API_KEY is not configured in environment");
  }
  return apiKey;
}

function getTechnicalModel(attempt = 1) {
  const custom = (process.env.REAL_INTERVIEW_TECHNICAL_MODEL || "").trim();
  if (custom) return custom;
  if (attempt === 1) return "openai/gpt-oss-120b";
  if (attempt === 2) return "openai/gpt-oss-20b";
  return "openai/gpt-oss-120b";
}

/**
 * Generates EXACTLY 20 resume-driven technical questions in ONE single AI API Request (Attempt 1).
 */
export async function generateTechnicalAI(candidateProfile = {}) {
  console.log("\n[REAL-INTERVIEW][AI-CALL]\nround=technical\noperation=generation\nattempt=1");
  const apiKey = getTechnicalApiKey();
  const model = getTechnicalModel();

  const profileSummary = {
    skills: candidateProfile.skills || [],
    programmingLanguages: candidateProfile.programmingLanguages || [],
    frameworks: candidateProfile.frameworks || [],
    databases: candidateProfile.databases || [],
    tools: candidateProfile.tools || [],
    cloud: candidateProfile.cloud || [],
    projects: (candidateProfile.projects || []).map((p) => ({
      name: p.name || "",
      description: p.description || "",
      technologies: p.technologies || [],
      role: p.role || "",
    })),
  };

  const skillsPassed = candidateProfile.skills || [];
  if (skillsPassed.length > 0) {
    console.log(`\n[REAL-INTERVIEW][TECHNICAL-CONTEXT]\nskills=[${skillsPassed.join(", ")}]\n`);
  } else {
    console.log(`\n[REAL-INTERVIEW][TECHNICAL-CONTEXT]\nskills=[] (Resume context unavailable)\n`);
  }

  const prompt = `You are interviewing this candidate based ONLY on the supplied resume context.
Do not invent technologies, frameworks, libraries, databases, cloud services, or tools.
Every candidate-specific technical question must test a technology explicitly listed in the candidate profile.
If a technology is not present in the candidate profile, DO NOT ask about it.
If the candidate profile lacks specific technologies, ask general CS conceptual questions (e.g. Operating Systems, Networks, Data Structures) instead of assuming unmentioned technologies.

Generate a JSON object with key "questions" containing EXACTLY 20 placement-level technical interview questions tailored strictly to the candidate's explicit technical skills.

CANDIDATE PROFILE:
${JSON.stringify(profileSummary, null, 2)}

STRICT RULES:
1. EXTRACT TECHNICAL SKILLS ONLY: ONLY ask questions on skills explicitly listed in the profile. DO NOT introduce unmentioned technologies.
2. SKILL DISTRIBUTION: Distribute the 20 questions proportionally across listed technical skills.
3. PROJECTS ARE NOT TECHNICAL SKILLS: Focus 100% on evaluating the candidate's deep technical knowledge of the TECHNOLOGY itself.
4. DEEP QUESTION PRINCIPLE: Test conceptual depth, WHY, HOW, and trade-offs.
5. DIFFICULTY DISTRIBUTION (EXACTLY 20 QUESTIONS | 100 MARKS TOTAL):
   - 8 Easy questions (3 marks each = 24 marks)
   - 10 Medium questions (5 marks each = 50 marks)
   - 2 Hard questions (13 marks each = 26 marks)

JSON SCHEMA ONLY:
{
  "questions": [
    {
      "question": "Clear deep technical question testing a skill",
      "expectedKnowledge": "Clear evaluation criteria",
      "difficulty": "easy",
      "topic": "Backend Architecture",
      "skillsTested": ["Node.js", "Express.js"]
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
    max_tokens: 3800,
  };

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const currentApiKey = getTechnicalApiKey(attempt);
    const currentModel = getTechnicalModel(attempt);
    try {
      const rawText = await callPythonGroqBridge({
        round: "technical",
        apiKey: currentApiKey,
        model: currentModel,
        messages: requestBody.messages,
        temperature: requestBody.temperature,
        max_tokens: requestBody.max_tokens,
        timeoutMs: 60000,
      });

      const parsed = extractJsonFromText(rawText);

      if (parsed && Array.isArray(parsed.questions) && parsed.questions.length >= 20) {
        console.log(`[RealInterviewAI][Technical] Generated ${parsed.questions.length} questions successfully`);
        return parsed;
      }
      throw new Error(`AI returned ${parsed?.questions?.length || 0} questions (expected 20)`);
    } catch (err) {
      lastError = err;
      console.warn(`[RealInterviewAI][Technical] Generation attempt ${attempt} failed: ${err.message}`);
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 12000));
      }
    }
  }

  throw lastError || new Error("Technical AI generation failed after 3 attempts");
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
