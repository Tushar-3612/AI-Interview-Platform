import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../.env") });

import { callPythonGroqBridge } from "./pythonGroqBridge.js";

function getProjectApiKey(attempt = 1) {
  const keys = [
    process.env.REAL_INTERVIEW_PROJECT_API_KEY,
    process.env.AI_API_KEY,
    process.env.MOCK_INTERVIEW_API_KEY,
    process.env.REAL_INTERVIEW_TECHNICAL_API_KEY,
    process.env.REAL_INTERVIEW_CODING_API_KEY,
    process.env.REAL_INTERVIEW_APTITUDE_API_KEY,
  ].map((k) => (k || "").trim()).filter(Boolean);
  const uniqueKeys = Array.from(new Set(keys));
  const apiKey = uniqueKeys[(attempt - 1) % uniqueKeys.length];

  if (!apiKey) {
    console.error("[RealInterviewAI][Project] Missing API key");
    throw new Error("REAL_INTERVIEW_PROJECT_API_KEY is not configured in environment");
  }
  return apiKey;
}

function getProjectModel(attempt = 1) {
  const custom = (process.env.REAL_INTERVIEW_PROJECT_MODEL || "").trim();
  if (custom) return custom;
  if (attempt === 1) return "openai/gpt-oss-120b";
  if (attempt === 2) return "openai/gpt-oss-20b";
  return "openai/gpt-oss-120b";
}

/**
 * Classify Groq API errors to determine retry behavior.
 */
function classifyGroqError(err) {
  const status = err?.status || err?.statusCode || 0;
  const msg = String(err?.message || err || "").toLowerCase();

  if (status === 404 || msg.includes("404") || msg.includes("model_not_found") || msg.includes("does not exist")) {
    return { retryable: false, reason: "Model not found (404)" };
  }
  if (status === 401 || status === 403 || msg.includes("401") || msg.includes("403")) {
    return { retryable: false, reason: "Authentication/authorization error" };
  }
  if (status === 429 || msg.includes("429") || msg.includes("rate_limit") || msg.includes("tokens per day")) {
    return { retryable: false, reason: "Rate limit / daily quota exhausted (429)" };
  }
  return { retryable: true, reason: "Transient error" };
}

import { extractJsonFromText } from "./jsonExtractor.js";

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

  const projects = candidateProfile.resumeProjects || candidateProfile.projects || [];
  let normalizedProjects = projects.map((p) => {
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
      technologies: Array.isArray(p.technologies) ? p.technologies : p.techStack ? [p.techStack] : [],
      role: p.role || "Developer",
    };
  }).filter(p => Boolean(p.name && p.name !== "Project"));

  if (normalizedProjects.length > 0) {
    console.log(`\n[REAL-INTERVIEW][PROJECT-CONTEXT]\nprojects=${JSON.stringify(normalizedProjects.map(p => ({ name: p.name, technologies: p.technologies })))}\n`);
  } else {
    console.log(`\n[REAL-INTERVIEW][PROJECT-CONTEXT]\nprojects=[] (Resume context unavailable)\n`);
  }

  let projectsContext = "";
  if (normalizedProjects.length > 0) {
    projectsContext = normalizedProjects
      .map(
        (p, idx) =>
          `Project #${idx + 1}: ${p.name}\n- Technologies: ${
            Array.isArray(p.technologies) ? p.technologies.join(", ") : p.technologies || "General Software"
          }\n- Description: ${p.description || "Project implementation."}`
      )
      .join("\n\n");
  } else {
    projectsContext = "Candidate has general software engineering experience building full stack web & backend applications.";
  }

  const defaultProjName = normalizedProjects[0]?.name || "Full Stack Application";

  const prompt = `Generate a JSON object with key "questions" containing EXACTLY 10 deep project interview questions based on candidate's project portfolio:

CANDIDATE PROJECTS:
${projectsContext}

DIFFICULTY BREAKDOWN (EXACTLY 10 QUESTIONS):
- Questions 1 to 4: "difficulty": "easy" (5 marks each)
- Questions 5 to 8: "difficulty": "medium" (10 marks each)
- Questions 9 to 10: "difficulty": "hard" (20 marks each)

CRITICAL GROUNDING CONSTRAINTS:
1. "questions" MUST be an array of EXACTLY 10 objects.
2. Ask about actual technologies, architecture, data flow, trade-offs, and challenges mentioned in candidate projects.
3. "question": Grounded project question.
4. "expectedKnowledge": Key architectural and technical points expected.
5. "topic": Project domain or component.
6. "projectName": Project name associated with question.

JSON OUTPUT ONLY:
{
  "questions": [
    {
      "question": "Deep architectural or technical question on candidate project",
      "expectedKnowledge": "Key implementation details expected",
      "difficulty": "easy",
      "topic": "Architecture & API Flow",
      "projectName": "${defaultProjName}"
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
    const currentApiKey = getProjectApiKey(attempt);
    const currentModel = getProjectModel(attempt);
    try {
      const rawText = await callPythonGroqBridge({
        round: "project",
        apiKey: currentApiKey,
        model: currentModel,
        messages: requestBody.messages,
        temperature: requestBody.temperature,
        max_tokens: requestBody.max_tokens,
        timeoutMs: 60000,
      });

      const parsed = extractJsonFromText(rawText);

      if (parsed && Array.isArray(parsed.questions) && parsed.questions.length >= 10) {
        console.log(`[RealInterviewAI][Project] Generated ${parsed.questions.length} questions successfully`);
        return parsed;
      }
      throw new Error(`AI returned ${parsed?.questions?.length || 0} questions (expected 10)`);
    } catch (err) {
      lastError = err;
      const { retryable, reason } = classifyGroqError(err);
      console.warn(`[RealInterviewAI][Project] Attempt ${attempt} failed: ${err.message} (${reason})`);
      if (!retryable) {
        console.warn(`[RealInterviewAI][Project] Non-retryable error, failing immediately: ${reason}`);
        break;
      }
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 12000));
      }
    }
  }

  throw lastError || new Error("Project AI generation failed after 3 attempts");
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
    max_tokens: 2560,
  };

  const rawText = await callPythonGroqBridge({
    round: "project",
    apiKey,
    model,
    messages: requestBody.messages,
    temperature: requestBody.temperature,
    max_tokens: requestBody.max_tokens,
    timeoutMs: 90000,
  });

  const parsed = extractJsonFromText(rawText);

  if (!parsed || !Array.isArray(parsed.evaluations)) {
    throw new Error("Project evaluation AI response missing 'evaluations' array");
  }

  console.log(`[RealInterviewAI][Project] Complete evaluation finished for ${parsed.evaluations.length} questions`);
  return parsed;
}

