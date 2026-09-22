import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../.env") });

import { AIGateway } from "../aiReliability/index.js";

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
  const apiKey = uniqueKeys[(attempt - 1) % uniqueKeys.length] || uniqueKeys[0] || "";
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
 * Generates EXACTLY 5 deep Project/Resume questions in ONE AI API Request using AIGateway.
 */
export async function generateProjectAI(candidateProfile = {}, userHistorySet = new Set(), options = {}) {
  console.log("\n[REAL-INTERVIEW][AI-CALL]\nround=project\noperation=generation\nattempt=1");

  const apiKey = options.apiKey || getProjectApiKey();
  const model = options.model || getProjectModel();

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

  const excludedList = Array.from(userHistorySet).slice(0, 100);
  const exclusionText = excludedList.length > 0
    ? `\nABSOLUTE ZERO-REPETITION RULE:
The following list contains questions that have ALREADY been asked to this candidate in previous Real Interview attempts or earlier in the current attempt.
You MUST NOT generate any question that:
1. Exactly matches a previous question.
2. Is a reworded version of a previous question.
3. Is a paraphrase of a previous question.
4. Tests the same underlying concept in substantially the same way.
5. Uses different wording but has the same question intent.
6. Is a slightly modified version of an already asked question.

Previously Asked Questions:
${excludedList.map(q => `- ${q}`).join("\n")}\n`
    : "";

  const prompt = `Generate a JSON object with key "questions" containing EXACTLY 5 deep project interview questions based on candidate's project portfolio:

CANDIDATE PROJECTS:
${projectsContext}

DIFFICULTY BREAKDOWN (EXACTLY 5 QUESTIONS):
- Questions 1 to 2: "difficulty": "easy" (5 marks each)
- Questions 3 to 4: "difficulty": "medium" (10 marks each)
- Question 5: "difficulty": "hard" (20 marks each)
${exclusionText}
CRITICAL GROUNDING CONSTRAINTS:
1. "questions" MUST be an array of EXACTLY 5 objects.
2. Ask about actual technologies, architecture, data flow, trade-offs, and challenges mentioned in candidate projects.
3. "question": Grounded project question.
4. "expectedKnowledge": Key architectural and technical points expected.
5. "topic": Project domain or component.
6. "projectName": Project name associated with question.
7. Do NOT generate or rephrase any question from the exclusion list.

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

  const parsed = await AIGateway.execute({
    prompt,
    systemPrompt: "You are a JSON API endpoint. Output ONLY valid JSON starting immediately with {\"questions\": [...]} without any reasoning, thinking, or commentary.",
    provider: options.provider || "groq",
    apiKey,
    sessionId: options.sessionId,
    roundType: "project",
    orderIndex: 1,
    options: {
      model,
      temperature: 0.1,
      maxRetries: 3
    }
  });

  if (parsed && Array.isArray(parsed.questions) && parsed.questions.length >= 5) {
    console.log(`[RealInterviewAI][Project] Generated ${parsed.questions.length} questions successfully`);
    return parsed;
  }
  throw new Error(`Project AI returned ${parsed?.questions?.length || 0} questions (expected 5)`);
}

/**
 * Evaluates ALL 5 candidate project answers in ONE SINGLE AI API Request.
 */
export async function evaluateProjectInterviewAI({ candidateProfile = {}, questions = [], options = {} }) {
  console.log("\n[REAL-INTERVIEW][AI-CALL]\nround=project\noperation=evaluation\nattempt=1");

  const apiKey = options.apiKey || getProjectApiKey();
  const model = options.model || getProjectModel();

  const formattedQuestions = questions.map((q, idx) => ({
    i: idx + 1,
    id: String(q.questionId || q.id || idx),
    q: String(q.question || ""),
    diff: String(q.difficulty || "medium"),
    max: Number(q.maxScore || q.maxMarks || (q.difficulty === "easy" ? 5 : q.difficulty === "hard" ? 20 : 10)),
    ans: String(q.candidateAnswer || "(No answer provided)").trim(),
  }));

  const prompt = `You are a fair technical interviewer evaluating 5 candidate responses for a Project Interview session in ONE assessment.

QUESTIONS & CANDIDATE ANSWERS:
${JSON.stringify(formattedQuestions, null, 2)}

FAIR EVALUATION INSTRUCTIONS:
1. PROJECT UNDERSTANDING FIRST: Judge project workflow and implementation choices. DO NOT heavily penalize grammar or broken English if concept is correct.
2. MARKS: Easy (max 5), Medium (max 10), Hard (max 20).
3. BETTER ANSWER: Preserve candidate's correct ideas, fix errors, refine phrasing.
4. OVERALL METRICS: totalScore, maxScore, percentage, overallRating (90+: Excellent, 80-89: Very Strong, 70-79: Strong, 60-69: Good, 50-59: Average, 40-49: Needs Improvement, <40: Weak), strengths, weaknesses, finalFeedback.

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
  "totalScore": 42,
  "maxScore": 50,
  "percentage": 84,
  "overallRating": "Very Strong",
  "strengths": ["Clear API workflow"],
  "weaknesses": ["Shallow error handling"],
  "finalFeedback": "Overall evaluation summary..."
}`;

  const parsed = await AIGateway.execute({
    prompt,
    systemPrompt: "You are a project interviewer evaluator. Output ONLY valid JSON matching schema for all 5 questions.",
    provider: options.provider || "groq",
    apiKey,
    sessionId: options.sessionId,
    roundType: "evaluation",
    orderIndex: 1,
    options: {
      model,
      temperature: 0.2,
      maxRetries: 3
    }
  });

  if (!parsed || !Array.isArray(parsed.evaluations)) {
    throw new Error("Project evaluation AI response missing 'evaluations' array");
  }

  console.log(`[RealInterviewAI][Project] Complete evaluation finished for ${parsed.evaluations.length} questions`);
  return parsed;
}
