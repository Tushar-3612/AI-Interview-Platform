import { normalizeQuestionText } from "../realInterview/questionHistoryService.js";

/**
 * Curated HR Behavioral Fallback Question Bank
 * Used when AI generation fails for the HR round.
 * 20 high-quality behavioral & situational HR questions covering
 * all STAR dimensions and common hiring dimensions.
 */
const HR_FALLBACK_BANK = [
  {
    question: "Tell me about yourself and why you're interested in this role.",
    category: "Introduction",
    behavioralDimensions: ["selfAwareness", "communication"],
    difficulty: "easy",
    resumeReference: "General Introduction",
  },
  {
    question: "Describe a challenging project you worked on and how you handled the difficulties.",
    category: "Problem Solving",
    behavioralDimensions: ["problemSolving", "ownership"],
    difficulty: "medium",
    resumeReference: "Project Experience",
  },
  {
    question: "Tell me about a time you had to work under pressure to meet a tight deadline.",
    category: "Work Ethic",
    behavioralDimensions: ["stressManagement", "decisionMaking"],
    difficulty: "medium",
    resumeReference: "Work Experience",
  },
  {
    question: "Describe a situation where you had a conflict with a team member and how you resolved it.",
    category: "Teamwork",
    behavioralDimensions: ["conflictResolution", "interpersonal"],
    difficulty: "medium",
    resumeReference: "Team Collaboration",
  },
  {
    question: "What is your greatest professional achievement so far, and how did you accomplish it?",
    category: "Achievement",
    behavioralDimensions: ["ownership", "selfAwareness"],
    difficulty: "easy",
    resumeReference: "Achievements",
  },
  {
    question: "Describe a time when you had to learn a new technology or skill quickly. How did you approach it?",
    category: "Learning Agility",
    behavioralDimensions: ["adaptability", "selfDevelopment"],
    difficulty: "medium",
    resumeReference: "Technical Skills",
  },
  {
    question: "Tell me about a time you failed and what you learned from it.",
    category: "Growth Mindset",
    behavioralDimensions: ["selfAwareness", "resilience"],
    difficulty: "hard",
    resumeReference: "General Experience",
  },
  {
    question: "How do you prioritize tasks when you have multiple deadlines competing for your attention?",
    category: "Time Management",
    behavioralDimensions: ["decisionMaking", "planning"],
    difficulty: "easy",
    resumeReference: "Work Experience",
  },
  {
    question: "Describe a time when you took the initiative to improve a process or system without being asked.",
    category: "Initiative",
    behavioralDimensions: ["ownership", "innovation"],
    difficulty: "medium",
    resumeReference: "Work Experience",
  },
  {
    question: "Tell me about a time you had to convince someone to change their approach or point of view.",
    category: "Influence",
    behavioralDimensions: ["communication", "leadership"],
    difficulty: "hard",
    resumeReference: "Leadership Experience",
  },
  {
    question: "What are your short-term and long-term career goals, and how does this role align with them?",
    category: "Career Goals",
    behavioralDimensions: ["selfAwareness", "ambition"],
    difficulty: "easy",
    resumeReference: "Career Aspirations",
  },
  {
    question: "Describe a situation where you had to adapt to a significant change in your work environment.",
    category: "Adaptability",
    behavioralDimensions: ["adaptability", "resilience"],
    difficulty: "medium",
    resumeReference: "Work Experience",
  },
  {
    question: "Tell me about your experience working in a team. What role do you typically take on?",
    category: "Teamwork",
    behavioralDimensions: ["interpersonal", "leadership"],
    difficulty: "easy",
    resumeReference: "Team Collaboration",
  },
  {
    question: "Describe a time you received critical feedback. How did you respond and what did you change?",
    category: "Feedback Reception",
    behavioralDimensions: ["selfAwareness", "growth"],
    difficulty: "medium",
    resumeReference: "Work Experience",
  },
  {
    question: "How do you handle ambiguity and uncertainty in a project?",
    category: "Ambiguity",
    behavioralDimensions: ["decisionMaking", "adaptability"],
    difficulty: "hard",
    resumeReference: "Project Experience",
  },
  {
    question: "Tell me about a time when you went above and beyond your job responsibilities to help the team.",
    category: "Team Contribution",
    behavioralDimensions: ["ownership", "teamwork"],
    difficulty: "medium",
    resumeReference: "Work Experience",
  },
  {
    question: "What do you consider your biggest strength and how have you applied it in a professional setting?",
    category: "Strengths",
    behavioralDimensions: ["selfAwareness", "communication"],
    difficulty: "easy",
    resumeReference: "General Profile",
  },
  {
    question: "Describe a time when you had to make a difficult decision with incomplete information.",
    category: "Decision Making",
    behavioralDimensions: ["decisionMaking", "riskManagement"],
    difficulty: "hard",
    resumeReference: "Work Experience",
  },
  {
    question: "How do you stay updated with developments in your field and ensure continuous learning?",
    category: "Continuous Learning",
    behavioralDimensions: ["selfDevelopment", "adaptability"],
    difficulty: "easy",
    resumeReference: "Technical Skills",
  },
  {
    question: "Where do you see yourself in the next 3-5 years, and how does this company factor into those plans?",
    category: "Career Planning",
    behavioralDimensions: ["ambition", "selfAwareness"],
    difficulty: "medium",
    resumeReference: "Career Aspirations",
  },
];

/**
 * Selects 5 curated HR fallback questions that haven't been asked before.
 * Avoids duplicates from userHistorySet and existingQuestions.
 *
 * @param {object} options
 * @param {string} options.sessionId
 * @param {string|null} options.userId
 * @param {object} options.candidateProfile
 * @param {Array} options.existingQuestions - Questions already saved to DB
 * @param {Set} options.userHistorySet - Previously asked HR question texts
 * @param {number} options.neededCount - How many questions to return (default: 5)
 * @returns {Array} Array of up to neededCount HR question documents ready for saving
 */
export function resolveHRFallbackQuestions({
  sessionId,
  userId = null,
  candidateProfile = {},
  existingQuestions = [],
  userHistorySet = new Set(),
  neededCount = 5,
}) {
  // Build used set from existing DB questions + userHistorySet
  const usedNormSet = new Set();
  existingQuestions.forEach((q) => {
    const norm = normalizeQuestionText(q.question);
    if (norm) usedNormSet.add(norm);
  });
  if (userHistorySet && userHistorySet.forEach) {
    userHistorySet.forEach((norm) => usedNormSet.add(norm));
  }

  const isUsed = (item) => {
    const norm = normalizeQuestionText(item.question);
    return !norm || usedNormSet.has(norm);
  };

  // Determine existing slot indices to avoid overwriting
  const existingOrderIndices = new Set(existingQuestions.map((q) => q.orderIndex));
  const slotsNeeded = [];
  for (let i = 1; i <= 5; i++) {
    if (!existingOrderIndices.has(i)) slotsNeeded.push(i);
  }

  // Difficulty assignment for slots: 1-2 easy, 3-4 medium, 5 hard
  const difficultyForSlot = (slot) => {
    if (slot <= 2) return "easy";
    if (slot <= 4) return "medium";
    return "hard";
  };

  const selected = [];
  const availableBank = HR_FALLBACK_BANK.filter((item) => !isUsed(item));

  for (let idx = 0; idx < Math.min(slotsNeeded.length, neededCount); idx++) {
    const slot = slotsNeeded[idx];
    const targetDiff = difficultyForSlot(slot);

    // Try to find a matching difficulty question first, then any unused
    let chosen = availableBank.find(
      (item) => item.difficulty === targetDiff && !selected.includes(item)
    );
    if (!chosen) {
      chosen = availableBank.find((item) => !selected.includes(item));
    }

    if (chosen) {
      selected.push(chosen);
      selected[selected.length - 1]._assignedSlot = slot;
    }
  }

  if (selected.length === 0) {
    console.warn(`[HRFallback] No unused fallback questions available for session ${sessionId}`);
    return [];
  }

  console.log(
    `\n[HRFallback]\nsessionId=${sessionId}\nfallbackQuestionsSelected=${selected.length}\nslots=[${slotsNeeded.slice(0, selected.length).join(", ")}]\nsource=CURATED_HR_FALLBACK_BANK`
  );

  return selected.map((item, idx) => ({
    sessionId,
    userId,
    orderIndex: item._assignedSlot || slotsNeeded[idx],
    question: item.question,
    category: item.category || "Behavioral",
    difficulty: item.difficulty || "medium",
    maxMarks: 20,
    behavioralDimensions: item.behavioralDimensions || ["decisionMaking", "ownership"],
    resumeReference: item.resumeReference || "General Workplace Scenario",
    source: "CURATED_HR_FALLBACK_BANK",
    isFallback: true,
  }));
}
