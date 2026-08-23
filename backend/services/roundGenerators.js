import AptitudeQuestion from "../models/AptitudeQuestion.js";
import CodingQuestion from "../models/CodingQuestion.js";
import TechnicalQuestion from "../models/TechnicalQuestion.js";
import { TECHNICAL_QUESTIONS } from "../data/technicalBank.mjs";
import { selectRandomQuestions, shuffleArray } from "./questionBank.js";
import { parseResumeComplete } from "./resumeParser.js";
import { isAIConfigured, getAIClient } from "./ai/aiClient.js";

// Real AI generators (provider-independent)
import { generateResumeProjectQuestions as aiGenerateResumeProjectQuestions } from "./ai/resumeQuestionGenerator.js";
import { generateTechnicalQuestions as aiGenerateTechnicalQuestions } from "./ai/technicalQuestionGenerator.js";
import { generateHRQuestions as aiGenerateHRQuestions } from "./ai/hrQuestionGenerator.js";
import { generateCodingQuestions as aiGenerateCodingQuestions } from "./ai/codingQuestionGenerator.js";

// Re-export for legacy callers (evaluation code in interviewController / server.js)
export { getAIClient, isAIConfigured };

export const ROUND_QUESTION_COUNTS = {
  aptitude: 25,
  technical: 25,
  coding: 3,
  hr: 5,
};

/* ================================
   LOCAL FALLBACK BANKS (used only when AI is unavailable)
   These are clearly marked source: "fallback_local" and are NOT
   presented as AI-generated.
   ================================ */

const DEFAULT_HR_BANK = [
  { questionNumber: 1, id: "HR-01", questionId: "HR-01", question: "Tell me about yourself, your academic background, and why you are pursuing a career in software engineering.", skill: "Communication & Background", topic: "Introduction & Background", difficulty: "easy", type: "behavioral", section: "HR", category: "hr", aiSpeechText: "Welcome to the HR round! To start off, please tell me about yourself and why you're pursuing software engineering." },
  { questionNumber: 2, id: "HR-02", questionId: "HR-02", question: "What are your key technical strengths, and what is one technical area or skill you are actively working to improve?", skill: "Self-Awareness", topic: "Strengths & Development", difficulty: "easy", type: "behavioral", section: "HR", category: "hr", aiSpeechText: "What would you consider your key technical strengths, and what is one skill you're working to improve?" },
  { questionNumber: 3, id: "HR-03", questionId: "HR-03", question: "Describe a situation where you faced a challenge or conflict during a team project and how you handled it.", skill: "Conflict Resolution", topic: "Teamwork & Collaboration", difficulty: "medium", type: "behavioral", section: "HR", category: "hr", aiSpeechText: "Can you describe a situation where you faced a challenge or conflict while working in a team, and how you resolved it?" },
  { questionNumber: 4, id: "HR-04", questionId: "HR-04", question: "How do you manage your time and stay focused when dealing with multiple tasks or tight deadlines under pressure?", skill: "Time Management", topic: "Time Management & Pressure", difficulty: "medium", type: "behavioral", section: "HR", category: "hr", aiSpeechText: "How do you manage your time and handle pressure when working on multiple projects with tight deadlines?" },
  { questionNumber: 5, id: "HR-05", questionId: "HR-05", question: "Describe a project where something went wrong or didn't work as planned. What did you learn from the experience?", skill: "Resilience & Learning", topic: "Failure & Learning", difficulty: "medium", type: "behavioral", section: "HR", category: "hr", aiSpeechText: "Describe a project where something didn't go as planned. What did you learn from that experience?" },
  { questionNumber: 6, id: "HR-06", questionId: "HR-06", question: "How do you approach learning a new technology or programming framework that you have never used before?", skill: "Adaptability", topic: "Continuous Learning", difficulty: "medium", type: "behavioral", section: "HR", category: "hr", aiSpeechText: "How do you approach learning a new technology or framework that you have never used before?" },
  { questionNumber: 7, id: "HR-07", questionId: "HR-07", question: "Can you give an example of how you prioritized features when developing a project under constrained resources?", skill: "Decision Making", topic: "Project Ownership", difficulty: "hard", type: "scenario", section: "HR", category: "hr", aiSpeechText: "Can you give an example of how you prioritized features when developing a project with limited time or resources?" },
  { questionNumber: 8, id: "HR-08", questionId: "HR-08", question: "Where do you see yourself in 3 to 5 years, and how does your career goal align with this engineering position?", skill: "Career Goals", topic: "Career Goals & Alignment", difficulty: "easy", type: "behavioral", section: "HR", category: "hr", aiSpeechText: "Where do you see yourself professionally in three to five years, and how does this role fit into your long-term goals?" }
];

const defaultCodingBank = [
  { questionNumber: 1, questionId: "CODE-01", title: "Two Sum Target Indices", problemStatement: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume each input has exactly one solution.", inputFormat: "Array of integers and target number", outputFormat: "Array of two indices [i, j]", constraints: "2 <= nums.length <= 10^4, -10^9 <= nums[i] <= 10^9", sampleInput: "nums = [2, 7, 11, 15], target = 9", sampleOutput: "[0, 1]", expectedComplexity: "O(n) time, O(n) space", skill: "Arrays & Hash Maps", testCases: [ { input: "[2,7,11,15], 9", expected: "[0,1]", isHidden: false }, { input: "[3,2,4], 6", expected: "[1,2]", isHidden: true } ] },
  { questionNumber: 2, questionId: "CODE-02", title: "Longest Substring Without Repeating Characters", problemStatement: "Given a string s, find the length of the longest substring without repeating characters.", inputFormat: "A single string s", outputFormat: "Integer length", constraints: "0 <= s.length <= 5 * 10^4", sampleInput: 's = "abcabcbb"', sampleOutput: "3", expectedComplexity: "O(n) time, O(min(m,n)) space", skill: "Sliding Window & Strings", testCases: [ { input: '"abcabcbb"', expected: "3", isHidden: false }, { input: '"bbbbb"', expected: "1", isHidden: true }, { input: '"pwwkew"', expected: "3", isHidden: true } ] },
  { questionNumber: 3, questionId: "CODE-03", title: "Valid Parentheses Stack Evaluation", problemStatement: "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.", inputFormat: "A string s of brackets", outputFormat: "Boolean true or false", constraints: "1 <= s.length <= 10^4", sampleInput: 's = "()[]{}"', sampleOutput: "true", expectedComplexity: "O(n) time, O(n) space", skill: "Stacks & Data Structures", testCases: [ { input: '"()[]{}"', expected: "true", isHidden: false }, { input: '"(]"', expected: "false", isHidden: true }, { input: '"( [ ) ]"', expected: "false", isHidden: true } ] }
];

/**
 * Honest local fallback for the Resume/Project round when AI is unavailable.
 * These ask the candidate to describe THEIR OWN work — they do not invent
 * projects, technologies, or achievements. source is clearly "fallback_local".
 */
const RESUME_FALLBACK = [
  "Describe one project you have worked on in detail, including its goal and your specific role.",
  "For a project you built, explain a key technology choice you made and why you chose it.",
  "Tell me about a significant challenge you faced in a project and how you overcame it.",
  "Describe the architecture of a system you designed or contributed to.",
  "How did you test a project you worked on, and what did the tests reveal?",
  "Explain a design decision in one of your projects that you would do differently today.",
  "Walk me through the deployment or delivery process of a project you were part of.",
  "What was the most complex part of a project you built, and how did you approach it?",
  "Describe how you collaborated with others on a project and your contribution to the team.",
  "What is one improvement you would make to a project you have worked on?"
];

/* ================================
   RESUME PROFILE
   ================================ */

export async function parseResumeToProfile(resumeBase64, studentData = {}) {
  const fallbackProfile = {
    candidateName: studentData.name || "Candidate",
    skills: studentData.skills || ["Software Development", "Problem Solving", "Web Engineering"],
    programmingLanguages: studentData.skills?.filter((s) => ["Java", "Python", "JavaScript", "C++", "C", "SQL", "TypeScript"].includes(s)) || ["JavaScript"],
    frameworks: studentData.skills?.filter((s) => ["React", "Spring Boot", "Express", "Node.js", "Django"].includes(s)) || ["React"],
    databases: studentData.skills?.filter((s) => ["MongoDB", "MySQL", "PostgreSQL"].includes(s)) || ["MySQL"],
    tools: ["Git"],
    projects: [],
    experience: [],
    education: studentData.department ? [{ degree: studentData.department }] : [],
    certifications: [],
  };

  if (!resumeBase64) return fallbackProfile;

  try {
    const buffer = Buffer.from(resumeBase64, "base64");
    const parsed = await parseResumeComplete(buffer, "application/pdf", studentData);
    const cat = parsed.categorizedSkills || {};
    return {
      candidateName: parsed.candidateName || studentData.name || "Candidate",
      skills: parsed.all_skills?.length ? parsed.all_skills : fallbackProfile.skills,
      all_skills: parsed.all_skills?.length ? parsed.all_skills : fallbackProfile.skills,
      categorizedSkills: cat,
      programmingLanguages: cat.programming_languages || [],
      frameworks: cat.frameworks || [],
      databases: cat.databases || [],
      tools: cat.tools || [],
      projects: parsed.projects || [],
      experience: parsed.experience || [],
      education: parsed.education || [],
      certifications: parsed.certifications || [],
    };
  } catch (err) {
    console.warn("Resume parsing notice:", err.message);
    return fallbackProfile;
  }
}

/* ================================
   APTITUDE — LOCAL ONLY (DB + JSON bank + curated)
   ================================ */

export async function generateAptitudeQuestions(count = 25) {
  let questions = [];

  try {
    let aptDbQuestions = await AptitudeQuestion.find({ isActive: true, isDeleted: false }).lean();
    if (aptDbQuestions && aptDbQuestions.length >= count) {
      questions = shuffleArray(aptDbQuestions).slice(0, count).map((aptQ, idx) => ({
        id: `APT-${String(idx + 1).padStart(2, "0")}`,
        questionId: aptQ.questionId || `APT-${String(idx + 1).padStart(2, "0")}`,
        questionNumber: idx + 1,
        order: idx + 1,
        section: "APTITUDE",
        type: "mcq",
        questionType: "mcq",
        category: "aptitude",
        skill: aptQ.category || "Quantitative & Logical",
        question: aptQ.question,
        options: aptQ.options || ["A", "B", "C", "D"],
        correctAnswer: aptQ.correctAnswer || "",
        explanation: aptQ.explanation || "",
        topic: aptQ.category || "Quantitative & Logical",
        difficulty: (aptQ.difficulty || "medium").toLowerCase(),
        source: "database",
      }));
      return questions;
    }
  } catch (err) {
    console.warn("Aptitude DB fetch warning:", err.message);
  }

  const bankPicked = selectRandomQuestions({ count });
  if (bankPicked && bankPicked.length >= count) {
    return bankPicked.slice(0, count).map((aptQ, idx) => ({
      id: `APT-${String(idx + 1).padStart(2, "0")}`,
      questionId: aptQ.questionId || `APT-${String(idx + 1).padStart(2, "0")}`,
      questionNumber: idx + 1,
      order: idx + 1,
      section: "APTITUDE",
      type: "mcq",
      questionType: "mcq",
      category: "aptitude",
      skill: aptQ.category || "General Aptitude",
      question: aptQ.question,
      options: aptQ.options || ["A", "B", "C", "D"],
      correctAnswer: aptQ.correctAnswer || "",
      explanation: aptQ.explanation || "",
      topic: aptQ.category || "General Aptitude",
      difficulty: (aptQ.difficulty || "medium").toLowerCase(),
      source: "bank",
    }));
  }

  const curatedAptitude = [
    { question: "If 12 men can complete a work in 8 days, how many men are needed to complete it in 6 days?", options: ["14", "16", "18", "20"], correctAnswer: "16", skill: "Time & Work", difficulty: "easy" },
    { question: "Find the next number in the series: 2, 6, 12, 20, 30, ?", options: ["40", "42", "44", "48"], correctAnswer: "42", skill: "Number Series", difficulty: "easy" },
    { question: "A shopkeeper sells an item for $840 making a 20% profit. What was the cost price?", options: ["$680", "$700", "$720", "$750"], correctAnswer: "$700", skill: "Profit & Loss", difficulty: "easy" },
    { question: "If a car travels at 60 km/h for 2.5 hours, what is the distance covered?", options: ["120 km", "140 km", "150 km", "160 km"], correctAnswer: "150 km", skill: "Speed & Distance", difficulty: "medium" },
    { question: "In a certain code, COMPUTER is written as RFUVQNPC. How is MEDICINE written in that code?", options: ["MFEDJJOE", "EOJDEJFM", "MFEJDJOE", "EOJDJEFM"], correctAnswer: "EOJDJEFM", skill: "Coding-Decoding", difficulty: "medium" },
    { question: "A pipe can fill a tank in 4 hours and another pipe can empty it in 6 hours. If both are opened together, how long will it take to fill the tank?", options: ["10 hours", "12 hours", "14 hours", "16 hours"], correctAnswer: "12 hours", skill: "Pipes & Cisterns", difficulty: "medium" },
    { question: "What is the probability of getting a sum of 9 when two dice are rolled?", options: ["1/6", "1/8", "1/9", "1/12"], correctAnswer: "1/9", skill: "Probability", difficulty: "medium" },
    { question: "A and B invest in a business in the ratio 3:5. If total profit is $9600, what is A's share?", options: ["$3200", "$3600", "$4000", "$4200"], correctAnswer: "$3600", skill: "Partnership & Ratio", difficulty: "hard" },
    { question: "Pointing to a photograph, a man said: 'She is the daughter of my grandfather's only son.' How is she related to the man?", options: ["Mother", "Aunt", "Sister", "Daughter"], correctAnswer: "Sister", skill: "Blood Relations", difficulty: "hard" },
    { question: "Find the angle between the hour and minute hand of a clock at 3:30.", options: ["70°", "75°", "80°", "85°"], correctAnswer: "75°", skill: "Clock & Calendar", difficulty: "hard" }
  ];

  return curatedAptitude.slice(0, count).map((q, idx) => ({
    id: `APT-${String(idx + 1).padStart(2, "0")}`,
    questionId: `APT-${String(idx + 1).padStart(2, "0")}`,
    questionNumber: idx + 1,
    order: idx + 1,
    section: "APTITUDE",
    type: "mcq",
    questionType: "mcq",
    category: "aptitude",
    skill: q.skill,
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
    topic: q.skill,
    difficulty: q.difficulty,
    source: "curated_fallback",
  }));
}

/* ================================
   RESUME MATCHED DB HELPER (Technical fallback)
   ================================ */

export async function getResumeMatchedDatabaseQuestions(candidateProfile = {}, count = 20) {
  const skills = [
    ...(candidateProfile.skills || []),
    ...(candidateProfile.programmingLanguages || []),
    ...(candidateProfile.frameworks || []),
    ...(candidateProfile.databases || []),
    ...(candidateProfile.tools || []),
  ].map((s) => String(s).trim().toLowerCase()).filter(Boolean);

  let matchedQuestions = [];

  try {
    if (skills.length > 0) {
      const regexPatterns = skills.map((s) => new RegExp(`\\b${s}\\b`, "i"));
      const dbQuestions = await TechnicalQuestion.find({
        isDeleted: { $ne: true },
        $or: [{ subtopic: { $in: regexPatterns } }, { topic: { $in: regexPatterns } }, { question: { $in: regexPatterns } }],
      }).lean();
      if (dbQuestions && dbQuestions.length > 0) matchedQuestions = shuffleArray(dbQuestions);
    }
  } catch (err) {
    console.warn("DB question query notice:", err.message);
  }

  if (matchedQuestions.length < count && TECHNICAL_QUESTIONS && TECHNICAL_QUESTIONS.length > 0) {
    const bankMatches = TECHNICAL_QUESTIONS.filter((q) => {
      const sub = (q.subtopic || "").toLowerCase();
      const top = (q.topic || "").toLowerCase();
      const text = (q.question || "").toLowerCase();
      return skills.some((s) => sub.includes(s) || top.includes(s) || text.includes(s));
    });
    const existingIds = new Set(matchedQuestions.map((q) => q.questionId));
    for (const q of shuffleArray(bankMatches)) {
      if (!existingIds.has(q.questionId)) {
        matchedQuestions.push(q);
        existingIds.add(q.questionId);
      }
    }
  }

  if (matchedQuestions.length < count && TECHNICAL_QUESTIONS && TECHNICAL_QUESTIONS.length > 0) {
    const existingIds = new Set(matchedQuestions.map((q) => q.questionId));
    for (const q of shuffleArray(TECHNICAL_QUESTIONS)) {
      if (!existingIds.has(q.questionId)) {
        matchedQuestions.push(q);
        existingIds.add(q.questionId || q.questionId);
      }
    }
  }

  return matchedQuestions.slice(0, count).map((q, idx) => ({
    id: `TECH-DB-${String(idx + 1).padStart(2, "0")}`,
    questionId: q.questionId || `TECH-DB-${String(idx + 1).padStart(2, "0")}`,
    questionNumber: idx + 1,
    order: idx + 1,
    section: "TECHNICAL",
    type: "technical",
    questionType: q.questionType || q.type || "conceptual",
    category: "technical",
    skill: q.subtopic || q.topic || "Technical Fundamentals",
    question: q.question,
    options: q.options || [],
    correctAnswer: q.correctAnswer || "",
    topic: q.topic || "Programming & OOP",
    subtopic: q.subtopic || "",
    difficulty: (q.difficulty || "medium").toLowerCase(),
    marks: q.marks || 1,
    source: "database_resume_matched",
    aiSpeechText: q.question,
  }));
}

/* ================================
   TECHNICAL — AI with local fallback
   ================================ */

export async function generateTechnicalQuestions(candidateProfile = {}, count = 20) {
  if (isAIConfigured()) {
    try {
      const aiQuestions = await aiGenerateTechnicalQuestions(candidateProfile, count);
      if (aiQuestions && aiQuestions.length > 0) return aiQuestions.slice(0, count);
    } catch (err) {
      console.warn("AI Technical generation failed, using resume-matched local bank:", err.message);
    }
  } else {
    console.warn("AI not configured — using resume-matched local bank for Technical round.");
  }
  const dbMatched = await getResumeMatchedDatabaseQuestions(candidateProfile, count);
  return dbMatched.map((q, idx) => ({ ...q, source: "fallback_local", questionNumber: idx + 1, order: idx + 1 }));
}

/* ================================
   HR — AI with local fallback
   ================================ */

export async function generateHRQuestions(candidateProfile = {}, count = 5) {
  if (isAIConfigured()) {
    try {
      const aiQuestions = await aiGenerateHRQuestions(candidateProfile, count);
      if (aiQuestions && aiQuestions.length > 0) return aiQuestions.slice(0, count);
    } catch (err) {
      console.warn("AI HR generation failed, using local HR bank:", err.message);
    }
  } else {
    console.warn("AI not configured — using local HR bank.");
  }

  const topProject = (candidateProfile.projects || [])[0]?.name || "your main project";
  return DEFAULT_HR_BANK.slice(0, count).map((hrQ, idx) => {
    let qText = hrQ.question;
    if (qText.includes("your main project")) qText = qText.replace("your main project", `your project '${topProject}'`);
    return {
      ...hrQ,
      id: `HR-DB-${String(idx + 1).padStart(2, "0")}`,
      questionId: `HR-DB-${String(idx + 1).padStart(2, "0")}`,
      questionNumber: idx + 1,
      order: idx + 1,
      question: qText,
      aiSpeechText: qText,
      source: "fallback_local",
    };
  });
}

/* ================================
   CODING — AI with local fallback
   ================================ */

export async function generateCodingQuestions(candidateProfile = {}, count = 3) {
  if (isAIConfigured()) {
    try {
      const aiQuestions = await aiGenerateCodingQuestions(candidateProfile, count);
      if (aiQuestions && aiQuestions.length > 0) return aiQuestions.slice(0, count);
    } catch (err) {
      console.warn("AI Coding generation failed or invalid, using local coding bank:", err.message);
    }
  } else {
    console.warn("AI not configured — using local coding bank.");
  }

  return defaultCodingBank.slice(0, count).map((cq, idx) => ({
    id: `CODE-${String(idx + 1).padStart(2, "0")}`,
    questionId: cq.questionId || `CODE-${String(idx + 1).padStart(2, "0")}`,
    questionNumber: cq.questionNumber || idx + 1,
    order: idx + 1,
    section: "CODING",
    type: "coding",
    questionType: "coding",
    category: "coding",
    skill: cq.skill,
    title: cq.title,
    question: cq.problemStatement,
    problemStatement: cq.problemStatement,
    inputFormat: cq.inputFormat,
    outputFormat: cq.outputFormat,
    constraints: cq.constraints,
    sampleInput: cq.sampleInput,
    sampleOutput: cq.sampleOutput,
    expectedComplexity: cq.expectedComplexity,
    allowedLanguages: cq.allowedLanguages || ["Python", "Java", "C++", "C", "JavaScript"],
    starterCode: cq.starterCode || "",
    testCases: cq.testCases,
    difficulty: cq.difficulty,
    topic: "Data Structures & Algorithms",
    source: "fallback_local",
    aiSpeechText: cq.problemStatement,
  }));
}

/* ================================
   RESUME / PROJECT — AI with honest local fallback
   ================================ */

export async function generateResumeProjectQuestions(candidateProfile = {}, count = 10) {
  if (isAIConfigured()) {
    try {
      const aiQuestions = await aiGenerateResumeProjectQuestions(candidateProfile, count);
      if (aiQuestions && aiQuestions.length > 0) return aiQuestions.slice(0, count);
    } catch (err) {
      console.warn("AI Resume/Project generation failed, using honest local fallback:", err.message);
    }
  } else {
    console.warn("AI not configured — using honest local fallback for Resume/Project round.");
  }

  return RESUME_FALLBACK.slice(0, count).map((qText, idx) => ({
    id: `RESUME-DB-${String(idx + 1).padStart(2, "0")}`,
    questionId: `RESUME-DB-${String(idx + 1).padStart(2, "0")}`,
    questionNumber: idx + 1,
    order: idx + 1,
    section: "RESUME_PROJECT",
    type: "resume_project",
    questionType: "resume_project",
    category: "resume_project",
    skill: "Project",
    topic: "Project",
    difficulty: idx < 3 ? "easy" : idx < 7 ? "medium" : "hard",
    source: "fallback_local",
    aiSpeechText: qText,
    question: qText,
  }));
}

/* ================================
   MASTER ROUND DISPATCH
   ================================ */

export async function generateQuestionsForRound(roundName, candidateProfile = {}) {
  const norm = String(roundName).toLowerCase();
  const count = ROUND_QUESTION_COUNTS[norm] || 20;

  switch (norm) {
    case "aptitude":
      return await generateAptitudeQuestions(count);
    case "resume_project":
    case "resume":
      return await generateResumeProjectQuestions(candidateProfile, count);
    case "technical":
      return await generateTechnicalQuestions(candidateProfile, count);
    case "coding":
      return await generateCodingQuestions(candidateProfile, count);
    case "hr":
      return await generateHRQuestions(candidateProfile, count);
    default:
      return await generateTechnicalQuestions(candidateProfile, count);
  }
}

export function sanitizeRoundQuestionsForClient(questions, roundName) {
  if (!Array.isArray(questions)) return [];
  const roundKey = String(roundName).toUpperCase();
  return questions.map((q) => {
    const cleanQ = { ...q };
    if (roundKey === "APTITUDE") {
      delete cleanQ.correctAnswer;
      delete cleanQ.explanation;
    }
    if (roundKey === "CODING" && cleanQ.testCases) {
      cleanQ.testCases = cleanQ.testCases.filter((tc) => !tc.isHidden);
    }
    return cleanQ;
  });
}
