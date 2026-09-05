import { getStarterCode } from "../../frontend/src/utils/coding/starterGenerator.js";
import { wrapFunctionHarness, compareOutputs } from "../services/judge0Service.js";

async function runTests() {
  console.log("=========================================");
  console.log("LEETCODE CODING ROUND VERIFICATION SUITE");
  console.log("=========================================\n");

  const sampleProblem = {
    title: "Two Sum",
    problemTitle: "Two Sum",
    functionName: "twoSum",
    returnType: "int[]",
    parameters: [
      { name: "nums", type: "int[]" },
      { name: "target", type: "int" }
    ],
  };

  // 1. Verify Starter Code Generation for 4 languages
  const pyStarter = getStarterCode(sampleProblem, "python");
  const cppStarter = getStarterCode(sampleProblem, "cpp");
  const javaStarter = getStarterCode(sampleProblem, "java");
  const jsStarter = getStarterCode(sampleProblem, "javascript");

  console.log("1. Starter Code Generation:");
  console.log("   Python:\n" + pyStarter);
  console.log("   C++:\n" + cppStarter);
  console.log("   Java:\n" + javaStarter);
  console.log("   JavaScript:\n" + jsStarter);

  if (!pyStarter.includes("class Solution:") || !pyStarter.includes("def twoSum(self, nums, target):")) {
    throw new Error("Python starter code signature mismatch!");
  }
  if (!cppStarter.includes("class Solution {") || !cppStarter.includes("twoSum(vector<int>& nums, int target)")) {
    throw new Error("C++ starter code signature mismatch!");
  }
  if (!javaStarter.includes("class Solution {") || !javaStarter.includes("twoSum(int[] nums, int target)")) {
    throw new Error("Java starter code signature mismatch!");
  }
  if (!jsStarter.includes("var twoSum = function(nums, target)")) {
    throw new Error("JavaScript starter code signature mismatch!");
  }
  console.log("✓ Starter code generation passed for Python, C++, Java, and JavaScript!\n");

  // 2. Verify Execution Harness Wrapping
  const pyStudentCode = `class Solution:\n    def twoSum(self, nums, target):\n        return [0, 1]`;
  const pyWrapped = wrapFunctionHarness(pyStudentCode, "python");

  if (!pyWrapped.includes("Solution()") || !pyWrapped.includes("__safe_eval")) {
    throw new Error("Python function harness wrapping failed!");
  }
  console.log("✓ Function harness wrapping passed!\n");

  // 3. Verify Output Comparison
  const match1 = compareOutputs("[0,1]", "[0, 1]");
  const match2 = compareOutputs("true", "True");
  const match3 = compareOutputs("5.0", "5");

  if (!match1 || !match2 || !match3) {
    throw new Error("Output comparison failed!");
  }
  console.log("✓ Robust output comparison passed!\n");

  console.log("=========================================");
  console.log("ALL CODING ROUND UNIT TESTS PASSED (3/3)");
  console.log("=========================================");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
