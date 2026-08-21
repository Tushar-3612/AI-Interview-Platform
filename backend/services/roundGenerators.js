import { GoogleGenAI } from "@google/genai";
import AptitudeQuestion from "../models/AptitudeQuestion.js";
import CodingQuestion from "../models/CodingQuestion.js";
import TechnicalQuestion from "../models/TechnicalQuestion.js";
import { TECHNICAL_QUESTIONS } from "../data/technicalBank.mjs";
import { selectRandomQuestions, shuffleArray } from "./questionBank.js";
import { parseResumeComplete } from "./resumeParser.js";

export function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  if (apiKey.startsWith("sk-or-v1-")) {
    throw new Error("Invalid GEMINI_API_KEY: An OpenRouter key was provided instead of a Google Gemini key. Please provide a key starting with AIzaSy...");
  }

  return new GoogleGenAI({ apiKey: apiKey.trim() });
}

export const ROUND_QUESTION_COUNTS = {
  aptitude: 25,
  technical: 25,
  coding: 3,
  hr: 5,
};

const DEFAULT_HR_BANK = [
  {
    questionNumber: 1,
    id: "HR-01",
    questionId: "HR-01",
    question: "Tell me about yourself, your academic background, and why you are pursuing a career in software engineering.",
    skill: "Communication & Background",
    topic: "Introduction & Background",
    difficulty: "easy",
    type: "behavioral",
    section: "HR",
    category: "hr",
    aiSpeechText: "Welcome to the HR round! To start off, please tell me about yourself and why you're pursuing software engineering."
  },
  {
    questionNumber: 2,
    id: "HR-02",
    questionId: "HR-02",
    question: "What are your key technical strengths, and what is one technical area or skill you are actively working to improve?",
    skill: "Self-Awareness",
    topic: "Strengths & Development",
    difficulty: "easy",
    type: "behavioral",
    section: "HR",
    category: "hr",
    aiSpeechText: "What would you consider your key technical strengths, and what is one skill you're working to improve?"
  },
  {
    questionNumber: 3,
    id: "HR-03",
    questionId: "HR-03",
    question: "Describe a situation where you faced a challenge or conflict during a team project and how you handled it.",
    skill: "Conflict Resolution",
    topic: "Teamwork & Collaboration",
    difficulty: "medium",
    type: "behavioral",
    section: "HR",
    category: "hr",
    aiSpeechText: "Can you describe a situation where you faced a challenge or conflict while working in a team, and how you resolved it?"
  },
  {
    questionNumber: 4,
    id: "HR-04",
    questionId: "HR-04",
    question: "How do you manage your time and stay focused when dealing with multiple tasks or tight deadlines under pressure?",
    skill: "Time Management",
    topic: "Time Management & Pressure",
    difficulty: "medium",
    type: "behavioral",
    section: "HR",
    category: "hr",
    aiSpeechText: "How do you manage your time and handle pressure when working on multiple projects with tight deadlines?"
  },
  {
    questionNumber: 5,
    id: "HR-05",
    questionId: "HR-05",
    question: "Describe a project where something went wrong or didn't work as planned. What did you learn from the experience?",
    skill: "Resilience & Learning",
    topic: "Failure & Learning",
    difficulty: "medium",
    type: "behavioral",
    section: "HR",
    category: "hr",
    aiSpeechText: "Describe a project where something didn't go as planned. What did you learn from that experience?"
  },
  {
    questionNumber: 6,
    id: "HR-06",
    questionId: "HR-06",
    question: "How do you approach learning a new technology or programming framework that you have never used before?",
    skill: "Adaptability",
    topic: "Continuous Learning",
    difficulty: "medium",
    type: "behavioral",
    section: "HR",
    category: "hr",
    aiSpeechText: "How do you approach learning a new technology or framework that you have never used before?"
  },
  {
    questionNumber: 7,
    id: "HR-07",
    questionId: "HR-07",
    question: "Can you give an example of how you prioritized features when developing a project under constrained resources?",
    skill: "Decision Making",
    topic: "Project Ownership",
    difficulty: "hard",
    type: "scenario",
    section: "HR",
    category: "hr",
    aiSpeechText: "Can you give an example of how you prioritized features when developing a project with limited time or resources?"
  },
  {
    questionNumber: 8,
    id: "HR-08",
    questionId: "HR-08",
    question: "Where do you see yourself in 3 to 5 years, and how does your career goal align with this engineering position?",
    skill: "Career Goals",
    topic: "Career Goals & Alignment",
    difficulty: "easy",
    type: "behavioral",
    section: "HR",
    category: "hr",
    aiSpeechText: "Where do you see yourself professionally in three to five years, and how does this role fit into your long-term goals?"
  }
];

/**
 * 1. Single-Pass Resume Profiler
 * Extracts structured JSON profile and comprehensive skills from candidate resume.
 */
export async function parseResumeToProfile(resumeBase64, studentData = {}) {
  const fallbackProfile = {
    candidateName: studentData.name || "Candidate",
    skills: studentData.skills || ["Software Development", "Problem Solving", "Web Engineering"],
    programmingLanguages: studentData.skills?.filter(s => ["Java", "Python", "JavaScript", "C++", "C", "SQL", "TypeScript"].includes(s)) || ["JavaScript"],
    frameworks: studentData.skills?.filter(s => ["React", "Spring Boot", "Express", "Node.js", "Django"].includes(s)) || ["React"],
    databases: studentData.skills?.filter(s => ["MongoDB", "MySQL", "PostgreSQL"].includes(s)) || ["MySQL"],
    tools: ["Git"],
    projects: [],
    experience: [],
    education: studentData.department ? [{ degree: studentData.department }] : [],
    certifications: []
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
      certifications: parsed.certifications || []
    };
  } catch (err) {
    console.warn("Resume parsing notice:", err.message);
    return fallbackProfile;
  }
}

/**
 * 2. Aptitude Round Generator (Default: 25 Questions)
 * Generates MCQs with options, correctAnswer, topic, difficulty.
 */
export async function generateAptitudeQuestions(count = 25) {
  let questions = [];

  // Try local MongoDB bank first
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
        difficulty: (aptQ.difficulty || "medium").toLowerCase()
      }));
      return questions;
    }
  } catch (err) {
    console.warn("Aptitude DB fetch warning:", err.message);
  }

  // Fallback via static question bank
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
      difficulty: (aptQ.difficulty || "medium").toLowerCase()
    }));
  }

  // Generate all questions at once via Gemini
  try {
    const prompt = `You are an expert aptitude and logical reasoning test generator.
Generate exactly ${count} multiple-choice questions for technical campus placement.

DIFFICULTY DISTRIBUTION:
- 3 easy
- 4 medium
- 3 hard

TOPICS TO COVER:
- Quantitative Aptitude (Time & Work, Speed & Distance, Percentages, Profit & Loss)
- Logical Reasoning (Number Series, Coding-Decoding, Blood Relations, Syllogisms)
- Verbal Ability (Sentence Correction, Vocabulary, Reading Comprehension)

RULES:
1. Generate exactly ${count} questions.
2. Each question MUST have 4 distinct options.
3. Specify the exact correctAnswer matching one of the options.
4. Difficulty should gradually increase.
5. Return ONLY valid JSON.

OUTPUT FORMAT:
{
  "round": "aptitude",
  "questions": [
    {
      "questionNumber": 1,
      "question": "If a train 120m long passes a pole in 6 seconds, what is its speed in km/h?",
      "skill": "Speed & Distance",
      "options": ["60 km/h", "72 km/h", "80 km/h", "90 km/h"],
      "correctAnswer": "72 km/h",
      "difficulty": "easy",
      "type": "mcq"
    }
  ]
}`;

    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ text: prompt }],
      config: { responseMimeType: "application/json" }
    });

    const parsed = JSON.parse(res.text);
    if (parsed.questions && parsed.questions.length >= count) {
      return parsed.questions.slice(0, count).map((q, idx) => ({
        id: `APT-${String(idx + 1).padStart(2, "0")}`,
        questionId: `APT-${String(idx + 1).padStart(2, "0")}`,
        questionNumber: q.questionNumber || idx + 1,
        order: idx + 1,
        section: "APTITUDE",
        type: "mcq",
        questionType: "mcq",
        category: "aptitude",
        skill: q.skill || "Aptitude",
        question: q.question,
        options: q.options || ["A", "B", "C", "D"],
        correctAnswer: q.correctAnswer || "",
        topic: q.skill || "General Aptitude",
        difficulty: (q.difficulty || "medium").toLowerCase()
      }));
    }
  } catch (gemErr) {
    console.warn("Aptitude Gemini generation error:", gemErr.message);
  }

  // Curated fallback
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
    difficulty: q.difficulty
  }));
}

/**
 * Helper: Query Database / Bank questions filtered strictly by candidate's resume skills
 */
export async function getResumeMatchedDatabaseQuestions(candidateProfile = {}, count = 10) {
  const skills = [
    ...(candidateProfile.skills || []),
    ...(candidateProfile.programmingLanguages || []),
    ...(candidateProfile.frameworks || []),
    ...(candidateProfile.databases || []),
    ...(candidateProfile.tools || []),
  ].map(s => String(s).trim().toLowerCase()).filter(Boolean);

  let matchedQuestions = [];

  // 1. Try querying MongoDB TechnicalQuestion collection first
  try {
    if (skills.length > 0) {
      const regexPatterns = skills.map(s => new RegExp(`\\b${s}\\b`, 'i'));
      const dbQuestions = await TechnicalQuestion.find({
        isDeleted: { $ne: true },
        $or: [
          { subtopic: { $in: regexPatterns } },
          { topic: { $in: regexPatterns } },
          { question: { $in: regexPatterns } }
        ]
      }).lean();

      if (dbQuestions && dbQuestions.length > 0) {
        matchedQuestions = shuffleArray(dbQuestions);
      }
    }
  } catch (err) {
    console.warn("DB question query notice:", err.message);
  }

  // 2. If not enough from DB collection, search in TECHNICAL_QUESTIONS static bank
  if (matchedQuestions.length < count && TECHNICAL_QUESTIONS && TECHNICAL_QUESTIONS.length > 0) {
    const bankMatches = TECHNICAL_QUESTIONS.filter(q => {
      const sub = (q.subtopic || "").toLowerCase();
      const top = (q.topic || "").toLowerCase();
      const text = (q.question || "").toLowerCase();
      return skills.some(s => sub.includes(s) || top.includes(s) || text.includes(s));
    });

    const existingIds = new Set(matchedQuestions.map(q => q.questionId));
    for (const q of shuffleArray(bankMatches)) {
      if (!existingIds.has(q.questionId)) {
        matchedQuestions.push(q);
        existingIds.add(q.questionId);
      }
    }
  }

  // 3. Fallback to general bank questions if candidate skills are empty or unmatched
  if (matchedQuestions.length < count && TECHNICAL_QUESTIONS && TECHNICAL_QUESTIONS.length > 0) {
    const existingIds = new Set(matchedQuestions.map(q => q.questionId));
    for (const q of shuffleArray(TECHNICAL_QUESTIONS)) {
      if (!existingIds.has(q.questionId)) {
        matchedQuestions.push(q);
        existingIds.add(q.questionId);
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
    aiSpeechText: q.question
  }));
}

/**
 * 3. Technical Round Generator (Default: 10 Questions)
 * Hybrid approach: Uses Gemini API for candidate resume projects & dynamic questions,
 * blended with database questions matched strictly to the candidate's resume skills.
 */
export async function generateTechnicalQuestions(candidateProfile = {}, count = 25) {
  const skillsList = [
    ...(candidateProfile.skills || []),
    ...(candidateProfile.programmingLanguages || []),
    ...(candidateProfile.frameworks || []),
    ...(candidateProfile.databases || []),
    ...(candidateProfile.tools || [])
  ];
  const uniqueSkills = [...new Set(skillsList)].filter(Boolean);
  const skillsText = uniqueSkills.length > 0 ? uniqueSkills.join(", ") : "Java, Spring Boot, React, MySQL, Python";

  const projectsText = (candidateProfile.projects || []).length > 0
    ? (candidateProfile.projects || []).map(p => `${p.name}: ${p.description || ""} (Tech: ${(p.technologies || []).join(", ")})`).join("\n")
    : "Full Stack Web Application with Authentication, REST APIs, and Database Integration";

  const experienceText = (candidateProfile.experience || []).length > 0
    ? (candidateProfile.experience || []).map(e => `${e.role || "Software Engineer"} at ${e.company || "Company"} (${e.duration || "Present"})`).join("\n")
    : "Academic Engineering Projects and Internships";

  const prompt = `You are an expert technical interviewer.

Your task is to generate technical interview questions for a candidate
based strictly on their resume.

CANDIDATE SKILLS:
${skillsText}

CANDIDATE PROJECTS:
${projectsText}

CANDIDATE EXPERIENCE:
${experienceText}

INTERVIEW ROUND:
Technical

NUMBER OF QUESTIONS:
${count}

DIFFICULTY DISTRIBUTION:
- 2 easy
- 5 medium
- 3 hard

IMPORTANT RULES:
1. Generate exactly ${count} questions.
2. Generate only technical interview questions.
3. Questions must be relevant to the candidate's resume.
4. Prioritize technologies and skills explicitly mentioned in the resume.
5. Questions should cover different skills instead of repeatedly asking about the same technology.
6. Include conceptual, practical, debugging, and scenario-based questions.
7. Include project-based questions where appropriate.
8. Do not generate aptitude questions.
9. Do not generate HR questions.
10. Do not generate coding-programming problems.
11. Do not repeat questions.
12. Do not ask about technologies that are not present in the resume.
13. Questions should sound like questions asked by a real interviewer.
14. Difficulty should gradually increase.
15. Avoid extremely theoretical or academic questions.
16. Keep each question clear and concise.
17. Return ONLY valid JSON.

OUTPUT FORMAT:
{
  "round": "technical",
  "questions": [
    {
      "questionNumber": 1,
      "question": "What is dependency injection in Spring Boot?",
      "skill": "Spring Boot",
      "difficulty": "easy",
      "type": "conceptual"
    }
  ]
}`;

  let aiQuestions = [];

  // Try API generation first
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ text: prompt }],
      config: { responseMimeType: "application/json" }
    });

    const parsed = JSON.parse(response.text);
    if (parsed.questions && Array.isArray(parsed.questions)) {
      aiQuestions = parsed.questions.map((q, idx) => ({
        id: `TECH-AI-${String(idx + 1).padStart(2, "0")}`,
        questionId: `TECH-AI-${String(idx + 1).padStart(2, "0")}`,
        questionNumber: q.questionNumber || idx + 1,
        order: idx + 1,
        section: "TECHNICAL",
        type: "technical",
        questionType: q.type || "conceptual",
        category: "technical",
        skill: q.skill || "Technical",
        question: q.question,
        topic: q.skill || "Technical",
        subtopic: q.skill || "Technical",
        difficulty: (q.difficulty || (idx < 2 ? "easy" : idx < 7 ? "medium" : "hard")).toLowerCase(),
        marks: 1,
        source: "gemini_ai_resume",
        aiSpeechText: q.question
      }));
    }
  } catch (err) {
    console.warn("AI Question Generation Notice (falling back to database matched questions):", err.message);
  }

  // If AI generated enough questions, return them
  if (aiQuestions.length >= count) {
    return aiQuestions.slice(0, count);
  }

  // Hybrid fallback: query Database questions strictly matching the candidate's resume skills
  const dbMatched = await getResumeMatchedDatabaseQuestions(candidateProfile, count);

  // Blend AI questions with Database resume-matched questions
  const combined = [...aiQuestions, ...dbMatched];
  return combined.slice(0, count).map((q, idx) => ({
    ...q,
    questionNumber: idx + 1,
    order: idx + 1
  }));
}

/**
 * 4. Coding Round Generator (Default: 2 Questions)
 * Algorithmic challenges with test cases, starter code, and constraints.
 */
export async function generateCodingQuestions(candidateProfile = {}, count = 3) {
  // Try DB coding questions first
  try {
    let codingDb = await CodingQuestion.find({ isActive: true, isDeleted: false }).lean();
    if (codingDb && codingDb.length >= count) {
      return codingDb.slice(0, count).map((cq, idx) => ({
        id: `CODE-${String(idx + 1).padStart(2, "0")}`,
        questionId: cq.questionId || `CODE-${String(idx + 1).padStart(2, "0")}`,
        questionNumber: idx + 1,
        order: idx + 1,
        section: "CODING",
        type: "coding",
        questionType: "coding",
        category: "coding",
        skill: cq.category || "Data Structures & Algorithms",
        title: cq.title || `Coding Challenge ${idx + 1}`,
        question: cq.problemStatement || cq.description || cq.title,
        problemStatement: cq.problemStatement || cq.description || cq.title,
        inputFormat: cq.inputFormat || "Standard Input",
        outputFormat: cq.outputFormat || "Standard Output",
        constraints: cq.constraints || "1 <= N <= 10^5",
        sampleInput: cq.sampleInput || "",
        sampleOutput: cq.sampleOutput || "",
        expectedComplexity: cq.expectedComplexity || "O(n) time, O(1) space",
        allowedLanguages: cq.allowedLanguages || ["Python", "Java", "C++", "C", "JavaScript"],
        starterCode: cq.starterCode || "def solution():\n    pass",
        testCases: cq.testCases || [],
        difficulty: idx === 0 ? "easy" : idx === 1 ? "medium" : "hard",
        topic: cq.category || "Algorithms"
      }));
    }
  } catch (err) {
    console.warn("Coding DB fetch warning:", err.message);
  }

  // Pre-configured progressive coding problems
  const defaultCodingBank = [
    {
      questionNumber: 1,
      questionId: "CODE-01",
      title: "Two Sum Target Indices",
      problemStatement: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume each input has exactly one solution.",
      inputFormat: "Array of integers and target number",
      outputFormat: "Array of two indices [i, j]",
      constraints: "2 <= nums.length <= 10^4, -10^9 <= nums[i] <= 10^9",
      sampleInput: "nums = [2, 7, 11, 15], target = 9",
      sampleOutput: "[0, 1]",
      expectedComplexity: "O(n) time, O(n) space",
      allowedLanguages: ["Python", "Java", "C++", "C", "JavaScript"],
      starterCode: "def two_sum(nums, target):\n    # Write your solution here\n    pass",
      difficulty: "easy",
      skill: "Arrays & Hash Maps",
      testCases: [
        { input: "[2,7,11,15], 9", expected: "[0,1]", isHidden: false },
        { input: "[3,2,4], 6", expected: "[1,2]", isHidden: true }
      ]
    },
    {
      questionNumber: 2,
      questionId: "CODE-02",
      title: "Longest Substring Without Repeating Characters",
      problemStatement: "Given a string s, find the length of the longest substring without repeating characters.",
      inputFormat: "A single string s",
      outputFormat: "Integer length",
      constraints: "0 <= s.length <= 5 * 10^4",
      sampleInput: "s = \"abcabcbb\"",
      sampleOutput: "3",
      expectedComplexity: "O(n) time, O(min(m,n)) space",
      allowedLanguages: ["Python", "Java", "C++", "C", "JavaScript"],
      starterCode: "def length_of_longest_substring(s: str) -> int:\n    # Write your solution here\n    pass",
      difficulty: "medium",
      skill: "Sliding Window & Strings",
      testCases: [
        { input: "\"abcabcbb\"", expected: "3", isHidden: false },
        { input: "\"bbbbb\"", expected: "1", isHidden: true },
        { input: "\"pwwkew\"", expected: "3", isHidden: true }
      ]
    },
    {
      questionNumber: 3,
      questionId: "CODE-03",
      title: "Valid Parentheses Stack Evaluation",
      problemStatement: "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid. An input string is valid if open brackets are closed by the same type of brackets in the correct order.",
      inputFormat: "A string s of brackets",
      outputFormat: "Boolean true or false",
      constraints: "1 <= s.length <= 10^4",
      sampleInput: "s = \"()[]{}\"",
      sampleOutput: "true",
      expectedComplexity: "O(n) time, O(n) space",
      allowedLanguages: ["Python", "Java", "C++", "C", "JavaScript"],
      starterCode: "def is_valid(s: str) -> bool:\n    # Write your solution here\n    pass",
      difficulty: "medium",
      skill: "Stacks & Data Structures",
      testCases: [
        { input: "\"()[]{}\"", expected: "true", isHidden: false },
        { input: "\"(]\"", expected: "false", isHidden: true },
        { input: "\"([)]\"", expected: "false", isHidden: true }
      ]
    }
  ];

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
    allowedLanguages: cq.allowedLanguages,
    starterCode: cq.starterCode,
    testCases: cq.testCases,
    difficulty: cq.difficulty,
    topic: "Data Structures & Algorithms"
  }));
}

/**
 * 5. HR Round Generator (Default: 5 Questions)
 * STAR behavioral questions contextualized by candidate profile.
 */
export async function generateHRQuestions(candidateProfile = {}, count = 5) {
  const candidateProjects = candidateProfile.projects || [];
  const candidateExperience = candidateProfile.experience || [];
  const topProject = candidateProjects[0]?.name || "your main engineering project";

  const prompt = `You are the HR & Behavioral Interview Question Generator for a professional AI-powered interview platform.
Generate exactly ${count} candidate-specific behavioral/HR interview questions.

Candidate Name: ${candidateProfile.candidateName || "Candidate"}
Projects: ${candidateProjects.map(p => p.name).join(", ") || "Engineering Application"}
Experience: ${candidateExperience.map(e => `${e.role} at ${e.company}`).join(", ") || "Academic Projects"}

CORE RULES:
1. Generate exactly ${count} questions.
2. Ground questions in candidate's actual projects/background whenever possible.
3. Focus on: Teamwork, Conflict Resolution, Overcoming Obstacles, Project Ownership, Failure & Learning, Career Goals.
4. Structure around STAR methodology (Situation, Task, Action, Result).
5. Difficulty should range: 2 easy, 4 medium, 2 hard.
6. Return ONLY valid JSON.

OUTPUT FORMAT:
{
  "round": "hr",
  "questions": [
    {
      "questionNumber": 1,
      "question": "Tell me about yourself and what inspired you to pursue a software engineering career.",
      "skill": "Self Introduction",
      "difficulty": "easy",
      "type": "behavioral"
    }
  ]
}`;

  try {
    const ai = getAIClient();
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ text: prompt }],
      config: { responseMimeType: "application/json" }
    });

    const parsed = JSON.parse(res.text);
    if (parsed.questions && parsed.questions.length >= count) {
      return parsed.questions.slice(0, count).map((hrQ, idx) => ({
        id: `HR-AI-${String(idx + 1).padStart(2, "0")}`,
        questionId: `HR-AI-${String(idx + 1).padStart(2, "0")}`,
        questionNumber: hrQ.questionNumber || idx + 1,
        order: idx + 1,
        section: "HR",
        type: "hr",
        questionType: hrQ.type || "behavioral",
        category: "hr",
        skill: hrQ.skill || "Behavioral",
        question: hrQ.question,
        topic: hrQ.skill || "Behavioral",
        difficulty: (hrQ.difficulty || "medium").toLowerCase(),
        source: "gemini_ai_resume",
        aiSpeechText: hrQ.question
      }));
    }
  } catch (err) {
    console.warn("HR Dynamic AI generation notice (falling back to tailored HR bank):", err.message);
  }

  // Hybrid fallback: Structured HR bank customized for candidate profile
  return DEFAULT_HR_BANK.slice(0, count).map((hrQ, idx) => {
    let qText = hrQ.question;
    if (topProject && qText.includes("your main project")) {
      qText = qText.replace("your main project", `your project '${topProject}'`);
    }
    return {
      ...hrQ,
      id: `HR-DB-${String(idx + 1).padStart(2, "0")}`,
      questionId: `HR-DB-${String(idx + 1).padStart(2, "0")}`,
      questionNumber: idx + 1,
      order: idx + 1,
      question: qText,
      aiSpeechText: qText,
      source: "database_resume_matched"
    };
  });
}

/**
 * Master Round Questions Generator
 * Generates all questions for a given round name based on candidateProfile.
 */
export async function generateQuestionsForRound(roundName, candidateProfile = {}) {
  const norm = String(roundName).toLowerCase();
  const count = ROUND_QUESTION_COUNTS[norm] || 25;

  switch (norm) {
    case "aptitude":
      return await generateAptitudeQuestions(count);
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

/**
 * Sanitizer for Live Interview Client Payload
 * Strips correctAnswer in Aptitude and hidden testCases in Coding to preserve security.
 */
export function sanitizeRoundQuestionsForClient(questions, roundName) {
  if (!Array.isArray(questions)) return [];

  const roundKey = String(roundName).toUpperCase();

  return questions.map(q => {
    const cleanQ = { ...q };

    if (roundKey === "APTITUDE") {
      delete cleanQ.correctAnswer;
      delete cleanQ.explanation;
    }

    if (roundKey === "CODING" && cleanQ.testCases) {
      cleanQ.testCases = cleanQ.testCases.filter(tc => !tc.isHidden);
    }

    return cleanQ;
  });
}
