import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../.env") });

import { AIGateway } from "../../ai/reliability/index.js";
import { isDuplicateQuestion, normalizeQuestionText } from "../services/questionHistoryService.js";

function getHRConfig(attempt = 1) {
  const apiKey = (process.env.REAL_INTERVIEW_HR_API_KEY || process.env.GROQ_API_KEY || process.env.AI_API_KEY || "").trim();
  const custom = (process.env.REAL_INTERVIEW_HR_MODEL || process.env.GROQ_MODEL || process.env.AI_MODEL || "").trim();
  const model = custom || "openai/gpt-oss-120b";
  return { apiKey, model };
}

/**
 * Helper to execute an HR AI completion request.
 */
async function callHRAIGeneration({
  candidateProfile,
  profileSummary,
  userHistorySet,
  currentPoolSet,
  count = 2,
  options = {},
}) {
  const { apiKey: configApiKey, model: configModel } = getHRConfig(1);
  const activeApiKey = options.apiKey || configApiKey;
  const activeModel = options.model || configModel;
  const provider = options.provider || "groq";

  const excludedList = Array.from(new Set([...userHistorySet, ...currentPoolSet])).slice(0, 30);
  const exclusionText = excludedList.length > 0
    ? `\nABSOLUTE ZERO-REPETITION RULE:
Do NOT generate any question that matches or paraphrases any of:
${excludedList.map((q) => `- ${q}`).join("\n")}\n`
    : "";

  const systemPrompt = `You are a Senior HR Vice President conducting a final HR cultural & behavioral interview for a top tier tech company.
Your task is to generate EXACTLY ${count} high-impact, professional, DIVERSE HR interview questions tailored to the candidate's profile.
Note: Q1 is a fixed introduction question handled separately. These questions are additional behavioral/situational questions.

CRITICAL ARCHITECTURAL RULES:
1. TOTAL QUESTIONS TO GENERATE: EXACTLY ${count}. NO MORE, NO LESS.
2. EACH QUESTION MUST BE SUBSTANTIALLY DIFFERENT from every other question — different topic, different scenario, different behavioral dimension.
3. QUESTION CATEGORIES:
   - Cultural Fit, Value Alignment & Behavioral Scenarios (STAR format)
   - Situational Judgment, Problem Solving & Leadership Under Pressure
4. RESUME GROUNDING: Mention aspects of the candidate's background naturally in the questions.
5. ABSOLUTE MARKS: Set maxMarks = 20 for each question.
6. Do NOT generate or rephrase any question from the exclusion list.
7. Do NOT generate any variation of "Introduce yourself" or "Tell me about yourself".
8. STRICT JSON ONLY: Respond with a SINGLE JSON object. No markdown wrappers.

JSON SCHEMA REQUIREMENT:
{
  "questions": [
    {
      "id": "hr_q2",
      "question": "Clear, professional HR question text",
      "category": "Behavioral",
      "difficulty": "medium",
      "maxMarks": 20,
      "behavioralDimensions": ["decisionMaking", "ownership"],
      "resumeReference": "General Workplace Scenario"
    }
  ]
}`;

  const userPrompt = `Candidate Profile:\n${profileSummary}\n${exclusionText}\nGenerate EXACTLY ${count} deep HR questions in valid JSON.`;

  const parsed = await AIGateway.execute({
    prompt: userPrompt,
    systemPrompt,
    provider,
    apiKey: activeApiKey,
    sessionId: options.sessionId,
    roundType: "hr",
    orderIndex: 1,
    options: {
      model: activeModel,
      temperature: 0.1,
      maxRetries: 3,
      maxOutputTokens: 8192,
    },
  });

  return parsed;
}

/**
 * AI CALL #1: Generate 2 AI HR questions (for Q2 & Q3) in ONE AI request using AIGateway with partial recovery.
 */
export async function generateHRAI({ candidateProfile = {}, userHistorySet = new Set(), count = 2, currentPoolSet = new Set(), options = {} }) {
  console.log("\n[REAL-INTERVIEW][AI-CALL]\nround=hr\noperation=generation\nattempt=1");

  const educationText = Array.isArray(candidateProfile.education)
    ? candidateProfile.education.map((e) => `${e.degree || "Degree"} at ${e.institution || "Institution"}`).join(", ")
    : (candidateProfile.education || "Undergraduate Degree");

  const profileSummary = `
- Full Name: ${candidateProfile.fullName || candidateProfile.name || "Candidate"}
- Education: ${educationText}
- Experience / Internships: ${JSON.stringify(candidateProfile.experience || candidateProfile.internships || [])}
- Extracurricular / Leadership: ${JSON.stringify(candidateProfile.leadership || candidateProfile.extracurricular || [])}
- Certifications / Achievements: ${JSON.stringify(candidateProfile.achievements || candidateProfile.certifications || [])}
- Key Projects Summary: ${JSON.stringify(candidateProfile.projects || [])}
`;

  const targetCount = count || 2;
  const pool = new Set(currentPoolSet);
  const collectedQuestions = [];

  const extractValidQuestions = (rawQuestions) => {
    const valid = [];
    if (!Array.isArray(rawQuestions)) return valid;

    for (let i = 0; i < rawQuestions.length; i++) {
      const q = rawQuestions[i];
      if (!q || typeof q !== "object") continue;
      const qText = String(q.question || q.questionText || q.text || q.prompt || "").trim();
      if (!qText) continue;

      if (isDuplicateQuestion(qText, userHistorySet, pool)) {
        console.warn(`[HR-AI] Skipping duplicate question: "${qText.slice(0, 60)}..."`);
        continue;
      }

      const norm = normalizeQuestionText(qText);
      if (norm) pool.add(norm);

      valid.push({
        question: qText,
        category: q.category || "Behavioral & Situational",
        difficulty: collectedQuestions.length + valid.length === 0 ? "easy" : "medium",
        maxMarks: 20,
        behavioralDimensions: Array.isArray(q.behavioralDimensions) ? q.behavioralDimensions : ["decisionMaking", "ownership"],
        resumeReference: q.resumeReference || "",
        source: "AI_PROVIDER",
      });
    }
    return valid;
  };

  // 1. Initial attempt: Request buffered count (e.g. Math.max(targetCount, 3))
  const initialRequestCount = Math.max(targetCount, 3);
  try {
    const initialParsed = await callHRAIGeneration({
      candidateProfile,
      profileSummary,
      userHistorySet,
      currentPoolSet: pool,
      count: initialRequestCount,
      options,
    });

    const rawList = initialParsed?.questions || initialParsed?.data || (Array.isArray(initialParsed) ? initialParsed : []);
    const initialValid = extractValidQuestions(rawList);
    collectedQuestions.push(...initialValid);
  } catch (initialErr) {
    console.error(`[HR-AI] Initial HR AI question generation failed: ${initialErr.message}`);
    if (collectedQuestions.length === 0) {
      throw initialErr;
    }
  }

  // 2. Partial Recovery: If fewer valid questions than targetCount, retry ONLY the missing count
  if (collectedQuestions.length < targetCount) {
    const missingCount = targetCount - collectedQuestions.length;
    console.log(`[HR-AI] Partial HR AI response received (${collectedQuestions.length}/${targetCount}). Retrying ONLY ${missingCount} missing question(s) via AI...`);

    try {
      const retryParsed = await callHRAIGeneration({
        candidateProfile,
        profileSummary,
        userHistorySet,
        currentPoolSet: pool,
        count: missingCount,
        options,
      });

      const rawRetryList = retryParsed?.questions || retryParsed?.data || (Array.isArray(retryParsed) ? retryParsed : []);
      const retryValid = extractValidQuestions(rawRetryList);
      collectedQuestions.push(...retryValid);
    } catch (retryErr) {
      console.warn(`[HR-AI] Targeted retry for ${missingCount} missing HR questions failed: ${retryErr.message}. Preserving ${collectedQuestions.length} valid questions.`);
    }
  }

  if (collectedQuestions.length > 0) {
    console.log(`[RealInterviewAI][HR] Generated ${collectedQuestions.length}/${targetCount} HR AI questions successfully`);
    return collectedQuestions.slice(0, targetCount);
  }

  throw new Error(`HR AI generation returned 0 questions`);
}

import { checkAnswerGate } from "./judgeAnswerGate.js";
import { calibrateScore } from "./judgeScoreCalibrator.js";

/**
 * Evaluates a batch of HR questions using AIGateway.
 */
export async function evaluateHRAIBatch({ chunk = [], batchNumber = 1, totalBatches = 1, candidateProfile = {}, options = {} }) {
  if (!chunk || chunk.length === 0) return { evaluations: [] };

  const { apiKey: configApiKey, model: configModel } = getHRConfig(1);
  const activeApiKey = options.apiKey || configApiKey;
  const activeModel = options.model || configModel;
  const provider = options.provider || "groq";

  console.log(`[AI-EVAL] HR batch ${batchNumber}/${totalBatches} answers=${chunk.length} provider=${provider}`);

  const systemPrompt = `You are a Senior HR & Behavioral Evaluator analyzing candidate HR interview answers (${chunk.length} questions, Batch ${batchNumber} of ${totalBatches}).

EVALUATION RULES:
1. Question-Aware: For introductions, goals, or motivation, evaluate substance, self-awareness, and career alignment (do NOT require STAR). For behavioral/situational questions, evaluate situation, action, personal ownership, and outcome.
2. Fair Communication: Do not penalize brevity or simple English if the response shows clear substance, honesty, and maturity. Direct sound answers should receive full marks (17-20).
3. MARKS: Max 20 marks per question.
4. Feedback & Better Answer: Provide concise actionable feedback and a concise refined answer.

STRICT JSON ONLY:
{
  "evaluations": [
    {
      "questionId": "string matching id",
      "score": 18,
      "maxScore": 20,
      "status": "CORRECT",
      "behavioralDimensions": {
        "confidence": 4.5,
        "selfAwareness": 4.5,
        "ownership": 5.0,
        "decisionMaking": 4.0,
        "professionalMaturity": 4.5
      },
      "reasoningStrengths": ["Clear articulation of technical background and project experience"],
      "concerns": [],
      "feedback": "Strong, relevant response tailored to the question.",
      "betterAnswer": "Enhanced version preserving original intent"
    }
  ],
  "overallRating": "Strong",
  "behavioralProfile": {
    "confidence": 4.5,
    "selfAwareness": 4.5,
    "ownership": 4.8,
    "decisionMaking": 4.0,
    "conflictHandling": 4.2
  },
  "consistencyObservations": [],
  "strengths": ["High accountability", "Clear communication"],
  "areasForImprovement": ["Further detail practical examples where appropriate"],
  "finalFeedback": "Comprehensive candidate HR summary"
}`;

  const userPrompt = `Candidate Profile: ${candidateProfile.fullName || candidateProfile.name || "Candidate"}
Questions and Answers:
${JSON.stringify(chunk, null, 2)}

Evaluate all HR answers in valid JSON.`;

  try {
    const parsed = await AIGateway.execute({
      prompt: userPrompt,
      systemPrompt,
      provider,
      apiKey: activeApiKey,
      sessionId: options.sessionId,
      roundType: "evaluation",
      orderIndex: batchNumber,
      options: {
        model: activeModel,
        temperature: 0.3,
        maxRetries: 3,
      },
    });

    if (!parsed || !Array.isArray(parsed.evaluations)) {
      throw new Error(`HR evaluation AI response missing 'evaluations' array in batch ${batchNumber}`);
    }

    const batchEvaluated = parsed.evaluations.map((item, itemIdx) => {
      const itemQId = String(item.questionId || item.id || "");
      const matchingQ =
        chunk.find((q) => q.id === itemQId) ||
        chunk.find((q) => String(q.i) === itemQId) ||
        chunk.find((q) => q.id.endsWith(itemQId)) ||
        chunk[itemIdx] ||
        chunk[0];

      const calibrated = calibrateScore({
        rawScore: item.score,
        maxMarks: 20,
        status: item.status,
        evaluationSource: "ai_provider",
        confidence: 0.95,
        evidence: item.reasoningStrengths || [],
        missing: item.concerns || [],
        contradictions: [],
        feedback: item.feedback,
        betterAnswer: item.betterAnswer || "",
        difficulty: "medium",
      });

      return {
        questionId: String(matchingQ?.id || item.questionId),
        question: matchingQ?.q || "",
        behavioralDimensions: item.behavioralDimensions || {
          confidence: 4.0,
          selfAwareness: 4.0,
          ownership: 4.0,
          decisionMaking: 4.0,
          professionalMaturity: 4.0,
        },
        reasoningStrengths: item.reasoningStrengths || [],
        concerns: item.concerns || [],
        ...calibrated,
      };
    });

    console.log(`[AI-EVAL] HR batch ${batchNumber}/${totalBatches} SUCCESS evaluated=${batchEvaluated.length}`);
    return {
      evaluations: batchEvaluated,
      behavioralProfile: parsed.behavioralProfile || {},
      consistencyObservations: parsed.consistencyObservations || [],
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      areasForImprovement: Array.isArray(parsed.areasForImprovement) ? parsed.areasForImprovement : [],
      finalFeedback: parsed.finalFeedback || "",
      overallRating: parsed.overallRating || "",
    };
  } catch (err) {
    console.error(`[AI-EVAL] HR batch ${batchNumber}/${totalBatches} status=${err.category || err.code || err.name || 'FAILED'}`);
    throw err;
  }
}

/**
 * AI CALL #2: Batch evaluate candidate HR answers in ONE AI request using AIGateway.
 */
export async function evaluateHRAI({ candidateProfile = {}, questionsWithAnswers = [], options = {} }) {
  console.log("\n[REAL-INTERVIEW][AI-CALL]\nround=hr\noperation=evaluation\nattempt=1");

  const gatedEvaluations = [];
  const qaToAI = [];

  for (let idx = 0; idx < questionsWithAnswers.length; idx++) {
    const item = questionsWithAnswers[idx];
    const qIdStr = String(item.questionId || item._id || idx);
    const ans = String(item.candidateAnswer || item.answer || "(No answer provided)").trim();

    const gate = checkAnswerGate(ans, { question: item.question });
    if (gate.isGateTriggered) {
      gatedEvaluations.push({
        questionId: qIdStr,
        score: 0,
        maxScore: 20,
        status: gate.status,
        rating: gate.rating,
        evaluationSource: "ANSWER_GATE",
        behavioralDimensions: {
          confidence: 1.0,
          selfAwareness: 1.0,
          ownership: 1.0,
          decisionMaking: 1.0,
          professionalMaturity: 1.0,
        },
        reasoningStrengths: [],
        concerns: ["Question was not attempted or was declined"],
        feedback: gate.feedback,
        betterAnswer: "Provide a structured, thoughtful response tailored to the question.",
      });
    } else {
      qaToAI.push({
        i: idx + 1,
        id: qIdStr,
        q: item.question,
        cat: item.category || "Behavioral",
        max: 20,
        dimensions: item.behavioralDimensions || [],
        ans,
      });
    }
  }

  let aiEvaluations = [];
  let behavioralProfile = {};
  let strengths = [];
  let areasForImprovement = [];
  let consistencyObservations = [];
  let finalFeedback = "";
  let overallRating = "";

  if (qaToAI.length > 0) {
    const BATCH_SIZE = 3;
    const totalBatches = Math.ceil(qaToAI.length / BATCH_SIZE);

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const chunk = qaToAI.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE);
      const batchNumber = batchIdx + 1;

      const batchRes = await evaluateHRAIBatch({
        chunk,
        batchNumber,
        totalBatches,
        candidateProfile,
        options,
      });

      aiEvaluations.push(...(batchRes.evaluations || []));
      if (batchRes.behavioralProfile && Object.keys(batchRes.behavioralProfile).length) {
        behavioralProfile = { ...behavioralProfile, ...batchRes.behavioralProfile };
      }
      if (batchRes.strengths?.length) strengths.push(...batchRes.strengths);
      if (batchRes.areasForImprovement?.length) areasForImprovement.push(...batchRes.areasForImprovement);
      if (batchRes.consistencyObservations?.length) consistencyObservations.push(...batchRes.consistencyObservations);
      if (batchRes.finalFeedback) finalFeedback = batchRes.finalFeedback;
      if (batchRes.overallRating) overallRating = batchRes.overallRating;

      if (typeof options.onBatchComplete === "function") {
        await options.onBatchComplete(batchRes.evaluations || [], batchNumber, totalBatches);
      }
    }
  }

  const allEvaluations = [...gatedEvaluations, ...aiEvaluations];
  const totalScore = Math.min(60, allEvaluations.reduce((sum, e) => sum + (e.score || 0), 0));
  const percentage = Math.round((totalScore / 60) * 100);

  console.log(`[RealInterviewAI][HR] Complete batch evaluation succeeded`);
  return {
    evaluations: allEvaluations,
    totalScore,
    maxScore: 60,
    percentage,
    overallRating: overallRating || (percentage >= 80 ? "Very Strong" : percentage >= 60 ? "Strong" : percentage >= 40 ? "Average" : "Weak"),
    behavioralProfile,
    consistencyObservations,
    strengths: strengths.length ? strengths : ["Communicated responses in interview context"],
    areasForImprovement: areasForImprovement.length ? areasForImprovement : ["Continue refining scenario articulation"],
    finalFeedback: finalFeedback || `HR evaluation completed. Score: ${totalScore}/60.`,
  };
}
