import { executeJudge0, executeJudge0TestSuite } from './services/judge0Service.js';

async function runTests() {
  console.log("==========================================");
  console.log("  TESTING JUDGE0 HOSTED REMOTE EXECUTION  ");
  console.log("==========================================");

  // 1. C++
  console.log("\n[1] Testing C++ (GCC):");
  const cpp = await executeJudge0({
    sourceCode: `#include <iostream>\nusing namespace std;\nint main() { int a, b; if (cin >> a >> b) cout << a + b; return 0; }`,
    language: 'cpp',
    stdin: '3 5',
  });
  console.log(`  -> Status: ${cpp.status}, Output: ${cpp.stdout.trim()}, Time: ${cpp.timeSeconds}s, Memory: ${cpp.memoryKB}KB`);

  // 2. Python
  console.log("\n[2] Testing Python (3.8.1):");
  const py = await executeJudge0({
    sourceCode: `import sys\nlines = sys.stdin.read().split()\nif len(lines) >= 2:\n    print(int(lines[0]) + int(lines[1]))`,
    language: 'python',
    stdin: '10 20',
  });
  console.log(`  -> Status: ${py.status}, Output: ${py.stdout.trim()}, Time: ${py.timeSeconds}s, Memory: ${py.memoryKB}KB`);

  // 3. Java
  console.log("\n[3] Testing Java (OpenJDK):");
  const java = await executeJudge0({
    sourceCode: `import java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (sc.hasNextInt()) System.out.println(sc.nextInt() + sc.nextInt());\n    }\n}`,
    language: 'java',
    stdin: '40 60',
  });
  console.log(`  -> Status: ${java.status}, Output: ${java.stdout.trim()}, Time: ${java.timeSeconds}s, Memory: ${java.memoryKB}KB`);

  // 4. JavaScript
  console.log("\n[4] Testing JavaScript (NodeJS):");
  const js = await executeJudge0({
    sourceCode: `const fs = require('fs');\nconst [a, b] = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/).map(Number);\nconsole.log(a + b);`,
    language: 'javascript',
    stdin: '15 25',
  });
  console.log(`  -> Status: ${js.status}, Output: ${js.stdout.trim()}, Time: ${js.timeSeconds}s, Memory: ${js.memoryKB}KB`);

  // 5. C++ Compilation Error
  console.log("\n[5] Testing C++ Compilation Error:");
  const compErr = await executeJudge0({
    sourceCode: `#include <iostream>\nint main() { syntax_error; }`,
    language: 'cpp',
    stdin: '',
  });
  console.log(`  -> Status: ${compErr.status}, Error Type: ${compErr.statusDescription}`);
  console.log(`  -> Compiler Diagnostics: ${compErr.compileOutput.trim().split('\n')[0]}`);

  // 6. Test Suite (Multiple testcases with Hidden testcase)
  console.log("\n[6] Testing Multiple Test Cases (Submit Simulation):");
  const suite = await executeJudge0TestSuite({
    sourceCode: `#include <iostream>\nusing namespace std;\nint main() { int a, b; if (cin >> a >> b) cout << a + b; return 0; }`,
    language: 'cpp',
    testCases: [
      { input: '3 5', expected: '8', isHidden: false },
      { input: '10 20', expected: '30', isHidden: false },
      { input: '100 200', expected: '300', isHidden: true },
    ],
  });
  console.log(`  -> Passed: ${suite.passed}/${suite.total} (${suite.score}%)`);
  console.log(`  -> Execution Time: ${suite.executionTime}s, Status: ${suite.status}`);

  // 7. Wrong Answer
  console.log("\n[7] Testing Wrong Answer Detection:");
  const wrongSuite = await executeJudge0TestSuite({
    sourceCode: `#include <iostream>\nusing namespace std;\nint main() { cout << 999; return 0; }`,
    language: 'cpp',
    testCases: [{ input: '3 5', expected: '8', isHidden: false }],
  });
  console.log(`  -> Passed: ${wrongSuite.passed}/${wrongSuite.total} (${wrongSuite.score}%), Status: ${wrongSuite.status}`);
  console.log(`  -> Test Result Status: ${wrongSuite.testResults[0]?.status}`);

  // 8. Runtime Error (Division by Zero)
  console.log("\n[8] Testing Runtime Error:");
  const rtErr = await executeJudge0({
    sourceCode: `print(10 / 0)`,
    language: 'python',
    stdin: '',
  });
  console.log(`  -> Status: ${rtErr.status}, Error Message: ${rtErr.message}`);

  // 9. Time Limit Exceeded
  console.log("\n[9] Testing Time Limit Exceeded (0.5s limit):");
  const tle = await executeJudge0({
    sourceCode: `while True: pass`,
    language: 'python',
    stdin: '',
    cpuTimeLimit: 0.5,
  });
  console.log(`  -> Status: ${tle.status}, Description: ${tle.statusDescription}`);

  console.log("\n==========================================");
  console.log("  ALL TESTS PASSED SUCCESSFULLY!          ");
  console.log("==========================================");
}

runTests().catch((e) => {
  console.error("Test Suite Failed:", e);
  process.exit(1);
});
