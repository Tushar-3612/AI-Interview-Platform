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
    execFileSync("docker", ["info"], { timeout: 1500, stdio: "pipe", windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

function checkImageSync(imageName) {
  try {
    const out = execFileSync("docker", ["images", "-q", imageName], {
      timeout: 2000, stdio: "pipe", windowsHide: true, encoding: "utf8",
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
  console.log(`  Docker Engine: ${dockerState.available ? "ACTIVE" : "STANDBY / NOT RUNNING"}`);
  console.log(`  Execution Mode: ${dockerState.available ? "Docker Container Sandbox" : "Native Host Process (Docker-Free)"}`);

  if (!dockerState.available) {
    console.log("  ✅  Code execution will run seamlessly using native host compilers (Python, Java, C, C++).");
    console.log("========================================");
    console.log("");
    return;
  }

  for (const [langId, config] of Object.entries(LANGUAGE_CONFIG)) {
    const available = checkImageSync(config.image);
    dockerState.images[langId] = available;
    console.log(`  ${config.label} Runner: ${available ? "AVAILABLE" : "NATIVE FALLBACK"} (${config.image})`);
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

function detectPythonFunction(code) {
  if (!code) return "solution";
  const m = code.match(/def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
  return m ? m[1] : "solution";
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
        // fall back to trimmed JSON compare (arrays/objects w/ spacing diffs)
        try {
          return JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(e));
        } catch {
          return a === e;
        }
      }
      return at.every((tok, i) => tok === et[i]);
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
function detectRawJavaInput(args, paramTypes) {
  if (!paramTypes || paramTypes.length === 0) return null;
  if (!Array.isArray(args) || args.length !== 1) return null;
  if (typeof args[0] !== "string") return null;
  if (paramTypes.length === 1 && paramTypes[0] === "String") return null;
  return args[0];
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
        Object __result = ${className}.${methodName}(${invocation});
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
      const fn = opts.functionName || "solution";
      return `\nimport json as __json\n__result = ${fn}(*${pyLiteral(args)})\nprint(__json.dumps(__result, default=str))\n`;
    }
    case "java": {
      const paramTypes = code ? parseJavaParamTypes(code, methodName) : null;

      // A single raw, whitespace/comma separated input string (e.g. a stdin-style
      // "6 10 5 8 10 3 7") must be tokenised by the Runner into the typed
      // parameters — it is never passed verbatim to a typed argument.
      const rawInput = detectRawJavaInput(args, paramTypes);
      if (rawInput !== null) {
        return buildJavaRawRunner(className, methodName, rawInput, paramTypes, opts);
      }

      let invocation;

      if (paramTypes && paramTypes.length === 0) {
        // Zero-parameter function — nothing to pass.
        invocation = "";
      } else if (paramTypes && paramTypes.length === 1) {
        // Single-parameter function: the WHOLE of `args` is that one argument.
        // This intentionally tolerates both well-structured callers that wrap
        // the value (args=[<value>]) and raw inputs that arrive as a flat list
        // (e.g. a JSON array fed to solve(int[] arr) becomes one int[] arg), so
        // the Runner always invokes the exact student signature.
        const singleArg = args.length === 1 ? args[0] : args;
        invocation = javaTypedLiteral(paramTypes[0], singleArg);
      } else if (paramTypes && paramTypes.length > 1) {
        // Multi-parameter: align argument-by-argument when the counts match;
        // otherwise fall back to a best-effort positional mapping.
        if (args.length === paramTypes.length) {
          invocation = paramTypes.map((t, i) => javaTypedLiteral(t, args[i])).join(", ");
        } else {
          invocation = args.map((a) => javaValueLiteral(a)).join(", ");
        }
      } else {
        // Signature could not be parsed — preserve the legacy arg-count
        // heuristic so previously-working edge cases keep behaving.
        if (args.length === 0) {
          invocation = "";
        } else if (args.length === 1) {
          invocation = javaValueLiteral(args[0]);
        } else {
          invocation = args.map((a) => javaValueLiteral(a)).join(", ");
        }
      }
      const runnerClass = opts.runnerClassName || "Runner";
      const mainBlock = `public class ${runnerClass} {
    public static void main(String[] args) {
        Object __result = ${className}.${methodName}(${invocation});
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

function buildSources(langId, code, harness, opts = {}) {
  const config = LANGUAGE_CONFIG[langId];
  switch (langId) {
    case "python": {
      const userSource = String(code);
      const harnessCode = harness || "";
      return [{ name: config.sourceFile, content: userSource + harnessCode }];
    }
    case "java": {
      // User file is named after the detected public class so a public class
      // declaration no longer triggers "should be declared in Main.java".
      const userFile = opts.userFile || config.sourceFile;
      const runnerFile = opts.runnerFile || config.wrapperFile;
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
      return [{ name: config.sourceFile, content: String(code) }];
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
    let settled = false;

    const child = spawn("docker", dockerArgs, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Guarantee the Promise resolves exactly once, even if the child process
    // neither emits "close" nor "error" (e.g. a wedged Docker CLI on a dead
    // daemon). Without this guard an unresolved Promise would hang the whole
    // suite.
    const settle = (payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(payload);
    };

    // Hard timeout — kill container if exceeded. The kill itself is best-effort;
    // `settle` above ensures resolution regardless of whether "close" fires.
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
}

/* ============================================================================
 * Core Docker execution
 * ==========================================================================*/

async function executeViaDocker(
  langId,
  files,
  {
    timeLimitMs,
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
    return { type: "execution_error", output: "Docker is not available. Start Docker Desktop and restart the server.", timeMs: 0, memoryKB: 0 };
  }

  if (!dockerState.images[langId]) {
    // Re-check in case image was built after startup
    dockerState.images[langId] = checkImageSync(config.image);
    if (!dockerState.images[langId]) {
      return { type: "execution_error", output: `Docker image '${config.image}' not found. Run: docker compose build`, timeMs: 0, memoryKB: 0 };
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

    // Debug: log generated source files before compilation
    for (const f of files) {
      if (f.name.endsWith(".java") || f.name === "main.c" || f.name === "main.cpp") {
        console.log(`\n========== Generated ${f.name} (${langId}) ==========`);
        console.log(f.content);
        console.log(`========== END ${f.name} ==========\n`);
      }
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

    // Compiled languages (Java/C/C++): compile AND run in a SINGLE isolated
    // container so the compiled binary is never lost between runs. We enforce
    // the student's time limit with an INNER `timeout` around just the
    // execution step (so a 1s limit actually kills the program near 1s), while
    // the OUTER Docker wall-clock cap covers the full compile+run and is large
    // enough that a slow javac can always finish. Compilation therefore never
    // counts against the student time limit, and a compilation failure is
    // always classified as a compile (or execution) error — never as a
    // time-limit violation. runDockerContainer also enforces a hard kill so
    // the Promise can never hang.
    if (compileCommand) {
      const runPart = stdin !== undefined && stdin !== null
        ? runCommand.join(" ") + " < /workspace/__input.txt"
        : runCommand.join(" ");
      const runSec = Math.max(1, Math.ceil((timeLimitMs + RUN_EXEC_BUFFER_MS) / 1000));
      // `timeout -s KILL` guarantees the student process is hard-killed if it
      // exceeds its budget; exit 137 (128+SIGKILL) is detected below.
      const compileAndRun = `${compileCommand.join(" ")} && timeout -s KILL ${runSec} ${runPart}`;

      const result = await runDockerContainer(
        config.image,
        [compileAndRun],  // Wrapped in sh -c by runDockerContainer
        {
          timeoutMs: Math.min(MAX_TIMEOUT_MS, COMPILE_TIMEOUT_MS + timeLimitMs),
          workspaceDir: dockerDir,
          stdin: undefined, // stdin is fed via file when needed
        }
      );

      console.log(`[${result.execId}] Run ${langId}: exit=${result.code} time=${result.timeMs}ms`);

      if (result.code !== 0) {
        const stderr = (result.stderr || "").trim();
        const stdout = (result.stdout || "").trim();

        // A compilation failure takes precedence over everything else (including
        // a timeout): a slow/interrupted compile, or a container killed mid-build,
        // must never be reported as a student "Time Limit Exceeded".
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

        // Execution exceeded the student time limit — killed by the inner
        // `timeout` (exit 137) or by the outer Docker safety timeout.
        if (result.timedOut || result.code === 124 || result.code === 137) {
          return { type: "time_limit", output: `Time limit exceeded (${timeLimitMs}ms)`, timeMs: timeLimitMs, memoryKB: 0 };
        }

        // Otherwise it's a runtime error.
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
    // Clean up temporary directory unless the caller owns it (workspaceDir).
    if (!workspaceDir) fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
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
 * Native process runner (Docker-free execution fallback)
 * ==========================================================================*/

function runNativeProcess(command, args, { timeoutMs = 10000, cwd, stdin } = {}) {
  const started = Date.now();
  const execId = crypto.randomBytes(4).toString("hex");

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let killed = false;

    let child;
    try {
      child = spawn(command, args, {
        cwd,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (spawnErr) {
      return resolve({
        stdout: "",
        stderr: `Failed to spawn ${command}: ${spawnErr.message}`,
        code: 1,
        timedOut: false,
        timeMs: Date.now() - started,
        execId,
      });
    }

    const timer = setTimeout(() => {
      killed = true;
      try {
        if (process.platform === "win32") {
          spawn("taskkill", ["/pid", child.pid.toString(), "/f", "/t"], { windowsHide: true, stdio: "ignore" });
        } else {
          child.kill("SIGKILL");
        }
      } catch (e) {}
    }, timeoutMs);

    if (stdin !== undefined && stdin !== null && child.stdin) {
      try {
        child.stdin.write(String(stdin));
        child.stdin.end();
      } catch (e) {}
    } else if (child.stdin) {
      child.stdin.end();
    }

    child.stdout.on("data", (chunk) => {
      if (stdout.length < MAX_OUTPUT_BYTES) stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      if (stderr.length < MAX_OUTPUT_BYTES) stderr += chunk.toString("utf8");
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const timeMs = Date.now() - started;
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code: code === null ? 1 : code,
        timedOut: killed,
        timeMs,
        execId,
      });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        stdout: "",
        stderr: `Process error: ${err.message}`,
        code: 1,
        timedOut: false,
        timeMs: Date.now() - started,
        execId,
      });
    });
  });
}

async function executeViaNative(langId, files, { timeLimitMs = 10000, stdin }) {
  const config = LANGUAGE_CONFIG[langId];
  if (!config) {
    return { type: "execution_error", output: `No configuration for language: ${langId}`, timeMs: 0, memoryKB: 0 };
  }

  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "codeexec-native-"));
  const isWin = process.platform === "win32";

  try {
    for (const f of files) {
      await fsp.writeFile(path.join(dir, f.name), f.content, "utf8");
    }

    if (langId === "python") {
      const pyCmd = isWin ? "python" : "python3";
      const result = await runNativeProcess(pyCmd, ["solution.py"], {
        timeoutMs: timeLimitMs,
        cwd: dir,
        stdin,
      });

      if (result.timedOut) {
        return { type: "time_limit", output: `Time limit exceeded (${timeLimitMs}ms)`, timeMs: timeLimitMs, memoryKB: 0 };
      }
      if (result.code !== 0) {
        return {
          type: "runtime_error",
          output: (result.stderr || result.stdout || `Process exited with code ${result.code}`).trim(),
          timeMs: result.timeMs,
          memoryKB: 0,
        };
      }
      return { type: "success", output: result.stdout.trim(), timeMs: result.timeMs, memoryKB: 0 };
    }

    if (langId === "java") {
      // Compile
      const compileResult = await runNativeProcess("javac", ["Solution.java", "Main.java"], {
        timeoutMs: COMPILE_TIMEOUT_MS,
        cwd: dir,
      });

      if (compileResult.timedOut) {
        return { type: "compile_error", output: "Compilation timed out", timeMs: compileResult.timeMs, memoryKB: 0 };
      }
      if (compileResult.code !== 0) {
        const stderr = (compileResult.stderr || "Compilation failed").trim();
        const isWrapperError = /Main\.java:\d+/.test(stderr) && !/Solution\.java:\d+/.test(stderr);
        return {
          type: isWrapperError ? "execution_error" : "compile_error",
          output: stderr,
          timeMs: compileResult.timeMs,
          memoryKB: 0,
        };
      }

      // Run
      const runResult = await runNativeProcess("java", ["-cp", ".", "Main"], {
        timeoutMs: timeLimitMs,
        cwd: dir,
        stdin,
      });

      if (runResult.timedOut) {
        return { type: "time_limit", output: `Time limit exceeded (${timeLimitMs}ms)`, timeMs: timeLimitMs, memoryKB: 0 };
      }
      if (runResult.code !== 0) {
        return {
          type: "runtime_error",
          output: (runResult.stderr || runResult.stdout || `Process exited with code ${runResult.code}`).trim(),
          timeMs: runResult.timeMs,
          memoryKB: 0,
        };
      }
      return { type: "success", output: runResult.stdout.trim(), timeMs: runResult.timeMs, memoryKB: 0 };
    }

    if (langId === "cpp" || langId === "c") {
      const binName = isWin ? "main.exe" : "main";
      const srcFile = langId === "cpp" ? "main.cpp" : "main.c";
      const compiler = langId === "cpp" ? "g++" : "gcc";
      const compilerArgs = langId === "cpp"
        ? [srcFile, "-o", binName, "-O2", "-std=c++17", "-w", "-lm"]
        : [srcFile, "-o", binName, "-O2", "-w", "-lm"];

      const compileResult = await runNativeProcess(compiler, compilerArgs, {
        timeoutMs: COMPILE_TIMEOUT_MS,
        cwd: dir,
      });

      if (compileResult.timedOut) {
        return { type: "compile_error", output: "Compilation timed out", timeMs: compileResult.timeMs, memoryKB: 0 };
      }
      if (compileResult.code !== 0) {
        return {
          type: "compile_error",
          output: (compileResult.stderr || "Compilation failed").trim(),
          timeMs: compileResult.timeMs,
          memoryKB: 0,
        };
      }

      // Run binary
      const execPath = isWin ? path.join(dir, binName) : `./${binName}`;
      const runResult = await runNativeProcess(execPath, [], {
        timeoutMs: timeLimitMs,
        cwd: dir,
        stdin,
      });

      if (runResult.timedOut) {
        return { type: "time_limit", output: `Time limit exceeded (${timeLimitMs}ms)`, timeMs: timeLimitMs, memoryKB: 0 };
      }
      if (runResult.code !== 0) {
        return {
          type: "runtime_error",
          output: (runResult.stderr || runResult.stdout || `Process exited with code ${runResult.code}`).trim(),
          timeMs: runResult.timeMs,
          memoryKB: 0,
        };
      }
      return { type: "success", output: runResult.stdout.trim(), timeMs: runResult.timeMs, memoryKB: 0 };
    }

    return { type: "execution_error", output: `Unsupported native runner for ${langId}`, timeMs: 0, memoryKB: 0 };
  } finally {
    fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function executeBatchStdinNative(langId, code, cases, timeLimitMs) {
  const files = buildSources(langId, code, "");
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "codeexec-native-"));
  const isWin = process.platform === "win32";

  try {
    for (const f of files) {
      await fsp.writeFile(path.join(dir, f.name), f.content, "utf8");
    }

    const binName = isWin ? "main.exe" : "main";
    const srcFile = langId === "cpp" ? "main.cpp" : "main.c";
    const compiler = langId === "cpp" ? "g++" : "gcc";
    const compilerArgs = langId === "cpp"
      ? [srcFile, "-o", binName, "-O2", "-std=c++17", "-w", "-lm"]
      : [srcFile, "-o", binName, "-O2", "-w", "-lm"];

    const compileResult = await runNativeProcess(compiler, compilerArgs, {
      timeoutMs: COMPILE_TIMEOUT_MS,
      cwd: dir,
    });

    if (compileResult.code !== 0) {
      return {
        type: "compile_error",
        output: (compileResult.stderr || "Compilation failed").trim(),
        timeMs: compileResult.timeMs,
        memoryKB: 0,
        outputs: null,
      };
    }

    const execPath = isWin ? path.join(dir, binName) : `./${binName}`;
    const outputs = [];
    let totalTimeMs = 0;

    for (const testInput of cases) {
      const runResult = await runNativeProcess(execPath, [], {
        timeoutMs: timeLimitMs,
        cwd: dir,
        stdin: String(testInput || ""),
      });
      totalTimeMs += runResult.timeMs;

      if (runResult.timedOut) {
        outputs.push("__time_limit__");
      } else if (runResult.code !== 0) {
        outputs.push(`__runtime_error__:${runResult.stderr || `exit ${runResult.code}`}`);
      } else {
        outputs.push(runResult.stdout.trim());
      }
    }

    return {
      type: "success",
      output: outputs.join("\n"),
      timeMs: totalTimeMs,
      memoryKB: 0,
      outputs,
    };
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
/**
 * Execute the student's code against a SINGLE set of arguments.
 * Each call runs in its own isolated Docker workspace/process, so concurrent
 * calls never share static state. For Java the student source file is named
 * after their declared public class and invoked by a non-colliding runner.
 *
 * Options: timeLimitMs, memoryLimitMb, stdin,
 *          className, methodName, functionName, runnerClassName,
 *          executionId, testCaseId (for deterministic isolated workspaces).
 * Returns { type, output, timeMs, memoryKB } where type is one of:
 * "success" | "compile_error" | "runtime_error" | "time_limit" | "memory_limit"
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
  if (!langId) throw new Error(`Unsupported language: ${languageId}. Supported: ${getSupportedLanguages().join(", ")}`);

  const effectiveStdin = isStdinLanguage(langId) ? String(stdin ?? "") : undefined;
  const effectiveArgs = isStdinLanguage(langId) ? [] : Array.isArray(args) ? args : [];

<<<<<<< HEAD
  const execId = executionId || crypto.randomBytes(6).toString("hex");

  let files;
  let compileCommand;
  let runCommand;

  if (langId === "java") {
    const detectedClass = className || detectJavaClassName(code);
    const runnerClass = runnerClassName || "Runner";
    const userFile = `${detectedClass}.java`;
    const runnerFile = `${runnerClass}.java`;
    const harness = harnessForRun("java", effectiveArgs, code, {
      className: detectedClass,
      methodName: methodName || "solve",
      runnerClassName: runnerClass,
    });
    files = buildSources("java", code, harness, { userFile, runnerFile });
    compileCommand = ["javac", userFile, runnerFile];
    runCommand = ["java", "-cp", ".", runnerClass];
  } else {
    const fn = langId === "python" ? (functionName || detectPythonFunction(code)) : undefined;
    const harness = harnessForRun(langId, effectiveArgs, code, { functionName: fn });
    files = buildSources(langId, code, harness);
  }

  return executeViaDocker(langId, files, {
    timeLimitMs,
    stdin: effectiveStdin,
    compileCommand,
    runCommand,
    executionId: execId,
    testCaseId,
  });
=======
  ensureDockerChecked();
  if (dockerState.available && dockerState.images[langId]) {
    return executeViaDocker(langId, files, { timeLimitMs, stdin: effectiveStdin });
  }

  // Native execution fallback when Docker is not running or available
  return executeViaNative(langId, files, { timeLimitMs, stdin: effectiveStdin });
>>>>>>> ee891a659c17f7eb242321c5addac9c3732fc708
}

/**
 * Execute the student's code against multiple test cases (batch submit mode).
 *
 * IMPORTANT: every test case runs in its OWN isolated process + sandbox
 * (fanned out through executeSingle), so shared static state / cross-case
 * interference can never happen and one failing case does NOT abort the rest.
 * A bounded worker pool (MAX_CONCURRENT_TESTS) keeps resource usage sane.
 *
 * Returns {
 *   type: "success",               // always "success" — see per-case markers
 *   outputs: string[],             // one entry per case
 *   output: string,                // joined outputs (for logging)
 *   timeMs, memoryKB,
 *   executionId,
 * }
 *
 * Output protocol per case (markers preserved for consumers):
 *   success        -> normalized return/output string
 *   compile_error  -> "__compile_error__:<message>"
 *   runtime_error  -> "__runtime_error__:<message>"
 *   time_limit     -> "__time_limit__:<message>"
 *   memory_limit   -> "__memory_limit__:<message>"
 *   execution_error-> "__execution_error__:<message>"
 *   skipped        -> "__error__:skipped:<message>"
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
  if (!langId) throw new Error(`Unsupported language: ${languageId}. Supported: ${getSupportedLanguages().join(", ")}`);

  const caseList = Array.isArray(cases) ? cases : [];
  const timeLimitMsNum = Math.max(300, Number(timeLimitMs) || DEFAULT_TIMEOUT_MS);
  const execId = executionId || crypto.randomBytes(8).toString("hex");

<<<<<<< HEAD
  const runCase = async (c, index) => {
    const caseInputs = Array.isArray(c) ? c : (Array.isArray(c?.input) ? c.input : []);
    const args = isStdinLanguage(langId)
      ? []
      : caseInputs;
    const stdin = isStdinLanguage(langId)
      ? (c && c.input != null ? String(c.input) : "")
      : null;

    try {
      const res = await executeSingle(langId, code, args, {
        timeLimitMs: timeLimitMsNum,
        memoryLimitMb,
        stdin,
        className: executionConfig.className,
        methodName: executionConfig.methodName,
        functionName: executionConfig.functionName,
        runnerClassName: executionConfig.runnerClassName,
        executionId: execId,
        testCaseId: index,
      });

      switch (res.type) {
        case "success":
          return String(res.output ?? "");
        case "compile_error":
          return `__compile_error__:${res.output || "Compilation failed"}`;
        case "runtime_error":
          return `__runtime_error__:${res.output || "Runtime error"}`;
        case "time_limit":
          return `__time_limit__:${res.output || "Time limit exceeded"}`;
        case "memory_limit":
          return `__memory_limit__:${res.output || "Memory limit exceeded"}`;
        default:
          return `__execution_error__:${res.output || "Execution error"}`;
      }
    } catch (err) {
      return `__execution_error__:${err && err.message ? err.message : String(err)}`;
    }
  };

  const results = await runPool(caseList, runCase, MAX_CONCURRENT_TESTS);

  if (failFast) {
    const failedIndex = results.findIndex((r) => typeof r === "string" && r.startsWith("__"));
    if (failedIndex !== -1) {
      const out = results.map((r, i) => (i === failedIndex ? r : (i < failedIndex ? r : `__error__:skipped:failFast`)));
      return { type: "success", outputs: out, output: out.join("\n"), timeMs: 0, memoryKB: 0, executionId: execId };
    }
  }

  return {
    type: "success",
    outputs: results.map((r) => (typeof r === "string" ? r : `__execution_error__:${r.error ? r.error.message : "unknown"}`)),
    output: results.join("\n"),
    timeMs: 0,
    memoryKB: 0,
    executionId: execId,
  };
=======
  ensureDockerChecked();
  if (dockerState.available && dockerState.images[langId]) {
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

  // Native execution fallback when Docker is not running
  if (isStdinLanguage(langId)) {
    return executeBatchStdinNative(langId, code, caseList, timeLimitMsNum);
  }

  const harness = harnessForBatch(langId, caseList, code);
  const files = buildSources(langId, code, harness);
  const budget = Math.min(60000, timeLimitMsNum * Math.max(1, caseList.length));
  const result = await executeViaNative(langId, files, { timeLimitMs: budget, stdin: undefined });

  if (result.type === "success") {
    let lines = String(result.output || "")
      .split("\n")
      .map((line) => line.replace(/\r$/, ""));
    if (lines.length === caseList.length + 1 && lines[lines.length - 1] === "") lines.pop();
    return { ...result, outputs: lines };
  }
  return { ...result, outputs: null };
>>>>>>> ee891a659c17f7eb242321c5addac9c3732fc708
}

export function isExecutionConfigured() {
  return true;
}

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
    provider: dockerState.available ? "docker" : "native",
    docker: dockerState.available,
    images: { ...dockerState.images },
    refreshImages() {
      for (const [langId, config] of Object.entries(LANGUAGE_CONFIG)) {
        dockerState.images[langId] = checkImageSync(config.image);
      }
      return { ...dockerState.images };
    },
  };
}
