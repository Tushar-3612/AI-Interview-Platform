import { callPythonGroqBridge } from "../../realInterviewAI/pythonGroqBridge.js";
import { extractJsonFromText } from "../../realInterviewAI/jsonExtractor.js";
import {
  getIndividualTechnicalApiKey,
  getIndividualTechnicalModel,
  getBatchSpecsForDifficulty,
  DIFFICULTY_WEIGHTS,
} from "./individualTechnicalConfig.js";
import { buildQuestionGenerationPrompt } from "./individualTechnicalPrompt.js";
import {
  getUserQuestionHistorySet,
  isDuplicateQuestion,
  normalizeQuestionText,
} from "../../realInterview/questionHistoryService.js";
import TechnicalQuestion from "../../../models/TechnicalQuestion.js";
import Test from "../../../models/Test.js";
import Company from "../../../models/Company.js";
import mongoose from "mongoose";

/**
 * Detects if a question is project-oriented / personal experience based rather than pure technical.
 */
export function isProjectOrientedQuestion(text = "") {
  const str = String(text).trim();
  if (!str) return false;

  const projectPatterns = [
    /\byour project\b/i,
    /\bin your project\b/i,
    /\byour application\b/i,
    /\byour system\b/i,
    /\byour implementation\b/i,
    /\bhow did you (implement|use|choose|select|build|deploy)\b/i,
    /\bwhy did you (use|choose|select|pick)\b/i,
    /\byour project (architecture|api|database|feature|stack|code|repo|repository)\b/i,
    /\bin your project (architecture|api|database)\b/i,
    /\byour deployment\b/i,
    /\byour role\b/i,
    /\byour team\b/i,
    /\bchallenges you faced\b/i,
    /\bwhile building your\b/i,
    /\bhow did you build\b/i,
    /\bexplain your project\b/i,
    /\bwalk me through your project\b/i,
    /\bwhat project\b/i,
    /\bwhich project\b/i,
    /\bdid you use .* in your\b/i,
    /\bin your app\b/i,
  ];

  return projectPatterns.some((pattern) => pattern.test(str));
}

/**
 * Loads technical context for Interview Key mode.
 */
async function loadInterviewKeyTechnicalContext(interviewKeyId) {
  if (!interviewKeyId) {
    throw new Error("Interview Key ID is required when source mode is INTERVIEW_KEY");
  }

  const rawKey = String(interviewKeyId).trim();
  let keySkills = [];
  let keyQuestions = [];

  // 1. Try finding Test document
  if (mongoose.Types.ObjectId.isValid(rawKey)) {
    const testDoc = await Test.findById(rawKey).lean();
    if (testDoc && Array.isArray(testDoc.questions)) {
      keyQuestions = testDoc.questions
        .filter((q) => q.type !== "Coding" && (q.subject === "technical" || q.question))
        .map((q) => q.question);
      if (Array.isArray(testDoc.subjects)) keySkills.push(...testDoc.subjects);
    }
  }

  // 2. Try finding Company document
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

  // 3. Try searching TechnicalQuestion database by companyId / topic
  if (keyQuestions.length === 0) {
    const dbTechQs = await TechnicalQuestion.find({
      $or: [{ companyId: rawKey.toLowerCase() }, { topic: new RegExp(rawKey, "i") }],
    })
      .limit(20)
      .lean();

    if (dbTechQs.length > 0) {
      keyQuestions.push(...dbTechQs.map((q) => q.question));
      keySkills.push(...dbTechQs.map((q) => q.topic));
    }
  }

  if (keyQuestions.length === 0 && keySkills.length === 0) {
    throw new Error(`Interview key '${rawKey}' not found or contains no technical questions.`);
  }

  return {
    skills: Array.from(new Set(keySkills)),
    sampleQuestions: keyQuestions.slice(0, 10),
  };
}

/**
 * Generates 1 targeted replacement question for Individual Technical of a specified difficulty.
 */
async function generateReplacementIndividualTechnicalQuestion({
  skillsContextStr,
  targetDifficulty,
  userHistorySet,
  currentPoolSet,
  apiKey,
  model,
  retriesLeft = 3,
}) {
  if (retriesLeft <= 0) return null;

  const excluded = Array.from(new Set([...userHistorySet, ...currentPoolSet])).slice(0, 40);
  const prompt = `You are a senior technical interviewer. Generate EXACTLY 1 unique pure technical concept question for a candidate with these skills: ${skillsContextStr}.

REQUIRED DIFFICULTY: ${targetDifficulty}

CRITICAL RULES:
1. PURE TECHNICAL KNOWLEDGE ONLY: Ask ONLY about core concepts, technology internals, syntax, architecture principles, debugging scenarios, performance, or technical trade-offs.
2. ABSOLUTELY NO PROJECT QUESTIONS: Do NOT ask about the candidate's personal projects, project implementation, or why they used a technology in their project.
3. DO NOT generate any question that is identical or semantically similar to any of these previously asked questions:
${excluded.map((q) => `- ${q}`).join("\n")}

Output ONLY valid JSON starting immediately with {"questions": [...]}.

JSON SCHEMA:
{
  "questions": [
    {
      "question": "Clear technical concept question in simple English",
      "difficulty": "${targetDifficulty}",
      "topic": "Core Concept",
      "skill": "Node.js",
      "expectedConcepts": ["Key point 1", "Key point 2"]
    }
  ]
}`;

  try {
    const rawText = await callPythonGroqBridge({
      round: "ind_tech_replacement",
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
      return generateReplacementIndividualTechnicalQuestion({
        skillsContextStr,
        targetDifficulty,
        userHistorySet,
        currentPoolSet,
        apiKey,
        model,
        retriesLeft: retriesLeft - 1,
      });
    }

    const text = String(q.question).trim();
    if (isProjectOrientedQuestion(text) || isDuplicateQuestion(text, userHistorySet, currentPoolSet)) {
      console.warn(`[IndividualTechnicalAI] Replacement "${text}" was project-oriented or duplicate. Retrying (${retriesLeft - 1} left)...`);
      return generateReplacementIndividualTechnicalQuestion({
        skillsContextStr,
        targetDifficulty,
        userHistorySet,
        currentPoolSet,
        apiKey,
        model,
        retriesLeft: retriesLeft - 1,
      });
    }

    const rawWeight = DIFFICULTY_WEIGHTS[targetDifficulty] || 5;
    return {
      question: text,
      difficulty: targetDifficulty,
      topic: String(q.topic || "Technical Fundamentals").trim(),
      skill: String(q.skill || "General").trim(),
      expectedConcepts: Array.isArray(q.expectedConcepts) ? q.expectedConcepts : ["Core technical principle"],
      marks: rawWeight,
    };
  } catch (err) {
    console.error("[IndividualTechnicalAI] Replacement generation failed:", err.message);
    return null;
  }
}

/**
 * Generates 20 resume/key driven technical questions via Python AI bridge.
 */
export async function generateIndividualTechnicalQuestionsAI({
  candidateProfile = {},
  sourceMode = "RESUME",
  interviewKeyId = "",
  difficulty = "Mixed",
  sessionHistory = [],
  userId = null,
}) {
  const apiKey = getIndividualTechnicalApiKey();
  const model = getIndividualTechnicalModel();
  const batchSpecs = getBatchSpecsForDifficulty(difficulty);

  const userHistorySet = await getUserQuestionHistorySet(userId);

  let skillsContextStr = "";

  if (sourceMode === "INTERVIEW_KEY") {
    const keyData = await loadInterviewKeyTechnicalContext(interviewKeyId);
    skillsContextStr = keyData.skills.length > 0
      ? keyData.skills.join(", ")
      : "Computer Science, Software Engineering, OOP, Algorithms";
    if (keyData.sampleQuestions.length > 0) {
      skillsContextStr += ` (Focus topics derived from key questions: ${keyData.sampleQuestions.slice(0, 5).join("; ")})`;
    }
  } else {
    // RESUME Mode
    const skillsList = [
      ...(candidateProfile.skills || []),
      ...(candidateProfile.programmingLanguages || []),
      ...(candidateProfile.frameworks || []),
      ...(candidateProfile.databases || []),
      ...(candidateProfile.tools || []),
      ...(candidateProfile.cloud || []),
    ]
      .map((s) => String(s).trim())
      .filter(Boolean);

    const uniqueSkills = Array.from(new Set(skillsList));
    skillsContextStr =
      uniqueSkills.length > 0
        ? uniqueSkills.slice(0, 15).join(", ")
        : "Computer Science Fundamentals, Data Structures, OOP, Software Engineering Principles";
  }

  console.log(`[IndividualTechnicalAI] Generating 20 questions for userId=${userId}. Source=${sourceMode}, Difficulty=${difficulty}, Skills=[${skillsContextStr}], UserHistorySize=${userHistorySet.size}`);

  const allQuestions = [];
  const currentPoolSet = new Set();
  sessionHistory.forEach((h) => {
    const norm = normalizeQuestionText(h);
    if (norm) currentPoolSet.add(norm);
  });

  for (const spec of batchSpecs) {
    const excludedQuestions = Array.from(new Set([...userHistorySet, ...currentPoolSet]));
    const prompt = buildQuestionGenerationPrompt({
      skillsContextStr,
      batchSpec: spec,
      difficultyMode: difficulty,
      excludedQuestions,
    });

    const messages = [
      {
        role: "system",
        content: "You are a professional technical interviewer who generates high-quality technical questions in simple English. Output valid JSON only.",
      },
      {
        role: "user",
        content: prompt,
      },
    ];

    try {
      const rawText = await callPythonGroqBridge({
        round: `individual_technical_batch_${spec.batchIndex}`,
        apiKey,
        model,
        messages,
        temperature: 0.3,
        max_tokens: 3000,
        timeoutMs: 45000,
      });

      const parsed = extractJsonFromText(rawText);
      const batchQuestions = Array.isArray(parsed?.questions) ? parsed.questions : [];

      for (let i = 0; i < batchQuestions.length; i++) {
        const q = batchQuestions[i];
        let text = (q.question || "").trim();
        if (!text) continue;

        // Assign proper difficulty label according to spec and requested difficulty mode
        let targetDifficulty = "Medium";
        if (difficulty === "Easy") targetDifficulty = "Easy";
        else if (difficulty === "Medium") targetDifficulty = "Medium";
        else if (difficulty === "Hard") targetDifficulty = "Hard";
        else {
          // Mixed difficulty mode
          if (spec.easy > 0 && i < spec.easy) targetDifficulty = "Easy";
          else if (spec.hard > 0 && i >= batchQuestions.length - spec.hard) targetDifficulty = "Hard";
          else targetDifficulty = q.difficulty || "Medium";
        }

        const rawWeight = DIFFICULTY_WEIGHTS[targetDifficulty] || 5;

        let candidateQ = {
          questionId: `tech_q_${allQuestions.length + 1}_${Date.now()}`,
          question: text,
          difficulty: targetDifficulty,
          topic: q.topic || "Technical Fundamentals",
          skill: q.skill || "General",
          expectedConcepts: Array.isArray(q.expectedConcepts) ? q.expectedConcepts : [],
          marks: rawWeight,
        };

        const isProj = isProjectOrientedQuestion(text);
        const isDup = isDuplicateQuestion(text, userHistorySet, currentPoolSet);

        if (isProj || isDup) {
          console.warn(`[IndividualTechnicalAI] Batch ${spec.batchIndex} Q#${i+1} rejected (project-oriented=${isProj}, duplicate=${isDup}): "${text}". Generating pure technical replacement (${targetDifficulty})...`);
          const replacement = await generateReplacementIndividualTechnicalQuestion({
            skillsContextStr,
            targetDifficulty,
            userHistorySet,
            currentPoolSet,
            apiKey,
            model,
            retriesLeft: 3,
          });

          if (replacement) {
            candidateQ = {
              questionId: `tech_q_${allQuestions.length + 1}_${Date.now()}`,
              ...replacement,
            };
          }
        }

        const normText = normalizeQuestionText(candidateQ.question);
        if (normText) currentPoolSet.add(normText);

        allQuestions.push(candidateQ);
      }
    } catch (err) {
      console.error(`[IndividualTechnicalAI] Batch ${spec.batchIndex} error:`, err.message);
    }
  }

  // Backup / fallback if AI generated fewer than 20 due to duplicates
  if (allQuestions.length < 20) {
    console.warn(`[IndividualTechnicalAI] Generated ${allQuestions.length}/20 questions. Topping up from database bank...`);
    const existingDbQuestions = await TechnicalQuestion.find({ isDeleted: { $ne: true } })
      .limit(50)
      .lean();

    for (const dbQ of existingDbQuestions) {
      if (allQuestions.length >= 20) break;
      const text = dbQ.question;

      if (!isProjectOrientedQuestion(text) && !isDuplicateQuestion(text, userHistorySet, currentPoolSet)) {
        const normText = normalizeQuestionText(text);
        if (normText) currentPoolSet.add(normText);

        const qDiff = dbQ.difficulty || "Medium";
        allQuestions.push({
          questionId: `tech_q_${allQuestions.length + 1}_${Date.now()}`,
          question: text,
          difficulty: qDiff,
          topic: dbQ.topic || "Technical Fundamentals",
          skill: dbQ.subtopic || "General",
          expectedConcepts: [dbQ.expectedAnswer || "Core technical concept"],
          marks: DIFFICULTY_WEIGHTS[qDiff] || 5,
        });
      }
    }
  }

  // Final trim to 20 questions
  const finalQuestions = allQuestions.slice(0, 20);

  if (finalQuestions.length === 0) {
    throw new Error("Failed to generate Individual Technical questions. Please try again.");
  }

  return finalQuestions;
}


