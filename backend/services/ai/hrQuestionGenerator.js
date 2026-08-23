import { aiGenerateJSON } from "./aiClient.js";
import { buildHRQuestionPrompt } from "./aiPrompts.js";
import { validateQuestionList } from "./aiResponseParser.js";

/**
 * Generates HR / behavioral questions personalized to the candidate profile.
 * Throws on AI failure so the caller can fall back to the local HR bank.
 */
export async function generateHRQuestions(candidateProfile = {}, count = 5) {
  const prompt = buildHRQuestionPrompt(candidateProfile, count);
  const data = await aiGenerateJSON(prompt, { temperature: 0.7 });
  const qs = validateQuestionList(data, { section: "hr", count });

  return qs.map((q, idx) => ({
    id: `HR-AI-${String(idx + 1).padStart(2, "0")}`,
    questionId: `HR-AI-${String(idx + 1).padStart(2, "0")}`,
    questionNumber: idx + 1,
    order: idx + 1,
    section: "HR",
    type: "hr",
    questionType: "behavioral",
    category: "hr",
    skill: q.topic || "Behavioral",
    topic: q.topic || "Behavioral",
    difficulty: q.difficulty,
    source: "ai_generated",
    aiSpeechText: q.question,
    question: q.question,
  }));
}
