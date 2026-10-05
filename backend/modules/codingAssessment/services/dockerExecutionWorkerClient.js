import http from "http";
import https from "https";
import { URL } from "url";

/**
 * Docker Execution Worker Client
 * ---------------------------------------------------------------------------
 * Dispatches code execution requests from the Render Backend (or local backend)
 * to a dedicated secure Docker Execution Worker over HTTPS/HTTP.
 *
 * Contract:
 * - Bearer token authentication (CODE_EXECUTION_WORKER_SECRET)
 * - Safe request timeouts
 * - Controlled error normalization (no secret / internal leaks)
 */

function getWorkerConfig() {
  const url = (process.env.CODE_EXECUTION_WORKER_URL || "").trim().replace(/\/+$/, "");
  const secret = (process.env.CODE_EXECUTION_WORKER_SECRET || "").trim();
  return { url, secret, isConfigured: Boolean(url && secret) };
}

export function isWorkerConfigured() {
  const { isConfigured } = getWorkerConfig();
  return isConfigured;
}

/**
 * Low-level HTTP/HTTPS JSON request helper with timeouts and abort handling.
 */
async function workerRequest(endpointPath, { method = "GET", body = null, timeoutMs = 30000 } = {}) {
  const { url: baseUrl, secret } = getWorkerConfig();
  if (!baseUrl) {
    throw new Error("CODE_EXECUTION_WORKER_URL is not set.");
  }

  const targetUrl = new URL(endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`, baseUrl);
  const isHttps = targetUrl.protocol === "https:";
  const client = isHttps ? https : http;

  const payload = body ? JSON.stringify(body) : null;
  const headers = {
    "Accept": "application/json",
  };

  if (secret) {
    headers["Authorization"] = `Bearer ${secret}`;
  }

  if (payload) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = Buffer.byteLength(payload, "utf8");
  }

  return new Promise((resolve, reject) => {
    const req = client.request(
      targetUrl,
      {
        method,
        headers,
        timeout: timeoutMs,
      },
      (res) => {
        let responseData = "";
        res.setEncoding("utf8");

        res.on("data", (chunk) => {
          responseData += chunk;
        });

        res.on("end", () => {
          let parsed;
          try {
            parsed = responseData ? JSON.parse(responseData) : {};
          } catch (_) {
            parsed = { raw: responseData };
          }

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            const err = new Error(parsed?.message || parsed?.output || `Worker returned HTTP ${res.statusCode}`);
            err.statusCode = res.statusCode;
            err.payload = parsed;
            reject(err);
          }
        });
      }
    );

    req.on("timeout", () => {
      req.destroy();
      const err = new Error("Execution worker request timed out.");
      err.code = "ETIMEDOUT";
      reject(err);
    });

    req.on("error", (err) => {
      reject(err);
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

/**
 * Check Docker Health on the remote worker
 */
export async function checkWorkerHealth() {
  try {
    const { url } = getWorkerConfig();
    if (!url) {
      return { available: false, images: {}, reason: "Worker URL not configured" };
    }

    const health = await workerRequest("/health", { method: "GET", timeoutMs: 5000 });
    const isAvail = health.docker === "available" || health.status === "ok";
    return {
      available: isAvail,
      images: health.runners || {},
      status: health.status || "ok",
      uptime: health.uptime || 0,
    };
  } catch (err) {
    console.warn(`[Worker Client] Health check failed: ${err.message}`);
    return {
      available: false,
      images: {},
      status: "unavailable",
      error: "Code execution worker is unreachable.",
    };
  }
}

/**
 * Execute single code payload via remote worker
 */
export async function executeViaWorker(params) {
  try {
    const response = await workerRequest("/execute", {
      method: "POST",
      body: params,
      timeoutMs: (params.timeLimitMs || 10000) + 15000, // Client timeout = code timeout + network buffer
    });
    return response;
  } catch (err) {
    console.error(`[Worker Client] Execution failed: ${err.message}`);
    
    // If worker returned a 429 Busy response
    if (err.statusCode === 429) {
      return {
        status: "execution_error",
        statusDescription: "Service Busy",
        output: "Code execution service is currently busy. Please retry in a few moments.",
        executionTime: "0.00",
        memory: 0,
        compileOutput: "",
        testResults: [],
      };
    }

    // Normalized controlled execution error (no leakage of internal details)
    return {
      status: "execution_error",
      statusDescription: "Execution Error",
      output: "Code execution service is temporarily unavailable.",
      executionTime: "0.00",
      memory: 0,
      compileOutput: "",
      testResults: [],
    };
  }
}

/**
 * Execute test suite via remote worker
 */
export async function executeSuiteViaWorker(params) {
  try {
    const response = await workerRequest("/execute-suite", {
      method: "POST",
      body: params,
      timeoutMs: ((params.cpuTimeLimit || 10) * 1000 * Math.min(20, (params.testCases || []).length || 1)) + 20000,
    });
    return response;
  } catch (err) {
    console.error(`[Worker Client] Suite execution failed: ${err.message}`);

    const total = Array.isArray(params.testCases) ? params.testCases.length : 0;
    const fallbackResults = (params.testCases || []).map((tc, idx) => ({
      testCaseId: tc._id || tc.id || `tc_${idx + 1}`,
      passed: false,
      input: tc.input ?? tc.stdin ?? "",
      expectedOutput: tc.expectedOutput ?? tc.expected_output ?? "",
      actualOutput: "",
      error: "Code execution service is temporarily unavailable.",
      executionTime: "0.00",
      memory: 0,
      status: "execution_error",
      statusDescription: "Execution Error",
      isHidden: Boolean(tc.isHidden ?? tc.is_hidden),
    }));

    return {
      status: "execution_error",
      statusDescription: "Execution Error",
      passed: 0,
      total,
      score: 0,
      executionTime: "0.00",
      memory: 0,
      compileOutput: "",
      testResults: fallbackResults,
    };
  }
}
