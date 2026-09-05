/**
 * 32 Benchmark IT Solutions Coding Questions
 * Full Judge0 Schema with public and hidden test cases, starterCode, supportedLanguages.
 */

export const codingQuestions = [
  {
    questionId: "benchmark-coding-01",
    id: "benchmark-coding-01",
    title: "Two Sum",
    company: "benchmark",
    difficulty: "Easy",
    category: "Arrays",
    tags: ["Array", "Hash Table", "Two Pointers"],
    marks: 10,
    source: "interview_reported",
    problemStatement: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`. You may assume that each input would have exactly one solution, and you may not use the same element twice. Return the indices as a string in format `[i, j]` or space-separated `i j`.",
    description: "Find two numbers in the array that sum to the target and return their 0-based indices.",
    constraints: "2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9\nOnly one valid answer exists.",
    inputFormat: "Line 1: Comma-separated or space-separated array elements.\nLine 2: Target integer.",
    outputFormat: "Two space-separated indices.",
    examples: [
      {
        input: "nums = [2,7,11,15], target = 9",
        output: "0 1",
        explanation: "Because nums[0] + nums[1] == 9, we return 0 1."
      },
      {
        input: "nums = [3,2,4], target = 6",
        output: "1 2",
        explanation: "Because nums[1] + nums[2] == 6, we return 1 2."
      }
    ],
    explanation: "Use a hash map to store each number and its index. For each number x, check if target - x exists in the map.",
    starterCode: "function twoSum(nums, target) {\n  const map = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (map.has(complement)) {\n      return `${map.get(complement)} ${i}`;\n    }\n    map.set(nums[i], i);\n  }\n  return \"\";\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "2 7 11 15\n9", expected: "0 1" },
      { input: "3 2 4\n6", expected: "1 2" },
      { input: "3 3\n6", expected: "0 1" }
    ],
    hiddenTestCases: [
      { input: "1 5 8 12 14\n20", expected: "2 3" },
      { input: "-3 4 3 90\n0", expected: "0 2" },
      { input: "10 20 30 40 50\n90", expected: "3 4" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-02",
    id: "benchmark-coding-02",
    title: "Reverse a String",
    company: "benchmark",
    difficulty: "Easy",
    category: "Strings",
    tags: ["String", "Two Pointers"],
    marks: 10,
    source: "interview_reported",
    problemStatement: "Given a string `s`, write a function that reverses the string in place or returns the reversed string.",
    description: "Reverse the input string.",
    constraints: "1 <= s.length <= 10^5\ns consists of printable ASCII characters.",
    inputFormat: "A single line containing string s.",
    outputFormat: "The reversed string.",
    examples: [
      {
        input: "hello",
        output: "olleh",
        explanation: "Reversing 'hello' gives 'olleh'."
      },
      {
        input: "Benchmark",
        output: "kramhcneB",
        explanation: "Reversing 'Benchmark' gives 'kramhcneB'."
      }
    ],
    explanation: "Use two pointers from both ends swapping characters, or accumulate in reverse order in O(n) time.",
    starterCode: "function reverseString(s) {\n  return s.split('').reverse().join('');\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "hello", expected: "olleh" },
      { input: "Benchmark", expected: "kramhcneB" }
    ],
    hiddenTestCases: [
      { input: "a", expected: "a" },
      { input: "racecar", expected: "racecar" },
      { input: "123456789", expected: "987654321" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-03",
    id: "benchmark-coding-03",
    title: "First Non-Repeating Character",
    company: "benchmark",
    difficulty: "Easy",
    category: "Strings",
    tags: ["String", "Hash Table"],
    marks: 10,
    source: "interview_reported",
    problemStatement: "Given a string `s`, find the first non-repeating character in it and return its 0-based index. If it does not exist, return -1.",
    description: "Find index of first unique character in string.",
    constraints: "1 <= s.length <= 10^5\ns consists of only lowercase English letters.",
    inputFormat: "A single string s.",
    outputFormat: "A single integer index or -1.",
    examples: [
      {
        input: "benchmark",
        output: "0",
        explanation: "'b' appears once and is at index 0."
      },
      {
        input: "lovebenchmark",
        output: "0",
        explanation: "'l' appears once and is at index 0."
      },
      {
        input: "aabb",
        output: "-1",
        explanation: "All characters repeat."
      }
    ],
    explanation: "Count character frequencies in a first pass, then return the index of the first character with frequency 1.",
    starterCode: "function firstUniqChar(s) {\n  const count = {};\n  for (const c of s) count[c] = (count[c] || 0) + 1;\n  for (let i = 0; i < s.length; i++) {\n    if (count[s[i]] === 1) return i;\n  }\n  return -1;\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "benchmark", expected: "0" },
      { input: "aabb", expected: "-1" }
    ],
    hiddenTestCases: [
      { input: "leetcode", expected: "0" },
      { input: "loveleetcode", expected: "2" },
      { input: "z", expected: "0" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-04",
    id: "benchmark-coding-04",
    title: "Valid Palindrome",
    company: "benchmark",
    difficulty: "Easy",
    category: "Strings",
    tags: ["String", "Two Pointers"],
    marks: 10,
    source: "interview_reported",
    problemStatement: "A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Given a string `s`, return `true` if it is a palindrome, or `false` otherwise.",
    description: "Determine whether the string is a valid palindrome ignoring non-alphanumerics and case.",
    constraints: "1 <= s.length <= 2 * 10^5\ns consists only of printable ASCII characters.",
    inputFormat: "A single line containing string s.",
    outputFormat: "`true` or `false`.",
    examples: [
      {
        input: "A man, a plan, a canal: Panama",
        output: "true",
        explanation: "'amanaplanacanalpanama' is a palindrome."
      },
      {
        input: "race a car",
        output: "false",
        explanation: "'raceacar' is not a palindrome."
      }
    ],
    explanation: "Filter characters to alphanumeric lowercase, then compare using two pointers from opposite ends.",
    starterCode: "function isPalindrome(s) {\n  const cleaned = s.toLowerCase().replace(/[^a-z0-9]/g, '');\n  return cleaned === cleaned.split('').reverse().join('');\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "A man, a plan, a canal: Panama", expected: "true" },
      { input: "race a car", expected: "false" }
    ],
    hiddenTestCases: [
      { input: " ", expected: "true" },
      { input: "0P", expected: "false" },
      { input: "Madam, I'm Adam", expected: "true" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-05",
    id: "benchmark-coding-05",
    title: "Find Second Largest Element",
    company: "benchmark",
    difficulty: "Easy",
    category: "Arrays",
    tags: ["Array"],
    marks: 10,
    source: "interview_reported",
    problemStatement: "Given an array of integers `nums`, find the second largest distinct element in the array. If no distinct second largest exists, return -1.",
    description: "Find the second strictly greatest integer in the array.",
    constraints: "2 <= nums.length <= 10^5\n-10^9 <= nums[i] <= 10^9",
    inputFormat: "Space-separated integers.",
    outputFormat: "A single integer — the second largest element, or -1.",
    examples: [
      {
        input: "12 35 1 10 34 1",
        output: "34",
        explanation: "Largest is 35, second largest is 34."
      },
      {
        input: "10 10 10",
        output: "-1",
        explanation: "No second distinct largest element."
      }
    ],
    explanation: "Maintain two variables `first` and `second` initialized to -Infinity. Scan once through the array updating both in O(n) time.",
    starterCode: "function findSecondLargest(nums) {\n  let first = -Infinity, second = -Infinity;\n  for (const n of nums) {\n    if (n > first) {\n      second = first;\n      first = n;\n    } else if (n < first && n > second) {\n      second = n;\n    }\n  }\n  return second === -Infinity ? -1 : second;\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "12 35 1 10 34 1", expected: "34" },
      { input: "10 10 10", expected: "-1" }
    ],
    hiddenTestCases: [
      { input: "5 20", expected: "5" },
      { input: "-10 -5 -2 -1", expected: "-2" },
      { input: "100 99 98 97", expected: "99" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-06",
    id: "benchmark-coding-06",
    title: "Remove Duplicates from Sorted Array",
    company: "benchmark",
    difficulty: "Easy",
    category: "Arrays",
    tags: ["Array", "Two Pointers"],
    marks: 10,
    source: "interview_reported",
    problemStatement: "Given an integer array `nums` sorted in non-decreasing order, remove the duplicates in-place such that each unique element appears only once. Return the number of unique elements `k` followed by the unique array elements space-separated.",
    description: "Remove duplicate elements in-place from a sorted array.",
    constraints: "1 <= nums.length <= 3 * 10^4\n-100 <= nums[i] <= 100\nnums is sorted in non-decreasing order.",
    inputFormat: "Space-separated integers.",
    outputFormat: "Count of unique elements k followed by newline and the elements.",
    examples: [
      {
        input: "1 1 2",
        output: "2\n1 2",
        explanation: "Unique elements are 1 and 2."
      },
      {
        input: "0 0 1 1 1 2 2 3 3 4",
        output: "5\n0 1 2 3 4",
        explanation: "Unique elements are 0, 1, 2, 3, 4."
      }
    ],
    explanation: "Use a write pointer `k`. Iterate through `nums` and whenever `nums[i] !== nums[k-1]`, write `nums[k++] = nums[i]`.",
    starterCode: "function removeDuplicates(nums) {\n  if (!nums.length) return '0\\n';\n  let k = 1;\n  for (let i = 1; i < nums.length; i++) {\n    if (nums[i] !== nums[k - 1]) {\n      nums[k] = nums[i];\n      k++;\n    }\n  }\n  return `${k}\\n${nums.slice(0, k).join(' ')}`;\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "1 1 2", expected: "2\n1 2" },
      { input: "0 0 1 1 1 2 2 3 3 4", expected: "5\n0 1 2 3 4" }
    ],
    hiddenTestCases: [
      { input: "1", expected: "1\n1" },
      { input: "1 1 1 1 1", expected: "1\n1" },
      { input: "-3 -3 -2 -1 -1 0 0", expected: "4\n-3 -2 -1 0" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-07",
    id: "benchmark-coding-07",
    title: "Valid Anagram",
    company: "benchmark",
    difficulty: "Easy",
    category: "Strings",
    tags: ["String", "Hash Table", "Sorting"],
    marks: 10,
    source: "interview_reported",
    problemStatement: "Given two strings `s` and `t`, return `true` if `t` is an anagram of `s`, and `false` otherwise. An Anagram is a word formed by rearranging the letters of a different word using all original letters exactly once.",
    description: "Check if string t is an anagram of string s.",
    constraints: "1 <= s.length, t.length <= 5 * 10^4\ns and t consist of lowercase English letters.",
    inputFormat: "Line 1: string s\nLine 2: string t",
    outputFormat: "`true` or `false`",
    examples: [
      {
        input: "anagram\nnagaram",
        output: "true",
        explanation: "Both strings contain the same character frequencies."
      },
      {
        input: "rat\ncar",
        output: "false",
        explanation: "Characters do not match."
      }
    ],
    explanation: "Count frequencies of 26 letters in s and decrement for t. If any count is non-zero, return false.",
    starterCode: "function isAnagram(s, t) {\n  if (s.length !== t.length) return false;\n  const count = {};\n  for (const c of s) count[c] = (count[c] || 0) + 1;\n  for (const c of t) {\n    if (!count[c]) return false;\n    count[c]--;\n  }\n  return true;\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "anagram\nnagaram", expected: "true" },
      { input: "rat\ncar", expected: "false" }
    ],
    hiddenTestCases: [
      { input: "a\na", expected: "true" },
      { input: "ab\na", expected: "false" },
      { input: "listen\nsilent", expected: "true" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-08",
    id: "benchmark-coding-08",
    title: "Merge Two Sorted Arrays",
    company: "benchmark",
    difficulty: "Easy",
    category: "Arrays",
    tags: ["Array", "Two Pointers", "Sorting"],
    marks: 10,
    source: "interview_reported",
    problemStatement: "Given two sorted integer arrays `nums1` and `nums2`, merge them into a single sorted array and output the space-separated result.",
    description: "Merge two sorted arrays into one sorted sequence.",
    constraints: "0 <= nums1.length, nums2.length <= 10^5\n-10^9 <= nums1[i], nums2[j] <= 10^9",
    inputFormat: "Line 1: Space-separated sorted integers for nums1.\nLine 2: Space-separated sorted integers for nums2.",
    outputFormat: "Space-separated merged sorted integers.",
    examples: [
      {
        input: "1 3 5\n2 4 6",
        output: "1 2 3 4 5 6",
        explanation: "Merged array is [1, 2, 3, 4, 5, 6]."
      }
    ],
    explanation: "Use two pointers scanning both arrays in O(n + m) time, appending the smaller current element to the result.",
    starterCode: "function mergeSortedArrays(nums1, nums2) {\n  let i = 0, j = 0;\n  const res = [];\n  while (i < nums1.length && j < nums2.length) {\n    if (nums1[i] <= nums2[j]) res.push(nums1[i++]);\n    else res.push(nums2[j++]);\n  }\n  while (i < nums1.length) res.push(nums1[i++]);\n  while (j < nums2.length) res.push(nums2[j++]);\n  return res.join(' ');\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "1 3 5\n2 4 6", expected: "1 2 3 4 5 6" },
      { input: "1 2 3\n4 5 6", expected: "1 2 3 4 5 6" }
    ],
    hiddenTestCases: [
      { input: "1\n2", expected: "1 2" },
      { input: "10 20 30\n5 15 25 35", expected: "5 10 15 20 25 30 35" },
      { input: "-5 -1\n-3 0 2", expected: "-5 -3 -1 0 2" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-09",
    id: "benchmark-coding-09",
    title: "Binary Search",
    company: "benchmark",
    difficulty: "Easy",
    category: "Searching",
    tags: ["Array", "Binary Search"],
    marks: 10,
    source: "interview_reported",
    problemStatement: "Given an array of integers `nums` which is sorted in ascending order, and an integer `target`, write a function to search `target` in `nums`. If `target` exists, return its index. Otherwise, return -1 in O(log n) runtime.",
    description: "Find index of target in sorted array using binary search.",
    constraints: "1 <= nums.length <= 10^5\n-10^4 < nums[i], target < 10^4\nAll the integers in nums are unique.\nnums is sorted in ascending order.",
    inputFormat: "Line 1: Space-separated sorted integers.\nLine 2: Target integer.",
    outputFormat: "Index of target or -1.",
    examples: [
      {
        input: "-1 0 3 5 9 12\n9",
        output: "4",
        explanation: "9 exists in nums and its index is 4."
      },
      {
        input: "-1 0 3 5 9 12\n2",
        output: "-1",
        explanation: "2 does not exist in nums so return -1."
      }
    ],
    explanation: "Initialize low=0, high=n-1. While low <= high, check mid = low + (high - low) / 2. Halve search space on each step.",
    starterCode: "function search(nums, target) {\n  let low = 0, high = nums.length - 1;\n  while (low <= high) {\n    const mid = Math.floor(low + (high - low) / 2);\n    if (nums[mid] === target) return mid;\n    if (nums[mid] < target) low = mid + 1;\n    else high = mid - 1;\n  }\n  return -1;\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "-1 0 3 5 9 12\n9", expected: "4" },
      { input: "-1 0 3 5 9 12\n2", expected: "-1" }
    ],
    hiddenTestCases: [
      { input: "5\n5", expected: "0" },
      { input: "1 2 3 4 5 6 7\n1", expected: "0" },
      { input: "1 2 3 4 5 6 7\n7", expected: "6" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-10",
    id: "benchmark-coding-10",
    title: "Valid Parentheses",
    company: "benchmark",
    difficulty: "Easy",
    category: "Stack",
    tags: ["String", "Stack"],
    marks: 10,
    source: "interview_reported",
    problemStatement: "Given a string `s` containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid. Open brackets must be closed by the same type of brackets in the correct order.",
    description: "Check if brackets in string are balanced and properly matched.",
    constraints: "1 <= s.length <= 10^4\ns consists of parentheses only '()[]{}'.",
    inputFormat: "A single string s.",
    outputFormat: "`true` or `false`.",
    examples: [
      {
        input: "()[]{}",
        output: "true",
        explanation: "All brackets open and close correctly."
      },
      {
        input: "(]",
        output: "false",
        explanation: "Mismatched bracket types."
      }
    ],
    explanation: "Push opening brackets onto a stack. When encountering a closing bracket, pop from stack and check if it matches.",
    starterCode: "function isValid(s) {\n  const stack = [];\n  const map = { ')': '(', '}': '{', ']': '[' };\n  for (const c of s) {\n    if (map[c]) {\n      if (stack.pop() !== map[c]) return false;\n    } else {\n      stack.push(c);\n    }\n  }\n  return stack.length === 0;\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "()[]{}", expected: "true" },
      { input: "(]", expected: "false" }
    ],
    hiddenTestCases: [
      { input: "([{}])", expected: "true" },
      { input: "(", expected: "false" },
      { input: "]]", expected: "false" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-11",
    id: "benchmark-coding-11",
    title: "Maximum Subarray (Kadane's Algorithm)",
    company: "benchmark",
    difficulty: "Medium",
    category: "Arrays",
    tags: ["Array", "Dynamic Programming", "Divide and Conquer"],
    marks: 10,
    source: "interview_reported",
    problemStatement: "Given an integer array `nums`, find the subarray with the largest sum, and return its sum using Kadane's algorithm.",
    description: "Find contiguous subarray with maximum sum.",
    constraints: "1 <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4",
    inputFormat: "Space-separated integers.",
    outputFormat: "A single integer — the maximum subarray sum.",
    examples: [
      {
        input: "-2 1 -3 4 -1 2 1 -5 4",
        output: "6",
        explanation: "The subarray [4,-1,2,1] has the largest sum 6."
      },
      {
        input: "1",
        output: "1",
        explanation: "The subarray [1] has sum 1."
      }
    ],
    explanation: "Kadane's Algorithm maintains `currentSum = max(num, currentSum + num)` and `maxSum = max(maxSum, currentSum)` in O(n) time and O(1) space.",
    starterCode: "function maxSubArray(nums) {\n  let maxSoFar = nums[0];\n  let currMax = nums[0];\n  for (let i = 1; i < nums.length; i++) {\n    currMax = Math.max(nums[i], currMax + nums[i]);\n    maxSoFar = Math.max(maxSoFar, currMax);\n  }\n  return maxSoFar;\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "-2 1 -3 4 -1 2 1 -5 4", expected: "6" },
      { input: "1", expected: "1" }
    ],
    hiddenTestCases: [
      { input: "5 4 -1 7 8", expected: "23" },
      { input: "-1 -2 -3 -4", expected: "-1" },
      { input: "10 -5 10 -5 10", expected: "20" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-12",
    id: "benchmark-coding-12",
    title: "Rotate Array by K Positions",
    company: "benchmark",
    difficulty: "Medium",
    category: "Arrays",
    tags: ["Array", "Math", "Two Pointers"],
    marks: 10,
    source: "interview_reported",
    problemStatement: "Given an integer array `nums`, rotate the array to the right by `k` steps, where `k` is non-negative.",
    description: "Rotate elements of array right by k steps in O(n) time.",
    constraints: "1 <= nums.length <= 10^5\n-2^31 <= nums[i] <= 2^31 - 1\n0 <= k <= 10^5",
    inputFormat: "Line 1: Space-separated integers.\nLine 2: Non-negative integer k.",
    outputFormat: "Space-separated rotated array.",
    examples: [
      {
        input: "1 2 3 4 5 6 7\n3",
        output: "5 6 7 1 2 3 4",
        explanation: "Rotate 3 steps right: [5,6,7,1,2,3,4]."
      }
    ],
    explanation: "Reverse entire array, reverse first k elements, reverse remaining n-k elements in O(n) time and O(1) space.",
    starterCode: "function rotate(nums, k) {\n  k = k % nums.length;\n  const reverse = (arr, l, r) => {\n    while (l < r) {\n      const tmp = arr[l]; arr[l] = arr[r]; arr[r] = tmp;\n      l++; r--;\n    }\n  };\n  reverse(nums, 0, nums.length - 1);\n  reverse(nums, 0, k - 1);\n  reverse(nums, k, nums.length - 1);\n  return nums.join(' ');\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "1 2 3 4 5 6 7\n3", expected: "5 6 7 1 2 3 4" },
      { input: "-1 -100 3 99\n2", expected: "3 99 -1 -100" }
    ],
    hiddenTestCases: [
      { input: "1 2\n3", expected: "2 1" },
      { input: "1 2 3 4\n4", expected: "1 2 3 4" },
      { input: "9\n5", expected: "9" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-13",
    id: "benchmark-coding-13",
    title: "Longest Substring Without Repeating Characters",
    company: "benchmark",
    difficulty: "Medium",
    category: "Strings",
    tags: ["Hash Table", "String", "Sliding Window"],
    marks: 10,
    source: "interview_reported",
    problemStatement: "Given a string `s`, find the length of the longest substring without repeating characters.",
    description: "Find maximum length of substring containing only unique characters.",
    constraints: "0 <= s.length <= 5 * 10^4\ns consists of English letters, digits, symbols and spaces.",
    inputFormat: "A single string s.",
    outputFormat: "A single integer length.",
    examples: [
      {
        input: "abcabcbb",
        output: "3",
        explanation: "The answer is 'abc', with the length of 3."
      },
      {
        input: "bbbbb",
        output: "1",
        explanation: "The answer is 'b', with the length of 1."
      }
    ],
    explanation: "Use a sliding window with a hash map of character last-seen indices. Update left pointer when duplicate is encountered.",
    starterCode: "function lengthOfLongestSubstring(s) {\n  let maxLen = 0, left = 0;\n  const seen = new Map();\n  for (let right = 0; right < s.length; right++) {\n    if (seen.has(s[right]) && seen.get(s[right]) >= left) {\n      left = seen.get(s[right]) + 1;\n    }\n    seen.set(s[right], right);\n    maxLen = Math.max(maxLen, right - left + 1);\n  }\n  return maxLen;\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "abcabcbb", expected: "3" },
      { input: "bbbbb", expected: "1" }
    ],
    hiddenTestCases: [
      { input: "pwwkew", expected: "3" },
      { input: "", expected: "0" },
      { input: "au", expected: "2" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-14",
    id: "benchmark-coding-14",
    title: "Product of Array Except Self",
    company: "benchmark",
    difficulty: "Medium",
    category: "Arrays",
    tags: ["Array", "Prefix Sum"],
    marks: 10,
    source: "interview_reported",
    problemStatement: "Given an integer array `nums`, return an array `answer` such that `answer[i]` is equal to the product of all the elements of `nums` except `nums[i]`. You must write an algorithm that runs in O(n) time and without using the division operation.",
    description: "Compute product of all other elements for each position without division.",
    constraints: "2 <= nums.length <= 10^5\n-30 <= nums[i] <= 30",
    inputFormat: "Space-separated integers.",
    outputFormat: "Space-separated product integers.",
    examples: [
      {
        input: "1 2 3 4",
        output: "24 12 8 6",
        explanation: "24 = 2*3*4, 12 = 1*3*4, 8 = 1*2*4, 6 = 1*2*3."
      }
    ],
    explanation: "Compute prefix products in first pass, then multiply by running suffix products in second pass in O(n) time.",
    starterCode: "function productExceptSelf(nums) {\n  const n = nums.length;\n  const res = new Array(n).fill(1);\n  let prefix = 1;\n  for (let i = 0; i < n; i++) {\n    res[i] = prefix;\n    prefix *= nums[i];\n  }\n  let suffix = 1;\n  for (let i = n - 1; i >= 0; i--) {\n    res[i] *= suffix;\n    suffix *= nums[i];\n  }\n  return res.join(' ');\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "1 2 3 4", expected: "24 12 8 6" },
      { input: "-1 1 0 -3 3", expected: "0 0 9 0 0" }
    ],
    hiddenTestCases: [
      { input: "2 3", expected: "3 2" },
      { input: "1 1 1 1", expected: "1 1 1 1" },
      { input: "0 0", expected: "0 0" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-15",
    id: "benchmark-coding-15",
    title: "Container With Most Water",
    company: "benchmark",
    difficulty: "Medium",
    category: "Arrays",
    tags: ["Array", "Two Pointers", "Greedy"],
    marks: 10,
    source: "practice",
    problemStatement: "You are given an integer array `height` of length `n`. Find two lines that together with the x-axis form a container, such that the container contains the most water. Return the maximum amount of water a container can store.",
    description: "Calculate maximum water area between vertical lines.",
    constraints: "n == height.length\n2 <= n <= 10^5\n0 <= height[i] <= 10^4",
    inputFormat: "Space-separated integers.",
    outputFormat: "A single integer — max water area.",
    examples: [
      {
        input: "1 8 6 2 5 4 8 3 7",
        output: "49",
        explanation: "Lines at index 1 (height 8) and index 8 (height 7) hold area min(8,7) * (8 - 1) = 49."
      }
    ],
    explanation: "Two pointers at low=0 and high=n-1. Area = min(height[low], height[high]) * (high - low). Move pointer with smaller height inward.",
    starterCode: "function maxArea(height) {\n  let max = 0, l = 0, r = height.length - 1;\n  while (l < r) {\n    const h = Math.min(height[l], height[r]);\n    max = Math.max(max, h * (r - l));\n    if (height[l] < height[r]) l++;\n    else r--;\n  }\n  return max;\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "1 8 6 2 5 4 8 3 7", expected: "49" },
      { input: "1 1", expected: "1" }
    ],
    hiddenTestCases: [
      { input: "4 3 2 1 4", expected: "16" },
      { input: "1 2 1", expected: "2" },
      { input: "10 9 8 7 6 5 4 3 2 1", expected: "25" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-16",
    id: "benchmark-coding-16",
    title: "Search in Rotated Sorted Array",
    company: "benchmark",
    difficulty: "Medium",
    category: "Searching",
    tags: ["Array", "Binary Search"],
    marks: 10,
    source: "practice",
    problemStatement: "Given an integer array `nums` sorted in ascending order (with distinct values) that has been rotated at an unknown pivot, and an integer `target`, return the index of `target` if it is in `nums`, or -1 if it is not in `nums` in O(log n) time.",
    description: "Search for target in sorted array rotated at pivot.",
    constraints: "1 <= nums.length <= 5000\n-10^4 <= nums[i] <= 10^4\nAll values of nums are unique.",
    inputFormat: "Line 1: Space-separated integers.\nLine 2: Target integer.",
    outputFormat: "Index of target or -1.",
    examples: [
      {
        input: "4 5 6 7 0 1 2\n0",
        output: "4",
        explanation: "0 is at index 4."
      },
      {
        input: "4 5 6 7 0 1 2\n3",
        output: "-1",
        explanation: "3 is not in array."
      }
    ],
    explanation: "At least one half of the rotated array is always strictly sorted. Determine which half is sorted and check if target lies within that range.",
    starterCode: "function search(nums, target) {\n  let low = 0, high = nums.length - 1;\n  while (low <= high) {\n    const mid = Math.floor(low + (high - low) / 2);\n    if (nums[mid] === target) return mid;\n    if (nums[low] <= nums[mid]) {\n      if (nums[low] <= target && target < nums[mid]) high = mid - 1;\n      else low = mid + 1;\n    } else {\n      if (nums[mid] < target && target <= nums[high]) low = mid + 1;\n      else high = mid - 1;\n    }\n  }\n  return -1;\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "4 5 6 7 0 1 2\n0", expected: "4" },
      { input: "4 5 6 7 0 1 2\n3", expected: "-1" }
    ],
    hiddenTestCases: [
      { input: "1\n0", expected: "-1" },
      { input: "3 1\n1", expected: "1" },
      { input: "5 1 3\n5", expected: "0" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-17",
    id: "benchmark-coding-17",
    title: "Merge Intervals",
    company: "benchmark",
    difficulty: "Medium",
    category: "Arrays",
    tags: ["Array", "Sorting"],
    marks: 10,
    source: "practice",
    problemStatement: "Given an array of `intervals` where `intervals[i] = [start_i, end_i]`, merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.",
    description: "Merge overlapping interval pairs.",
    constraints: "1 <= intervals.length <= 10^4\nintervals[i].length == 2\n0 <= start_i <= end_i <= 10^4",
    inputFormat: "Space-separated numbers formatted as pairs `s1 e1 s2 e2 ...`",
    outputFormat: "Merged pairs space-separated `s1 e1 s2 e2 ...`",
    examples: [
      {
        input: "1 3 2 6 8 10 15 18",
        output: "1 6 8 10 15 18",
        explanation: "Intervals [1,3] and [2,6] overlap, merging into [1,6]."
      }
    ],
    explanation: "Sort intervals by start time. Iterate through sorted intervals; if current interval overlaps with last merged interval, update end time; otherwise append.",
    starterCode: "function mergeIntervals(arr) {\n  const intervals = [];\n  for (let i = 0; i < arr.length; i += 2) intervals.push([arr[i], arr[i + 1]]);\n  intervals.sort((a, b) => a[0] - b[0]);\n  const merged = [intervals[0]];\n  for (let i = 1; i < intervals.length; i++) {\n    const last = merged[merged.length - 1];\n    if (intervals[i][0] <= last[1]) {\n      last[1] = Math.max(last[1], intervals[i][1]);\n    } else {\n      merged.push(intervals[i]);\n    }\n  }\n  return merged.flat().join(' ');\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "1 3 2 6 8 10 15 18", expected: "1 6 8 10 15 18" },
      { input: "1 4 4 5", expected: "1 5" }
    ],
    hiddenTestCases: [
      { input: "1 4 2 3", expected: "1 4" },
      { input: "6 8 1 9 2 4", expected: "1 9" },
      { input: "1 4 5 6", expected: "1 4 5 6" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-18",
    id: "benchmark-coding-18",
    title: "Group Anagrams",
    company: "benchmark",
    difficulty: "Medium",
    category: "Strings",
    tags: ["Array", "Hash Table", "String", "Sorting"],
    marks: 10,
    source: "practice",
    problemStatement: "Given an array of strings `strs`, group the anagrams together. Return the count of anagram groups followed by each group sorted lexicographically.",
    description: "Group words that are anagrams of one another.",
    constraints: "1 <= strs.length <= 10^4\n0 <= strs[i].length <= 100\nstrs[i] consists of lowercase English letters.",
    inputFormat: "Space-separated words on a single line.",
    outputFormat: "Count of anagram groups.",
    examples: [
      {
        input: "eat tea tan ate nat bat",
        output: "3",
        explanation: "Groups are ['bat'], ['nat', 'tan'], ['ate', 'eat', 'tea']. Total groups = 3."
      }
    ],
    explanation: "Use sorted string characters as hash map keys. Map each string into its canonical anagram bucket.",
    starterCode: "function groupAnagramsCount(strs) {\n  const map = new Map();\n  for (const s of strs) {\n    const key = s.split('').sort().join('');\n    if (!map.has(key)) map.set(key, []);\n    map.get(key).push(s);\n  }\n  return map.size;\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "eat tea tan ate nat bat", expected: "3" },
      { input: "a", expected: "1" }
    ],
    hiddenTestCases: [
      { input: "abc bca cab xyz zyx", expected: "2" },
      { input: "hello world", expected: "2" },
      { input: "aaa aaa aaa", expected: "1" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-19",
    id: "benchmark-coding-19",
    title: "Find Peak Element",
    company: "benchmark",
    difficulty: "Medium",
    category: "Searching",
    tags: ["Array", "Binary Search"],
    marks: 10,
    source: "practice",
    problemStatement: "A peak element is an element that is strictly greater than its neighbors. Given a 0-indexed integer array `nums`, find a peak element, and return its index in O(log n) time.",
    description: "Find index of any local maximum in array.",
    constraints: "1 <= nums.length <= 1000\n-2^31 <= nums[i] <= 2^31 - 1\nnums[i] != nums[i + 1] for all valid i.",
    inputFormat: "Space-separated integers.",
    outputFormat: "Index of peak element.",
    examples: [
      {
        input: "1 2 3 1",
        output: "2",
        explanation: "3 is a peak element and its index is 2."
      }
    ],
    explanation: "Use binary search: if nums[mid] < nums[mid + 1], a peak must exist in the right half (low = mid + 1); otherwise a peak exists in the left half (high = mid).",
    starterCode: "function findPeakElement(nums) {\n  let low = 0, high = nums.length - 1;\n  while (low < high) {\n    const mid = Math.floor((low + high) / 2);\n    if (nums[mid] < nums[mid + 1]) low = mid + 1;\n    else high = mid;\n  }\n  return low;\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "1 2 3 1", expected: "2" },
      { input: "1 2 1 3 5 6 4", expected: "5" }
    ],
    hiddenTestCases: [
      { input: "1", expected: "0" },
      { input: "1 2", expected: "1" },
      { input: "2 1", expected: "0" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-20",
    id: "benchmark-coding-20",
    title: "Kth Largest Element in an Array",
    company: "benchmark",
    difficulty: "Medium",
    category: "Sorting",
    tags: ["Array", "Divide and Conquer", "Sorting", "Heap"],
    marks: 10,
    source: "practice",
    problemStatement: "Given an integer array `nums` and an integer `k`, return the `k`th largest element in the array. You must solve it without sorting the entire array naively if possible (e.g. Quickselect / Min-Heap).",
    description: "Find the kth greatest element in the array.",
    constraints: "1 <= k <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4",
    inputFormat: "Line 1: Space-separated integers.\nLine 2: Integer k.",
    outputFormat: "A single integer — the kth largest element.",
    examples: [
      {
        input: "3 2 1 5 6 4\n2",
        output: "5",
        explanation: "The second largest element is 5."
      },
      {
        input: "3 2 3 1 2 4 5 5 6\n4",
        output: "4",
        explanation: "The 4th largest element is 4."
      }
    ],
    explanation: "Use a Min-Heap of size k or Quickselect algorithm with average O(n) time complexity.",
    starterCode: "function findKthLargest(nums, k) {\n  nums.sort((a, b) => b - a);\n  return nums[k - 1];\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "3 2 1 5 6 4\n2", expected: "5" },
      { input: "3 2 3 1 2 4 5 5 6\n4", expected: "4" }
    ],
    hiddenTestCases: [
      { input: "1\n1", expected: "1" },
      { input: "7 10 4 3 20 15\n3", expected: "10" },
      { input: "-1 -2 -3 -4\n2", expected: "-2" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-21",
    id: "benchmark-coding-21",
    title: "Subarray Sum Equals K",
    company: "benchmark",
    difficulty: "Medium",
    category: "Arrays",
    tags: ["Array", "Hash Table", "Prefix Sum"],
    marks: 10,
    source: "practice",
    problemStatement: "Given an array of integers `nums` and an integer `k`, return the total number of subarrays whose sum equals to `k`.",
    description: "Count contiguous subarrays summing exactly to k.",
    constraints: "1 <= nums.length <= 2 * 10^4\n-1000 <= nums[i] <= 1000\n-10^7 <= k <= 10^7",
    inputFormat: "Line 1: Space-separated integers.\nLine 2: Target sum k.",
    outputFormat: "Count of subarrays.",
    examples: [
      {
        input: "1 1 1\n2",
        output: "2",
        explanation: "Subarrays [1,1] at [0,1] and [1,2] sum to 2."
      },
      {
        input: "1 2 3\n3",
        output: "2",
        explanation: "[1,2] and [3] sum to 3."
      }
    ],
    explanation: "Maintain running prefix sum and hash map of prefix sum frequencies. For each sum s, add count of (s - k) seen so far in O(n) time.",
    starterCode: "function subarraySum(nums, k) {\n  let count = 0, sum = 0;\n  const map = new Map([[0, 1]]);\n  for (const n of nums) {\n    sum += n;\n    if (map.has(sum - k)) count += map.get(sum - k);\n    map.set(sum, (map.get(sum) || 0) + 1);\n  }\n  return count;\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "1 1 1\n2", expected: "2" },
      { input: "1 2 3\n3", expected: "2" }
    ],
    hiddenTestCases: [
      { input: "1 -1 0\n0", expected: "3" },
      { input: "3 4 7 2 -3 1 4 2\n7", expected: "4" },
      { input: "1\n0", expected: "0" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-22",
    id: "benchmark-coding-22",
    title: "Next Greater Element",
    company: "benchmark",
    difficulty: "Medium",
    category: "Stack",
    tags: ["Array", "Stack", "Monotonic Stack"],
    marks: 10,
    source: "practice",
    problemStatement: "Given an array of integers `nums`, find the next greater element for each element. The next greater element of a number `x` is the first greater number to its right in the array. If it doesn't exist, output -1 for that position.",
    description: "Find first greater element to right for every array index.",
    constraints: "1 <= nums.length <= 10^5\n-10^9 <= nums[i] <= 10^9",
    inputFormat: "Space-separated integers.",
    outputFormat: "Space-separated next greater elements.",
    examples: [
      {
        input: "4 5 2 25",
        output: "5 25 25 -1",
        explanation: "Next greater for 4 is 5, for 5 is 25, for 2 is 25, for 25 is -1."
      }
    ],
    explanation: "Use a monotonic decreasing stack traversing right-to-left. Pop elements <= current, stack top is next greater.",
    starterCode: "function nextGreaterElements(nums) {\n  const n = nums.length;\n  const res = new Array(n).fill(-1);\n  const stack = [];\n  for (let i = n - 1; i >= 0; i--) {\n    while (stack.length && stack[stack.length - 1] <= nums[i]) {\n      stack.pop();\n    }\n    if (stack.length) res[i] = stack[stack.length - 1];\n    stack.push(nums[i]);\n  }\n  return res.join(' ');\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "4 5 2 25", expected: "5 25 25 -1" },
      { input: "13 7 6 12", expected: "-1 12 12 -1" }
    ],
    hiddenTestCases: [
      { input: "1 2 3 4 5", expected: "2 3 4 5 -1" },
      { input: "5 4 3 2 1", expected: "-1 -1 -1 -1 -1" },
      { input: "1", expected: "-1" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-23",
    id: "benchmark-coding-23",
    title: "Daily Temperatures",
    company: "benchmark",
    difficulty: "Medium",
    category: "Stack",
    tags: ["Array", "Stack", "Monotonic Stack"],
    marks: 10,
    source: "practice",
    problemStatement: "Given an array of integers `temperatures` represents the daily temperatures, return an array `answer` such that `answer[i]` is the number of days you have to wait after the `i`th day to get a warmer temperature. If there is no future day for which this is possible, keep `answer[i] == 0` instead.",
    description: "Calculate days until a warmer temperature occurs.",
    constraints: "1 <= temperatures.length <= 10^5\n30 <= temperatures[i] <= 100",
    inputFormat: "Space-separated daily temperatures.",
    outputFormat: "Space-separated wait days.",
    examples: [
      {
        input: "73 74 75 71 69 72 76 73",
        output: "1 1 4 2 1 1 0 0",
        explanation: "Day 0 (73) waits 1 day for 74. Day 2 (75) waits 4 days for 76."
      }
    ],
    explanation: "Use a monotonic decreasing stack storing indices. Pop when current temperature > stack top temperature and set wait days.",
    starterCode: "function dailyTemperatures(temps) {\n  const n = temps.length;\n  const res = new Array(n).fill(0);\n  const stack = [];\n  for (let i = 0; i < n; i++) {\n    while (stack.length && temps[i] > temps[stack[stack.length - 1]]) {\n      const prevIdx = stack.pop();\n      res[prevIdx] = i - prevIdx;\n    }\n    stack.push(i);\n  }\n  return res.join(' ');\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "73 74 75 71 69 72 76 73", expected: "1 1 4 2 1 1 0 0" },
      { input: "30 40 50 60", expected: "1 1 1 0" }
    ],
    hiddenTestCases: [
      { input: "30 60 90", expected: "1 1 0" },
      { input: "90 80 70", expected: "0 0 0" },
      { input: "50", expected: "0" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-24",
    id: "benchmark-coding-24",
    title: "Reverse Linked List",
    company: "benchmark",
    difficulty: "Easy",
    category: "Linked List",
    tags: ["Linked List", "Recursion"],
    marks: 10,
    source: "interview_reported",
    problemStatement: "Given the elements of a singly linked list space-separated, reverse the list and return the space-separated values of the reversed linked list.",
    description: "Reverse a singly linked list in O(n) time.",
    constraints: "0 <= Number of nodes <= 5000\n-5000 <= Node.val <= 5000",
    inputFormat: "Space-separated node values.",
    outputFormat: "Space-separated reversed node values.",
    examples: [
      {
        input: "1 2 3 4 5",
        output: "5 4 3 2 1",
        explanation: "1->2->3->4->5 becomes 5->4->3->2->1."
      }
    ],
    explanation: "Maintain `prev = null`, `curr = head`. In each step, store `next = curr.next`, set `curr.next = prev`, advance `prev = curr` and `curr = next`.",
    starterCode: "function reverseLinkedList(values) {\n  if (!values.length) return '';\n  return values.reverse().join(' ');\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "1 2 3 4 5", expected: "5 4 3 2 1" },
      { input: "1 2", expected: "2 1" }
    ],
    hiddenTestCases: [
      { input: "1", expected: "1" },
      { input: "10 20 30 40", expected: "40 30 20 10" },
      { input: "-5 0 5", expected: "5 0 -5" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-25",
    id: "benchmark-coding-25",
    title: "Middle of the Linked List",
    company: "benchmark",
    difficulty: "Easy",
    category: "Linked List",
    tags: ["Linked List", "Two Pointers"],
    marks: 10,
    source: "interview_reported",
    problemStatement: "Given the elements of a singly linked list, return the value of the middle node. If there are two middle nodes, return the second middle node (using Tortoise and Hare / slow-fast pointer approach).",
    description: "Find middle element of linked list using slow and fast pointers.",
    constraints: "1 <= Number of nodes <= 100\n1 <= Node.val <= 100",
    inputFormat: "Space-separated integers representing linked list nodes.",
    outputFormat: "A single integer value of the middle node.",
    examples: [
      {
        input: "1 2 3 4 5",
        output: "3",
        explanation: "Middle node is 3."
      },
      {
        input: "1 2 3 4 5 6",
        output: "4",
        explanation: "For even length list, second middle node is 4."
      }
    ],
    explanation: "Advance `slow` by 1 step and `fast` by 2 steps. When `fast` reaches end, `slow` is at the middle node.",
    starterCode: "function findMiddleNode(values) {\n  let slow = 0, fast = 0;\n  while (fast < values.length && fast + 1 < values.length) {\n    slow++;\n    fast += 2;\n  }\n  return values[slow];\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "1 2 3 4 5", expected: "3" },
      { input: "1 2 3 4 5 6", expected: "4" }
    ],
    hiddenTestCases: [
      { input: "1", expected: "1" },
      { input: "10 20", expected: "20" },
      { input: "5 10 15 20 25 30 35", expected: "20" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-26",
    id: "benchmark-coding-26",
    title: "String Compression (Run-Length Encoding)",
    company: "benchmark",
    difficulty: "Medium",
    category: "Strings",
    tags: ["Two Pointers", "String"],
    marks: 10,
    source: "practice",
    problemStatement: "Given an array of characters `chars`, compress it using run-length encoding: for each group of consecutive repeating characters, write the character followed by the group's length (only if length > 1). Return the compressed string.",
    description: "Compress string by replacing repeating characters with character and count.",
    constraints: "1 <= chars.length <= 2000",
    inputFormat: "A single string of characters.",
    outputFormat: "Compressed string result.",
    examples: [
      {
        input: "aabbccc",
        output: "a2b2c3",
        explanation: "Consecutive groups 'aa' -> 'a2', 'bb' -> 'b2', 'ccc' -> 'c3'."
      },
      {
        input: "a",
        output: "a",
        explanation: "Single character group has count 1 so length is omitted."
      }
    ],
    explanation: "Two pointers scanning runs of identical characters. Append character and count if count > 1.",
    starterCode: "function compressString(s) {\n  let res = '', i = 0;\n  while (i < s.length) {\n    let j = i;\n    while (j < s.length && s[j] === s[i]) j++;\n    const count = j - i;\n    res += s[i];\n    if (count > 1) res += count;\n    i = j;\n  }\n  return res;\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "aabbccc", expected: "a2b2c3" },
      { input: "a", expected: "a" }
    ],
    hiddenTestCases: [
      { input: "abbbbbbbbbbbb", expected: "ab12" },
      { input: "abcd", expected: "abcd" },
      { input: "zzzzz", expected: "z5" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-27",
    id: "benchmark-coding-27",
    title: "Maximum Depth of Binary Tree",
    company: "benchmark",
    difficulty: "Easy",
    category: "Trees",
    tags: ["Tree", "Depth-First Search", "Breadth-First Search", "Binary Tree"],
    marks: 10,
    source: "practice",
    problemStatement: "Given the level-order traversal of a binary tree (with 'null' representing empty nodes), return its maximum depth. A binary tree's maximum depth is the number of nodes along the longest path from the root node down to the farthest leaf node.",
    description: "Calculate the height/maximum depth of a binary tree.",
    constraints: "The number of nodes in the tree is in the range [0, 10^4].\n-100 <= Node.val <= 100",
    inputFormat: "Space-separated values representing level-order traversal (e.g. `3 9 20 null null 15 7`).",
    outputFormat: "A single integer maximum depth.",
    examples: [
      {
        input: "3 9 20 null null 15 7",
        output: "3",
        explanation: "Root (3) -> (20) -> (15 or 7) gives depth 3."
      },
      {
        input: "1 null 2",
        output: "2",
        explanation: "Root 1 -> Right child 2 gives depth 2."
      }
    ],
    explanation: "Recursively compute `maxDepth = 1 + max(maxDepth(left), maxDepth(right))` or perform level-order BFS counting levels.",
    starterCode: "function maxDepth(nodes) {\n  if (!nodes.length || nodes[0] === 'null') return 0;\n  // Level-order reconstruct and compute depth\n  let depth = 0, queue = [0];\n  while (queue.length) {\n    depth++;\n    const size = queue.length;\n    for (let i = 0; i < size; i++) {\n      const idx = queue.shift();\n      const left = 2 * idx + 1, right = 2 * idx + 2;\n      if (left < nodes.length && nodes[left] !== 'null') queue.push(left);\n      if (right < nodes.length && nodes[right] !== 'null') queue.push(right);\n    }\n  }\n  return depth;\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "3 9 20 null null 15 7", expected: "3" },
      { input: "1 null 2", expected: "2" }
    ],
    hiddenTestCases: [
      { input: "1", expected: "1" },
      { input: "null", expected: "0" },
      { input: "1 2 3 4 5", expected: "3" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-28",
    id: "benchmark-coding-28",
    title: "Invert Binary Tree",
    company: "benchmark",
    difficulty: "Easy",
    category: "Trees",
    tags: ["Tree", "Depth-First Search", "Breadth-First Search", "Binary Tree"],
    marks: 10,
    source: "practice",
    problemStatement: "Given the level-order traversal of a binary tree, invert the tree (swap every left and right subtree recursively) and return the resulting level-order traversal.",
    description: "Invert a binary tree in-place.",
    constraints: "The number of nodes in the tree is in the range [0, 100].\n-100 <= Node.val <= 100",
    inputFormat: "Space-separated level-order integers (e.g. `4 2 7 1 3 6 9`).",
    outputFormat: "Space-separated inverted level-order integers.",
    examples: [
      {
        input: "4 2 7 1 3 6 9",
        output: "4 7 2 9 6 3 1",
        explanation: "Subtrees at each level are swapped."
      }
    ],
    explanation: "For each node, swap `node.left` and `node.right`, then recursively invert left and right child subtrees.",
    starterCode: "function invertTree(nodes) {\n  if (!nodes.length) return '';\n  // For full binary array: mirror each level\n  const res = [];\n  let level = 0;\n  let i = 0;\n  while (i < nodes.length) {\n    const count = Math.min(Math.pow(2, level), nodes.length - i);\n    const slice = nodes.slice(i, i + count).reverse();\n    res.push(...slice);\n    i += count;\n    level++;\n  }\n  return res.join(' ');\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "4 2 7 1 3 6 9", expected: "4 7 2 9 6 3 1" },
      { input: "2 1 3", expected: "2 3 1" }
    ],
    hiddenTestCases: [
      { input: "1", expected: "1" },
      { input: "1 2", expected: "1 2" },
      { input: "10 5 15", expected: "10 15 5" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-29",
    id: "benchmark-coding-29",
    title: "Trapping Rain Water",
    company: "benchmark",
    difficulty: "Hard",
    category: "Arrays",
    tags: ["Array", "Two Pointers", "Dynamic Programming", "Stack"],
    marks: 10,
    source: "practice",
    problemStatement: "Given `n` non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.",
    description: "Calculate total trapped rainwater volume in elevation map.",
    constraints: "n == height.length\n1 <= n <= 2 * 10^4\n0 <= height[i] <= 10^5",
    inputFormat: "Space-separated heights.",
    outputFormat: "A single integer — total trapped water.",
    examples: [
      {
        input: "0 1 0 2 1 0 1 3 2 1 2 1",
        output: "6",
        explanation: "Total 6 units of rain water are trapped."
      },
      {
        input: "4 2 0 3 2 5",
        output: "9",
        explanation: "Total 9 units of rain water are trapped."
      }
    ],
    explanation: "Two pointers `left` and `right` with `leftMax` and `rightMax`. At each step, trap `max(0, leftMax - height[left])` or `max(0, rightMax - height[right])` in O(n) time and O(1) space.",
    starterCode: "function trap(height) {\n  let l = 0, r = height.length - 1;\n  let leftMax = 0, rightMax = 0, total = 0;\n  while (l < r) {\n    if (height[l] <= height[r]) {\n      if (height[l] >= leftMax) leftMax = height[l];\n      else total += leftMax - height[l];\n      l++;\n    } else {\n      if (height[r] >= rightMax) rightMax = height[r];\n      else total += rightMax - height[r];\n      r--;\n    }\n  }\n  return total;\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "0 1 0 2 1 0 1 3 2 1 2 1", expected: "6" },
      { input: "4 2 0 3 2 5", expected: "9" }
    ],
    hiddenTestCases: [
      { input: "1 2 3", expected: "0" },
      { input: "3 0 0 2 0 4", expected: "10" },
      { input: "2 0 2", expected: "2" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-30",
    id: "benchmark-coding-30",
    title: "Longest Palindromic Substring",
    company: "benchmark",
    difficulty: "Medium",
    category: "Strings",
    tags: ["Two Pointers", "String", "Dynamic Programming"],
    marks: 10,
    source: "practice",
    problemStatement: "Given a string `s`, return the longest palindromic substring in `s`.",
    description: "Find longest contiguous palindromic substring.",
    constraints: "1 <= s.length <= 1000\ns consists of only digits and English letters.",
    inputFormat: "A single string s.",
    outputFormat: "Longest palindromic substring.",
    examples: [
      {
        input: "babad",
        output: "bab",
        explanation: "'bab' or 'aba' is valid."
      },
      {
        input: "cbbd",
        output: "bb",
        explanation: "'bb' is the longest palindrome."
      }
    ],
    explanation: "Expand around center for each index (both odd center i and even center i, i+1) in O(n^2) time and O(1) space.",
    starterCode: "function longestPalindrome(s) {\n  if (!s || s.length < 2) return s;\n  let start = 0, maxLen = 1;\n  const expand = (l, r) => {\n    while (l >= 0 && r < s.length && s[l] === s[r]) {\n      if (r - l + 1 > maxLen) {\n        start = l;\n        maxLen = r - l + 1;\n      }\n      l--; r++;\n    }\n  };\n  for (let i = 0; i < s.length; i++) {\n    expand(i, i);\n    expand(i, i + 1);\n  }\n  return s.substring(start, start + maxLen);\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "babad", expected: "bab" },
      { input: "cbbd", expected: "bb" }
    ],
    hiddenTestCases: [
      { input: "a", expected: "a" },
      { input: "racecar", expected: "racecar" },
      { input: "aacabdkacaa", expected: "aca" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-31",
    id: "benchmark-coding-31",
    title: "Validate Binary Search Tree",
    company: "benchmark",
    difficulty: "Medium",
    category: "Trees",
    tags: ["Tree", "Depth-First Search", "Binary Search Tree", "Binary Tree"],
    marks: 10,
    source: "practice",
    problemStatement: "Given the level-order traversal of a binary tree, determine if it is a valid binary search tree (BST). A valid BST satisfies: left subtree contains only nodes with values strictly less than root's value, and right subtree contains only nodes with values strictly greater than root's value.",
    description: "Determine whether binary tree satisfies BST property.",
    constraints: "The number of nodes in the tree is in the range [1, 10^4].\n-2^31 <= Node.val <= 2^31 - 1",
    inputFormat: "Space-separated level-order traversal (e.g. `2 1 3`).",
    outputFormat: "`true` or `false`.",
    examples: [
      {
        input: "2 1 3",
        output: "true",
        explanation: "Left child 1 < 2 < Right child 3. Valid BST."
      },
      {
        input: "5 1 4 null null 3 6",
        output: "false",
        explanation: "The root node's value is 5 but its right child's value is 4."
      }
    ],
    explanation: "Validate recursively with range constraints (minVal, maxVal). Every node must strictly satisfy minVal < node.val < maxVal.",
    starterCode: "function isValidBST(nodes) {\n  if (!nodes.length) return true;\n  // Check level-order BST validation\n  const validate = (idx, min, max) => {\n    if (idx >= nodes.length || nodes[idx] === 'null') return true;\n    const val = Number(nodes[idx]);\n    if (val <= min || val >= max) return false;\n    return validate(2 * idx + 1, min, val) && validate(2 * idx + 2, val, max);\n  };\n  return validate(0, -Infinity, Infinity);\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "2 1 3", expected: "true" },
      { input: "5 1 4 null null 3 6", expected: "false" }
    ],
    hiddenTestCases: [
      { input: "10 5 15 null null 6 20", expected: "false" },
      { input: "1", expected: "true" },
      { input: "2 2 2", expected: "false" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  },
  {
    questionId: "benchmark-coding-32",
    id: "benchmark-coding-32",
    title: "Sliding Window Maximum",
    company: "benchmark",
    difficulty: "Hard",
    category: "Queue",
    tags: ["Array", "Queue", "Sliding Window", "Monotonic Queue"],
    marks: 10,
    source: "practice",
    problemStatement: "You are given an array of integers `nums`, there is a sliding window of size `k` which is moving from the very left of the array to the very right. You can only see the `k` numbers in the window. Each time the sliding window moves right by one position, return the max sliding window.",
    description: "Find maximum value in every sliding window of size k in O(n) time.",
    constraints: "1 <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4\n1 <= k <= nums.length",
    inputFormat: "Line 1: Space-separated integers.\nLine 2: Window size k.",
    outputFormat: "Space-separated maximums for each window.",
    examples: [
      {
        input: "1 3 -1 -3 5 3 6 7\n3",
        output: "3 3 5 5 6 7",
        explanation: "Window maxes: [1,3,-1]->3, [3,-1,-3]->3, [-1,-3,5]->5, [-3,5,3]->5, [5,3,6]->6, [3,6,7]->7."
      }
    ],
    explanation: "Use a deque storing indices in monotonically decreasing order of values. Front of deque always holds maximum of current window.",
    starterCode: "function maxSlidingWindow(nums, k) {\n  const res = [];\n  const deque = [];\n  for (let i = 0; i < nums.length; i++) {\n    while (deque.length && deque[0] <= i - k) deque.shift();\n    while (deque.length && nums[deque[deque.length - 1]] <= nums[i]) deque.pop();\n    deque.push(i);\n    if (i >= k - 1) res.push(nums[deque[0]]);\n  }\n  return res.join(' ');\n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "1 3 -1 -3 5 3 6 7\n3", expected: "3 3 5 5 6 7" },
      { input: "1\n1", expected: "1" }
    ],
    hiddenTestCases: [
      { input: "1 -1\n1", expected: "1 -1" },
      { input: "9 11\n2", expected: "11" },
      { input: "4 -2\n2", expected: "4" }
    ],
    timeLimit: 1000,
    memoryLimit: 256
  }
];
