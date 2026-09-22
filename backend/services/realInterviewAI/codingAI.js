import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../.env") });

import { AIGateway } from "../aiReliability/index.js";

function getCodingConfig(attempt = 1) {
  const keys = [
    process.env.REAL_INTERVIEW_CODING_API_KEY,
    process.env.AI_API_KEY,
    process.env.MOCK_INTERVIEW_API_KEY,
    process.env.REAL_INTERVIEW_TECHNICAL_API_KEY,
    process.env.REAL_INTERVIEW_PROJECT_API_KEY,
    process.env.REAL_INTERVIEW_APTITUDE_API_KEY,
  ].map((k) => (k || "").trim()).filter(Boolean);
  const uniqueKeys = Array.from(new Set(keys));
  const apiKey = uniqueKeys[(attempt - 1) % uniqueKeys.length] || uniqueKeys[0] || "";
  let custom = (process.env.REAL_INTERVIEW_CODING_MODEL || "").trim();
  let model = custom || (attempt === 1 ? "openai/gpt-oss-120b" : "openai/gpt-oss-20b");
  return { apiKey, model };
}

/**
 * Generates EXACTLY ONE DSA Coding Problem per AI request.
 */
export async function generateSingleCodingAI({
  orderIndex = 1,
  difficulty = "EASY",
  marks = 20,
  candidateProfile = {},
  userHistorySet = new Set(),
  attempt = 1,
  options = {}
}) {
  console.log(`\n[REAL-INTERVIEW][AI-CALL]\nround=coding\noperation=generation_single\norderIndex=${orderIndex}\ndifficulty=${difficulty}\nattempt=${attempt}`);

  const { apiKey: configApiKey, model: configModel } = getCodingConfig(attempt);
  const activeApiKey = options.apiKey || configApiKey;
  const activeModel = options.model || configModel;

  const targetDifficulty = String(difficulty).toUpperCase();
  const normalizedDifficultyLabel = targetDifficulty === "HARD" ? "Hard" : (targetDifficulty === "MEDIUM" ? "Medium" : "Easy");

  const profileSummary = `Candidate Skills: ${JSON.stringify(candidateProfile.skills || candidateProfile.technicalSkills || ["Data Structures", "Algorithms"])}`;

  const excludedList = Array.from(userHistorySet).slice(0, 20);
  const exclusionText = excludedList.length > 0
    ? `Do NOT generate any of these previously asked topics/titles:\n${excludedList.map(q => `- ${q}`).join("\n")}\n`
    : "";

  let promptInstruction = "";
  if (attempt === 1) {
    promptInstruction = `Generate EXACTLY 1 DSA coding problem of ${targetDifficulty} difficulty.`;
  } else if (attempt === 2) {
    promptInstruction = `CRITICAL: Return ONLY valid compact JSON. No markdown wrapping. Keep description under 150 words. Generate EXACTLY 1 DSA coding problem of ${targetDifficulty} difficulty.`;
  } else {
    promptInstruction = `ULTRA-COMPACT MODE: Return the smallest valid JSON satisfying all fields. Generate 1 DSA coding problem of ${targetDifficulty} difficulty.`;
  }

  const systemPrompt = `You are a Lead Software Engineer generating a single LeetCode-style coding interview problem.
Return ONLY a raw JSON object with NO markdown formatting, NO extra text.

REQUIRED JSON SCHEMA:
{
  "title": "String",
  "description": "Concise problem statement",
  "difficulty": "${targetDifficulty}",
  "constraints": ["Constraint 1", "Constraint 2"],
  "inputFormat": "Input format description",
  "outputFormat": "Output format description",
  "examples": [
    {
      "input": "Sample input string",
      "output": "Sample output string",
      "explanation": "Brief explanation"
    }
  ],
  "testCases": [
    { "input": "input1", "expectedOutput": "output1" },
    { "input": "input2", "expectedOutput": "output2" },
    { "input": "input3", "expectedOutput": "output3" }
  ],
  "starterCode": {
    "javascript": "function solution() {\\n  // Write code here\\n}",
    "python": "def solution():\\n    pass",
    "java": "public class Main {\\n    public static void main(String[] args) {}\\n}",
    "cpp": "#include <iostream>\\nusing namespace std;\\nint main() { return 0; }"
  }
}`;

  const userPrompt = `${profileSummary}\n${exclusionText}\nTarget OrderIndex: ${orderIndex}, Difficulty: ${targetDifficulty}, Marks: ${marks}.\n${promptInstruction}`;

  const parsed = await AIGateway.execute({
    prompt: userPrompt,
    systemPrompt,
    provider: options.provider || "groq",
    apiKey: activeApiKey,
    sessionId: options.sessionId,
    roundType: "coding",
    orderIndex,
    options: {
      model: activeModel,
      temperature: 0.1,
      maxRetries: 2
    }
  });

  const p = parsed.question || parsed.problem || parsed.data || parsed;

  if (!p || !p.title || !p.description) {
    throw new Error(`Single coding AI response missing required title or description`);
  }

  // Normalize test cases format
  const rawTestCases = Array.isArray(p.testCases) ? p.testCases : (Array.isArray(p.visibleTestCases) ? p.visibleTestCases : []);
  if (rawTestCases.length === 0) {
    throw new Error(`Single coding AI response missing testCases`);
  }

  const visibleTestCases = rawTestCases.slice(0, 2).map((tc, idx) => ({
    input: typeof tc.input === "object" ? JSON.stringify(tc.input) : String(tc.input ?? ""),
    expected: typeof (tc.expectedOutput ?? tc.expected) === "object" ? JSON.stringify(tc.expectedOutput ?? tc.expected) : String(tc.expectedOutput ?? tc.expected ?? ""),
    isHidden: false
  }));

  const hiddenTestCases = (rawTestCases.length > 2 ? rawTestCases.slice(2) : [
    { input: "hidden_test_1", expectedOutput: "expected_1" },
    { input: "hidden_test_2", expectedOutput: "expected_2" },
    { input: "hidden_test_3", expectedOutput: "expected_3" }
  ]).map((tc, idx) => ({
    input: typeof tc.input === "object" ? JSON.stringify(tc.input) : String(tc.input ?? ""),
    expected: typeof (tc.expectedOutput ?? tc.expected) === "object" ? JSON.stringify(tc.expectedOutput ?? tc.expected) : String(tc.expectedOutput ?? tc.expected ?? ""),
    isHidden: true
  }));

  const formattedProblem = {
    orderIndex,
    title: String(p.title).trim(),
    description: String(p.description).trim(),
    difficulty: normalizedDifficultyLabel,
    marks,
    topic: p.topic || (orderIndex === 1 ? "Arrays & Strings" : orderIndex === 2 ? "Two Pointers / Stack" : "Trees / DP"),
    category: p.category || "Algorithmic Problem Solving",
    constraints: Array.isArray(p.constraints) ? p.constraints.map(String) : [String(p.constraints || "1 <= N <= 10^5")],
    inputFormat: String(p.inputFormat || "Standard input"),
    outputFormat: String(p.outputFormat || "Standard output"),
    examples: Array.isArray(p.examples) ? p.examples.map(ex => ({
      input: String(ex.input ?? ""),
      output: String(ex.output ?? ""),
      explanation: String(ex.explanation ?? "")
    })) : [],
    starterCode: typeof p.starterCode === "object" && p.starterCode !== null ? p.starterCode : {
      python: String(p.starterCode || "def solution():\n    pass"),
      javascript: String(p.starterCode || "function solution() {\n}"),
      java: "public class Main {\n    public static void main(String[] args) {}\n}",
      cpp: "#include <iostream>\nusing namespace std;\nint main() { return 0; }"
    },
    functionSignature: p.functionSignature || "solution()",
    supportedLanguages: ["python", "javascript", "java", "cpp"],
    visibleTestCases,
    hiddenTestCases,
    source: "AI_GENERATED",
    generationMethod: "SINGLE_AI_REQUEST",
    isFallback: false
  };

  console.log(`[RealInterviewAI][Coding] Generated single coding question for orderIndex=${orderIndex} title="${formattedProblem.title}"`);
  return formattedProblem;
}

/**
 * Backward-compatible wrapper for generating coding questions.
 */
export async function generateCodingAI({ candidateProfile = {}, userHistorySet = new Set(), count = 3, options = {} }) {
  console.log("\n[REAL-INTERVIEW][AI-CALL]\nround=coding\noperation=batch_generation_wrapper");
  const slots = [
    { orderIndex: 1, difficulty: "EASY", marks: 20 },
    { orderIndex: 2, difficulty: "MEDIUM", marks: 30 },
    { orderIndex: 3, difficulty: "HARD", marks: 50 },
  ];

  const results = [];
  for (const slot of slots.slice(0, count)) {
    const q = await generateSingleCodingAI({
      ...slot,
      candidateProfile,
      userHistorySet,
      options
    });
    results.push(q);
  }
  return results;
}
