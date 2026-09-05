/**
 * Cognizant Company Mock Coding Bank (32 problems)
 *
 * Difficulty Breakdown:
 * - Easy: 14 problems (~44%)
 * - Medium: 15 problems (~47%)
 * - Hard: 3 problems (~9%)
 *
 * Source Breakdown:
 * - interview_reported: 6 core candidate-reported problems
 * - practice: 26 realistic Cognizant pattern variants
 */

export const codingQuestions = [
  // 1. Character Frequency in a String (interview_reported)
  {
    questionId: "cognizant-coding-1",
    id: "cognizant-coding-1",
    title: "Character Frequency in String",
    company: "cognizant",
    difficulty: "Easy",
    category: "String",
    tags: ["String", "HashMap", "Frequency"],
    marks: 10,
    problemStatement: "Write a function `characterFrequency(s)` that takes a string `s` and returns a JSON string representing the frequency count of each character in order of their first appearance.",
    description: "Count the frequency of each character in the given string and format the result as a key-value mapping string.",
    constraints: "1 <= s.length <= 10^5\ns contains printable ASCII characters.\nTime: O(N)\nSpace: O(K) where K is number of unique characters.",
    inputFormat: "A single string s.",
    outputFormat: "A JSON string mapping each character to its integer frequency count.",
    examples: [
      {
        input: '["cognizant"]',
        output: '{"c":2,"o":1,"g":1,"n":2,"i":1,"z":1,"a":1}',
        explanation: "'c' appears 2 times, 'n' appears 2 times, other characters appear 1 time."
      },
      {
        input: '["hello"]',
        output: '{"h":1,"e":1,"l":2,"o":1}',
        explanation: "'l' appears twice, 'h', 'e', and 'o' appear once."
      }
    ],
    explanation: "Iterate through the string, accumulate counts in a map/object preserving insertion order, and serialize to JSON.",
    starterCode: "function characterFrequency(s) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: '["cognizant"]', expected: '{"c":2,"o":1,"g":1,"n":2,"i":1,"z":1,"a":1}' },
      { input: '["hello"]', expected: '{"h":1,"e":1,"l":2,"o":1}' },
      { input: '["a"]', expected: '{"a":1}' }
    ],
    hiddenTestCases: [
      { input: '["banana"]', expected: '{"b":1,"a":3,"n":2}' },
      { input: '["aabbcc"]', expected: '{"a":2,"b":2,"c":2}' },
      { input: '["genc"]', expected: '{"g":1,"e":1,"n":1,"c":1}' }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "interview_reported"
  },

  // 2. String Matching (interview_reported)
  {
    questionId: "cognizant-coding-2",
    id: "cognizant-coding-2",
    title: "String Matching / Substring Search",
    company: "cognizant",
    difficulty: "Easy",
    category: "String",
    tags: ["String", "Pattern Matching"],
    marks: 10,
    problemStatement: "Write a function `findSubstringIndex(haystack, needle)` that finds the first index of occurrence of `needle` in `haystack`. Return -1 if `needle` is not part of `haystack`.",
    description: "Locate the 0-based starting index of needle inside haystack.",
    constraints: "0 <= haystack.length, needle.length <= 10^4\nStrings consist of lowercase English characters.",
    inputFormat: "Two strings: haystack and needle.",
    outputFormat: "An integer representing the first index or -1.",
    examples: [
      {
        input: '["cognizantgenc", "genc"]',
        output: "9",
        explanation: "'genc' begins at index 9."
      },
      {
        input: '["leetcode", "leeto"]',
        output: "-1",
        explanation: "'leeto' is not in 'leetcode'."
      }
    ],
    explanation: "Perform sliding window or standard indexOf search to locate the needle substring.",
    starterCode: "function findSubstringIndex(haystack, needle) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: '["cognizantgenc", "genc"]', expected: "9" },
      { input: '["leetcode", "leeto"]', expected: "-1" },
      { input: '["hello", "ll"]', expected: "2" }
    ],
    hiddenTestCases: [
      { input: '["interview", "view"]', expected: "5" },
      { input: '["aaaaa", "bba"]', expected: "-1" },
      { input: '["abc", ""]', expected: "0" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "interview_reported"
  },

  // 3. Duplicate Values in Array (interview_reported)
  {
    questionId: "cognizant-coding-3",
    id: "cognizant-coding-3",
    title: "Find Duplicate Values in Array",
    company: "cognizant",
    difficulty: "Easy",
    category: "Array",
    tags: ["Array", "HashMap", "Duplicates"],
    marks: 10,
    problemStatement: "Write a function `findDuplicates(arr)` that returns a sorted array of all integers that appear more than once in `arr`.",
    description: "Identify all duplicate elements in the array and return them in ascending sorted order without repetition.",
    constraints: "1 <= arr.length <= 10^5\n-10^9 <= arr[i] <= 10^9\nTime: O(N log N)\nSpace: O(N)",
    inputFormat: "An array of integers arr.",
    outputFormat: "A sorted array of integers that appear more than once.",
    examples: [
      {
        input: "[[4, 3, 2, 7, 8, 2, 3, 1]]",
        output: "[2, 3]",
        explanation: "2 and 3 appear twice in the array."
      },
      {
        input: "[[1, 1, 2]]",
        output: "[1]",
        explanation: "1 appears twice."
      }
    ],
    explanation: "Count frequencies with a hash map or frequency set, filter elements with count > 1, and sort ascending.",
    starterCode: "function findDuplicates(arr) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "[[4, 3, 2, 7, 8, 2, 3, 1]]", expected: "[2, 3]" },
      { input: "[[1, 1, 2]]", expected: "[1]" },
      { input: "[[1, 2, 3]]", expected: "[]" }
    ],
    hiddenTestCases: [
      { input: "[[5, 5, 5, 5]]", expected: "[5]" },
      { input: "[[10, 20, 10, 30, 20, 40]]", expected: "[10, 20]" },
      { input: "[[-1, -2, -1, 0]]", expected: "[-1]" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "interview_reported"
  },

  // 4. Unique Values in List / String (interview_reported)
  {
    questionId: "cognizant-coding-4",
    id: "cognizant-coding-4",
    title: "Find Unique Elements Occurring Once",
    company: "cognizant",
    difficulty: "Easy",
    category: "Array",
    tags: ["Array", "HashMap", "Unique"],
    marks: 10,
    problemStatement: "Write a function `findUniqueElements(arr)` that returns an array of elements that appear exactly once in `arr`, maintaining their original relative order.",
    description: "Extract only the elements whose total frequency count in the array is exactly 1.",
    constraints: "1 <= arr.length <= 10^5\n-10^9 <= arr[i] <= 10^9",
    inputFormat: "An array of integers arr.",
    outputFormat: "An array containing only elements that occur once.",
    examples: [
      {
        input: "[[1, 2, 2, 3, 4, 4, 5]]",
        output: "[1, 3, 5]",
        explanation: "1, 3, and 5 appear exactly once."
      },
      {
        input: "[[1, 1, 1]]",
        output: "[]",
        explanation: "No element appears exactly once."
      }
    ],
    explanation: "First pass builds frequency map, second pass filters elements with count === 1 in original order.",
    starterCode: "function findUniqueElements(arr) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "[[1, 2, 2, 3, 4, 4, 5]]", expected: "[1, 3, 5]" },
      { input: "[[1, 1, 1]]", expected: "[]" },
      { input: "[[7, 8, 9]]", expected: "[7, 8, 9]" }
    ],
    hiddenTestCases: [
      { input: "[[10, 20, 30, 20, 10, 40]]", expected: "[30, 40]" },
      { input: "[[0, -1, 0, 2]]", expected: "[-1, 2]" },
      { input: "[[42]]", expected: "[42]" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "interview_reported"
  },

  // 5. Reverse String (interview_reported)
  {
    questionId: "cognizant-coding-5",
    id: "cognizant-coding-5",
    title: "Reverse String",
    company: "cognizant",
    difficulty: "Easy",
    category: "String",
    tags: ["String", "Two Pointers"],
    marks: 10,
    problemStatement: "Write a function `reverseString(s)` that takes a string `s` and returns the reversed string.",
    description: "Reverse the order of characters in the provided string.",
    constraints: "0 <= s.length <= 10^5\nString contains printable characters.",
    inputFormat: "A single string s.",
    outputFormat: "The reversed string.",
    examples: [
      {
        input: '["cognizant"]',
        output: '"tnazingoc"',
        explanation: "Characters reversed from end to start."
      },
      {
        input: '["developer"]',
        output: '"repoleved"',
        explanation: "Reversed string."
      }
    ],
    explanation: "Two pointer swap or reverse traversal over character array.",
    starterCode: "function reverseString(s) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: '["cognizant"]', expected: '"tnazingoc"' },
      { input: '["developer"]', expected: '"repoleved"' },
      { input: '["a"]', expected: '"a"' }
    ],
    hiddenTestCases: [
      { input: '["12345"]', expected: '"54321"' },
      { input: '["racecar"]', expected: '"racecar"' },
      { input: '[""]', expected: '""' }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "interview_reported"
  },

  // 6. Count Characters Excluding Spaces (interview_reported)
  {
    questionId: "cognizant-coding-6",
    id: "cognizant-coding-6",
    title: "Count String Length Excluding Spaces",
    company: "cognizant",
    difficulty: "Easy",
    category: "String",
    tags: ["String", "Counting"],
    marks: 10,
    problemStatement: "Write a function `countNonSpaceChars(s)` that calculates the total number of characters in string `s` excluding all whitespace characters (spaces, tabs, newlines).",
    description: "Determine the length of the string without counting spaces.",
    constraints: "0 <= s.length <= 10^5\ns contains alphanumeric and whitespace characters.",
    inputFormat: "A single string s.",
    outputFormat: "An integer count of non-space characters.",
    examples: [
      {
        input: '["Cognizant Technology Solutions"]',
        output: "28",
        explanation: "Total length is 30, with 2 spaces. 30 - 2 = 28 non-space characters."
      },
      {
        input: '["  hello   world  "]',
        output: "10",
        explanation: "'hello' (5) + 'world' (5) = 10 non-space characters."
      }
    ],
    explanation: "Iterate through string and count characters that are not whitespace.",
    starterCode: "function countNonSpaceChars(s) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: '["Cognizant Technology Solutions"]', expected: "28" },
      { input: '["  hello   world  "]', expected: "10" },
      { input: '[""]', expected: "0" }
    ],
    hiddenTestCases: [
      { input: '["a b c d e"]', expected: "5" },
      { input: '["    "]', expected: "0" },
      { input: '["GenC Next Pro"]', expected: "11" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "interview_reported"
  },

  // 7. First Non-Repeating Character (practice)
  {
    questionId: "cognizant-coding-7",
    id: "cognizant-coding-7",
    title: "First Non-Repeating Character",
    company: "cognizant",
    difficulty: "Easy",
    category: "String",
    tags: ["String", "HashMap"],
    marks: 10,
    problemStatement: "Write a function `firstUniqChar(s)` that finds the first non-repeating character in a string and returns its 0-based index. If no such character exists, return -1.",
    description: "Locate the index of the first character with a frequency of 1.",
    constraints: "1 <= s.length <= 10^5\ns consists of only lowercase English letters.",
    inputFormat: "A single string s.",
    outputFormat: "An integer index or -1.",
    examples: [
      {
        input: '["cognizant"]',
        output: "1",
        explanation: "At index 0 'c' repeats later, at index 1 'o' occurs only once."
      },
      {
        input: '["loveleetcode"]',
        output: "2",
        explanation: "'v' at index 2 is the first unique character."
      }
    ],
    explanation: "Count frequencies in a hash map, then find the first character in s whose frequency equals 1.",
    starterCode: "function firstUniqChar(s) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: '["cognizant"]', expected: "1" },
      { input: '["loveleetcode"]', expected: "2" },
      { input: '["aabb"]', expected: "-1" }
    ],
    hiddenTestCases: [
      { input: '["z"]', expected: "0" },
      { input: '["aadadaad"]', expected: "-1" },
      { input: '["gencnext"]', expected: "0" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 8. Palindrome String (practice)
  {
    questionId: "cognizant-coding-8",
    id: "cognizant-coding-8",
    title: "Valid Palindrome",
    company: "cognizant",
    difficulty: "Easy",
    category: "String",
    tags: ["String", "Two Pointers"],
    marks: 10,
    problemStatement: "Write a function `isPalindrome(s)` that determines whether a string `s` is a palindrome, considering only alphanumeric characters and ignoring case.",
    description: "Check if the alphanumeric characters of s read the same forwards and backwards.",
    constraints: "1 <= s.length <= 2 * 10^5\ns consists only of printable ASCII characters.",
    inputFormat: "A single string s.",
    outputFormat: "Boolean true if palindrome, false otherwise.",
    examples: [
      {
        input: '["A man, a plan, a canal: Panama"]',
        output: "true",
        explanation: "'amanaplanacanalpanama' is a palindrome."
      },
      {
        input: '["race a car"]',
        output: "false",
        explanation: "'raceacar' is not a palindrome."
      }
    ],
    explanation: "Filter out non-alphanumeric chars, convert to lowercase, and check with two pointers from ends.",
    starterCode: "function isPalindrome(s) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: '["A man, a plan, a canal: Panama"]', expected: "true" },
      { input: '["race a car"]', expected: "false" },
      { input: '[" "]', expected: "true" }
    ],
    hiddenTestCases: [
      { input: '["0P"]', expected: "false" },
      { input: '["No x in Nixon"]', expected: "true" },
      { input: '["Was it a car or a cat I saw?"]', expected: "true" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 9. Anagram Check (practice)
  {
    questionId: "cognizant-coding-9",
    id: "cognizant-coding-9",
    title: "Valid Anagram",
    company: "cognizant",
    difficulty: "Easy",
    category: "String",
    tags: ["String", "HashMap", "Sorting"],
    marks: 10,
    problemStatement: "Write a function `isAnagram(s, t)` that checks if string `t` is an anagram of string `s` (contains the exact same characters with identical frequencies).",
    description: "Determine if two strings are anagrams of each other.",
    constraints: "1 <= s.length, t.length <= 5 * 10^4\ns and t consist of lowercase English letters.",
    inputFormat: "Two strings s and t.",
    outputFormat: "Boolean true or false.",
    examples: [
      {
        input: '["anagram", "nagaram"]',
        output: "true",
        explanation: "Both contain 3 'a's, 1 'n', 1 'g', 1 'r', 1 'm'."
      },
      {
        input: '["rat", "car"]',
        output: "false",
        explanation: "Characters do not match."
      }
    ],
    explanation: "If lengths differ return false. Otherwise compare character frequency arrays or maps.",
    starterCode: "function isAnagram(s, t) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: '["anagram", "nagaram"]', expected: "true" },
      { input: '["rat", "car"]', expected: "false" },
      { input: '["listen", "silent"]', expected: "true" }
    ],
    hiddenTestCases: [
      { input: '["a", "a"]', expected: "true" },
      { input: '["a", "b"]', expected: "false" },
      { input: '["cognizant", "tnazingoc"]', expected: "true" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 10. Two Sum (practice)
  {
    questionId: "cognizant-coding-10",
    id: "cognizant-coding-10",
    title: "Two Sum",
    company: "cognizant",
    difficulty: "Easy",
    category: "Array",
    tags: ["Array", "HashMap"],
    marks: 10,
    problemStatement: "Write a function `twoSum(nums, target)` that returns the 0-based indices of the two numbers in `nums` such that they add up to `target`. Assume exactly one solution exists.",
    description: "Find the two indices whose values sum to the target.",
    constraints: "2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9",
    inputFormat: "An array of integers nums and an integer target.",
    outputFormat: "An array of two indices [i, j].",
    examples: [
      {
        input: "[[2, 7, 11, 15], 9]",
        output: "[0, 1]",
        explanation: "nums[0] + nums[1] = 2 + 7 = 9."
      },
      {
        input: "[[3, 2, 4], 6]",
        output: "[1, 2]",
        explanation: "nums[1] + nums[2] = 2 + 4 = 6."
      }
    ],
    explanation: "Use a hash map to store seen values and their indices. For each element, check if target - num exists in map.",
    starterCode: "function twoSum(nums, target) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "[[2, 7, 11, 15], 9]", expected: "[0, 1]" },
      { input: "[[3, 2, 4], 6]", expected: "[1, 2]" },
      { input: "[[3, 3], 6]", expected: "[0, 1]" }
    ],
    hiddenTestCases: [
      { input: "[[-1, -2, -3, -4, -5], -8]", expected: "[2, 4]" },
      { input: "[[1, 5, 8, 12, 19], 20]", expected: "[0, 4]" },
      { input: "[[0, 4, 3, 0], 0]", expected: "[0, 3]" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 11. Remove Duplicate Characters from String (practice)
  {
    questionId: "cognizant-coding-11",
    id: "cognizant-coding-11",
    title: "Remove Duplicate Characters",
    company: "cognizant",
    difficulty: "Easy",
    category: "String",
    tags: ["String", "Set"],
    marks: 10,
    problemStatement: "Write a function `removeDuplicateChars(s)` that removes all duplicate characters from string `s`, keeping only the first occurrence of each character.",
    description: "Return string with distinct characters in order of appearance.",
    constraints: "1 <= s.length <= 10^5\ns consists of printable ASCII characters.",
    inputFormat: "A single string s.",
    outputFormat: "A string with duplicates removed.",
    examples: [
      {
        input: '["cognizant"]',
        output: '"cognizat"',
        explanation: "The second 'n' is removed."
      },
      {
        input: '["programming"]',
        output: '"progamin"',
        explanation: "Duplicate 'r', 'g', 'm' removed."
      }
    ],
    explanation: "Use a Set to track seen characters and append unseen characters to result.",
    starterCode: "function removeDuplicateChars(s) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: '["cognizant"]', expected: '"cognizat"' },
      { input: '["programming"]', expected: '"progamin"' },
      { input: '["aaaaa"]', expected: '"a"' }
    ],
    hiddenTestCases: [
      { input: '["hello world"]', expected: '"helo wrd"' },
      { input: '["abcde"]', expected: '"abcde"' },
      { input: '["11223344"]', expected: '"1234"' }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 12. Move Zeroes to End (practice)
  {
    questionId: "cognizant-coding-12",
    id: "cognizant-coding-12",
    title: "Move Zeroes to End",
    company: "cognizant",
    difficulty: "Easy",
    category: "Array",
    tags: ["Array", "Two Pointers"],
    marks: 10,
    problemStatement: "Write a function `moveZeroes(nums)` that moves all 0's in the array `nums` to the end while maintaining the relative order of the non-zero elements.",
    description: "Shift zeroes to the end of the array in-place or returning the modified array.",
    constraints: "1 <= nums.length <= 10^4\n-2^31 <= nums[i] <= 2^31 - 1\nTime: O(N), Space: O(1)",
    inputFormat: "An array of integers nums.",
    outputFormat: "The modified array with 0's moved to end.",
    examples: [
      {
        input: "[[0, 1, 0, 3, 12]]",
        output: "[1, 3, 12, 0, 0]",
        explanation: "Non-zero elements retain order [1, 3, 12] followed by two zeroes."
      },
      {
        input: "[[0]]",
        output: "[0]",
        explanation: "Single zero unchanged."
      }
    ],
    explanation: "Maintain a write index pointer. Place each non-zero element at write index, then fill remaining slots with 0.",
    starterCode: "function moveZeroes(nums) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "[[0, 1, 0, 3, 12]]", expected: "[1, 3, 12, 0, 0]" },
      { input: "[[0]]", expected: "[0]" },
      { input: "[[1, 2, 3]]", expected: "[1, 2, 3]" }
    ],
    hiddenTestCases: [
      { input: "[[0, 0, 1]]", expected: "[1, 0, 0]" },
      { input: "[[4, 0, 5, 0, 6, 0]]", expected: "[4, 5, 6, 0, 0, 0]" },
      { input: "[[0, 0, 0]]", expected: "[0, 0, 0]" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 13. Second Largest Element in Array (practice)
  {
    questionId: "cognizant-coding-13",
    id: "cognizant-coding-13",
    title: "Second Largest Element",
    company: "cognizant",
    difficulty: "Easy",
    category: "Array",
    tags: ["Array", "Searching"],
    marks: 10,
    problemStatement: "Write a function `findSecondLargest(arr)` that finds the second largest distinct element in an array of integers. If no second largest distinct element exists, return -1.",
    description: "Find the strictly second largest distinct number in the array.",
    constraints: "1 <= arr.length <= 10^5\n-10^9 <= arr[i] <= 10^9\nTime: O(N), Space: O(1)",
    inputFormat: "An array of integers arr.",
    outputFormat: "An integer representing the second largest distinct element or -1.",
    examples: [
      {
        input: "[[12, 35, 1, 10, 34, 1]]",
        output: "34",
        explanation: "Largest is 35, second largest is 34."
      },
      {
        input: "[[10, 10, 10]]",
        output: "-1",
        explanation: "All elements are equal, so no second largest exists."
      }
    ],
    explanation: "Traverse array tracking largest and secondLargest variables in a single pass.",
    starterCode: "function findSecondLargest(arr) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "[[12, 35, 1, 10, 34, 1]]", expected: "34" },
      { input: "[[10, 10, 10]]", expected: "-1" },
      { input: "[[5, 20]]", expected: "5" }
    ],
    hiddenTestCases: [
      { input: "[[7]]", expected: "-1" },
      { input: "[[-5, -2, -1, -10]]", expected: "-2" },
      { input: "[[100, 99, 98]]", expected: "99" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 14. Longest Common Prefix (practice)
  {
    questionId: "cognizant-coding-14",
    id: "cognizant-coding-14",
    title: "Longest Common Prefix",
    company: "cognizant",
    difficulty: "Easy",
    category: "String",
    tags: ["String", "Prefix"],
    marks: 10,
    problemStatement: "Write a function `longestCommonPrefix(strs)` that finds the longest common prefix string amongst an array of strings. If there is no common prefix, return an empty string `\"\"`.",
    description: "Determine the longest prefix shared by all strings in the array.",
    constraints: "1 <= strs.length <= 200\n0 <= strs[i].length <= 200\nstrs[i] consists of lowercase English letters.",
    inputFormat: "An array of strings strs.",
    outputFormat: "The longest common prefix string.",
    examples: [
      {
        input: '[["flower", "flow", "flight"]]',
        output: '"fl"',
        explanation: "'fl' is common to all 3 words."
      },
      {
        input: '[["dog", "racecar", "car"]]',
        output: '""',
        explanation: "There is no common prefix."
      }
    ],
    explanation: "Use first string as baseline and shorten it whenever a mismatch is found in any other string.",
    starterCode: "function longestCommonPrefix(strs) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: '[["flower", "flow", "flight"]]', expected: '"fl"' },
      { input: '[["dog", "racecar", "car"]]', expected: '""' },
      { input: '[["cognizant", "cognitive", "cognition"]]', expected: '"cogni"' }
    ],
    hiddenTestCases: [
      { input: '[["interstellar", "interview", "internet"]]', expected: '"inte"' },
      { input: '[["a"]]', expected: '"a"' },
      { input: '[["ab", "a"]]', expected: '"a"' }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 15. Merge Two Sorted Arrays (practice - Medium)
  {
    questionId: "cognizant-coding-15",
    id: "cognizant-coding-15",
    title: "Merge Two Sorted Arrays",
    company: "cognizant",
    difficulty: "Medium",
    category: "Array",
    tags: ["Array", "Two Pointers", "Sorting"],
    marks: 10,
    problemStatement: "Write a function `mergeSortedArrays(arr1, arr2)` that merges two sorted arrays of integers into a single sorted array in non-decreasing order.",
    description: "Combine two ascending arrays into one combined sorted array in O(M+N) time.",
    constraints: "0 <= arr1.length, arr2.length <= 10^5\n-10^9 <= arr1[i], arr2[i] <= 10^9\nTime: O(M+N)\nSpace: O(M+N)",
    inputFormat: "Two sorted integer arrays arr1 and arr2.",
    outputFormat: "A single merged sorted integer array.",
    examples: [
      {
        input: "[[1, 3, 5], [2, 4, 6]]",
        output: "[1, 2, 3, 4, 5, 6]",
        explanation: "Merged elements in sorted order."
      },
      {
        input: "[[], [1, 2]]",
        output: "[1, 2]",
        explanation: "Empty array merged with [1, 2]."
      }
    ],
    explanation: "Use two pointer pointers comparing current elements of both arrays and advancing the smaller.",
    starterCode: "function mergeSortedArrays(arr1, arr2) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "[[1, 3, 5], [2, 4, 6]]", expected: "[1, 2, 3, 4, 5, 6]" },
      { input: "[[], [1, 2]]", expected: "[1, 2]" },
      { input: "[[1, 2, 3], []]", expected: "[1, 2, 3]" }
    ],
    hiddenTestCases: [
      { input: "[[10, 20, 30], [5, 15, 25, 35]]", expected: "[5, 10, 15, 20, 25, 30, 35]" },
      { input: "[[-5, 0, 5], [-10, -2, 2]]", expected: "[-10, -5, -2, 0, 2, 5]" },
      { input: "[[], []]", expected: "[]" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 16. Find Missing Number (practice - Medium)
  {
    questionId: "cognizant-coding-16",
    id: "cognizant-coding-16",
    title: "Find Missing Number in Array",
    company: "cognizant",
    difficulty: "Medium",
    category: "Array",
    tags: ["Array", "Math", "Bit Manipulation"],
    marks: 10,
    problemStatement: "Write a function `missingNumber(nums)` that takes an array `nums` containing `n` distinct numbers in the range `[0, n]` and returns the only number in the range that is missing.",
    description: "Given numbers from 0 to n with one missing, identify the missing integer in O(N) time and O(1) space.",
    constraints: "1 <= n <= 10^5\nnums.length == n\n0 <= nums[i] <= n\nAll elements of nums are unique.",
    inputFormat: "An array of integers nums.",
    outputFormat: "An integer representing the missing number.",
    examples: [
      {
        input: "[[3, 0, 1]]",
        output: "2",
        explanation: "n = 3, range [0, 3], missing number is 2."
      },
      {
        input: "[[0, 1]]",
        output: "2",
        explanation: "n = 2, range [0, 2], missing number is 2."
      }
    ],
    explanation: "Expected sum = n*(n+1)/2. The missing number is Expected sum - Actual sum (or using XOR).",
    starterCode: "function missingNumber(nums) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "[[3, 0, 1]]", expected: "2" },
      { input: "[[0, 1]]", expected: "2" },
      { input: "[[9, 6, 4, 2, 3, 5, 7, 0, 1]]", expected: "8" }
    ],
    hiddenTestCases: [
      { input: "[[0]]", expected: "1" },
      { input: "[[1]]", expected: "0" },
      { input: "[[1, 2, 3, 4, 5, 0]]", expected: "6" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 17. Rotate Array by K Positions (practice - Medium)
  {
    questionId: "cognizant-coding-17",
    id: "cognizant-coding-17",
    title: "Rotate Array by K Positions",
    company: "cognizant",
    difficulty: "Medium",
    category: "Array",
    tags: ["Array", "Two Pointers"],
    marks: 10,
    problemStatement: "Write a function `rotateArray(nums, k)` that rotates an array `nums` to the right by `k` steps, where `k` is non-negative, and returns the rotated array.",
    description: "Rotate the array cyclically to the right by k positions.",
    constraints: "1 <= nums.length <= 10^5\n-10^9 <= nums[i] <= 10^9\n0 <= k <= 10^5\nTime: O(N), Space: O(1) or O(N)",
    inputFormat: "An array of integers nums and an integer k.",
    outputFormat: "The rotated array.",
    examples: [
      {
        input: "[[1, 2, 3, 4, 5, 6, 7], 3]",
        output: "[5, 6, 7, 1, 2, 3, 4]",
        explanation: "Rotate 3 steps right: [5, 6, 7] move to front."
      },
      {
        input: "[[-1, -100, 3, 99], 2]",
        output: "[3, 99, -1, -100]",
        explanation: "Rotate 2 steps right."
      }
    ],
    explanation: "Normalize k = k % n. Reverse the entire array, reverse the first k elements, then reverse the remaining n-k elements.",
    starterCode: "function rotateArray(nums, k) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "[[1, 2, 3, 4, 5, 6, 7], 3]", expected: "[5, 6, 7, 1, 2, 3, 4]" },
      { input: "[[-1, -100, 3, 99], 2]", expected: "[3, 99, -1, -100]" },
      { input: "[[1, 2], 0]", expected: "[1, 2]" }
    ],
    hiddenTestCases: [
      { input: "[[1, 2], 3]", expected: "[2, 1]" },
      { input: "[[10, 20, 30, 40], 4]", expected: "[10, 20, 30, 40]" },
      { input: "[[42], 100]", expected: "[42]" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 18. Valid Parentheses (practice - Medium)
  {
    questionId: "cognizant-coding-18",
    id: "cognizant-coding-18",
    title: "Valid Parentheses",
    company: "cognizant",
    difficulty: "Medium",
    category: "Stack",
    tags: ["Stack", "String"],
    marks: 10,
    problemStatement: "Write a function `isValidParentheses(s)` that determines if the input string `s` containing just characters '(', ')', '{', '}', '[' and ']' has all opening brackets closed in the correct order and type.",
    description: "Validate proper matching and nesting of bracket sequences using a stack.",
    constraints: "1 <= s.length <= 10^4\ns consists of parentheses only '()[]{}'.",
    inputFormat: "A single string s.",
    outputFormat: "Boolean true if valid, false otherwise.",
    examples: [
      {
        input: '["()[]{}"]',
        output: "true",
        explanation: "Every open bracket is correctly closed by matching bracket."
      },
      {
        input: '["(]"]',
        output: "false",
        explanation: "Mismatched bracket types."
      }
    ],
    explanation: "Push opening brackets onto a stack. When a closing bracket arrives, pop and verify it matches the top of stack.",
    starterCode: "function isValidParentheses(s) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: '["()[]{}"]', expected: "true" },
      { input: '["(]"]', expected: "false" },
      { input: '["([{}])"]', expected: "true" }
    ],
    hiddenTestCases: [
      { input: '["("]', expected: "false" },
      { input: '["]"]', expected: "false" },
      { input: '["{[]}"]', expected: "true" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 19. Subarray with Given Sum (practice - Medium)
  {
    questionId: "cognizant-coding-19",
    id: "cognizant-coding-19",
    title: "Subarray with Given Sum",
    company: "cognizant",
    difficulty: "Medium",
    category: "Array",
    tags: ["Array", "Sliding Window", "HashMap"],
    marks: 10,
    problemStatement: "Write a function `subarraySum(nums, k)` that returns the total count of continuous subarrays whose sum equals `k`.",
    description: "Count continuous subarrays summing to k in O(N) time.",
    constraints: "1 <= nums.length <= 2 * 10^4\n-1000 <= nums[i] <= 1000\n-10^7 <= k <= 10^7",
    inputFormat: "An array of integers nums and an integer k.",
    outputFormat: "An integer count of matching subarrays.",
    examples: [
      {
        input: "[[1, 1, 1], 2]",
        output: "2",
        explanation: "[1, 1] at indices [0,1] and [1,2] both sum to 2."
      },
      {
        input: "[[1, 2, 3], 3]",
        output: "2",
        explanation: "[1, 2] and [3] sum to 3."
      }
    ],
    explanation: "Use prefix sum with a hash map storing prefix sum frequencies.",
    starterCode: "function subarraySum(nums, k) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "[[1, 1, 1], 2]", expected: "2" },
      { input: "[[1, 2, 3], 3]", expected: "2" },
      { input: "[[1, -1, 0], 0]", expected: "3" }
    ],
    hiddenTestCases: [
      { input: "[[3, 4, 7, 2, -3, 1, 4, 2], 7]", expected: "4" },
      { input: "[[0, 0, 0], 0]", expected: "6" },
      { input: "[[5], 5]", expected: "1" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 20. Maximum Subarray Sum (Kadane's) (practice - Medium)
  {
    questionId: "cognizant-coding-20",
    id: "cognizant-coding-20",
    title: "Maximum Subarray Sum (Kadane's Algorithm)",
    company: "cognizant",
    difficulty: "Medium",
    category: "Array",
    tags: ["Array", "Dynamic Programming", "Kadane"],
    marks: 10,
    problemStatement: "Write a function `maxSubArray(nums)` that finds the contiguous subarray (containing at least one number) which has the largest sum and returns its sum.",
    description: "Calculate the maximum sum of any contiguous non-empty subarray.",
    constraints: "1 <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4\nTime: O(N), Space: O(1)",
    inputFormat: "An array of integers nums.",
    outputFormat: "An integer representing maximum subarray sum.",
    examples: [
      {
        input: "[[-2, 1, -3, 4, -1, 2, 1, -5, 4]]",
        output: "6",
        explanation: "[4, -1, 2, 1] has the largest sum = 6."
      },
      {
        input: "[[1]]",
        output: "1",
        explanation: "Single element max sum."
      }
    ],
    explanation: "Kadane's algorithm: currentSum = max(num, currentSum + num), maxSum = max(maxSum, currentSum).",
    starterCode: "function maxSubArray(nums) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "[[-2, 1, -3, 4, -1, 2, 1, -5, 4]]", expected: "6" },
      { input: "[[1]]", expected: "1" },
      { input: "[[5, 4, -1, 7, 8]]", expected: "23" }
    ],
    hiddenTestCases: [
      { input: "[[-1]]", expected: "-1" },
      { input: "[[-3, -2, -5, -4]]", expected: "-2" },
      { input: "[[2, -1, 2, 3, 4, -5]]", expected: "10" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 21. Longest Substring Without Repeating Characters (practice - Medium)
  {
    questionId: "cognizant-coding-21",
    id: "cognizant-coding-21",
    title: "Longest Substring Without Repeating Characters",
    company: "cognizant",
    difficulty: "Medium",
    category: "String",
    tags: ["String", "Sliding Window", "HashMap"],
    marks: 10,
    problemStatement: "Write a function `lengthOfLongestSubstring(s)` that finds the length of the longest substring without repeating characters in string `s`.",
    description: "Determine the maximum length of any substring containing strictly distinct characters.",
    constraints: "0 <= s.length <= 5 * 10^4\ns consists of English letters, digits, symbols and spaces.",
    inputFormat: "A single string s.",
    outputFormat: "An integer length.",
    examples: [
      {
        input: '["abcabcbb"]',
        output: "3",
        explanation: "'abc' has length 3."
      },
      {
        input: '["bbbbb"]',
        output: "1",
        explanation: "'b' has length 1."
      }
    ],
    explanation: "Sliding window with two pointers and a map/set to track characters in the current window.",
    starterCode: "function lengthOfLongestSubstring(s) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: '["abcabcbb"]', expected: "3" },
      { input: '["bbbbb"]', expected: "1" },
      { input: '["pwwkew"]', expected: "3" }
    ],
    hiddenTestCases: [
      { input: '[""]', expected: "0" },
      { input: '["cognizant"]', expected: "8" },
      { input: '["dvdf"]', expected: "3" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 22. Product of Array Except Self (practice - Medium)
  {
    questionId: "cognizant-coding-22",
    id: "cognizant-coding-22",
    title: "Product of Array Except Self",
    company: "cognizant",
    difficulty: "Medium",
    category: "Array",
    tags: ["Array", "Prefix Product"],
    marks: 10,
    problemStatement: "Write a function `productExceptSelf(nums)` that returns an array `output` such that `output[i]` is equal to the product of all elements of `nums` except `nums[i]`, without using the division operation and in O(N) time.",
    description: "Compute array of products without division.",
    constraints: "2 <= nums.length <= 10^5\n-30 <= nums[i] <= 30\nThe product of any prefix or suffix fits in a 32-bit integer.",
    inputFormat: "An array of integers nums.",
    outputFormat: "An array of product integers.",
    examples: [
      {
        input: "[[1, 2, 3, 4]]",
        output: "[24, 12, 8, 6]",
        explanation: "[2*3*4, 1*3*4, 1*2*4, 1*2*3] = [24, 12, 8, 6]."
      },
      {
        input: "[[-1, 1, 0, -3, 3]]",
        output: "[0, 0, 9, 0, 0]",
        explanation: "Product at index 2 is (-1)*1*(-3)*3 = 9."
      }
    ],
    explanation: "Compute left prefix products in first pass, then multiply right suffix products in second pass.",
    starterCode: "function productExceptSelf(nums) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "[[1, 2, 3, 4]]", expected: "[24, 12, 8, 6]" },
      { input: "[[-1, 1, 0, -3, 3]]", expected: "[0, 0, 9, 0, 0]" },
      { input: "[[2, 3]]", expected: "[3, 2]" }
    ],
    hiddenTestCases: [
      { input: "[[1, 1, 1, 1]]", expected: "[1, 1, 1, 1]" },
      { input: "[[0, 0]]", expected: "[0, 0]" },
      { input: "[[4, 5, 1, 8]]", expected: "[40, 32, 160, 20]" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 23. Majority Element (practice - Medium)
  {
    questionId: "cognizant-coding-23",
    id: "cognizant-coding-23",
    title: "Majority Element (Boyer-Moore Voting)",
    company: "cognizant",
    difficulty: "Medium",
    category: "Array",
    tags: ["Array", "Boyer-Moore", "Counting"],
    marks: 10,
    problemStatement: "Write a function `majorityElement(nums)` that finds the majority element in array `nums`. The majority element is the element that appears more than ⌊n / 2⌋ times. Assume the majority element always exists.",
    description: "Identify element appearing > n/2 times in O(N) time and O(1) space.",
    constraints: "1 <= nums.length <= 5 * 10^4\n-10^9 <= nums[i] <= 10^9",
    inputFormat: "An array of integers nums.",
    outputFormat: "The majority integer.",
    examples: [
      {
        input: "[[3, 2, 3]]",
        output: "3",
        explanation: "3 appears 2 out of 3 times."
      },
      {
        input: "[[2, 2, 1, 1, 1, 2, 2]]",
        output: "2",
        explanation: "2 appears 4 out of 7 times."
      }
    ],
    explanation: "Boyer-Moore voting algorithm: maintain candidate and count. Increment count if match, decrement otherwise.",
    starterCode: "function majorityElement(nums) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "[[3, 2, 3]]", expected: "3" },
      { input: "[[2, 2, 1, 1, 1, 2, 2]]", expected: "2" },
      { input: "[[1]]", expected: "1" }
    ],
    hiddenTestCases: [
      { input: "[[6, 5, 5]]", expected: "5" },
      { input: "[[10, 10, 20, 10, 30, 10]]", expected: "10" },
      { input: "[[-1, -1, 2, -1]]", expected: "-1" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 24. Vowel and Consonant Frequency (practice - Medium)
  {
    questionId: "cognizant-coding-24",
    id: "cognizant-coding-24",
    title: "Count Vowels and Consonants",
    company: "cognizant",
    difficulty: "Medium",
    category: "String",
    tags: ["String", "Counting"],
    marks: 10,
    problemStatement: "Write a function `countVowelsAndConsonants(s)` that counts the number of vowels (a, e, i, o, u, case-insensitive) and consonants in string `s`, ignoring other characters, and returns `[vowelCount, consonantCount]`.",
    description: "Separate count of alphabetical vowels vs consonants.",
    constraints: "1 <= s.length <= 10^5\ns contains English letters, spaces, digits, and punctuation.",
    inputFormat: "A single string s.",
    outputFormat: "An array of two integers [vowels, consonants].",
    examples: [
      {
        input: '["Cognizant"]',
        output: "[3, 6]",
        explanation: "Vowels: o, i, a (3). Consonants: c, g, n, z, n, t (6)."
      },
      {
        input: '["Hello World!"]',
        output: "[3, 7]",
        explanation: "Vowels: e, o, o (3). Consonants: h, l, l, w, r, l, d (7)."
      }
    ],
    explanation: "Iterate through string, check if character is a letter, then classify as vowel or consonant.",
    starterCode: "function countVowelsAndConsonants(s) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: '["Cognizant"]', expected: "[3, 6]" },
      { input: '["Hello World!"]', expected: "[3, 7]" },
      { input: '["aeiou"]', expected: "[5, 0]" }
    ],
    hiddenTestCases: [
      { input: '["xyz"]', expected: "[0, 3]" },
      { input: '["12345 @#!"]', expected: "[0, 0]" },
      { input: '["GenC Next Pro 2026"]', expected: "[4, 7]" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 25. Binary Search (practice - Medium)
  {
    questionId: "cognizant-coding-25",
    id: "cognizant-coding-25",
    title: "Binary Search",
    company: "cognizant",
    difficulty: "Medium",
    category: "Searching",
    tags: ["Searching", "Binary Search", "Array"],
    marks: 10,
    problemStatement: "Write a function `binarySearch(nums, target)` that searches for `target` in a sorted array `nums` in O(log N) time. If `target` exists, return its 0-based index; otherwise, return -1.",
    description: "Locate target in sorted array using binary search.",
    constraints: "1 <= nums.length <= 10^5\n-10^4 <= nums[i], target <= 10^4\nAll integers in nums are unique and sorted in ascending order.",
    inputFormat: "A sorted array of integers nums and an integer target.",
    outputFormat: "An integer index or -1.",
    examples: [
      {
        input: "[[-1, 0, 3, 5, 9, 12], 9]",
        output: "4",
        explanation: "9 exists at index 4."
      },
      {
        input: "[[-1, 0, 3, 5, 9, 12], 2]",
        output: "-1",
        explanation: "2 does not exist in nums."
      }
    ],
    explanation: "Maintain low and high pointers, calculate mid = Math.floor((low + high) / 2), and adjust bounds.",
    starterCode: "function binarySearch(nums, target) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "[[-1, 0, 3, 5, 9, 12], 9]", expected: "4" },
      { input: "[[-1, 0, 3, 5, 9, 12], 2]", expected: "-1" },
      { input: "[[5], 5]", expected: "0" }
    ],
    hiddenTestCases: [
      { input: "[[2, 5], 5]", expected: "1" },
      { input: "[[1, 3, 5, 7, 9, 11], 1]", expected: "0" },
      { input: "[[1, 3, 5, 7, 9, 11], 11]", expected: "5" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 26. Intersection of Two Arrays (practice - Medium)
  {
    questionId: "cognizant-coding-26",
    id: "cognizant-coding-26",
    title: "Intersection of Two Arrays",
    company: "cognizant",
    difficulty: "Medium",
    category: "Array",
    tags: ["Array", "Set", "HashMap"],
    marks: 10,
    problemStatement: "Write a function `arrayIntersection(nums1, nums2)` that returns a sorted array of unique elements that are present in both `nums1` and `nums2`.",
    description: "Find common unique elements between two integer arrays in sorted order.",
    constraints: "1 <= nums1.length, nums2.length <= 10^4\n-10^9 <= nums1[i], nums2[i] <= 10^9",
    inputFormat: "Two arrays of integers nums1 and nums2.",
    outputFormat: "A sorted array of unique common elements.",
    examples: [
      {
        input: "[[1, 2, 2, 1], [2, 2]]",
        output: "[2]",
        explanation: "Unique common element is 2."
      },
      {
        input: "[[4, 9, 5], [9, 4, 9, 8, 4]]",
        output: "[4, 9]",
        explanation: "Common unique elements are 4 and 9."
      }
    ],
    explanation: "Create a Set from nums1 and filter elements of nums2 that exist in the Set, convert to Set to deduplicate, and sort.",
    starterCode: "function arrayIntersection(nums1, nums2) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "[[1, 2, 2, 1], [2, 2]]", expected: "[2]" },
      { input: "[[4, 9, 5], [9, 4, 9, 8, 4]]", expected: "[4, 9]" },
      { input: "[[1, 2, 3], [4, 5, 6]]", expected: "[]" }
    ],
    hiddenTestCases: [
      { input: "[[7, 7, 7], [7, 7]]", expected: "[7]" },
      { input: "[[-1, -2, -3], [-3, -1]]", expected: "[-3, -1]" },
      { input: "[[10, 50, 30], [30, 10, 40]]", expected: "[10, 30]" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 27. String Compression (practice - Medium)
  {
    questionId: "cognizant-coding-27",
    id: "cognizant-coding-27",
    title: "String Compression (Run-Length Encoding)",
    company: "cognizant",
    difficulty: "Medium",
    category: "String",
    tags: ["String", "Two Pointers"],
    marks: 10,
    problemStatement: "Write a function `compressString(s)` that performs basic string compression using the counts of repeated characters (Run-Length Encoding). For example, 'aabcccccaaa' becomes 'a2b1c5a3'. If the compressed string would not be strictly smaller than the original string, return the original string.",
    description: "Compress consecutive character runs into char+count format if shorter.",
    constraints: "1 <= s.length <= 10^5\ns consists of only uppercase and lowercase English letters.",
    inputFormat: "A single string s.",
    outputFormat: "The compressed string or original string if not strictly smaller.",
    examples: [
      {
        input: '["aabcccccaaa"]',
        output: '"a2b1c5a3"',
        explanation: "'a2b1c5a3' (8 chars) < 'aabcccccaaa' (11 chars)."
      },
      {
        input: '["abcdef"]',
        output: '"abcdef"',
        explanation: "Compressed would be 'a1b1c1d1e1f1' (12 chars > 6 chars), so original returned."
      }
    ],
    explanation: "Traverse string counting consecutive character groups. Compare compressed length to original length.",
    starterCode: "function compressString(s) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: '["aabcccccaaa"]', expected: '"a2b1c5a3"' },
      { input: '["abcdef"]', expected: '"abcdef"' },
      { input: '["aaaaaa"]', expected: '"a6"' }
    ],
    hiddenTestCases: [
      { input: '["aabb"]', expected: '"aabb"' },
      { input: '["WWWWWWWWWWWWBWWWWWWWWWWWWBBB"]', expected: '"W12B1W12B3"' },
      { input: '["a"]', expected: '"a"' }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 28. Matrix Transpose (practice - Medium)
  {
    questionId: "cognizant-coding-28",
    id: "cognizant-coding-28",
    title: "Transpose Matrix",
    company: "cognizant",
    difficulty: "Medium",
    category: "Matrix",
    tags: ["Matrix", "Array"],
    marks: 10,
    problemStatement: "Write a function `transposeMatrix(matrix)` that returns the transpose of a 2D integer matrix (flipping the matrix over its main diagonal, switching row and column indices).",
    description: "Swap rows and columns of an M x N matrix producing an N x M matrix.",
    constraints: "1 <= matrix.length, matrix[0].length <= 1000\n1 <= matrix.length * matrix[0].length <= 10^5\n-10^9 <= matrix[i][j] <= 10^9",
    inputFormat: "A 2D array of integers matrix.",
    outputFormat: "The transposed 2D array of integers.",
    examples: [
      {
        input: "[[[1, 2, 3], [4, 5, 6], [7, 8, 9]]]",
        output: "[[1, 4, 7], [2, 5, 8], [3, 6, 9]]",
        explanation: "3x3 matrix transposed."
      },
      {
        input: "[[[1, 2, 3], [4, 5, 6]]]",
        output: "[[1, 4], [2, 5], [3, 6]]",
        explanation: "2x3 matrix becomes 3x2 matrix."
      }
    ],
    explanation: "Create result array with dimensions cols x rows, setting res[c][r] = matrix[r][c].",
    starterCode: "function transposeMatrix(matrix) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "[[[1, 2, 3], [4, 5, 6], [7, 8, 9]]]", expected: "[[1, 4, 7], [2, 5, 8], [3, 6, 9]]" },
      { input: "[[[1, 2, 3], [4, 5, 6]]]", expected: "[[1, 4], [2, 5], [3, 6]]" },
      { input: "[[[42]]]", expected: "[[42]]" }
    ],
    hiddenTestCases: [
      { input: "[[[1, 2], [3, 4]]]", expected: "[[1, 3], [2, 4]]" },
      { input: "[[[1], [2], [3]]]", expected: "[[1, 2, 3]]" },
      { input: "[[[5, 10, 15]]]", expected: "[[5], [10], [15]]" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 29. Spiral Matrix Traversal (practice - Medium)
  {
    questionId: "cognizant-coding-29",
    id: "cognizant-coding-29",
    title: "Spiral Matrix Traversal",
    company: "cognizant",
    difficulty: "Medium",
    category: "Matrix",
    tags: ["Matrix", "Simulation"],
    marks: 10,
    problemStatement: "Write a function `spiralOrder(matrix)` that returns all elements of an `m x n` matrix in spiral order (clockwise starting from top-left).",
    description: "Traverse matrix along outer boundaries inward in clockwise order.",
    constraints: "m == matrix.length\nn == matrix[i].length\n1 <= m, n <= 100\n-100 <= matrix[i][j] <= 100",
    inputFormat: "A 2D array of integers matrix.",
    outputFormat: "A 1D array of integers in spiral order.",
    examples: [
      {
        input: "[[[1, 2, 3], [4, 5, 6], [7, 8, 9]]]",
        output: "[1, 2, 3, 6, 9, 8, 7, 4, 5]",
        explanation: "Spiral traversal: top row -> right col -> bottom row -> left col -> center."
      },
      {
        input: "[[[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]]",
        output: "[1, 2, 3, 4, 8, 12, 11, 10, 9, 5, 6, 7]",
        explanation: "Clockwise spiral path."
      }
    ],
    explanation: "Maintain four boundaries (top, bottom, left, right) and traverse in 4 directions while boundaries remain valid.",
    starterCode: "function spiralOrder(matrix) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "[[[1, 2, 3], [4, 5, 6], [7, 8, 9]]]", expected: "[1, 2, 3, 6, 9, 8, 7, 4, 5]" },
      { input: "[[[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]]", expected: "[1, 2, 3, 4, 8, 12, 11, 10, 9, 5, 6, 7]" },
      { input: "[[[7]]]", expected: "[7]" }
    ],
    hiddenTestCases: [
      { input: "[[[1, 2], [3, 4]]]", expected: "[1, 2, 4, 3]" },
      { input: "[[[1, 2, 3]]]", expected: "[1, 2, 3]" },
      { input: "[[[1], [2], [3]]]", expected: "[1, 2, 3]" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 30. Trapping Rain Water (practice - Hard)
  {
    questionId: "cognizant-coding-30",
    id: "cognizant-coding-30",
    title: "Trapping Rain Water",
    company: "cognizant",
    difficulty: "Hard",
    category: "Two Pointers",
    tags: ["Two Pointers", "Array", "Dynamic Programming"],
    marks: 10,
    problemStatement: "Write a function `trap(height)` that takes an array `height` representing an elevation map where the width of each bar is 1, and computes how much water it can trap after raining.",
    description: "Calculate units of trapped rainwater between elevation bars in O(N) time and O(1) space.",
    constraints: "n == height.length\n1 <= n <= 2 * 10^4\n0 <= height[i] <= 10^5",
    inputFormat: "An array of non-negative integers height.",
    outputFormat: "An integer representing total trapped water.",
    examples: [
      {
        input: "[[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]]",
        output: "6",
        explanation: "Total 6 units of rain water are trapped."
      },
      {
        input: "[[4, 2, 0, 3, 2, 5]]",
        output: "9",
        explanation: "Total 9 units trapped."
      }
    ],
    explanation: "Two pointers from left and right maintaining leftMax and rightMax, accumulating trapped water.",
    starterCode: "function trap(height) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: "[[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]]", expected: "6" },
      { input: "[[4, 2, 0, 3, 2, 5]]", expected: "9" },
      { input: "[[1, 2, 3]]", expected: "0" }
    ],
    hiddenTestCases: [
      { input: "[[3, 0, 2, 0, 4]]", expected: "7" },
      { input: "[[2, 0, 2]]", expected: "2" },
      { input: "[[0, 0, 0]]", expected: "0" }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 31. Group Anagrams (practice - Hard)
  {
    questionId: "cognizant-coding-31",
    id: "cognizant-coding-31",
    title: "Group Anagrams",
    company: "cognizant",
    difficulty: "Hard",
    category: "HashMap",
    tags: ["HashMap", "String", "Sorting"],
    marks: 10,
    problemStatement: "Write a function `groupAnagrams(strs)` that groups anagrams together from an array of strings. Return the grouped lists sorted by the first element of each group in alphabetical order.",
    description: "Group strings sharing identical character frequencies and return formatted output.",
    constraints: "1 <= strs.length <= 10^4\n0 <= strs[i].length <= 100\nstrs[i] consists of lowercase English letters.",
    inputFormat: "An array of strings strs.",
    outputFormat: "A 2D array of strings grouped by anagram status.",
    examples: [
      {
        input: '[["eat", "tea", "tan", "ate", "nat", "bat"]]',
        output: '[["bat"], ["eat", "tea", "ate"], ["tan", "nat"]]',
        explanation: "Words with identical sorted signatures grouped together."
      },
      {
        input: '[[""]]',
        output: '[[""]]',
        explanation: "Single empty string."
      }
    ],
    explanation: "Key each word by its sorted character string in a hash map, then collect values and sort groups deterministically.",
    starterCode: "function groupAnagrams(strs) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: '[["eat", "tea", "tan", "ate", "nat", "bat"]]', expected: '[["bat"], ["eat", "tea", "ate"], ["tan", "nat"]]' },
      { input: '[[""]]', expected: '[[""]]' },
      { input: '[["a"]]', expected: '[["a"]]' }
    ],
    hiddenTestCases: [
      { input: '[["listen", "silent", "enlist", "google"]]', expected: '[["google"], ["listen", "silent", "enlist"]]' },
      { input: '[["abc", "bca", "cab", "xyz"]]', expected: '[["abc", "bca", "cab"], ["xyz"]]' },
      { input: '[["ab", "ba", "cd", "dc"]]', expected: '[["ab", "ba"], ["cd", "dc"]]' }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  },

  // 32. Longest Palindromic Substring (practice - Hard)
  {
    questionId: "cognizant-coding-32",
    id: "cognizant-coding-32",
    title: "Longest Palindromic Substring",
    company: "cognizant",
    difficulty: "Hard",
    category: "String",
    tags: ["String", "Dynamic Programming", "Two Pointers"],
    marks: 10,
    problemStatement: "Write a function `longestPalindrome(s)` that finds and returns the longest palindromic substring in `s`. If there are multiple answers of the same max length, return the one that occurs earliest in `s`.",
    description: "Identify the longest contiguous substring in s that reads identical backwards and forwards.",
    constraints: "1 <= s.length <= 1000\ns consists of only digits and English letters.",
    inputFormat: "A single string s.",
    outputFormat: "The longest palindromic substring.",
    examples: [
      {
        input: '["babad"]',
        output: '"bab"',
        explanation: "'bab' is a valid longest palindrome starting at index 0."
      },
      {
        input: '["cbbd"]',
        output: '"bb"',
        explanation: "'bb' is the longest palindrome."
      }
    ],
    explanation: "Expand around center for each index (both odd-length and even-length centers) tracking start and maxLen.",
    starterCode: "function longestPalindrome(s) {\n  // Write your code here\n  \n}",
    supportedLanguages: ["JavaScript", "Python", "Java", "C++"],
    publicTestCases: [
      { input: '["babad"]', expected: '"bab"' },
      { input: '["cbbd"]', expected: '"bb"' },
      { input: '["a"]', expected: '"a"' }
    ],
    hiddenTestCases: [
      { input: '["racecar"]', expected: '"racecar"' },
      { input: '["cognizant"]', expected: '"c"' },
      { input: '["aacabdkacaa"]', expected: '"aca"' }
    ],
    timeLimit: 1000,
    memoryLimit: 256,
    source: "practice"
  }
];
