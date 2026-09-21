import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeQuestionText } from "../realInterview/questionHistoryService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BANK_FILE_PATH = path.join(__dirname, "../../data/fallbackTechnicalBank/technicalFallbackQuestions.json");

let cachedFallbackBank = null;

function loadFallbackBank() {
  if (cachedFallbackBank) return cachedFallbackBank;
  try {
    const raw = fs.readFileSync(BANK_FILE_PATH, "utf-8");
    cachedFallbackBank = JSON.parse(raw);
    return cachedFallbackBank;
  } catch (err) {
    console.error("[TechnicalFallback] Error loading technicalFallbackQuestions.json:", err.message);
    return [];
  }
}

/**
 * Resume-aware curated fallback question selector.
 * Used when AI batch generation fails for ANY number of missing question slots.
 * Supports full AI outage (all 20 questions missing) as well as small gaps.
 *
 * Selection Priority:
 * 1. Exact resume skill match (candidateProfile.skills, programmingLanguages, frameworks, databases, tools, cloud)
 * 2. Project technology match (technologies mentioned in candidateProfile.projects)
 * 3. Related technical domain match ("Core CS", "Data Structures", "System Design", "Backend", "Web Development")
 * 4. Excludes already-used question IDs and normalized question text
 * 5. Selects only the exact missing question slots
 */
export function resolveTechnicalFallbackQuestion({
  sessionId,
  userId = null,
  candidateProfile = {},
  existingQuestions = [],
  targetSlotIndex, // 0-indexed orderIndex (e.g. 19 for Q20)
  userHistorySet = new Set(),
  missingCount = 1,
  currentPoolSet = new Set(),
}) {
  const bank = loadFallbackBank();
  if (!bank || bank.length === 0) {
    console.warn("[TechnicalFallback] Fallback question bank is empty!");
    return null;
  }

  // Extract skills pool from candidate profile
  const resumeSkills = [
    ...(candidateProfile.skills || []),
    ...(candidateProfile.programmingLanguages || []),
    ...(candidateProfile.frameworks || []),
    ...(candidateProfile.databases || []),
    ...(candidateProfile.tools || []),
    ...(candidateProfile.cloud || []),
  ]
    .map((s) => String(s).trim())
    .filter(Boolean);

  const uniqueResumeSkills = Array.from(new Set(resumeSkills));

  // Extract technologies mentioned in projects
  const projectTechList = [];
  if (Array.isArray(candidateProfile.projects)) {
    candidateProfile.projects.forEach((p) => {
      if (typeof p === "string") projectTechList.push(p);
      else if (p && typeof p === "object") {
        if (p.technologies) projectTechList.push(...(Array.isArray(p.technologies) ? p.technologies : [p.technologies]));
        if (p.techStack) projectTechList.push(...(Array.isArray(p.techStack) ? p.techStack : [p.techStack]));
        if (p.description) projectTechList.push(p.description);
        if (p.name || p.title) projectTechList.push(p.name || p.title);
      }
    });
  }
  const projectTechStr = projectTechList.join(" ").toLowerCase();

  // Extract normalized text of existing questions in DB and userHistorySet
  const usedNormSet = new Set();
  existingQuestions.forEach((q) => {
    const norm = normalizeQuestionText(q.question);
    if (norm) usedNormSet.add(norm);
  });
  if (currentPoolSet) {
    currentPoolSet.forEach((norm) => usedNormSet.add(norm));
  }

  // Function to check if a question is already used or semantically duplicate
  const isQuestionUsed = (item) => {
    const norm = normalizeQuestionText(item.question);
    if (!norm) return true;
    if (usedNormSet.has(norm)) return true;

    // Check userHistorySet if available
    if (userHistorySet && userHistorySet.has && userHistorySet.has(norm)) {
      return true;
    }
    return false;
  };

  // Determine target difficulty and marks based on orderIndex
  // 0..5 (Q1..Q6): easy (3m) | 6..17 (Q7..Q18): medium (5m) | 18..19 (Q19..Q20): hard (13m)
  const targetDiff = targetSlotIndex <= 5 ? "easy" : targetSlotIndex <= 17 ? "medium" : "hard";
  const maxMarks = targetDiff === "easy" ? 3 : targetDiff === "hard" ? 13 : 5;

  let selectedCandidate = null;
  let matchedSkill = "";
  let matchType = "";

  // Priority 1: Exact Resume Skill Match
  for (const skill of uniqueResumeSkills) {
    const skillLower = skill.toLowerCase();
    const candidate = bank.find((item) => {
      if (isQuestionUsed(item)) return false;
      const tags = (item.skillTags || []).map((t) => t.toLowerCase());
      const topicLower = (item.topic || "").toLowerCase();
      return tags.includes(skillLower) || topicLower === skillLower || topicLower.includes(skillLower);
    });

    if (candidate) {
      selectedCandidate = candidate;
      matchedSkill = skill;
      matchType = "EXACT_RESUME_SKILL";
      break;
    }
  }

  // Priority 2: Project Technology Match
  if (!selectedCandidate && projectTechStr) {
    const candidate = bank.find((item) => {
      if (isQuestionUsed(item)) return false;
      const tags = (item.skillTags || []).map((t) => t.toLowerCase());
      const topicLower = (item.topic || "").toLowerCase();
      return tags.some((t) => projectTechStr.includes(t)) || (topicLower && projectTechStr.includes(topicLower));
    });

    if (candidate) {
      selectedCandidate = candidate;
      matchedSkill = candidate.topic || "Project Engineering";
      matchType = "PROJECT_TECH_MATCH";
    }
  }

  // Priority 3: Related Technical Domain Match
  if (!selectedCandidate) {
    const domainFallbackTags = ["Core CS", "Data Structures", "Algorithms", "System Design", "Web Development", "Database", "Backend"];
    const candidate = bank.find((item) => {
      if (isQuestionUsed(item)) return false;
      const tags = (item.skillTags || []).map((t) => t.toLowerCase());
      return domainFallbackTags.some((d) => tags.includes(d.toLowerCase()));
    });

    if (candidate) {
      selectedCandidate = candidate;
      matchedSkill = candidate.topic || "Core CS";
      matchType = "RELATED_TECHNICAL_DOMAIN";
    }
  }

  // Priority 4: Any unused question from bank
  if (!selectedCandidate) {
    const candidate = bank.find((item) => !isQuestionUsed(item));
    if (candidate) {
      selectedCandidate = candidate;
      matchedSkill = candidate.topic || "General CS";
      matchType = "GENERAL_BANK_FALLBACK";
    }
  }

  if (!selectedCandidate) {
    console.warn(`[TechnicalFallback] No unused fallback question found in bank for slot Q${targetSlotIndex + 1}!`);
    return null;
  }

  const missingQuestionNum = targetSlotIndex + 1;
  const chosenDifficulty = selectedCandidate.difficulty || targetDiff;
  const chosenMarks = chosenDifficulty === "easy" ? 3 : chosenDifficulty === "hard" ? 13 : 5;

  console.log(`\n[TechnicalFallback]\nmissingQuestion=${missingQuestionNum}\nmissingCount=${missingCount}\ncandidateSkills=${JSON.stringify(uniqueResumeSkills.slice(0, 10))}\nselectedSkill=${matchedSkill}\nselectedDifficulty=${chosenDifficulty}\nsource=CURATED_FALLBACK_BANK\nfallbackSaved=true\nmatchType=${matchType}\n`);

  return {
    sessionId,
    userId,
    orderIndex: targetSlotIndex,
    question: selectedCandidate.question,
    expectedKnowledge: selectedCandidate.expectedKnowledge,
    difficulty: chosenDifficulty,
    maxMarks: chosenMarks,
    topic: selectedCandidate.topic || matchedSkill,
    category: selectedCandidate.category || "Conceptual",
    source: "CURATED_FALLBACK_BANK",
    generationMethod: "CURATED_RESUME_MATCH",
    matchedSkill: matchedSkill,
    relatedSkill: matchedSkill,
    relatedProject: "",
    isFallback: true,
  };
}
