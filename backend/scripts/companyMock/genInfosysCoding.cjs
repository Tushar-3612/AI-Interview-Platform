const fs = require('fs');
const path = require('path');

const codings = [];
let id = 1;

function addCoding({ title, problemStatement, diff, starterCode, publicTestCases, hiddenTestCases, src = 'practice' }) {
  const qid = `infosys-coding-${String(id).padStart(3, '0')}`;
  codings.push({
    questionId: qid,
    id: qid,
    company: "infosys",
    title,
    problemStatement,
    difficulty: diff,
    marks: 10,
    timeLimit: 1000,
    memoryLimit: 256,
    starterCode: starterCode || `function solution(input) {\n    // Write your code here\n    return input;\n}`,
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases,
    hiddenTestCases,
    source: src
  });
  id++;
}

// ----------------------------------------------------
// EASY PROBLEMS (9 Problems: ~28%)
// ----------------------------------------------------
addCoding({
  title: "Check Palindrome String",
  problemStatement: "Write a program to check if a given string is a palindrome ignoring case and non-alphanumeric characters. Return 'true' or 'false'.",
  diff: "Easy",
  publicTestCases: [
    { input: "A man, a plan, a canal: Panama", expected: "true" },
    { input: "race a car", expected: "false" }
  ],
  hiddenTestCases: [
    { input: "Was it a car or a cat I saw?", expected: "true" },
    { input: "hello", expected: "false" }
  ],
  src: "interview_reported"
});

addCoding({
  title: "Prime Number Verification",
  problemStatement: "Given an integer N, return 'Yes' if N is a prime number, otherwise return 'No'.",
  diff: "Easy",
  publicTestCases: [
    { input: "29", expected: "Yes" },
    { input: "1", expected: "No" }
  ],
  hiddenTestCases: [
    { input: "97", expected: "Yes" },
    { input: "100", expected: "No" }
  ],
  src: "interview_reported"
});

addCoding({
  title: "Armstrong Number Checker",
  problemStatement: "Given an integer N, determine if it is an Armstrong number (an n-digit number that is equal to the sum of the nth powers of its digits). Return 'Yes' or 'No'.",
  diff: "Easy",
  publicTestCases: [
    { input: "153", expected: "Yes" },
    { input: "123", expected: "No" }
  ],
  hiddenTestCases: [
    { input: "9474", expected: "Yes" },
    { input: "407", expected: "Yes" }
  ],
  src: "interview_reported"
});

addCoding({
  title: "First Non-Repeating Character",
  problemStatement: "Given a string S, return the first non-repeating character. If all characters repeat, return '-1'.",
  diff: "Easy",
  publicTestCases: [
    { input: "leetcode", expected: "l" },
    { input: "loveleetcode", expected: "v" }
  ],
  hiddenTestCases: [
    { input: "aabb", expected: "-1" },
    { input: "infosys", expected: "i" }
  ],
  src: "interview_reported"
});

addCoding({
  title: "Find Second Largest Element",
  problemStatement: "Given a space-separated array of integers, return the second largest distinct integer. If no such element exists, return -1.",
  diff: "Easy",
  publicTestCases: [
    { input: "12 35 1 10 34 1", expected: "34" },
    { input: "10 10 10", expected: "-1" }
  ],
  hiddenTestCases: [
    { input: "5 2 9 1 7", expected: "7" },
    { input: "100 200", expected: "100" }
  ],
  src: "practice"
});

addCoding({
  title: "Reverse Words in a Sentence",
  problemStatement: "Given a sentence string, reverse the order of words while maintaining single spaces between words.",
  diff: "Easy",
  publicTestCases: [
    { input: "the sky is blue", expected: "blue is sky the" },
    { input: "  hello world  ", expected: "world hello" }
  ],
  hiddenTestCases: [
    { input: "a good   example", expected: "example good a" },
    { input: "Infosys DSE", expected: "DSE Infosys" }
  ],
  src: "practice"
});

addCoding({
  title: "Array Element Frequency Counter",
  problemStatement: "Given a space-separated string of integers, count the frequency of each element and return in format 'element:count' separated by spaces sorted by element.",
  diff: "Easy",
  publicTestCases: [
    { input: "1 2 2 3 1", expected: "1:2 2:2 3:1" },
    { input: "4 4 4", expected: "4:3" }
  ],
  hiddenTestCases: [
    { input: "10 5 10 5 5", expected: "5:3 10:2" },
    { input: "7", expected: "7:1" }
  ],
  src: "practice"
});

addCoding({
  title: "Remove Duplicates from Sorted Array",
  problemStatement: "Given a space-separated sorted integer array, return the unique elements in sorted order separated by single spaces.",
  diff: "Easy",
  publicTestCases: [
    { input: "1 1 2", expected: "1 2" },
    { input: "0 0 1 1 1 2 2 3 3 4", expected: "0 1 2 3 4" }
  ],
  hiddenTestCases: [
    { input: "5 5 5 5", expected: "5" },
    { input: "1 2 3", expected: "1 2 3" }
  ],
  src: "practice"
});

addCoding({
  title: "Valid Parentheses Matching",
  problemStatement: "Given a string containing characters '(', ')', '{', '}', '[' and ']', return 'true' if the input string is valid, otherwise 'false'.",
  diff: "Easy",
  publicTestCases: [
    { input: "()[]{}", expected: "true" },
    { input: "(]", expected: "false" }
  ],
  hiddenTestCases: [
    { input: "([{}])", expected: "true" },
    { input: "([)]", expected: "false" }
  ],
  src: "practice"
});

// ----------------------------------------------------
// MEDIUM PROBLEMS (16 Problems: ~50%)
// ----------------------------------------------------
addCoding({
  title: "Longest Substring Without Repeating Characters",
  problemStatement: "Given a string S, find the length of the longest substring without repeating characters.",
  diff: "Medium",
  publicTestCases: [
    { input: "abcabcbb", expected: "3" },
    { input: "bbbbb", expected: "1" }
  ],
  hiddenTestCases: [
    { input: "pwwkew", expected: "3" },
    { input: "infosysdse", expected: "6" }
  ],
  src: "interview_reported"
});

addCoding({
  title: "0/1 Knapsack Problem",
  problemStatement: "Given weights and values of N items, and a knapsack capacity W, compute the maximum value subset that fits within capacity W. Input format: First line N and W space separated. Second line weights. Third line values.",
  diff: "Medium",
  publicTestCases: [
    { input: "3 50\n10 20 30\n60 100 120", expected: "220" },
    { input: "4 10\n5 4 6 3\n10 40 30 50", expected: "90" }
  ],
  hiddenTestCases: [
    { input: "1 10\n20\n100", expected: "0" },
    { input: "3 8\n3 4 5\n30 50 60", expected: "110" }
  ],
  src: "interview_reported"
});

addCoding({
  title: "Longest Common Subsequence (LCS)",
  problemStatement: "Given two strings S1 and S2, return the length of their longest common subsequence.",
  diff: "Medium",
  publicTestCases: [
    { input: "abcde\nace", expected: "3" },
    { input: "abc\nabc", expected: "3" }
  ],
  hiddenTestCases: [
    { input: "abc\ndef", expected: "0" },
    { input: "AGGTAB\nGXTXAYB", expected: "4" }
  ],
  src: "interview_reported"
});

addCoding({
  title: "Coin Change Problem",
  problemStatement: "Given an array of coin denominations and a target amount, return the minimum number of coins needed to make up that amount. If impossible, return -1. Input line 1: coins space separated. Line 2: target.",
  diff: "Medium",
  publicTestCases: [
    { input: "1 2 5\n11", expected: "3" },
    { input: "2\n3", expected: "-1" }
  ],
  hiddenTestCases: [
    { input: "1\n0", expected: "0" },
    { input: "2 5 10 1\n27", expected: "4" }
  ],
  src: "interview_reported"
});

addCoding({
  title: "Rotated Sorted Array Search",
  problemStatement: "Given a space-separated rotated sorted array and a target value K on line 2, return the 0-indexed position of K. Return -1 if K is not present.",
  diff: "Medium",
  publicTestCases: [
    { input: "4 5 6 7 0 1 2\n0", expected: "4" },
    { input: "4 5 6 7 0 1 2\n3", expected: "-1" }
  ],
  hiddenTestCases: [
    { input: "1\n0", expected: "-1" },
    { input: "3 1\n1", expected: "1" }
  ],
  src: "interview_reported"
});

addCoding({
  title: "Breadth-First Search (BFS) Shortest Path in Unweighted Graph",
  problemStatement: "Given a graph with V vertices (0 to V-1) and E directed edges, find the shortest distance from source vertex 0 to target vertex T. Input line 1: V E T. Next E lines: u v.",
  diff: "Medium",
  publicTestCases: [
    { input: "4 4 3\n0 1\n0 2\n1 3\n2 3", expected: "2" },
    { input: "3 1 2\n0 1", expected: "-1" }
  ],
  hiddenTestCases: [
    { input: "5 5 4\n0 1\n1 2\n2 3\n3 4\n0 4", expected: "1" },
    { input: "2 1 1\n0 1", expected: "1" }
  ],
  src: "interview_reported"
});

addCoding({
  title: "Minimum Path Sum in Grid",
  problemStatement: "Given an M x N grid filled with non-negative numbers, find a path from top-left to bottom-right which minimizes the sum of numbers along its path (moving only down or right). Input line 1: M N. Next M lines: space-separated row numbers.",
  diff: "Medium",
  publicTestCases: [
    { input: "3 3\n1 3 1\n1 5 1\n4 2 1", expected: "7" },
    { input: "2 3\n1 2 3\n4 5 6", expected: "12" }
  ],
  hiddenTestCases: [
    { input: "1 1\n5", expected: "5" },
    { input: "3 2\n1 2\n1 1\n2 1", expected: "4" }
  ],
  src: "practice"
});

addCoding({
  title: "Subarray Sum Equals K",
  problemStatement: "Given an array of integers and an integer K, find the total number of continuous subarrays whose sum equals K. Input line 1: space-separated array. Line 2: K.",
  diff: "Medium",
  publicTestCases: [
    { input: "1 1 1\n2", expected: "2" },
    { input: "1 2 3\n3", expected: "2" }
  ],
  hiddenTestCases: [
    { input: "1 -1 0\n0", expected: "3" },
    { input: "10 2 -2 -20 10\n-10", expected: "3" }
  ],
  src: "practice"
});

addCoding({
  title: "Detect Cycle in Directed Graph",
  problemStatement: "Given a directed graph with V vertices and E edges, return 'True' if a cycle exists, else 'False'. Input line 1: V E. Next E lines: u v.",
  diff: "Medium",
  publicTestCases: [
    { input: "4 4\n0 1\n1 2\n2 3\n3 1", expected: "True" },
    { input: "3 2\n0 1\n1 2", expected: "False" }
  ],
  hiddenTestCases: [
    { input: "2 2\n0 1\n1 0", expected: "True" },
    { input: "4 3\n0 1\n0 2\n2 3", expected: "False" }
  ],
  src: "practice"
});

addCoding({
  title: "Container With Most Water",
  problemStatement: "Given n non-negative integers representing heights of vertical lines, return the maximum area of water a container can store. Input: space-separated heights.",
  diff: "Medium",
  publicTestCases: [
    { input: "1 8 6 2 5 4 8 3 7", expected: "49" },
    { input: "1 1", expected: "1" }
  ],
  hiddenTestCases: [
    { input: "4 3 2 1 4", expected: "16" },
    { input: "1 2 1", expected: "2" }
  ],
  src: "practice"
});

addCoding({
  title: "Merge Overlapping Intervals",
  problemStatement: "Given an array of intervals where intervals[i] = [starti, endi], merge all overlapping intervals. Input line 1: N. Next N lines: start end.",
  diff: "Medium",
  publicTestCases: [
    { input: "4\n1 3\n2 6\n8 10\n15 18", expected: "1-6 8-10 15-18" },
    { input: "2\n1 4\n4 5", expected: "1-5" }
  ],
  hiddenTestCases: [
    { input: "1\n1 4", expected: "1-4" },
    { input: "3\n1 10\n2 3\n4 5", expected: "1-10" }
  ],
  src: "practice"
});

addCoding({
  title: "Kth Smallest Element in a Matrix",
  problemStatement: "Given an n x n matrix where each of the rows and columns is sorted in ascending order, find the kth smallest element in the matrix. Input line 1: N K. Next N lines: space separated row values.",
  diff: "Medium",
  publicTestCases: [
    { input: "3 8\n1 5 9\n10 11 13\n12 13 15", expected: "13" },
    { input: "1 1\n-5", expected: "-5" }
  ],
  hiddenTestCases: [
    { input: "2 3\n1 2\n3 4", expected: "3" },
    { input: "3 2\n1 2 3\n4 5 6\n7 8 9", expected: "2" }
  ],
  src: "practice"
});

addCoding({
  title: "Course Schedule / Topological Sort",
  problemStatement: "Given N courses (0 to N-1) and M prerequisite pairs (u v meaning v is prerequisite for u), return 'True' if all courses can be finished, else 'False'. Input line 1: N M. Next M lines: u v.",
  diff: "Medium",
  publicTestCases: [
    { input: "2 1\n1 0", expected: "True" },
    { input: "2 2\n1 0\n0 1", expected: "False" }
  ],
  hiddenTestCases: [
    { input: "4 3\n1 0\n2 1\n3 2", expected: "True" },
    { input: "3 3\n0 1\n1 2\n2 0", expected: "False" }
  ],
  src: "practice"
});

addCoding({
  title: "Longest Increasing Subsequence Length",
  problemStatement: "Given an integer array, return the length of the longest strictly increasing subsequence. Input: space-separated integers.",
  diff: "Medium",
  publicTestCases: [
    { input: "10 9 2 5 3 7 101 18", expected: "4" },
    { input: "0 1 0 3 2 3", expected: "4" }
  ],
  hiddenTestCases: [
    { input: "7 7 7 7 7 7 7", expected: "1" },
    { input: "4 10 4 3 8 9", expected: "3" }
  ],
  src: "practice"
});

addCoding({
  title: "Group Anagrams",
  problemStatement: "Given a space-separated list of words, group anagrams together and return the count of distinct anagram groups.",
  diff: "Medium",
  publicTestCases: [
    { input: "eat tea tan ate nat bat", expected: "3" },
    { input: "a", expected: "1" }
  ],
  hiddenTestCases: [
    { input: "abc bca cab xyz", expected: "2" },
    { input: "rat car cat", expected: "3" }
  ],
  src: "practice"
});

addCoding({
  title: "Reverse a Linked List",
  problemStatement: "Given a space-separated sequence representing nodes of a singly linked list, reverse the linked list and return space-separated elements.",
  diff: "Medium",
  publicTestCases: [
    { input: "1 2 3 4 5", expected: "5 4 3 2 1" },
    { input: "1 2", expected: "2 1" }
  ],
  hiddenTestCases: [
    { input: "10", expected: "10" },
    { input: "7 8 9", expected: "9 8 7" }
  ],
  src: "practice"
});

// ----------------------------------------------------
// HARD PROBLEMS (7 Problems: ~22%)
// ----------------------------------------------------
addCoding({
  title: "Dijkstra Single Source Shortest Path",
  problemStatement: "Given a weighted directed graph with V vertices (0 to V-1) and E edges, compute shortest distance from source vertex 0 to all vertices. Input line 1: V E. Next E lines: u v weight.",
  diff: "Hard",
  publicTestCases: [
    { input: "5 6\n0 1 2\n0 2 4\n1 2 1\n1 3 7\n2 4 3\n3 4 1", expected: "0 2 3 9 6" },
    { input: "3 2\n0 1 5\n1 2 3", expected: "0 5 8" }
  ],
  hiddenTestCases: [
    { input: "4 4\n0 1 1\n0 2 4\n1 2 2\n2 3 1", expected: "0 1 3 4" },
    { input: "1 0", expected: "0" }
  ],
  src: "interview_reported"
});

addCoding({
  title: "Alien Dictionary / Character Order Recovery",
  problemStatement: "Given a sorted dictionary of N words from an alien language, derive the order of characters. Input line 1: N. Line 2: words space-separated.",
  diff: "Hard",
  publicTestCases: [
    { input: "5\nwrt wrf er ett rftt", expected: "wertf" },
    { input: "3\nz x z", expected: "invalid" }
  ],
  hiddenTestCases: [
    { input: "3\nbaa abcd abca", expected: "badc" },
    { input: "2\ncab cba", expected: "acb" }
  ],
  src: "interview_reported"
});

addCoding({
  title: "Segment Tree Range Sum Query",
  problemStatement: "Given an array of N integers and Q operations: 'UPDATE idx val' or 'QUERY L R' (1-indexed). Return the sum for each query line separated by newlines. Input line 1: N Q. Line 2: array. Next Q lines: operation.",
  diff: "Hard",
  publicTestCases: [
    { input: "5 3\n1 3 5 7 9\nQUERY 1 3\nUPDATE 2 6\nQUERY 1 3", expected: "9\n12" },
    { input: "4 2\n2 4 6 8\nQUERY 2 4\nQUERY 1 2", expected: "18\n6" }
  ],
  hiddenTestCases: [
    { input: "3 2\n1 2 3\nQUERY 1 3\nUPDATE 1 10", expected: "6" },
    { input: "2 1\n5 10\nQUERY 1 2", expected: "15" }
  ],
  src: "interview_reported"
});

addCoding({
  title: "Minimum Window Substring",
  problemStatement: "Given strings S and T, return the minimum window substring of S such that every character in T (including duplicates) is included. If no such window exists, return empty string ''.",
  diff: "Hard",
  publicTestCases: [
    { input: "ADOBECODEBANC\nABC", expected: "BANC" },
    { input: "a\na", expected: "a" }
  ],
  hiddenTestCases: [
    { input: "a\naa", expected: "" },
    { input: "AA\nAA", expected: "AA" }
  ],
  src: "interview_reported"
});

addCoding({
  title: "Edit Distance (Levenshtein Distance)",
  problemStatement: "Given two strings word1 and word2, return the minimum number of operations (insert, delete, replace) required to convert word1 to word2.",
  diff: "Hard",
  publicTestCases: [
    { input: "horse\nros", expected: "3" },
    { input: "intention\nexecution", expected: "5" }
  ],
  hiddenTestCases: [
    { input: "abc\nabc", expected: "0" },
    { input: "a\nb", expected: "1" }
  ],
  src: "practice"
});

addCoding({
  title: "Trapping Rain Water",
  problemStatement: "Given n non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining. Input: space-separated elevation bars.",
  diff: "Hard",
  publicTestCases: [
    { input: "0 1 0 2 1 0 1 3 2 1 2 1", expected: "6" },
    { input: "4 2 0 3 2 5", expected: "9" }
  ],
  hiddenTestCases: [
    { input: "3 0 2 0 4", expected: "7" },
    { input: "1 2 3 4 5", expected: "0" }
  ],
  src: "practice"
});

addCoding({
  title: "Maximum Subarray Product",
  problemStatement: "Given an integer array, find a contiguous non-empty subarray that has the largest product, and return the product.",
  diff: "Hard",
  publicTestCases: [
    { input: "2 3 -2 4", expected: "6" },
    { input: "-2 0 -1", expected: "0" }
  ],
  hiddenTestCases: [
    { input: "-2 3 -4", expected: "24" },
    { input: "0 2", expected: "2" }
  ],
  src: "practice"
});

const outPath = path.join(__dirname, '../../data/companyMock/infosys/coding.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(codings, null, 2), 'utf8');
console.log(`Generated ${codings.length} Infosys Coding problems -> ${outPath}`);
