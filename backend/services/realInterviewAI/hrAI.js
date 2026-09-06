import fetch from "node-fetch";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-120b";

/**
 * Returns HR AI config strictly from process.env.REAL_INTERVIEW_HR_API_KEY.
 * DO NOT fallback to GROQ_API_KEY, TECHNICAL key, or PROJECT key.
 */
function getHRConfig() {
  const apiKey = process.env.REAL_INTERVIEW_HR_API_KEY;
  if (!apiKey) {
    throw new Error(
      "REAL_INTERVIEW_HR_API_KEY is missing in process.env. Please add it to your root .env file."
    );
  }
  const model = process.env.REAL_INTERVIEW_HR_MODEL || DEFAULT_MODEL;
  const baseUrl = process.env.REAL_INTERVIEW_HR_BASE_URL || GROQ_BASE_URL;
  return { apiKey, model, baseUrl };
}

/**
 * Clean AI Markdown output to get pure JSON text
 */
function cleanJsonResponse(rawText) {
  if (!rawText) return "";
  let text = rawText.trim();
  if (text.startsWith("```json")) {
    text = text.replace(/^```json\s*/, "").replace(/```$/, "").trim();
  } else if (text.startsWith("```")) {
    text = text.replace(/^```\s*/, "").replace(/```$/, "").trim();
  }
  return text;
}

/**
 * AI CALL #1: Generate EXACTLY 5 HR questions in ONE AI request (Attempt 1).
 */
export async function generateHRAI({ candidateProfile = {}, count = 5 }) {
  console.log("\n[REAL-INTERVIEW][AI-CALL]\nround=hr\noperation=generation\nattempt=1");
  const { apiKey, model, baseUrl } = getHRConfig();

  const profileSummary = `
- Full Name: ${candidateProfile.fullName || candidateProfile.name || "Candidate"}
- Education: ${candidateProfile.education || "Undergraduate Degree"}
- Experience / Internships: ${JSON.stringify(candidateProfile.experience || candidateProfile.internships || [])}
- Extracurricular / Leadership: ${JSON.stringify(candidateProfile.leadership || candidateProfile.extracurricular || [])}
- Certifications / Achievements: ${JSON.stringify(candidateProfile.achievements || candidateProfile.certifications || [])}
- Key Projects Summary: ${JSON.stringify(candidateProfile.projects || [])}
`;

  const systemPrompt = `You are a Senior HR & Behavioral Interview Evaluator conducting a high-stakes professional interview.
Your task is to generate EXACTLY 5 deep, scenario-based behavioral interview questions tailored to the candidate's background.

CRITICAL RULES:
1. TOTAL QUESTIONS: EXACTLY 5. NO MORE, NO LESS.
2. DO NOT use generic textbook HR questions (e.g. "Tell me about yourself", "What are your strengths?", "What are your weaknesses?", "Why should we hire you?", "Where do you see yourself in 5 years?").
3. Questions must cover realistic workplace scenarios, ambiguity, conflict handling, accountability, pressure, decision-making, trade-offs, and self-reflection.
4. The questions should naturally deepen in complexity from Question 1 to Question 5:
   - Question 1: Self-awareness & confidence scenario
   - Question 2: Accountability & ownership scenario
   - Question 3: Team conflict & criticism scenario
   - Question 4: Adaptability & pressure scenario
   - Question 5: Complex decision-making, ethical trade-off & professional maturity scenario
5. RESUME AWARENESS: Personalize questions using real details from the candidate profile (e.g. leadership roles, internships). NEVER invent fake companies, projects, or experiences. If candidate profile lacks specific details, use realistic workplace scenarios.
6. NO PROJECT DUPLICATION: Do not ask technical architecture questions. Focus strictly on behavioral maturity, decisions, and communication.
7. MARKS: Every question carries EXACTLY 20 max marks (5 x 20 = 100 total marks).
8. NO FIXED CORRECT ANSWER: HR questions do NOT have a single correct answer.

RETURN STRICT JSON ONLY formatted as:
{
  "questions": [
    {
      "questionIndex": 1,
      "question": "Realistic scenario-based question text...",
      "category": "Self-Awareness & Confidence",
      "maxMarks": 20,
      "behavioralDimensions": ["confidence", "selfAwareness", "communicationClarity"],
      "resumeReference": "Personalized reference or workplace context"
    },
    ... (total 5 items)
  ]
}`;

  const userPrompt = `Candidate Profile:\n${profileSummary}\n\nGenerate EXACTLY 5 deep HR questions in valid JSON.`;

  console.log("\n[REAL-INTERVIEW][HR-CONTEXT]");
  console.log(`resume context actually sent to AI: ${profileSummary.trim()}\n`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  let response;
  try {
    response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
        max_completion_tokens: 2560,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err?.name === "AbortError") {
      throw new Error("HR AI request timed out");
    }
    console.error("[RealInterviewAI][HR] Fetch error:", err.message);
    throw new Error(`Failed to connect to HR AI provider: ${err.message}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[RealInterviewAI][HR] Generation HTTP Error: ${response.status}`, errorText);
    throw new Error(`HR generation AI request failed with status ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;
  const cleaned = cleanJsonResponse(rawContent);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("[RealInterviewAI][HR] JSON Parse error during generation:", err.message);
    throw new Error("Failed to parse AI response into valid HR questions JSON");
  }

  const questions = parsed.questions || parsed.data || parsed;
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("AI returned invalid or empty questions array");
  }

  // Enforce exactly 5 questions with 20 maxMarks
  const formattedQuestions = questions.slice(0, 5).map((q, idx) => ({
    questionIndex: idx + 1,
    question: q.question || `Behavioral Scenario Question #${idx + 1}`,
    category: q.category || "Behavioral & Situational",
    difficulty: idx < 2 ? "easy" : idx < 4 ? "medium" : "hard",
    maxMarks: 20,
    behavioralDimensions: Array.isArray(q.behavioralDimensions) ? q.behavioralDimensions : ["decisionMaking", "ownership"],
    resumeReference: q.resumeReference || "",
  }));

  console.log(`[RealInterviewAI][HR] Generated ${formattedQuestions.length} questions successfully`);
  return formattedQuestions;
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);

  let response;
  try {
    response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_completion_tokens: 2560,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err?.name === "AbortError") {
      throw new Error("HR evaluation AI request timed out");
    }
    console.error("[RealInterviewAI][HR] Evaluation fetch error:", err.message);
    throw new Error(`Failed to connect to HR Evaluation AI provider: ${err.message}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[RealInterviewAI][HR] Evaluation HTTP Error: ${response.status}`, errorText);
    throw new Error(`HR evaluation AI request failed with status ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;
  const cleaned = cleanJsonResponse(rawContent);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("[RealInterviewAI][HR] JSON Parse error during evaluation:", err.message);
    throw new Error("Failed to parse AI response into valid HR evaluation JSON");
  }

  console.log(`[RealInterviewAI][HR] Complete batch evaluation succeeded`);
  return parsed;
}

