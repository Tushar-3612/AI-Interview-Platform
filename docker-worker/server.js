import express from "express";
import helmet from "helmet";
import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables from .env if present
dotenv.config();

// Mark this process as the Docker worker so direct Docker execution is used
process.env.IS_DOCKER_WORKER = "true";

import {
  executeDocker,
  executeDockerTestSuite,
  checkDockerHealth,
  normalizeLanguage,
  isLanguageSupported,
  getSupportedLanguages,
  getExecutionProviderInfo,
} from "../backend/modules/codingAssessment/services/codeExecutionService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.CODE_EXECUTION_WORKER_PORT || process.env.WORKER_PORT || process.env.PORT, 10) || 5050;
const WORKER_SECRET = (process.env.CODE_EXECUTION_WORKER_SECRET || process.env.WORKER_SECRET || "").trim();

const MAX_CODE_SIZE_BYTES = 256 * 1024; // 256 KB
const MAX_STDIN_SIZE_BYTES = 1024 * 1024; // 1 MB

// ─── Security & Parsing Middleware ──────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // API-only worker
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ─── Safe Structured Request Logger (No secrets, no code logged) ────────────
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = crypto.randomBytes(4).toString("hex");
  req.requestId = requestId;

  res.on("finish", () => {
    const duration = Date.now() - start;
    const ip = req.ip || req.socket.remoteAddress;
    // Log only safe operational metadata
    console.log(
      JSON.stringify({
        level: "info",
        timestamp: new Date().toISOString(),
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: duration,
        ip,
      })
    );
  });
  next();
});

// ─── Authentication Middleware ──────────────────────────────────────────────
function authenticateSecret(req, res, next) {
  if (!WORKER_SECRET) {
    console.warn("[Worker Auth] WARNING: CODE_EXECUTION_WORKER_SECRET is not configured on worker!");
    return res.status(500).json({
      status: "error",
      message: "Worker authentication secret is not configured on server.",
    });
  }

  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      status: "error",
      message: "Unauthorized: Missing or malformed Authorization header. Expected Bearer token.",
    });
  }

  const token = authHeader.slice(7).trim();
  
  // Safe constant-time token comparison
  const tokenBuf = Buffer.from(token);
  const secretBuf = Buffer.from(WORKER_SECRET);

  if (tokenBuf.length !== secretBuf.length || !crypto.timingSafeEqual(tokenBuf, secretBuf)) {
    return res.status(401).json({
      status: "error",
      message: "Unauthorized: Invalid execution worker secret.",
    });
  }

  next();
}

// ─── Health Check Endpoint (GET /health) ────────────────────────────────────
app.get("/health", (req, res) => {
  try {
    const health = checkDockerHealth();
    res.status(health.available ? 200 : 503).json({
      status: health.available ? "ok" : "degraded",
      docker: health.available ? "available" : "unavailable",
      runners: {
        python: Boolean(health.images?.python),
        java: Boolean(health.images?.java),
        c: Boolean(health.images?.c),
        cpp: Boolean(health.images?.cpp),
        javascript: Boolean(health.images?.javascript),
      },
      uptime: process.uptime(),
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      docker: "unavailable",
      runners: {
        python: false,
        java: false,
        c: false,
        cpp: false,
        javascript: false,
      },
      message: "Failed to query Docker health.",
    });
  }
});

// ─── Provider & System Info Endpoint (GET /info) ────────────────────────────
app.get("/info", authenticateSecret, (req, res) => {
  try {
    const info = getExecutionProviderInfo();
    res.json({
      status: "ok",
      provider: info.provider,
      docker: info.docker,
      supportedLanguages: getSupportedLanguages(),
      images: info.images,
      concurrency: info.concurrency,
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: "Failed to retrieve provider info" });
  }
});

// ─── Single Execution Endpoint (POST /execute) ──────────────────────────────
app.post("/execute", authenticateSecret, async (req, res) => {
  try {
    const {
      language,
      code,
      sourceCode,
      stdin,
      args,
      timeLimitMs,
      cpuTimeLimit,
      memoryLimitMb,
      memoryLimit,
      mode,
      className,
      methodName,
      functionName,
      runnerClassName,
      executionId,
      testCaseId,
    } = req.body;

    const actualCode = (code !== undefined ? code : sourceCode) || "";
    const actualLang = language ? String(language).trim().toLowerCase() : "";

    // Validation: Language
    if (!actualLang) {
      return res.status(400).json({
        status: "error",
        message: "Missing required field: language",
      });
    }

    const normLang = normalizeLanguage(actualLang);
    if (!normLang || !isLanguageSupported(normLang)) {
      return res.status(400).json({
        status: "error",
        message: `Unsupported language: "${actualLang}". Supported: ${getSupportedLanguages().join(", ")}`,
      });
    }

    // Validation: Code
    if (typeof actualCode !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Code must be a string.",
      });
    }

    if (Buffer.byteLength(actualCode, "utf8") > MAX_CODE_SIZE_BYTES) {
      return res.status(400).json({
        status: "error",
        message: `Code size exceeds maximum allowed size of ${MAX_CODE_SIZE_BYTES / 1024} KB.`,
      });
    }

    // Validation: Stdin
    if (stdin !== undefined && stdin !== null && typeof stdin !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Stdin must be a string if provided.",
      });
    }

    if (stdin && Buffer.byteLength(stdin, "utf8") > MAX_STDIN_SIZE_BYTES) {
      return res.status(400).json({
        status: "error",
        message: `Stdin size exceeds maximum allowed size of ${MAX_STDIN_SIZE_BYTES / 1024} KB.`,
      });
    }

    // Validation: Args
    if (args !== undefined && args !== null && !Array.isArray(args)) {
      return res.status(400).json({
        status: "error",
        message: "Args must be an array if provided.",
      });
    }

    // Validation: Limits
    const parsedTimeMs = timeLimitMs ? Number(timeLimitMs) : (cpuTimeLimit ? Number(cpuTimeLimit) * 1000 : null);
    if (parsedTimeMs !== null && (isNaN(parsedTimeMs) || parsedTimeMs < 100 || parsedTimeMs > 60000)) {
      return res.status(400).json({
        status: "error",
        message: "timeLimitMs must be a number between 100 and 60000 ms.",
      });
    }

    const parsedMemMb = memoryLimitMb ? Number(memoryLimitMb) : (memoryLimit ? Math.round(Number(memoryLimit) / 1024) : null);
    if (parsedMemMb !== null && (isNaN(parsedMemMb) || parsedMemMb < 16 || parsedMemMb > 1024)) {
      return res.status(400).json({
        status: "error",
        message: "memoryLimitMb must be a number between 16 and 1024 MB.",
      });
    }

    // Validation: Mode
    if (mode && mode !== "stdin" && mode !== "function") {
      return res.status(400).json({
        status: "error",
        message: "Invalid mode. Allowed modes are 'stdin' or 'function'.",
      });
    }

    // Execute via Docker Sandbox
    const result = await executeDocker({
      language: normLang,
      sourceCode: actualCode,
      code: actualCode,
      stdin: stdin || "",
      args: Array.isArray(args) ? args : [],
      timeLimitMs: parsedTimeMs || undefined,
      cpuTimeLimit: parsedTimeMs ? parsedTimeMs / 1000 : (cpuTimeLimit || undefined),
      memoryLimitMb: parsedMemMb || undefined,
      memoryLimit: memoryLimit || undefined,
      className,
      methodName,
      functionName,
      runnerClassName,
      executionId,
      testCaseId,
    });

    return res.json(result);
  } catch (err) {
    if (err.code === "EXECUTION_QUEUE_FULL" || err.isBusy) {
      return res.status(429).json({
        status: "execution_error",
        statusDescription: "Service Busy",
        output: "Code execution worker is currently at capacity. Please try again shortly.",
      });
    }

    console.error(`[Worker Execution Error] [req:${req.requestId}]:`, err.message);
    return res.status(500).json({
      status: "execution_error",
      statusDescription: "Execution Error",
      output: "Internal error during code execution.",
    });
  }
});

// ─── Batch Test Suite Execution Endpoint (POST /execute-suite) ──────────────
app.post("/execute-suite", authenticateSecret, async (req, res) => {
  try {
    const {
      language,
      code,
      sourceCode,
      testCases,
      cpuTimeLimit,
      timeLimitMs,
      memoryLimit,
      memoryLimitMb,
      className,
      methodName,
      functionName,
    } = req.body;

    const actualCode = (code !== undefined ? code : sourceCode) || "";
    const actualLang = language ? String(language).trim().toLowerCase() : "";

    if (!actualLang) {
      return res.status(400).json({ status: "error", message: "Missing required field: language" });
    }

    const normLang = normalizeLanguage(actualLang);
    if (!normLang || !isLanguageSupported(normLang)) {
      return res.status(400).json({
        status: "error",
        message: `Unsupported language: "${actualLang}". Supported: ${getSupportedLanguages().join(", ")}`,
      });
    }

    if (typeof actualCode !== "string") {
      return res.status(400).json({ status: "error", message: "Code must be a string." });
    }

    if (Buffer.byteLength(actualCode, "utf8") > MAX_CODE_SIZE_BYTES) {
      return res.status(400).json({
        status: "error",
        message: `Code size exceeds maximum allowed size of ${MAX_CODE_SIZE_BYTES / 1024} KB.`,
      });
    }

    if (!Array.isArray(testCases)) {
      return res.status(400).json({ status: "error", message: "testCases must be an array." });
    }

    if (testCases.length > 100) {
      return res.status(400).json({ status: "error", message: "Maximum 100 test cases allowed per suite request." });
    }

    const suiteResult = await executeDockerTestSuite({
      language: normLang,
      sourceCode: actualCode,
      code: actualCode,
      testCases,
      cpuTimeLimit,
      timeLimitMs,
      memoryLimit,
      memoryLimitMb,
      className,
      methodName,
      functionName,
    });

    return res.json(suiteResult);
  } catch (err) {
    if (err.code === "EXECUTION_QUEUE_FULL" || err.isBusy) {
      return res.status(429).json({
        status: "execution_error",
        statusDescription: "Service Busy",
        output: "Code execution worker is currently at capacity. Please try again shortly.",
      });
    }

    console.error(`[Worker Suite Error] [req:${req.requestId}]:`, err.message);
    return res.status(500).json({
      status: "execution_error",
      statusDescription: "Execution Error",
      output: "Internal error during test suite execution.",
    });
  }
});

// ─── Central JSON Error / 404 Handler ───────────────────────────────────────
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ status: "error", message: "Malformed JSON payload." });
  }
  console.error("[Worker Unhandled Error]:", err.message);
  return res.status(500).json({ status: "error", message: "Internal server error." });
});

app.use((req, res) => {
  res.status(404).json({ status: "error", message: "Route not found on Docker Execution Worker." });
});

// ─── Start Server & Handle Graceful Shutdown ────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`========================================================`);
  console.log(` Docker Execution Worker running on port ${PORT}`);
  console.log(` Health endpoint: http://localhost:${PORT}/health`);
  console.log(` Execution endpoint: http://localhost:${PORT}/execute`);
  console.log(` Auth: ${WORKER_SECRET ? "Protected (Secret configured)" : "UNCONFIGURED (Set CODE_EXECUTION_WORKER_SECRET)"}`);
  console.log(`========================================================`);
});

const handleShutdown = (signal) => {
  console.log(`\nReceived ${signal}. Gracefully shutting down Docker Execution Worker...`);
  server.close(() => {
    console.log("Docker Execution Worker closed. Exiting process.");
    process.exit(0);
  });
  // Force exit after 10s if hanging requests remain
  setTimeout(() => {
    console.error("Forcefully shutting down after timeout.");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

export default app;
