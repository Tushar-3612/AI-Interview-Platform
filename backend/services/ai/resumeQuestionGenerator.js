import { aiGenerateJSON } from "./aiClient.js";
import { buildResumeQuestionPrompt } from "./aiPrompts.js";
import { validateQuestionList } from "./aiResponseParser.js";

/**
 * Generates Resume / Project questions strictly from the candidate profile.
 * Throws on AI failure so the caller can decide on a clearly-marked fallback.
 */
export async function generateResumeProjectQuestions(candidateProfile = {}, count = 10) {
  const prompt = buildResumeQuestionPrompt(candidateProfile, count);
  const data = await aiGenerateJSON(prompt, { temperature: 0.6 });
  const qs = validateQuestionList(data, { section: "resume_project", count });

  return qs.map((q, idx) => ({
    id: `RESUME-AI-${String(idx + 1).padStart(2, "0")}`,
    questionId: `RESUME-AI-${String(idx + 1).padStart(2, "0")}`,
    questionNumber: idx + 1,
    order: idx + 1,
    section: "RESUME_PROJECT",
    type: "resume_project",
    questionType: "resume_project",
    category: "resume_project",
    skill: q.topic || "Project",
    topic: q.topic || "Project",
    difficulty: q.difficulty,
    source: "ai_generated",
    aiSpeechText: q.question,
    question: q.question,
  }));
}
