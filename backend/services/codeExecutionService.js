import { spawn, execFileSync } from "child_process";
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";

/* ============================================================================
 * Docker-based multi-language code execution service
 * ---------------------------------------------------------------------------
 * Supported languages: Java, C++, C, Python
 *
 * Every execution runs inside an isolated Docker container with:
 *  - No network access (--network none)
 *  - Memory limit (--memory)
 *  - CPU limit (--cpus)
 *  - Process limit (--pids-limit)
 *  - Read-only root filesystem (--read-only + tmpfs)
 *  - Automatic cleanup (--rm)
 *  - Timeout enforced from Node.js side
 *
 * Student code is NEVER executed directly on the Node.js host.
 * ==========================================================================*/

// ─── Configuration ──────────────────────────────────────────────────────────

const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = parseInt(process.env.CODE_TIMEOUT_MS, 10) || 10000;
const COMPILE_TIMEOUT_MS = 30000;
const MEMORY_LIMIT = process.env.CODE_MEMORY_LIMIT || "256m";
const CPU_LIMIT = process.env.CODE_CPU_LIMIT || "0.5";
const PIDS_LIMIT = process.env.CODE_PIDS_LIMIT || "64";

const LANG_ALIASES = {
  python: "python", py: "python", python3: "python",
  java: "java",
  c: "c",
  cpp: "cpp", "c++": "cpp", cplusplus: "cpp",
};

/**
 * Central language configuration — the ONLY place language-specific
 * commands, images, and filenames are defined.
 */
const LANGUAGE_CONFIG = {
  java: {
    id: "java",
    label: "Java",
    image: "code-runner-java:latest",
    sourceFile: "Solution.java",
    wrapperFile: "Main.java",
    compileCommand: ["javac", "Solution.java", "Main.java"],
    runCommand: ["java", "-cp", ".", "Main"],
    kind: "function",
  },
  cpp: {
    id: "cpp",
    label: "C++",
    image: "code-runner-cpp:latest",
    sourceFile: "main.cpp",
    wrapperFile: null,
    compileCommand: ["g++", "main.cpp", "-o", "main", "-O2", "-std=c++17", "-w", "-lm"],
    runCommand: ["./main"],
    kind: "stdin",
  },
  c: {
    id: "c",
    label: "C",
    image: "code-runner-c:latest",
    sourceFile: "main.c",
    wrapperFile: null,
    compileCommand: ["gcc", "main.c", "-o", "main", "-O2", "-w", "-lm"],
    runCommand: ["./main"],
    kind: "stdin",
  },
  python: {
    id: "python",
    label: "Python",
    image: "code-runner-python:latest",
    sourceFile: "solution.py",
    wrapperFile: null,
    compileCommand: null,
    runCommand: ["python3", "solution.py"],
    kind: "function",
  },
};

// ─── Public helpers (same API as before) ────────────────────────────────────

export function normalizeLanguage(language) {
  if (!language) return null;
  return LANG_ALIASES[String(language).trim().toLowerCase()] || null;
}

export function getSupportedLanguages() {
  return Object.values(LANGUAGE_CONFIG).map((l) => l.label);
}

export function isStdinLanguage(languageId) {
  return languageId === "c" || languageId === "cpp";
}

export function isLanguageSupported(languageId) {
  return LANG_ALIASES[String(languageId).trim().toLowerCase()] !== undefined;
}

/* ============================================================================
 * Docker environment detection (lazy, cached)
 * ==========================================================================*/

const dockerState = {
  checked: false,
  available: false,
  images: { java: false, cpp: false, c: false, python: false },
};

function checkDockerSync() {
  try {
    execFileSync("docker", ["info"], { timeout: 10000, stdio: "pipe", windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

function checkImageSync(imageName) {
  try {
    const out = execFileSync("docker", ["images", "-q", imageName], {
      timeout: 5000, stdio: "pipe", windowsHide: true, encoding: "utf8",
    });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

function ensureDockerChecked() {
  if (dockerState.checked) return;
  dockerState.checked = true;
  dockerState.available = checkDockerSync();

  console.log("");
  console.log("========================================");
  console.log("  CODE EXECUTION ENVIRONMENT");
  console.log("========================================");
  console.log(`  Docker: ${dockerState.available ? "AVAILABLE" : "NOT AVAILABLE"}`);
  console.log("");

  if (!dockerState.available) {
    console.log("  ⚠️  Docker is NOT running!");
    console.log("  ⚠️  Code execution will NOT work.");
    console.log("  ⚠️  Start Docker Desktop and restart the server.");
    console.log("========================================");
    console.log("");
    return;
  }

  for (const [langId, config] of Object.entries(LANGUAGE_CONFIG)) {
    const available = checkImageSync(config.image);
    dockerState.images[langId] = available;
    console.log(`  ${config.label} Runner: ${available ? "AVAILABLE" : "NOT FOUND"} (${config.image})`);
  }

  const allAvailable = Object.values(dockerState.images).every(Boolean);
  if (!allAvailable) {
    console.log("");
    console.log("  ⚠️  Some images are missing. Run:");
    console.log("  docker compose build");
  }

  console.log("========================================");
  console.log("");
}

/* ============================================================================
 * Per-language literal generation (arguments embedded into the harness)
 * ==========================================================================*/

function escapeJsonString(s) {
  return JSON.stringify(String(s));
}

function pyLiteral(value) {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "None";
  if (typeof value === "string") return escapeJsonString(value);
  if (Array.isArray(value)) return "[" + value.map(pyLiteral).join(", ") + "]";
  return "None";
}

function escapeJavaStyleString(s) {
  const out = String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  let escaped = out.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
  escaped = escaped.replace(/[\u0000-\u001f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
  return `"${escaped}"`;
}

function javaValueLiteral(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "0";
    if (Number.isInteger(value)) {
      if (value >= -2147483648 && value <= 2147483647) return String(value);
      return `${value}L`;
    }
    return `${value}d`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "new int[]{}";
    if (value.every((x) => typeof x === "number" && Number.isInteger(x) && Number.isFinite(x))) {
      const inIntRange = value.every((x) => x >= -2147483648 && x <= 2147483647);
      return inIntRange ? `new int[]{${value.join(", ")}}` : `new long[]{${value.map((x) => `${x}L`).join(", ")}}`;
    }
    if (value.every((x) => typeof x === "number")) return `new double[]{${value.join(", ")}}`;
    if (value.every((x) => typeof x === "string")) return `new String[]{${value.map((x) => escapeJavaStyleString(x)).join(", ")}}`;
    return `new Object[]{${value.map(javaValueLiteral).join(", ")}}`;
  }
  return escapeJavaStyleString(value);
}

function javaSingleArgLiteral(value) {
  return javaValueLiteral(value);
}

function javaTypedLiteral(type, value) {
  if (type === "char" && typeof value === "string" && value.length === 1) {
    const code = value.charCodeAt(0);
    if (code === 39) return "'\\''";
    if (code === 92) return "'\\\\'";
    if (code === 10) return "'\\n'";
    if (code === 13) return "'\\r'";
    if (code === 9) return "'\\t'";
    if (code >= 32 && code < 127) return `'${value}'`;
    return `'\\u${code.toString(16).padStart(4, "0")}'`;
  }
  return javaValueLiteral(value);
}

/* ============================================================================
 * Java method signature parser and typed invocation generator
 * ==========================================================================*/

function parseJavaParamTypes(code) {
  const src = String(code || "");
  const m = src.match(/(?:public\s+|static\s+)*\w[\w<>\[\],\s]*\bsolve\s*\(([^)]*)\)/);
  if (!m) return null;
  const paramStr = m[1].trim();
  if (!paramStr) return [];
  const params = [];
  let depth = 0;
  let current = "";
  for (const ch of paramStr) {
    if (ch === "<" || ch === "[") depth++;
    if (ch === ">" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      params.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) params.push(current.trim());
  return params.map((p) => {
    const varargs = p.match(/^(.+?)\.\.\.\s*\w+$/);
    if (varargs) return varargs[1].trim() + "[]";
    const parts = p.split(/\s+/);
    const typeParts = [];
    let i = 0;
    while (i < parts.length - 1) {
      typeParts.push(parts[i]);
      i++;
    }
    let type = typeParts.join(" ");
    const last = parts[parts.length - 1];
    if (last && last.startsWith("[]")) {
      type += "[]";
    }
    return type;
  });
}

const JAVA_PRIMITIVE_BOXED = {
  int: "Integer", long: "Long", double: "Double",
  float: "Float", boolean: "Boolean", char: "Character",
  byte: "Byte", short: "Short",
};

function isJavaPrimitive(t) {
  return JAVA_PRIMITIVE_BOXED.hasOwnProperty(t);
}

function javaUnboxExpression(type, varAccess) {
  if (isJavaPrimitive(type)) {
    const boxed = JAVA_PRIMITIVE_BOXED[type];
    return `((${boxed}) ${varAccess}).${type === "boolean" ? "booleanValue" : type === "char" ? "charValue" : type + "Value"}()`;
  }
  return `(${type}) ${varAccess}`;
}

function javaInvocationForParams(paramTypes, arrayVar) {
  if (!paramTypes || paramTypes.length === 0) {
    return arrayVar;
  }
  const isVarargs = paramTypes.length === 1 && paramTypes[0].endsWith("[]");
  if (isVarargs && paramTypes[0] === "Object[]") {
    return arrayVar;
  }
  if (paramTypes.length === 1) {
    const t = paramTypes[0];
    if (t === "char") {
      return `((String) ${arrayVar}[0]).charAt(0)`;
    }
    if (isJavaPrimitive(t)) {
      return javaUnboxExpression(t, `${arrayVar}[0]`);
    }
    return `(${t}) ${arrayVar}[0]`;
  }
  return paramTypes.map((t, i) => {
    if (t === "char") {
      return `((String) ${arrayVar}[${i}]).charAt(0)`;
    }
    if (isJavaPrimitive(t)) {
      return javaUnboxExpression(t, `${arrayVar}[${i}]`);
    }
    return `(${t}) ${arrayVar}[${i}]`;
  }).join(", ");
}

/* ============================================================================
 * Harness builders
 * ==========================================================================*/

function harnessForRun(langId, args, code) {
  switch (langId) {
    case "python":
      return `\nimport json as __json\n__result = solution(*${pyLiteral(args)})\nprint(__json.dumps(__result, default=str))\n`;
    case "java": {
      const paramTypes = code ? parseJavaParamTypes(code) : null;
      let invocation;
      if (args.length === 0) {
        invocation = "";
      } else if (args.length === 1) {
        if (paramTypes && paramTypes.length === 1) {
          invocation = javaTypedLiteral(paramTypes[0], args[0]);
        } else {
          invocation = javaSingleArgLiteral(args[0]);
        }
      } else {
        if (paramTypes && paramTypes.length === args.length) {
          invocation = args.map((a, i) => {
            const t = paramTypes[i];
            if (isJavaPrimitive(t)) {
              const boxed = JAVA_PRIMITIVE_BOXED[t];
              const lit = javaValueLiteral(a);
              return `new ${boxed}(${lit}).${t === "boolean" ? "booleanValue" : t === "char" ? "charValue" : t + "Value"}()`;
            }
            return `(${t}) ${javaValueLiteral(a)}`;
          }).join(", ");
        } else {
          invocation = args.map(a => javaValueLiteral(a)).join(", ");
        }
      }
      const mainBlock = `public class Main {
    public static void main(String[] args) {
        Object __result = Solution.solve(${invocation});
        System.out.println(Main.toJson(__result));
    }`;
      return mainBlock + buildJavaToJsonSuffix();
    }
    default:
      return "";
  }
}

function harnessForBatch(langId, cases, code) {
  switch (langId) {
    case "python": {
      const list = cases.map((c) => pyLiteral(c)).join(", ");
      return `\nimport json as __json
__cases = [${list}]
for __c in __cases:
    print(__json.dumps(solution(*__c), default=str))
`;
    }
    case "java": {
      const caseLiterals = cases.map((c) => `new Object[]{${c.map(javaValueLiteral).join(", ")}}`).join(",\n        ");
      const paramTypes = code ? parseJavaParamTypes(code) : null;
      const invocation = javaInvocationForParams(paramTypes, "__c");
      const run = `public class Main {
    public static void main(String[] args) {
        Object[][] __cases = new Object[][]{
        ${caseLiterals}
        };
        for (Object[] __c : __cases) {
            System.out.println(Main.toJson(Solution.solve(${invocation})));
        }
    }`;
      return run + buildJavaToJsonSuffix();
    }
    default:
      return "";
  }
}

function buildJavaToJsonSuffix() {
  return String.raw`
    static String toJson(Object value) {
        if (value == null) return "null";
        if (value instanceof String) return toJsonString((String) value);
        if (value instanceof Boolean || value instanceof Number) return value.toString();
        if (value.getClass().isArray()) {
            int length = java.lang.reflect.Array.getLength(value);
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < length; i++) {
                if (i > 0) sb.append(",");
                sb.append(toJson(java.lang.reflect.Array.get(value, i)));
            }
            return sb.append("]").toString();
        }
        return toJsonString(value.toString());
    }
    static String toJsonString(String s) {
        StringBuilder sb = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < 32) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
            }
        }
        return sb.append("\"").toString();
    }
}
`;
}

/* ============================================================================
 * Source assembly
 * ==========================================================================*/

function buildSources(langId, code, harness) {
  switch (langId) {
    case "python":
      return [{ name: "solution.py", content: String(code) + harness }];
    case "java":
      return [
        { name: "Solution.java", content: String(code) },
        { name: "Main.java", content: harness },
      ];
    case "c":
      return [{ name: "main.c", content: String(code) }];
    case "cpp":
      return [{ name: "main.cpp", content: String(code) }];
    default:
      return [{ name: LANGUAGE_CONFIG[langId].sourceFile, content: String(code) }];
  }
}

/* ============================================================================
 * Docker process runner
 * ---------------------------------------------------------------------------
 * Spawns `docker run` with full isolation flags.
 * Uses spawn() with argument arrays — never shell interpolation.
 * ==========================================================================*/

function runDockerContainer(image, command, { timeoutMs = 10000, cwd, stdin, workspaceDir }) {
  return new Promise((resolve) => {
    const execId = crypto.randomBytes(4).toString("hex");
    const containerName = `coderun-${execId}`;

    const dockerArgs = [
      "run",
      "--rm",                              // auto-cleanup container
      "--name", containerName,
      "--network", "none",                 // no network access
      "--memory", MEMORY_LIMIT,            // memory limit
      "--memory-swap", MEMORY_LIMIT,       // no swap (same as memory)
      "--cpus", CPU_LIMIT,                 // CPU limit
      "--pids-limit", PIDS_LIMIT,          // process limit
      "--read-only",                       // read-only root filesystem
      "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",  // writable /tmp for compilation
      "--user", "runner",                  // non-root user
      "--workdir", "/workspace",
    ];

    // Mount the temp directory directly as /workspace so source files are
    // available at /workspace/<filename> without a cp step.
    if (workspaceDir) {
      dockerArgs.push("-v", `${workspaceDir}:/workspace:rw`);
    }

    const shellCmd = command.join(" ");
    dockerArgs.push(image, "/bin/sh", "-c", shellCmd);

    const started = Date.now();
    let stdout = "";
    let stderr = "";
    let killed = false;
    let exitCode = null;

    const child = spawn("docker", dockerArgs, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Hard timeout — kill container if exceeded
    const timer = setTimeout(() => {
      killed = true;
      // Force kill the container
      try {
        spawn("docker", ["kill", containerName], { windowsHide: true, stdio: "ignore" });
      } catch { /* container may already be gone */ }
      child.kill("SIGKILL");
    }, timeoutMs + 2000); // +2s buffer for Docker overhead

    child.stdout.on("data", (data) => {
      if (stdout.length < MAX_OUTPUT_BYTES) {
        stdout += data.toString();
      }
    });

    child.stderr.on("data", (data) => {
      if (stderr.length < MAX_OUTPUT_BYTES) {
        stderr += data.toString();
      }
    });

    if (stdin !== undefined && stdin !== null) {
      child.stdin.write(stdin);
    }
    child.stdin.end();

    child.on("close", (code) => {
      clearTimeout(timer);
      exitCode = code;
      const timeMs = Date.now() - started;

      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code: exitCode,
        timedOut: killed,
        timeMs,
        execId,
      });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        stdout: "",
        stderr: `Docker execution failed: ${err.message}`,
        code: 1,
        timedOut: false,
        timeMs: Date.now() - started,
        execId,
      });
    });
  });
}

/* ============================================================================
 * Core Docker execution
 * ==========================================================================*/

async function executeViaDocker(langId, files, { timeLimitMs, stdin }) {
  ensureDockerChecked();

  const config = LANGUAGE_CONFIG[langId];
  if (!config) {
    return { type: "execution_error", output: `No configuration for language: ${langId}`, timeMs: 0, memoryKB: 0 };
  }

  if (!dockerState.available) {
    return { type: "execution_error", output: "Docker is not available. Start Docker Desktop and restart the server.", timeMs: 0, memoryKB: 0 };
  }

  if (!dockerState.images[langId]) {
    // Re-check in case image was built after startup
    dockerState.images[langId] = checkImageSync(config.image);
    if (!dockerState.images[langId]) {
      return { type: "execution_error", output: `Docker image '${config.image}' not found. Run: docker compose build`, timeMs: 0, memoryKB: 0 };
    }
  }

  // Create temporary directory for source files
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "codeexec-"));

  try {
    // Write source files to temp directory
    for (const f of files) {
      await fsp.writeFile(path.join(dir, f.name), f.content, "utf8");
    }

    // Write stdin to file if provided
    if (stdin !== undefined && stdin !== null) {
      await fsp.writeFile(path.join(dir, "__input.txt"), String(stdin), "utf8");
    }

    // Debug: log generated source files before compilation
    for (const f of files) {
      if (f.name === "Main.java" || f.name === "main.c" || f.name === "main.cpp") {
        console.log(`\n========== Generated ${f.name} (${langId}) ==========`);
        console.log(f.content);
        console.log(`========== END ${f.name} ==========\n`);
      }
    }

    // Convert Windows path to Docker-compatible path
    const dockerDir = dir.replace(/\\/g, "/");

    // Phase 1: Compile (if needed)
    if (config.compileCommand) {
      const compileResult = await runDockerContainer(
        config.image,
        config.compileCommand,
        {
          timeoutMs: COMPILE_TIMEOUT_MS,
          workspaceDir: dockerDir,
        }
      );

      console.log(`[${compileResult.execId}] Compile ${langId}: exit=${compileResult.code} time=${compileResult.timeMs}ms`);

      if (compileResult.timedOut) {
        return { type: "compile_error", output: "Compilation timed out", timeMs: compileResult.timeMs, memoryKB: 0 };
      }

      if (compileResult.code !== 0) {
        const stderr = (compileResult.stderr || "Compilation failed").trim();
        // Distinguish wrapper errors from student errors
        if (langId === "java") {
          const isWrapperError = /Main\.java:\d+/.test(stderr) && !/Solution\.java:\d+/.test(stderr);
          return {
            type: isWrapperError ? "execution_error" : "compile_error",
            output: stderr,
            timeMs: compileResult.timeMs,
            memoryKB: 0,
          };
        }
        return { type: "compile_error", output: stderr, timeMs: compileResult.timeMs, memoryKB: 0 };
      }

      // For compiled languages, we need to run the compiled binary
      // The compiled output is in the container's /workspace tmpfs
      // So we need a single docker run that compiles AND runs
      // Let's restructure to do compile+run in one container
    }

    // For compiled languages, we compile and run in a single container
    // to avoid losing the compiled binary between containers
    if (config.compileCommand) {
      const compileAndRun = config.compileCommand.join(" ") +
        " && " +
        (stdin !== undefined && stdin !== null
          ? config.runCommand.join(" ") + " < /workspace/__input.txt"
          : config.runCommand.join(" "));

      const result = await runDockerContainer(
        config.image,
        [compileAndRun],  // Will be wrapped in sh -c by runDockerContainer
        {
          timeoutMs: COMPILE_TIMEOUT_MS + timeLimitMs,
          workspaceDir: dockerDir,
          stdin: undefined, // stdin via file
        }
      );

      console.log(`[${result.execId}] CompileRun ${langId}: exit=${result.code} time=${result.timeMs}ms`);

      if (result.timedOut) {
        return { type: "time_limit", output: `Time limit exceeded (${timeLimitMs}ms)`, timeMs: timeLimitMs, memoryKB: 0 };
      }

      if (result.code !== 0) {
        const stderr = (result.stderr || "").trim();
        const stdout = (result.stdout || "").trim();

        // Check if it's a compile error
        if (langId === "java" && (stderr.includes("error:") || stderr.includes("cannot find symbol"))) {
          const isWrapperError = /Main\.java:\d+/.test(stderr) && !/Solution\.java:\d+/.test(stderr);
          return {
            type: isWrapperError ? "execution_error" : "compile_error",
            output: stderr,
            timeMs: result.timeMs,
            memoryKB: 0,
          };
        }
        if ((langId === "c" || langId === "cpp") && stderr.includes("error:")) {
          return { type: "compile_error", output: stderr, timeMs: result.timeMs, memoryKB: 0 };
        }

        // Otherwise it's a runtime error
        return {
          type: "runtime_error",
          output: (stderr || stdout || `Process exited with code ${result.code}`).trim(),
          timeMs: result.timeMs,
          memoryKB: 0,
        };
      }

      return { type: "success", output: result.stdout.trim(), timeMs: result.timeMs, memoryKB: 0 };
    }

    // Interpreted languages (Python) — just run
    const runCmd = stdin !== undefined && stdin !== null
      ? config.runCommand.join(" ") + " < /workspace/__input.txt"
      : config.runCommand.join(" ");

    const result = await runDockerContainer(
      config.image,
      [runCmd],
      {
        timeoutMs: timeLimitMs,
        workspaceDir: dockerDir,
        stdin: undefined,
      }
    );

    console.log(`[${result.execId}] Run ${langId}: exit=${result.code} time=${result.timeMs}ms`);

    if (result.timedOut) {
      return { type: "time_limit", output: `Time limit exceeded (${timeLimitMs}ms)`, timeMs: timeLimitMs, memoryKB: 0 };
    }

    if (result.code !== 0) {
      return {
        type: "runtime_error",
        output: (result.stderr || `Process exited with code ${result.code}`).trim(),
        timeMs: result.timeMs,
        memoryKB: 0,
      };
    }

    return { type: "success", output: result.stdout.trim(), timeMs: result.timeMs, memoryKB: 0 };

  } finally {
    // Clean up temporary directory
    fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/* ============================================================================
 * Batch execution for compiled languages (C/C++) — compile once, run per case
 * ==========================================================================*/

async function executeBatchStdin(langId, code, cases, timeLimitMs) {
  ensureDockerChecked();

  const config = LANGUAGE_CONFIG[langId];
  const files = buildSources(langId, code, "");
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "codeexec-"));

  try {
    for (const f of files) {
      await fsp.writeFile(path.join(dir, f.name), f.content, "utf8");
    }

    const dockerDir = dir.replace(/\\/g, "/");

    // Build a shell script that compiles once and runs for each test case
    const caseInputs = cases.map((c, i) => ({
      name: `__input_${i}.txt`,
      content: String(c || ""),
    }));

    // Write all input files
    for (const ci of caseInputs) {
      await fsp.writeFile(path.join(dir, ci.name), ci.content, "utf8");
    }

    // Build a script: compile, then run once per input file, separating outputs
    const runCommands = caseInputs.map((ci) =>
      `${config.runCommand.join(" ")} < /workspace/${ci.name} 2>&1; echo "__EXIT_CODE__:$?"`
    ).join("; echo '---CASE_SEPARATOR---'; ");

    const fullCmd = config.compileCommand
      ? `${config.compileCommand.join(" ")} && (${runCommands})`
      : runCommands;

    const totalTimeout = COMPILE_TIMEOUT_MS + (timeLimitMs * Math.max(1, cases.length));

    const result = await runDockerContainer(
      config.image,
      [fullCmd],
      {
        timeoutMs: totalTimeout,
        workspaceDir: dockerDir,
      }
    );

    if (result.timedOut) {
      return { type: "time_limit", output: `Time limit exceeded`, timeMs: 0, memoryKB: 0, outputs: null };
    }

    if (result.code !== 0 && result.stderr && result.stderr.includes("error:")) {
      return { type: "compile_error", output: result.stderr.trim(), timeMs: 0, memoryKB: 0, outputs: null };
    }

    // Parse outputs per case
    const rawOutput = result.stdout || "";
    const caseParts = rawOutput.split("---CASE_SEPARATOR---");

    const outputs = caseParts.map((part) => {
      const lines = part.trim().split("\n");
      // Check for exit code marker
      const lastLine = lines[lines.length - 1] || "";
      const exitMatch = lastLine.match(/^__EXIT_CODE__:(\d+)$/);
      let exitCode = 0;
      if (exitMatch) {
        exitCode = parseInt(exitMatch[1], 10);
        lines.pop();
      }

      const output = lines.join("\n").trim();

      if (exitCode !== 0) {
        return `__runtime_error__:${output || `exit ${exitCode}`}`;
      }
      return output;
    });

    return { type: "success", output: outputs.join("\n"), timeMs: result.timeMs, memoryKB: 0, outputs };
  } finally {
    fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/* ============================================================================
 * Public API
 * ==========================================================================*/

/**
 * Execute the student's code against a single set of arguments.
 * Returns { type, output, timeMs, memoryKB } where type is one of:
 * "success" | "compile_error" | "runtime_error" | "time_limit" | "memory_limit"
 */
export async function executeSingle(languageId, code, args, { timeLimitMs = DEFAULT_TIMEOUT_MS, memoryLimitMb = 256, stdin = null } = {}) {
  const langId = normalizeLanguage(languageId);
  if (!langId) throw new Error(`Unsupported language: ${languageId}. Supported: ${getSupportedLanguages().join(", ")}`);

  const effectiveStdin = isStdinLanguage(langId) ? String(stdin ?? "") : undefined;
  const effectiveArgs = isStdinLanguage(langId) ? [] : Array.isArray(args) ? args : [];
  const harness = harnessForRun(langId, effectiveArgs, code);
  const files = buildSources(langId, code, harness);

  return executeViaDocker(langId, files, { timeLimitMs, stdin: effectiveStdin });
}

/**
 * Execute the student's code against multiple argument sets (batch submit mode).
 * Compiles once, runs once; output is one line per test case.
 * Returns { type, outputs: string[] | null, output, timeMs, memoryKB }.
 */
export async function executeBatch(languageId, code, cases, { timeLimitMs = DEFAULT_TIMEOUT_MS, memoryLimitMb = 256 } = {}) {
  const langId = normalizeLanguage(languageId);
  if (!langId) throw new Error(`Unsupported language: ${languageId}. Supported: ${getSupportedLanguages().join(", ")}`);

  const caseList = Array.isArray(cases) ? cases : [];
  const timeLimitMsNum = Math.max(300, Number(timeLimitMs) || DEFAULT_TIMEOUT_MS);

  if (isStdinLanguage(langId)) {
    return executeBatchStdin(langId, code, caseList, timeLimitMsNum);
  }

  const harness = harnessForBatch(langId, caseList, code);
  const files = buildSources(langId, code, harness);
  // total budget scales with the number of cases
  const budget = Math.min(60000, timeLimitMsNum * Math.max(1, caseList.length));
  const result = await executeViaDocker(langId, files, { timeLimitMs: budget, stdin: undefined });

  if (result.type === "success") {
    let lines = String(result.output || "")
      .split("\n")
      .map((line) => line.replace(/\r$/, ""));
    // harnesses print exactly one line per case plus a trailing newline
    if (lines.length === caseList.length + 1 && lines[lines.length - 1] === "") lines.pop();
    return { ...result, outputs: lines };
  }
  return { ...result, outputs: null };
}

export function isExecutionConfigured() {
  ensureDockerChecked();
  return dockerState.available;
}

export function getExecutionProviderInfo() {
  ensureDockerChecked();
  return {
    provider: "docker",
    docker: dockerState.available,
    images: { ...dockerState.images },
    // Re-check images in case they were built after startup
    refreshImages() {
      for (const [langId, config] of Object.entries(LANGUAGE_CONFIG)) {
        dockerState.images[langId] = checkImageSync(config.image);
      }
      return { ...dockerState.images };
    },
  };
}
