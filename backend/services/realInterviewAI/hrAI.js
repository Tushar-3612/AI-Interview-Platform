import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../.env") });

import { callPythonGroqBridge } from "./pythonGroqBridge.js";
import { extractJsonFromText } from "./jsonExtractor.js";

/**
 * Returns HR AI config strictly from process.env.REAL_INTERVIEW_HR_API_KEY.
 * DO NOT fallback to GROQ_API_KEY, TECHNICAL key, or PROJECT key.
 */
function getHRConfig(attempt = 1) {
  const apiKey = (process.env.REAL_INTERVIEW_HR_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error(
      "REAL_INTERVIEW_HR_API_KEY is missing in process.env. Please add it to your root .env file."
    );
  }
  const custom = (process.env.REAL_INTERVIEW_HR_MODEL || "").trim();
  const model = custom || (attempt === 2 ? "openai/gpt-oss-20b" : "openai/gpt-oss-120b");
  return { apiKey, model };
}

/**
 * Classify Groq API errors to determine retry behavior.
 * Returns { retryable: boolean, reason: string }
 */
function classifyGroqError(err) {
  const status = err?.status || err?.statusCode || 0;
  const msg = String(err?.message || err || "").toLowerCase();

  if (status === 404 || msg.includes("404") || msg.includes("model_not_found") || msg.includes("does not exist")) {
    return { retryable: false, reason: "Model not found (404)" };
  }
  if (status === 401 || status === 403 || msg.includes("401") || msg.includes("403")) {
    return { retryable: false, reason: "Authentication/authorization error" };
  }
  if (status === 429 || msg.includes("429") || msg.includes("rate_limit") || msg.includes("tokens per day")) {
    return { retryable: false, reason: "Rate limit / daily quota exhausted (429)" };
  }
  return { retryable: true, reason: "Transient error" };
}

/**
 * Clean AI Markdown output to get pure JSON text
 */
function cleanJsonResponse(rawText) {
  if (!rawText || typeof rawText !== "string") return "";
  let text = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  text = text.replace(/```json\s*|```\s*/g, "").trim();

  const qIdx = text.search(/\{\s*"questions"/);
  if (qIdx !== -1) {
    let depth = 0;
    for (let i = qIdx; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") depth--;
      if (depth === 0) {
        return text.slice(qIdx, i + 1);
      }
    }
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return text;
}

/**
 * AI CALL #1: Generate EXACTLY 5 HR questions in ONE AI request (Attempt 1).
 */
export async function generateHRAI({ candidateProfile = {}, count = 5 }) {
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

  const systemPrompt = `You are a Senior HR Vice President conducting a final HR cultural & behavioral interview for a top tier tech company.
Your task is to generate EXACTLY 5 high-impact, professional HR interview questions tailored to the candidate's profile.

CRITICAL ARCHITECTURAL RULES:
1. TOTAL QUESTIONS: EXACTLY 5. NO MORE, NO LESS.
2. QUESTION CATEGORIES:
   - Question 1: Behavioral / Behavioral Scenario (STAR format)
   - Question 2: Cultural Fit & Value Alignment
   - Question 3: Problem Solving & Conflict Resolution
   - Question 4: Career Goals & Growth Mindset
   - Question 5: Situational Judgment / Leadership Under Pressure
3. RESUME GROUNDING: Mention aspects of the candidate's background (education, project experience, leadership) naturally in at least 2 questions.
4. ABSOLUTE MARKS: Easy=10 marks, Medium=20 marks, Hard=20 marks. Total score possible = 100 or sum of marks (e.g. 5 questions * 20 marks = 100 marks). Set maxMarks = 20 for each question (Total = 100).
5. STRICT JSON ONLY: Respond with a SINGLE JSON object. No markdown wrappers.

JSON SCHEMA REQUIREMENT:
{
  "questions": [
    {
      "id": "hr_q1",
      "question": "Clear, professional HR question text",
      "category": "Behavioral",
      "difficulty": "medium",
      "maxMarks": 20,
      "evaluationCriteria": ["STAR approach", "Clear metrics", "Ownership"],
      "sampleGoodAnswer": "Key points of a top-scoring response"
    }
  ]
}`;

  const userPrompt = `Candidate Profile:\n${profileSummary}\n\nGenerate EXACTLY 5 deep HR questions in valid JSON.`;

  console.log("\n[REAL-INTERVIEW][HR-CONTEXT]");
  console.log(`resume context actually sent to AI: ${profileSummary.trim()}\n`);

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { apiKey, model } = getHRConfig(attempt);
    try {
      const rawContent = await callPythonGroqBridge({
        round: "hr",
        apiKey,
        model,
        messages: [
          { role: "system", content: "You are a JSON API endpoint. Output ONLY valid JSON starting immediately with {\"questions\": [...]} without any reasoning, thinking, or commentary." },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 2000,
        timeoutMs: 60000,
      });

      const parsed = extractJsonFromText(rawContent);

      const questions = parsed.questions || parsed.data || (Array.isArray(parsed) ? parsed : null);
      if (Array.isArray(questions) && questions.length >= 5) {
        // Enforce exactly 5 questions with 20 maxMarks
        const formattedQuestions = questions.slice(0, 5).map((q, idx) => ({
          questionIndex: idx + 1,
          question: q.question || q.questionText || q.text || q.prompt || (typeof q === "string" ? q : `Behavioral Scenario Question #${idx + 1}`),
          category: q.category || "Behavioral & Situational",
          difficulty: idx < 2 ? "easy" : idx < 4 ? "medium" : "hard",
          maxMarks: 20,
          behavioralDimensions: Array.isArray(q.behavioralDimensions) ? q.behavioralDimensions : ["decisionMaking", "ownership"],
          resumeReference: q.resumeReference || "",
        }));

        console.log(`[RealInterviewAI][HR] Generated 5 HR questions successfully`);
        return formattedQuestions;
      }
    } catch (err) {
      lastError = err;
      const { retryable, reason } = classifyGroqError(err);
      console.warn(`[RealInterviewAI][HR] Attempt ${attempt} failed: ${err.message} (${reason})`);
      if (!retryable) {
        console.warn(`[RealInterviewAI][HR] Non-retryable error, failing immediately: ${reason}`);
        break;
      }
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 8000));
      }
    }
  }

  throw lastError || new Error("HR AI generation failed after 3 attempts");
}

/**
 * AI CALL #2: Batch evaluate all 5 candidate answers in ONE AI request (Attempt 1).
 */
export async function evaluateHRAI({ candidateProfile = {}, questionsWithAnswers = [] }) {
  console.log("\n[REAL-INTERVIEW][AI-CALL]\nround=hr\noperation=evaluation\nattempt=1");
  const { apiKey, model, baseUrl } = getHRConfig();

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
You must evaluate all 5 questions in ONE batch response.

CRITICAL EVALUATION RULES:
1. FAIR ENGLISH EVALUATION: Do NOT heavily penalize imperfect English, Indian English, short sentences, or minor grammar/spelling errors. Focus on the candidate's REASONING, JUDGMENT, ACCOUNTABILITY, and BEHAVIORAL MATURITY. Simple English with strong reasoning gets high marks.
2. NO SINGLE CORRECT ANSWER: HR questions have no single "correct" answer. Evaluate whether their response demonstrates sound judgment, realistic trade-offs, and professional maturity.
3. NO PSYCHOLOGICAL / MEDICAL DIAGNOSES: Evaluate observable interview behavior ONLY. NEVER output psychological or medical diagnostic terms (e.g., "narcissistic", "mentally unstable", "personality disorder").
4. MARKS: Each question has max 20 marks. Score must be between 0 and 20.
   - 0-5: No meaningful answer / avoids situation.
   - 6-10: Limited reasoning / lacks accountability or depth.
   - 11-15: Solid professional response with good judgment.
   - 16-20: Outstanding reasoning, maturity, ownership, and consideration of consequences.
5. BETTER ANSWER: Provide a "betterAnswer" that preserves the candidate's core intent while improving their structure, clarity, and decision-making reasoning. DO NOT replace with a generic textbook answer.

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

  const userPrompt = `Candidate Profile: ${candidateProfile.fullName || "Candidate"}\nQuestions and Candidate Answers:\n${JSON.stringify(formattedQA, null, 2)}\n\nEvaluate all 5 answers in valid JSON.`;

  const rawContent = await callPythonGroqBridge({
    round: "hr",
    apiKey,
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 2560,
    timeoutMs: 90000,
  });

  const parsed = extractJsonFromText(rawContent);

  if (!parsed || !Array.isArray(parsed.evaluations)) {
    throw new Error("Failed to parse AI response into valid HR evaluation JSON");
  }

  console.log(`[RealInterviewAI][HR] Complete batch evaluation succeeded`);
  return parsed;
}

