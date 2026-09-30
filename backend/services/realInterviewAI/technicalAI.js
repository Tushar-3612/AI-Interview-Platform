import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../.env") });

import { AIGateway } from "../aiReliability/index.js";
import { isDuplicateQuestion, normalizeQuestionText } from "../realInterview/questionHistoryService.js";

function getTechnicalApiKey() {
  return (process.env.REAL_INTERVIEW_TECHNICAL_API_KEY || process.env.GROQ_API_KEY || process.env.AI_API_KEY || "").trim();
}

function getTechnicalModel() {
  return (process.env.REAL_INTERVIEW_TECHNICAL_MODEL || process.env.GROQ_MODEL || "llama-3.3-70b-versatile").trim();
}

/**
 * Returns difficulty based on 1-indexed question number.
 * Q1-Q6: Easy (3 marks)
 * Q7-Q12: Medium (5 marks)
 * Q13-Q15: Hard (13 marks)
 */
export function getDifficultyForQuestionNumber(qNum) {
  if (qNum <= 6) return "easy";
  if (qNum <= 12) return "medium";
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
  targetTotalCount = 15,
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
 * Generates EXACTLY 15 resume-driven technical questions using 2-question batch calls.
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

  while (allQuestions.length < 15) {
    const startNum = allQuestions.length + 1;
    const batchSize = Math.min(2, 15 - allQuestions.length);
    const batch = await generateTechnicalAIBatch({
      skillsContextStr,
      startQuestionNumber: startNum,
      batchSize,
      targetTotalCount: 15,
      userHistorySet,
      currentPoolSet,
      ...options
    });
    allQuestions.push(...batch);
  }

  return { questions: allQuestions.slice(0, 15) };
}

import { checkAnswerGate } from "./judgeAnswerGate.js";
import { calibrateScore, checkContradictions } from "./judgeScoreCalibrator.js";

/**
 * Evaluates a single batch of technical questions (max 5 questions) using AIGateway.
 */
export async function evaluateTechnicalAIBatch({ chunk = [], batchNumber = 1, totalBatches = 1, options = {} }) {
  if (!chunk || chunk.length === 0) return [];

  const provider = options.provider || "groq";
  console.log(`[AI-EVAL] Technical batch ${batchNumber}/${totalBatches} answers=${chunk.length} provider=${provider}`);

  const prompt = `You are an expert technical interviewer evaluating candidate answers for ${chunk.length} Technical Interview questions (Batch ${batchNumber} of ${totalBatches}).

BATCH ITEMS:
${JSON.stringify(chunk, null, 2)}

EVALUATION INSTRUCTIONS:
1. Evaluate each candidate answer (ans) strictly against the question (q) and expected reference knowledge (expected).
2. For syntax, keyword, command, SQL, or definition questions (e.g., 'def', 'git status', 'SELECT * FROM Products;', 'my_list = []'): award FULL MARKS if the candidate provides the direct correct syntax/keyword/command.
3. For conceptual questions: evaluate accuracy, core mechanism, and practical depth. Do NOT penalize brevity if the core concept is correct.
4. MARKS:
   - Easy (maxScore 3): 0=incorrect, 1=minimal/vague, 2=partially correct, 3=correct (give 3 for direct correct syntax/keywords).
   - Medium (maxScore 5): 0=incorrect, 1-2=weak/partial, 3=acceptable, 4=strong, 5=excellent.
   - Hard (maxScore 13): 0=incorrect, 1-4=weak, 5-8=partial, 9-11=strong, 12-13=excellent.
5. Provide concise feedback and a concise betterAnswer preserving candidate's valid points.

STRICT JSON ONLY:
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
      "betterAnswer": "Concise model answer"
    }
  ]
}`;

  try {
    const parsed = await AIGateway.execute({
      prompt,
      systemPrompt: "You are a technical interviewer evaluator. Output ONLY valid JSON starting immediately with {\"evaluations\": [...]}.",
      provider: options.provider,
      apiKey: options.apiKey || getTechnicalApiKey(),
      sessionId: options.sessionId,
      roundType: "evaluation",
      orderIndex: batchNumber,
      options: {
        model: options.model || getTechnicalModel(),
        temperature: 0.2,
        maxRetries: 3,
      },
    });

    if (!parsed || !Array.isArray(parsed.evaluations)) {
      throw new Error(`Technical evaluation AI response missing 'evaluations' array in batch ${batchNumber}`);
    }

    const batchEvaluated = parsed.evaluations.map((item) => {
      const matchingQ = chunk.find((q) => q.id === String(item.questionId));
      const maxScore = matchingQ?.max || Number(item.maxScore) || 5;
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

    console.log(`[AI-EVAL] Technical batch ${batchNumber}/${totalBatches} SUCCESS evaluated=${batchEvaluated.length}`);
    return batchEvaluated;
  } catch (err) {
    console.error(`[AI-EVAL] Technical batch ${batchNumber}/${totalBatches} status=${err.category || err.code || err.name || 'FAILED'}`);
    throw err;
  }
}

/**
 * Evaluates candidate technical answers in batches (max 5 questions per batch).
 */
export async function evaluateTechnicalInterviewAI({ candidateProfile = {}, questions = [], options = {} }) {
  console.log("\n[REAL-INTERVIEW][AI-CALL]\nround=technical\noperation=evaluation\nattempt=1");

  const gatedEvaluations = [];
  const questionsToAI = [];

  for (let idx = 0; idx < questions.length; idx++) {
    const q = questions[idx];
    const qIdStr = String(q.questionId || q.id || idx);
    const maxScore = Number(q.maxScore || q.maxMarks || (q.difficulty === "easy" ? 3 : q.difficulty === "hard" ? 13 : 5));
    const ans = String(q.candidateAnswer || "(No answer provided)").trim();
    const expected = String(q.expectedKnowledge || q.expectedAnswer || "").trim();

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
        betterAnswer: expected || "Comprehensive technical explanation required.",
      });
    } else {
      questionsToAI.push({
        i: idx + 1,
        id: qIdStr,
        q: String(q.question || ""),
        diff: String(q.difficulty || "medium"),
        max: maxScore,
        ans,
        expected,
      });
    }
  }

  let aiEvaluations = [];

  if (questionsToAI.length > 0) {
    const BATCH_SIZE = 5;
    const totalBatches = Math.ceil(questionsToAI.length / BATCH_SIZE);

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const chunk = questionsToAI.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE);
      const batchNumber = batchIdx + 1;

      const batchEvaluated = await evaluateTechnicalAIBatch({
        chunk,
        batchNumber,
        totalBatches,
        options,
      });

      aiEvaluations.push(...batchEvaluated);

      if (typeof options.onBatchComplete === "function") {
        await options.onBatchComplete(batchEvaluated, batchNumber, totalBatches);
      }
    }
  }

  const allEvaluations = [...gatedEvaluations, ...aiEvaluations];
  const totalScore = Math.min(100, allEvaluations.reduce((sum, e) => sum + (e.score || 0), 0));
  const percentage = totalScore;

  console.log(`[RealInterviewAI][Technical] Complete evaluation finished for ${allEvaluations.length} questions`);
  return {
    evaluations: allEvaluations,
    totalScore,
    maxScore: 100,
    percentage,
    overallRating: percentage >= 80 ? "Strong" : percentage >= 50 ? "Average" : "Weak",
    strengths: ["Technical answers evaluated against expected reference criteria"],
    weaknesses: ["Areas for improvement identified in candidate responses"],
    finalFeedback: `Technical evaluation completed. Score: ${totalScore}/100.`,
  };
}
