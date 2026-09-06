import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../.env") });

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function getTechnicalApiKey() {
  const apiKey = (process.env.REAL_INTERVIEW_TECHNICAL_API_KEY || "").trim();
  if (!apiKey) {
    console.error("[RealInterviewAI][Technical] Missing REAL_INTERVIEW_TECHNICAL_API_KEY");
    throw new Error("REAL_INTERVIEW_TECHNICAL_API_KEY is not configured in environment");
  }
  return apiKey;
}

function getTechnicalModel() {
  const custom = (process.env.REAL_INTERVIEW_TECHNICAL_MODEL || "").trim();
  if (custom) return custom;
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
      "expectedKnowledge": "Key technical concepts expected",
      "difficulty": "medium",
      "maxMarks": 5,
      "topic": "React / State Management",
      "category": "Technology Specific",
      "source": "resume",
      "relatedSkill": "React"
    }
  ]
}`;

  const requestBody = {
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a technical interviewer. Output ONLY a valid JSON object matching schema with EXACTLY 20 questions based on candidate profile.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 3800,
    max_completion_tokens: 3800,
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
      throw new Error("Technical AI request timed out");
    }
    console.error("[RealInterviewAI][Technical] Fetch error:", err.message);
    throw new Error(`Failed to connect to Technical AI provider: ${err.message}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("[RealInterviewAI][Technical] HTTP Error:", response.status, errorText);
    throw new Error(`Technical AI request failed with status ${response.status}: ${errorText}`);
  }

  const responseData = await response.json();
  const rawText = responseData?.choices?.[0]?.message?.content || "";

  if (!rawText.trim()) {
    throw new Error("Technical AI returned an empty response");
  }

  let parsed;
  try {
    const cleanJson = rawText.replace(/```json\s*|\s*```/g, "").trim();
    parsed = JSON.parse(cleanJson);
  } catch (parseErr) {
    console.error("[RealInterviewAI][Technical] JSON Parse error:", parseErr.message);
    throw new Error("Technical AI returned invalid JSON format");
  }

  if (!parsed || !Array.isArray(parsed.questions)) {
    throw new Error("Technical AI response missing 'questions' array");
  }

  console.log(`[RealInterviewAI][Technical] Generated ${parsed.questions.length} questions successfully`);
  return parsed;
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
    max_completion_tokens: 2560,
    response_format: { type: "json_object" },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);

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
      throw new Error("Technical evaluation AI request timed out");
    }
    console.error("[RealInterviewAI][Technical] Evaluation fetch error:", err.message);
    throw new Error(`Failed to connect to Technical Evaluation AI provider: ${err.message}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("[RealInterviewAI][Technical] Evaluation HTTP Error:", response.status, errorText);
    throw new Error(`Technical evaluation AI request failed with status ${response.status}: ${errorText}`);
  }

  const responseData = await response.json();
  const rawText = responseData?.choices?.[0]?.message?.content || "";

  if (!rawText.trim()) {
    throw new Error("Technical evaluation AI returned empty response");
  }

  let parsed;
  try {
    const cleanJson = rawText.replace(/```json\s*|\s*```/g, "").trim();
    parsed = JSON.parse(cleanJson);
  } catch (parseErr) {
    console.error("[RealInterviewAI][Technical] Evaluation JSON Parse error:", parseErr.message);
    throw new Error("Technical evaluation AI returned invalid JSON format");
  }

  if (!parsed || !Array.isArray(parsed.evaluations)) {
    throw new Error("Technical evaluation AI response missing 'evaluations' array");
  }

  console.log(`[RealInterviewAI][Technical] Complete evaluation finished for ${parsed.evaluations.length} questions`);
  return parsed;
}
