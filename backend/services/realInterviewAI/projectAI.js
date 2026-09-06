import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../.env") });

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function getProjectApiKey() {
  const apiKey = (process.env.REAL_INTERVIEW_PROJECT_API_KEY || "").trim();

  if (!apiKey) {
    console.error("[RealInterviewAI][Project] Missing REAL_INTERVIEW_PROJECT_API_KEY");
    throw new Error("REAL_INTERVIEW_PROJECT_API_KEY is not configured in environment");
  }
  return apiKey;
}

function getProjectModel() {
  const custom = (process.env.REAL_INTERVIEW_PROJECT_MODEL || "").trim();
  if (custom) return custom;
  return "openai/gpt-oss-120b";
}

/**
 * Generates EXACTLY 10 deep Project/Resume questions in ONE AI API Request (AI CALL #1).
 * Tests project purpose, workflow, architecture, implementation, API flow, DB decisions, auth, edge cases, trade-offs.
 * @param {Object} candidateProfile 
 * @returns {Promise<{ questions: Array }>}
 */
export async function generateProjectAI(candidateProfile = {}) {
  console.log("\n[REAL-INTERVIEW][AI-CALL]\nround=project\noperation=generation\nattempt=1");
  const apiKey = getProjectApiKey();
  const model = getProjectModel();

  const rawProjects = candidateProfile.projects || [];
  let normalizedProjects = rawProjects.map((p) => {
    if (typeof p === "string") {
      return {
        name: p.trim(),
        description: "",
        technologies: [],
        role: "Developer",
      };
    }
    return {
      name: p.name || p.title || "Project",
      description: p.description || p.summary || "",
      technologies: p.technologies || p.techStack || [],
      role: p.role || "Developer",
    };
  }).filter(p => Boolean(p.name && p.name !== "Project"));

  if (normalizedProjects.length > 0) {
    console.log(`\n[REAL-INTERVIEW][PROJECT-CONTEXT]\nprojects=${JSON.stringify(normalizedProjects.map(p => ({ name: p.name, technologies: p.technologies })))}\n`);
  } else {
    console.log(`\n[REAL-INTERVIEW][PROJECT-CONTEXT]\nprojects=[] (Resume context unavailable)\n`);
  }

  const projectContextStr = normalizedProjects.length > 0
    ? `CANDIDATE PROJECTS & PROFILE:\n${JSON.stringify({ projects: normalizedProjects, skills: candidateProfile.skills || [] }, null, 2)}`
    : `CANDIDATE SKILLS & PROFILE (0 explicit projects in resume):\n${JSON.stringify({ skills: candidateProfile.skills || [] }, null, 2)}`;

  const defaultProjName = normalizedProjects.length > 0 ? normalizedProjects[0].name : "Project Experience";

  const prompt = `You are interviewing this candidate based ONLY on the supplied resume context.
Do NOT invent unmentioned database schemas, authentication workflows, JWT, Redis caching, Docker, or cloud deployment features unless explicitly listed in that project's resume evidence.
If implementation details are omitted from the resume, ask open-ended problem solving and architecture questions (e.g. "What was the most challenging technical roadblock in project X and how did you solve it?").
${normalizedProjects.length > 0 ? `Every project question MUST reference an actual project name from the profile (${normalizedProjects.map(p => `"${p.name}"`).join(", ")}) and actual technologies listed for that project.` : `Do NOT invent synthetic project names or unmentioned technologies. Ask open-ended questions about project workflows and software engineering experience.`}

Generate a JSON object with key "questions" containing EXACTLY 10 deep, technical project-focused interview questions based ONLY on the project details provided.

${projectContextStr}

STRICT QUESTION DISTRIBUTION (EXACTLY 10 QUESTIONS | 100 MARKS TOTAL):
- 2 Easy questions (5 marks each = 10 marks): High-level architecture, project purpose, core user flow.
- 6 Medium questions (10 marks each = 60 marks): Deep dive into technical implementation, technology integration, problem solving.
- 2 Hard questions (15 marks each = 30 marks): Edge cases, scaling bottlenecks, technical trade-off decisions.

JSON SCHEMA ONLY:
{
  "questions": [
    {
      "question": "Deep technical question about the candidate's project",
      "expectedKnowledge": "Key implementation details and trade-offs expected",
      "difficulty": "medium",
      "maxMarks": 10,
      "topic": "Architecture & API Flow",
      "category": "Project Implementation",
      "projectName": "${defaultProjName}"
    }
  ]
}`;

  const requestBody = {
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a technical project interviewer. Output ONLY a valid JSON object matching schema with EXACTLY 10 questions based on candidate projects.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 2500,
    max_completion_tokens: 2500,
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
      throw new Error("Project AI request timed out");
    }
    console.error("[RealInterviewAI][Project] Fetch error:", err.message);
    throw new Error(`Failed to connect to Project AI provider: ${err.message}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("[RealInterviewAI][Project] HTTP Error:", response.status, errorText);
    throw new Error(`Project AI request failed with status ${response.status}: ${errorText}`);
  }

  const responseData = await response.json();
  const rawText = responseData?.choices?.[0]?.message?.content || "";

  if (!rawText.trim()) {
    throw new Error("Project AI returned an empty response");
  }

  let parsed;
  try {
    const cleanJson = rawText.replace(/```json\s*|\s*```/g, "").trim();
    parsed = JSON.parse(cleanJson);
  } catch (parseErr) {
    console.error("[RealInterviewAI][Project] JSON Parse error:", parseErr.message);
    throw new Error("Project AI returned invalid JSON format");
  }

  if (!parsed || !Array.isArray(parsed.questions)) {
    throw new Error("Project AI response missing 'questions' array");
  }

  console.log(`[RealInterviewAI][Project] Generated ${parsed.questions.length} questions successfully`);
  return parsed;
}

/**
 * Evaluates ALL 10 candidate project answers in ONE SINGLE AI API Request (Attempt 1).
 * @param {Object} payload { candidateProfile, questions: [{ questionId, question, difficulty, maxScore, topic, expectedKnowledge, candidateAnswer, projectName }] }
 * @returns {Promise<Object>}
 */
export async function evaluateProjectInterviewAI({ candidateProfile = {}, questions = [] }) {
  console.log("\n[REAL-INTERVIEW][AI-CALL]\nround=project\noperation=evaluation\nattempt=1");

  const rawProjects = candidateProfile.projects || [];
  let normalizedProjects = rawProjects.map((p) => {
    if (typeof p === "string") return { name: p.trim(), technologies: [] };
    return {
      name: p.name || p.title || "",
      technologies: p.technologies || p.techStack || [],
    };
  }).filter(p => Boolean(p.name));

  if (normalizedProjects.length > 0) {
    console.log(`[REAL-INTERVIEW][PROJECT-EVAL-CONTEXT]\nprojects=${JSON.stringify(normalizedProjects)}\n`);
  } else {
    console.log(`[REAL-INTERVIEW][PROJECT-EVAL-CONTEXT]\nprojects=[] (Resume context unavailable)\n`);
  }

  const apiKey = getProjectApiKey();
  const model = getProjectModel();

  const formattedQuestions = questions.map((q, idx) => ({
    i: idx + 1,
    id: String(q.questionId || q.id || idx),
    q: String(q.question || ""),
    diff: String(q.difficulty || "medium"),
    max: Number(q.maxScore || q.maxMarks || (q.difficulty === "easy" ? 5 : q.difficulty === "hard" ? 20 : 10)),
    ans: String(q.candidateAnswer || "(No answer provided)").trim(),
  }));

  const prompt = `You are a fair technical interviewer evaluating 10 candidate responses for a Project Interview session in ONE assessment.

QUESTIONS & CANDIDATE ANSWERS:
${JSON.stringify(formattedQuestions, null, 2)}

FAIR EVALUATION INSTRUCTIONS:
1. PROJECT UNDERSTANDING FIRST: Judge project workflow and implementation choices. DO NOT heavily penalize grammar or broken English if concept is correct.
2. MARKS: Easy (max 5), Medium (max 10), Hard (max 20). Total = 100 marks.
3. BETTER ANSWER: Preserve candidate's correct ideas, fix errors, refine phrasing.
4. OVERALL METRICS: totalScore (out of 100), maxScore: 100, percentage, overallRating (90+: Excellent, 80-89: Very Strong, 70-79: Strong, 60-69: Good, 50-59: Average, 40-49: Needs Improvement, <40: Weak), strengths, weaknesses, finalFeedback.

JSON SCHEMA ONLY:
{
  "evaluations": [
    {
      "questionId": "string matching id",
      "score": 8,
      "maxScore": 10,
      "difficulty": "medium",
      "rating": "Strong",
      "correctPoints": ["Valid point"],
      "missingPoints": ["Missing point"],
      "incorrectPoints": [],
      "grammarIssues": [],
      "feedback": "Concise feedback",
      "betterAnswer": "Refined answer"
    }
  ],
  "totalScore": 82,
  "maxScore": 100,
  "percentage": 82,
  "overallRating": "Very Strong",
  "strengths": ["Clear API workflow"],
  "weaknesses": ["Shallow error handling"],
  "finalFeedback": "Overall evaluation summary..."
}`;

  const requestBody = {
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a project interviewer evaluator. Output ONLY valid JSON matching schema for all 10 questions.",
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
      throw new Error("Project evaluation AI request timed out");
    }
    console.error("[RealInterviewAI][Project] Evaluation fetch error:", err.message);
    throw new Error(`Failed to connect to Project Evaluation AI provider: ${err.message}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("[RealInterviewAI][Project] Evaluation HTTP Error:", response.status, errorText);
    throw new Error(`Project evaluation AI request failed with status ${response.status}: ${errorText}`);
  }

  const responseData = await response.json();
  const rawText = responseData?.choices?.[0]?.message?.content || "";

  if (!rawText.trim()) {
    throw new Error("Project evaluation AI returned empty response");
  }

  let parsed;
  try {
    const cleanJson = rawText.replace(/```json\s*|\s*```/g, "").trim();
    parsed = JSON.parse(cleanJson);
  } catch (parseErr) {
    console.error("[RealInterviewAI][Project] JSON Parse error:", parseErr.message);
    throw new Error("Project evaluation AI returned invalid JSON format");
  }

  if (!parsed || !Array.isArray(parsed.evaluations)) {
    throw new Error("Project evaluation AI response missing 'evaluations' array");
  }

  console.log(`[RealInterviewAI][Project] Complete evaluation finished for ${parsed.evaluations.length} questions`);
  return parsed;
}

