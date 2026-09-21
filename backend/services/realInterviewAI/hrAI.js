import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../.env") });

import { AIGateway } from "../aiReliability/index.js";

function getHRConfig(attempt = 1) {
  const apiKey = (process.env.REAL_INTERVIEW_HR_API_KEY || process.env.GROQ_API_KEY || "").trim();
  const custom = (process.env.REAL_INTERVIEW_HR_MODEL || "").trim();
  const model = custom || (attempt === 2 ? "openai/gpt-oss-20b" : "openai/gpt-oss-120b");
  return { apiKey, model };
}

/**
 * AI CALL #1: Generate 2 AI HR questions (for Q2 & Q3) in ONE AI request using AIGateway.
 */
export async function generateHRAI({ candidateProfile = {}, userHistorySet = new Set(), count = 2, options = {} }) {
  console.log("\n[REAL-INTERVIEW][AI-CALL]\nround=hr\noperation=generation\nattempt=1");

  const { apiKey: configApiKey, model: configModel } = getHRConfig(1);
  const activeApiKey = options.apiKey || configApiKey;
  const activeModel = options.model || configModel;

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

  const targetCount = count || 2;
  const minRequired = Math.min(targetCount, 2); // We need at least 2 usable; over-request is a dedup buffer
  const systemPrompt = `You are a Senior HR Vice President conducting a final HR cultural & behavioral interview for a top tier tech company.
Your task is to generate EXACTLY ${targetCount} high-impact, professional, DIVERSE HR interview questions tailored to the candidate's profile.
Note: Q1 is a fixed introduction question handled separately. These questions are additional behavioral/situational questions.

CRITICAL ARCHITECTURAL RULES:
1. TOTAL QUESTIONS TO GENERATE: EXACTLY ${targetCount}. NO MORE, NO LESS.
2. EACH QUESTION MUST BE SUBSTANTIALLY DIFFERENT from every other question — different topic, different scenario, different behavioral dimension.
3. QUESTION CATEGORIES:
   - Cultural Fit, Value Alignment & Behavioral Scenarios (STAR format)
   - Situational Judgment, Problem Solving & Leadership Under Pressure
4. RESUME GROUNDING: Mention aspects of the candidate's background (education, project experience, leadership) naturally in the questions.
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
      "evaluationCriteria": ["STAR approach", "Clear metrics", "Ownership"],
      "sampleGoodAnswer": "Key points of a top-scoring response"
    }
  ]
}`;

  const userPrompt = `Candidate Profile:\n${profileSummary}\n${exclusionText}\nGenerate EXACTLY ${targetCount} deep HR questions in valid JSON.`;

  const parsed = await AIGateway.execute({
    prompt: userPrompt,
    systemPrompt,
    provider: options.provider || "groq",
    apiKey: activeApiKey,
    sessionId: options.sessionId,
    roundType: "hr",
    orderIndex: 1,
    options: {
      model: activeModel,
      temperature: 0.1,
      maxRetries: 3
    }
  });

  const questions = parsed.questions || parsed.data || (Array.isArray(parsed) ? parsed : null);
  if (Array.isArray(questions) && questions.length >= minRequired) {
    const formattedQuestions = questions.slice(0, targetCount).map((q, idx) => ({
      questionIndex: idx + 2,
      question: q.question || q.questionText || q.text || q.prompt || (typeof q === "string" ? q : `Behavioral Scenario Question #${idx + 2}`),
      category: q.category || "Behavioral & Situational",
      difficulty: idx === 0 ? "easy" : "medium",
      maxMarks: 20,
      behavioralDimensions: Array.isArray(q.behavioralDimensions) ? q.behavioralDimensions : ["decisionMaking", "ownership"],
      resumeReference: q.resumeReference || "",
    }));

    console.log(`[RealInterviewAI][HR] Generated ${formattedQuestions.length} HR AI questions successfully`);
    return formattedQuestions;
  }

  throw new Error(`HR AI generation returned less than ${minRequired} questions`);
}

/**
 * AI CALL #2: Batch evaluate candidate HR answers in ONE AI request using AIGateway.
 */
export async function evaluateHRAI({ candidateProfile = {}, questionsWithAnswers = [], options = {} }) {
  console.log("\n[REAL-INTERVIEW][AI-CALL]\nround=hr\noperation=evaluation\nattempt=1");

  const { apiKey: configApiKey, model: configModel } = getHRConfig(1);
  const activeApiKey = options.apiKey || configApiKey;
  const activeModel = options.model || configModel;

  const formattedQA = questionsWithAnswers.map((item, idx) => ({
    i: idx + 1,
    id: item.questionId || item._id,
    q: item.question,
    cat: item.category || "Behavioral",
    max: 20,
    dimensions: item.behavioralDimensions || [],
    ans: item.candidateAnswer || item.answer || "(No answer provided)",
  }));

  const systemPrompt = `You are a Senior HR & Behavioral Evaluator analyzing a candidate's HR interview answers.
You must evaluate all questions in ONE batch response.

CRITICAL EVALUATION RULES:
1. FAIR ENGLISH EVALUATION: Do NOT heavily penalize imperfect English, Indian English, short sentences, or minor grammar/spelling errors. Focus on REASONING, JUDGMENT, ACCOUNTABILITY, and BEHAVIORAL MATURITY.
2. NO SINGLE CORRECT ANSWER: Evaluate whether response demonstrates sound judgment and realistic trade-offs.
3. NO PSYCHOLOGICAL / MEDICAL DIAGNOSES: Evaluate observable interview behavior ONLY.
4. MARKS: Each question has max 20 marks.
5. BETTER ANSWER: Provide a "betterAnswer" that preserves candidate's core intent.

RETURN STRICT JSON ONLY:
{
  "evaluations": [
    {
      "questionId": "<matching_id>",
      "score": 17,
      "maxScore": 20,
      "behavioralDimensions": {
        "confidence": 4,
        "selfAwareness": 4,
        "ownership": 5,
        "decisionMaking": 4,
        "adaptability": 4,
        "professionalMaturity": 4
      },
      "reasoningStrengths": ["Took clear ownership of the mistake"],
      "concerns": ["Could have detailed escalation timeline"],
      "feedback": "Strong response showing high accountability and maturity.",
      "betterAnswer": "Enhanced version preserving original intent..."
    }
  ],
  "overallRating": "Strong",
  "behavioralProfile": {
    "confidence": 4.5,
    "selfAwareness": 4.2,
    "ownership": 4.8,
    "decisionMaking": 4.0,
    "conflictHandling": 4.1
  },
  "consistencyObservations": [],
  "strengths": ["High accountability", "Clear ownership"],
  "areasForImprovement": ["Elaborate trade-off decisions"],
  "finalFeedback": "Comprehensive candidate summary..."
}`;

  const userPrompt = `Candidate Profile: ${candidateProfile.fullName || "Candidate"}\nQuestions and Candidate Answers:\n${JSON.stringify(formattedQA, null, 2)}\n\nEvaluate all HR answers in valid JSON.`;

  const parsed = await AIGateway.execute({
    prompt: userPrompt,
    systemPrompt,
    provider: options.provider || "groq",
    apiKey: activeApiKey,
    sessionId: options.sessionId,
    roundType: "evaluation",
    orderIndex: 1,
    options: {
      model: activeModel,
      temperature: 0.3,
      maxRetries: 3
    }
  });

  if (!parsed || !Array.isArray(parsed.evaluations)) {
    throw new Error("Failed to parse AI response into valid HR evaluation JSON");
  }

  console.log(`[RealInterviewAI][HR] Complete batch evaluation succeeded`);
  return parsed;
}
