/**
 * Mock data for the AI Interview Room
 */

export const MOCK_QUESTIONS = [
  {
    id: 1,
    category: "Technical",
    difficulty: "Medium",
    question: "Explain the difference between a process and a thread. When would you prefer multithreading over multiprocessing?",
    estimatedTime: "3:00",
    suggestedBulletPoints: [
      "Process has independent memory space; thread shares memory with other threads in the same process.",
      "Threads are lightweight, fast context switches; processes are heavy.",
      "Use multithreading for I/O-bound tasks; use multiprocessing for CPU-bound tasks."
    ],
    mockFeedback: [
      { text: "Good explanation of memory allocation", status: "success" },
      { text: "Identified I/O-bound vs CPU-bound correctly", status: "success" },
      { text: "Could elaborate more on race conditions and locks", status: "warning" }
    ],
    aiSpeechText: "Great! Let's start with a foundational operating systems question. Can you explain the difference between a process and a thread? And when would you prefer multithreading over multiprocessing?",
    defaultCode: null
  },
  {
    id: 2,
    category: "HR",
    difficulty: "Easy",
    question: "Tell me about a time you had to resolve a conflict within a project team. What was your approach, and what was the outcome?",
    estimatedTime: "2:30",
    suggestedBulletPoints: [
      "Explain the context (team size, goals, conflict origin).",
      "Explain the actions taken (active listening, finding common ground, compromise).",
      "Mention the positive outcome (project completed on time, improved team cohesion)."
    ],
    mockFeedback: [
      { text: "Uses STAR method structure effectively", status: "success" },
      { text: "Demonstrated high empathy and active listening", status: "success" }
    ],
    aiSpeechText: "Conflict resolution is crucial in collaborative environments. Tell me about a time you had to resolve a conflict within a project team. What was your approach, and what was the outcome?",
    defaultCode: null
  },
  {
    id: 3,
    category: "Coding",
    difficulty: "Hard",
    question: "Implement a function to find the longest palindromic substring in a given string. Optimize the solution.",
    estimatedTime: "5:00",
    suggestedBulletPoints: [
      "Brute force is O(N^3).",
      "Expand around center approach runs in O(N^2) time and O(1) space.",
      "Manacher's Algorithm can achieve O(N) but is complex to implement."
    ],
    mockFeedback: [
      { text: "Excellent choice of Expand-Around-Center technique", status: "success" },
      { text: "Understands time and space complexity trade-offs", status: "success" },
      { text: "Ensure boundary checks are clean", status: "warning" }
    ],
    aiSpeechText: "Now let's move to a coding problem. I've enabled the editor for you. Please implement a function to find the longest palindromic substring in a given string and optimize its complexity.",
    codeQuestion: {
      description: "Write a function `longestPalindrome(s)` that returns the longest palindromic substring in `s`.\n\nInput: s = \"babad\"\nOutput: \"bab\" (Note: \"aba\" is also a valid answer).\n\nInput: s = \"cbbd\"\nOutput: \"bb\"",
      templates: {
        javascript: `function longestPalindrome(s) {\n  // Write your JavaScript code here\n  if (!s || s.length < 1) return "";\n  let start = 0, end = 0;\n  \n  function expandAroundCenter(left, right) {\n    while (left >= 0 && right < s.length && s[left] === s[right]) {\n      left--;\n      right++;\n    }\n    return right - left - 1;\n  }\n  \n  for (let i = 0; i < s.length; i++) {\n    let len1 = expandAroundCenter(i, i);\n    let len2 = expandAroundCenter(i, i + 1);\n    let len = Math.max(len1, len2);\n    if (len > end - start) {\n      start = i - Math.floor((len - 1) / 2);\n      end = i + Math.floor(len / 2);\n    }\n  }\n  \n  return s.substring(start, end + 1);\n}`,
        python: `def longest_palindrome(s: str) -> str:\n    # Write your Python code here\n    if not s or len(s) < 1:\n        return ""\n    start, end = 0, 0\n    \n    def expand_around_center(left: int, right: int) -> int:\n        while left >= 0 and right < len(s) and s[left] == s[right]:\n            left -= 1\n            right += 1\n        return right - left - 1\n        \n    for i in range(len(s)):\n        len1 = expand_around_center(i, i)\n        len2 = expand_around_center(i, i + 1)\n        length = max(len1, len2)\n        if length > end - start:\n            start = i - (length - 1) // 2\n            end = i + length // 2\n            \n    return s[start:end + 1]`,
        cpp: `#include <string>\n#include <algorithm>\nusing namespace std;\n\nstring longestPalindrome(string s) {\n    // Write your C++ code here\n    if (s.empty()) return "";\n    int start = 0, end = 0;\n    auto expandAroundCenter = [&](int left, int right) {\n        while (left >= 0 && right < s.length() && s[left] == s[right]) {\n            left--;\n            right++;\n        }\n        return right - left - 1;\n    };\n    \n    for (int i = 0; i < s.length(); i++) {\n        int len1 = expandAroundCenter(i, i);\n        int len2 = expandAroundCenter(i, i + 1);\n        int len = max(len1, len2);\n        if (len > end - start) {\n            start = i - (len - 1) / 2;\n            end = i + len / 2;\n        }\n    }\n    return s.substr(start, end - start + 1);\n}`,
        java: `class Solution {\n    public String longestPalindrome(String s) {\n        // Write your Java code here\n        if (s == null || s.length() < 1) return "";\n        int start = 0, end = 0;\n        for (int i = 0; i < s.length(); i++) {\n            int len1 = expandAroundCenter(s, i, i);\n            int len2 = expandAroundCenter(s, i, i + 1);\n            int len = Math.max(len1, len2);\n            if (len > end - start) {\n                start = i - (len - 1) / 2;\n                end = i + len / 2;\n            }\n        }\n        return s.substring(start, end + 1);\n    }\n    \n    private int expandAroundCenter(String s, int left, int right) {\n        while (left >= 0 && right < s.length() && s.charAt(left) == s.charAt(right)) {\n            left--;\n            right++;\n        }\n        return right - left - 1;\n    }\n}`
      }
    }
  },
  {
    id: 4,
    category: "Technical",
    difficulty: "Medium",
    question: "What is database normalization? Compare 1NF, 2NF, and 3NF, and explain transitive dependency.",
    estimatedTime: "3:30",
    suggestedBulletPoints: [
      "Normalization reduces data redundancy and anomalies.",
      "1NF: Atomic columns (no repeating groups).",
      "2NF: In 1NF + no partial key dependencies (all non-key attributes fully dependent on primary key).",
      "3NF: In 2NF + no transitive dependencies (non-prime attributes shouldn't depend on other non-prime attributes)."
    ],
    mockFeedback: [
      { text: "Correct explanation of normal forms", status: "success" },
      { text: "Great usage of a student-course table scenario", status: "success" },
      { text: "Did not specify BCNF when asked about transitive nuances", status: "warning" }
    ],
    aiSpeechText: "Good database design is key to scalable apps. What is database normalization? Can you compare 1NF, 2NF, and 3NF, and explain what transitive dependency is?",
    defaultCode: null
  },
  {
    id: 5,
    category: "Technical",
    difficulty: "Medium",
    question: "Explain the REST architectural constraints. What makes an API truly RESTful?",
    estimatedTime: "3:00",
    suggestedBulletPoints: [
      "Client-Server architecture separation.",
      "Statelessness: Each request contains all info needed.",
      "Cacheability: Responses must define cache status.",
      "Layered system: Middleware, proxies are transparent to client.",
      "Uniform Interface: Resource identification, representation manipulation, self-descriptive messages, HATEOAS."
    ],
    mockFeedback: [
      { text: "Mentioned Statelessness & Uniform Interface", status: "success" },
      { text: "Explained HATEOAS constraint correctly", status: "success" }
    ],
    aiSpeechText: "Let's talk about web APIs. Explain the REST architectural constraints. What makes an API truly RESTful?",
    defaultCode: null
  },
  {
    id: 6,
    category: "HR",
    difficulty: "Easy",
    question: "Why do you want to work for our organization? How do your personal goals align with our mission?",
    estimatedTime: "2:00",
    suggestedBulletPoints: [
      "Mention specific company values or engineering achievements.",
      "Connect personal growth to company scale and products.",
      "Emphasize willingness to learn and contribute to team successes."
    ],
    mockFeedback: [
      { text: "Well-researched answer about company achievements", status: "success" },
      { text: "Clear alignment with teamwork values", status: "success" }
    ],
    aiSpeechText: "We value passion and cultural fit here. Why do you want to work for our organization? How do your personal goals align with our mission?",
    defaultCode: null
  },
  {
    id: 7,
    category: "Technical",
    difficulty: "Hard",
    question: "How does the virtual DOM work in React, and how does the reconciliation algorithm compute updates?",
    estimatedTime: "4:00",
    suggestedBulletPoints: [
      "Virtual DOM is an in-memory representation of real DOM elements.",
      "Updates trigger re-rendering of virtual DOM tree, compared with the old virtual DOM (diffing).",
      "Reconciliation matches key-based items, makes minimal updates, avoiding costly real DOM paints.",
      "React Fiber introduces incremental rendering and priority-based scheduling."
    ],
    mockFeedback: [
      { text: "Clear distinction of real vs virtual DOM", status: "success" },
      { text: "Described diffing complexity O(n) correctly", status: "success" },
      { text: "Could explain React Fiber scheduler in more depth", status: "warning" }
    ],
    aiSpeechText: "Since we build heavily on modern frontends, how does the virtual DOM work in React, and how does the reconciliation algorithm compute updates?",
    defaultCode: null
  },
  {
    id: 8,
    category: "Coding",
    difficulty: "Medium",
    question: "Given a binary tree, write a function to perform a level-order traversal (breadth-first search).",
    estimatedTime: "4:00",
    suggestedBulletPoints: [
      "Use a queue data structure to track nodes.",
      "Enqueue root, then loop: dequeue node, record value, enqueue left & right children.",
      "Time complexity O(N), space complexity O(W) where W is the maximum width of the tree."
    ],
    mockFeedback: [
      { text: "Identified Queue as the correct data structure", status: "success" },
      { text: "Accurate analysis of O(N) space and time complexity", status: "success" }
    ],
    aiSpeechText: "Here's another coding exercise. Can you write a function or explain how to perform a level-order traversal of a binary tree?",
    codeQuestion: {
      description: "Write a function `levelOrder(root)` to return the level order traversal of its nodes' values.\n\nInput: root = [3,9,20,null,null,15,7]\nOutput: [[3],[9,20],[15,7]]",
      templates: {
        javascript: `function levelOrder(root) {\n  // Write level-order traversal here\n  if (!root) return [];\n  const result = [];\n  const queue = [root];\n  \n  while (queue.length > 0) {\n    const levelSize = queue.length;\n    const currentLevel = [];\n    for (let i = 0; i < levelSize; i++) {\n      const node = queue.shift();\n      currentLevel.push(node.val);\n      if (node.left) queue.push(node.left);\n      if (node.right) queue.push(node.right);\n    }\n    result.push(currentLevel);\n  }\n  return result;\n}`,
        python: `def level_order(root):\n    # Write Python tree level-order traversal\n    if not root:\n        return []\n    result = []\n    queue = [root]\n    while queue:\n        level_size = len(queue)\n        current_level = []\n        for _ in range(level_size):\n            node = queue.pop(0)\n            current_level.append(node.val)\n            if node.left: queue.append(node.left)\n            if node.right: queue.append(node.right)\n        result.append(current_level)\n    return result`
      }
    }
  },
  {
    id: 9,
    category: "Technical",
    difficulty: "Medium",
    question: "What is the event loop in JavaScript? Explain how macro-tasks and micro-tasks are processed.",
    estimatedTime: "3:30",
    suggestedBulletPoints: [
      "JS is single-threaded; event loop enables non-blocking concurrency.",
      "Call stack handles synchronous execution.",
      "Micro-task queue (Promises, queueMicrotask) has higher priority.",
      "Macro-task queue (setTimeout, setInterval, I/O) runs after micro-task queue is exhausted."
    ],
    mockFeedback: [
      { text: "Explained micro-task vs macro-task queue hierarchy", status: "success" },
      { text: "Described call stack exhaustion requirement", status: "success" }
    ],
    aiSpeechText: "Javascript runtime behavior is a popular topic. What is the event loop in JavaScript? How are macro-tasks and micro-tasks processed?",
    defaultCode: null
  },
  {
    id: 10,
    category: "HR",
    difficulty: "Medium",
    question: "Where do you see yourself in five years? How does this role help you get there?",
    estimatedTime: "2:00",
    suggestedBulletPoints: [
      "Express commitment to building deep technical expertise.",
      "Outline potential interest in leadership or architecture roles.",
      "Maintain realistic scope aligned with company advancement paths."
    ],
    mockFeedback: [
      { text: "Clear ambition with realistic milestones", status: "success" },
      { text: "Aligned career path directly with our engineering levels", status: "success" }
    ],
    aiSpeechText: "Finally, let's close with a career objective. Where do you see yourself in five years? How does this role help you get there?",
    defaultCode: null
  }
];

export const MOCK_CANDIDATE = {
  name: "Roshan Langhi",
  resumeName: "Roshan_Langhi_CV.pdf",
  interviewType: "Full Stack Engineer Mock Interview",
  difficulty: "Medium",
  totalQuestions: 10,
  totalTimeMinutes: 30
};
