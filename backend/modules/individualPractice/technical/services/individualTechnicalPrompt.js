/**
 * Builds prompt for batch question generation in simple English.
 */
export function buildQuestionGenerationPrompt({
  skillsContextStr,
  batchSpec,
  difficultyMode,
  excludedQuestions = [],
}) {
  const exclusionText =
    Array.isArray(excludedQuestions) && excludedQuestions.length > 0
      ? `\nEXCLUSION RULE:\nDO NOT generate any question that is identical or semantically similar to any of these previously asked questions:\n${excludedQuestions.slice(0, 35).map((q) => `- ${q}`).join("\n")}\n`
      : "";

  return `You are generating placement-level Technical Practice interview questions.
TARGET TECHNICAL SKILLS: ${skillsContextStr}
DIFFICULTY MODE: ${difficultyMode}

BATCH REQUIREMENTS:
Generate EXACTLY ${batchSpec.count} technical question(s) for batch ${batchSpec.range}.
${batchSpec.easy > 0 ? `- ${batchSpec.easy} Easy question(s)` : ""}
${batchSpec.medium > 0 ? `- ${batchSpec.medium} Medium question(s)` : ""}
${batchSpec.hard > 0 ? `- ${batchSpec.hard} Hard question(s)` : ""}
${exclusionText}
CRITICAL RULES FOR PURE TECHNICAL QUESTIONS:
1. PURE TECHNICAL KNOWLEDGE ONLY: Ask ONLY about technical concepts, core principles, technology internals, syntax, language mechanics, database indexes/joins, framework features, debugging scenarios, performance optimizations, and technical trade-offs.
2. ABSOLUTELY NO PROJECT QUESTIONS: Do NOT ask about the candidate's personal projects, project implementation, project architecture, project decisions, project challenges, project features, project APIs, project deployment, or project experience. Never ask "in your project", "how did you implement", or "why did you choose X for your project". The resume list is used ONLY to extract technical skill names.
3. USE SIMPLE, CLEAR ENGLISH: Avoid overly complicated or convoluted sentences.
4. Easy = basic definitions and core purpose.
5. Medium = conceptual understanding, how components interact, why choices are made.
6. Hard = architecture, trade-offs, debugging scenarios, performance, failure handling (STILL USE SIMPLE ENGLISH).
7. Output ONLY valid JSON starting immediately with {"questions": [...]}.

JSON SCHEMA:
{
  "questions": [
    {
      "question": "Clear technical concept question in simple English?",
      "difficulty": "Easy|Medium|Hard",
      "topic": "Core Concept",
      "skill": "Node.js",
      "expectedConcepts": ["Key point 1", "Key point 2"]
    }
  ]
}`;
}

/**
 * Builds prompt for batch session evaluation.
 */
export function buildBatchEvaluationPrompt({ questionsAndAnswers }) {
  const qaFormatted = questionsAndAnswers
    .map((qa, index) => {
      return `QUESTION ${index + 1}:
Id: ${qa.questionId}
Difficulty: ${qa.difficulty} (Raw weight: ${qa.rawWeight})
Topic/Skill: ${qa.topic} / ${qa.skill}
Question Text: ${qa.question}
Expected Key Concepts: ${JSON.stringify(qa.expectedConcepts || [])}
Candidate Answer: ${qa.attempted ? qa.candidateAnswer : "[NOT ATTEMPTED]"}`;
    })
    .join("\n\n----------------------------------------\n\n");

  return `You are an expert technical interviewer evaluating a student's Technical Practice Session.

EVALUATION DATA:
${qaFormatted}

CRITICAL RULES FOR EVALUATION:
1. Evaluate ONLY attempted questions where Candidate Answer is provided.
2. For attempted questions, grade raw score out of raw weight (Easy max 3, Medium max 5, Hard max 13).
3. If answer is accurate and complete, award full raw weight. If partially correct, award proportional marks.
4. Provide constructive feedback, strengths, missing points, and a clean improved answer for attempted questions.
5. DO NOT evaluate unattempted questions (mark attempted: false, score: 0).
6. Return evidence-based summary insights based on actual student answers.
7. Output ONLY valid JSON starting immediately with {"evaluations": [...], "summary": {...}}.

JSON SCHEMA:
{
  "evaluations": [
    {
      "questionId": "string",
      "attempted": true|false,
      "score": number,
      "maxScore": number,
      "feedback": "string",
      "strengths": ["string"],
      "missingPoints": ["string"],
      "improvedAnswer": "string"
    }
  ],
  "summary": {
    "performanceInsight": "Detailed evidence-based insight",
    "whatWentWell": ["Strength 1", "Strength 2"],
    "weakAreas": ["Weakness 1"],
    "whatToImprove": ["Actionable improvement 1"],
    "recommendedNextStep": "Practical next step"
  }
}`;
}
