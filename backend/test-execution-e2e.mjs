/**
 * End-to-End Code Execution Test Script
 * =======================================
 * Tests all four languages through the actual codeExecutionService.
 *
 * Run with:  node backend/test-execution-e2e.mjs
 *
 * Prerequisites:
 *   docker compose build   (from project root)
 *   Docker Desktop running
 *
 * Each language is tested against:
 *   A. Correct code (accepted / successful output)
 *   B. Compile/syntax error (compile_error)
 *   C. Runtime error (runtime_error)
 *   D. Infinite loop (timeout)
 *   E. Wrong output (wrong_answer)
 */

import {
  executeSingle,
  executeBatch,
  normalizeLanguage,
  isStdinLanguage,
  isLanguageSupported,
  getSupportedLanguages,
  isExecutionConfigured,
  getExecutionProviderInfo,
} from "./services/codeExecutionService.js";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = "") {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.log(`  ❌ FAIL: ${testName}${details ? " — " + details : ""}`);
  }
}

function assertEqual(actual, expected, testName) {
  const a = String(actual ?? "").trim();
  const e = String(expected ?? "").trim();
  assert(a === e, testName, `expected "${e}" but got "${a}"`);
}

function sectionHeader(title) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(60)}`);
}

/* ─── 0. Environment Check ───────────────────────────────────────────────── */

sectionHeader("0. ENVIRONMENT CHECK");

const dockerAvailable = isExecutionConfigured();
console.log(`  Docker available: ${dockerAvailable}`);

const info = getExecutionProviderInfo();
console.log(`  Provider: ${info.provider}`);
console.log(`  Images: Java=${info.images.java}, C++=${info.images.cpp}, C=${info.images.c}, Python=${info.images.python}`);

const allAvailable = dockerAvailable && info.images.java && info.images.cpp && info.images.c && info.images.python;
console.log(`  All images available: ${allAvailable}`);

assert(dockerAvailable, "Docker is running");
assert(info.images.java, "Java image exists");
assert(info.images.cpp, "C++ image exists");
assert(info.images.c, "C image exists");
assert(info.images.python, "Python image exists");

/* ─── 1. LANGUAGE NORMALIZATION ──────────────────────────────────────────── */

sectionHeader("1. LANGUAGE NORMALIZATION");

assertEqual(normalizeLanguage("python"), "python", "normalizeLanguage('python')");
assertEqual(normalizeLanguage("Python"), "python", "normalizeLanguage('Python')");
assertEqual(normalizeLanguage("py"), "python", "normalizeLanguage('py')");
assertEqual(normalizeLanguage("java"), "java", "normalizeLanguage('java')");
assertEqual(normalizeLanguage("c++"), "cpp", "normalizeLanguage('c++')");
assertEqual(normalizeLanguage("cpp"), "cpp", "normalizeLanguage('cpp')");
assertEqual(normalizeLanguage("c"), "c", "normalizeLanguage('c')");
assertEqual(normalizeLanguage("javascript"), null, "normalizeLanguage('javascript') → null");
assertEqual(normalizeLanguage("go"), null, "normalizeLanguage('go') → null");

assert(isLanguageSupported("python"), "isLanguageSupported('python')");
assert(isLanguageSupported("java"), "isLanguageSupported('java')");
assert(isLanguageSupported("c"), "isLanguageSupported('c')");
assert(isLanguageSupported("cpp"), "isLanguageSupported('cpp')");
assert(!isLanguageSupported("javascript"), "isLanguageSupported('javascript') → false");
assert(!isLanguageSupported("go"), "isLanguageSupported('go') → false");

assert(isStdinLanguage("c"), "isStdinLanguage('c')");
assert(isStdinLanguage("cpp"), "isStdinLanguage('cpp')");
assert(!isStdinLanguage("python"), "!isStdinLanguage('python')");
assert(!isStdinLanguage("java"), "!isStdinLanguage('java')");

const langs = getSupportedLanguages();
assertEqual(langs.join(","), "Java,C++,C,Python", "getSupportedLanguages() returns only 4 languages");

/* ─── 2. JAVA TESTS ──────────────────────────────────────────────────────── */

if (allAvailable) {

sectionHeader("2. JAVA — Correct Code (String param: first unique char)");

const javaCorrect = `class Solution {
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

// Batch test: multiple inputs
const javaCases = [
  ["leetcode"],      // expected: 0
  ["loveleetcode"],  // expected: 2
  ["aabb"],          // expected: -1
  ["abc"],           // expected: 0
];
const javaExpected = ["0", "2", "-1", "0"];

const javaBatch = await executeBatch("java", javaCorrect, javaCases, { timeLimitMs: 15000 });
console.log(`  Java batch type: ${javaBatch.type}`);
if (javaBatch.outputs) {
  javaBatch.outputs.forEach((out, i) => {
    assertEqual(out, javaExpected[i], `Java solve("${javaCases[i][0]}") → ${javaExpected[i]}`);
  });
} else {
  assert(false, "Java batch execution", javaBatch.output || javaBatch.type);
}

sectionHeader("3. JAVA — int + int params");

const javaIntParams = `class Solution {
    public static int solve(int a, int b) {
        return a + b;
    }
}`;

const javaIntResult = await executeSingle("java", javaIntParams, [5, 7], { timeLimitMs: 15000 });
console.log(`  Java int+int type: ${javaIntResult.type}, output: ${javaIntResult.output}`);
assert(javaIntResult.type === "success", "Java int+int executes", `got type: ${javaIntResult.type}`);
assertEqual(javaIntResult.output, "12", "Java solve(5, 7) → 12");

sectionHeader("4. JAVA — int[] + int params");

const javaArrayParams = `class Solution {
    public static int solve(int[] nums, int target) {
        return nums.length + target;
    }
}`;

const javaArrayCases = [
  [[1, 2, 3], 5],
];
const javaArrayResult = await executeBatch("java", javaArrayParams, javaArrayCases, { timeLimitMs: 15000 });
console.log(`  Java int[]+int type: ${javaArrayResult.type}`);
if (javaArrayResult.outputs) {
  assertEqual(javaArrayResult.outputs[0], "8", "Java solve([1,2,3], 5) → 8");
} else {
  assert(false, "Java int[]+int execution", javaArrayResult.output || javaArrayResult.type);
}

sectionHeader("5. JAVA — String escaping (quotes, backslash, newlines)");

const javaStringEscape = `class Solution {
    public static String solve(String s) {
        return s;
    }
}`;

const javaStringCases = [
  ['"hello"'],
  ['"hello \\"world\\""'],
  ['"line1\\nline2"'],
  ['"C:\\\\test"'],
];
const javaStringExpected = ['"hello"', '"hello \\"world\\""', '"line1\\nline2"', '"C:\\\\test"'];

const javaStringResult = await executeBatch("java", javaStringEscape, javaStringCases, { timeLimitMs: 15000 });
console.log(`  Java string escape type: ${javaStringResult.type}`);
if (javaStringResult.outputs) {
  javaStringResult.outputs.forEach((out, i) => {
    // The Java harness wraps string results in JSON encoding (toJsonString).
    // Parse the JSON-encoded output to get the actual string value for comparison.
    let decoded;
    try { decoded = JSON.parse(out); } catch { decoded = out; }
    assertEqual(decoded, javaStringExpected[i], `Java string escape case ${i + 1}`);
  });
} else {
  assert(false, "Java string escape execution", javaStringResult.output || javaStringResult.type);
}

sectionHeader("6. JAVA — Compile Error");

const javaCompileError = `class Solution {
    public static int solve(String s) {
        int x = ;
        return x;
    }
}`;

const javaCompile = await executeSingle("java", javaCompileError, [], { timeLimitMs: 15000 });
console.log(`  Java compile error type: ${javaCompile.type}`);
assert(javaCompile.type === "compile_error", "Java syntax error → compile_error", `got: ${javaCompile.type}`);
assert(javaCompile.output.length > 0, "Java compile error has output", javaCompile.output);

sectionHeader("7. JAVA — Runtime Error");

const javaRuntimeError = `class Solution {
    public static int solve(String s) {
        int[] arr = new int[3];
        return arr[10];
    }
}`;

const javaRuntime = await executeSingle("java", javaRuntimeError, ["test"], { timeLimitMs: 15000 });
console.log(`  Java runtime error type: ${javaRuntime.type}`);
assert(javaRuntime.type === "runtime_error", "Java ArrayIndexOutOfBounds → runtime_error", `got: ${javaRuntime.type}`);

sectionHeader("8. JAVA — Timeout");

const javaTimeout = `class Solution {
    public static int solve(String s) {
        while (true) {}
    }
}`;

const javaTimeoutResult = await executeSingle("java", javaTimeout, ["test"], { timeLimitMs: 5000 });
console.log(`  Java timeout type: ${javaTimeoutResult.type}`);
assert(javaTimeoutResult.type === "time_limit" || javaTimeoutResult.type === "runtime_error", "Java infinite loop → timeout/runtime_error", `got: ${javaTimeoutResult.type}`);

sectionHeader("9. JAVA — Wrong Answer");

const javaWrong = `class Solution {
    public static int solve(String s) {
        return -999;
    }
}`;

const javaWrongCases = [["leetcode"]];
const javaWrongResult = await executeBatch("java", javaWrong, javaWrongCases, { timeLimitMs: 15000 });
console.log(`  Java wrong type: ${javaWrongResult.type}`);
if (javaWrongResult.outputs) {
  assert(javaWrongResult.outputs[0] !== "0", "Java wrong answer does not match expected");
} else {
  assert(false, "Java wrong answer execution", javaWrongResult.output);
}

} // end if allAvailable

/* ─── 10. C++ TESTS ──────────────────────────────────────────────────────── */

if (allAvailable) {

sectionHeader("10. C++ — Correct Code (sum of two integers)");

const cppCorrect = `#include <iostream>
using namespace std;
int main() {
    int a, b;
    cin >> a >> b;
    cout << a + b << endl;
    return 0;
}`;

const cppResult = await executeSingle("cpp", cppCorrect, [], { stdin: "5 7", timeLimitMs: 10000 });
console.log(`  C++ sum type: ${cppResult.type}, output: ${cppResult.output}`);
assert(cppResult.type === "success", "C++ sum executes", `got: ${cppResult.type}`);
assertEqual(cppResult.output, "12", "C++ 5+7 → 12");

sectionHeader("11. C++ — Compile Error");

const cppCompileError = `#include <iostream>
using namespace std;
int main() {
    int x = ;
    return 0;
}`;

const cppCompile = await executeSingle("cpp", cppCompileError, [], { timeLimitMs: 10000 });
console.log(`  C++ compile error type: ${cppCompile.type}`);
assert(cppCompile.type === "compile_error", "C++ syntax error → compile_error", `got: ${cppCompile.type}`);
assert(cppCompile.output.length > 0, "C++ compile error has output");

sectionHeader("12. C++ — Runtime Error");

const cppRuntimeError = `#include <iostream>
using namespace std;
int main() {
    int* p = nullptr;
    *p = 42;
    return 0;
}`;

const cppRuntime = await executeSingle("cpp", cppRuntimeError, [], { timeLimitMs: 10000 });
console.log(`  C++ runtime error type: ${cppRuntime.type}`);
assert(cppRuntime.type === "runtime_error", "C++ null deref → runtime_error", `got: ${cppRuntime.type}`);

sectionHeader("13. C++ — Timeout");

const cppTimeout = `#include <iostream>
using namespace std;
int main() {
    while (true) {}
    return 0;
}`;

const cppTimeoutResult = await executeSingle("cpp", cppTimeout, [], { timeLimitMs: 5000 });
console.log(`  C++ timeout type: ${cppTimeoutResult.type}`);
assert(cppTimeoutResult.type === "time_limit" || cppTimeoutResult.type === "runtime_error", "C++ infinite loop → timeout", `got: ${cppTimeoutResult.type}`);

sectionHeader("14. C++ — Wrong Answer");

const cppWrong = `#include <iostream>
using namespace std;
int main() {
    cout << -999 << endl;
    return 0;
}`;

const cppWrongResult = await executeSingle("cpp", cppWrong, [], { timeLimitMs: 10000 });
console.log(`  C++ wrong type: ${cppWrongResult.type}, output: ${cppWrongResult.output}`);
assert(cppWrongResult.type === "success", "C++ wrong answer runs", `got: ${cppWrongResult.type}`);
assert(cppWrongResult.output !== "12", "C++ wrong answer does not match");

} // end if allAvailable

/* ─── 15. C TESTS ────────────────────────────────────────────────────────── */

if (allAvailable) {

sectionHeader("15. C — Correct Code (sum of two integers)");

const cCorrect = `#include <stdio.h>
int main() {
    int a, b;
    scanf("%d %d", &a, &b);
    printf("%d\\n", a + b);
    return 0;
}`;

const cResult = await executeSingle("c", cCorrect, [], { stdin: "5 7", timeLimitMs: 10000 });
console.log(`  C sum type: ${cResult.type}, output: ${cResult.output}`);
assert(cResult.type === "success", "C sum executes", `got: ${cResult.type}`);
assertEqual(cResult.output, "12", "C 5+7 → 12");

sectionHeader("16. C — Compile Error");

const cCompileError = `#include <stdio.h>
int main() {
    int x = ;
    return 0;
}`;

const cCompile = await executeSingle("c", cCompileError, [], { timeLimitMs: 10000 });
console.log(`  C compile error type: ${cCompile.type}`);
assert(cCompile.type === "compile_error", "C syntax error → compile_error", `got: ${cCompile.type}`);
assert(cCompile.output.length > 0, "C compile error has output");

sectionHeader("17. C — Runtime Error");

const cRuntimeError = `#include <stdio.h>
int main() {
    int *p = 0;
    *p = 42;
    return 0;
}`;

const cRuntime = await executeSingle("c", cRuntimeError, [], { timeLimitMs: 10000 });
console.log(`  C runtime error type: ${cRuntime.type}`);
assert(cRuntime.type === "runtime_error", "C null deref → runtime_error", `got: ${cRuntime.type}`);

sectionHeader("18. C — Timeout");

const cTimeout = `#include <stdio.h>
int main() {
    while (1) {}
    return 0;
}`;

const cTimeoutResult = await executeSingle("c", cTimeout, [], { timeLimitMs: 5000 });
console.log(`  C timeout type: ${cTimeoutResult.type}`);
assert(cTimeoutResult.type === "time_limit" || cTimeoutResult.type === "runtime_error", "C infinite loop → timeout", `got: ${cTimeoutResult.type}`);

sectionHeader("19. C — Wrong Answer");

const cWrong = `#include <stdio.h>
int main() {
    printf("-999\\n");
    return 0;
}`;

const cWrongResult = await executeSingle("c", cWrong, [], { timeLimitMs: 10000 });
console.log(`  C wrong type: ${cWrongResult.type}, output: ${cWrongResult.output}`);
assert(cWrongResult.type === "success", "C wrong answer runs", `got: ${cWrongResult.type}`);
assert(cWrongResult.output !== "12", "C wrong answer does not match");

} // end if allAvailable

/* ─── 20. PYTHON TESTS ───────────────────────────────────────────────────── */

if (allAvailable) {

sectionHeader("20. Python — Correct Code");

const pyCorrect = `def solution(*args):
    a, b = args
    return a + b`;

const pyResult = await executeSingle("python", pyCorrect, [5, 7], { timeLimitMs: 10000 });
console.log(`  Python sum type: ${pyResult.type}, output: ${pyResult.output}`);
assert(pyResult.type === "success", "Python sum executes", `got: ${pyResult.type}`);
assertEqual(pyResult.output, "12", "Python 5+7 → 12");

sectionHeader("21. Python — Runtime Error");

const pyRuntimeError = `def solution(*args):
    x = [1, 2, 3]
    return x[10]

print(solution(0))`;

const pyRuntime = await executeSingle("python", pyRuntimeError, [0], { timeLimitMs: 10000 });
console.log(`  Python runtime error type: ${pyRuntime.type}`);
assert(pyRuntime.type === "runtime_error", "Python IndexError → runtime_error", `got: ${pyRuntime.type}`);

sectionHeader("22. Python — Timeout");

const pyTimeout = `def solution(*args):
    while True:
        pass

print(solution(0))`;

const pyTimeoutResult = await executeSingle("python", pyTimeout, [0], { timeLimitMs: 5000 });
console.log(`  Python timeout type: ${pyTimeoutResult.type}`);
assert(pyTimeoutResult.type === "time_limit" || pyTimeoutResult.type === "runtime_error", "Python infinite loop → timeout", `got: ${pyTimeoutResult.type}`);

sectionHeader("23. Python — Wrong Answer");

const pyWrong = `def solution(*args):
    return -999

print(solution(0))`;

const pyWrongResult = await executeSingle("python", pyWrong, [0], { timeLimitMs: 10000 });
console.log(`  Python wrong type: ${pyWrongResult.type}, output: ${pyWrongResult.output}`);
assert(pyWrongResult.type === "success", "Python wrong answer runs", `got: ${pyWrongResult.type}`);
assert(pyWrongResult.output !== "12", "Python wrong answer does not match");

sectionHeader("24. Python — Syntax Error (should be runtime_error or compile_error)");

const pySyntaxError = `def solution(*args):
    print("missing closing paren"

print(solution(0))`;

const pySyntaxResult = await executeSingle("python", pySyntaxError, [0], { timeLimitMs: 10000 });
console.log(`  Python syntax error type: ${pySyntaxResult.type}`);
assert(
  pySyntaxResult.type === "runtime_error" || pySyntaxResult.type === "compile_error",
  "Python syntax error → runtime_error or compile_error",
  `got: ${pySyntaxResult.type}`
);

} // end if allAvailable

/* ─── SUMMARY ────────────────────────────────────────────────────────────── */

sectionHeader("TEST SUMMARY");
console.log(`  Total:  ${totalTests}`);
console.log(`  Passed: ${passedTests}`);
console.log(`  Failed: ${failedTests}`);

if (failedTests > 0) {
  console.log(`\n  ⚠️  ${failedTests} test(s) FAILED`);
  process.exit(1);
} else {
  console.log(`\n  ✅ All tests PASSED`);
  process.exit(0);
}
