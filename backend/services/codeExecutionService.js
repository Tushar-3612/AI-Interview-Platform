import { execFile, execFileSync } from "child_process";
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";

/* ============================================================================
 * Multi-language code execution service
 * ----------------------------------------------------------------------------
 * Architecture (production-ready):
 *   - Provider "piston" (default): remote Judge0-class execution API. No API
 *     key required, enforces time + memory limits with real compilers for all
 *     10 supported languages.
 *   - Provider "local": falls back to locally installed toolchains
 *     (node/python/javac/gcc/g++/csc/mcs/go/rustc/kotlinc/php) when the remote
 *     executor is unreachable or disabled via EXECUTION_PROVIDER=local.
 *   - The student's `solution`-style function is wrapped by a per-language
 *     harness generated server-side (embedded argument literals), so every
 *     language uses the same function-call convention. C/C++ follow the
 *     stdin-based convention (raw JSON input on stdin).
 * ==========================================================================*/

const IS_WIN = process.platform === "win32";
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;

const LANG_ALIASES = {
  javascript: "javascript", js: "javascript", node: "javascript", nodejs: "javascript", "node.js": "javascript",
  python: "python", py: "python", python3: "python",
  java: "java",
  c: "c",
  cpp: "cpp", "c++": "cpp", cplusplus: "cpp",
  csharp: "csharp", "c#": "csharp", cs: "csharp", ".net": "csharp",
  go: "go", golang: "go",
  rust: "rust", rs: "rust",
  kotlin: "kotlin", kt: "kotlin",
  php: "php",
};

const LANGUAGES = {
  javascript: { id: "javascript", label: "JavaScript", piston: "javascript", files: () => ["solution.js"], kind: "function" },
  python: { id: "python", label: "Python", piston: "python", files: () => ["solution.py"], kind: "function" },
  java: { id: "java", label: "Java", piston: "java", files: () => ["Solution.java", "Main.java"], kind: "function" },
  c: { id: "c", label: "C", piston: "c", files: () => ["main.c"], kind: "stdin" },
  cpp: { id: "cpp", label: "C++", piston: "cpp", files: () => ["main.cpp"], kind: "stdin" },
  csharp: { id: "csharp", label: "C#", piston: "csharp", files: () => ["Solution.cs", "Program.cs"], kind: "function" },
  go: { id: "go", label: "Go", piston: "go", files: () => ["main.go"], kind: "function" },
  rust: { id: "rust", label: "Rust", piston: "rust", files: () => ["main.rs"], kind: "function" },
  kotlin: { id: "kotlin", label: "Kotlin", piston: "kotlin", files: () => ["Main.kt"], kind: "function" },
  php: { id: "php", label: "PHP", piston: "php", files: () => ["solution.php"], kind: "function" },
};

export function normalizeLanguage(language) {
  if (!language) return null;
  return LANG_ALIASES[String(language).trim().toLowerCase()] || null;
}

export function getSupportedLanguages() {
  return Object.values(LANGUAGES).map((l) => l.label);
}

export function isStdinLanguage(languageId) {
  return languageId === "c" || languageId === "cpp";
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

function escapeJavaStyleString(s, dollarEscapes) {
  const out = String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  let escaped = out.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
  if (dollarEscapes) escaped = escaped.replace(/\$/g, "\\$");
  escaped = escaped.replace(/[\u0000-\u001f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
  return `"${escaped}"`;
}

function javaValueLiteral(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "0";
    return Number.isInteger(value) ? String(value) : `${value}d`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "new Object[]{}";
    if (value.every((x) => typeof x === "number" && Number.isInteger(x) && Number.isFinite(x))) {
      const inIntRange = value.every((x) => x >= -2147483648 && x <= 2147483647);
      return inIntRange ? `new int[]{${value.join(", ")}}` : `new long[]{${value.map((x) => `${x}L`).join(", ")}}`;
    }
    if (value.every((x) => typeof x === "number")) return `new double[]{${value.join(", ")}}`;
    if (value.every((x) => typeof x === "string")) return `new String[]{${value.map((x) => escapeJavaStyleString(x, false)).join(", ")}}`;
    return `new Object[]{${value.map(javaValueLiteral).join(", ")}}`;
  }
  return escapeJavaStyleString(value, false);
}

function csharpValueLiteral(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "0";
    return Number.isInteger(value) ? String(value) : `${value}d`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "new object[] {}";
    if (value.every((x) => typeof x === "number" && Number.isInteger(x) && Number.isFinite(x))) {
      const inIntRange = value.every((x) => x >= -2147483648 && x <= 2147483647);
      return inIntRange ? `new int[] {${value.join(", ")}}` : `new long[] {${value.map((x) => `${x}L`).join(", ")}}`;
    }
    if (value.every((x) => typeof x === "number")) return `new double[] {${value.join(", ")}}`;
    if (value.every((x) => typeof x === "string")) return `new string[] {${value.map((x) => escapeJavaStyleString(x, false)).join(", ")}}`;
    return `new object[] {${value.map(csharpValueLiteral).join(", ")}}`;
  }
  return escapeJavaStyleString(value, false);
}

function kotlinValueLiteral(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "0";
    return Number.isInteger(value) ? String(value) : `${value}`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "arrayOf<Any>()";
    if (value.every((x) => typeof x === "number" && Number.isInteger(x) && Number.isFinite(x))) {
      const inIntRange = value.every((x) => x >= -2147483648 && x <= 2147483647);
      return inIntRange ? `intArrayOf(${value.join(", ")})` : `longArrayOf(${value.map((x) => `${x}L`).join(", ")})`;
    }
    if (value.every((x) => typeof x === "number")) return `doubleArrayOf(${value.join(", ")})`;
    if (value.every((x) => typeof x === "string")) return `arrayOf(${value.map((x) => escapeJavaStyleString(x, true)).join(", ")})`;
    return `arrayOf<Any>(${value.map(kotlinValueLiteral).join(", ")})`;
  }
  return escapeJavaStyleString(value, true);
}

function rustValueLiteral(value) {
  if (Array.isArray(value)) {
    if (value.every((x) => typeof x === "number")) return `vec![${value.join(", ")}]`;
    if (value.every((x) => typeof x === "string")) return `vec![${value.map((x) => `String::from(${escapeJavaStyleString(x, false)})`).join(", ")}]`;
    return `vec![${value.map((x) => (typeof x === "number" ? String(x) : `String::from(${escapeJavaStyleString(x, false)})`)).join(", ")}]`;
  }
  if (typeof value === "number") return `vec![${value}]`;
  if (typeof value === "string") return `vec![String::from(${escapeJavaStyleString(value, false)})]`;
  return "vec![]";
}

// Java/C# pass string[]/int[]-typed arrays to a `Object...`/`params object[]`
// parameter as the varargs array itself due to array covariance. Casting to
// Object forces them to be wrapped as a single argument.
function javaSingleArgLiteral(value) {
  return Array.isArray(value) ? `(Object) ${javaValueLiteral(value)}` : javaValueLiteral(value);
}

function csharpSingleArgLiteral(value) {
  return Array.isArray(value) ? `(object) ${csharpValueLiteral(value)}` : csharpValueLiteral(value);
}

// Merges the user's own Go imports with the harness imports so student code
// that imports extra packages keeps compiling.
function extractGoImports(source) {
  const imports = new Set();
  const block = String(source).match(/import\s*\(\s*([\s\S]*?)\s*\)/);
  if (block) {
    const re = /"([^"]+)"/g;
    let m;
    while ((m = re.exec(block[1]))) imports.add(m[1]);
  } else {
    const single = String(source).match(/import\s+"([^"]+)"/);
    if (single) imports.add(single[1]);
  }
  return imports;
}

function goImportBlock(extraImports) {
  const all = ["encoding/base64", "encoding/json", "fmt", "os", ...extraImports];
  const unique = [...new Set(all)].sort();
  return `import (
${unique.map((i) => `    "${i}"`).join("\n")}
)`;
}

function buildGoRunHarness(args, userImports) {
  const argsJson = Buffer.from(JSON.stringify(args), "utf8").toString("base64");
  return `package main

${goImportBlock(userImports)}

func init() {
    __raw, err := base64.StdEncoding.DecodeString("${argsJson}")
    if err != nil {
        fmt.Println(err)
        os.Exit(1)
    }
    var __args []interface{}
    if err := json.Unmarshal(__raw, &__args); err != nil {
        fmt.Println(err)
        os.Exit(1)
    }
    __args = __cleanNumbers(__args).([]interface{})
    __out, err := json.Marshal(solution(__args...))
    if err != nil {
        fmt.Println(err)
        os.Exit(1)
    }
    fmt.Println(string(__out))
    os.Exit(0)
}

func __cleanNumbers(v interface{}) interface{} {
    switch t := v.(type) {
    case []interface{}:
        for i := range t {
            t[i] = __cleanNumbers(t[i])
        }
        return t
    case float64:
        if t == float64(int64(t)) {
            return int64(t)
        }
        return t
    default:
        return v
    }
}

func main() {}
`;
}

function buildGoBatchHarness(cases, userImports) {
  const argsJson = Buffer.from(JSON.stringify(cases), "utf8").toString("base64");
  return `package main

${goImportBlock(userImports)}

func init() {
    __raw, err := base64.StdEncoding.DecodeString("${argsJson}")
    if err != nil {
        fmt.Println(err)
        os.Exit(1)
    }
    var __cases [][]interface{}
    if err := json.Unmarshal(__raw, &__cases); err != nil {
        fmt.Println(err)
        os.Exit(1)
    }
    for i := range __cases {
        __cases[i] = __cleanNumbers(__cases[i]).([]interface{})
    }
    for _, __c := range __cases {
        __out, err := json.Marshal(solution(__c...))
        if err != nil {
            fmt.Println(err)
            os.Exit(1)
        }
        fmt.Println(string(__out))
    }
    os.Exit(0)
}

func __cleanNumbers(v interface{}) interface{} {
    switch t := v.(type) {
    case []interface{}:
        for i := range t {
            t[i] = __cleanNumbers(t[i])
        }
        return t
    case float64:
        if t == float64(int64(t)) {
            return int64(t)
        }
        return t
    default:
        return v
    }
}

func main() {}
`;
}

/* ============================================================================
 * Harness builders — every language receives the same function-call convention
 * ==========================================================================*/

function harnessForRun(langId, args) {
  switch (langId) {
    case "python":
      return `\nimport json as __json\n__result = solution(*${pyLiteral(args)})\nprint(__json.dumps(__result, default=str))\n`;
    case "java": {
      const literal = args.length === 1 ? javaSingleArgLiteral(args[0]) : `new Object[]{${args.map(javaValueLiteral).join(", ")}}`;
      return `public class Main {
    public static void main(String[] args) {
        Object __result = Solution.solve(${literal});
        System.out.println(Main.toJson(__result));
    }
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
        StringBuilder sb = new StringBuilder("\\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': sb.append("\\\\\\""); break;
                case '\\\\': sb.append("\\\\\\\\"); break;
                case '\\n': sb.append("\\\\n"); break;
                case '\\r': sb.append("\\\\r"); break;
                case '\\t': sb.append("\\\\t"); break;
                default:
                    if (c < 32) sb.append(String.format("\\\\u%04x", (int) c));
                    else sb.append(c);
            }
        }
        return sb.append("\\"").toString();
    }
}
`;
    }
    case "csharp": {
      const literal = args.length === 1 ? csharpSingleArgLiteral(args[0]) : `new object[] {${args.map(csharpValueLiteral).join(", ")}}`;
      return `using System;
using System.Collections;
using System.Globalization;
using System.Text;

public class Program {
    public static void Main() {
        object result = Solution.Solve(${literal});
        Console.WriteLine(Program.ToJson(result));
    }
    static string ToJson(object value) {
        if (value == null) return "null";
        if (value is string) return ToJsonString((string) value);
        if (value is bool) return (bool) value ? "true" : "false";
        if (value is char) return ToJsonString(value.ToString());
        if (value is int || value is long || value is double || value is float || value is decimal)
            return Convert.ToString(value, CultureInfo.InvariantCulture);
        if (value is IEnumerable) {
            StringBuilder sb = new StringBuilder("[");
            bool first = true;
            foreach (object item in (IEnumerable) value) {
                if (!first) sb.Append(",");
                sb.Append(ToJson(item));
                first = false;
            }
            return sb.Append("]").ToString();
        }
        return ToJsonString(value.ToString());
    }
    static string ToJsonString(string s) {
        StringBuilder sb = new StringBuilder("\\"");
        foreach (char c in s) {
            switch (c) {
                case '"': sb.Append("\\\\\\""); break;
                case '\\\\': sb.Append("\\\\\\\\"); break;
                case '\\n': sb.Append("\\\\n"); break;
                case '\\r': sb.Append("\\\\r"); break;
                case '\\t': sb.Append("\\\\t"); break;
                default:
                    if (c < 32) sb.Append("\\\\u").Append(((int) c).ToString("x4"));
                    else sb.Append(c);
                    break;
            }
        }
        return sb.Append("\\"").ToString();
    }
}
`;
    }
    case "go":
      // Go harness is assembled in buildSources (needs the user's imports)
      return "";
    case "rust":
      return `\nfn main() {
    let __args = ${rustValueLiteral(args)};
    println!("{}", __jsonish(format!("{:?}", solution(__args))));
}

fn __jsonish(s: String) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    let mut in_str = false;
    while let Some(c) = chars.next() {
        match c {
            '"' => { in_str = !in_str; out.push(c); }
            ',' if !in_str => {
                out.push(',');
                while let Some(&n) = chars.peek() { if n == ' ' { chars.next(); } else { break; } }
            }
            ':' if !in_str => {
                out.push(':');
                if let Some(&' ') = chars.peek() { chars.next(); }
            }
            _ => out.push(c),
        }
    }
    out
}
`;
    case "kotlin":
      return `\nfun main() {
    val __result = solution(${args.length === 1 ? kotlinValueLiteral(args[0]) : args.map(kotlinValueLiteral).join(", ")})
    println(__toJson(__result))
}

fun __toJson(value: Any?): String = when (value) {
    null -> "null"
    is String -> __toJsonString(value)
    is Boolean -> value.toString()
    is Int, is Long, is Short, is Byte -> value.toString()
    is Double, is Float -> value.toString()
    is IntArray -> value.joinToString(prefix = "[", postfix = "]") { it.toString() }
    is LongArray -> value.joinToString(prefix = "[", postfix = "]") { it.toString() }
    is DoubleArray -> value.joinToString(prefix = "[", postfix = "]") { it.toString() }
    is BooleanArray -> value.joinToString(prefix = "[", postfix = "]") { it.toString() }
    is Array<*> -> value.joinToString(prefix = "[", postfix = "]") { __toJson(it) }
    is List<*> -> value.joinToString(prefix = "[", postfix = "]") { __toJson(it) }
    else -> __toJsonString(value.toString())
}

fun __toJsonString(value: String): String {
    val sb = StringBuilder("\\"")
    for (c in value) {
        when (c) {
            '"' -> sb.append("\\\\\\"")
            '\\\\' -> sb.append("\\\\\\\\")
            '\\n' -> sb.append("\\\\n")
            '\\r' -> sb.append("\\\\r")
            '\\t' -> sb.append("\\\\t")
            else -> if (c.code < 32) sb.append("\\\\u%04x".format(c.code)) else sb.append(c)
        }
    }
    return sb.append("\\"").toString()
}
`;
    case "php":
      return `<?php
$__args = json_decode(base64_decode('${Buffer.from(JSON.stringify(args), "utf8").toString("base64")}'), true);
echo json_encode(solution(...$__args));
exit;
?>
`;
    default:
      return "";
  }
}

function harnessForBatch(langId, cases) {
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
      const run = `public class Main {
    public static void main(String[] args) {
        Object[][] __cases = new Object[][]{
        ${caseLiterals}
        };
        for (Object[] __c : __cases) {
            System.out.println(Main.toJson(Solution.solve(__c)));
        }
    }`;
      return run + buildJavaToJsonSuffix();
    }
    case "csharp": {
      const caseLiterals = cases.map((c) => `new object[] {${c.map(csharpValueLiteral).join(", ")}}`).join(",\n        ");
      const run = `using System;
using System.Collections;
using System.Globalization;
using System.Text;

public class Program {
    public static void Main() {
        object[][] cases = new object[][]{
        ${caseLiterals}
        };
        foreach (object[] c in cases) {
            Console.WriteLine(Program.ToJson(Solution.Solve(c)));
        }
    }`;
      return run + buildCsharpToJsonSuffix();
    }
    case "go":
      // Go harness is assembled in buildSources (needs the user's imports)
      return "";
    case "rust": {
      const caseLiterals = cases.map((c) => rustValueLiteral(c)).join(", ");
      return `\nfn main() {
    let __cases = vec![${caseLiterals}];
    for __c in __cases {
        println!("{}", __jsonish(format!("{:?}", solution(__c))));
    }
}

fn __jsonish(s: String) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    let mut in_str = false;
    while let Some(c) = chars.next() {
        match c {
            '"' => { in_str = !in_str; out.push(c); }
            ',' if !in_str => {
                out.push(',');
                while let Some(&n) = chars.peek() { if n == ' ' { chars.next(); } else { break; } }
            }
            ':' if !in_str => {
                out.push(':');
                if let Some(&' ') = chars.peek() { chars.next(); }
            }
            _ => out.push(c),
        }
    }
    out
}
`;
    }
    case "kotlin": {
      const caseLiterals = cases.map((c) => `arrayOf<Any>(${c.map(kotlinValueLiteral).join(", ")})`).join(",\n        ");
      return `\nfun main() {
    val __cases = arrayOf(
        ${caseLiterals}
    )
    for (__c in __cases) {
        println(__toJson(solution(*__c)))
    }
}
` + buildKotlinToJsonSuffix();
    }
    case "php": {
      const argsJson = Buffer.from(JSON.stringify(cases), "utf8").toString("base64");
      return `<?php
$__cases = json_decode(base64_decode('${argsJson}'), true);
foreach ($__cases as $__c) {
    echo json_encode(solution(...$__c)) . "\\n";
}
exit;
?>
`;
    }
    default:
      return "";
  }
}

function buildJavaToJsonSuffix() {
  return `
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
        StringBuilder sb = new StringBuilder("\\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': sb.append("\\\\\\""); break;
                case '\\\\': sb.append("\\\\\\\\"); break;
                case '\\n': sb.append("\\\\n"); break;
                case '\\r': sb.append("\\\\r"); break;
                case '\\t': sb.append("\\\\t"); break;
                default:
                    if (c < 32) sb.append(String.format("\\\\u%04x", (int) c));
                    else sb.append(c);
            }
        }
        return sb.append("\\"").toString();
    }
}
`;
}

function buildCsharpToJsonSuffix() {
  return `
    static string ToJson(object value) {
        if (value == null) return "null";
        if (value is string) return ToJsonString((string) value);
        if (value is bool) return (bool) value ? "true" : "false";
        if (value is char) return ToJsonString(value.ToString());
        if (value is int || value is long || value is double || value is float || value is decimal)
            return Convert.ToString(value, CultureInfo.InvariantCulture);
        if (value is IEnumerable) {
            StringBuilder sb = new StringBuilder("[");
            bool first = true;
            foreach (object item in (IEnumerable) value) {
                if (!first) sb.Append(",");
                sb.Append(ToJson(item));
                first = false;
            }
            return sb.Append("]").ToString();
        }
        return ToJsonString(value.ToString());
    }
    static string ToJsonString(string s) {
        StringBuilder sb = new StringBuilder("\\"");
        foreach (char c in s) {
            switch (c) {
                case '"': sb.Append("\\\\\\""); break;
                case '\\\\': sb.Append("\\\\\\\\"); break;
                case '\\n': sb.Append("\\\\n"); break;
                case '\\r': sb.Append("\\\\r"); break;
                case '\\t': sb.Append("\\\\t"); break;
                default:
                    if (c < 32) sb.Append("\\\\u").Append(((int) c).ToString("x4"));
                    else sb.Append(c);
                    break;
            }
        }
        return sb.Append("\\"").ToString();
    }
}
`;
}

function buildKotlinToJsonSuffix() {
  return `
fun __toJson(value: Any?): String = when (value) {
    null -> "null"
    is String -> __toJsonString(value)
    is Boolean -> value.toString()
    is Int, is Long, is Short, is Byte -> value.toString()
    is Double, is Float -> value.toString()
    is IntArray -> value.joinToString(prefix = "[", postfix = "]") { it.toString() }
    is LongArray -> value.joinToString(prefix = "[", postfix = "]") { it.toString() }
    is DoubleArray -> value.joinToString(prefix = "[", postfix = "]") { it.toString() }
    is BooleanArray -> value.joinToString(prefix = "[", postfix = "]") { it.toString() }
    is Array<*> -> value.joinToString(prefix = "[", postfix = "]") { __toJson(it) }
    is List<*> -> value.joinToString(prefix = "[", postfix = "]") { __toJson(it) }
    else -> __toJsonString(value.toString())
}

fun __toJsonString(value: String): String {
    val sb = StringBuilder("\\"")
    for (c in value) {
        when (c) {
            '"' -> sb.append("\\\\\\"")
            '\\\\' -> sb.append("\\\\\\\\")
            '\\n' -> sb.append("\\\\n")
            '\\r' -> sb.append("\\\\r")
            '\\t' -> sb.append("\\\\t")
            else -> if (c.code < 32) sb.append("\\\\u%04x".format(c.code)) else sb.append(c)
        }
    }
    return sb.append("\\"").toString()
}
`;
}

/* ============================================================================
 * Source assembly
 * ==========================================================================*/

function stripCsharpMain(source) {
  const idx = String(source).search(/\bMain\s*\(/);
  if (idx === -1) return String(source);
  const lineStart = String(source).lastIndexOf("\n", idx) + 1;
  const open = String(source).indexOf("{", idx);
  if (open === -1) return String(source);
  let depth = 0;
  let end = -1;
  for (let i = open; i < String(source).length; i++) {
    if (String(source)[i] === "{") depth++;
    else if (String(source)[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end === -1) return String(source);
  return String(source).slice(0, lineStart) + String(source).slice(end);
}

function stripGoPreamble(source) {
  return String(source)
    .replace(/^\s*package\s+main\b.*$/m, "")
    .replace(/^\s*import\s*\(\s*[\s\S]*?\s*\)\s*$/m, "")
    .replace(/^\s*import\s+"[^"]*"\s*$/m, "");
}

function renameMain(source, pattern, replacement) {
  return String(source).replace(new RegExp(pattern), replacement);
}

function buildSources(langId, code, harness, payload = null) {
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
    case "csharp":
      return [
        { name: "Solution.cs", content: stripCsharpMain(code) },
        { name: "Program.cs", content: harness },
      ];
    case "go": {
      const userImports = extractGoImports(code);
      const body = stripGoPreamble(code);
      const goHarness = payload && payload.kind === "batch"
        ? buildGoBatchHarness(payload.cases, userImports)
        : buildGoRunHarness(payload ? payload.args : [], userImports);
      return [{ name: "main.go", content: goHarness + "\n\n" + body }];
    }
    case "rust":
      return [{ name: "main.rs", content: renameMain(code, "fn\\s+main\\s*\\(", "fn __user_main_ignored(") + harness }];
    case "kotlin":
      return [{ name: "Main.kt", content: renameMain(code, "fun\\s+main\\s*\\(", "fun __user_main_ignored(") + harness }];
    case "php":
      // PHP hoists top-level function declarations, so harness-first is safe;
      // strip the user's own <?php/?> so it cannot clash with the harness opener
      return [
        {
          name: "solution.php",
          content: harness + "\n" + String(code).replace(/^\s*<\?php\s*/i, "").replace(/\s*\?>\s*$/g, ""),
        },
      ];
    default:
      return [{ name: LANGUAGES[langId].files()[0], content: String(code) }];
  }
}

/* ============================================================================
 * Local toolchain detection (lazy, cached)
 * ==========================================================================*/

const toolchains = { detected: false };

function detectBinary(bin) {
  try {
    execFileSync(bin, ["--version"], { timeout: 5000, stdio: "pipe", windowsHide: true });
    return bin;
  } catch {
    return null;
  }
}

function detectCsc() {
  const inPath = detectBinary("csc");
  if (inPath) return inPath;
  const candidates = [
    "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe",
    "C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function ensureToolchains() {
  if (toolchains.detected) return;
  toolchains.detected = true;
  toolchains.python = detectBinary("python3") || detectBinary("python") || detectBinary("py");
  toolchains.javac = detectBinary("javac");
  toolchains.java = detectBinary("java");
  toolchains.gcc = detectBinary("gcc");
  toolchains.gpp = detectBinary("g++");
  toolchains.csc = detectCsc();
  toolchains.mcs = detectBinary("mcs");
  toolchains.go = detectBinary("go");
  toolchains.rustc = detectBinary("rustc");
  toolchains.kotlinc = detectBinary("kotlinc");
  toolchains.php = detectBinary("php");
  const available = Object.entries(toolchains).filter(([k, v]) => k !== "detected" && v).map(([k]) => k);
  console.log(`⚙️  Local code execution toolchains detected: ${available.join(", ") || "none"}`);
}

function localToolchainError(langId) {
  ensureToolchains();
  const requirements = {
    python: "python3/python",
    java: "javac + java (JDK)",
    c: "gcc",
    cpp: "g++",
    csharp: "csc/mcs (.NET or Mono)",
    go: "go",
    rust: "rustc",
    kotlin: "kotlinc + java",
    php: "php",
  };
  return `No execution provider available for ${LANGUAGES[langId].label}: the remote code execution API is unreachable and no local toolchain (${requirements[langId]}) is installed on this server.`;
}

/* ============================================================================
 * Local process runner
 * ==========================================================================*/

function runProcess(cmd, { timeoutMs = 1000, cwd, stdin } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = execFile(
      cmd[0],
      cmd.slice(1),
      { cwd, timeout: Math.max(200, Math.ceil(timeoutMs)), maxBuffer: MAX_OUTPUT_BYTES, windowsHide: true, env: { ...process.env } },
      (error, stdout, stderr) => {
        const timeMs = Date.now() - started;
        if (error && error.killed && IS_WIN && child.pid) {
          try { execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true }); } catch { /* ignore */ }
        }
        resolve({
          stdout: String(stdout || ""),
          stderr: String(stderr || ""),
          code: child.exitCode,
          timedOut: Boolean(error && error.killed),
          timeMs,
        });
      }
    );
    if (stdin !== undefined) child.stdin.write(stdin);
    child.stdin.end();
  });
}

function localCommands(langId, exeName) {
  ensureToolchains();
  switch (langId) {
    case "python":
      return { run: [toolchains.python, "solution.py"] };
    case "java":
      return {
        compile: [toolchains.javac, "Solution.java", "Main.java"],
        run: [toolchains.java, "-cp", ".", "Main"],
      };
    case "c":
      return {
        compile: [toolchains.gcc, "main.c", "-o", exeName, "-O2", "-w", "-lm"],
        run: [IS_WIN ? exeName : `./${exeName}`],
      };
    case "cpp":
      return {
        compile: [toolchains.gpp, "main.cpp", "-o", exeName, "-O2", "-std=c++17", "-w", "-lm"],
        run: [IS_WIN ? exeName : `./${exeName}`],
      };
    case "csharp":
      return {
        compile: toolchains.csc
          ? [toolchains.csc, "/main:Program", "/out:app.exe", "Program.cs", "Solution.cs"]
          : [toolchains.mcs, "-main:Program", "-out:app.exe", "Program.cs", "Solution.cs"],
        run: IS_WIN ? ["app.exe"] : ["mono", "app.exe"],
      };
    case "go":
      return {
        compile: [toolchains.go, "build", "-o", exeName, "main.go"],
        run: [IS_WIN ? exeName : `./${exeName}`],
      };
    case "rust":
      return {
        compile: [toolchains.rustc, "main.rs", "-o", exeName, "-O"],
        run: [IS_WIN ? exeName : `./${exeName}`],
      };
    case "kotlin":
      return {
        compile: [toolchains.kotlinc, "Main.kt", "-include-runtime", "-d", "solution.jar"],
        run: [toolchains.java, "-jar", "solution.jar"],
      };
    case "php":
      return { run: [toolchains.php, "solution.php"] };
    default:
      throw new Error(`No local command configured for ${langId}`);
  }
}

async function executeViaLocal(langId, files, { timeLimitMs, stdin }) {
  ensureToolchains();
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "codeexec-"));
  const exeName = IS_WIN ? "main.exe" : "main";
  try {
    for (const f of files) {
      await fsp.writeFile(path.join(dir, f.name), f.content, "utf8");
    }
    const commands = localCommands(langId, exeName);
    if (commands.compile) {
      const compile = await runProcess(commands.compile, { timeoutMs: 20000, cwd: dir });
      if (compile.timedOut) {
        return { type: "compile_time_limit", output: "Compilation timed out", timeMs: compile.timeMs, memoryKB: 0 };
      }
      if (compile.code !== 0) {
        return { type: "compile_error", output: (compile.stderr || "Compilation failed").trim(), timeMs: compile.timeMs, memoryKB: 0 };
      }
    }
    const run = await runProcess(commands.run, { timeoutMs: timeLimitMs, cwd: dir, stdin });
    if (run.timedOut) {
      return { type: "time_limit", output: `Time limit exceeded (${timeLimitMs}ms)`, timeMs: timeLimitMs, memoryKB: 0 };
    }
    if (run.code !== 0) {
      return { type: "runtime_error", output: (run.stderr || `Process exited with code ${run.code}`).trim(), timeMs: run.timeMs, memoryKB: 0 };
    }
    return { type: "success", output: run.stdout.trim(), timeMs: run.timeMs, memoryKB: 0 };
  } finally {
    fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/* ============================================================================
 * Piston (remote) provider
 * ==========================================================================*/

function pistonBaseUrl() {
  return String(process.env.PISTON_API_URL || "https://emkc.org/api/v2/piston").replace(/\/+$/, "");
}

function pistonHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (process.env.PISTON_API_TOKEN) headers.Authorization = `Bearer ${process.env.PISTON_API_TOKEN}`;
  return headers;
}

async function pistonReachable() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(`${pistonBaseUrl()}/runtimes`, { signal: controller.signal, headers: pistonHeaders() });
      return res.ok;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}

async function executeViaPiston(langId, files, { timeLimitMs, memoryLimitMb, stdin }) {
  const runTimeoutSec = Math.max(1, Math.min(30, Math.ceil(Number(timeLimitMs) / 1000)));
  const body = {
    language: LANGUAGES[langId].piston,
    version: "*",
    files,
    compile_timeout: 15000,
    run_timeout: runTimeoutSec,
    compile_memory_limit: Math.max(128, Math.floor(Number(memoryLimitMb) || 256)),
    run_memory_limit: Math.max(128, Math.floor(Number(memoryLimitMb) || 256)),
  };
  if (isStdinLanguage(langId)) body.stdin = String(stdin || "");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), (runTimeoutSec + 25) * 1000);
  let response;
  try {
    response = await fetch(`${pistonBaseUrl()}/execute`, {
      method: "POST",
      headers: pistonHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    throw new Error(`Piston execution API unreachable: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Piston execution API requires authentication (HTTP ${response.status}). Set PISTON_API_URL + PISTON_API_TOKEN, or self-host Piston (docker run -p 2000:2000 ghcr.io/piston-cli/piston) and point EXECUTION_PROVIDER=local for local toolchains.`
      );
    }
    throw new Error(`Piston execution API error: HTTP ${response.status}`);
  }
  const data = await response.json();
  const compile = data.compile || { code: 0 };
  const run = data.run || { stdout: "", stderr: "", code: 0, signal: null, time: 0, memory: 0 };

  if (compile.code !== 0) {
    return { type: "compile_error", output: (compile.stderr || compile.output || "Compilation failed").trim(), timeMs: 0, memoryKB: 0 };
  }
  const timeMs = Math.round(Number(run.time || 0) * 1000);
  const memoryKB = Math.round(Number(run.memory || 0));
  const overTime = run.signal === "SIGKILL" || timeMs >= Number(timeLimitMs);
  if (overTime) {
    return { type: "time_limit", output: `Time limit exceeded (${timeLimitMs}ms)`, timeMs, memoryKB };
  }
  if (run.code !== 0) {
    return { type: "runtime_error", output: (run.stderr || `Process exited with code ${run.code}`).trim(), timeMs, memoryKB };
  }
  return { type: "success", output: String(run.stdout || "").trim(), timeMs, memoryKB };
}

/* ============================================================================
 * Public API
 * ==========================================================================*/

function providerConfig() {
  return String(process.env.EXECUTION_PROVIDER || "auto").toLowerCase();
}

let pistonUnreachableAt = 0;

/**
 * Execute the student's code against a single set of arguments.
 * Returns { type, output, timeMs, memoryKB } where type is one of:
 * "success" | "compile_error" | "runtime_error" | "time_limit" | "memory_limit"
 */
export async function executeSingle(languageId, code, args, { timeLimitMs = 1000, memoryLimitMb = 256, stdin = null } = {}) {
  const langId = normalizeLanguage(languageId);
  if (!langId) throw new Error(`Unsupported language: ${languageId}`);
  if (langId === "javascript") {
    throw new Error("JavaScript execution is handled by the built-in VM runner");
  }
  const effectiveStdin = isStdinLanguage(langId) ? String(stdin ?? "") : undefined;
  const effectiveArgs = isStdinLanguage(langId) ? [] : Array.isArray(args) ? args : [];
  const harness = harnessForRun(langId, effectiveArgs);
  const files = buildSources(langId, code, harness, { kind: "run", args: effectiveArgs });
  return executeWithFallback(langId, files, { timeLimitMs, memoryLimitMb, stdin: effectiveStdin });
}

/**
 * Execute the student's code against multiple argument sets (batch submit mode).
 * Compiles once, runs once; output is one line per test case.
 * Returns { type, outputs: string[] | null, output, timeMs, memoryKB }.
 */
export async function executeBatch(languageId, code, cases, { timeLimitMs = 1000, memoryLimitMb = 256 } = {}) {
  const langId = normalizeLanguage(languageId);
  if (!langId) throw new Error(`Unsupported language: ${languageId}`);
  if (langId === "javascript") {
    throw new Error("JavaScript execution is handled by the built-in VM runner");
  }
  const caseList = Array.isArray(cases) ? cases : [];
  const timeLimitMsNum = Math.max(300, Number(timeLimitMs) || 1000);

  if (isStdinLanguage(langId)) {
    // C/C++ read one input from stdin per run — compile once, run per case
    const files = buildSources(langId, code, "");
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "codeexec-"));
    const exeName = IS_WIN ? "main.exe" : "main";
    try {
      for (const f of files) await fsp.writeFile(path.join(dir, f.name), f.content, "utf8");
      const commands = localCommands(langId, exeName);
      let compileError = null;
      if (commands.compile) {
        const compile = await runProcess(commands.compile, { timeoutMs: 20000, cwd: dir });
        if (compile.code !== 0) compileError = (compile.stderr || "Compilation failed").trim();
        else if (compile.timedOut) compileError = "Compilation timed out";
      }
      if (compileError) {
        return { type: "compile_error", output: compileError, timeMs: 0, memoryKB: 0, outputs: null };
      }
      const outputs = [];
      for (const c of caseList) {
        const run = await runProcess(commands.run, { timeoutMs: timeLimitMsNum, cwd: dir, stdin: String(c || "") });
        if (run.timedOut) {
          outputs.push(`__time_limit__:${timeLimitMsNum}`);
          continue;
        }
        if (run.code !== 0) {
          outputs.push(`__runtime_error__:${(run.stderr || `exit ${run.code}`).trim()}`);
          continue;
        }
        outputs.push(run.stdout.trim());
      }
      return { type: "success", output: outputs.join("\n"), timeMs: 0, memoryKB: 0, outputs };
    } finally {
      fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }

  const harness = harnessForBatch(langId, caseList);
  const files = buildSources(langId, code, harness, { kind: "batch", cases: caseList });
  // total budget scales with the number of cases so a per-case limit is preserved
  const budget = Math.min(30000, timeLimitMsNum * Math.max(1, caseList.length));
  const result = await executeWithFallback(langId, files, { timeLimitMs: budget, memoryLimitMb, stdin: undefined });
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

async function executeWithFallback(langId, files, opts) {
  const configured = providerConfig();
  if (configured === "local") {
    return executeLocalOrThrow(langId, files, opts);
  }
  if (configured === "piston") {
    return executeViaPiston(langId, files, opts);
  }
  // auto: piston first, local as fallback
  if (Date.now() - pistonUnreachableAt < 60000) {
    return executeLocalOrThrow(langId, files, opts);
  }
  try {
    return await executeViaPiston(langId, files, opts);
  } catch (error) {
    pistonUnreachableAt = Date.now();
    console.warn(`⚠️  Piston execution unavailable, falling back to local toolchains: ${error.message}`);
    return executeLocalOrThrow(langId, files, opts);
  }
}

async function executeLocalOrThrow(langId, files, opts) {
  ensureToolchains();
  if (!localToolchainAvailable(langId)) {
    throw new Error(localToolchainError(langId));
  }
  return executeViaLocal(langId, files, opts);
}

function localToolchainAvailable(langId) {
  ensureToolchains();
  switch (langId) {
    case "python": return Boolean(toolchains.python);
    case "java": return Boolean(toolchains.javac && toolchains.java);
    case "c": return Boolean(toolchains.gcc);
    case "cpp": return Boolean(toolchains.gpp);
    case "csharp": return Boolean(toolchains.csc || toolchains.mcs);
    case "go": return Boolean(toolchains.go);
    case "rust": return Boolean(toolchains.rustc);
    case "kotlin": return Boolean(toolchains.kotlinc && toolchains.java);
    case "php": return Boolean(toolchains.php);
    default: return false;
  }
}

export function isExecutionConfigured() {
  const configured = providerConfig();
  if (configured === "local") return true;
  if (configured === "piston") return true;
  return true; // auto — piston reachable or local toolchains may exist
}

export function getExecutionProviderInfo() {
  ensureToolchains();
  return {
    provider: providerConfig(),
    pistonUrl: pistonBaseUrl(),
    localToolchains: {
      python: Boolean(toolchains.python),
      java: Boolean(toolchains.javac && toolchains.java),
      c: Boolean(toolchains.gcc),
      cpp: Boolean(toolchains.gpp),
      csharp: Boolean(toolchains.csc || toolchains.mcs),
      go: Boolean(toolchains.go),
      rust: Boolean(toolchains.rustc),
      kotlin: Boolean(toolchains.kotlinc && toolchains.java),
      php: Boolean(toolchains.php),
    },
  };
}
