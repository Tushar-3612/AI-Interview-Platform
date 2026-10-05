import { spawn, execFileSync } from "child_process";
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";

/* ============================================================================
 * Docker-based multi-language code execution service
 * ---------------------------------------------------------------------------
 * Supported languages: Java, C++, C, Python, JavaScript
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
// Extra wall-clock head-room added ON TOP OF the student time limit for the
// in-container EXECUTION step only (covers JVM/process start-up). Compilation
// is covered separately by COMPILE_TIMEOUT_MS so a slow javac can never be
// mis-reported as a student time-limit violation.
const RUN_EXEC_BUFFER_MS = 2000;
// Absolute ceiling for any single docker run, independent of the requested
// time limit, so a misconfigured/huge limit can never hang the suite.
const MAX_TIMEOUT_MS = 60000;
const MEMORY_LIMIT = process.env.CODE_MEMORY_LIMIT || "256m";
const CPU_LIMIT = process.env.CODE_CPU_LIMIT || "0.5";
const PIDS_LIMIT = process.env.CODE_PIDS_LIMIT || "64";
const MAX_CONCURRENCY = Math.min(32, Math.max(1, parseInt(process.env.CODE_EXECUTION_MAX_CONCURRENCY, 10) || 16));
const MAX_QUEUE_SIZE = Math.max(10, parseInt(process.env.CODE_EXECUTION_MAX_QUEUE, 10) || 5000);

const LANG_ALIASES = {
  python: "python", py: "python", python3: "python",
  java: "java",
  c: "c",
  cpp: "cpp", "c++": "cpp", cplusplus: "cpp",
  javascript: "javascript", js: "javascript", node: "javascript",
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
  javascript: {
    id: "javascript",
    label: "JavaScript",
    image: "code-runner-javascript:latest",
    sourceFile: "solution.js",
    wrapperFile: null,
    compileCommand: null,
    runCommand: ["node", "solution.js"],
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
 * Concurrency Semaphore & Queue Control (Bounded Container Spawning)
 * ==========================================================================*/

class ExecutionSemaphore {
  constructor(maxConcurrency, maxQueue) {
    this.maxConcurrency = maxConcurrency;
    this.maxQueue = maxQueue;
    this.running = 0;
    this.queue = [];
  }

  async acquire() {
    if (this.running < this.maxConcurrency) {
      this.running++;
      return () => this.release();
    }
    if (this.queue.length >= this.maxQueue) {
      const err = new Error("Execution queue is full. Server is busy executing other code. Please try again shortly.");
      err.code = "EXECUTION_QUEUE_FULL";
      err.isBusy = true;
      throw err;
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject });
    });
  }

  release() {
    this.running--;
    if (this.queue.length > 0 && this.running < this.maxConcurrency) {
      this.running++;
      const next = this.queue.shift();
      next.resolve(() => this.release());
    }
  }

  getStats() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrency: this.maxConcurrency,
      maxQueue: this.maxQueue,
    };
  }
}

export const globalExecutionSemaphore = new ExecutionSemaphore(MAX_CONCURRENCY, MAX_QUEUE_SIZE);

/* ============================================================================
 * Docker environment detection (lazy, cached with short TTL)
 * ==========================================================================*/

const dockerState = {
  lastChecked: 0,
  available: false,
  images: { java: false, cpp: false, c: false, python: false, javascript: false },
};

function checkDockerSync() {
  try {
    execFileSync("docker", ["version", "--format", "{{.Server.Version}}"], { timeout: 10000, stdio: "pipe", windowsHide: true });
    return true;
  } catch {
    try {
      execFileSync("docker", ["info"], { timeout: 10000, stdio: "pipe", windowsHide: true });
      return true;
    } catch {
      return false;
    }
  }
}

function checkImageSync(imageName) {
  try {
    const out = execFileSync("docker", ["images", "-q", imageName], {
      timeout: 10000, stdio: "pipe", windowsHide: true, encoding: "utf8",
    });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

export function checkDockerHealth(force = false) {
  const now = Date.now();
  // 5 minute TTL for cached health when already available
  const ttl = dockerState.available ? 300000 : 10000;
  if (!force && dockerState.lastChecked > 0 && (now - dockerState.lastChecked < ttl)) {
    return {
      available: dockerState.available,
      images: { ...dockerState.images },
      lastChecked: dockerState.lastChecked,
    };
  }

  const isAvailable = checkDockerSync();
  dockerState.lastChecked = now;
  // If previously available, don't flip to false due to transient load unless force check
  if (isAvailable || !dockerState.available || force) {
    dockerState.available = isAvailable;
  }

  if (dockerState.available) {
    try {
      const allImages = execFileSync("docker", ["images", "--format", "{{.Repository}}:{{.Tag}} {{.Repository}}"], {
        timeout: 10000, stdio: "pipe", windowsHide: true, encoding: "utf8",
      });
      for (const [langId, config] of Object.entries(LANGUAGE_CONFIG)) {
        const target = config.image.replace(":latest", "");
        dockerState.images[langId] = allImages.includes(config.image) || allImages.includes(target);
      }
    } catch {
      for (const [langId, config] of Object.entries(LANGUAGE_CONFIG)) {
        dockerState.images[langId] = checkImageSync(config.image);
      }
    }
  } else {
    for (const langId of Object.keys(LANGUAGE_CONFIG)) {
      dockerState.images[langId] = false;
    }
  }

  return {
    available: dockerState.available,
    images: { ...dockerState.images },
    lastChecked: dockerState.lastChecked,
  };
}

function ensureDockerChecked() {
  checkDockerHealth(false);
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
  if (value === null || value === undefined) {
    if (type && type.endsWith("[]")) {
      const base = type.slice(0, -2);
      if (base === "int") return "new int[]{}";
      if (base === "long") return "new long[]{}";
      if (base === "double") return "new double[]{}";
      if (base === "float") return "new float[]{}";
      if (base === "boolean") return "new boolean[]{}";
      if (base === "String") return "new String[]{}";
      if (base === "char") return "new char[]{}";
      return `new ${base}[]{}`;
    }
    return "null";
  }

  const t = String(type || "").trim();

  // Primitive scalar types
  if (t === "int") {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? String(n) : "0";
  }
  if (t === "long") {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? `${n}L` : "0L";
  }
  if (t === "double") {
    const n = parseFloat(value);
    return Number.isFinite(n) ? (Number.isInteger(n) ? `${n}.0` : String(n)) : "0.0";
  }
  if (t === "float") {
    const n = parseFloat(value);
    return Number.isFinite(n) ? `${n}f` : "0.0f";
  }
  if (t === "boolean") {
    return String(Boolean(value && value !== "false" && value !== "0"));
  }
  if (t === "char") {
    const s = String(value);
    const code = s.length > 0 ? s.charCodeAt(0) : 32;
    if (code === 39) return "'\\''";
    if (code === 92) return "'\\\\'";
    if (code === 10) return "'\\n'";
    if (code === 13) return "'\\r'";
    if (code === 9) return "'\\t'";
    if (code >= 32 && code < 127) return `'${s.charAt(0)}'`;
    return `'\\u${code.toString(16).padStart(4, "0")}'`;
  }
  if (t === "String") {
    return escapeJavaStyleString(value);
  }

  // 1D Arrays
  if (t === "int[]") {
    const arr = Array.isArray(value) ? value : [value];
    return `new int[]{${arr.map((x) => (Number.isFinite(Number(x)) ? parseInt(x, 10) : 0)).join(", ")}}`;
  }
  if (t === "long[]") {
    const arr = Array.isArray(value) ? value : [value];
    return `new long[]{${arr.map((x) => (Number.isFinite(Number(x)) ? `${parseInt(x, 10)}L` : "0L")).join(", ")}}`;
  }
  if (t === "double[]") {
    const arr = Array.isArray(value) ? value : [value];
    return `new double[]{${arr.map((x) => (Number.isFinite(Number(x)) ? parseFloat(x) : 0.0)).join(", ")}}`;
  }
  if (t === "float[]") {
    const arr = Array.isArray(value) ? value : [value];
    return `new float[]{${arr.map((x) => (Number.isFinite(Number(x)) ? `${parseFloat(x)}f` : "0.0f")).join(", ")}}`;
  }
  if (t === "boolean[]") {
    const arr = Array.isArray(value) ? value : [value];
    return `new boolean[]{${arr.map((x) => String(Boolean(x && x !== "false" && x !== "0"))).join(", ")}}`;
  }
  if (t === "String[]") {
    const arr = Array.isArray(value) ? value : [value];
    return `new String[]{${arr.map((x) => escapeJavaStyleString(x)).join(", ")}}`;
  }
  if (t === "char[]") {
    const arr = Array.isArray(value) ? value : (typeof value === "string" ? value.split("") : [value]);
    return `new char[]{${arr.map((x) => javaTypedLiteral("char", x)).join(", ")}}`;
  }

  // 2D Arrays (e.g. int[][])
  if (t === "int[][]") {
    const arr = Array.isArray(value) ? value : [];
    return `new int[][]{${arr.map((row) => javaTypedLiteral("int[]", row)).join(", ")}}`;
  }
  if (t === "char[][]") {
    const arr = Array.isArray(value) ? value : [];
    return `new char[][]{${arr.map((row) => javaTypedLiteral("char[]", row)).join(", ")}}`;
  }
  if (t === "String[][]") {
    const arr = Array.isArray(value) ? value : [];
    return `new String[][]{${arr.map((row) => javaTypedLiteral("String[]", row)).join(", ")}}`;
  }

  return javaValueLiteral(value);
}

/* ============================================================================
 * Java method signature parser and typed invocation generator
 * ==========================================================================*/

function parseJavaParamTypes(code, methodName = "solve") {
  const src = String(code || "");
  const safeName = (methodName || "solve").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:public\\s+|static\\s+)*\\w[\\w<>[\\],\\s]*\\b${safeName}\\s*\\(([^)]*)\\)`);
  const m = src.match(re);
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

/* ============================================================================
 * Isolation, parallelism and output comparison helpers
 * ==========================================================================*/

const EXECUTION_BASE_DIR = path.join(os.tmpdir(), "coding-execution");
const MAX_CONCURRENT_TESTS = Math.max(1, parseInt(process.env.MAX_CONCURRENT_TESTS, 10) || 8);

/**
 * Detect the public class name declared by the student.
 * Java requires a public class to live in a file named <ClassName>.java,
 * so we name the student source file after whatever they declared. Falls
 * back to "Solution" so existing submissions keep working.
 */
function detectJavaClassName(code) {
  if (!code) return "Solution";
  // public class Foo { ... }
  const publicMatch = code.match(/public\s+class\s+([A-Za-z_][A-Za-z0-9_]*)/);
  if (publicMatch) return publicMatch[1];
  // any class Foo { ... }
  const anyMatch = code.match(/\bclass\s+([A-Za-z_][A-Za-z0-9_]*)/);
  if (anyMatch) return anyMatch[1];
  return "Solution";
}

function detectJavaMethodName(code, fallback = "solution") {
  if (!code) return fallback;
  const re = /(?:public\s+|protected\s+|static\s+)*\w[\w<>[\]]*\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{/g;
  let match;
  while ((match = re.exec(code)) !== null) {
    const name = match[1];
    if (name !== "main" && name !== "if" && name !== "for" && name !== "while" && name !== "switch" && name !== "catch" && name !== "Solution" && name !== "Main") {
      return name;
    }
  }
  return fallback;
}

function detectPythonFunction(code, fallback = "solution") {
  if (!code) return fallback;
  const m = code.match(/def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
  return m ? m[1] : fallback;
}

function detectJavaScriptFunction(code, fallback = "solution") {
  if (!code) return fallback;
  const m = code.match(/(?:function\s+|const\s+|let\s+|var\s+)([A-Za-z_$][\w$]*)\s*=?\s*(?:async\s*)?\(/);
  return m ? m[1] : fallback;
}

/** Per-execution / per-test-case isolated workspace directory. */
function makeWorkspace(executionId, testCaseId) {
  const exec = executionId || crypto.randomBytes(6).toString("hex");
  const tc = testCaseId != null ? String(testCaseId) : crypto.randomBytes(4).toString("hex");
  return path.join(EXECUTION_BASE_DIR, exec, tc);
}

/** Run async tasks with a bounded concurrency, preserving input order. */
async function runPool(items, worker, limit = MAX_CONCURRENT_TESTS) {
  const concurrency = Math.min(Math.max(1, limit), items.length || 1);
  const results = new Array(items.length);
  let cursor = 0;

  async function runNext() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = await worker(items[index], index);
      } catch (err) {
        results[index] = { error: err };
      }
    }
  }

  const runners = Array.from({ length: concurrency }, () => runNext());
  await Promise.all(runners);
  return results;
}

/** Normalize a single value/string for loose comparison. */
function normalizeValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, (k, v) => (v === undefined ? null : v))
        .replace(/":\s*/g, ":")
        .replace(/,\s*/g, ",");
    } catch {
      return String(value);
    }
  }
  return String(value).replace(/\s+/g, " ").trim();
}

const COMPARISON_MODES = {
  EXACT: "exact",
  TOKEN: "token",
  NUMERIC: "numeric",
  CASE_INSENSITIVE: "case_insensitive",
  CUSTOM: "custom",
};

/**
 * Compare actual vs expected outputs using a configurable mode.
 * - exact:            strict string equality after whitespace trim
 * - token (default):  whitespace-split token equality + JSON value fallback
 * - numeric:          parse as numbers, compare with 1e-6 tolerance
 * - case_insensitive: lowercase trimmed equality
 * - custom:           exact (consumers may supply their own comparer)
 * Returns true when outputs are considered equal.
 */
function compareOutputs(actual, expected, mode = COMPARISON_MODES.TOKEN) {
  const a = normalizeValue(actual);
  const e = normalizeValue(expected);

  switch (mode) {
    case COMPARISON_MODES.EXACT:
      return a === e;
    case COMPARISON_MODES.CASE_INSENSITIVE:
      return a.toLowerCase() === e.toLowerCase();
    case COMPARISON_MODES.NUMERIC: {
      const na = parseFloat(a);
      const ne = parseFloat(e);
      if (Number.isNaN(na) || Number.isNaN(ne)) return a === e;
      return Math.abs(na - ne) < 1e-6;
    }
    case COMPARISON_MODES.CUSTOM:
    case COMPARISON_MODES.TOKEN:
    default: {
      const at = a.split(/\s+/).filter(Boolean);
      const et = e.split(/\s+/).filter(Boolean);
      if (at.length !== et.length) {
        // fall back to trimmed JSON compare (arrays/objects w/ spacing diffs or string quote diffs)
        try {
          if (JSON.parse(e) === a || JSON.parse(a) === e) return true;
        } catch {}
        try {
          return JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(e));
        } catch {
          return a === e;
        }
      }
      return at.every((tok, i) => {
        if (tok === et[i]) return true;
        try {
          if (JSON.parse(et[i]) === tok) return true;
        } catch {}
        try {
          if (JSON.parse(tok) === et[i]) return true;
        } catch {}
        return false;
      });
    }
  }
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ============================================================================
 * Raw test-input parsing for Java
 * ---------------------------------------------------------------------------
 * Some problems supply the test case as a raw, whitespace/comma separated
 * string (e.g. "6 10 5 8 10 3 7" where 6 is N and the rest are elements)
 * rather than a JSON-encoded value. The Runner must tokenise that string and
 * build the exact typed arguments the student's solve() expects — it must
 * NEVER pass the raw string straight through to a typed parameter.
 *
 * The mapping is driven entirely by the parsed method signature, so it is
 * generic across int/long/double/float/boolean/String and their array forms,
 * as well as multiple parameters.
 * ==========================================================================*/

function javaArrayBaseType(type) {
  return type.endsWith("[]") ? type.slice(0, -2) : type;
}

function javaScalarType(type) {
  switch (type) {
    case "int": return "int";
    case "long": return "long";
    case "double": return "double";
    case "float": return "float";
    case "boolean": return "boolean";
    case "String": return "String";
    case "char": return "char";
    default: return "Object";
  }
}

/** Java expression that parses a single token into the given scalar type. */
function javaScalarParseExpr(type, tokenExpr) {
  switch (type) {
    case "int": return `Integer.parseInt(${tokenExpr})`;
    case "long": return `Long.parseLong(${tokenExpr})`;
    case "double": return `Double.parseDouble(${tokenExpr})`;
    case "float": return `Float.parseFloat(${tokenExpr})`;
    case "boolean": return `Boolean.parseBoolean(${tokenExpr})`;
    case "String": return tokenExpr;
    case "char": return `(${tokenExpr}).charAt(0)`;
    default: return tokenExpr;
  }
}

/**
 * Decide whether `args` is a single raw input string that must be tokenised by
 * the Runner. Returns the raw string, or null when the literal-arg path should
 * be used instead. A lone String parameter receives its string verbatim (it is
 * the value, not raw, tokenisable input).
 */
export function parseJavaArgsFromInput(rawInput, code, methodName) {
  const str = String(rawInput || "").trim();
  if (!str) return [];

  const paramTypes = code ? parseJavaParamTypes(code, methodName) : null;
  if (!paramTypes || paramTypes.length === 0) {
    return [str];
  }

  // 1. Try parsing JSON directly
  try {
    const parsed = JSON.parse(str);
    if (paramTypes.length === 1) {
      if (paramTypes[0].endsWith("[]")) {
        // e.g. int[] expecting [9, -2, 1, ...]
        if (Array.isArray(parsed)) return [parsed];
        return [[parsed]];
      }
      return [parsed];
    }
    if (Array.isArray(parsed) && parsed.length === paramTypes.length) {
      return parsed;
    }
  } catch {}

  // 2. Multiline inputs (each line corresponds to a parameter)
  const lines = str.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === paramTypes.length && paramTypes.length > 1) {
    return paramTypes.map((t, idx) => {
      const line = lines[idx];
      try {
        const parsed = JSON.parse(line);
        return parsed;
      } catch {
        if (t.endsWith("[]")) {
          let toks = line.replace(/[\[\]{},]/g, " ").trim().split(/\s+/).filter(Boolean);
          if (toks.length >= 2) {
            const maybeN = parseInt(toks[0], 10);
            if (Number.isFinite(maybeN) && maybeN === toks.length - 1) {
              toks = toks.slice(1);
            }
          }
          const base = t.slice(0, -2);
          if (base === "int" || base === "long") return toks.map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n));
          if (base === "double" || base === "float") return toks.map((x) => parseFloat(x)).filter((n) => Number.isFinite(n));
          if (base === "boolean") return toks.map((x) => x.toLowerCase() === "true");
          return toks;
        }
        return line;
      }
    });
  }

  // 3. Single parameter expecting array (e.g. "9 -2 1 -3 4 -1 2 1 -5 4" or "[9, -2, 1, -3, ...]" or "9\n-2 1 -3 4 -1 2 1 -5 4")
  if (paramTypes.length === 1 && paramTypes[0].endsWith("[]")) {
    const clean = str.replace(/[\[\]{},]/g, " ").trim();
    let toks = clean.split(/\s+/).filter(Boolean);
    if (toks.length >= 2) {
      const maybeN = parseInt(toks[0], 10);
      if (Number.isFinite(maybeN) && maybeN === toks.length - 1) {
        toks = toks.slice(1);
      }
    }
    const base = paramTypes[0].slice(0, -2);
    if (base === "int" || base === "long") {
      return [toks.map((t) => parseInt(t, 10)).filter((n) => Number.isFinite(n))];
    }
    if (base === "double" || base === "float") {
      return [toks.map((t) => parseFloat(t)).filter((n) => Number.isFinite(n))];
    }
    if (base === "boolean") {
      return [toks.map((t) => t.toLowerCase() === "true")];
    }
    return [toks];
  }

  // 4. Multiple scalar parameters separated by whitespace (e.g. "10 5")
  const toks = str.replace(/[\[\]{},]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (toks.length === paramTypes.length) {
    return paramTypes.map((t, idx) => {
      const tok = toks[idx];
      if (t === "int" || t === "long") return parseInt(tok, 10);
      if (t === "double" || t === "float") return parseFloat(tok);
      if (t === "boolean") return tok.toLowerCase() === "true";
      return tok;
    });
  }

  // Fallback: single raw string argument
  return [str];
}

function detectRawJavaInput(args, paramTypes) {
  return null;
}

/**
 * Build a Runner that tokenises the raw input string and constructs the typed
 * parameters declared by the student's solve() method.
 *
 * Conventions (derived from the signature, no hard-coding):
 *  - Tokens are whitespace/comma/bracket separated.
 *  - A scalar parameter consumes exactly one token.
 *  - An array parameter (usually the last, or the only parameter) consumes the
 *    remaining tokens. When the array is the ONLY parameter, the leading token
 *    is treated as a count N (and dropped) ONLY when it equals the number of
 *    remaining tokens — the standard "N elements" format. This avoids blindly
 *    assuming every first number is N.
 */
function buildJavaRawRunner(className, methodName, rawInput, paramTypes, opts) {
  const runnerClass = opts.runnerClassName || "Runner";
  const rawLiteral = escapeJavaStyleString(rawInput);

  const lines = [];
  lines.push(`    String __raw = ${rawLiteral};`);
  lines.push(`    String __clean = __raw.replace('[',' ').replace(']',' ').replace('{',' ').replace('}',' ').replace(',',' ').trim();`);
  lines.push(`    String[] __toks = __clean.split("\\\\s+");`);
  lines.push(`    int __i = 0;`);

  const varNames = [];
  paramTypes.forEach((type, k) => {
    const vname = `__p${k}`;
    varNames.push(vname);

    if (type.endsWith("[]")) {
      const base = javaArrayBaseType(type);
      const elem = javaScalarType(base);
      const isOnly = paramTypes.length === 1;
      lines.push(`    int __start${k} = ${isOnly ? "0" : "__i"};`);
      lines.push(`    int __n${k} = __toks.length;`);
      if (isOnly) {
        // Drop a leading count N only when it matches the remaining element count.
        lines.push(`    if (__n${k} >= 2) {`);
        lines.push(`      try { int __maybeN${k} = Integer.parseInt(__toks[0]); if (__maybeN${k} == __n${k} - 1) __start${k} = 1; } catch (Exception __e${k}) {}`);
        lines.push(`    }`);
      }
      lines.push(`    ${elem}[] ${vname} = new ${elem}[__n${k} - __start${k}];`);
      lines.push(`    for (int __j = __start${k}; __j < __n${k}; __j++) ${vname}[__j - __start${k}] = ${javaScalarParseExpr(base, `__toks[__j]`)};`);
      if (!isOnly) lines.push(`    __i = __n${k};`);
    } else {
      lines.push(`    ${javaScalarType(type)} ${vname} = ${javaScalarParseExpr(type, `__toks[__i++]`)};`);
    }
  });

  const invocation = varNames.join(", ");
  const mainBlock = `public class ${runnerClass} {
    public static void main(String[] args) {
${lines.join("\n")}
        Object __result = (new ${className}()).${methodName}(${invocation});
        System.out.println(${runnerClass}.toJson(__result));
    }`;
  return mainBlock + buildJavaToJsonSuffix();
}

/**
 * Build the runner harness for a SINGLE test case.
 * The harness calls the exact method/class detected (or supplied via
 * executionConfig), preserving the student's source unmodified.
 * The runner class name is configurable so it never collides with the
 * student's own classes (eliminates "duplicate class: Main" / wrong-file
 * public-class compile errors).
 */
function harnessForRun(langId, args, code, opts = {}) {
  const className = opts.className || "Solution";
  const methodName = opts.methodName || "solve";

  switch (langId) {
    case "python": {
      if (!Array.isArray(args)) return "";
      if (code && (code.includes("__safe_eval") || code.includes("__cases") || code.includes("__main__") || code.includes("sys.stdin"))) return "";
      const fn = opts.functionName || "solution";
      return `\nif "${fn}" in globals() and callable(globals()["${fn}"]):\n    import json as __json\n    __result = ${fn}(*${pyLiteral(args)})\n    print(__json.dumps(__result, default=str))\n`;
    }
    case "javascript": {
      if (!Array.isArray(args)) return "";
      if (code && (code.includes("readFileSync") || code.includes("__raw") || code.includes("__cases") || code.includes("process.stdin"))) return "";
      const fn = opts.functionName || "solution";
      const rawArgs = JSON.stringify(args || []);
      return `\n(async () => {\n  if (typeof ${fn} === 'function' || (typeof Solution !== 'undefined' && typeof (new Solution()).${methodName} === 'function')) {\n    let __result = typeof ${fn} === 'function' ? ${fn}(...${rawArgs}) : (new Solution()).${methodName}(...${rawArgs});\n    if (__result && typeof __result.then === 'function') __result = await __result;\n    console.log(typeof __result === 'object' && __result !== null ? JSON.stringify(__result) : __result);\n  }\n})();\n`;
    }
    case "java": {
      const paramTypes = code ? parseJavaParamTypes(code, methodName) : null;

      let invocation = "";

      if (paramTypes && paramTypes.length === 0) {
        // Zero-parameter function — nothing to pass.
        invocation = "";
      } else if (paramTypes && paramTypes.length === 1) {
        let singleArg;
        if (Array.isArray(args)) {
          if (args.length === 1 && paramTypes[0].endsWith("[]") && !Array.isArray(args[0])) {
            singleArg = args;
          } else if (args.length >= 1) {
            singleArg = args[0];
          } else {
            singleArg = args;
          }
        } else {
          singleArg = args;
        }
        invocation = javaTypedLiteral(paramTypes[0], singleArg);
      } else if (paramTypes && paramTypes.length > 1) {
        const argList = Array.isArray(args) ? args : [];
        invocation = paramTypes.map((t, i) => javaTypedLiteral(t, argList[i])).join(", ");
      } else {
        const argList = Array.isArray(args) ? args : [args];
        invocation = argList.map((a) => javaValueLiteral(a)).join(", ");
      }

      const runnerClass = opts.runnerClassName || "Runner";
      const mainBlock = `public class ${runnerClass} {
    public static void main(String[] args) {
        Object __result = (new ${className}()).${methodName}(${invocation});
        System.out.println(${runnerClass}.toJson(__result));
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
      const fn = detectPythonFunction(code, "solution");
      const list = cases.map((c) => pyLiteral(c)).join(", ");
      return `\nimport json as __json
__cases = [${list}]
for __c in __cases:
    print(__json.dumps(${fn}(*__c), default=str))
`;
    }
    case "javascript": {
      const fn = detectJavaScriptFunction(code, "solution");
      const list = JSON.stringify(cases || []);
      return `\n(async () => {\n  const __cases = ${list};\n  for (const __c of __cases) {\n    let __result = typeof ${fn} === 'function' ? ${fn}(...__c) : (typeof Solution !== 'undefined' && typeof (new Solution()).${fn} === 'function' ? (new Solution()).${fn}(...__c) : (typeof Solution !== 'undefined' && typeof (new Solution()).solve === 'function' ? (new Solution()).solve(...__c) : (typeof Solution !== 'undefined' && typeof (new Solution()).solution === 'function' ? (new Solution()).solution(...__c) : undefined)));\n    if (__result && typeof __result.then === 'function') __result = await __result;\n    console.log(typeof __result === 'object' && __result !== null ? JSON.stringify(__result) : __result);\n  }\n})();\n`;
    }
    case "java": {
      const caseLiterals = cases.map((c) => `new Object[]{${c.map(javaValueLiteral).join(", ")}}`).join(",\n        ");
      const userClass = detectJavaClassName(code);
      const userMethod = detectJavaMethodName(code, "solution");
      const paramTypes = code ? parseJavaParamTypes(code, userMethod) : null;
      const invocation = javaInvocationForParams(paramTypes, "__c");
      const run = `public class Runner {
    public static void main(String[] args) {
        ${userClass} __solver = new ${userClass}();
        Object[][] __cases = new Object[][]{
        ${caseLiterals}
        };
        for (Object[] __c : __cases) {
            System.out.println(Runner.toJson(__solver.${userMethod}(${invocation})));
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

function buildSources(langId, code, harness, opts = {}) {
  const config = LANGUAGE_CONFIG[langId];
  switch (langId) {
    case "python":
    case "javascript": {
      const userSource = String(code);
      const harnessCode = harness || "";
      return [{ name: config.sourceFile, content: userSource + harnessCode }];
    }
    case "java": {
      // User file is named after the detected public class so a public class
      // declaration no longer triggers "should be declared in Main.java".
      const userFile = opts.userFile || config.sourceFile;
      const runnerFile = opts.runnerFile || config.wrapperFile;
      if (!harness) {
        return [{ name: userFile, content: String(code) }];
      }
      return [
        { name: userFile, content: String(code) },
        { name: runnerFile, content: harness },
      ];
    }
    case "c":
      return [{ name: "main.c", content: String(code) }];
    case "cpp":
      return [{ name: "main.cpp", content: String(code) }];
    default:
      return [{ name: config?.sourceFile || "solution.txt", content: String(code) }];
  }
}


/* ============================================================================
 * Docker process runner
 * ---------------------------------------------------------------------------
 * Spawns `docker run` with full isolation flags under global semaphore control.
 * Uses spawn() with argument arrays — never shell interpolation.
 * ==========================================================================*/

async function runDockerContainer(image, command, { timeoutMs = 10000, memoryLimitMb, cwd, stdin, workspaceDir } = {}) {
  let release;
  try {
    release = await globalExecutionSemaphore.acquire();
  } catch (semErr) {
    return {
      stdout: "",
      stderr: semErr.message || "Execution queue is full. Server is busy.",
      code: 1,
      timedOut: false,
      timeMs: 0,
      isBusy: true,
      execId: "busy",
    };
  }

  try {
    return await new Promise((resolve) => {
      const execId = crypto.randomBytes(4).toString("hex");
      const containerName = `coderun-${execId}`;
      const effectiveMemory = memoryLimitMb ? `${Math.max(32, Math.min(1024, parseInt(memoryLimitMb, 10)))}m` : MEMORY_LIMIT;

      const dockerArgs = [
        "run",
        "--rm",                              // auto-cleanup container
        "--name", containerName,
        "--network", "none",                 // no network access
        "--memory", effectiveMemory,         // memory limit
        "--memory-swap", effectiveMemory,    // no swap (same as memory)
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
      let settled = false;

      const child = spawn("docker", dockerArgs, {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Guarantee the Promise resolves exactly once
      const settle = (payload) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(payload);
      };

      // Hard timeout — kill container if exceeded
      const timer = setTimeout(() => {
        killed = true;
        try {
          spawn("docker", ["kill", containerName], { windowsHide: true, stdio: "ignore" });
        } catch { /* container may already be gone */ }
        try { child.kill("SIGKILL"); } catch { /* already gone */ }
        settle({
          stdout: stdout.trim(),
          stderr: (stderr || "Time limit exceeded").trim(),
          code: 137,
          timedOut: true,
          timeMs: Date.now() - started,
          execId,
        });
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
        settle({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          code,
          timedOut: killed,
          timeMs: Date.now() - started,
          execId,
        });
      });

      child.on("error", (err) => {
        settle({
          stdout: "",
          stderr: `Docker execution failed: ${err.message}`,
          code: 1,
          timedOut: false,
          timeMs: Date.now() - started,
          execId,
        });
      });
    });
  } finally {
    if (release) release();
  }
}

/* ============================================================================
 * Core Docker execution
 * ==========================================================================*/

async function executeViaDocker(
  langId,
  files,
  {
    timeLimitMs,
    memoryLimitMb,
    stdin,
    compileCommand: customCompileCommand,
    runCommand: customRunCommand,
    workspaceDir,
    executionId,
    testCaseId,
  } = {}
) {
  ensureDockerChecked();

  const config = LANGUAGE_CONFIG[langId];
  if (!config) {
    return { type: "execution_error", output: `No configuration for language: ${langId}`, timeMs: 0, memoryKB: 0 };
  }

  // Honour caller overrides (used for Java dynamic class/file naming).
  const compileCommand = customCompileCommand || config.compileCommand;
  const runCommand = customRunCommand || config.runCommand;

  if (!dockerState.available) {
    return {
      type: "execution_error",
      output: "Docker execution environment is not available. Please ensure Docker Desktop/Engine is running.",
      timeMs: 0,
      memoryKB: 0,
      isUnavailable: true,
    };
  }

  if (!dockerState.images[langId]) {
    // Re-check in case image was built after startup
    dockerState.images[langId] = checkImageSync(config.image);
    if (!dockerState.images[langId]) {
      return {
        type: "execution_error",
        output: `Docker image '${config.image}' not found for ${config.label}. Run: docker compose build`,
        timeMs: 0,
        memoryKB: 0,
        isUnavailable: true,
      };
    }
  }

  // Use an isolated workspace when provided (per-case isolation); otherwise
  // create a throwaway temp directory.
  const providedDir = workspaceDir || (executionId ? makeWorkspace(executionId, testCaseId) : null);
  let dir;
  try {
    dir = providedDir || (await fsp.mkdtemp(path.join(os.tmpdir(), "codeexec-")));
    // Ensure the (possibly nested, per-case) workspace exists before writing.
    await fsp.mkdir(dir, { recursive: true });
  } catch (err) {
    return { type: "execution_error", output: `Failed to create workspace: ${err.message}`, timeMs: 0, memoryKB: 0 };
  }

  try {
    // Write source files to temp directory
    for (const f of files) {
      await fsp.writeFile(path.join(dir, f.name), f.content, "utf8");
    }

    // Write stdin to file if provided
    if (stdin !== undefined && stdin !== null) {
      await fsp.writeFile(path.join(dir, "__input.txt"), String(stdin), "utf8");
    }

    // Convert Windows path to Docker-compatible path
    const dockerDir = dir.replace(/\\/g, "/");

    // Determine per-file names for Java so we can classify compile errors.
    let studentFile = config.sourceFile;
    let runnerFile = config.wrapperFile;
    if (langId === "java" && customCompileCommand && customCompileCommand.length >= 3) {
      studentFile = customCompileCommand[1];
      runnerFile = customCompileCommand[2];
    }

    // Compiled languages (Java/C/C++): compile AND run in a SINGLE isolated container
    if (compileCommand) {
      const runPart = stdin !== undefined && stdin !== null
        ? runCommand.join(" ") + " < /workspace/__input.txt"
        : runCommand.join(" ");
      const runSec = Math.max(1, Math.ceil((timeLimitMs + RUN_EXEC_BUFFER_MS) / 1000));
      const compileAndRun = `${compileCommand.join(" ")} && timeout -s KILL ${runSec} ${runPart}`;

      const result = await runDockerContainer(
        config.image,
        [compileAndRun],  // Wrapped in sh -c by runDockerContainer
        {
          timeoutMs: Math.min(MAX_TIMEOUT_MS, COMPILE_TIMEOUT_MS + timeLimitMs),
          memoryLimitMb,
          workspaceDir: dockerDir,
          stdin: undefined, // stdin is fed via file when needed
        }
      );

      console.log(`[${result.execId}] Run ${langId}: exit=${result.code} time=${result.timeMs}ms`);

      if (result.code !== 0) {
        const stderr = (result.stderr || "").trim();
        const stdout = (result.stdout || "").trim();

        if (langId === "java" && (stderr.includes("error:") || stderr.includes("cannot find symbol"))) {
          const isWrapperError = new RegExp(`${escapeRegExp(runnerFile)}:\\d+`).test(stderr) && !new RegExp(`${escapeRegExp(studentFile)}:\\d+`).test(stderr);
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

        // Execution exceeded time limit
        if (result.timedOut || result.code === 124 || result.code === 137) {
          return { type: "time_limit", output: `Time limit exceeded (${timeLimitMs}ms)`, timeMs: timeLimitMs, memoryKB: 0 };
        }

        return {
          type: "runtime_error",
          output: (stderr || stdout || `Process exited with code ${result.code}`).trim(),
          timeMs: result.timeMs,
          memoryKB: 0,
        };
      }

      return { type: "success", output: result.stdout.trim(), timeMs: result.timeMs, memoryKB: 0 };
    }

    // Interpreted languages (Python, JavaScript) — execute script
    const runPart = stdin !== undefined && stdin !== null
      ? config.runCommand.join(" ") + " < /workspace/__input.txt"
      : config.runCommand.join(" ");
    const runSec = Math.max(1, Math.ceil((timeLimitMs + RUN_EXEC_BUFFER_MS) / 1000));
    const runCmd = `timeout -s KILL ${runSec} ${runPart}`;

    const result = await runDockerContainer(
      config.image,
      [runCmd],
      {
        timeoutMs: Math.min(MAX_TIMEOUT_MS, COMPILE_TIMEOUT_MS + timeLimitMs),
        memoryLimitMb,
        workspaceDir: dockerDir,
        stdin: undefined,
      }
    );

    console.log(`[${result.execId}] Run ${langId}: exit=${result.code} time=${result.timeMs}ms`);

    if (result.timedOut || result.code === 124 || result.code === 137) {
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
    // Clean up temporary directory unless caller owns workspaceDir
    if (!workspaceDir) fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/* ============================================================================
 * Batch execution for compiled languages (C/C++) — compile once, run per case
 * ==========================================================================*/

export async function executeBatchStdin(langId, code, cases, timeLimitMs) {
  ensureDockerChecked();

  const config = LANGUAGE_CONFIG[langId];
  if (!config) {
    return { type: "execution_error", output: `No configuration for language: ${langId}`, timeMs: 0, memoryKB: 0, outputs: null };
  }

  if (!dockerState.available) {
    return {
      type: "execution_error",
      output: "Docker execution environment is not available. Please ensure Docker Desktop/Engine is running.",
      timeMs: 0,
      memoryKB: 0,
      outputs: null,
      isUnavailable: true,
    };
  }

  const files = buildSources(langId, code, "");
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "codeexec-"));

  try {
    for (const f of files) {
      await fsp.writeFile(path.join(dir, f.name), f.content, "utf8");
    }

    const dockerDir = dir.replace(/\\/g, "/");

    const caseInputs = cases.map((c, i) => ({
      name: `__input_${i}.txt`,
      content: String(c || ""),
    }));

    for (const ci of caseInputs) {
      await fsp.writeFile(path.join(dir, ci.name), ci.content, "utf8");
    }

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

    const rawOutput = result.stdout || "";
    const caseParts = rawOutput.split("---CASE_SEPARATOR---");

    const outputs = caseParts.map((part) => {
      const lines = part.trim().split("\n");
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
 * Execute the student's code against a SINGLE set of arguments in an isolated Docker container.
 * Returns { type, output, timeMs, memoryKB } where type is one of:
 * "success" | "compile_error" | "runtime_error" | "time_limit" | "memory_limit" | "execution_error"
 */
export async function executeSingle(
  languageId,
  code,
  args,
  {
    timeLimitMs = DEFAULT_TIMEOUT_MS,
    memoryLimitMb = 256,
    stdin = null,
    className,
    methodName,
    functionName,
    runnerClassName,
    executionId,
    testCaseId,
  } = {}
) {
  const langId = normalizeLanguage(languageId);
  if (!langId) {
    return {
      type: "execution_error",
      output: `Unsupported language: ${languageId}. Supported: ${getSupportedLanguages().join(", ")}`,
      timeMs: 0,
      memoryKB: 0,
    };
  }

  const health = checkDockerHealth(false);
  if (!health.available) {
    return {
      type: "execution_error",
      output: "Docker execution environment is not available. Please ensure Docker Desktop/Engine is running.",
      timeMs: 0,
      memoryKB: 0,
      isUnavailable: true,
    };
  }

  const config = LANGUAGE_CONFIG[langId];
  if (!health.images[langId]) {
    const hasImg = checkImageSync(config.image);
    health.images[langId] = hasImg;
    if (!hasImg) {
      return {
        type: "execution_error",
        output: `Docker image '${config.image}' not found for ${config.label}. Run: docker compose build`,
        timeMs: 0,
        memoryKB: 0,
        isUnavailable: true,
      };
    }
  }

  const effectiveStdin = isStdinLanguage(langId) || stdin !== null ? (stdin !== null ? String(stdin) : "") : undefined;
  let effectiveArgs = isStdinLanguage(langId) ? null : Array.isArray(args) ? args : null;

  const userClass = detectJavaClassName(code);
  const userFile = langId === "java" ? `${userClass}.java` : undefined;
  const runnerClass = runnerClassName || "Runner";
  const runnerFile = langId === "java" ? `${runnerClass}.java` : undefined;
  const detectedJavaMethod = langId === "java" ? detectJavaMethodName(code, "solution") : undefined;
  const effectiveMethodName = methodName || detectedJavaMethod || "solution";

  const hasJavaMain = langId === "java" && /\bpublic\s+static\s+void\s+main\s*\(\s*String\s*(\[\s*\]\s*\w+|\w+\s*\[\s*\]|\.\.\.\s*\w+)\s*\)/.test(code);

  if (langId === "java" && !hasJavaMain && (!effectiveArgs || effectiveArgs.length === 0) && effectiveStdin) {
    effectiveArgs = parseJavaArgsFromInput(effectiveStdin, code, effectiveMethodName);
  }

  const harness = hasJavaMain
    ? ""
    : harnessForRun(langId, effectiveArgs, code, {
        className: userClass,
        methodName: effectiveMethodName,
        functionName: functionName || (langId === "python" ? detectPythonFunction(code, "solution") : detectJavaScriptFunction(code, "solution")),
        runnerClassName: runnerClass,
      });

  const files = buildSources(langId, code, harness, {
    userFile,
    runnerFile,
  });

  const compileCommand = langId === "java"
    ? (hasJavaMain ? ["javac", userFile] : ["javac", userFile, runnerFile])
    : config.compileCommand;
  const runCommand = langId === "java"
    ? (hasJavaMain ? ["java", "-cp", ".", userClass] : ["java", "-cp", ".", runnerClass])
    : config.runCommand;

  return executeViaDocker(langId, files, {
    timeLimitMs: Math.max(300, Number(timeLimitMs) || DEFAULT_TIMEOUT_MS),
    memoryLimitMb,
    stdin: effectiveStdin,
    compileCommand,
    runCommand,
    executionId,
    testCaseId,
  });
}

/**
 * Execute the student's code against multiple test cases (batch submit mode).
 * Returns { type: "success" | "compile_error" | "time_limit" | "execution_error", outputs: string[], output: string, timeMs, memoryKB }
 */
export async function executeBatch(
  languageId,
  code,
  cases,
  {
    timeLimitMs = DEFAULT_TIMEOUT_MS,
    memoryLimitMb = 256,
    failFast = false,
    executionId,
    executionConfig = {},
  } = {}
) {
  const langId = normalizeLanguage(languageId);
  if (!langId) {
    return {
      type: "execution_error",
      output: `Unsupported language: ${languageId}. Supported: ${getSupportedLanguages().join(", ")}`,
      timeMs: 0,
      memoryKB: 0,
      outputs: null,
    };
  }

  const caseList = Array.isArray(cases) ? cases : [];
  const timeLimitMsNum = Math.max(300, Number(timeLimitMs) || DEFAULT_TIMEOUT_MS);
  const execId = executionId || crypto.randomBytes(8).toString("hex");

  const health = checkDockerHealth(false);
  if (!health.available) {
    return {
      type: "execution_error",
      output: "Docker execution environment is not available. Please ensure Docker Desktop/Engine is running.",
      timeMs: 0,
      memoryKB: 0,
      outputs: null,
      isUnavailable: true,
    };
  }

  const config = LANGUAGE_CONFIG[langId];
  if (!health.images[langId]) {
    const hasImg = checkImageSync(config.image);
    health.images[langId] = hasImg;
    if (!hasImg) {
      return {
        type: "execution_error",
        output: `Docker image '${config.image}' not found for ${config.label}. Run: docker compose build`,
        timeMs: 0,
        memoryKB: 0,
        outputs: null,
        isUnavailable: true,
      };
    }
  }

  if (isStdinLanguage(langId)) {
    return executeBatchStdin(langId, code, caseList, timeLimitMsNum);
  }

  const harness = harnessForBatch(langId, caseList, code);
  const files = buildSources(langId, code, harness);
  const budget = Math.min(60000, timeLimitMsNum * Math.max(1, caseList.length));
  const result = await executeViaDocker(langId, files, { timeLimitMs: budget, stdin: undefined });

  if (result.type === "success") {
    let lines = String(result.output || "")
      .split("\n")
      .map((line) => line.replace(/\r$/, ""));
    if (lines.length === caseList.length + 1 && lines[lines.length - 1] === "") lines.pop();
    return { ...result, outputs: lines };
  }
  return { ...result, outputs: null };
}

export function isExecutionConfigured() {
  return dockerState.available;
}

/**
 * Safely prepare and normalize stdin for code execution.
 * Handles multiline inputs, numbers, arrays, objects, strings, whitespace, and empty input.
 */
export function prepareExecutionInput(rawInput) {
  if (rawInput === null || rawInput === undefined) {
    return "";
  }

  let str = "";
  if (typeof rawInput === "string") {
    str = rawInput;
  } else if (typeof rawInput === "number" || typeof rawInput === "boolean") {
    str = String(rawInput);
  } else if (Array.isArray(rawInput)) {
    str = rawInput.map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item))).join(" ");
  } else if (typeof rawInput === "object") {
    if (rawInput.input !== undefined) {
      return prepareExecutionInput(rawInput.input);
    }
    if (rawInput.stdin !== undefined) {
      return prepareExecutionInput(rawInput.stdin);
    }
    if (rawInput.sampleInput !== undefined) {
      return prepareExecutionInput(rawInput.sampleInput);
    }
    str = JSON.stringify(rawInput);
  } else {
    str = String(rawInput);
  }

  // Normalize line endings to \n
  return str.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Safely extract expected output from a testcase object in any supported schema
 * (expected, expectedOutput, output, sampleOutput).
 */
export function getTestCaseExpectedOutput(tc) {
  if (!tc) return "";
  if (typeof tc === "string") return tc;
  return tc.expectedOutput ?? tc.expected ?? tc.output ?? tc.sampleOutput ?? "";
}

/**
 * Normalizes output for fair comparison
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
 * Wraps function-only code with an execution harness for Python and JavaScript stdin execution
 */
export function wrapFunctionHarness(sourceCode, language) {
  if (!sourceCode) return sourceCode;
  const lang = String(language).toLowerCase().trim();

  if (lang === "python" || lang === "py" || lang === "python3") {
    if (
      sourceCode.includes("__main__") ||
      sourceCode.includes("sys.stdin") ||
      sourceCode.includes("input(") ||
      sourceCode.includes("__safe_eval") ||
      sourceCode.includes("__cases")
    ) {
      return sourceCode;
    }

    const fnMatch = sourceCode.match(/def\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)/);
    const fnName = fnMatch ? fnMatch[1] : "solution";

    const harness = `

if __name__ == "__main__":
    import sys, json, ast, inspect

    def __safe_eval(s):
        s = s.strip()
        try:
            return json.loads(s)
        except Exception:
            try:
                return ast.literal_eval(s)
            except Exception:
                # Check for space-separated numbers
                parts = s.split()
                if len(parts) > 1:
                    try:
                        return [int(x) if x.lstrip('-+').isdigit() else float(x) for x in parts]
                    except Exception:
                        pass
                return s

    __raw = sys.stdin.read().strip()
    if __raw:
        __lines = [l.strip() for l in __raw.splitlines() if l.strip()]
        __parsed = [__safe_eval(l) for l in __lines]

        __fn = None
        if "Solution" in globals() or "Solution" in locals():
            try:
                sol = Solution()
                methods = [m for m in dir(sol) if not m.startswith("_") and callable(getattr(sol, m))]
                if methods:
                    __fn = getattr(sol, methods[0])
            except Exception:
                pass

        if not __fn and "${fnName}" in globals():
            __fn = globals()["${fnName}"]

        if __fn:
            try:
                sig = inspect.signature(__fn)
                p_count = len(sig.parameters)
            except Exception:
                p_count = len(__parsed)

            if len(__parsed) == p_count:
                __args = __parsed
            elif len(__parsed) == 1 and isinstance(__parsed[0], str) and p_count > 1:
                try:
                    wrapped = __safe_eval(f"[{__parsed[0]}]")
                    if isinstance(wrapped, list) and len(wrapped) == p_count:
                        __args = wrapped
                    else:
                        __args = __parsed
                except Exception:
                    __args = __parsed
            elif len(__parsed) == 1 and isinstance(__parsed[0], (list, tuple)) and len(__parsed[0]) == p_count:
                __args = list(__parsed[0])
            else:
                __args = __parsed

            __res = __fn(*__args)
            if isinstance(__res, (list, dict)):
                print(json.dumps(__res))
            elif isinstance(__res, bool):
                print(str(__res).lower())
            elif __res is None:
                print("null")
            else:
                print(__res)
`;
    return sourceCode + harness;
  }

  if (lang === "javascript" || lang === "js" || lang === "node") {
    if (
      sourceCode.includes("readFileSync") ||
      sourceCode.includes("process.stdin") ||
      sourceCode.includes("readline") ||
      sourceCode.includes("__cases") ||
      sourceCode.includes("__raw")
    ) {
      return sourceCode;
    }

    const fnMatch = sourceCode.match(/(?:function\s+|var\s+|let\s+|const\s+)([a-zA-Z_]\w*)/);
    const fnName = fnMatch ? fnMatch[1] : "solution";

    const harness = `

if (typeof require !== 'undefined') {
  const fs = require('fs');
  const __raw = fs.readFileSync(0, 'utf-8').trim();
  if (__raw) {
    const __lines = __raw.split('\\n').map(l => l.trim()).filter(Boolean);
    const __parsed = __lines.map(l => {
      try { return JSON.parse(l); } catch(e) {
        if (/^[\\d\\s\\-+.,]+$/.test(l) && (l.includes(' ') || l.includes(','))) {
          const parts = l.replace(/,/g, ' ').trim().split(/\\s+/).map(Number).filter(n => !isNaN(n));
          if (parts.length > 1) return parts;
        }
        return l;
      }
    });

    let __fn = null;
    if (typeof Solution !== 'undefined') {
      try {
        const sol = new Solution();
        const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(sol)).filter(m => m !== 'constructor');
        if (methods.length > 0) __fn = sol[methods[0]].bind(sol);
      } catch(e) {}
    }
    if (!__fn && typeof ${fnName} === 'function') {
      __fn = ${fnName};
    }

    if (__fn) {
      let __args = __parsed;
      const paramCount = typeof __fn.length === 'number' ? __fn.length : 1;

      if (__args.length === 1 && typeof __args[0] === 'string' && paramCount > 1) {
        try {
          const wrapped = JSON.parse('[' + __args[0] + ']');
          if (Array.isArray(wrapped) && wrapped.length === paramCount) {
            __args = wrapped;
          }
        } catch(e) {
          const parts = __args[0].split(',').map(s => s.trim());
          if (parts.length === paramCount) {
            __args = parts.map(p => {
              const num = Number(p);
              return !isNaN(num) && p !== '' ? num : p;
            });
          }
        }
      } else if (__parsed.length === 1 && Array.isArray(__parsed[0])) {
        if (paramCount > 1 && __parsed[0].length === paramCount) {
          __args = __parsed[0];
        }
      }

      (async () => {
        try {
          let __res = __fn(...__args);
          if (__res && typeof __res.then === 'function') {
            __res = await __res;
          }
          if (typeof __res === 'object' && __res !== null) {
            console.log(JSON.stringify(__res));
          } else if (typeof __res === 'boolean') {
            console.log(String(__res));
          } else if (__res === undefined) {
            console.log('undefined');
          } else {
            console.log(__res);
          }
        } catch (__err) {
          console.error(__err && __err.stack ? __err.stack : __err);
          process.exit(1);
        }
      })();
    }
  }
}
`;
    return sourceCode + harness;
  }

  return sourceCode;
}

/**
 * Unified Docker Execution Service for a single run
 * Returns standardized normalized response compatible with all platform controllers
 */
export async function executeDocker({
  sourceCode,
  code,
  language = "python",
  stdin = "",
  input = "",
  cpuTimeLimit = 2.0,
  timeLimitMs = null,
  memoryLimit = 128000,
  memoryLimitMb = 256,
  args = null,
  functionName,
  methodName,
  className,
  executionId,
  testCaseId,
}) {
  const rawCode = sourceCode !== undefined ? sourceCode : (code || "");
  const langId = normalizeLanguage(language);
  if (!langId) {
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

  const effectiveTimeLimitMs = Math.max(300, Math.min(MAX_TIMEOUT_MS, Number(timeLimitMs) || Math.round((Number(cpuTimeLimit) || 2.0) * 1000)));
  const preparedStdin = prepareExecutionInput(stdin || input || "");
  const effectiveMemoryMb = Math.max(32, Math.min(1024, Number(memoryLimitMb) || Math.round((Number(memoryLimit) || 128000) / 1024) || 256));

  let effectiveCode = rawCode;
  const hasExplicitArgs = Array.isArray(args) && args.length > 0;
  if ((langId === "python" || langId === "javascript") && preparedStdin && !hasExplicitArgs) {
    effectiveCode = wrapFunctionHarness(rawCode, langId);
  }

  const singleResult = await executeSingle(langId, effectiveCode, args, {
    timeLimitMs: effectiveTimeLimitMs,
    memoryLimitMb: effectiveMemoryMb,
    stdin: preparedStdin,
    className,
    methodName,
    functionName,
    executionId,
    testCaseId,
  });

  const type = singleResult.type || "execution_error";
  let statusId = 3;
  let statusDesc = "Accepted";

  if (type === "success") {
    statusId = 3;
    statusDesc = "Accepted";
  } else if (type === "wrong_answer") {
    statusId = 4;
    statusDesc = "Wrong Answer";
  } else if (type === "time_limit") {
    statusId = 5;
    statusDesc = "Time Limit Exceeded";
  } else if (type === "compile_error") {
    statusId = 6;
    statusDesc = "Compilation Error";
  } else if (type === "memory_limit") {
    statusId = 14;
    statusDesc = "Memory Limit Exceeded";
  } else if (type === "runtime_error") {
    statusId = 11;
    statusDesc = "Runtime Error";
  } else {
    statusId = 13;
    statusDesc = "Execution Error";
  }

  const outStr = String(singleResult.output || "").trim();
  const timeMs = Number(singleResult.timeMs) || 0;
  const timeSeconds = (timeMs / 1000).toFixed(2);
  const memoryKB = Number(singleResult.memoryKB) || 0;

  return {
    status: type,
    statusDescription: statusDesc,
    statusId,
    stdout: type === "success" ? outStr : "",
    stderr: (type !== "success" && type !== "compile_error") ? outStr : "",
    compileOutput: type === "compile_error" ? outStr : "",
    output: outStr,
    timeMs,
    timeSeconds,
    memoryKB,
    token: null,
    type,
  };
}

/**
 * Unified Docker Execution Service for test suite batch execution
 * Respects concurrency semaphore and confidentiality of hidden test cases
 */
export async function executeDockerTestSuite({
  sourceCode,
  code,
  language = "python",
  testCases = [],
  cpuTimeLimit = 2.0,
  timeLimitMs = null,
  memoryLimit = 128000,
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

  const effectiveTimeLimitMs = Math.max(300, Math.min(MAX_TIMEOUT_MS, Number(timeLimitMs) || Math.round((Number(cpuTimeLimit) || 2.0) * 1000)));
  const results = [];
  let passedCount = 0;
  let totalTimeMs = 0;
  let maxMemoryKB = 0;
  let firstCompileOutput = "";

  const cases = Array.isArray(testCases) ? testCases : [];

  for (let i = 0; i < cases.length; i++) {
    const tc = cases[i];
    const isHidden = Boolean(tc.isHidden);
    const tcInput = prepareExecutionInput(tc.input ?? tc.stdin ?? (typeof tc === "string" ? tc : ""));
    const tcExpected = getTestCaseExpectedOutput(tc);

    try {
      const execResult = await executeDocker({
        sourceCode: rawCode,
        language: langId,
        stdin: tcInput,
        timeLimitMs: effectiveTimeLimitMs,
        memoryLimit,
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

// Backward compatible aliases
export const executeJudge0 = executeDocker;
export const executeJudge0TestSuite = executeDockerTestSuite;
export const getJudge0Language = (lang) => {
  const norm = normalizeLanguage(lang);
  return norm && LANGUAGE_CONFIG[norm] ? { id: norm, name: LANGUAGE_CONFIG[norm].label, slug: norm, ext: norm } : null;
};
export const getSupportedJudge0Languages = () => Object.values(LANGUAGE_CONFIG).map((l) => ({ id: l.id, name: l.label, slug: l.id }));

// Output comparison utilities (shared with controllers / result processor).
export {
  compareOutputs,
  normalizeValue,
  COMPARISON_MODES,
  makeWorkspace,
  runPool,
  detectJavaClassName,
  detectPythonFunction,
};

export function getExecutionProviderInfo() {
  ensureDockerChecked();
  return {
    provider: "docker",
    docker: dockerState.available,
    images: { ...dockerState.images },
    concurrency: globalExecutionSemaphore.getStats(),
    refreshImages() {
      for (const [langId, config] of Object.entries(LANGUAGE_CONFIG)) {
        dockerState.images[langId] = checkImageSync(config.image);
      }
      return { ...dockerState.images };
    },
  };
}

