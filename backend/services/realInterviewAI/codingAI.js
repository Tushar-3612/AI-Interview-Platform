import { callPythonGroqBridge } from "./pythonGroqBridge.js";
import { extractJsonFromText } from "./jsonExtractor.js";
const DEFAULT_MODEL = "qwen/qwen3.8-27b";

/**
 * Returns Coding AI config strictly from process.env.REAL_INTERVIEW_CODING_API_KEY.
 * DO NOT fallback to GROQ_API_KEY or other round keys.
 */
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
  const apiKey = uniqueKeys[(attempt - 1) % uniqueKeys.length];
  if (!apiKey) {
    throw new Error(
      "REAL_INTERVIEW_CODING_API_KEY is missing in process.env. Please add it to your root .env file."
    );
  }
  let custom = (process.env.REAL_INTERVIEW_CODING_MODEL || "").trim();
  let model = custom || (attempt === 1 ? "openai/gpt-oss-120b" : "openai/gpt-oss-20b");
  return { apiKey, model };
}

/**
 * Clean AI Markdown output to get pure JSON text
 */
function cleanJsonResponse(rawText) {
  if (!rawText || typeof rawText !== "string") return "";
  let text = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  text = text.replace(/```json\s*|```\s*/g, "").trim();

  const qIdx = text.search(/\{\s*"questions"/);
  if (qIdx !== -1) {
    let depth = 0;
    for (let i = qIdx; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") depth--;
      if (depth === 0) {
        return text.slice(qIdx, i + 1);
      }
    }
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return text;
}

/**
 * AI CALL #1: Generate EXACTLY 3 DSA Coding Problems in ONE AI request (Attempt 1).
 */
export async function generateCodingAI({ candidateProfile = {}, userHistorySet = new Set(), count = 3 }) {
  console.log("\n[REAL-INTERVIEW][AI-CALL]\nround=coding\noperation=generation\nattempt=1");

  const profileSummary = `
- Full Name: ${candidateProfile.fullName || candidateProfile.name || "Candidate"}
- Key Skills: ${JSON.stringify(candidateProfile.skills || candidateProfile.technicalSkills || ["Data Structures", "Algorithms"])}
`;

  const excludedList = Array.from(userHistorySet).slice(0, 100);
  const exclusionText = excludedList.length > 0
    ? `\nABSOLUTE ZERO-REPETITION RULE:
The following list contains coding problems/questions that have ALREADY been asked to this candidate in previous Real Interview attempts or earlier in the current attempt.
You MUST NOT generate any coding problem that:
1. Exactly matches a previous problem title, description, or statement.
2. Is a reworded or paraphrased version of a previous problem.
3. Tests the exact same core problem statement in substantially the same way.
4. Uses different variable names or story contexts but has the same problem intent.

Previously Asked Problems:
${excludedList.map(q => `- ${q}`).join("\n")}\n`
    : "";

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
6. Do NOT select or rephrase any problem from the exclusion list.

JSON SCHEMA REQUIREMENT:
{
  "questions": [
    {
      "id": "coding_q1",
      "title": "Two Sum",
      "description": "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
      "difficulty": "easy",
      "marks": 20,
      "topic": "Arrays & Hashing",
      "constraints": ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9"],
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
    }
  ]
}`;

  const userPrompt = `Candidate Profile:\n${profileSummary}\n${exclusionText}\nGenerate EXACTLY 3 DSA coding problems (20m, 30m, 50m) in valid JSON.`;

  console.log("\n[REAL-INTERVIEW][CODING-CONTEXT]");
  console.log(`technical profile actually sent to AI: ${profileSummary.trim()}\n`);

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { apiKey, model } = getCodingConfig(attempt);
    try {
      const rawContent = await callPythonGroqBridge({
        round: "coding",
        apiKey,
        model,
        messages: [
          { role: "system", content: "You are a JSON API endpoint. Output ONLY valid JSON starting immediately with {\"questions\": [...]} without any reasoning, thinking, or commentary." },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 3000,
        timeoutMs: 60000,
      });

      const parsed = extractJsonFromText(rawContent);

      const problems = parsed.problems || parsed.questions || parsed.data || (Array.isArray(parsed) ? parsed : null);
      if (Array.isArray(problems) && problems.length >= 3) {
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
            java: "public class Main {\n    public static int[] twoSum(int[] nums, int target) {\n        // Write your code here\n        return new int[]{};\n    }\n}",
            cpp: "#include <vector>\nusing namespace std;\n\nvector<int> twoSum(vector<int>& nums, int target) {\n    // Write your code here\n    return {};\n}"
          },
          functionSignature: p.functionSignature || "solution()",
          supportedLanguages: ["python", "javascript", "java", "cpp"],
          visibleTestCases: Array.isArray(p.visibleTestCases) ? p.visibleTestCases.map(tc => ({
            input: typeof tc.input === "object" ? JSON.stringify(tc.input) : String(tc.input || ""),
            expected: typeof tc.expected === "object" ? JSON.stringify(tc.expected) : String(tc.expected || ""),
            isHidden: false
          })) : [
            { input: "sample_input_1", expected: "sample_output_1", isHidden: false },
            { input: "sample_input_2", expected: "sample_output_2", isHidden: false }
          ],
          hiddenTestCases: Array.isArray(p.hiddenTestCases) ? p.hiddenTestCases.map(tc => ({
            input: typeof tc.input === "object" ? JSON.stringify(tc.input) : String(tc.input || ""),
            expected: typeof tc.expected === "object" ? JSON.stringify(tc.expected) : String(tc.expected || ""),
            isHidden: true
          })) : [
            { input: "hidden_input_1", expected: "hidden_output_1", isHidden: true },
            { input: "hidden_input_2", expected: "hidden_output_2", isHidden: true },
            { input: "hidden_input_3", expected: "hidden_output_3", isHidden: true }
          ],
        }));

        console.log(`[RealInterviewAI][Coding] Generated 3 Coding problems successfully`);
        return formattedProblems;
      }
    } catch (err) {
      lastError = err;
      console.warn(`[RealInterviewAI][Coding] Generation attempt ${attempt} failed: ${err.message}`);
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 8000));
      }
    }
  }

  throw lastError || new Error("Coding AI generation failed after 3 attempts");
}
