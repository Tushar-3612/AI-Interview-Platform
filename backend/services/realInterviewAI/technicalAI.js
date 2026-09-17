import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../.env") });

import { AIGateway } from "../aiReliability/index.js";
import { isDuplicateQuestion, normalizeQuestionText } from "../realInterview/questionHistoryService.js";

function getTechnicalApiKey() {
  return (process.env.REAL_INTERVIEW_TECHNICAL_API_KEY || process.env.GROQ_API_KEY || "").trim();
}

function getTechnicalModel() {
  return (process.env.REAL_INTERVIEW_TECHNICAL_MODEL || process.env.GROQ_MODEL || "openai/gpt-oss-120b").trim();
}

/**
 * Returns difficulty based on 1-indexed question number.
 * Q1-Q6: Easy (3 marks)
 * Q7-Q18: Medium (5 marks)
 * Q19-Q20: Hard (13 marks)
 */
export function getDifficultyForQuestionNumber(qNum) {
  if (qNum <= 6) return "easy";
  if (qNum <= 18) return "medium";
  return "hard";
}

/**
 * Generates 1 targeted replacement question of a specified difficulty (max 1 attempt).
 */
async function generateReplacementTechnicalQuestion({
  skillsContextStr,
  requiredDifficulty,
  targetQuestionNumber = 1,
  userHistorySet,
  currentPoolSet,
  apiKey,
  model,
  sessionId,
  provider,
}) {
  const excluded = Array.from(new Set([...userHistorySet, ...currentPoolSet])).slice(0, 20);
  const prompt = `Generate EXACTLY 1 replacement technical question for Q#${targetQuestionNumber}.
Candidate skills: ${skillsContextStr}.
REQUIRED DIFFICULTY: ${requiredDifficulty}.

CRITICAL REQUIREMENT:
DO NOT generate any question similar to:
${excluded.map((q) => `- ${q}`).join("\n")}

Output ONLY valid JSON starting immediately with {"questions": [...]}.

JSON SCHEMA:
{
  "questions": [
    {
      "question": "Deep technical question",
      "expectedKnowledge": "Evaluation criteria and key expected points",
      "difficulty": "${requiredDifficulty}",
      "topic": "Core Principle",
      "skillsTested": ["Node.js"]
    }
  ]
}`;

  try {
    const parsed = await AIGateway.execute({
      prompt,
      systemPrompt: 'You are a JSON API endpoint. Output ONLY valid JSON starting immediately with {"questions": [...]} without any markdown or commentary.',
      provider: provider || "groq",
      apiKey: apiKey || getTechnicalApiKey(),
      sessionId,
      roundType: "technical",
      orderIndex: targetQuestionNumber,
      options: {
        model: model || getTechnicalModel(),
        temperature: 0.4,
        maxRetries: 1, // Max 1 retry attempt for duplicate replacement!
        operation: "replacement",
        targetQuestionNumber
      }
    });

    const q = Array.isArray(parsed?.questions) ? parsed.questions[0] : null;
    if (!q || !q.question) return null;

    const text = String(q.question).trim();
    if (isDuplicateQuestion(text, userHistorySet, currentPoolSet)) {
      console.warn(`[TechnicalAI] Replacement for Q#${targetQuestionNumber} was duplicate. Stopping AI retry and returning null for curated fallback.`);
      return null;
    }

    const validDiff = ["easy", "medium", "hard"].includes(requiredDifficulty) ? requiredDifficulty : "medium";
    const maxMarks = validDiff === "easy" ? 3 : validDiff === "hard" ? 13 : 5;
    return {
      question: text,
      expectedKnowledge: String(q.expectedKnowledge || q.expected_knowledge || q.expectedAnswer || "Comprehensive technical explanation.").trim(),
      difficulty: validDiff,
      maxMarks,
      topic: String(q.topic || "Technical Concept").trim(),
      skillsTested: Array.isArray(q.skillsTested) ? q.skillsTested : [skillsContextStr.split(",")[0] || "General"],
    };
  } catch (err) {
    if (err.isRetryable === false) throw err;
    return null;
  }
}

/**
 * Generates 1 batch (normally EXACTLY 2 questions) of technical questions using AI Reliability Gateway.
 */
export async function generateTechnicalAIBatch({
  skillsContextStr = "",
  startQuestionNumber = 1,
  batchSize = 2,
  targetTotalCount = 20,
  userHistorySet = new Set(),
  currentPoolSet = new Set(),
  sessionId,
  apiKey,
  provider,
  model
}) {
  const activeApiKey = apiKey || getTechnicalApiKey();
  const activeModel = model || getTechnicalModel();

  const endQuestionNumber = Math.min(startQuestionNumber + batchSize - 1, targetTotalCount);
  const actualRequestedCount = endQuestionNumber - startQuestionNumber + 1;

  const slotDifficulties = [];
  for (let qNum = startQuestionNumber; qNum <= endQuestionNumber; qNum++) {
    slotDifficulties.push(getDifficultyForQuestionNumber(qNum));
  }

  const easyCount = slotDifficulties.filter((d) => d === "easy").length;
  const mediumCount = slotDifficulties.filter((d) => d === "medium").length;
  const hardCount = slotDifficulties.filter((d) => d === "hard").length;

  const rangeStr = startQuestionNumber === endQuestionNumber ? `Q${startQuestionNumber}` : `Q${startQuestionNumber}-Q${endQuestionNumber}`;

  // Requirement 8: Limit exclusion list to top 20 recent items to keep context compact
  const excludedList = Array.from(new Set([...userHistorySet, ...currentPoolSet])).slice(0, 20);
  const exclusionText = excludedList.length > 0
    ? `\nDO NOT generate any question identical or semantically similar to:
${excludedList.map(q => `- ${q}`).join("\n")}\n`
    : "";

  const prompt = `You are a technical interviewer generating technical questions for skills: ${skillsContextStr}.
Generate EXACTLY ${actualRequestedCount} question(s) for ${rangeStr} of total ${targetTotalCount}.

DIFFICULTY REQUIREMENTS (${actualRequestedCount} total):
${easyCount > 0 ? `- ${easyCount} Easy (3 marks each)` : ""}
${mediumCount > 0 ? `- ${mediumCount} Medium (5 marks each)` : ""}
${hardCount > 0 ? `- ${hardCount} Hard (13 marks each)` : ""}
${exclusionText}
JSON SCHEMA:
{
  "questions": [
    {
      "question": "Deep technical question",
      "expectedKnowledge": "Evaluation criteria and key expected points",
      "difficulty": "${slotDifficulties[0] || 'medium'}",
      "topic": "Core Principle",
      "skillsTested": ["Node.js"]
    }
  ]
}`;

  console.log(`[TechnicalAI] Batch AI Gateway call for ${rangeStr}...`);

  const parsed = await AIGateway.execute({
    prompt,
    systemPrompt: 'You are a JSON API endpoint. Output ONLY valid JSON starting immediately with {"questions": [...]} without any markdown or commentary.',
    provider,
    apiKey: activeApiKey,
    sessionId,
    roundType: "technical",
    orderIndex: startQuestionNumber,
    options: {
      model: activeModel,
      temperature: 0.3,
      maxRetries: 3
    }
  });

  if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error(`Batch ${rangeStr} returned invalid or empty questions array`);
  }

  const validBatchQuestions = [];

  for (let qIdx = 0; qIdx < Math.min(actualRequestedCount, parsed.questions.length); qIdx++) {
    const rawQ = parsed.questions[qIdx];
    const targetDiff = slotDifficulties[qIdx] || "medium";
    const maxMarks = targetDiff === "easy" ? 3 : targetDiff === "hard" ? 13 : 5;
    const currentQNum = startQuestionNumber + qIdx;

    let candidateQ = {
      question: String(rawQ.question || "").trim(),
      expectedKnowledge: String(rawQ.expectedKnowledge || rawQ.expected_knowledge || rawQ.expectedAnswer || "Comprehensive technical explanation.").trim(),
      difficulty: targetDiff,
      maxMarks,
      topic: String(rawQ.topic || "Technical Concept").trim(),
      skillsTested: Array.isArray(rawQ.skillsTested) ? rawQ.skillsTested : [skillsContextStr.split(",")[0] || "General"],
    };

    if (!candidateQ.question) continue;

    if (isDuplicateQuestion(candidateQ.question, userHistorySet, currentPoolSet)) {
      console.warn(`[TechnicalAI] Batch ${rangeStr} Q#${currentQNum} duplicate detected: "${candidateQ.question}". Attempting 1 replacement...`);
      const replacement = await generateReplacementTechnicalQuestion({
        skillsContextStr,
        requiredDifficulty: targetDiff,
        targetQuestionNumber: currentQNum,
        userHistorySet,
        currentPoolSet,
        apiKey: activeApiKey,
        model: activeModel,
        sessionId,
        provider,
      });
      if (replacement) {
        candidateQ = replacement;
      }
    }

    const norm = normalizeQuestionText(candidateQ.question);
    if (norm && !isDuplicateQuestion(candidateQ.question, userHistorySet, currentPoolSet)) {
      currentPoolSet.add(norm);
      validBatchQuestions.push(candidateQ);
    }
  }

  return validBatchQuestions;
}

/**
 * Generates EXACTLY 20 resume-driven technical questions using 2-question batch calls.
 */
export async function generateTechnicalAI(candidateProfile = {}, userHistorySet = new Set(), options = {}) {
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

  const currentPoolSet = new Set();
  const allQuestions = [];

  while (allQuestions.length < 20) {
    const startNum = allQuestions.length + 1;
    const batchSize = Math.min(2, 20 - allQuestions.length);
    const batch = await generateTechnicalAIBatch({
      skillsContextStr,
      startQuestionNumber: startNum,
      batchSize,
      targetTotalCount: 20,
      userHistorySet,
      currentPoolSet,
      ...options
    });
    allQuestions.push(...batch);
  }

  return { questions: allQuestions.slice(0, 20) };
}

/**
 * Evaluates candidate technical answers in ONE single AI Gateway Request.
 */
export async function evaluateTechnicalInterviewAI({ candidateProfile = {}, questions = [], options = {} }) {
  console.log("\n[REAL-INTERVIEW][AI-CALL]\nround=technical\noperation=evaluation\nattempt=1");

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

  const parsed = await AIGateway.execute({
    prompt,
    systemPrompt: "You are a technical interviewer evaluator. Output ONLY valid JSON matching the requested schema.",
    provider: options.provider,
    apiKey: options.apiKey || getTechnicalApiKey(),
    sessionId: options.sessionId,
    roundType: "evaluation",
    orderIndex: 1,
    options: {
      model: options.model || getTechnicalModel(),
      temperature: 0.2,
      maxRetries: 3
    }
  });

  if (!parsed || !Array.isArray(parsed.evaluations)) {
    throw new Error("Technical evaluation AI response missing 'evaluations' array");
  }

  console.log(`[RealInterviewAI][Technical] Complete evaluation finished for ${parsed.evaluations.length} questions`);
  return parsed;
}
