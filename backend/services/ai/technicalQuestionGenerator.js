import { aiGenerateJSON } from "./aiClient.js";
import { buildTechnicalQuestionPrompt } from "./aiPrompts.js";
import { validateQuestionList } from "./aiResponseParser.js";

/**
 * Generates Technical questions strictly from the candidate profile.
 * Throws on AI failure so the caller can fall back to the local bank.
 */
export async function generateTechnicalQuestions(candidateProfile = {}, count = 20) {
  const prompt = buildTechnicalQuestionPrompt(candidateProfile, count);
  const data = await aiGenerateJSON(prompt, { temperature: 0.7 });
  const qs = validateQuestionList(data, { section: "technical", count });

  return qs.map((q, idx) => ({
    id: `TECH-AI-${String(idx + 1).padStart(2, "0")}`,
    questionId: `TECH-AI-${String(idx + 1).padStart(2, "0")}`,
    questionNumber: idx + 1,
    order: idx + 1,
    section: "TECHNICAL",
    type: "technical",
    questionType: q.topic ? "conceptual" : "conceptual",
    category: "technical",
    skill: q.topic || "Technical",
    topic: q.topic || "Technical",
    difficulty: q.difficulty,
    source: "ai_generated",
    aiSpeechText: q.question,
    question: q.question,
  }));
}
