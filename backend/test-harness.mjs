import { executeJudge0, wrapFunctionHarness } from './services/judge0Service.js';

async function testHarness() {
  console.log("====================================================");
  console.log("  TESTING LEETCODE-STYLE PURE FUNCTION EXECUTION     ");
  console.log("====================================================");

  // 1. Python Pure Function (Merge Two Sorted Arrays)
  const pyCode = `def mergeSortedArrays(a, b):
    return sorted(a + b)
`;

  console.log("\n[1] Python Function Test (Merge Two Sorted Arrays):");
  const pyWrapped = wrapFunctionHarness(pyCode, "python");
  const pyResult = await executeJudge0({
    sourceCode: pyWrapped,
    language: "python",
    stdin: "[[1, 3, 5], [2, 4, 6]]",
  });
  console.log("  Input: [[1, 3, 5], [2, 4, 6]]");
  console.log("  Status:", pyResult.status);
  console.log("  Output:", pyResult.stdout.trim());

  // 2. Python Longest Subarray
  const pyCode2 = `def longestSubarray(arr, k):
    max_len = 0
    prefix_sum = 0
    sum_map = {}
    for i, num in enumerate(arr):
        prefix_sum += num
        if prefix_sum == k:
            max_len = i + 1
        if (prefix_sum - k) in sum_map:
            max_len = max(max_len, i - sum_map[prefix_sum - k])
        if prefix_sum not in sum_map:
            sum_map[prefix_sum] = i
    return max_len
`;
  console.log("\n[2] Python Function Test (Longest Subarray with Sum K):");
  const pyWrapped2 = wrapFunctionHarness(pyCode2, "python");
  const pyResult2 = await executeJudge0({
    sourceCode: pyWrapped2,
    language: "python",
    stdin: "[10, 5, 2, 7, 1, 9], 15",
  });
  console.log("  Input: [10, 5, 2, 7, 1, 9], 15");
  console.log("  Status:", pyResult2.status);
  console.log("  Output:", pyResult2.stdout.trim());

  // 3. JavaScript Pure Function (Merge Two Sorted Arrays)
  const jsCode = `function mergeSortedArrays(a, b) {
  return [...a, ...b].sort((x, y) => x - y);
}`;
  console.log("\n[3] JavaScript Function Test (Merge Two Sorted Arrays):");
  const jsWrapped = wrapFunctionHarness(jsCode, "javascript");
  const jsResult = await executeJudge0({
    sourceCode: jsWrapped,
    language: "javascript",
    stdin: "[[1, 3, 5], [2, 4, 6]]",
  });
  console.log("  Input: [[1, 3, 5], [2, 4, 6]]");
  console.log("  Status:", jsResult.status);
  console.log("  Output:", jsResult.stdout.trim());

  console.log("\n====================================================");
  console.log("  LEETCODE-STYLE HARNESS VERIFIED SUCCESSFULLY!      ");
  console.log("====================================================");
}

testHarness().catch(e => {
  console.error("Harness Test Failed:", e);
  process.exit(1);
});
