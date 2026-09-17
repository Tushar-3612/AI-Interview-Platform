import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../.env") });

import { callPythonGroqBridge } from "./pythonGroqBridge.js";
import { extractJsonFromText } from "./jsonExtractor.js";
import { isDuplicateQuestion, normalizeQuestionText } from "../realInterview/questionHistoryService.js";

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseGroqRetryAfter(errMsg) {
  const match = String(errMsg).match(/try again in ([0-9]+(?:\.[0-9]+)?)s/i);
  if (match && match[1]) {
    const sec = parseFloat(match[1]);
    if (!isNaN(sec) && sec > 0) {
      return Math.ceil(sec) + 1;
    }
  }
  return 0;
}

/**
 * Generates 1 targeted replacement question of a specified difficulty.
 */
async function generateReplacementTechnicalQuestion({
  skillsContextStr,
  requiredDifficulty,
  userHistorySet,
  currentPoolSet,
  apiKey,
  model,
  retriesLeft = 3,
}) {
  if (retriesLeft <= 0) return null;

  const excluded = Array.from(new Set([...userHistorySet, ...currentPoolSet])).slice(0, 40);
  const prompt = `You are a senior technical interviewer. Generate EXACTLY 1 unique placement-level technical interview question for a candidate with these skills: ${skillsContextStr}.

REQUIRED DIFFICULTY: ${requiredDifficulty} (${requiredDifficulty === "easy" ? "3 marks" : requiredDifficulty === "hard" ? "13 marks" : "5 marks"})

CRITICAL REQUIREMENT:
DO NOT generate any question that is identical or semantically similar to any of these previously asked questions:
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
    const rawText = await callPythonGroqBridge({
      round: "technical_replacement",
      apiKey,
      model,
      messages: [
        {
          role: "system",
          content: 'You are a JSON API endpoint. Output ONLY valid JSON starting immediately with {"questions": [...]} without any markdown or commentary.',
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 600,
      timeoutMs: 30000,
    });

    const parsed = extractJsonFromText(rawText);
    const q = Array.isArray(parsed?.questions) ? parsed.questions[0] : null;
    if (!q || !q.question) {
      return generateReplacementTechnicalQuestion({
        skillsContextStr,
        requiredDifficulty,
        userHistorySet,
        currentPoolSet,
        apiKey,
        model,
        retriesLeft: retriesLeft - 1,
      });
    }

    const text = String(q.question).trim();
    if (isDuplicateQuestion(text, userHistorySet, currentPoolSet)) {
      console.warn(`[TechnicalAI] Replacement question "${text}" was duplicate. Retrying (${retriesLeft - 1} left)...`);
      return generateReplacementTechnicalQuestion({
        skillsContextStr,
        requiredDifficulty,
        userHistorySet,
        currentPoolSet,
        apiKey,
        model,
        retriesLeft: retriesLeft - 1,
      });
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
    const errMsg = err.message || "";
    const is429 = errMsg.includes("429") || errMsg.includes("rate_limit") || errMsg.includes("TPM");
    if (is429 && retriesLeft > 0) {
      const parsedSec = parseGroqRetryAfter(errMsg);
      const backoffSec = parsedSec > 0 ? parsedSec : 6;
      console.warn(`[TechnicalAI] Replacement question call 429 rate limited. Waiting ${backoffSec}s before retry...`);
      await sleep(backoffSec * 1000);
      return generateReplacementTechnicalQuestion({
        skillsContextStr,
        requiredDifficulty,
        userHistorySet,
        currentPoolSet,
        apiKey,
        model,
        retriesLeft: retriesLeft - 1,
      });
    }
    console.error("[TechnicalAI] Replacement generation failed:", err.message);
    return null;
  }
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
 * Generates 1 batch (normally EXACTLY 2 questions) of technical questions with Groq 429 exponential backoff retries.
 */
export async function generateTechnicalAIBatch({
  skillsContextStr = "",
  startQuestionNumber = 1,
  batchSize = 2,
  targetTotalCount = 20,
  userHistorySet = new Set(),
  currentPoolSet = new Set(),
}) {
  const apiKey = getTechnicalApiKey();
  const model = getTechnicalModel();

  const endQuestionNumber = Math.min(startQuestionNumber + batchSize - 1, targetTotalCount);
  const actualRequestedCount = endQuestionNumber - startQuestionNumber + 1;

  // Determine difficulty requirements for requested slots
  const slotDifficulties = [];
  for (let qNum = startQuestionNumber; qNum <= endQuestionNumber; qNum++) {
    slotDifficulties.push(getDifficultyForQuestionNumber(qNum));
  }

  const easyCount = slotDifficulties.filter((d) => d === "easy").length;
  const mediumCount = slotDifficulties.filter((d) => d === "medium").length;
  const hardCount = slotDifficulties.filter((d) => d === "hard").length;

  const rangeStr = startQuestionNumber === endQuestionNumber ? `Q${startQuestionNumber}` : `Q${startQuestionNumber}-Q${endQuestionNumber}`;

  const excludedList = Array.from(new Set([...userHistorySet, ...currentPoolSet])).slice(0, 100);
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

  const prompt = `You are a technical interviewer generating placement-level technical interview questions for a candidate with these explicit technical skills: ${skillsContextStr}.
Generate EXACTLY ${actualRequestedCount} technical interview question(s) for ${rangeStr} of total ${targetTotalCount} questions in this interview session.

DIFFICULTY REQUIREMENTS FOR THIS BATCH (${actualRequestedCount} question(s) total):
${easyCount > 0 ? `- ${easyCount} Easy question(s) (3 marks each)` : ""}
${mediumCount > 0 ? `- ${mediumCount} Medium question(s) (5 marks each)` : ""}
${hardCount > 0 ? `- ${hardCount} Hard question(s) (13 marks each)` : ""}
${exclusionText}
RULES:
1. ONLY ask about candidate's explicit technical skills listed above.
2. Test deep conceptual understanding, WHY, HOW, and trade-offs.
3. Do NOT invent unmentioned technologies.
4. Do not select or rephrase any question from the exclusion list.
5. Output ONLY valid JSON starting immediately with {"questions": [...]}.

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

  const maxRetries = 3;
  let attempt = 0;

  while (attempt <= maxRetries) {
    attempt++;
    try {
      console.log(`[TechnicalAI] Batch AI call for ${rangeStr} (Attempt ${attempt}/${maxRetries + 1})...`);

      const rawText = await callPythonGroqBridge({
        round: "technical",
        apiKey,
        model,
        messages: [
          {
            role: "system",
            content: 'You are a JSON API endpoint. Output ONLY valid JSON starting immediately with {"questions": [...]} without any markdown or commentary.',
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 800,
        timeoutMs: 35000,
      });

      const parsed = extractJsonFromText(rawText);
      if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        throw new Error(`Batch ${rangeStr} returned invalid or empty questions array`);
      }

      const validBatchQuestions = [];

      for (let qIdx = 0; qIdx < Math.min(actualRequestedCount, parsed.questions.length); qIdx++) {
        const rawQ = parsed.questions[qIdx];
        const targetDiff = slotDifficulties[qIdx] || "medium";
        const maxMarks = targetDiff === "easy" ? 3 : targetDiff === "hard" ? 13 : 5;

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
          console.warn(`[TechnicalAI] Batch ${rangeStr} Q#${qIdx + 1} duplicate detected: "${candidateQ.question}". Generating replacement...`);
          const replacement = await generateReplacementTechnicalQuestion({
            skillsContextStr,
            requiredDifficulty: targetDiff,
            userHistorySet,
            currentPoolSet,
            apiKey,
            model,
            retriesLeft: 3,
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
    } catch (err) {
      const errMsg = err.message || "";
      const status = err.status || 0;
      const is401or403or404 = status === 401 || status === 403 || status === 404 || errMsg.includes("401") || errMsg.includes("403") || errMsg.includes("404") || errMsg.includes("Invalid API Key") || errMsg.includes("unauthorized");
      const isQuota = errMsg.includes("RPD") || errMsg.includes("daily quota") || errMsg.includes("quota exceeded");

      if (is401or403or404 || isQuota) {
        console.error(`[TechnicalAI] Non-retryable API error encountered on ${rangeStr} (status=${status || "auth/quota/model"}). Failing batch immediately.`);
        throw err;
      }

      const is429 = status === 429 || errMsg.includes("429") || errMsg.includes("rate_limit") || errMsg.includes("TPM");

      if (is429 && attempt <= maxRetries) {
        const parsedSec = parseGroqRetryAfter(errMsg);
        const backoffSec = parsedSec > 0 ? parsedSec : (attempt === 1 ? 5 : attempt === 2 ? 10 : 20);
        console.warn(`[TechnicalAI] Groq 429 Rate Limit encountered on ${rangeStr}. Waiting ${backoffSec}s before retry ${attempt}/${maxRetries}...`);
        await sleep(backoffSec * 1000);
      } else if (attempt <= maxRetries && !is429) {
        console.warn(`[TechnicalAI] Batch ${rangeStr} failed (${errMsg}). Retrying attempt ${attempt}/${maxRetries}...`);
        await sleep(2000);
      } else {
        console.error(`[TechnicalAI] Batch ${rangeStr} failed permanently after ${attempt} attempts: ${errMsg}`);
        throw err;
      }
    }
  }

  return [];
}

/**
 * Generates EXACTLY 20 resume-driven technical questions using 2-question batch calls.
 */
export async function generateTechnicalAI(candidateProfile = {}, userHistorySet = new Set()) {
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
    });
    allQuestions.push(...batch);
  }

  return { questions: allQuestions.slice(0, 20) };
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


