import https from "https";
import http from "http";
import { URL } from "url";
import {
  normalizeLanguage,
  getSupportedLanguages,
  prepareExecutionInput,
  getTestCaseExpectedOutput,
  compareOutputs,
  wrapFunctionHarness,
  detectJavaClassName,
  detectJavaMethodName,
  parseJavaArgsFromInput,
  parseJavaParamTypes,
  harnessForRun,
} from "./codeExecutionService.js";

/**
 * JDoodle Code Execution Service
 * ---------------------------------------------------------------------------
 * Server-side client for JDoodle API (https://api.jdoodle.com/v1/execute).
 * Credentials (JDOODLE_CLIENT_ID, JDOODLE_CLIENT_SECRET) remain strictly on the backend.
 *
 * Supported Languages:
 *  - Python (python3)
 *  - Java (java)
 *  - C (c)
 *  - C++ (cpp17 / cpp)
 *  - JavaScript (nodejs)
 */

const JDOODLE_LANGUAGE_MAP = {
  python: { language: "python3", versionIndex: "4", label: "Python 3" },
  javascript: { language: "nodejs", versionIndex: "4", label: "NodeJS" },
  java: { language: "java", versionIndex: "4", label: "Java (JDK 17.0.1)" },
  c: { language: "c", versionIndex: "5", label: "C (GCC 11.1.0)" },
  cpp: { language: "cpp17", versionIndex: "1", label: "C++ 17 (GCC 11.1.0)" },
};

export function getJDoodleConfig() {
  const clientId = (process.env.JDOODLE_CLIENT_ID || "").trim();
  const clientSecret = (process.env.JDOODLE_CLIENT_SECRET || "").trim();
  const apiUrl = (process.env.JDOODLE_API_URL || "https://api.jdoodle.com/v1/execute").trim();
  const isConfigured = Boolean(clientId && clientSecret);
  return { clientId, clientSecret, apiUrl, isConfigured };
}

export function isJDoodleConfigured() {
  return getJDoodleConfig().isConfigured;
}

/**
 * Check total JDoodle credits spent today (Free tier = 20 credits/day).
 * Hits https://api.jdoodle.com/v1/credit-spent
 */
export async function checkJDoodleCreditSpent() {
  const { clientId, clientSecret, isConfigured } = getJDoodleConfig();
  if (!isConfigured) {
    return { isConfigured: false, used: null, error: "JDoodle credentials not configured." };
  }

  const endpoint = "https://api.jdoodle.com/v1/credit-spent";
  const payload = JSON.stringify({ clientId, clientSecret });
  const parsedUrl = new URL(endpoint);

  return new Promise((resolve) => {
    let settled = false;
    const req = https.request(
      parsedUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload, "utf8"),
          "Accept": "application/json",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          if (settled) return;
          settled = true;
          try {
            const parsed = JSON.parse(data);
            resolve({ isConfigured: true, httpStatus: res.statusCode, ...parsed });
          } catch {
            resolve({ isConfigured: true, httpStatus: res.statusCode, error: "Failed to parse credit spent response" });
          }
        });
      }
    );

    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      resolve({ isConfigured: true, error: err.message || "Network error checking credits" });
    });

    req.setTimeout(10000, () => {
      if (settled) return;
      settled = true;
      req.destroy();
      resolve({ isConfigured: true, error: "Timeout checking credit spent" });
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Prepare and assemble single script payload for JDoodle execution.
 */
export function prepareJDoodleScript(langId, rawCode, stdin = "", opts = {}) {
  const code = String(rawCode || "").trim();

  if (langId === "python") {
    const isStdinStyle =
      code.includes("input(") ||
      code.includes("sys.stdin") ||
      code.includes("__main__") ||
      code.includes("__safe_eval");
    if (isStdinStyle) {
      return { script: code, stdin };
    }
    const wrapped = wrapFunctionHarness(code, "python");
    return { script: wrapped, stdin };
  }

  if (langId === "javascript") {
    const isStdinStyle =
      code.includes("readFileSync") ||
      code.includes("process.stdin") ||
      code.includes("readline");
    if (isStdinStyle) {
      return { script: code, stdin };
    }
    const wrapped = wrapFunctionHarness(code, "javascript");
    return { script: wrapped, stdin };
  }

  if (langId === "java") {
    const hasMain = /\bpublic\s+static\s+void\s+main\s*\(\s*String\s*(\[\s*\]\s*\w+|\w+\s*\[\s*\]|\.\.\.\s*\w+)\s*\)/.test(code);

    if (hasMain) {
      // User provided a full Java main application
      return { script: code, stdin };
    }

    // Function-style Java question (e.g. Solution class with method)
    const userClass = opts.className || detectJavaClassName(code) || "Solution";
    const userMethod = opts.methodName || detectJavaMethodName(code, "solution") || "solution";

    let effectiveArgs = Array.isArray(opts.args) && opts.args.length > 0 ? opts.args : null;
    if (!effectiveArgs && stdin) {
      effectiveArgs = parseJavaArgsFromInput(stdin, code, userMethod);
    }

    const runnerHarness = harnessForRun("java", effectiveArgs, code, {
      className: userClass,
      methodName: userMethod,
      runnerClassName: "Main",
    });

    // Make student class non-public so Main can be the public entry point
    const sanitizedUserCode = code.replace(/\bpublic\s+class\s+/g, "class ");
    const combinedScript = `${sanitizedUserCode}\n\n${runnerHarness}`;

    return { script: combinedScript, stdin: "" };
  }

  // C and C++ standard stdin programs
  return { script: code, stdin };
}

/**
 * Perform HTTPS POST request to JDoodle API.
 */
async function callJDoodleApi({ script, stdin = "", language, versionIndex, compileOnly = false, timeoutMs = 15000 }) {
  const { clientId, clientSecret, apiUrl, isConfigured } = getJDoodleConfig();

  if (!isConfigured) {
    return {
      statusCode: 500,
      error: "JDoodle credentials (JDOODLE_CLIENT_ID, JDOODLE_CLIENT_SECRET) are not configured on the backend.",
      isConfigError: true,
    };
  }

  const payload = JSON.stringify({
    clientId,
    clientSecret,
    script,
    stdin: stdin || "",
    language,
    versionIndex: String(versionIndex || "0"),
    compileOnly: Boolean(compileOnly),
  });

  const parsedUrl = new URL(apiUrl);
  const client = parsedUrl.protocol === "http:" ? http : https;

  return new Promise((resolve) => {
    let settled = false;
    const req = client.request(
      parsedUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload, "utf8"),
          "Accept": "application/json",
        },
      },
      (res) => {
        let rawData = "";
        res.on("data", (chunk) => {
          rawData += chunk;
        });
        res.on("end", () => {
          if (settled) return;
          settled = true;
          try {
            const parsed = JSON.parse(rawData);
            resolve({
              httpStatus: res.statusCode,
              ...parsed,
            });
          } catch (jsonErr) {
            resolve({
              httpStatus: res.statusCode,
              statusCode: res.statusCode,
              output: rawData || "Invalid response from code execution service.",
              error: "Failed to parse execution service response.",
            });
          }
        });
      }
    );

    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      resolve({
        httpStatus: 500,
        statusCode: 500,
        error: "Network error connecting to code execution service: " + (err.message || "Unknown error"),
      });
    });

    req.setTimeout(timeoutMs, () => {
      if (settled) return;
      settled = true;
      req.destroy();
      resolve({
        httpStatus: 408,
        statusCode: 408,
        error: "Code execution request timed out.",
        isTimeout: true,
      });
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Classify raw JDoodle execution output into platform status codes.
 */
function classifyJDoodleOutput(rawOutput, langId) {
  const out = String(rawOutput || "").trim();

  // Compile Error checks
  const isCompileError =
    /error:\s+/i.test(out) ||
    /fatal error:\s+/i.test(out) ||
    /SyntaxError:/i.test(out) ||
    /IndentationError:/i.test(out) ||
    /TabError:/i.test(out) ||
    /cannot find symbol/i.test(out) ||
    /class, interface, or enum expected/i.test(out) ||
    /undefined reference to/i.test(out) ||
    /collect2: error:/i.test(out);

  if (isCompileError) {
    return {
      status: "compile_error",
      statusDescription: "Compilation Error",
      statusId: 6,
      stdout: "",
      stderr: out,
      compileOutput: out,
    };
  }

  // Runtime Error checks
  const isRuntimeError =
    /Traceback \(most recent call last\):/i.test(out) ||
    /Exception in thread "main"/i.test(out) ||
    /java\.lang\.[A-Za-z]+Exception/i.test(out) ||
    /Segmentation fault/i.test(out) ||
    /core dumped/i.test(out) ||
    /Aborted/i.test(out) ||
    /TypeError:/i.test(out) ||
    /ReferenceError:/i.test(out) ||
    /RangeError:/i.test(out);

  if (isRuntimeError) {
    return {
      status: "runtime_error",
      statusDescription: "Runtime Error",
      statusId: 11,
      stdout: "",
      stderr: out,
      compileOutput: "",
    };
  }

  // Time Limit checks
  const isTimeout =
    /Timeout/i.test(out) ||
    /Time Limit Exceeded/i.test(out) ||
    /Killed/i.test(out) ||
    /Terminated/i.test(out);

  if (isTimeout) {
    return {
      status: "time_limit",
      statusDescription: "Time Limit Exceeded",
      statusId: 5,
      stdout: "",
      stderr: out,
      compileOutput: "",
    };
  }

  return {
    status: "success",
    statusDescription: "Accepted",
    statusId: 3,
    stdout: out,
    stderr: "",
    compileOutput: "",
  };
}

/**
 * Execute single code snippet via JDoodle API.
 */
export async function executeJDoodleSingle({
  sourceCode,
  code,
  language = "python",
  stdin = "",
  input = "",
  cpuTimeLimit = 2.0,
  timeLimitMs = null,
  args = null,
  functionName,
  methodName,
  className,
}) {
  const rawCode = sourceCode !== undefined ? sourceCode : (code || "");
  const langId = normalizeLanguage(language);

  if (!langId || !JDOODLE_LANGUAGE_MAP[langId]) {
    return {
      status: "execution_error",
      statusDescription: `Unsupported language: ${language}`,
      statusId: 13,
      stdout: "",
      stderr: `Unsupported language: ${language}`,
      compileOutput: "",
      output: `Unsupported language: ${language}. Supported: ${getSupportedLanguages().join(", ")}`,
      timeMs: 0,
      timeSeconds: "0.00",
      memoryKB: 0,
      token: null,
      type: "execution_error",
    };
  }

  const { isConfigured } = getJDoodleConfig();
  if (!isConfigured) {
    return {
      status: "execution_error",
      statusDescription: "Execution Error",
      statusId: 13,
      stdout: "",
      stderr: "Code execution environment is not configured. (JDOODLE_CLIENT_ID / JDOODLE_CLIENT_SECRET missing)",
      compileOutput: "",
      output: "Code execution environment is not configured. Please contact the administrator.",
      timeMs: 0,
      timeSeconds: "0.00",
      memoryKB: 0,
      token: null,
      type: "execution_error",
    };
  }

  const langConfig = JDOODLE_LANGUAGE_MAP[langId];
  const preparedStdin = prepareExecutionInput(stdin || input || "");
  const timeoutMs = Math.max(300, Math.min(30000, Number(timeLimitMs) || Math.round((Number(cpuTimeLimit) || 2.0) * 1000) + 5000));

  const { script, stdin: scriptStdin } = prepareJDoodleScript(langId, rawCode, preparedStdin, {
    className,
    methodName,
    functionName,
    args,
  });

  const startedAt = Date.now();
  const apiRes = await callJDoodleApi({
    script,
    stdin: scriptStdin,
    language: langConfig.language,
    versionIndex: langConfig.versionIndex,
    timeoutMs,
  });
  const elapsedMs = Date.now() - startedAt;

  // Handle Quota / 429 / Auth errors
  const isQuota =
    apiRes.httpStatus === 429 ||
    apiRes.statusCode === 429 ||
    (typeof apiRes.error === "string" && apiRes.error.toLowerCase().includes("daily limit")) ||
    (typeof apiRes.output === "string" && apiRes.output.toLowerCase().includes("daily limit"));

  if (isQuota) {
    return {
      status: "execution_error",
      statusDescription: "Quota Exceeded",
      statusId: 13,
      stdout: "",
      stderr: "Code execution service quota has been reached. Please try again later.",
      compileOutput: "",
      output: "Code execution service quota has been reached. Please try again later.",
      timeMs: elapsedMs,
      timeSeconds: (elapsedMs / 1000).toFixed(2),
      memoryKB: 0,
      token: null,
      type: "execution_error",
    };
  }

  if (apiRes.isTimeout) {
    return {
      status: "time_limit",
      statusDescription: "Time Limit Exceeded",
      statusId: 5,
      stdout: "",
      stderr: "Time Limit Exceeded",
      compileOutput: "",
      output: "Time Limit Exceeded",
      timeMs: timeoutMs,
      timeSeconds: (timeoutMs / 1000).toFixed(2),
      memoryKB: 0,
      token: null,
      type: "time_limit",
    };
  }

  if (apiRes.httpStatus >= 400 && apiRes.httpStatus !== 200 && !apiRes.output) {
    return {
      status: "execution_error",
      statusDescription: "Execution Error",
      statusId: 13,
      stdout: "",
      stderr: apiRes.error || "Failed to execute code on remote service.",
      compileOutput: "",
      output: apiRes.error || "Failed to execute code on remote service.",
      timeMs: elapsedMs,
      timeSeconds: (elapsedMs / 1000).toFixed(2),
      memoryKB: 0,
      token: null,
      type: "execution_error",
    };
  }

  const rawOut = apiRes.output || "";
  const classified = classifyJDoodleOutput(rawOut, langId);
  const timeSeconds = apiRes.cpuTime ? String(apiRes.cpuTime) : (elapsedMs / 1000).toFixed(2);
  const timeMs = apiRes.cpuTime ? Math.round(parseFloat(apiRes.cpuTime) * 1000) : elapsedMs;
  const memoryKB = apiRes.memory ? parseInt(apiRes.memory, 10) : 0;

  return {
    status: classified.status,
    statusDescription: classified.statusDescription,
    statusId: classified.statusId,
    stdout: classified.stdout,
    stderr: classified.stderr,
    compileOutput: classified.compileOutput,
    output: String(rawOut).trim(),
    timeMs,
    timeSeconds,
    memoryKB,
    token: null,
    type: classified.status,
  };
}

/**
 * Execute test suite against multiple test cases via JDoodle API.
 */
export async function executeJDoodleTestSuite({
  sourceCode,
  code,
  language = "python",
  testCases = [],
  cpuTimeLimit = 2.0,
  timeLimitMs = null,
  functionName,
  methodName,
  className,
}) {
  const rawCode = sourceCode !== undefined ? sourceCode : (code || "");
  const langId = normalizeLanguage(language);

  if (!langId) {
    return {
      status: "execution_error",
      statusDescription: `Unsupported language: ${language}`,
      passed: 0,
      total: testCases.length,
      score: 0,
      executionTime: "0.00",
      memory: 0,
      compileOutput: `Unsupported language: ${language}`,
      testResults: (testCases || []).map((tc, idx) => ({
        index: idx + 1,
        passed: false,
        isHidden: Boolean(tc.isHidden),
        input: tc.isHidden ? "" : String(tc.input || ""),
        expected: tc.isHidden ? "" : String(getTestCaseExpectedOutput(tc)),
        actual: "",
        error: `Unsupported language: ${language}`,
        status: "Failed",
        timeMs: 0,
      })),
    };
  }

  const cases = Array.isArray(testCases) ? testCases : [];
  const results = [];
  let passedCount = 0;
  let totalTimeMs = 0;
  let maxMemoryKB = 0;
  let firstCompileOutput = "";

  for (let i = 0; i < cases.length; i++) {
    const tc = cases[i];
    const isHidden = Boolean(tc.isHidden);
    const tcInput = prepareExecutionInput(tc.input ?? tc.stdin ?? (typeof tc === "string" ? tc : ""));
    const tcExpected = getTestCaseExpectedOutput(tc);

    try {
      const execResult = await executeJDoodleSingle({
        sourceCode: rawCode,
        language: langId,
        stdin: tcInput,
        timeLimitMs,
        cpuTimeLimit,
        functionName,
        methodName,
        className,
      });

      totalTimeMs += execResult.timeMs;
      maxMemoryKB = Math.max(maxMemoryKB, execResult.memoryKB);

      if (execResult.status === "compile_error") {
        firstCompileOutput = execResult.compileOutput || execResult.output || "Compilation Error";
        return {
          status: "compile_error",
          statusDescription: "Compilation Error",
          passed: 0,
          total: cases.length,
          score: 0,
          executionTime: (totalTimeMs / 1000).toFixed(2),
          memory: maxMemoryKB,
          compileOutput: firstCompileOutput,
          testResults: cases.map((c, idx) => ({
            index: idx + 1,
            passed: false,
            isHidden: Boolean(c.isHidden),
            input: c.isHidden ? "" : prepareExecutionInput(c.input ?? c.stdin ?? ""),
            expected: c.isHidden ? "" : String(getTestCaseExpectedOutput(c)),
            actual: "",
            error: "Compilation Error",
            status: "Compilation Error",
            timeMs: 0,
          })),
        };
      }

      const isPassed = execResult.status === "success" && compareOutputs(execResult.stdout || execResult.output, tcExpected);

      if (isPassed) {
        passedCount++;
      }

      const caseStatus = isPassed
        ? "Accepted"
        : execResult.status === "time_limit"
        ? "Time Limit Exceeded"
        : execResult.status === "runtime_error"
        ? "Runtime Error"
        : execResult.status === "success"
        ? "Wrong Answer"
        : execResult.statusDescription || "Failed";

      results.push({
        index: i + 1,
        passed: isPassed,
        isHidden,
        input: isHidden ? "" : tcInput,
        expected: isHidden ? "" : String(tcExpected),
        actual: isHidden ? "" : (execResult.stdout || execResult.output || ""),
        error: isPassed ? "" : (execResult.stderr || (execResult.status !== "success" ? (execResult.statusDescription || execResult.output) : "")),
        status: caseStatus,
        timeMs: execResult.timeMs,
      });
    } catch (caseErr) {
      results.push({
        index: i + 1,
        passed: false,
        isHidden,
        input: isHidden ? "" : tcInput,
        expected: isHidden ? "" : String(tcExpected),
        actual: "",
        error: caseErr.message || "Execution Failed",
        status: "Failed",
        timeMs: 0,
      });
    }
  }

  const total = cases.length;
  const score = total > 0 ? Math.round((passedCount / total) * 100) : 0;
  const overallStatus = passedCount === total && total > 0 ? "accepted" : (passedCount > 0 ? "wrong_answer" : "failed");
  const statusDescription = overallStatus === "accepted" ? "Accepted" : overallStatus === "wrong_answer" ? "Wrong Answer" : "Failed";

  return {
    status: overallStatus,
    statusDescription,
    passed: passedCount,
    total,
    score,
    executionTime: (totalTimeMs / 1000).toFixed(2),
    memory: maxMemoryKB,
    compileOutput: "",
    testResults: results,
  };
}
