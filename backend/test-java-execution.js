/**
 * Java Execution Test Suite
 * Tests all positive, negative, and regression cases for Java execution.
 * Run: node test-java-execution.js
 */

import {
  executeSingle,
  executeBatch,
  normalizeLanguage,
  isLanguageSupported,
  getSupportedLanguages,
  getExecutionProviderInfo,
} from "./services/codeExecutionService.js";

const PASS = "\x1b[32mPASS\x1b[0m";
const FAIL = "\x1b[31mFAIL\x1b[0m";
const WARN = "\x1b[33mWARN\x1b[0m";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${PASS}: ${message}`);
  } else {
    failedTests++;
    console.log(`  ${FAIL}: ${message}`);
  }
}

function assertEq(actual, expected, message) {
  totalTests++;
  if (actual === expected) {
    passedTests++;
    console.log(`  ${PASS}: ${message}`);
  } else {
    failedTests++;
    console.log(`  ${FAIL}: ${message}`);
    console.log(`    Expected: ${JSON.stringify(expected)}`);
    console.log(`    Actual:   ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(str, substr, message) {
  totalTests++;
  if (String(str).includes(substr)) {
    passedTests++;
    console.log(`  ${PASS}: ${message}`);
  } else {
    failedTests++;
    console.log(`  ${FAIL}: ${message}`);
    console.log(`    String: ${String(str).substring(0, 200)}`);
    console.log(`    Expected to include: ${substr}`);
  }
}

async function runTests() {
  console.log("========================================");
  console.log("  JAVA EXECUTION TEST SUITE");
  console.log("========================================\n");

  // Check environment
  const info = getExecutionProviderInfo();
  console.log("Execution Provider:", info.provider);
  console.log("Java available:", info.images.java);
  console.log("");

  if (!info.images.java) {
    console.log(`${FAIL}: Java toolchain not available. Cannot run tests.`);
    process.exit(1);
  }

  // ==========================================
  // POSITIVE TESTS
  // ==========================================
  console.log("--- POSITIVE TESTS ---\n");

  // TEST 1 — STRING
  console.log("TEST 1: String parameter");
  {
    const code = `
class Solution {
    public static int solve(String s) {
        return s.length();
    }
}`;
    const result = await executeSingle("java", code, ["hello"], { timeLimitMs: 5000 });
    assertEq(result.type, "success", "Execution succeeds");
    assertEq(result.output, "5", "Output is 5");
  }

  // TEST 2 — TWO INTS
  console.log("\nTEST 2: Two int parameters");
  {
    const code = `
class Solution {
    public static int solve(int a, int b) {
        return a + b;
    }
}`;
    const result = await executeSingle("java", code, [5, 7], { timeLimitMs: 5000 });
    assertEq(result.type, "success", "Execution succeeds");
    assertEq(result.output, "12", "Output is 12");
  }

  // TEST 3 — ARRAY + INT
  console.log("\nTEST 3: Array + int parameters");
  {
    const code = `
class Solution {
    public static int solve(int[] nums, int target) {
        return nums.length + target;
    }
}`;
    const result = await executeSingle("java", code, [[1, 2, 3], 5], { timeLimitMs: 5000 });
    assertEq(result.type, "success", "Execution succeeds");
    assertEq(result.output, "8", "Output is 8");
  }

  // TEST 4 — STRING RETURN
  console.log("\nTEST 4: String return type");
  {
    const code = `
class Solution {
    public static String solve(String s) {
        return s;
    }
}`;
    const result = await executeSingle("java", code, ["hello"], { timeLimitMs: 5000 });
    assertEq(result.type, "success", "Execution succeeds");
    assertEq(result.output, '"hello"', "Output is \"hello\"");
  }

  // TEST 5 — BOOLEAN
  console.log("\nTEST 5: Boolean return type");
  {
    const code = `
class Solution {
    public static boolean solve(int n) {
        return n % 2 == 0;
    }
}`;
    const result = await executeSingle("java", code, [4], { timeLimitMs: 5000 });
    assertEq(result.type, "success", "Execution succeeds");
    assertEq(result.output, "true", "Output is true");
  }

  // TEST 6 — ARRAY RETURN
  console.log("\nTEST 6: Array return type");
  {
    const code = `
class Solution {
    public static int[] solve(int[] nums) {
        return nums;
    }
}`;
    const result = await executeSingle("java", code, [[1, 2, 3]], { timeLimitMs: 5000 });
    assertEq(result.type, "success", "Execution succeeds");
    assertEq(result.output, "[1,2,3]", "Output is [1,2,3]");
  }

  // TEST 7 — ACTUAL INTERVIEW PROBLEM (First Unique Character)
  console.log("\nTEST 7: First Unique Character (multiple inputs)");
  {
    const code = `
class Solution {
    public static int solve(String s) {
        int[] freq = new int[26];
        for (char ch : s.toCharArray()) {
            freq[ch - 'a']++;
        }
        for (int i = 0; i < s.length(); i++) {
            if (freq[s.charAt(i) - 'a'] == 1) {
                return i;
            }
        }
        return -1;
    }
}`;

    // Single run tests
    const r1 = await executeSingle("java", code, ["leetcode"], { timeLimitMs: 5000 });
    assertEq(r1.type, "success", "leetcode execution succeeds");
    assertEq(r1.output, "0", "leetcode -> 0");

    const r2 = await executeSingle("java", code, ["loveleetcode"], { timeLimitMs: 5000 });
    assertEq(r2.type, "success", "loveleetcode execution succeeds");
    assertEq(r2.output, "2", "loveleetcode -> 2");

    const r3 = await executeSingle("java", code, ["aabb"], { timeLimitMs: 5000 });
    assertEq(r3.type, "success", "aabb execution succeeds");
    assertEq(r3.output, "-1", "aabb -> -1");

    const r4 = await executeSingle("java", code, ["a"], { timeLimitMs: 5000 });
    assertEq(r4.type, "success", "a execution succeeds");
    assertEq(r4.output, "0", "a -> 0");

    const r5 = await executeSingle("java", code, ["abcabc"], { timeLimitMs: 5000 });
    assertEq(r5.type, "success", "abcabc execution succeeds");
    assertEq(r5.output, "-1", "abcabc -> -1");

    // Batch test
    console.log("\n  Testing batch execution:");
    const cases = [
      ["leetcode"],
      ["loveleetcode"],
      ["aabb"],
      ["a"],
      ["abcabc"],
    ];
    const batch = await executeBatch("java", code, cases, { timeLimitMs: 5000 });
    assertEq(batch.type, "success", "Batch execution succeeds");
    assertEq(batch.outputs?.length, 5, "Batch has 5 outputs");
    if (batch.outputs) {
      assertEq(batch.outputs[0], "0", "Batch: leetcode -> 0");
      assertEq(batch.outputs[1], "2", "Batch: loveleetcode -> 2");
      assertEq(batch.outputs[2], "-1", "Batch: aabb -> -1");
      assertEq(batch.outputs[3], "0", "Batch: a -> 0");
      assertEq(batch.outputs[4], "-1", "Batch: abcabc -> -1");
    }
  }

  // ==========================================
  // NEGATIVE TESTS
  // ==========================================
  console.log("\n--- NEGATIVE TESTS ---\n");

  // TEST A — SYNTAX ERROR
  console.log("TEST A: Student syntax error");
  {
    const code = `
class Solution {
    public static int solve(int n) {
        return n + ;
    }
}`;
    const result = await executeSingle("java", code, [5], { timeLimitMs: 5000 });
    assertEq(result.type, "compile_error", "Classified as compile_error");
    assert(result.output.length > 0, "Error message is provided");
    assertIncludes(result.output, "error", "Error message contains 'error'");
    console.log(`    Error output: ${result.output.substring(0, 150)}`);
  }

  // TEST B — RUNTIME ERROR
  console.log("\nTEST B: Student runtime error");
  {
    const code = `
class Solution {
    public static int solve(int n) {
        int x = 10 / 0;
        return x;
    }
}`;
    const result = await executeSingle("java", code, [5], { timeLimitMs: 5000 });
    assertEq(result.type, "runtime_error", "Classified as runtime_error");
    assert(result.output.length > 0, "Error message is provided");
    assertIncludes(result.output, "/", "Error mentions division");
    console.log(`    Error output: ${result.output.substring(0, 150)}`);
  }

  // TEST C — TIMEOUT
  console.log("\nTEST C: Student timeout (infinite loop)");
  {
    const code = `
class Solution {
    public static int solve(int n) {
        while (true) {}
    }
}`;
    const result = await executeSingle("java", code, [5], { timeLimitMs: 2000 });
    assertEq(result.type, "time_limit", "Classified as time_limit");
    console.log(`    Output: ${result.output.substring(0, 150)}`);
  }

  // ==========================================
  // PLATFORM BUG REGRESSION TESTS
  // ==========================================
  console.log("\n--- PLATFORM BUG REGRESSION TESTS ---\n");

  // REGRESSION: No Object[] in method call when types are known
  console.log("REGRESSION 1: No Object[] wrapping when param types are known");
  {
    const code = `
class Solution {
    public static int solve(int[] nums, int target) {
        return nums.length + target;
    }
}`;
    const result = await executeSingle("java", code, [[1, 2, 3], 5], { timeLimitMs: 5000 });
    assertEq(result.type, "success", "Execution succeeds");
    assertEq(result.output, "8", "Output is 8");
  }

  // REGRESSION: String escaping works
  console.log("\nREGRESSION 2: String escaping in output");
  {
    const code = `
class Solution {
    public static String solve(String s) {
        return "hello " + s;
    }
}`;
    const result = await executeSingle("java", code, ["world"], { timeLimitMs: 5000 });
    assertEq(result.type, "success", "Execution succeeds");
    assertEq(result.output, '"hello world"', 'Output is "hello world"');
  }

  // REGRESSION: Quote escaping in output
  console.log("\nREGRESSION 3: Quote in output string");
  {
    const code = `
class Solution {
    public static String solve(String s) {
        return s;
    }
}`;
    const result = await executeSingle("java", code, ['say "hi"'], { timeLimitMs: 5000 });
    assertEq(result.type, "success", "Execution succeeds");
    assertEq(result.output, '"say \\"hi\\""');
  }

  // REGRESSION: Backslash in output string
  console.log("\nREGRESSION 4: Backslash in output string");
  {
    const code = `
class Solution {
    public static String solve(String s) {
        return s;
    }
}`;
    const result = await executeSingle("java", code, ["C:\\test"], { timeLimitMs: 5000 });
    assertEq(result.type, "success", "Execution succeeds");
    assertEq(result.output, '"C:\\\\test"', 'Output has escaped backslash');
  }

  // REGRESSION: Wrapper compiles (no class/file mismatch)
  console.log("\nREGRESSION 5: Wrapper compiles with no class/file mismatch");
  {
    const code = `
class Solution {
    public static int solve(int n) {
        return n * 2;
    }
}`;
    const result = await executeSingle("java", code, [21], { timeLimitMs: 5000 });
    assertEq(result.type, "success", "Execution succeeds");
    assertEq(result.output, "42", "Output is 42");
  }

  // REGRESSION: No accidental solve() with no args when params needed
  console.log("\nREGRESSION 6: Correct invocation with parameters");
  {
    const code = `
class Solution {
    public static int solve(int a, int b) {
        return a * b;
    }
}`;
    const result = await executeSingle("java", code, [6, 7], { timeLimitMs: 5000 });
    assertEq(result.type, "success", "Execution succeeds");
    assertEq(result.output, "42", "Output is 42");
  }

  // REGRESSION: Array arguments work in batch mode
  console.log("\nREGRESSION 7: Batch with array arguments");
  {
    const code = `
class Solution {
    public static int solve(int[] nums, int target) {
        return nums.length + target;
    }
}`;
    const cases = [
      [[1, 2, 3], 5],
      [[1], 10],
      [[1, 2], 3],
    ];
    const batch = await executeBatch("java", code, cases, { timeLimitMs: 5000 });
    assertEq(batch.type, "success", "Batch execution succeeds");
    if (batch.outputs) {
      assertEq(batch.outputs[0], "8", "Case 1: 3+5=8");
      assertEq(batch.outputs[1], "11", "Case 2: 1+10=11");
      assertEq(batch.outputs[2], "5", "Case 3: 2+3=5");
    }
  }

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log("\n========================================");
  console.log("  TEST SUMMARY");
  console.log("========================================");
  console.log(`  Total:  ${totalTests}`);
  console.log(`  Passed: ${passedTests}`);
  console.log(`  Failed: ${failedTests}`);
  console.log("========================================");

  if (failedTests > 0) {
    console.log(`\n${FAIL}: ${failedTests} test(s) failed.`);
    process.exit(1);
  } else {
    console.log(`\n${PASS}: All tests passed!`);
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
