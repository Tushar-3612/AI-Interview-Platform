/**
 * Centralized, reusable AI prompt builders.
 * All prompts live here — no huge prompt strings inside controllers.
 *
 * Every generator prompt explicitly instructs the AI to use ONLY data
 * present in the candidate profile and never invent resume details.
 */

function profileSummary(profile = {}) {
  const skills = [
    ...(profile.skills || []),
    ...(profile.programmingLanguages || []),
    ...(profile.frameworks || []),
    ...(profile.databases || []),
    ...(profile.tools || []),
  ]
    .map((s) => String(s).trim())
    .filter(Boolean);

  const projects = (profile.projects || []).map((p) => ({
    name: p.name || "Unnamed Project",
    description: p.description || "",
    technologies: p.technologies || p.techStack || [],
  }));

  const experience = (profile.experience || []).map((e) => ({
    role: e.role || e.title || "Role",
    organization: e.organization || e.company || "",
    description: e.description || "",
  }));

  const education = (profile.education || []).map((e) => ({
    degree: e.degree || "",
    institution: e.institution || "",
    year: e.year || "",
  }));

  return {
    candidateName: profile.candidateName || profile.name || "Candidate",
    skills,
    projects,
    experience,
    education,
    certifications: profile.certifications || [],
  };
}

function jsonWrap(instructions, schemaHint) {
  return `${instructions}

CRITICAL RULES:
- Use ONLY information present in the candidate profile below. Do NOT invent skills, technologies, projects, companies, experience, education, or certifications.
- Return ONLY valid minified JSON (no markdown fences, no commentary).
- Follow exactly this JSON structure:
${schemaHint}`;
}

export function buildResumeQuestionPrompt(profile = {}, count = 10) {
  const p = profileSummary(profile);
  const instructions = `You are an expert technical interviewer conducting a RESUME / PROJECT interview.

Generate exactly ${count} personalized interview questions based STRICTLY on the candidate's actual resume/profile.

Focus areas:
- Project understanding and architecture
- The candidate's specific contribution to each project
- Technology choices and trade-offs
- Challenges faced and how they were solved
- Implementation details
- Testing and quality
- Design decisions and possible improvements
- Real-world scenarios related to their actual work

Candidate Profile:
Name: ${p.candidateName}
Skills: ${p.skills.join(", ") || "N/A"}
Projects:
${
  p.projects.length
    ? p.projects
        .map((pr) => `- ${pr.name}: ${pr.description} (Tech: ${pr.technologies.join(", ")})`)
        .join("\n")
    : "N/A"
}
Experience:
${
  p.experience.length
    ? p.experience.map((e) => `- ${e.role} at ${e.organization}: ${e.description}`).join("\n")
    : "N/A"
}
Education:
${
  p.education.length
    ? p.education.map((e) => `- ${e.degree} at ${e.institution} (${e.year})`).join("\n")
    : "N/A"
}
Certifications: ${p.certifications.join(", ") || "N/A"}`;

  const schema = `{
  "questions": [
    {
      "question": "string",
      "section": "resume_project",
      "difficulty": "easy | medium | hard",
      "topic": "project",
      "source": "resume"
    }
  ]
}`;

  return jsonWrap(instructions, schema);
}

export function buildTechnicalQuestionPrompt(profile = {}, count = 20) {
  const p = profileSummary(profile);
  const instructions = `You are an expert technical interviewer.

Generate exactly ${count} technical interview questions based STRICTLY on the candidate's actual resume/profile (skills, technologies, projects, and experience).

Question mix:
- Fundamentals and core concepts
- Implementation knowledge
- System / project architecture
- Debugging and troubleshooting
- Practical usage
- Trade-offs and design decisions
- Problem solving

Prioritize technologies and skills explicitly present in the resume. Cover different skills instead of repeating one. Do NOT generate generic or unrelated questions unless required to complete the round. Do not ask HR or aptitude questions.

Candidate Profile:
Name: ${p.candidateName}
Skills: ${p.skills.join(", ") || "N/A"}
Projects:
${
  p.projects.length
    ? p.projects.map((pr) => `- ${pr.name}: ${pr.description} (Tech: ${pr.technologies.join(", ")})`).join("\n")
    : "N/A"
}
Experience:
${
  p.experience.length
    ? p.experience.map((e) => `- ${e.role} at ${e.organization}: ${e.description}`).join("\n")
    : "N/A"
}`;

  const schema = `{
  "questions": [
    {
      "question": "string",
      "section": "technical",
      "difficulty": "easy | medium | hard",
      "topic": "string",
      "source": "resume"
    }
  ]
}`;

  return jsonWrap(instructions, schema);
}

export function buildHRQuestionPrompt(profile = {}, count = 5) {
  const p = profileSummary(profile);
  const instructions = `You are an HR / behavioral interview question generator.

Generate exactly ${count} personalized behavioral/HR interview questions based on the candidate's actual profile (education, projects, experience, achievements, certifications, career context).

Preferred topics (personalize using real profile data when available):
- Tell me about yourself
- Motivation for this role
- Strengths and weaknesses
- Teamwork and collaboration
- Leadership
- Challenges and conflict resolution
- Career goals

Do NOT hardcode generic questions when candidate information is available — tailor them to this candidate.

Candidate Profile:
Name: ${p.candidateName}
Education: ${p.education.map((e) => `${e.degree} at ${e.institution}`).join(", ") || "N/A"}
Projects: ${p.projects.map((pr) => pr.name).join(", ") || "N/A"}
Experience: ${p.experience.map((e) => `${e.role} at ${e.organization}`).join(", ") || "N/A"}
Certifications: ${p.certifications ? "" : ""}${p.certifications.join(", ") || "N/A"}`;

  const schema = `{
  "questions": [
    {
      "question": "string",
      "section": "hr",
      "difficulty": "easy | medium | hard",
      "topic": "string",
      "source": "resume"
    }
  ]
}`;

  return jsonWrap(instructions, schema);
}

export function buildCodingQuestionPrompt(profile = {}, count = 3) {
  const p = profileSummary(profile);
  const languageHint =
    p.skills.find((s) => /python|java|c\+\+|javascript|typescript|c#/i.test(s)) || "Python";
  const instructions = `You are an expert coding interview problem designer.

Generate exactly ${count} coding problems appropriate for this candidate's level, inferred from their profile:
Skills: ${p.skills.join(", ") || "N/A"}
Projects: ${p.projects.map((pr) => pr.name).join(", ") || "N/A"}

Each problem must be clearly solvable in a standard programming interview and include concrete test cases.

For each problem provide:
- title
- description (clear problem statement)
- difficulty (easy | medium | hard) — progress in difficulty across the ${count} problems
- inputFormat
- outputFormat
- constraints
- examples (array of { input, output/expected })
- testCases (array of { input, expected, isHidden })
- expectedApproach (brief)
- topic`;

  const schema = `{
  "questions": [
    {
      "title": "string",
      "description": "string",
      "difficulty": "easy | medium | hard",
      "inputFormat": "string",
      "outputFormat": "string",
      "constraints": "string",
      "examples": [ { "input": "string", "expected": "string" } ],
      "testCases": [ { "input": "string", "expected": "string", "isHidden": false } ],
      "expectedApproach": "string",
      "topic": "string"
    }
  ]
}`;

  return jsonWrap(instructions, schema);
}

/* ================================
   COMBINED INTERVIEW GENERATION (AI CALL #1)
   ONE request → 25 Technical + 5 HR + 3 Coding
   ================================ */

export function buildCombinedInterviewPrompt(profile = {}, counts = { technical: 25, hr: 5, coding: 3 }) {
  const p = profileSummary(profile);
  const tCount = counts.technical || 25;
  const hCount = counts.hr || 5;
  const cCount = counts.coding || 3;

  const candidateBlock = `Candidate Profile:
Name: ${p.candidateName}
Skills: ${p.skills.join(", ") || "N/A"}
Projects:
${
  p.projects.length
    ? p.projects.map((pr) => `- ${pr.name}: ${pr.description} (Tech: ${pr.technologies.join(", ")})`).join("\n")
    : "N/A"
}
Experience:
${
  p.experience.length
    ? p.experience.map((e) => `- ${e.role} at ${e.organization}: ${e.description}`).join("\n")
    : "N/A"
}
Education:
${
  p.education.length
    ? p.education.map((e) => `- ${e.degree} at ${e.institution} (${e.year})`).join("\n")
    : "N/A"
}
Certifications: ${p.certifications.join(", ") || "N/A"}`;

  return `You are an expert interview question designer creating a full AI interview for ONE candidate.

Generate questions STRICTLY from the candidate profile below. Use ONLY information present in the profile. Do NOT invent projects, technologies, companies, certifications, experience, responsibilities, or education.

${candidateBlock}

You must return exactly ${tCount} TECHNICAL questions, ${hCount} HR questions, and ${cCount} CODING problems — all in ONE JSON object.

TECHNICAL (${tCount}): Personalized using the candidate's actual resume (projects, technologies, implementation, architecture, APIs, databases, authentication, security, debugging, performance, testing, deployment, trade-offs, practical scenarios). Must feel like an interviewer read the resume. Cover different skills; do not repeat one skill.

HR (${hCount}): Behavioral questions, personalized where appropriate (introduction, motivation, teamwork, strengths, weaknesses, challenges, leadership, career goals, conflict resolution, learning).

CODING (${cCount}): Problems suitable to the candidate's level. For each provide title, description, difficulty (easy|medium|hard — progress in difficulty across the ${cCount} problems), language, inputFormat, outputFormat, constraints, examples (array of {input, output}), testCases (array of {input, expected, isHidden}), expectedApproach, topic.

Return ONLY valid minified JSON (no markdown fences, no commentary) in exactly this structure:

{
  "technical": [
    { "question": "string", "topic": "string", "difficulty": "easy | medium | hard" }
  ],
  "hr": [
    { "question": "string", "topic": "string", "difficulty": "easy | medium | hard" }
  ],
  "coding": [
    {
      "title": "string",
      "description": "string",
      "difficulty": "easy | medium | hard",
      "language": "string",
      "inputFormat": "string",
      "outputFormat": "string",
      "constraints": "string",
      "examples": [ { "input": "string", "output": "string" } ],
      "testCases": [ { "input": "string", "expected": "string", "isHidden": false } ],
      "expectedApproach": "string",
      "topic": "string"
    }
  ]
}

CRITICAL: technical.length must be exactly ${tCount}, hr.length exactly ${hCount}, coding.length exactly ${cCount}. No extra text.`;
}

/* ================================
   FINAL EVALUATION (AI CALL #2)
   ONE request → scores + strengths + weaknesses
   ================================ */

export function buildFinalEvaluationPrompt(ctx = {}) {
  const {
    candidateProfile = {},
    technical = [], // [{question, answer, skipped}]
    hr = [],
    coding = [],     // [{question, title, passed, total, language, attempted}]
    aptitude = { attempted: 0, correct: 0, total: 0, percentage: 0 },
    skipped = { technical: 0, hr: 0, coding: 0 },
  } = ctx;

  const p = profileSummary(candidateProfile);

  const techBlock = (technical.length ? technical : [{ question: "N/A", answer: "N/A", skipped: true }])
    .map((t, i) => `T${i + 1}. Q: ${t.question}\n   A: ${t.skipped ? "[SKIPPED]" : (t.answer || "[NO ANSWER]")}`)
    .join("\n");

  const hrBlock = (hr.length ? hr : [{ question: "N/A", answer: "N/A", skipped: true }])
    .map((h, i) => `H${i + 1}. Q: ${h.question}\n   A: ${h.skipped ? "[SKIPPED]" : (h.answer || "[NO ANSWER]")}`)
    .join("\n");

  const codeBlock = (coding.length ? coding : [{ title: "N/A", passed: 0, total: 0, attempted: false }])
    .map((c, i) => `C${i + 1}. ${c.title || c.question || "Coding"}\n   Attempted: ${c.attempted ? "Yes" : "No"}\n   Test cases passed: ${c.passed ?? 0}/${c.total ?? 0}\n   Language: ${c.language || "N/A"}`)
    .join("\n");

  return `You are a senior hiring evaluator producing a final interview evaluation.

Candidate: ${p.candidateName}
Skills: ${p.skills.join(", ") || "N/A"}

APTITUDE (evaluated locally, do NOT recalculate): ${aptitude.correct}/${aptitude.total} correct = ${aptitude.percentage}%.

TECHNICAL QUESTIONS & ANSWERS:
${techBlock}

HR QUESTIONS & ANSWERS:
${hrBlock}

CODING RESULTS (from compiler):
${codeBlock}

Evaluate the candidate's demonstrated performance (NOT the resume). Score each section 0-100 based on answer quality, correctness, depth, and the provided coding compiler results. Skipped/unanswered questions should lower the section score.

Return ONLY valid minified JSON (no markdown fences) in exactly this structure:

{
  "technical": { "score": 0, "strengths": [], "weaknesses": [] },
  "hr": { "score": 0, "strengths": [], "weaknesses": [] },
  "coding": { "score": 0, "strengths": [], "weaknesses": [] },
  "overall": { "strengths": [], "weaknesses": [], "recommendations": [] }
}

CRITICAL: every score must be an integer between 0 and 100. technical.score, hr.score, coding.score are REQUIRED.`;
}

export function buildFollowUpPrompt(ctx = {}) {
  const {
    candidateProfile = {},
    section = "",
    currentQuestion = "",
    answer = "",
    previousQuestions = [],
    topicsCovered = [],
    interviewContext = "",
  } = ctx;

  const p = profileSummary(candidateProfile);
  const instructions = `You are a real-time AI interviewer. The candidate just answered a question in the ${section} section.

Decide whether a single, useful FOLLOW-UP question is appropriate based on their answer. A good follow-up probes deeper, asks for clarification, a trade-off, an alternative approach, or a concrete example — but ONLY using information present in the candidate profile / prior context. Do NOT repeat earlier questions. Do NOT ask about things not in the profile.

Candidate: ${p.candidateName}
Skills: ${p.skills.join(", ") || "N/A"}

Original question:
${currentQuestion}

Candidate's answer:
${answer}

Questions already asked:
${(previousQuestions || []).map((q, i) => `${i + 1}. ${q}`).join("\n") || "None"}

Topics already covered: ${(topicsCovered || []).join(", ") || "None"}

Interview context: ${interviewContext || "Standard interview"}`;

  const schema = `{
  "shouldFollowUp": true | false,
  "question": "string (only if shouldFollowUp is true)",
  "reason": "string",
  "topic": "string"
}`;

  return jsonWrap(instructions, schema);
}

/* ======================================================================
   NEW ARCHITECTURE — 4 INDEPENDENT AI ROUNDS (8 AI CALLS)
   Each round = 1 generation call + 1 evaluation call.
   Aptitude uses NO AI (local bank).
   ====================================================================== */

const TECH_EVAL_SCHEMA = `{
  "score": 0,
  "percentage": 0,
  "correctCount": 0,
  "incorrectCount": 0,
  "skippedCount": 0,
  "strengths": ["string"],
  "weaknesses": ["string"],
  "topicPerformance": { "string_topic": 0 },
  "recommendations": ["string"],
  "questionEvaluations": [
    { "questionId": "string", "isCorrect": true, "feedback": "string" }
  ]
}`;

const CODING_EVAL_SCHEMA = `{
  "score": 0,
  "percentage": 0,
  "problemEvaluations": [
    { "questionId": "string", "title": "string", "passedTests": 0, "totalTests": 0, "score": 0, "feedback": "string" }
  ],
  "strengths": ["string"],
  "weaknesses": ["string"],
  "recommendations": ["string"]
}`;

const VERBAL_EVAL_SCHEMA = `{
  "score": 0,
  "percentage": 0,
  "strengths": ["string"],
  "weaknesses": ["string"],
  "recommendations": ["string"],
  "questionEvaluations": [
    { "questionId": "string", "score": 0, "feedback": "string" }
  ]
}`;

/* ---------- 1. RESUME / PROJECT — GENERATION ---------- */
export function buildResumeProjectGenerationPrompt(candidateProfile = {}, count = 10) {
  const p = profileSummary(candidateProfile);
  const instructions = `You are an AI interviewer preparing resume/project-based conversational questions for a REAL interview.

Use ONLY the candidate's actual profile below. Ask about THEIR OWN projects, technologies, and experiences. Do NOT invent projects, companies, achievements, or skills. If the profile has little project detail, ask the candidate to describe their own work in depth.

Candidate: ${p.candidateName}
Skills: ${p.skills.join(", ") || "N/A"}
Programming: ${p.programmingLanguages.join(", ") || "N/A"}
Frameworks: ${p.frameworks.join(", ") || "N/A"}
Projects:
${(p.projects.length ? p.projects.map((x, i) => `${i + 1}. ${x.name} — ${x.description} (${x.technologies.join(", ")})`).join("\n") : "No detailed projects provided — ask the candidate to describe their own projects.")}
Experience: ${p.experience.map((e) => `${e.role} at ${e.organization}`).join("; ") || "None provided"}

Generate exactly ${count} conversational questions about the candidate's resume, projects, and experience. Mix difficulty (easy/medium/hard). Each question must be answerable by this specific candidate. Mark topic clearly.`;

  const schema = `{
  "questions": [
    { "question": "string", "type": "resume_project", "difficulty": "easy|medium|hard", "topic": "string", "source": "ai" }
  ]
}`;
  return jsonWrap(instructions, schema);
}

/* ---------- 2. RESUME / PROJECT — EVALUATION ---------- */
export function buildResumeProjectEvaluationPrompt(candidateProfile = {}, questions = [], answers = []) {
  const qBlock = questions.map((q) => `- ${q.question} (id: ${q.questionId})`).join("\n");
  const aBlock = answers.map((a) => `- id ${a.questionId}: ${a.answer ? a.answer : "[SKIPPED/UNANSWERED]"}`).join("\n");
  const instructions = `You are grading a candidate's answers from the Resume/Project round of a real interview.

Questions asked:
${qBlock}

Candidate answers:
${aBlock}

Evaluate communication, depth, honesty, and relevance to their own experience. Skipped answers should lower the score. Score 0-100. Provide per-question feedback (0-100 each).`;
  return jsonWrap(instructions, VERBAL_EVAL_SCHEMA);
}

/* ---------- 3. TECHNICAL — GENERATION (MCQ) ---------- */
export function buildTechnicalGenerationPrompt(candidateProfile = {}, count = 20) {
  const p = profileSummary(candidateProfile);
  const instructions = `You are an AI interviewer generating STRICTLY MULTIPLE-CHOICE TECHNICAL questions for a real interview, derived ONLY from the candidate's profile skills.

Candidate: ${p.candidateName}
Skills: ${p.skills.join(", ") || "N/A"}
Programming: ${p.programmingLanguages.join(", ") || "N/A"}
Frameworks: ${p.frameworks.join(", ") || "N/A"}
Databases: ${p.databases.join(", ") || "N/A"}

Generate exactly ${count} multiple-choice technical questions. Each must have EXACTLY 4 options (ids A, B, C, D). Set "correctAnswer" to the id of the single correct option. Add a short explanation. Cover the candidate's skill areas with a mix of difficulty.`;

  const schema = `{
  "questions": [
    {
      "question": "string",
      "type": "technical",
      "difficulty": "easy|medium|hard",
      "options": [
        { "id": "A", "text": "string" },
        { "id": "B", "text": "string" },
        { "id": "C", "text": "string" },
        { "id": "D", "text": "string" }
      ],
      "correctAnswer": "A",
      "explanation": "string",
      "topic": "string",
      "source": "ai"
    }
  ]
}`;
  return jsonWrap(instructions, schema);
}

/* ---------- 4. TECHNICAL — EVALUATION ---------- */
export function buildTechnicalEvaluationPrompt(candidateProfile = {}, questions = [], answers = []) {
  const block = questions.map((q) => {
    const a = answers.find((x) => x.questionId === q.questionId);
    const selected = a ? a.answer : "[SKIPPED]";
    return `Q: ${q.question}\nCorrect option: ${q.correctAnswer}\nOptions: ${q.options.map((o) => `${o.id}=${o.text}`).join(" | ")}\nCandidate selected: ${selected}`;
  }).join("\n\n");
  const instructions = `You are grading the Technical MCQ round of a real interview. The candidate's selected option id for each question is shown below, along with the correct option.

${block}

Determine correctness per question, produce a 0-100 score (percentage of correct minus penalty for skips), list strengths/weaknesses, topicPerformance (topic -> 0-100), and per-question feedback.`;
  return jsonWrap(instructions, TECH_EVAL_SCHEMA);
}

/* ---------- 5. CODING — GENERATION ---------- */
export function buildCodingGenerationPrompt(candidateProfile = {}, count = 3) {
  const p = profileSummary(candidateProfile);
  const instructions = `You are an AI interviewer generating ${count} coding problems for a real interview, tailored to the candidate's skill level (${p.programmingLanguages.join(", ") || "any language"}).

Each problem must include a clear title, description, constraints, 1-2 examples, and at least 2 test cases (input/expected). Provide an expectedApproach and the list of allowed languageOptions. Difficulty mix: easy/medium/hard.`;

  const schema = `{
  "questions": [
    {
      "title": "string",
      "description": "string",
      "difficulty": "easy|medium|hard",
      "constraints": "string",
      "examples": [ { "input": "string", "output": "string", "explanation": "string" } ],
      "testCases": [ { "input": "string", "expected": "string", "explanation": "string", "isHidden": true } ],
      "expectedApproach": "string",
      "languageOptions": ["Python", "Java", "C++", "C", "JavaScript"],
      "source": "ai"
    }
  ]
}`;
  return jsonWrap(instructions, schema);
}

/* ---------- 6. CODING — EVALUATION ---------- */
export function buildCodingEvaluationPrompt(candidateProfile = {}, questions = [], submissions = []) {
  const block = questions.map((q) => {
    const s = submissions.find((x) => x.questionId === q.questionId) || {};
    return `Problem: ${q.title}\nCandidate passed ${s.passedTests ?? 0}/${s.totalTests ?? 0} tests. Language: ${s.language || "N/A"}\nCode:\n${s.code || "[NO CODE]"}`;
  }).join("\n\n");
  const instructions = `You are grading the Coding round of a real interview using the compiler results below.

${block}

Score each problem 0-100 based on tests passed, code quality, and approach. Produce an overall coding score (0-100), strengths/weaknesses, and per-problem feedback.`;
  return jsonWrap(instructions, CODING_EVAL_SCHEMA);
}

/* ---------- 7. HR — GENERATION ---------- */
export function buildHRGenerationPrompt(candidateProfile = {}, count = 5) {
  const p = profileSummary(candidateProfile);
  const instructions = `You are an AI HR interviewer generating ${count} behavioral/HR questions for a real interview.

Candidate: ${p.candidateName}
Skills: ${p.skills.join(", ") || "N/A"}

Generate conversational HR questions about motivation, teamwork, conflict resolution, career goals, and self-awareness. Mix difficulty. Each question must be answerable by this candidate.`;

  const schema = `{
  "questions": [
    { "question": "string", "type": "hr", "difficulty": "easy|medium|hard", "topic": "string", "source": "ai" }
  ]
}`;
  return jsonWrap(instructions, schema);
}

/* ---------- 8. HR — EVALUATION ---------- */
export function buildHREvaluationPrompt(candidateProfile = {}, questions = [], answers = []) {
  const qBlock = questions.map((q) => `- ${q.question} (id: ${q.questionId})`).join("\n");
  const aBlock = answers.map((a) => `- id ${a.questionId}: ${a.answer ? a.answer : "[SKIPPED/UNANSWERED]"}`).join("\n");
  const instructions = `You are grading a candidate's answers from the HR round of a real interview.

Questions asked:
${qBlock}

Candidate answers:
${aBlock}

Evaluate communication, confidence, self-awareness, and cultural fit. Skipped answers lower the score. Score 0-100 with per-question feedback.`;
  return jsonWrap(instructions, VERBAL_EVAL_SCHEMA);
}
