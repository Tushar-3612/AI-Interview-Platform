import RealInterviewCodingQuestion from "../../models/RealInterviewCodingQuestion.js";
import RealInterviewCodingSession from "../../models/RealInterviewCodingSession.js";
import RealInterviewCodingSubmission from "../../models/RealInterviewCodingSubmission.js";
import { generateCodingAI } from "../realInterviewAI/codingAI.js";
import { executeJudge0TestSuite } from "../judge0Service.js";
import { withInFlightLock } from "./inFlightLock.js";
import {
  getUserQuestionHistorySet,
  recordUserQuestionHistory,
  filterUniqueQuestions,
} from "./questionHistoryService.js";

/**
 * Robust static fallback set of 3 DSA coding problems if AI API fails (e.g. HTTP 429 rate limit).
 */
const STATIC_FALLBACK_CODING_PROBLEMS = [
  {
    orderIndex: 1,
    title: "Two Sum Target Pair",
    description: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.",
    difficulty: "Easy",
    marks: 20,
    topic: "Arrays & HashMap",
    category: "Data Structures",
    constraints: ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9", "-10^9 <= target <= 10^9"],
    examples: [
      { input: "[2,7,11,15]\n9", output: "[0,1]", explanation: "nums[0] + nums[1] == 2 + 7 == 9" },
      { input: "[3,2,4]\n6", output: "[1,2]", explanation: "nums[1] + nums[2] == 2 + 4 == 6" }
    ],
    functionSignature: "twoSum(nums, target)",
    starterCode: {
      python: "def two_sum(nums, target):\n    # Write your solution here\n    pass",
      javascript: "function twoSum(nums, target) {\n    // Write your solution here\n}",
      java: "import java.util.*;\n\npublic class Main {\n    public static int[] twoSum(int[] nums, int target) {\n        // Write your solution here\n        return new int[]{};\n    }\n}",
      cpp: "#include <vector>\nusing namespace std;\n\nvector<int> twoSum(vector<int>& nums, int target) {\n    // Write your solution here\n    return {};\n}"
    },
    visibleTestCases: [
      { input: "[2,7,11,15]\n9", expected: "[0,1]", isHidden: false },
      { input: "[3,2,4]\n6", expected: "[1,2]", isHidden: false }
    ],
    hiddenTestCases: [
      { input: "[3,3]\n6", expected: "[0,1]", isHidden: true },
      { input: "[1,5,9,12]\n14", expected: "[1,2]", isHidden: true },
      { input: "[-1,-3,5,9]\n6", expected: "[1,3]", isHidden: true }
    ]
  },
  {
    orderIndex: 2,
    title: "Longest Substring Without Repeating Characters",
    description: "Given a string `s`, find the length of the longest substring without repeating characters.",
    difficulty: "Medium",
    marks: 30,
    topic: "Sliding Window & HashSet",
    category: "Algorithms",
    constraints: ["0 <= s.length <= 5 * 10^4", "s consists of English letters, digits, symbols and spaces."],
    examples: [
      { input: "\"abcabcbb\"", output: "3", explanation: "The answer is \"abc\", with the length of 3." },
      { input: "\"bbbbb\"", output: "1", explanation: "The answer is \"b\", with the length of 1." }
    ],
    functionSignature: "lengthOfLongestSubstring(s)",
    starterCode: {
      python: "def length_of_longest_substring(s):\n    # Write your solution here\n    pass",
      javascript: "function lengthOfLongestSubstring(s) {\n    // Write your solution here\n}",
      java: "import java.util.*;\n\npublic class Main {\n    public static int lengthOfLongestSubstring(String s) {\n        // Write your solution here\n        return 0;\n    }\n}",
      cpp: "#include <string>\n#include <unordered_set>\nusing namespace std;\n\nint lengthOfLongestSubstring(string s) {\n    // Write your solution here\n    return 0;\n}"
    },
    visibleTestCases: [
      { input: "\"abcabcbb\"", expected: "3", isHidden: false },
      { input: "\"bbbbb\"", expected: "1", isHidden: false }
    ],
    hiddenTestCases: [
      { input: "\"pwwkew\"", expected: "3", isHidden: true },
      { input: "\"\"", expected: "0", isHidden: true },
      { input: "\"au\"", expected: "2", isHidden: true }
    ]
  },
  {
    orderIndex: 3,
    title: "Subarray Product Less Than K",
    description: "Given an array of integers `nums` and an integer `k`, return the number of contiguous subarrays where the product of all the elements in the subarray is strictly less than `k`.",
    difficulty: "Hard",
    marks: 50,
    topic: "Two Pointers & Sliding Window",
    category: "Advanced Algorithms",
    constraints: ["1 <= nums.length <= 3 * 10^4", "1 <= nums[i] <= 1000", "0 <= k <= 10^6"],
    examples: [
      { input: "[10,5,2,6]\n100", output: "8", explanation: "The 8 subarrays that have product less than 100 are: [10], [5], [2], [6], [10, 5], [5, 2], [2, 6], [5, 2, 6]." }
    ],
    functionSignature: "numSubarrayProductLessThanK(nums, k)",
    starterCode: {
      python: "def num_subarray_product_less_than_k(nums, k):\n    # Write your solution here\n    pass",
      javascript: "function numSubarrayProductLessThanK(nums, k) {\n    // Write your solution here\n}",
      java: "public class Main {\n    public static int numSubarrayProductLessThanK(int[] nums, int k) {\n        // Write your solution here\n        return 0;\n    }\n}",
      cpp: "#include <vector>\nusing namespace std;\n\nint numSubarrayProductLessThanK(vector<int>& nums, int k) {\n    // Write your solution here\n    return 0;\n}"
    },
    visibleTestCases: [
      { input: "[10,5,2,6]\n100", expected: "8", isHidden: false }
    ],
    hiddenTestCases: [
      { input: "[1,2,3]\n0", expected: "0", isHidden: true },
      { input: "[1,1,1]\n2", expected: "6", isHidden: true },
      { input: "[10,2,2,5,4]\n50", expected: "10", isHidden: true }
    ]
  },
  {
    orderIndex: 1,
    title: "Valid Anagram String Check",
    description: "Given two strings `s` and `t`, return `true` if `t` is an anagram of `s`, and `false` otherwise.",
    difficulty: "Easy",
    marks: 20,
    topic: "Strings & Frequency Map",
    category: "Data Structures",
    constraints: ["1 <= s.length, t.length <= 5 * 10^4", "s and t consist of lowercase English letters."],
    examples: [
      { input: "\"anagram\"\n\"nagaram\"", output: "true", explanation: "t is an anagram of s." }
    ],
    functionSignature: "isAnagram(s, t)",
    starterCode: {
      python: "def is_anagram(s, t):\n    # Write your solution here\n    pass",
      javascript: "function isAnagram(s, t) {\n    // Write your solution here\n}",
      java: "public class Main {\n    public static boolean isAnagram(String s, String t) {\n        return false;\n    }\n}",
      cpp: "#include <string>\nusing namespace std;\n\nbool isAnagram(string s, string t) {\n    return false;\n}"
    },
    visibleTestCases: [
      { input: "\"anagram\"\n\"nagaram\"", expected: "true", isHidden: false }
    ],
    hiddenTestCases: [
      { input: "\"rat\"\n\"car\"", expected: "false", isHidden: true }
    ]
  },
  {
    orderIndex: 2,
    title: "Container With Most Water",
    description: "Given `n` non-negative integers `height` where each represents a point at coordinate `(i, height[i])`, find two lines that together with the x-axis form a container containing the most water.",
    difficulty: "Medium",
    marks: 30,
    topic: "Two Pointers & Greedy",
    category: "Algorithms",
    constraints: ["n == height.length", "2 <= n <= 10^5", "0 <= height[i] <= 10^4"],
    examples: [
      { input: "[1,8,6,2,5,4,8,3,7]", output: "49", explanation: "The max area is 49." }
    ],
    functionSignature: "maxArea(height)",
    starterCode: {
      python: "def max_area(height):\n    # Write your solution here\n    pass",
      javascript: "function maxArea(height) {\n    // Write your solution here\n}",
      java: "public class Main {\n    public static int maxArea(int[] height) {\n        return 0;\n    }\n}",
      cpp: "#include <vector>\nusing namespace std;\n\nint maxArea(vector<int>& height) {\n    return 0;\n}"
    },
    visibleTestCases: [
      { input: "[1,8,6,2,5,4,8,3,7]", expected: "49", isHidden: false }
    ],
    hiddenTestCases: [
      { input: "[1,1]", expected: "1", isHidden: true }
    ]
  },
  {
    orderIndex: 3,
    title: "Merge K Sorted Linked Lists",
    description: "You are given an array of `k` linked-lists lists, each linked-list is sorted in ascending order. Merge all the linked-lists into one sorted linked-list and return it.",
    difficulty: "Hard",
    marks: 50,
    topic: "Min Heap & Divide and Conquer",
    category: "Advanced Data Structures",
    constraints: ["k == lists.length", "0 <= k <= 10^4", "0 <= lists[i].length <= 500"],
    examples: [
      { input: "[[1,4,5],[1,3,4],[2,6]]", output: "[1,1,2,3,4,4,5,6]", explanation: "The merged sorted list is [1,1,2,3,4,4,5,6]." }
    ],
    functionSignature: "mergeKLists(lists)",
    starterCode: {
      python: "def merge_k_lists(lists):\n    # Write your solution here\n    pass",
      javascript: "function mergeKLists(lists) {\n    // Write your solution here\n}",
      java: "public class Main {\n    public static int[] mergeKLists(int[][] lists) {\n        return new int[]{};\n    }\n}",
      cpp: "#include <vector>\nusing namespace std;\n\nvector<int> mergeKLists(vector<vector<int>>& lists) {\n    return {};\n}"
    },
    visibleTestCases: [
      { input: "[[1,4,5],[1,3,4],[2,6]]", expected: "[1,1,2,3,4,4,5,6]", isHidden: false }
    ],
    hiddenTestCases: [
      { input: "[]", expected: "[]", isHidden: true }
    ]
  },
  {
    orderIndex: 1,
    title: "Best Time to Buy and Sell Stock",
    description: "You are given an array `prices` where `prices[i]` is the price of a given stock on the `i-th` day. You want to maximize your profit by choosing a single day to buy one stock and choosing a different day in the future to sell that stock. Return the maximum profit you can achieve from this transaction.",
    difficulty: "Easy",
    marks: 20,
    topic: "Arrays & Dynamic Programming",
    category: "Algorithms",
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^4"],
    examples: [
      { input: "[7,1,5,3,6,4]", output: "5", explanation: "Buy on day 2 (price = 1) and sell on day 5 (price = 6), profit = 6 - 1 = 5." }
    ],
    functionSignature: "maxProfit(prices)",
    starterCode: {
      python: "def max_profit(prices):\n    # Write your solution here\n    pass",
      javascript: "function maxProfit(prices) {\n    // Write your solution here\n}",
      java: "public class Main {\n    public static int maxProfit(int[] prices) {\n        return 0;\n    }\n}",
      cpp: "#include <vector>\nusing namespace std;\n\nint maxProfit(vector<int>& prices) {\n    return 0;\n}"
    },
    visibleTestCases: [
      { input: "[7,1,5,3,6,4]", expected: "5", isHidden: false }
    ],
    hiddenTestCases: [
      { input: "[7,6,4,3,1]", expected: "0", isHidden: true }
    ]
  },
  {
    orderIndex: 2,
    title: "Three Sum Zero Triplets",
    description: "Given an integer array `nums`, return all the triplets `[nums[i], nums[j], nums[k]]` such that `i != j`, `i != k`, and `j != k`, and `nums[i] + nums[j] + nums[k] == 0`. Notice that the solution set must not contain duplicate triplets.",
    difficulty: "Medium",
    marks: 30,
    topic: "Two Pointers & Sorting",
    category: "Algorithms",
    constraints: ["3 <= nums.length <= 3000", "-10^5 <= nums[i] <= 10^5"],
    examples: [
      { input: "[-1,0,1,2,-1,-4]", output: "[[-1,-1,2],[-1,0,1]]", explanation: "Distinct triplets summing to 0." }
    ],
    functionSignature: "threeSum(nums)",
    starterCode: {
      python: "def three_sum(nums):\n    # Write your solution here\n    pass",
      javascript: "function threeSum(nums) {\n    // Write your solution here\n}",
      java: "public class Main {\n    public static int[][] threeSum(int[] nums) {\n        return new int[][]{};\n    }\n}",
      cpp: "#include <vector>\nusing namespace std;\n\nvector<vector<int>> threeSum(vector<int>& nums) {\n    return {};\n}"
    },
    visibleTestCases: [
      { input: "[-1,0,1,2,-1,-4]", expected: "[[-1,-1,2],[-1,0,1]]", isHidden: false }
    ],
    hiddenTestCases: [
      { input: "[0,1,1]", expected: "[]", isHidden: true },
      { input: "[0,0,0]", expected: "[[0,0,0]]", isHidden: true }
    ]
  },
  {
    orderIndex: 3,
    title: "Trapping Rain Water Traversal",
    description: "Given `n` non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.",
    difficulty: "Hard",
    marks: 50,
    topic: "Two Pointers & Monotonic Stack",
    category: "Advanced Algorithms",
    constraints: ["n == height.length", "1 <= n <= 2 * 10^4", "0 <= height[i] <= 10^5"],
    examples: [
      { input: "[0,1,0,2,1,0,1,3,2,1,2,1]", output: "6", explanation: "The total trapped water volume is 6 units." }
    ],
    functionSignature: "trap(height)",
    starterCode: {
      python: "def trap(height):\n    # Write your solution here\n    pass",
      javascript: "function trap(height) {\n    // Write your solution here\n}",
      java: "public class Main {\n    public static int trap(int[] height) {\n        return 0;\n    }\n}",
      cpp: "#include <vector>\nusing namespace std;\n\nint trap(vector<int>& height) {\n    return 0;\n}"
    },
    visibleTestCases: [
      { input: "[0,1,0,2,1,0,1,3,2,1,2,1]", expected: "6", isHidden: false }
    ],
    hiddenTestCases: [
      { input: "[4,2,0,3,2,5]", expected: "9", isHidden: true }
    ]
  }
];

/**
 * 1. Generate & Process Coding Questions (AI CALL #1)
 * Enforces EXACTLY 3 problems: Q1 (20m), Q2 (30m), Q3 (50m) = 100 total marks.
 * Enforces maximum 1 AI generation call per session.
 */
export async function generateAndProcessCodingQuestions({ userId = null, sessionId, candidateProfile = {} }) {
  if (!sessionId) {
    throw new Error("sessionId is required to generate Coding problems.");
  }

  const lockKey = `coding:${sessionId}`;
  return withInFlightLock(lockKey, async () => {
    let session = await RealInterviewCodingSession.findOne({ sessionId });

  if (session && (session.generationStatus === "GENERATED" || session.aiGenerationCalls >= 1)) {
    const existingQuestions = await RealInterviewCodingQuestion.find({ sessionId }).sort({ orderIndex: 1 });
    if (existingQuestions.length === 3) {
      console.log(`[CodingService] Session ${sessionId} already generated (3 problems, aiGenerationCalls: ${session.aiGenerationCalls}). Reusing existing questions.`);
      return {
        success: true,
        sessionId,
        questions: sanitizeQuestionsForClient(existingQuestions),
        reused: true,
        aiGenerationCalls: session.aiGenerationCalls,
      };
    }
  }

  if (!session) {
    session = new RealInterviewCodingSession({
      sessionId,
      userId,
      candidateProfile,
      generationStatus: "GENERATING",
    });
  } else {
    session.generationStatus = "GENERATING";
  }

  session.aiGenerationCalls += 1;
  await session.save();

  console.log(`[CodingService] Making AI CALL #1 for session ${sessionId}...`);

  let problemsData = [];
  let fallbackUsed = false;
  const userHistorySet = await getUserQuestionHistorySet(userId);

  try {
    const res = await generateCodingAI({ candidateProfile, count: 3 });
    if (res && Array.isArray(res)) {
      problemsData = filterUniqueQuestions(res, userHistorySet);
    }
  } catch (err) {
    console.warn(`[CodingService] AI generation call failed (${err.message}). Checking unique fallback pool.`);
  }

  if (problemsData.length < 3) {
    const currentCodingSet = new Set(problemsData.map(p => (p.title || "").toLowerCase().trim()));
    const fallbackUnique = filterUniqueQuestions(STATIC_FALLBACK_CODING_PROBLEMS, userHistorySet);
    for (const fbP of fallbackUnique) {
      if (problemsData.length >= 3) break;
      const norm = (fbP.title || "").toLowerCase().trim();
      currentCodingSet.add(norm);
      problemsData.push(fbP);
    }
    if (problemsData.length < 3) {
      for (const fbP of STATIC_FALLBACK_CODING_PROBLEMS) {
        if (problemsData.length >= 3) break;
        const norm = (fbP.title || "").toLowerCase().trim();
        if (!currentCodingSet.has(norm)) {
          currentCodingSet.add(norm);
          problemsData.push(fbP);
        }
      }
    }
    fallbackUsed = true;
  }

  const expectedMarks = [20, 30, 50];
  const expectedDifficulties = ["Easy", "Medium", "Hard"];

  await RealInterviewCodingQuestion.deleteMany({ sessionId });

  const createdQuestions = [];
  const problemScores = [];

  for (let i = 0; i < 3; i++) {
    const rawP = problemsData[i] || STATIC_FALLBACK_CODING_PROBLEMS[i];
    const maxMarks = expectedMarks[i];

    const qDoc = new RealInterviewCodingQuestion({
      sessionId,
      userId,
      orderIndex: i + 1,
      title: rawP.title || `Problem #${i + 1}`,
      description: rawP.description || rawP.problemStatement || "",
      difficulty: expectedDifficulties[i],
      marks: maxMarks,
      topic: rawP.topic || "DSA",
      category: rawP.category || "Algorithmic Problem Solving",
      constraints: rawP.constraints || [],
      examples: rawP.examples || [],
      starterCode: rawP.starterCode || {},
      functionSignature: rawP.functionSignature || "",
      supportedLanguages: ["python", "javascript", "java", "cpp"],
      visibleTestCases: rawP.visibleTestCases || [],
      hiddenTestCases: rawP.hiddenTestCases || [],
      source: fallbackUsed ? "static_fallback" : "ai_generated",
    });

    const saved = await qDoc.save();
    createdQuestions.push(saved);

    problemScores.push({
      questionId: saved._id,
      orderIndex: i + 1,
      title: saved.title,
      difficulty: saved.difficulty,
      maxMarks,
      score: 0,
      status: "Not Attempted",
      passedTests: 0,
      totalTests: (saved.visibleTestCases.length + saved.hiddenTestCases.length),
    });
  }

  session.generationStatus = "GENERATED";
  session.fallbackUsed = fallbackUsed;
  session.problemScores = problemScores;
  await session.save();

  if (userId && createdQuestions.length > 0) {
    await recordUserQuestionHistory({
      userId,
      sessionId,
      round: "coding",
      questions: createdQuestions.map((q) => ({
        id: q._id,
        question: `${q.title} - ${q.description}`.trim(),
      })),
    });
  }

  return {
    success: true,
    sessionId,
    count: createdQuestions.length,
    questions: sanitizeQuestionsForClient(createdQuestions),
    reused: false,
    fallbackUsed,
    aiGenerationCalls: session.aiGenerationCalls,
  };
 });
}

/**
 * Security helper: Remove hiddenTestCases before sending question data to client
 */
function sanitizeQuestionsForClient(questions) {
  return questions.map((q) => {
    const qObj = q.toObject ? q.toObject() : { ...q };
    delete qObj.hiddenTestCases;
    return qObj;
  });
}

/**
 * 2. Get Coding Questions for Session (ZERO AI CALLS)
 * Strips hiddenTestCases so candidates cannot see hidden inputs/outputs.
 */
export async function getCodingQuestions({ sessionId }) {
  if (!sessionId) {
    throw new Error("sessionId parameter is required.");
  }

  const session = await RealInterviewCodingSession.findOne({ sessionId });
  if (!session) {
    throw new Error(`Coding Session not found for ID: ${sessionId}`);
  }

  const questions = await RealInterviewCodingQuestion.find({ sessionId }).sort({ orderIndex: 1 });
  return {
    success: true,
    sessionId,
    questions: sanitizeQuestionsForClient(questions),
    problemScores: session.problemScores,
  };
}

/**
 * 3. Run Code (ZERO AI CALLS)
 * Executes candidate's code against VISIBLE test cases ONLY via Judge0.
 */
export async function runCodingCode({ sessionId, questionId, language, sourceCode }) {
  if (!sessionId || !questionId || !language || !sourceCode) {
    throw new Error("sessionId, questionId, language, and sourceCode are required to run code.");
  }

  const qDoc = await RealInterviewCodingQuestion.findById(questionId);
  if (!qDoc) {
    throw new Error(`Coding Question not found for ID: ${questionId}`);
  }

  const visibleCases = qDoc.visibleTestCases || [];
  if (visibleCases.length === 0) {
    return {
      success: true,
      status: "No test cases configured",
      passed: 0,
      total: 0,
      testResults: [],
    };
  }

  console.log(`[CodingService] Running code for Q#${qDoc.orderIndex} against ${visibleCases.length} visible test cases (0 AI Calls)...`);

  const execResult = await executeJudge0TestSuite({
    sourceCode,
    language,
    testCases: visibleCases,
  });

  return {
    success: true,
    sessionId,
    questionId,
    language,
    status: execResult.status === "completed" ? "Passed" : execResult.statusDescription || execResult.status,
    passed: execResult.passed,
    total: execResult.total,
    executionTime: execResult.executionTime,
    memory: execResult.memory,
    compileOutput: execResult.compileOutput,
    testResults: execResult.testResults,
  };
}

/**
 * 4. Submit Code (ZERO AI CALLS)
 * Executes candidate's code against ALL test cases (visible + hidden) via Judge0.
 * Backend strictly computes problem score ($20, 30$, or $50$) and updates session totalScore.
 */
export async function submitCodingCode({ sessionId, questionId, language, sourceCode, userId = null }) {
  if (!sessionId || !questionId || !language || !sourceCode) {
    throw new Error("sessionId, questionId, language, and sourceCode are required to submit code.");
  }

  const session = await RealInterviewCodingSession.findOne({ sessionId });
  if (!session) {
    throw new Error(`Coding Session not found for ID: ${sessionId}`);
  }

  const qDoc = await RealInterviewCodingQuestion.findById(questionId);
  if (!qDoc) {
    throw new Error(`Coding Question not found for ID: ${questionId}`);
  }

  const allCases = [...(qDoc.visibleTestCases || []), ...(qDoc.hiddenTestCases || [])];
  console.log(`[CodingService] Submitting code for Q#${qDoc.orderIndex} (${qDoc.marks} marks) against ${allCases.length} test cases (0 AI Calls)...`);

  const execResult = await executeJudge0TestSuite({
    sourceCode,
    language,
    testCases: allCases,
  });

  const totalTests = allCases.length;
  const passedTests = execResult.passed;
  const maxMarks = qDoc.marks; // 20, 30, or 50

  let score = 0;
  let statusStr = "Wrong Answer";

  if (execResult.status === "compile_error") {
    statusStr = "Compilation Error";
    score = 0;
  } else if (passedTests === totalTests && totalTests > 0) {
    statusStr = "Accepted";
    score = maxMarks;
  } else if (passedTests > 0) {
    statusStr = "Partial";
    score = Math.floor((passedTests / totalTests) * maxMarks);
  } else {
    statusStr = "Wrong Answer";
    score = 0;
  }

  // Save submission doc
  const submission = new RealInterviewCodingSubmission({
    sessionId,
    questionId: qDoc._id,
    userId: userId || session.userId,
    language,
    sourceCode,
    status: statusStr,
    passedTests,
    totalTests,
    score,
    maxMarks,
    executionTime: execResult.executionTime,
    memory: execResult.memory,
    compileOutput: execResult.compileOutput,
    testResults: execResult.testResults,
  });
  await submission.save();

  // Update session problem score
  const pScoreIdx = session.problemScores.findIndex((ps) => String(ps.questionId) === String(qDoc._id));
  if (pScoreIdx >= 0) {
    session.problemScores[pScoreIdx].score = score;
    session.problemScores[pScoreIdx].status = statusStr;
    session.problemScores[pScoreIdx].passedTests = passedTests;
    session.problemScores[pScoreIdx].totalTests = totalTests;
    session.problemScores[pScoreIdx].lastLanguage = language;
  } else {
    session.problemScores.push({
      questionId: qDoc._id,
      orderIndex: qDoc.orderIndex,
      title: qDoc.title,
      difficulty: qDoc.difficulty,
      maxMarks,
      score,
      status: statusStr,
      passedTests,
      totalTests,
      lastLanguage: language,
    });
  }

  // Recompute total session score
  let totalScore = 0;
  session.problemScores.forEach((ps) => {
    totalScore += ps.score || 0;
  });

  const maxScore = 100;
  const percentage = Math.round((totalScore / maxScore) * 100);

  session.totalScore = totalScore;
  session.maxScore = maxScore;
  session.percentage = percentage;
  session.overallRating = percentage >= 80 ? "Exceptional" : percentage >= 60 ? "Strong" : percentage >= 40 ? "Average" : "Needs Improvement";
  await session.save();

  // Strip hidden testcase inputs/outputs from client response
  const sanitizedTestResults = (execResult.testResults || []).map((tr) => ({
    index: tr.index,
    passed: tr.passed,
    isHidden: tr.isHidden,
    input: tr.isHidden ? "" : tr.input,
    expected: tr.isHidden ? "" : tr.expected,
    actual: tr.isHidden ? "" : tr.actual,
    error: tr.error,
    status: tr.status,
    timeMs: tr.timeMs,
  }));

  return {
    success: true,
    sessionId,
    questionId: qDoc._id,
    status: statusStr,
    passedTests,
    totalTests,
    score,
    maxMarks,
    sessionTotalScore: totalScore,
    sessionPercentage: percentage,
    executionTime: execResult.executionTime,
    memory: execResult.memory,
    compileOutput: execResult.compileOutput,
    testResults: sanitizedTestResults,
  };
}

/**
 * 5. Evaluate / Result for Coding Session (ZERO AI CALLS)
 * Summarizes the 3 coding problems and final backend score out of 100.
 */
export async function evaluateCodingInterviewSession({ sessionId }) {
  if (!sessionId) {
    throw new Error("sessionId parameter is required for evaluation.");
  }

  const session = await RealInterviewCodingSession.findOne({ sessionId });
  if (!session) {
    throw new Error(`Coding Session not found for ID: ${sessionId}`);
  }

  const questions = await RealInterviewCodingQuestion.find({ sessionId }).sort({ orderIndex: 1 });

  let totalScore = 0;
  const problemResults = [];

  for (let i = 0; i < questions.length; i++) {
    const qDoc = questions[i];
    const pScore = session.problemScores.find((ps) => String(ps.questionId) === String(qDoc._id));

    const maxMarks = qDoc.marks; // 20, 30, 50
    const score = pScore ? pScore.score : 0;
    const status = pScore ? pScore.status : "Not Attempted";

    totalScore += score;

    problemResults.push({
      orderIndex: qDoc.orderIndex,
      questionId: qDoc._id,
      title: qDoc.title,
      difficulty: qDoc.difficulty,
      topic: qDoc.topic,
      maxMarks,
      score,
      status,
      passedTests: pScore ? pScore.passedTests : 0,
      totalTests: pScore ? pScore.totalTests : (qDoc.visibleTestCases.length + qDoc.hiddenTestCases.length),
    });
  }

  const maxScore = 100;
  const percentage = Math.round((totalScore / maxScore) * 100);
  const overallRating = percentage >= 80 ? "Exceptional" : percentage >= 60 ? "Strong" : percentage >= 40 ? "Average" : "Needs Improvement";

  session.totalScore = totalScore;
  session.maxScore = maxScore;
  session.percentage = percentage;
  session.overallRating = overallRating;
  session.status = "completed";
  session.evaluationCompleted = true;
  await session.save();

  return {
    success: true,
    sessionId,
    totalScore,
    maxScore,
    percentage,
    overallRating,
    problems: problemResults,
    fallbackUsed: session.fallbackUsed,
    aiGenerationCalls: session.aiGenerationCalls,
  };
}
