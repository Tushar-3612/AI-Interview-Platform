import { callPythonGroqBridge } from "../../realInterviewAI/pythonGroqBridge.js";
import { extractJsonFromText } from "../../realInterviewAI/jsonExtractor.js";
import {
  getIndividualProjectApiKey,
  getIndividualProjectModel,
  getProjectDifficultyBreakdown,
} from "./individualProjectConfig.js";
import {
  buildProjectQuestionPrompt,
  buildProjectReplacementQuestionPrompt,
} from "./individualProjectPrompt.js";
import { isProjectQuestionValid } from "./individualProjectQuestionValidator.js";
import {
  getUserQuestionHistorySet,
  isDuplicateQuestion,
  normalizeQuestionText,
  recordUserQuestionHistory,
} from "../../realInterview/questionHistoryService.js";
import Test from "../../../models/Test.js";
import Company from "../../../models/Company.js";
import TechnicalQuestion from "../../../models/TechnicalQuestion.js";
import mongoose from "mongoose";

/**
 * Loads interview key context if source mode is INTERVIEW_KEY.
 */
async function loadInterviewKeyContext(interviewKeyId) {
  if (!interviewKeyId) {
    throw new Error("Interview Key ID is required when source mode is INTERVIEW_KEY");
  }

  const rawKey = String(interviewKeyId).trim();
  let keySkills = [];
  let keyQuestions = [];

  if (mongoose.Types.ObjectId.isValid(rawKey)) {
    const testDoc = await Test.findById(rawKey).lean();
    if (testDoc && Array.isArray(testDoc.questions)) {
      keyQuestions = testDoc.questions.map((q) => q.question).filter(Boolean);
      if (Array.isArray(testDoc.subjects)) keySkills.push(...testDoc.subjects);
    }
  }

  if (keyQuestions.length === 0) {
    let companyDoc = await Company.findOne({
      $or: [{ id: rawKey.toLowerCase() }, { name: new RegExp(`^${rawKey}$`, "i") }],
    }).lean();

    if (companyDoc) {
      if (Array.isArray(companyDoc.requiredSkills)) keySkills.push(...companyDoc.requiredSkills);
      const dbTechQs = await TechnicalQuestion.find({ companyId: companyDoc.id }).lean();
      keyQuestions.push(...dbTechQs.map((q) => q.question));
    }
  }

  if (keyQuestions.length === 0 && keySkills.length === 0) {
    throw new Error(`Interview key '${rawKey}' not found or contains no questions.`);
  }

  return {
    skills: Array.from(new Set(keySkills)),
    sampleQuestions: keyQuestions.slice(0, 10),
  };
}

/**
 * Generates 1 targeted replacement question if a generated question fails validation.
 */
async function generateReplacementProjectQuestion({
  candidateProjects,
  interviewKeyContext,
  targetDifficulty,
  userHistorySet,
  currentPoolSet,
  apiKey,
  model,
  retriesLeft = 3,
}) {
  if (retriesLeft <= 0) return null;

  const excludedQuestions = Array.from(new Set([...userHistorySet, ...currentPoolSet]));
  const prompt = buildProjectReplacementQuestionPrompt({
    candidateProjects,
    interviewKeyContext,
    targetDifficulty,
    excludedQuestions,
  });

  try {
    const rawText = await callPythonGroqBridge({
      round: "ind_proj_replacement",
      apiKey,
      model,
      messages: [
        {
          role: "system",
          content: 'You are a JSON API endpoint. Output ONLY valid JSON starting immediately with {"questions": [...]} without markdown.',
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
      return generateReplacementProjectQuestion({
        candidateProjects,
        interviewKeyContext,
        targetDifficulty,
        userHistorySet,
        currentPoolSet,
        apiKey,
        model,
        retriesLeft: retriesLeft - 1,
      });
    }

    const text = String(q.question).trim();
    const isValid = isProjectQuestionValid(text, candidateProjects);
    const isDup = isDuplicateQuestion(text, userHistorySet, currentPoolSet);

    if (!isValid || isDup) {
      console.warn(`[IndividualProjectAI] Replacement "${text}" invalid/duplicate. Retrying (${retriesLeft - 1} left)...`);
      return generateReplacementProjectQuestion({
        candidateProjects,
        interviewKeyContext,
        targetDifficulty,
        userHistorySet,
        currentPoolSet,
        apiKey,
        model,
        retriesLeft: retriesLeft - 1,
      });
    }

    return {
      question: text,
      expectedKnowledge: q.expectedKnowledge || "Project architectural implementation",
      difficulty: targetDifficulty,
      topic: q.topic || "Project Architecture",
      projectName: q.projectName || candidateProjects[0]?.name || "Project",
    };
  } catch (err) {
    console.error("[IndividualProjectAI] Replacement error:", err.message);
    return null;
  }
}

/**
 * Generates EXACTLY 10 deep Project/Resume questions via Python AI bridge.
 */
export async function generateIndividualProjectQuestionsAI({
  candidateProfile = {},
  sourceMode = "RESUME",
  interviewKeyId = "",
  difficulty = "Mixed",
  sessionHistory = [],
  userId = null,
}) {
  const apiKey = getIndividualProjectApiKey();
  const model = getIndividualProjectModel();
  const breakdown = getProjectDifficultyBreakdown(difficulty);

  const userHistorySet = await getUserQuestionHistorySet(userId);

  let candidateProjects = candidateProfile.resumeProjects || candidateProfile.projects || [];
  let interviewKeyContext = null;

  if (sourceMode === "INTERVIEW_KEY") {
    interviewKeyContext = await loadInterviewKeyContext(interviewKeyId);
  }

  const currentPoolSet = new Set();
  sessionHistory.forEach((h) => {
    const norm = normalizeQuestionText(h);
    if (norm) currentPoolSet.add(norm);
  });

  const excludedQuestions = Array.from(new Set([...userHistorySet, ...currentPoolSet]));

  const prompt = buildProjectQuestionPrompt({
    candidateProjects,
    interviewKeyContext,
    difficulty,
    excludedQuestions,
  });

  const messages = [
    {
      role: "system",
      content: "You are a senior tech lead conducting a deep project & resume interview. Output ONLY valid JSON starting immediately with {\"questions\": [...]}.",
    },
    { role: "user", content: prompt },
  ];

  console.log(`[IndividualProjectAI] Generating 10 questions for userId=${userId}. Source=${sourceMode}, Difficulty=${difficulty}, UserHistorySize=${userHistorySet.size}`);

  let rawQuestions = [];
  try {
    const rawText = await callPythonGroqBridge({
      round: "individual_project_generation",
      apiKey,
      model,
      messages,
      temperature: 0.3,
      max_tokens: 3500,
      timeoutMs: 60000,
    });

    const parsed = extractJsonFromText(rawText);
    rawQuestions = Array.isArray(parsed?.questions) ? parsed.questions : [];
  } catch (err) {
    console.error("[IndividualProjectAI] AI call 1 failed:", err.message);
  }

  const finalQuestions = [];

  for (let i = 0; i < 10; i++) {
    let rawQ = rawQuestions[i];
    let text = (rawQ?.question || "").trim();

    // Determine target difficulty and mark weight
    let targetDiff = "Medium";
    let markWeight = 10;

    const mode = String(difficulty).trim().toLowerCase();
    if (mode === "easy") {
      targetDiff = "Easy";
      markWeight = breakdown.easyMarks;
    } else if (mode === "medium") {
      targetDiff = "Medium";
      markWeight = breakdown.mediumMarks;
    } else if (mode === "hard") {
      targetDiff = "Hard";
      markWeight = breakdown.hardMarks;
    } else {
      // Mixed mode (4 Easy @ 5, 4 Medium @ 10, 2 Hard @ 20)
      if (i < 4) {
        targetDiff = "Easy";
        markWeight = 5;
      } else if (i < 8) {
        targetDiff = "Medium";
        markWeight = 10;
      } else {
        targetDiff = "Hard";
        markWeight = 20;
      }
    }

    let isValid = text ? isProjectQuestionValid(text, candidateProjects) : false;
    let isDup = text ? isDuplicateQuestion(text, userHistorySet, currentPoolSet) : true;

    if (!text || !isValid || isDup) {
      console.warn(`[IndividualProjectAI] Question Q#${i+1} rejected (valid=${isValid}, dup=${isDup}, text="${text}"). Generating targeted replacement...`);
      const replacement = await generateReplacementProjectQuestion({
        candidateProjects,
        interviewKeyContext,
        targetDifficulty: targetDiff,
        userHistorySet,
        currentPoolSet,
        apiKey,
        model,
        retriesLeft: 3,
      });

      if (replacement) {
        text = replacement.question;
        rawQ = replacement;
      } else {
        // Fallback default question if AI replacement fails
        text = `In your project (${candidateProjects[0]?.name || "application"}), how did you approach the system architecture and handle potential backend failure scenarios?`;
        rawQ = {
          question: text,
          expectedKnowledge: "System architecture and failure handling",
          topic: "Architecture & Failure Scenarios",
          projectName: candidateProjects[0]?.name || "Project",
        };
      }
    }

    const norm = normalizeQuestionText(text);
    if (norm) currentPoolSet.add(norm);

    finalQuestions.push({
      questionId: `proj_q_${i + 1}_${Date.now()}`,
      question: text,
      difficulty: targetDiff,
      topic: rawQ?.topic || "Project Architecture",
      projectName: rawQ?.projectName || candidateProjects[0]?.name || "Project",
      expectedKnowledge: rawQ?.expectedKnowledge || "Key architectural implementation concepts",
      marks: markWeight,
    });
  }

  return finalQuestions;
}
