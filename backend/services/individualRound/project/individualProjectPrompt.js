/**
 * Prompt builder for Individual Project / Resume Question Generation (10 Questions).
 */

export function buildProjectQuestionPrompt({
  candidateProjects = [],
  interviewKeyContext = null,
  difficulty = "Mixed",
  excludedQuestions = [],
}) {
  let contextStr = "";

  if (interviewKeyContext) {
    contextStr = `INTERVIEW KEY / TARGET SCOPE:
- Target Skills/Topics: ${interviewKeyContext.skills.join(", ") || "Full Stack Application Architecture"}
- Key Focus Questions: ${interviewKeyContext.sampleQuestions.join(" | ") || "System Design & API Implementation"}`;
  } else if (candidateProjects.length > 0) {
    contextStr = candidateProjects
      .map(
        (p, idx) =>
          `Project #${idx + 1}: ${p.name || p.title || "Application"}
- Technologies: ${Array.isArray(p.technologies) ? p.technologies.join(", ") : p.techStack || "Web/Backend Tech Stack"}
- Description: ${p.description || p.summary || "Full stack application implementation."}`
      )
      .join("\n\n");
  } else {
    contextStr = "Candidate has general software engineering experience building full stack web & backend applications with REST APIs, databases, authentication, and cloud deployment.";
  }

  const mode = String(difficulty).trim().toLowerCase();

  let difficultyGuide = "";
  if (mode === "easy") {
    difficultyGuide = `DIFFICULTY BREAKDOWN (EXACTLY 10 QUESTIONS):
- All 10 questions: "difficulty": "Easy" (10 marks each). Focus on fundamental project workflow, component purpose, feature overview, and basic tech stack choices.`;
  } else if (mode === "medium") {
    difficultyGuide = `DIFFICULTY BREAKDOWN (EXACTLY 10 QUESTIONS):
- All 10 questions: "difficulty": "Medium" (10 marks each). Focus on API design, DB schemas, authentication flows, error handling, state management, and implementation choices.`;
  } else if (mode === "hard") {
    difficultyGuide = `DIFFICULTY BREAKDOWN (EXACTLY 10 QUESTIONS):
- All 10 questions: "difficulty": "Hard" (10 marks each). Focus on system architecture, trade-offs, scalability, server/DB failure scenarios, performance bottlenecks, and security.`;
  } else {
    difficultyGuide = `DIFFICULTY BREAKDOWN (EXACTLY 10 QUESTIONS):
- Questions 1 to 4: "difficulty": "Easy" (5 marks each) - Basic purpose, tech choices, workflow
- Questions 5 to 8: "difficulty": "Medium" (10 marks each) - API design, DB schema, auth flow, edge cases
- Questions 9 to 10: "difficulty": "Hard" (20 marks each) - System architecture, failure scenarios, trade-offs, scaling`;
  }

  let exclusionsStr = "";
  if (excludedQuestions.length > 0) {
    exclusionsStr = `\nDO NOT repeat or generate questions semantically similar to any of these previously asked questions:\n${excludedQuestions
      .slice(0, 30)
      .map((q) => `- ${q}`)
      .join("\n")}\n`;
  }

  return `Generate a JSON object with key "questions" containing EXACTLY 10 deep project & resume interview questions based on candidate's project portfolio:

CANDIDATE PROJECTS / RESUME CONTEXT:
${contextStr}

${difficultyGuide}
${exclusionsStr}
CRITICAL CONSTRAINTS:
1. "questions" MUST be an array of EXACTLY 10 objects.
2. Ask about actual technologies, architecture, data flow, trade-offs, DB schemas, API endpoints, auth, and challenges relevant to the candidate's projects.
3. Every question MUST be grounded in project/resume context. DO NOT ask generic textbook definition questions.
4. Output JSON ONLY starting with {"questions": [...]}.

JSON SCHEMA OUTPUT:
{
  "questions": [
    {
      "question": "Clear, deep project interview question grounded in candidate project/tech stack",
      "expectedKnowledge": "Key technical and architectural concepts expected in answer",
      "difficulty": "Easy",
      "topic": "Architecture & API Flow",
      "projectName": "Project Name or System"
    }
  ]
}`;
}

export function buildProjectReplacementQuestionPrompt({
  candidateProjects = [],
  interviewKeyContext = null,
  targetDifficulty = "Medium",
  excludedQuestions = [],
}) {
  let contextStr = interviewKeyContext
    ? `Key Scope: ${interviewKeyContext.skills.join(", ")}`
    : candidateProjects.length > 0
    ? `Project: ${candidateProjects[0]?.name || "Application"} (${Array.isArray(candidateProjects[0]?.technologies) ? candidateProjects[0].technologies.join(", ") : "Web Stack"})`
    : "Full Stack Application Architecture";

  return `Generate EXACTLY 1 unique project/resume interview question grounded in this candidate context: ${contextStr}.

TARGET DIFFICULTY: ${targetDifficulty}

CRITICAL RULES:
1. Ground the question in real project architecture, API flow, database choices, authentication, failure handling, or technical trade-offs.
2. DO NOT ask generic textbook questions.
3. Exclude these previously asked questions:
${excludedQuestions.slice(0, 30).map((q) => `- ${q}`).join("\n")}

JSON OUTPUT ONLY:
{
  "questions": [
    {
      "question": "Deep project question",
      "expectedKnowledge": "Expected points",
      "difficulty": "${targetDifficulty}",
      "topic": "Project Implementation",
      "projectName": "Project"
    }
  ]
}`;
}
