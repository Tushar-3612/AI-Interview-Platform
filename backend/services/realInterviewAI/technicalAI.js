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
    console.error("[TechnicalAI] Replacement generation failed:", err.message);
    return null;
  }
}

/**
 * Generates EXACTLY 20 resume-driven technical questions using 7 AI requests (Max 3 questions per batch).
 * Enforces cross-feature deduplication against user's history and current session pool.
 */
export async function generateTechnicalAI(candidateProfile = {}, userHistorySet = new Set()) {
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
  const currentPoolSet = new Set();

  for (const spec of BATCH_SPECS) {
    console.log(`[TechnicalAI] Executing AI Call for Batch ${spec.batchIndex}/7 (${spec.range})...`);

    const excludedList = Array.from(new Set([...userHistorySet, ...currentPoolSet])).slice(0, 35);
    const exclusionText = excludedList.length > 0
      ? `\nEXCLUSION RULE:\nDO NOT generate any question that is identical or semantically similar to any of these previously asked questions:\n${excludedList.map(q => `- ${q}`).join("\n")}\n`
      : "";

    const prompt = `You are generating placement-level technical interview questions for a candidate with these explicit technical skills: ${skillsContextStr}.
Generate EXACTLY ${spec.count} technical interview question(s) for batch ${spec.range}.

DIFFICULTY REQUIREMENTS FOR THIS BATCH (${spec.count} questions total):
${spec.easy > 0 ? `- ${spec.easy} Easy question(s) (3 marks each)` : ""}
${spec.medium > 0 ? `- ${spec.medium} Medium question(s) (5 marks each)` : ""}
${spec.hard > 0 ? `- ${spec.hard} Hard question(s) (13 marks each)` : ""}
${exclusionText}
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
            content: 'You are a JSON API endpoint. Output ONLY valid JSON starting immediately with {"questions": [...]} without any markdown or commentary.',
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1200,
        timeoutMs: 45000,
      });

      const parsed = extractJsonFromText(rawText);
      if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        throw new Error(`Batch ${spec.batchIndex} returned invalid or empty questions array`);
      }

      for (let qIdx = 0; qIdx < Math.min(spec.count, parsed.questions.length); qIdx++) {
        const rawQ = parsed.questions[qIdx];
        let diff = "medium";
        if (spec.easy > 0 && qIdx < spec.easy) diff = "easy";
        else if (spec.hard > 0 && qIdx >= (spec.count - spec.hard)) diff = "hard";
        else if (spec.medium > 0) diff = "medium";

        const validDiff = ["easy", "medium", "hard"].includes(diff) ? diff : "medium";
        const maxMarks = validDiff === "easy" ? 3 : validDiff === "hard" ? 13 : 5;

        let candidateQ = {
          question: String(rawQ.question || "").trim(),
          expectedKnowledge: String(rawQ.expectedKnowledge || rawQ.expected_knowledge || rawQ.expectedAnswer || "Comprehensive technical explanation.").trim(),
          difficulty: validDiff,
          maxMarks,
          topic: String(rawQ.topic || "Technical Concept").trim(),
          skillsTested: Array.isArray(rawQ.skillsTested) ? rawQ.skillsTested : [skillsContextStr.split(",")[0] || "General"],
        };

        if (isDuplicateQuestion(candidateQ.question, userHistorySet, currentPoolSet)) {
          console.warn(`[TechnicalAI] Batch ${spec.batchIndex} Q#${qIdx+1} duplicate detected: "${candidateQ.question}". Generating targeted replacement...`);
          const replacement = await generateReplacementTechnicalQuestion({
            skillsContextStr,
            requiredDifficulty: validDiff,
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
        if (norm) currentPoolSet.add(norm);
        allBatchQuestions.push(candidateQ);
      }

      console.log(`[TechnicalAI] Batch ${spec.batchIndex}/7 (${spec.range}) SUCCESS: ${allBatchQuestions.length} unique questions so far.`);
    } catch (err) {
      console.error(`[TechnicalAI] Batch ${spec.batchIndex}/7 FAILED: ${err.message}`);
      throw new Error(`Technical AI generation failed on Batch ${spec.batchIndex} (${spec.range}): ${err.message}`);
    }
  }

  if (allBatchQuestions.length < 20) {
    throw new Error(`Technical AI batch generation produced ${allBatchQuestions.length} questions (expected 20)`);
  }

  return { questions: allBatchQuestions.slice(0, 20) };
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


