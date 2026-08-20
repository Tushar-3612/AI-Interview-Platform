import { GoogleGenAI } from "@google/genai";
import AptitudeQuestion from "../models/AptitudeQuestion.js";
import CodingQuestion from "../models/CodingQuestion.js";
import { selectRandomQuestions, shuffleArray } from "./questionBank.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const DEFAULT_HR_BANK = [
  {
    id: "HR-01",
    questionId: "HR-01",
    question: "Tell me about yourself, your academic background, and why you are pursuing a career in software engineering.",
    topic: "Introduction & Background",
    difficulty: "Easy",
    section: "HR",
    category: "hr",
    aiSpeechText: "Welcome to the HR round! To start off, please tell me about yourself and why you're pursuing software engineering."
  },
  {
    id: "HR-02",
    questionId: "HR-02",
    question: "What are your key technical strengths, and what is one technical area or skill you are actively working to improve?",
    topic: "Strengths & Development",
    difficulty: "Easy",
    section: "HR",
    category: "hr",
    aiSpeechText: "What would you consider your key technical strengths, and what is one skill you're working to improve?"
  },
  {
    id: "HR-03",
    questionId: "HR-03",
    question: "Describe a situation where you faced a challenge or conflict during a team project and how you handled it.",
    topic: "Teamwork & Collaboration",
    difficulty: "Medium",
    section: "HR",
    category: "hr",
    aiSpeechText: "Can you describe a situation where you faced a challenge or conflict while working in a team, and how you resolved it?"
  },
  {
    id: "HR-04",
    questionId: "HR-04",
    question: "How do you manage your time and stay focused when dealing with multiple tasks or tight deadlines under pressure?",
    topic: "Time Management & Pressure",
    difficulty: "Medium",
    section: "HR",
    category: "hr",
    aiSpeechText: "How do you manage your time and handle pressure when working on multiple projects with tight deadlines?"
  },
  {
    id: "HR-05",
    questionId: "HR-05",
    question: "Where do you see yourself in 3 to 5 years, and how does your career goal align with this engineering position?",
    topic: "Career Goals & Alignment",
    difficulty: "Easy",
    section: "HR",
    category: "hr",
    aiSpeechText: "Where do you see yourself professionally in three to five years, and how does this role fit into your long-term goals?"
  }
];

/**
 * 1. Single-Pass Resume Profiler
 * Extracts structured JSON profile from candidate resume.
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
    const prompt = `You are an expert resume parser.
Analyze the candidate's resume carefully.
Extract ONLY information explicitly stated in the resume.
Do NOT hallucinate or assume technologies not present in the document.

Return ONLY valid JSON with this exact structure:
{
  "candidateName": "Full Name",
  "skills": ["Skill1", "Skill2"],
  "programmingLanguages": ["Language1"],
  "frameworks": ["Framework1"],
  "databases": ["Database1"],
  "tools": ["Tool1"],
  "projects": [
    {
      "name": "Project Title",
      "description": "Brief description",
      "technologies": ["Tech1", "Tech2"]
    }
  ],
  "experience": [
    {
      "role": "Role Title",
      "company": "Company Name",
      "duration": "Duration"
    }
  ],
  "education": [
    {
      "degree": "Degree Name",
      "institution": "University/College"
    }
  ],
  "certifications": ["Certification Name"]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { inlineData: { mimeType: "application/pdf", data: resumeBase64 } },
        { text: prompt }
      ],
      config: { responseMimeType: "application/json" }
    });

    const parsed = JSON.parse(response.text);
    return {
      candidateName: parsed.candidateName || studentData.name || "Candidate",
      skills: parsed.skills && parsed.skills.length > 0 ? parsed.skills : fallbackProfile.skills,
      programmingLanguages: parsed.programmingLanguages || [],
      frameworks: parsed.frameworks || [],
      databases: parsed.databases || [],
      tools: parsed.tools || [],
      projects: parsed.projects || [],
      experience: parsed.experience || [],
      education: parsed.education || [],
      certifications: parsed.certifications || []
    };
  } catch (err) {
    console.warn("Resume parsing fallback notice:", err.message);
    return fallbackProfile;
  }
}

/**
 * 2. Aptitude Round Generator
 * Independent from candidate resume. Uses DB bank or batched Gemini calls.
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
        order: idx + 1,
        section: "APTITUDE",
        type: "aptitude",
        category: "aptitude",
        question: aptQ.question,
        options: aptQ.options || ["A", "B", "C", "D"],
        correctAnswer: aptQ.correctAnswer || "",
        explanation: aptQ.explanation || "",
        topic: aptQ.category || "Quantitative & Logical",
        difficulty: aptQ.difficulty || "Medium"
      }));
      return questions;
    }
  } catch (err) {
    console.warn("Aptitude DB fetch warning:", err.message);
  }

  // Fallback / supplement via local question bank file
  const bankPicked = selectRandomQuestions({ count });
  if (bankPicked && bankPicked.length >= count) {
    return bankPicked.slice(0, count).map((aptQ, idx) => ({
      id: `APT-${String(idx + 1).padStart(2, "0")}`,
      questionId: aptQ.questionId || `APT-${String(idx + 1).padStart(2, "0")}`,
      order: idx + 1,
      section: "APTITUDE",
      type: "aptitude",
      category: "aptitude",
      question: aptQ.question,
      options: aptQ.options || ["A", "B", "C", "D"],
      correctAnswer: aptQ.correctAnswer || "",
      explanation: aptQ.explanation || "",
      topic: aptQ.category || "General Aptitude",
      difficulty: aptQ.difficulty || "Medium"
    }));
  }

  // Generate missing questions via batched Gemini requests (batches of 5)
  const BATCH_SIZE = 5;
  while (questions.length < count) {
    const need = Math.min(BATCH_SIZE, count - questions.length);
    try {
      const prompt = `Generate exactly ${need} quantitative aptitude and logical reasoning multiple-choice questions suitable for technical campus placement.
Return ONLY valid JSON in this exact structure:
{
  "questions": [
    {
      "question": "If a train 120m long passes a pole in 6 seconds, what is its speed in km/h?",
      "options": ["60 km/h", "72 km/h", "80 km/h", "90 km/h"],
      "correctAnswer": "72 km/h",
      "difficulty": "Medium",
      "topic": "Speed & Distance"
    }
  ]
}`;

      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ text: prompt }],
        config: { responseMimeType: "application/json" }
      });

      const parsed = JSON.parse(res.text);
      (parsed.questions || []).forEach((q) => {
        if (questions.length < count) {
          const idx = questions.length;
          questions.push({
            id: `APT-${String(idx + 1).padStart(2, "0")}`,
            questionId: `APT-${String(idx + 1).padStart(2, "0")}`,
            order: idx + 1,
            section: "APTITUDE",
            type: "aptitude",
            category: "aptitude",
            question: q.question,
            options: q.options || ["A", "B", "C", "D"],
            correctAnswer: q.correctAnswer || "",
            topic: q.topic || "Quantitative",
            difficulty: q.difficulty || "Medium"
          });
        }
      });
    } catch (gemErr) {
      console.warn("Aptitude Gemini batch error:", gemErr.message);
      break;
    }
  }

  // Final emergency top-up if still under count
  for (let idx = questions.length; idx < count; idx++) {
    questions.push({
      id: `APT-${String(idx + 1).padStart(2, "0")}`,
      questionId: `APT-${String(idx + 1).padStart(2, "0")}`,
      order: idx + 1,
      section: "APTITUDE",
      type: "aptitude",
      category: "aptitude",
      question: `Aptitude Question ${idx + 1}: If a worker completes a task in ${idx + 2} days, what fraction of work is done in 1 day?`,
      options: [`1/${idx + 2}`, `2/${idx + 2}`, `1/${idx + 4}`, `1/2`],
      correctAnswer: `1/${idx + 2}`,
      topic: "Work & Time",
      difficulty: idx % 3 === 0 ? "Hard" : "Medium"
    });
  }

  return questions;
}

/**
 * 3. Technical / Resume / Project Round Generator
 * Batched Gemini generation (5 batches of 5 questions = 25 questions).
 * MUST be derived strictly from candidateProfile. Never invents unmentioned tech.
 */
export async function generateTechnicalQuestions(candidateProfile, count = 25, existingQuestions = []) {
  const BATCH_SIZE = 5;
  const totalBatches = Math.ceil(count / BATCH_SIZE);
  let allQuestions = [...existingQuestions];

  const candidateSkills = [
    ...(candidateProfile.skills || []),
    ...(candidateProfile.programmingLanguages || []),
    ...(candidateProfile.frameworks || []),
    ...(candidateProfile.databases || []),
    ...(candidateProfile.tools || [])
  ];

  const uniqueSkills = [...new Set(candidateSkills)];

  const projectsSummary = (candidateProfile.projects || []).map(p =>
    `${p.name}: ${p.description || ""} (Tech: ${(p.technologies || []).join(", ")})`
  ).join("; ");

  for (let b = 0; b < totalBatches && allQuestions.length < count; b++) {
    const need = Math.min(BATCH_SIZE, count - allQuestions.length);
    const askedQuestionsText = allQuestions.map(q => q.question);

    const prompt = `You are the Technical Interview Question Generator for a professional AI-powered mock interview platform.
Your job is to generate technical interview questions for ONE candidate based strictly on the candidate's extracted resume profile.

Candidate Name: ${candidateProfile.candidateName || "Candidate"}
Verified Candidate Resume Skills & Technologies: ${uniqueSkills.length > 0 ? uniqueSkills.join(", ") : "Web Development, Data Structures, Database Design, React, Node.js"}
Verified Candidate Projects: ${projectsSummary || "Full-Stack Web Engineering Application"}

CRITICAL RULES:
1. Generate technical questions based ONLY on technologies, languages, frameworks, tools, databases, concepts, projects, and technical skills explicitly mentioned in the candidate's resume above.
2. NEVER invent technologies, cloud services, or tools not listed in the candidate's profile (e.g. Do NOT ask about AWS, Docker, Kubernetes, GraphQL, or Redis unless explicitly present in the resume).
3. The candidate is a student/fresher. Questions must be appropriate for a fresher placement technical interview.
4. Difficulty distribution across the 25 questions:
   - Easy (basic conceptual understanding)
   - Medium (practical usage & technology knowledge)
   - Medium+ (practical interview question requiring reasoning appropriate for a fresher)
5. Allowed questionType values: "Conceptual", "Practical", "Scenario", "Project", "Debugging", "Code-tracing".
6. Prioritize project-based questions if projects are listed in the resume (why tech was chosen, architecture, challenges faced, how APIs/DB worked).
7. Do NOT repeat or ask semantically duplicate questions compared to previously asked questions:
   PREVIOUSLY ASKED QUESTIONS: ${JSON.stringify(askedQuestionsText)}

Return ONLY valid JSON matching this exact structure:
{
  "questions": [
    {
      "topic": "Programming & OOP",
      "subtopic": "Inheritance",
      "difficulty": "Easy",
      "questionType": "Conceptual",
      "question": "What is the difference between method overloading and method overriding in Java?",
      "marks": 1,
      "aiSpeechText": "Can you explain the difference between method overloading and method overriding?"
    }
  ]
}`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ text: prompt }],
        config: { responseMimeType: "application/json" }
      });

      const parsed = JSON.parse(response.text);
      const newBatch = parsed.questions || [];

      newBatch.forEach(q => {
        if (allQuestions.length < count && q.question) {
          // Normalize and check against existing questions to avoid duplicates
          const normNew = q.question.toLowerCase().trim();
          const isDuplicate = allQuestions.some(existing => {
            const normExisting = existing.question.toLowerCase().trim();
            return normExisting === normNew || normExisting.includes(normNew) || normNew.includes(normExisting);
          });

          if (!isDuplicate) {
            const idx = allQuestions.length;
            allQuestions.push({
              id: `TECH-${String(idx + 1).padStart(2, "0")}`,
              questionId: `TECH-${String(idx + 1).padStart(2, "0")}`,
              order: 25 + idx + 1,
              section: "TECHNICAL",
              type: "technical",
              category: q.questionType === "Project" ? "resume" : "technical",
              source: "AI_GENERATED",
              question: q.question,
              topic: q.topic || "Technical Engineering",
              subtopic: q.subtopic || "Core Concepts",
              difficulty: q.difficulty || (idx < 8 ? "Easy" : idx < 20 ? "Medium" : "Medium+"),
              questionType: q.questionType || "Conceptual",
              marks: q.marks || 1,
              aiSpeechText: q.aiSpeechText || q.question
            });
          }
        }
      });
    } catch (err) {
      console.warn(`Technical batch ${b + 1} generation error:`, err.message);
    }
  }

  // Fallback top-up if Gemini returns fewer questions
  const defaultTopics = [
    { topic: "Programming & OOP", subtopic: "Fundamentals", questionType: "Conceptual" },
    { topic: "Project Architecture", subtopic: "API Routing", questionType: "Project" },
    { topic: "Database & SQL", subtopic: "Query Optimization", questionType: "Practical" },
    { topic: "State Management", subtopic: "Data Flow", questionType: "Conceptual" },
    { topic: "Debugging & Troubleshooting", subtopic: "Error Handling", questionType: "Debugging" },
    { topic: "System Integration", subtopic: "Middleware", questionType: "Scenario" }
  ];

  const primaryTech = uniqueSkills[0] || "Software Engineering";

  for (let idx = allQuestions.length; idx < count; idx++) {
    const meta = defaultTopics[idx % defaultTopics.length];
    const diff = idx < 8 ? "Easy" : idx < 20 ? "Medium" : "Medium+";
    allQuestions.push({
      id: `TECH-${String(idx + 1).padStart(2, "0")}`,
      questionId: `TECH-${String(idx + 1).padStart(2, "0")}`,
      order: 25 + idx + 1,
      section: "TECHNICAL",
      type: "technical",
      category: idx < 10 ? "resume" : "technical",
      source: "FALLBACK",
      question: `Regarding ${meta.topic} in your work with ${primaryTech}, how did you design and implement your solution?`,
      topic: meta.topic,
      subtopic: meta.subtopic,
      difficulty: diff,
      questionType: meta.questionType,
      marks: 1,
      aiSpeechText: `Let me ask about ${meta.topic}. In your work with ${primaryTech}, how did you approach this?`
    });
  }

  return allQuestions;
}

/**
 * 4. Coding Round Generator
 * 3 coding questions with progressive difficulty matching candidate's stack.
 */
export async function generateCodingQuestions(candidateProfile, count = 3) {
  // Try DB coding questions first
  try {
    let codingDb = await CodingQuestion.find({ isActive: true, isDeleted: false }).lean();
    if (codingDb && codingDb.length >= count) {
      return codingDb.slice(0, count).map((cq, idx) => ({
        id: `CODE-${String(idx + 1).padStart(2, "0")}`,
        questionId: cq.questionId || `CODE-${String(idx + 1).padStart(2, "0")}`,
        order: 50 + idx + 1,
        section: "CODING",
        type: "coding",
        category: "coding",
        title: cq.title || `Coding Challenge ${idx + 1}`,
        question: cq.problemStatement || cq.description || cq.title,
        problemStatement: cq.problemStatement || cq.description || cq.title,
        inputFormat: cq.inputFormat || "Standard Input",
        outputFormat: cq.outputFormat || "Standard Output",
        constraints: cq.constraints || "1 <= N <= 10^5",
        sampleInput: cq.sampleInput || "",
        sampleOutput: cq.sampleOutput || "",
        starterCode: cq.starterCode || "function solution() {\n  // Write your code here\n}",
        testCases: cq.testCases || [],
        difficulty: idx === 0 ? "Easy" : idx === 1 ? "Medium" : "Hard",
        topic: cq.category || "Algorithms"
      }));
    }
  } catch (err) {
    console.warn("Coding DB fetch warning:", err.message);
  }

  // Pre-configured progressive coding problems fallback
  const defaultCodingBank = [
    {
      questionId: "CODE-01",
      title: "Palindrome Verification",
      problemStatement: "Write a function to check whether a given string is a palindrome ignoring non-alphanumeric characters.",
      inputFormat: "A single string s",
      outputFormat: "Boolean (true or false)",
      constraints: "1 <= s.length <= 10^5",
      sampleInput: "\"A man, a plan, a canal: Panama\"",
      sampleOutput: "true",
      starterCode: "function solution(s) {\n  // Return true if palindrome, false otherwise\n}",
      difficulty: "Easy",
      testCases: [
        { input: "racecar", expected: "true", isHidden: false },
        { input: "hello", expected: "false", isHidden: true }
      ]
    },
    {
      questionId: "CODE-02",
      title: "Two Sum Target Indices",
      problemStatement: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
      inputFormat: "Array of integers and target number",
      outputFormat: "Array of two indices [i, j]",
      constraints: "2 <= nums.length <= 10^4",
      sampleInput: "[2, 7, 11, 15], target = 9",
      sampleOutput: "[0, 1]",
      starterCode: "function solution(nums, target) {\n  // Return [index1, index2]\n}",
      difficulty: "Medium",
      testCases: [
        { input: "[2,7,11,15], 9", expected: "[0,1]", isHidden: false },
        { input: "[3,2,4], 6", expected: "[1,2]", isHidden: true }
      ]
    },
    {
      questionId: "CODE-03",
      title: "Longest Non-Repeating Substring",
      problemStatement: "Given a string s, find the length of the longest substring without repeating characters.",
      inputFormat: "A single string s",
      outputFormat: "Integer length",
      constraints: "0 <= s.length <= 5 * 10^4",
      sampleInput: "\"abcabcbb\"",
      sampleOutput: "3",
      starterCode: "function solution(s) {\n  // Return max length integer\n}",
      difficulty: "Hard",
      testCases: [
        { input: "abcabcbb", expected: "3", isHidden: false },
        { input: "bbbbb", expected: "1", isHidden: true }
      ]
    }
  ];

  return defaultCodingBank.slice(0, count).map((cq, idx) => ({
    id: `CODE-${String(idx + 1).padStart(2, "0")}`,
    questionId: cq.questionId || `CODE-${String(idx + 1).padStart(2, "0")}`,
    order: 50 + idx + 1,
    section: "CODING",
    type: "coding",
    category: "coding",
    title: cq.title,
    question: cq.problemStatement,
    problemStatement: cq.problemStatement,
    inputFormat: cq.inputFormat,
    outputFormat: cq.outputFormat,
    constraints: cq.constraints,
    sampleInput: cq.sampleInput,
    sampleOutput: cq.sampleOutput,
    starterCode: cq.starterCode,
    testCases: cq.testCases,
    difficulty: cq.difficulty,
    topic: "Data Structures & Algorithms"
  }));
}

/**
 * 5. HR Round Generator
 * 5 conversational HR questions.
 */
export async function generateHRQuestions(candidateProfile, count = 5) {
  return DEFAULT_HR_BANK.slice(0, count).map((hrQ, idx) => ({
    id: `HR-${String(idx + 1).padStart(2, "0")}`,
    questionId: `HR-${String(idx + 1).padStart(2, "0")}`,
    order: 53 + idx + 1,
    section: "HR",
    type: "hr",
    category: "hr",
    question: hrQ.question,
    topic: hrQ.topic,
    difficulty: hrQ.difficulty,
    aiSpeechText: hrQ.aiSpeechText
  }));
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
