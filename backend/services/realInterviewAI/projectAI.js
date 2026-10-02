import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../.env") });

import { AIGateway } from "../aiReliability/index.js";
import { isDuplicateQuestion, normalizeQuestionText } from "../realInterview/questionHistoryService.js";

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
  const custom = (process.env.REAL_INTERVIEW_PROJECT_MODEL || process.env.GROQ_MODEL || process.env.AI_MODEL || "").trim();
  if (custom) return custom;
  return "openai/gpt-oss-120b";
}

/**
 * Helper to call AI Gateway for a specific list of target question difficulties.
 */
async function callProjectAIGeneration({
  candidateProfile,
  projectsContext,
  defaultProjName,
  userHistorySet,
  currentPoolSet,
  targetDifficulties = ["easy", "easy", "medium", "medium", "hard"],
  options = {},
}) {
  const count = targetDifficulties.length;
  const apiKey = options.apiKey || getProjectApiKey();
  const model = options.model || getProjectModel();
  const provider = options.provider || "groq";

  const easyCount = targetDifficulties.filter((d) => d === "easy").length;
  const mediumCount = targetDifficulties.filter((d) => d === "medium").length;
  const hardCount = targetDifficulties.filter((d) => d === "hard").length;

  const diffLines = [];
  if (easyCount > 0) diffLines.push(`- ${easyCount} Easy question(s) (5 marks each)`);
  if (mediumCount > 0) diffLines.push(`- ${mediumCount} Medium question(s) (10 marks each)`);
  if (hardCount > 0) diffLines.push(`- ${hardCount} Hard question(s) (20 marks each)`);

  const excludedList = Array.from(new Set([...userHistorySet, ...currentPoolSet])).slice(0, 30);
  const exclusionText = excludedList.length > 0
    ? `\nABSOLUTE ZERO-REPETITION RULE:
Do NOT generate any question that matches or paraphrases any of:
${excludedList.map((q) => `- ${q}`).join("\n")}\n`
    : "";

  const prompt = `Generate a JSON object with key "questions" containing EXACTLY ${count} deep project interview questions based on candidate's project portfolio:

CANDIDATE PROJECTS:
${projectsContext}

DIFFICULTY REQUIREMENTS (${count} total):
${diffLines.join("\n")}
${exclusionText}
CRITICAL GROUNDING CONSTRAINTS:
1. "questions" MUST be an array of EXACTLY ${count} objects.
2. Ask about actual technologies, architecture, data flow, trade-offs, and challenges mentioned in candidate projects.
3. "question": Grounded project question.
4. "expectedKnowledge": Concise key architectural and technical points expected (2-3 sentences max).
5. "difficulty": Assign according to difficulty requirements ("easy", "medium", or "hard").
6. "topic": Project domain or component.
7. "projectName": Project name associated with question.
8. Do NOT generate or rephrase any question from the exclusion list.

JSON OUTPUT ONLY:
{
  "questions": [
    {
      "question": "Deep architectural or technical question on candidate project",
      "expectedKnowledge": "Key implementation details expected",
      "difficulty": "${targetDifficulties[0] || 'easy'}",
      "topic": "Architecture & API Flow",
      "projectName": "${defaultProjName}"
    }
  ]
}`;

  const parsed = await AIGateway.execute({
    prompt,
    systemPrompt: "You are a JSON API endpoint. Output ONLY valid JSON starting immediately with {\"questions\": [...]} without any reasoning, thinking, markdown or commentary.",
    provider,
    apiKey,
    sessionId: options.sessionId,
    roundType: "project",
    orderIndex: 1,
    options: {
      model,
      temperature: 0.1,
      maxRetries: 3,
      maxOutputTokens: 8192,
    },
  });

  return parsed;
}

/**
 * Generates EXACTLY 5 deep Project/Resume questions using AIGateway with partial recovery.
 */
export async function generateProjectAI(candidateProfile = {}, userHistorySet = new Set(), options = {}) {
  console.log("\n[REAL-INTERVIEW][AI-CALL]\nround=project\noperation=generation\nattempt=1");

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
  }).filter((p) => Boolean(p.name && p.name !== "Project"));

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

  // Determine initial required difficulties based on missingIndices if provided, else default 5
  let requiredDifficulties = ["easy", "easy", "medium", "medium", "hard"];
  if (Array.isArray(options.missingIndices) && options.missingIndices.length > 0) {
    requiredDifficulties = options.missingIndices.map((idx) => (idx < 2 ? "easy" : idx < 4 ? "medium" : "hard"));
  }
  const totalTargetCount = requiredDifficulties.length;

  const currentPoolSet = new Set();
  const collectedQuestions = [];

  const extractValidQuestions = (rawQuestions, targetDiffs) => {
    const valid = [];
    if (!Array.isArray(rawQuestions)) return valid;

    for (let i = 0; i < rawQuestions.length; i++) {
      const q = rawQuestions[i];
      if (!q || typeof q !== "object") continue;
      const qText = String(q.question || q.questionText || "").trim();
      if (!qText) continue;

      if (isDuplicateQuestion(qText, userHistorySet, currentPoolSet)) {
        console.warn(`[ProjectAI] Skipping duplicate question: "${qText.slice(0, 60)}..."`);
        continue;
      }

      const norm = normalizeQuestionText(qText);
      if (norm) currentPoolSet.add(norm);

      const assignedDiff = q.difficulty && ["easy", "medium", "hard"].includes(String(q.difficulty).toLowerCase())
        ? String(q.difficulty).toLowerCase()
        : (targetDiffs[valid.length] || "medium");

      const maxMarks = assignedDiff === "easy" ? 5 : assignedDiff === "hard" ? 20 : 10;

      valid.push({
        question: qText,
        expectedKnowledge: String(
          q.expectedKnowledge ||
          q.expected_knowledge ||
          q.expectedAnswer ||
          "Demonstrate clear project workflow, architecture reasoning, and technical implementation details."
        ).trim(),
        difficulty: assignedDiff,
        maxMarks,
        topic: String(q.topic || "Project Engineering").trim(),
        category: "resume_project",
        projectName: String(q.projectName || defaultProjName).trim(),
        source: "AI_PROVIDER",
      });
    }
    return valid;
  };

  // 1. Initial attempt
  try {
    const initialParsed = await callProjectAIGeneration({
      candidateProfile,
      projectsContext,
      defaultProjName,
      userHistorySet,
      currentPoolSet,
      targetDifficulties: requiredDifficulties,
      options,
    });

    const initialValid = extractValidQuestions(initialParsed?.questions || [], requiredDifficulties);
    collectedQuestions.push(...initialValid);
  } catch (initialErr) {
    console.error(`[ProjectAI] Initial AI question generation failed: ${initialErr.message}`);
    if (collectedQuestions.length === 0) {
      throw initialErr;
    }
  }

  // 2. Partial Recovery: If fewer valid questions were received than target count, retry ONLY the missing count
  if (collectedQuestions.length < totalTargetCount) {
    const missingCount = totalTargetCount - collectedQuestions.length;
    console.log(`[ProjectAI] Partial AI response received (${collectedQuestions.length}/${totalTargetCount}). Retrying ONLY ${missingCount} missing question(s) via AI...`);

    const currentDiffCounts = { easy: 0, medium: 0, hard: 0 };
    for (const q of collectedQuestions) {
      const d = q.difficulty || "medium";
      if (currentDiffCounts[d] !== undefined) currentDiffCounts[d]++;
    }

    const expectedEasy = requiredDifficulties.filter((d) => d === "easy").length;
    const expectedMedium = requiredDifficulties.filter((d) => d === "medium").length;
    const expectedHard = requiredDifficulties.filter((d) => d === "hard").length;

    const missingDiffs = [];
    if (currentDiffCounts.easy < expectedEasy) {
      for (let i = 0; i < expectedEasy - currentDiffCounts.easy; i++) missingDiffs.push("easy");
    }
    if (currentDiffCounts.medium < expectedMedium) {
      for (let i = 0; i < expectedMedium - currentDiffCounts.medium; i++) missingDiffs.push("medium");
    }
    if (currentDiffCounts.hard < expectedHard) {
      for (let i = 0; i < expectedHard - currentDiffCounts.hard; i++) missingDiffs.push("hard");
    }
    while (missingDiffs.length < missingCount) {
      missingDiffs.push("medium");
    }
    const targetMissingDiffs = missingDiffs.slice(0, missingCount);

    try {
      const retryParsed = await callProjectAIGeneration({
        candidateProfile,
        projectsContext,
        defaultProjName,
        userHistorySet,
        currentPoolSet,
        targetDifficulties: targetMissingDiffs,
        options,
      });

      const retryValid = extractValidQuestions(retryParsed?.questions || [], targetMissingDiffs);
      collectedQuestions.push(...retryValid);
    } catch (retryErr) {
      console.warn(`[ProjectAI] Targeted retry for ${missingCount} missing questions failed: ${retryErr.message}. Preserving ${collectedQuestions.length} valid questions.`);
    }
  }

  if (collectedQuestions.length > 0) {
    console.log(`[RealInterviewAI][Project] Returned ${collectedQuestions.length}/${totalTargetCount} questions successfully`);
    return { questions: collectedQuestions.slice(0, totalTargetCount) };
  }

  throw new Error("Project AI returned 0 questions");
}

import { checkAnswerGate } from "./judgeAnswerGate.js";
import { calibrateScore, checkContradictions } from "./judgeScoreCalibrator.js";

/**
 * Evaluates a batch of project questions using AIGateway.
 */
export async function evaluateProjectAIBatch({ chunk = [], batchNumber = 1, totalBatches = 1, options = {} }) {
  if (!chunk || chunk.length === 0) return [];

  const apiKey = options.apiKey || getProjectApiKey();
  const model = options.model || getProjectModel();
  const provider = options.provider || "groq";

  console.log(`[AI-EVAL] Project batch ${batchNumber}/${totalBatches} answers=${chunk.length} provider=${provider}`);

  const prompt = `You are a senior technical interviewer evaluating candidate project responses (${chunk.length} questions, Batch ${batchNumber} of ${totalBatches}).

BATCH ITEMS:
${JSON.stringify(chunk, null, 2)}

EVALUATION INSTRUCTIONS:
1. Evaluate candidate response (ans) against expected reference criteria (expected) and question (q).
2. Judge technical workflow, architecture decisions, trade-offs, and implementation depth.
3. Award full marks for concise, technically correct answers. Do NOT penalize brevity.
4. MARKS:
   - Easy (maxScore 5): 0=incorrect, 1-2=weak, 3=acceptable, 4=strong, 5=excellent.
   - Medium (maxScore 10): 0=incorrect, 1-3=weak, 4-6=partial, 7-8=strong, 9-10=excellent.
   - Hard (maxScore 20): 0=incorrect, 1-6=weak, 7-12=partial, 13-17=strong, 18-20=excellent.
5. Provide concise feedback and a concise betterAnswer.

STRICT JSON ONLY:
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
      "betterAnswer": "Concise refined answer"
    }
  ],
  "overallRating": "Very Strong",
  "strengths": ["Clear architecture workflow"],
  "weaknesses": ["Detail error handling"],
  "finalFeedback": "Concise project evaluation summary"
}`;

  try {
    const parsed = await AIGateway.execute({
      prompt,
      systemPrompt: "You are a project interviewer evaluator. Output ONLY valid JSON starting immediately with {\"evaluations\": [...]}.",
      provider,
      apiKey,
      sessionId: options.sessionId,
      roundType: "evaluation",
      orderIndex: batchNumber,
      options: {
        model,
        temperature: 0.2,
        maxRetries: 3,
      },
    });

    if (!parsed || !Array.isArray(parsed.evaluations)) {
      throw new Error(`Project evaluation AI response missing 'evaluations' array in batch ${batchNumber}`);
    }

    const batchEvaluated = parsed.evaluations.map((item, itemIdx) => {
      const itemQId = String(item.questionId || item.id || "");
      const matchingQ =
        chunk.find((q) => q.id === itemQId) ||
        chunk.find((q) => String(q.i) === itemQId) ||
        chunk.find((q) => q.id.endsWith(itemQId)) ||
        chunk[itemIdx] ||
        chunk[0];

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
        questionId: String(matchingQ?.id || item.questionId),
        question: matchingQ?.q || "",
        difficulty: matchingQ?.diff || "medium",
        maxScore,
        expectedKnowledge: matchingQ?.expected || "",
        ...calibrated,
      };
    });

    console.log(`[AI-EVAL] Project batch ${batchNumber}/${totalBatches} SUCCESS evaluated=${batchEvaluated.length}`);
    return {
      evaluations: batchEvaluated,
      overallRating: parsed.overallRating,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      finalFeedback: parsed.finalFeedback || "",
    };
  } catch (err) {
    console.error(`[AI-EVAL] Project batch ${batchNumber}/${totalBatches} status=${err.category || err.code || err.name || 'FAILED'}`);
    throw err;
  }
}

/**
 * Evaluates candidate project answers in batches (preferably 1 batch of 5).
 */
export async function evaluateProjectInterviewAI({ candidateProfile = {}, questions = [], options = {} }) {
  console.log("\n[REAL-INTERVIEW][AI-CALL]\nround=project\noperation=evaluation\nattempt=1");

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
  let overallRating = "";

  if (questionsToAI.length > 0) {
    const BATCH_SIZE = 5;
    const totalBatches = Math.ceil(questionsToAI.length / BATCH_SIZE);

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const chunk = questionsToAI.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE);
      const batchNumber = batchIdx + 1;

      const batchRes = await evaluateProjectAIBatch({
        chunk,
        batchNumber,
        totalBatches,
        options,
      });

      aiEvaluations.push(...(batchRes.evaluations || []));
      if (batchRes.strengths?.length) strengths.push(...batchRes.strengths);
      if (batchRes.weaknesses?.length) weaknesses.push(...batchRes.weaknesses);
      if (batchRes.finalFeedback) finalFeedback = batchRes.finalFeedback;
      if (batchRes.overallRating) overallRating = batchRes.overallRating;

      if (typeof options.onBatchComplete === "function") {
        await options.onBatchComplete(batchRes.evaluations || [], batchNumber, totalBatches);
      }
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
    overallRating: overallRating || (percentage >= 80 ? "Very Strong" : percentage >= 60 ? "Strong" : percentage >= 40 ? "Average" : "Weak"),
    strengths: strengths.length ? strengths : ["Project architecture and implementation answers evaluated"],
    weaknesses: weaknesses.length ? weaknesses : ["Areas for refinement identified in project explanations"],
    finalFeedback: finalFeedback || `Project evaluation completed. Score: ${scaledScore}/100.`,
  };
}
