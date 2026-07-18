/**
 * Practice question bank — used across company practice sessions.
 */
import { COMPANIES } from "./companies.js";

export const PRACTICE_QUESTIONS = [
  {
    id: "q1",
    companyIds: ["amazon", "google", "microsoft"],
    category: "Technical",
    difficulty: "Hard",
    question: "Explain the difference between process and thread. When would you prefer multithreading over multiprocessing?",
    correctAnswer: "A process has its own memory space; threads share memory within a process. Multithreading suits I/O-bound concurrent tasks; multiprocessing suits CPU-bound parallel work.",
    explanation: "Processes are isolated; threads are lighter but require synchronization. Choose based on workload type and GIL constraints in Python or similar runtime behavior.",
  },
  {
    id: "q2",
    companyIds: ["amazon", "meta"],
    category: "Coding",
    difficulty: "Hard",
    question: "Given an array of integers, find two numbers that add up to a target sum. Optimize for time complexity.",
    correctAnswer: "Use a hash map: for each element, check if (target - element) exists. Time O(n), space O(n).",
    explanation: "Brute force is O(n²). Hash map single-pass approach avoids nested loops and is the standard interview solution.",
  },
  {
    id: "q3",
    companyIds: ["tcs", "infosys", "wipro", "sanjivani"],
    category: "HR",
    difficulty: "Easy",
    question: "Tell me about yourself and why you want to join our organization.",
    correctAnswer: "Structure: brief background, relevant skills/projects, motivation aligned with company values, and career goal.",
    explanation: "Keep it under 2 minutes. Focus on education, key projects, strengths, and genuine interest in the role/company culture.",
  },
  {
    id: "q4",
    companyIds: ["microsoft", "oracle", "ibm"],
    category: "Technical",
    difficulty: "Medium",
    question: "What is normalization in databases? Explain 1NF, 2NF, and 3NF with a simple example.",
    correctAnswer: "Normalization reduces redundancy. 1NF: atomic values. 2NF: no partial dependency on composite key. 3NF: no transitive dependency on non-key attributes.",
    explanation: "Use a student-enrollment example: separate students, courses, and enrollments tables to satisfy higher normal forms.",
  },
  {
    id: "q5",
    companyIds: ["google", "amazon"],
    category: "Coding",
    difficulty: "Medium",
    question: "Reverse a linked list iteratively. What is the time and space complexity?",
    correctAnswer: "Iterate with three pointers (prev, curr, next), reverse links. Time O(n), space O(1).",
    explanation: "Maintain prev=null, shift pointers each step. Recursive solution uses O(n) stack space.",
  },
  {
    id: "q6",
    companyIds: ["accenture", "capgemini", "cognizant"],
    category: "HR",
    difficulty: "Easy",
    question: "Describe a situation where you worked in a team under a tight deadline.",
    correctAnswer: "Use STAR: Situation, Task, Action, Result. Highlight communication, prioritization, and outcome.",
    explanation: "Pick a real college project or fest event. Quantify result if possible (delivered on time, grade, user count).",
  },
  {
    id: "q7",
    companyIds: ["adobe", "apple", "netflix"],
    category: "Technical",
    difficulty: "Medium",
    question: "How does the browser render a web page from HTML, CSS, and JavaScript?",
    correctAnswer: "Parse HTML → DOM, CSS → CSSOM, render tree, layout, paint, composite. JS can block parsing; async/defer helps.",
    explanation: "Critical rendering path matters for performance. Understand reflow vs repaint and optimization strategies.",
  },
  {
    id: "q8",
    companyIds: ["persistent", "deloitte"],
    category: "Coding",
    difficulty: "Easy",
    question: "Write a function to check if a string is a palindrome.",
    correctAnswer: "Two pointers from start and end, compare characters until pointers meet. Time O(n), space O(1).",
    explanation: "Ignore case and non-alphanumeric if required. Can also reverse half the string for linked-list style problems.",
  },
  {
    id: "q9",
    companyIds: ["ey", "pwc", "deloitte"],
    category: "HR",
    difficulty: "Medium",
    question: "What are your strengths and weaknesses?",
    correctAnswer: "Strength with example. Weakness with improvement plan — avoid clichés like 'I'm a perfectionist' without substance.",
    explanation: "Be honest and show self-awareness. Tie strengths to role requirements.",
  },
  {
    id: "q10",
    companyIds: ["sanjivani", "persistent"],
    category: "Technical",
    difficulty: "Easy",
    question: "Explain OOP concepts: encapsulation, inheritance, polymorphism, and abstraction.",
    correctAnswer: "Encapsulation hides data; inheritance reuses code; polymorphism enables multiple forms; abstraction hides complexity via interfaces/classes.",
    explanation: "Give one-line Java or C++ example for each. Relate to real project class design if asked follow-up.",
  },
];

export function getQuestionsForCompany(companyId) {
  return PRACTICE_QUESTIONS.filter(
    (q) => q.companyIds.includes(companyId) || q.companyIds.includes("sanjivani")
  );
}

export function getCompanyById(id) {
  return COMPANIES.find((c) => c.id === id);
}
