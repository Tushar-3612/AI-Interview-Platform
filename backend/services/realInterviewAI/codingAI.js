import fetch from "node-fetch";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-120b";

/**
 * Returns Coding AI config strictly from process.env.REAL_INTERVIEW_CODING_API_KEY.
 * DO NOT fallback to GROQ_API_KEY or other round keys.
 */
function getCodingConfig() {
  const apiKey = process.env.REAL_INTERVIEW_CODING_API_KEY;
  if (!apiKey) {
    throw new Error(
      "REAL_INTERVIEW_CODING_API_KEY is missing in process.env. Please add it to your root .env file."
    );
  }
  const model = process.env.REAL_INTERVIEW_CODING_MODEL || DEFAULT_MODEL;
  const baseUrl = process.env.REAL_INTERVIEW_CODING_BASE_URL || GROQ_BASE_URL;
  return { apiKey, model, baseUrl };
}

/**
 * Clean AI Markdown output to get pure JSON text
 */
function cleanJsonResponse(rawText) {
  if (!rawText) return "";
  let text = rawText.trim();
  if (text.startsWith("```json")) {
    text = text.replace(/^```json\s*/, "").replace(/```$/, "").trim();
  } else if (text.startsWith("```")) {
    text = text.replace(/^```\s*/, "").replace(/```$/, "").trim();
  }
  return text;
}

/**
 * AI CALL #1: Generate EXACTLY 3 DSA Coding Problems in ONE AI request (Attempt 1).
 */
export async function generateCodingAI({ candidateProfile = {}, count = 3 }) {
  console.log("\n[REAL-INTERVIEW][AI-CALL]\nround=coding\noperation=generation\nattempt=1");
  const { apiKey, model, baseUrl } = getCodingConfig();

  const profileSummary = `
- Full Name: ${candidateProfile.fullName || candidateProfile.name || "Candidate"}
- Key Skills: ${JSON.stringify(candidateProfile.skills || candidateProfile.technicalSkills || ["Data Structures", "Algorithms"])}
`;

  const systemPrompt = `You are a Principal Software Engineer & Technical Hiring Lead conducting a real LeetCode-style placement coding interview.
Your task is to generate EXACTLY 3 distinct, high-quality Data Structures & Algorithms coding problems in ONE single JSON request.

CRITICAL ARCHITECTURAL RULES:
1. TOTAL PROBLEMS: EXACTLY 3. NO MORE, NO LESS.
2. DIFFICULTY & MARKS BREAKDOWN:
   - Problem 1: Easy, EXACTLY 20 MARKS (e.g. Arrays, Strings, HashMap/HashSet)
   - Problem 2: Medium, EXACTLY 30 MARKS (e.g. Two Pointers, Sliding Window, Stack/Queue, Binary Search)
   - Problem 3: Medium/Hard, EXACTLY 50 MARKS (e.g. Trees, Graphs, Dynamic Programming, Backtracking)
   - TOTAL MARKS = 100 (20 + 30 + 50).
3. STARTER CODE: Provide problem-specific starter code for ALL 4 languages ("python", "javascript", "java", "cpp"). The function signatures MUST match the problem requirements exactly.
4. TEST CASES: Provide 2 visible sample test cases and at least 3 hidden test cases per problem. Input and expected outputs MUST be clean strings that can be passed directly to standard input/output.
5. NO TRIVIAL OR AMBIGUOUS PROBLEMS: Generate realistic interview-relevant DSA problems. Input, output, examples, and starter code MUST be 100% consistent.

RETURN STRICT JSON ONLY formatted as:
{
  "problems": [
    {
      "orderIndex": 1,
      "title": "Two Sum Variations / Subarray Target",
      "description": "Given an array of integers nums and an integer target...",
      "difficulty": "Easy",
      "marks": 20,
      "topic": "Arrays & HashMap",
      "category": "Data Structures",
      "constraints": ["1 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9"],
      "examples": [
        { "input": "[2,7,11,15]\\n9", "output": "[0,1]", "explanation": "nums[0] + nums[1] == 9" }
      ],
      "functionSignature": "twoSum(nums, target)",
      "starterCode": {
        "python": "def two_sum(nums, target):\n    # Write your code here\n    pass",
        "javascript": "function twoSum(nums, target) {\n    // Write your code here\n}",
        "java": "import java.util.*;\n\npublic class Main {\n    public static int[] twoSum(int[] nums, int target) {\n        // Write your code here\n        return new int[]{};\n    }\n}",
        "cpp": "#include <vector>\nusing namespace std;\n\nvector<int> twoSum(vector<int>& nums, int target) {\n    // Write your code here\n    return {};\n}"
      },
      "visibleTestCases": [
        { "input": "[2,7,11,15]\\n9", "expected": "[0,1]", "isHidden": false },
        { "input": "[3,2,4]\\n6", "expected": "[1,2]", "isHidden": false }
      ],
      "hiddenTestCases": [
        { "input": "[3,3]\\n6", "expected": "[0,1]", "isHidden": true },
        { "input": "[1,5,9,12]\\n14", "expected": "[1,2]", "isHidden": true },
        { "input": "[-1,-3,5,9]\\n6", "expected": "[1,3]", "isHidden": true }
      ]
    },
    ... (Problem 2 with 30 marks, Problem 3 with 50 marks)
  ]
}`;

  const userPrompt = `Candidate Profile:\n${profileSummary}\n\nGenerate EXACTLY 3 DSA coding problems (20m, 30m, 50m) in valid JSON.`;

  console.log("\n[REAL-INTERVIEW][CODING-CONTEXT]");
  console.log(`technical profile actually sent to AI: ${profileSummary.trim()}\n`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  let response;
  try {
    response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_completion_tokens: 4500,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err?.name === "AbortError") {
      throw new Error("Coding AI request timed out");
    }
    console.error("[RealInterviewAI][Coding] Fetch error:", err.message);
    throw new Error(`Failed to connect to Coding AI provider: ${err.message}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[RealInterviewAI][Coding] Generation HTTP Error: ${response.status}`, errorText);
    throw new Error(`Coding generation AI request failed with status ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;
  const cleaned = cleanJsonResponse(rawContent);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("[RealInterviewAI][Coding] JSON Parse error during generation:", err.message);
    throw new Error("Failed to parse AI response into valid Coding problems JSON");
  }

  const problems = parsed.problems || parsed.data || parsed;
  if (!Array.isArray(problems) || problems.length === 0) {
    throw new Error("AI returned invalid or empty problems array");
  }

  // Enforce exactly 3 problems with 20, 30, 50 marks mapping
  const expectedMarks = [20, 30, 50];
  const expectedDifficulties = ["Easy", "Medium", "Hard"];

  const formattedProblems = problems.slice(0, 3).map((p, idx) => ({
    orderIndex: idx + 1,
    title: p.title || `Coding Problem #${idx + 1}`,
    description: p.description || p.problemStatement || "Solve the algorithmic problem according to specified constraints.",
    difficulty: expectedDifficulties[idx],
    marks: expectedMarks[idx],
    topic: p.topic || (idx === 0 ? "Arrays & Strings" : idx === 1 ? "Two Pointers / Stack" : "Trees / DP"),
    category: p.category || "Algorithmic Problem Solving",
    constraints: Array.isArray(p.constraints) ? p.constraints : [p.constraints || "1 <= N <= 10^5"],
    examples: Array.isArray(p.examples) ? p.examples : [],
    starterCode: typeof p.starterCode === "object" ? p.starterCode : {
      python: p.starterCode || "def solution():\n    pass",
      javascript: p.starterCode || "function solution() {\n}",
      java: "public class Main {\n    public static void main(String[] args) {}\n}",
      cpp: "int main() { return 0; }"
    },
    functionSignature: p.functionSignature || "solution()",
    supportedLanguages: ["python", "javascript", "java", "cpp"],
    visibleTestCases: Array.isArray(p.visibleTestCases) ? p.visibleTestCases.map(tc => ({
      input: String(tc.input ?? tc.inputData ?? tc.sampleInput ?? ""),
      expected: String(tc.expected ?? tc.output ?? tc.expectedOutput ?? tc.sampleOutput ?? ""),
      isHidden: false,
    })) : [],
    hiddenTestCases: Array.isArray(p.hiddenTestCases) ? p.hiddenTestCases.map(tc => ({
      input: String(tc.input ?? tc.inputData ?? tc.sampleInput ?? ""),
      expected: String(tc.expected ?? tc.output ?? tc.expectedOutput ?? tc.sampleOutput ?? ""),
      isHidden: true,
    })) : [],
  }));

  console.log(`[RealInterviewAI][Coding] Generated ${formattedProblems.length} problems successfully`);
  return formattedProblems;
}

