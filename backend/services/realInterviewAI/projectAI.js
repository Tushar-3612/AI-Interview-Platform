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

import { checkAnswerGate } from "./judgeAnswerGate.js";
import { calibrateScore, checkContradictions } from "./judgeScoreCalibrator.js";

/**
 * Evaluates ALL 5 candidate project answers in ONE SINGLE AI API Request.
 */
export async function evaluateProjectInterviewAI({ candidateProfile = {}, questions = [], options = {} }) {
  console.log("\n[REAL-INTERVIEW][AI-CALL]\nround=project\noperation=evaluation\nattempt=1");

  const apiKey = options.apiKey || getProjectApiKey();
  const model = options.model || getProjectModel();

  const gatedEvaluations = [];
  const questionsToAI = [];

  for (let idx = 0; idx < questions.length; idx++) {
    const q = questions[idx];
    const qIdStr = String(q.questionId || q.id || idx);
    const maxScore = Number(q.maxScore || q.maxMarks || (q.difficulty === "easy" ? 5 : q.difficulty === "hard" ? 20 : 10));
    const ans = String(q.candidateAnswer || "(No answer provided)").trim();
    const expected = String(q.expectedKnowledge || q.expectedAnswer || q.referenceAnswer || "Demonstrate clear project workflow, architecture reasoning, and technical implementation details.").trim();

    const gate = checkAnswerGate(ans, { question: q.question, expectedKnowledge: expected });
    if (gate.isGateTriggered) {
      gatedEvaluations.push({
        questionId: qIdStr,
        score: 0,
        maxScore,
        difficulty: q.difficulty || "medium",
        status: gate.status,
        rating: gate.rating,
        evaluationSource: "ANSWER_GATE",
        correctPoints: [],
        missingPoints: ["Question was not attempted or was declined"],
        incorrectPoints: [],
        grammarIssues: [],
        feedback: gate.feedback,
        betterAnswer: expected,
      });
    } else {
      questionsToAI.push({
        i: idx + 1,
        id: qIdStr,
        q: String(q.question || ""),
        diff: String(q.difficulty || "medium"),
        max: maxScore,
        expected,
        ans,
      });
    }
  }

  let aiEvaluations = [];
  let strengths = [];
  let weaknesses = [];
  let finalFeedback = "";

  if (questionsToAI.length > 0) {
    const prompt = `You are a fair technical interviewer evaluating 5 candidate responses for a Project Interview session in ONE assessment.

QUESTIONS & CANDIDATE ANSWERS:
${JSON.stringify(questionsToAI, null, 2)}

FAIR EVALUATION INSTRUCTIONS:
1. GROUNDED EVALUATION: Evaluate candidate response (ans) against the expected reference criteria (expected) for each question.
2. PROJECT UNDERSTANDING FIRST: Judge project workflow, architecture, and implementation choices. DO NOT heavily penalize grammar or broken English if concept is correct. Concise, correct answers must receive full marks.
3. MARKS: Easy (max 5), Medium (max 10), Hard (max 20).
4. INCORRECT CLAIMS: If an answer contains technically contradictory or wrong statements, deduct marks accordingly.
5. BETTER ANSWER: Preserve candidate's correct ideas, fix errors, refine phrasing.
6. OVERALL METRICS: totalScore, maxScore, percentage, overallRating (90+: Excellent, 80-89: Very Strong, 70-79: Strong, 60-69: Good, 50-59: Average, 40-49: Needs Improvement, <40: Weak), strengths, weaknesses, finalFeedback.

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
      systemPrompt: "You are a project interviewer evaluator. Output ONLY valid JSON matching schema for all questions.",
      provider: options.provider || "groq",
      apiKey,
      sessionId: options.sessionId,
      roundType: "evaluation",
      orderIndex: 1,
      options: {
        model,
        temperature: 0.2,
        maxRetries: 3,
      },
    });

    if (parsed && Array.isArray(parsed.evaluations)) {
      strengths = Array.isArray(parsed.strengths) ? parsed.strengths : [];
      weaknesses = Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [];
      finalFeedback = parsed.finalFeedback || "";

      aiEvaluations = parsed.evaluations.map((item) => {
        const matchingQ = questionsToAI.find((q) => q.id === String(item.questionId));
        const maxScore = matchingQ?.max || Number(item.maxScore) || 10;
        const contradictions = checkContradictions(matchingQ?.ans || "", `${matchingQ?.expected || ""} ${matchingQ?.q || ""}`);

        const calibrated = calibrateScore({
          rawScore: item.score,
          maxMarks: maxScore,
          status: item.status,
          evaluationSource: "ai_evaluated",
          confidence: 0.95,
          evidence: item.correctPoints || [],
          missing: item.missingPoints || [],
          contradictions: item.incorrectPoints?.length ? item.incorrectPoints : contradictions,
          feedback: item.feedback,
          betterAnswer: item.betterAnswer || matchingQ?.expected || "",
          difficulty: item.difficulty || matchingQ?.diff || "medium",
        });

        return {
          questionId: String(item.questionId),
          ...calibrated,
        };
      });
    } else {
      throw new Error("Project evaluation AI response missing 'evaluations' array");
    }
  }

  const allEvaluations = [...gatedEvaluations, ...aiEvaluations];
  const questionMaxMarksSum = questions.reduce(
    (sum, q) => sum + (q.maxScore || q.maxMarks || (q.difficulty === "easy" ? 5 : q.difficulty === "hard" ? 20 : 10)),
    0
  );
  const totalScore = allEvaluations.reduce((sum, e) => sum + (e.score || 0), 0);
  const scaledScore = questionMaxMarksSum > 0 ? Math.min(100, Math.round((totalScore / questionMaxMarksSum) * 100)) : totalScore;
  const percentage = scaledScore;

  console.log(`[RealInterviewAI][Project] Complete evaluation finished for ${allEvaluations.length} questions`);
  return {
    evaluations: allEvaluations,
    totalScore: scaledScore,
    maxScore: 100,
    percentage,
    overallRating: percentage >= 80 ? "Very Strong" : percentage >= 60 ? "Strong" : percentage >= 40 ? "Average" : "Weak",
    strengths: strengths.length ? strengths : ["Project architecture and implementation answers evaluated"],
    weaknesses: weaknesses.length ? weaknesses : ["Areas for refinement identified in project explanations"],
    finalFeedback: finalFeedback || `Project evaluation completed. Score: ${scaledScore}/100.`,
  };
}
