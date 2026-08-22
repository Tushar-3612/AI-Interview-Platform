/**
 * Judge0 Remote Code Execution Service
 * ---------------------------------------------------------------------------
 * Provides sandboxed, remote compilation and execution via Judge0 API.
 * Eliminates Docker and local arbitrary code execution from the backend server.
 */

const JUDGE0_LANGUAGES = {
  cpp: {
    id: 54,
    name: "C++ (GCC 9.2.0)",
    slug: "cpp",
    ext: "cpp",
    starter: `#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}`,
  },
  c: {
    id: 50,
    name: "C (GCC 9.2.0)",
    slug: "c",
    ext: "c",
    starter: `#include <stdio.h>\n\nint main() {\n    // Write your code here\n    return 0;\n}`,
  },
  java: {
    id: 62,
    name: "Java (OpenJDK 13.0.1)",
    slug: "java",
    ext: "java",
    starter: `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Write your code here\n    }\n}`,
  },
  python: {
    id: 71,
    name: "Python (3.8.1)",
    slug: "python",
    ext: "py",
    starter: `# Write your solution here\n`,
  },
  javascript: {
    id: 63,
    name: "JavaScript (Node.js 12.14.0)",
    slug: "javascript",
    ext: "js",
    starter: `// Read input from stdin or arguments\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8').trim();\n`,
  },
};

const LANG_ALIASES = {
  python: "python",
  py: "python",
  python3: "python",
  java: "java",
  c: "c",
  cpp: "cpp",
  "c++": "cpp",
  cplusplus: "cpp",
  javascript: "javascript",
  js: "javascript",
  node: "javascript",
};

/**
 * Get Judge0 language configuration from alias or slug
 */
export function getJudge0Language(lang) {
  if (!lang) return null;
  const normalized = LANG_ALIASES[String(lang).trim().toLowerCase()];
  return JUDGE0_LANGUAGES[normalized] || null;
}

export function getSupportedJudge0Languages() {
  return Object.values(JUDGE0_LANGUAGES);
}

/**
 * Normalizes output for fair comparison
 * - Converts CRLF to LF
 * - Trims trailing whitespace on each line
 * - Trims leading and trailing overall whitespace
 */
export function normalizeOutput(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

/**
 * Robust output comparator for testcases
 * Handles:
 * - Direct exact string match
 * - Array formatting difference (e.g. Python "[[1, 6], [8, 10]]" vs JSON "[[1,6],[8,10]]")
 * - Case-insensitive Booleans ("True" vs "true")
 * - Floating point equivalence ("2.0" vs "2.00000")
 * - Whitespace and line break variations
 */
export function compareOutputs(actual, expected) {
  if (actual === null || actual === undefined) actual = "";
  if (expected === null || expected === undefined) expected = "";

  const aStr = String(actual).trim();
  const eStr = String(expected).trim();

  // 1. Direct exact match
  if (aStr === eStr) return true;

  // 2. Case-insensitive boolean match
  if (
    aStr.toLowerCase() === eStr.toLowerCase() &&
    (aStr.toLowerCase() === "true" || aStr.toLowerCase() === "false")
  ) {
    return true;
  }

  // 3. Numeric match
  const aNum = Number(aStr);
  const eNum = Number(eStr);
  if (!isNaN(aNum) && !isNaN(eNum) && aStr !== "" && eStr !== "") {
    if (Math.abs(aNum - eNum) < 1e-5) return true;
  }

  // 4. Try JSON / Python list/tuple parsing
  function tryParse(s) {
    if (!s) return null;
    try {
      return JSON.parse(s);
    } catch {}
    try {
      return JSON.parse(s.replace(/'/g, '"'));
    } catch {}
    return null;
  }

  const aJson = tryParse(aStr);
  const eJson = tryParse(eStr);
  if (aJson !== null && eJson !== null) {
    if (JSON.stringify(aJson) === JSON.stringify(eJson)) return true;
  }

  // 5. Structure & whitespace normalized string match
  const norm = (s) =>
    String(s)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\s*,\s*/g, ",")
      .replace(/\s*\[\s*/g, "[")
      .replace(/\s*\]\s*/g, "]")
      .replace(/\s*\{\s*/g, "{")
      .replace(/\s*\}\s*/g, "}")
      .replace(/[ \t]+/g, " ")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n")
      .trim();

  return norm(aStr) === norm(eStr);
}

/**
 * Prepares headers for Judge0 request
 */
function getJudge0Headers() {
  const apiKey = process.env.JUDGE0_API_KEY || process.env.RAPIDAPI_KEY || "";
  const apiUrl = process.env.JUDGE0_API_URL || (apiKey ? "https://judge0-ce.p.rapidapi.com" : "https://ce.judge0.com");
  const apiHost = process.env.JUDGE0_API_HOST || (apiUrl.includes("rapidapi.com") ? "judge0-ce.p.rapidapi.com" : "");

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (apiKey) {
    if (apiUrl.includes("rapidapi.com")) {
      headers["X-RapidAPI-Key"] = apiKey;
      headers["X-RapidAPI-Host"] = apiHost || "judge0-ce.p.rapidapi.com";
    } else {
      headers["X-Auth-Token"] = apiKey;
      headers["X-Auth-User"] = apiKey;
    }
  }

  return { headers, apiUrl: apiUrl.replace(/\/+$/, "") };
}

/**
 * Helper to safely decode Base64 strings from Judge0
 */
function decodeBase64(str) {
  if (!str) return "";
  try {
    return Buffer.from(str, "base64").toString("utf8");
  } catch {
    return String(str);
  }
}

/**
 * Wraps function-only code (LeetCode style) with an execution harness
 * so candidates can write pure functions without writing boilerplate stdin/stdout parsing.
 */
export function wrapFunctionHarness(sourceCode, language) {
  if (!sourceCode) return sourceCode;
  const lang = String(language).toLowerCase().trim();

  if (lang === "python" || lang === "py" || lang === "python3") {
    // If the code already contains main execution or stdin reads, don't wrap
    if (
      sourceCode.includes("__main__") ||
      sourceCode.includes("sys.stdin") ||
      sourceCode.includes("input(")
    ) {
      return sourceCode;
    }

    const fnMatch = sourceCode.match(/def\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)/);
    if (!fnMatch) return sourceCode;
    const fnName = fnMatch[1];
    const paramCount = fnMatch[2].split(",").map((p) => p.trim()).filter(Boolean).length;

    const harness = `

if __name__ == "__main__":
    import sys
    import json
    import ast

    def __safe_eval(s):
        s = s.strip()
        try:
            return json.loads(s)
        except Exception:
            try:
                return ast.literal_eval(s)
            except Exception:
                return s

    __raw = sys.stdin.read().strip()
    if __raw:
        __args = None
        try:
            __t = __safe_eval(f"({__raw})")
            if isinstance(__t, tuple):
                __args = list(__t)
        except Exception:
            pass

        if __args is None:
            try:
                __item = __safe_eval(__raw)
                if isinstance(__item, list) and len(__item) == ${paramCount} and ${paramCount} > 1:
                    __args = __item
                elif isinstance(__item, tuple):
                    __args = list(__item)
                else:
                    __args = [__item]
            except Exception:
                __args = [__raw]

        __res = ${fnName}(*__args)
        if isinstance(__res, (list, dict, int, float, bool, str)) or __res is None:
            print(json.dumps(__res))
        else:
            print(__res)
`;
    return sourceCode + harness;
  }

  if (lang === "javascript" || lang === "js" || lang === "node") {
    if (
      sourceCode.includes("readFileSync") ||
      sourceCode.includes("process.stdin") ||
      sourceCode.includes("readline")
    ) {
      return sourceCode;
    }

    const fnMatch = sourceCode.match(/function\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)/);
    if (!fnMatch) return sourceCode;
    const fnName = fnMatch[1];
    const paramCount = fnMatch[2].split(",").map((p) => p.trim()).filter(Boolean).length;

    const harness = `

const fs = require('fs');
const __raw = fs.readFileSync(0, 'utf-8').trim();
if (__raw) {
    let __args = [];
    try {
        const direct = JSON.parse(__raw);
        if (Array.isArray(direct) && direct.length === ${paramCount} && ${paramCount} > 1) {
            __args = direct;
        } else {
            __args = [direct];
        }
    } catch {
        try {
            const wrapped = JSON.parse(\`[\${__raw}]\`);
            __args = Array.isArray(wrapped) ? wrapped : [wrapped];
        } catch {
            __args = [__raw];
        }
    }
    const __res = ${fnName}(...__args);
    console.log(typeof __res === 'object' && __res !== null ? JSON.stringify(__res) : __res);
}
`;
    return sourceCode + harness;
  }

  return sourceCode;
}

/**
 * Submit code to Judge0 API and poll for result
 */
export async function executeJudge0({
  sourceCode,
  language,
  stdin = "",
  cpuTimeLimit = 2.0,
  memoryLimit = 128000,
}) {
  const langConfig = getJudge0Language(language);
  if (!langConfig) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const { headers, apiUrl } = getJudge0Headers();
  const effectiveSourceCode = wrapFunctionHarness(sourceCode, language);

  const payload = {
    source_code: Buffer.from(effectiveSourceCode || "").toString("base64"),
    language_id: langConfig.id,
    stdin: Buffer.from(String(stdin || "")).toString("base64"),
    cpu_time_limit: Math.max(0.5, Math.min(10.0, Number(cpuTimeLimit) || 2.0)),
    memory_limit: Math.max(10000, Math.min(256000, Number(memoryLimit) || 128000)),
  };

  try {
    // 1. Create submission with wait=true for fast response
    const submitUrl = `${apiUrl}/submissions?base64_encoded=true&wait=true`;
    let response = await fetch(submitUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    let data;
    if (response.ok) {
      data = await response.json();
    } else {
      // If wait=true is not supported or times out, try async submission + polling
      const asyncUrl = `${apiUrl}/submissions?base64_encoded=true&wait=false`;
      const asyncResp = await fetch(asyncUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!asyncResp.ok) {
        const errText = await asyncResp.text();
        throw new Error(`Judge0 Submission Error (${asyncResp.status}): ${errText}`);
      }

      const asyncData = await asyncResp.json();
      const token = asyncData.token;

      if (!token) {
        throw new Error("Judge0 did not return a submission token.");
      }

      // Poll up to 10 times (max ~8 seconds)
      const maxRetries = 10;
      let attempt = 0;
      while (attempt < maxRetries) {
        await new Promise((res) => setTimeout(res, 400 + attempt * 150));
        const pollResp = await fetch(`${apiUrl}/submissions/${token}?base64_encoded=true`, {
          headers,
        });

        if (pollResp.ok) {
          data = await pollResp.json();
          // Status ID: 1 = In Queue, 2 = Processing
          if (data.status && data.status.id > 2) {
            break;
          }
        }
        attempt++;
      }
    }

    if (!data) {
      throw new Error("Execution timed out waiting for Judge0 response.");
    }

    const statusId = data.status?.id || 0;
    const statusDesc = data.status?.description || "Unknown Status";

    const decodedStdout = decodeBase64(data.stdout);
    const decodedStderr = decodeBase64(data.stderr);
    const decodedCompileOutput = decodeBase64(data.compile_output);
    const decodedMessage = decodeBase64(data.message);

    let type = "success";
    let errorType = null;
    let userMessage = "";

    if (statusId === 3) {
      type = "success";
    } else if (statusId === 4) {
      type = "wrong_answer";
      errorType = "wrong_answer";
      userMessage = "Output did not match expected testcase output.";
    } else if (statusId === 5) {
      type = "time_limit";
      errorType = "time_limit";
      userMessage = "Your program exceeded the allowed execution time limit.";
    } else if (statusId === 6) {
      type = "compile_error";
      errorType = "compile_error";
      userMessage = decodedCompileOutput || "Your code could not be compiled. Check the compiler error message below.";
    } else if (statusId >= 7 && statusId <= 12) {
      type = "runtime_error";
      errorType = "runtime_error";
      userMessage = decodedStderr || `Your program terminated with a runtime error (${statusDesc}).`;
    } else {
      type = "execution_error";
      errorType = "execution_error";
      userMessage = decodedStderr || `Execution error: ${statusDesc}`;
    }

    const timeSeconds = parseFloat(data.time) || 0;
    const timeMs = Math.round(timeSeconds * 1000);
    const memoryKB = parseInt(data.memory, 10) || 0;

    return {
      status: type,
      statusDescription: statusDesc,
      statusId,
      stdout: decodedStdout,
      stderr: decodedStderr,
      compileOutput: decodedCompileOutput,
      output: (decodedStdout || decodedCompileOutput || decodedStderr || userMessage).trim(),
      timeMs,
      timeSeconds: data.time || "0.00",
      memoryKB,
      token: data.token || null,
    };
  } catch (err) {
    console.error("Judge0 Service Error:", err.message);
    throw new Error(`Judge0 API unavailable: ${err.message}`);
  }
}

/**
 * Execute code against multiple test cases
 */
export async function executeJudge0TestSuite({
  sourceCode,
  language,
  testCases = [],
  cpuTimeLimit = 2.0,
  memoryLimit = 128000,
}) {
  const results = [];
  let passedCount = 0;
  let totalTimeMs = 0;
  let maxMemoryKB = 0;
  let firstCompileOutput = "";

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const isHidden = Boolean(tc.isHidden);

    try {
      const execResult = await executeJudge0({
        sourceCode,
        language,
        stdin: tc.input,
        cpuTimeLimit,
        memoryLimit,
      });

      totalTimeMs += execResult.timeMs;
      maxMemoryKB = Math.max(maxMemoryKB, execResult.memoryKB);

      if (execResult.status === "compile_error") {
        firstCompileOutput = execResult.compileOutput || execResult.stderr || "Compilation failed";
        return {
          status: "compile_error",
          statusDescription: "Compilation Error",
          passed: 0,
          total: testCases.length,
          score: 0,
          executionTime: (totalTimeMs / 1000).toFixed(2),
          memory: maxMemoryKB,
          compileOutput: firstCompileOutput,
          testResults: testCases.map((c, idx) => ({
            index: idx + 1,
            passed: false,
            isHidden: Boolean(c.isHidden),
            input: c.isHidden ? "" : String(c.input || ""),
            expected: c.isHidden ? "" : String(c.expected || c.expectedOutput || ""),
            actual: "",
            error: "Compilation Error",
            timeMs: 0,
          })),
        };
      }

      const passed = execResult.status === "success" && compareOutputs(execResult.stdout, tc.expected || tc.expectedOutput);

      if (passed) {
        passedCount++;
      }

      results.push({
        index: i + 1,
        passed,
        isHidden,
        input: isHidden ? "" : String(tc.input || ""),
        expected: isHidden ? "" : String(tc.expected || tc.expectedOutput || ""),
        actual: isHidden && !passed ? "" : execResult.stdout || "",
        error: passed ? "" : execResult.stderr || (execResult.status !== "success" ? execResult.message : ""),
        status: passed ? "Accepted" : execResult.status === "success" ? "Wrong Answer" : execResult.statusDescription || "Failed",
        timeMs: execResult.timeMs,
      });
    } catch (caseErr) {
      results.push({
        index: i + 1,
        passed: false,
        isHidden,
        input: isHidden ? "" : String(tc.input || ""),
        expected: isHidden ? "" : String(tc.expected || tc.expectedOutput || ""),
        actual: "",
        error: caseErr.message || "Execution Failed",
        status: "Error",
        timeMs: 0,
      });
    }
  }

  const total = testCases.length;
  const score = total > 0 ? Math.round((passedCount / total) * 100) : 0;
  const overallStatus = passedCount === total && total > 0 ? "completed" : "failed";

  return {
    status: overallStatus,
    passed: passedCount,
    total,
    score,
    executionTime: (totalTimeMs / 1000).toFixed(2),
    memory: maxMemoryKB,
    compileOutput: "",
    testResults: results,
  };
}
