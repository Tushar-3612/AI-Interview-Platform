import { aiGenerateJSON } from "./aiClient.js";
import { buildCodingQuestionPrompt } from "./aiPrompts.js";
import { validateCodingProblems } from "./aiResponseParser.js";

/**
 * Generates Coding problems via AI. The PROBLEM is AI-generated; the existing
 * compiler + test-case runner executes and evaluates the candidate's code.
 *
 * Validation (constraints / examples / test cases / expected outputs) is enforced.
 * On malformed response, the caller retries once; if still invalid, the caller
 * must NOT persist the problem (no dummy questions).
 */
export async function generateCodingQuestions(candidateProfile = {}, count = 3) {
  const prompt = buildCodingQuestionPrompt(candidateProfile, count);
  let data;
  try {
    data = await aiGenerateJSON(prompt, { temperature: 0.6 });
    const problems = validateCodingProblems(data, count);
    return problems.map((pr, idx) => normalizeCodingProblem(pr, idx));
  } catch (firstErr) {
    // Retry once with a stricter instruction.
    const strictPrompt = `${prompt}\n\nIMPORTANT: Your previous response was invalid. Every problem MUST include 'constraints', at least one 'examples' entry, and a 'testCases' array where each item has both 'input' and 'expected'. Return ONLY valid JSON.`;
    const data2 = await aiGenerateJSON(strictPrompt, { temperature: 0.4 });
    const problems = validateCodingProblems(data2, count);
    return problems.map((pr, idx) => normalizeCodingProblem(pr, idx));
  }
}

function normalizeCodingProblem(pr, idx) {
  const sample = pr.examples?.[0] || pr.testCases?.[0] || {};
  return {
    id: `CODE-AI-${String(idx + 1).padStart(2, "0")}`,
    questionId: `CODE-AI-${String(idx + 1).padStart(2, "0")}`,
    questionNumber: idx + 1,
    order: idx + 1,
    section: "CODING",
    type: "coding",
    questionType: "coding",
    category: "coding",
    skill: pr.topic || "Data Structures & Algorithms",
    title: pr.title,
    topic: pr.topic || "Algorithms",
    question: pr.description,
    problemStatement: pr.description,
    description: pr.description,
    inputFormat: pr.inputFormat,
    outputFormat: pr.outputFormat,
    constraints: pr.constraints,
    examples: pr.examples || [],
    sampleInput: sample.input != null ? String(sample.input) : "",
    sampleOutput: sample.expected != null ? String(sample.expected) : sample.output != null ? String(sample.output) : "",
    expectedComplexity: "",
    testCases: (pr.testCases || []).map((tc) => ({
      input: String(tc.input ?? ""),
      expected: String(tc.expected ?? tc.output ?? ""),
      isHidden: false,
    })),
    expectedApproach: pr.expectedApproach || "",
    difficulty: pr.difficulty,
    source: "ai_generated",
    aiSpeechText: pr.description,
    starterCode: "",
  };
}
