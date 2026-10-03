/**
 * Map common compiler / runtime errors to a human-friendly explanation:
 *   What happened  → Why it happened → Possible solution
 *
 * Matching is done against substrings (lowercased) of the raw message so it
 * works across GCC, Clang, Java, Python, Node, Go, Rust, Kotlin, C# and PHP.
 */
export const ERROR_KNOWLEDGE_BASE = [
  {
    // missing semicolon — C / C++ / Java / C# / JS (strict) / PHP
    match: (m) => /expected.*';'|expected.*;|missing.*;|semicolon|;' expected/i.test(m),
    severity: "error",
    what: "Missing semicolon",
    why: "A statement was not terminated with a semicolon, so the parser cannot tell where it ends.",
    solution: "Add a `;` at the end of the statement (or close the previous statement first).",
  },
  {
    match: (m) => /cannot find symbol|cannot be resolved to a variable|cannot find name|is not defined|NameError|undefined variable/i.test(m),
    severity: "error",
    what: "Undefined variable",
    why: "A variable or function name was used that the compiler/interpreter does not recognise — it was never declared or is out of scope.",
    solution: "Check the spelling, declare the variable before use, or import the symbol. For function names, make sure the function exists.",
  },
  {
    match: (m) => /undeclared Identifier|undeclared|not declared/i.test(m),
    severity: "error",
    what: "Undeclared identifier",
    why: "An identifier was used without being declared first.",
    solution: "Declare the variable with the correct type (e.g. `int x;`) before using it.",
  },
  {
    match: (m) => /incompatible.*type|type mismatch|cannot be dereferenced|cannot be applied|inconvertible types|typeerror/i.test(m),
    severity: "error",
    what: "Type mismatch",
    why: "The value or expression does not match the expected type.",
    solution: "Check the expected type (e.g. compare like types) and add an explicit cast or conversion if intentional.",
  },
  {
    match: (m) => /missing.*bracket|bracket.*not closed|unbalanced|unmatched|expected.*'\\}'|expected.*'\\]'|unterminated/i.test(m),
    severity: "error",
    what: "Missing or unbalanced bracket",
    why: "A `{`, `}` or `]` does not have a matching partner, so the block is not properly closed.",
    solution: "Find the unmatched brace/bracket and add the missing closing character. The editor gutter highlights matching pairs.",
  },
  {
    match: (m) => /unused|unused variable|unused import|unused local|assigned a value that is never read/i.test(m) && /warning/i.test(m),
    severity: "warning",
    what: "Unused variable",
    why: "A variable or import was declared but never read, which usually indicates dead or leftover code.",
    solution: "Remove the declaration, or prefix its name with `_` if it is intentionally unused.",
  },
  {
    match: (m) => /index.*out of range|out of bounds|IndexOutOfBounds|index out of range|segmentation fault|segfault|SIGSEGV|out of memory|stack overflow|stack overflow/i.test(m),
    severity: "error",
    what: "Out-of-bounds / runtime memory access",
    why: "The program accessed memory or an array index that does not exist (or ran out of memory / stack).",
    solution: "Check array/list indices against the container's size before accessing. Ensure recursive functions have a base case.",
  },
  {
    match: (m) => /nullpointer|null pointer|nil pointer|NullReferenceException|NoneType|cannot read|attempt to (read|index)/i.test(m),
    severity: "error",
    what: "Null pointer / nil dereference",
    why: "Code tried to use `null` / `None` / `nil` as if it referenced a real object.",
    solution: "Check that objects are not null before calling methods on them (guard clauses / optional chaining).",
  },
  {
    match: (m) => /division by zero|divide by zero|ZeroDivisionError/i.test(m),
    severity: "error",
    what: "Division by zero",
    why: "A division or modulo operation had zero as its divisor.",
    solution: "Check that the divisor is non-zero before dividing; handle the zero case explicitly.",
  },
  {
    match: (m) => /time limit|timed out|timeout|exceeded.*time|maximum call stack/i.test(m),
    severity: "error",
    what: "Time limit exceeded",
    why: "The program took longer than the allowed time limit to finish.",
    solution: "Reduce the algorithmic complexity (e.g. use a hash map instead of nested loops), avoid unnecessary work, and add a break/return for base cases.",
  },
  {
    match: (m) => /memory limit|out of memory|heap|allocation/i.test(m),
    severity: "error",
    what: "Memory limit exceeded",
    why: "The program used more memory than the allowed limit.",
    solution: "Free unused data, avoid storing all inputs in memory, and prefer streaming or in-place algorithms.",
  },
  {
    match: (m) => /recursion/i.test(m),
    severity: "error",
    what: "Stack overflow",
    why: "Recursion went too deep (no/base case missing or too shallow), overflowing the call stack.",
    solution: "Add or strengthen the base case, or convert deep recursion to an iterative solution.",
  },
  {
    match: (m) => /timeout/i.test(m),
    severity: "error",
    what: "Timeout",
    why: "The process was killed before producing output (likely an infinite loop or too-slow code).",
    solution: "Review loops for termination and improve algorithmic efficiency.",
  },
  {
    match: (m) => /no such file/i.test(m),
    severity: "error",
    what: "File not found",
    why: "A file referenced by the program does not exist.",
    solution: "Check the file path and ensure the file exists before opening it.",
  },
  {
    match: (m) => /permission denied/i.test(m),
    severity: "error",
    what: "Permission denied",
    why: "The program tried to access a resource it is not allowed to.",
    solution: "Check file/operation permissions and run with appropriate privileges.",
  },
  {
    match: (m) => /attribute/i.test(m) && /error/i.test(m),
    severity: "error",
    what: "Attribute error",
    why: "An object does not have the requested property/method, or the type is unexpected.",
    solution: "Verify the object type and that the method name is correct.",
  },
    {
    match: (m) => /typeerror.*not a function|is not a function/i.test(m),
    severity: "error",
    what: "Not a function",
    why: "An expression that is not callable was invoked as a function.",
    solution: "Check that the value is a function (correct casing/spelling) before calling it.",
  },
];

/**
 * Given a raw error/warning string, return the best matching explanation.
 * Falls back to a generic explanation so there is always guidance.
 */
export function explainError(raw) {
  const msg = String(raw || "").toLowerCase();
  for (const entry of ERROR_KNOWLEDGE_BASE) {
    if (entry.match(msg)) return entry;
  }
  return {
    severity: "error",
    what: "Compilation / execution error",
    why: "The code could not compile or threw an error at runtime. See the compiler output for the exact location.",
    solution: "Read the compiler/runtime message, fix the offending line, and re-run. Use the editor squiggles and the Compiler panel for line/column.",
  };
}

/**
 * Parse a chunk of compiler / runtime output text and try to extract structured
 * { line, column, message, severity } markers. Works for GCC/Clang/Java/Python
 * error formats.
 */
export function parseOutputMarkers(output, fallbackLine) {
  if (!output) return [];
  const markers = [];
  const text = String(output);
  // GCC / Clang:  file.cpp:14:18: error: Expected ';'
  //               file.c:14:3: warning: unused variable 'x'
      const gccRe = /(?:(.+?):)?(\d+):(\d+):\s*(error|warning|note):\s*(.*)/gi;
  let m;
  while ((m = gccRe.exec(text)) !== null) {
    markers.push({
      line: Number(m[2] || fallbackLine || 1),
      column: Number(m[3] || 1),
      severity: m[4] === "warning" ? 2 : 1, // 1=Error, 2=Warning (monaco severity)
      rawSeverity: m[4],
      message: (m[5] || "").trim(),
    });
  }
  // Java:  File.java:14: error: cannot find symbol
  //        symbol:   variable arr
  //        location: class Solution
  if (markers.length === 0) {
    const javaRe = /(.+?)[:.](\d+):(?:\s*(\d+):)?\s*(error|warning):\s*(.*)/gi;
    while ((m = javaRe.exec(text)) !== null) {
      markers.push({
        line: Number(m[2] || fallbackLine || 1),
        column: Number(m[3] || 1),
        rawSeverity: m[4],
        severity: m[4] === "warning" ? 2 : 1,
        message: (m[5] || "").trim(),
      });
    }
  }
  // Python:  File "solution.py", line 14
  //              print(arr)
  //          NameError: name 'arr' is not defined
  if (markers.length === 0) {
    const pyRe = /line (\d+)[^\n]*\n[^\n]*\n\s*(.*?Error.*)/gi;
    while ((m = pyRe.exec(text)) !== null) {
      markers.push({
        line: Number(m[1]),
        column: 1,
        rawSeverity: "error",
        severity: 1,
        message: (m[2] || "").trim(),
      });
    }
  }
  if (markers.length === 0) {
    markers.push({
      line: fallbackLine || 1,
      column: 1,
      severity: 1,
      rawSeverity: "error",
      message: text.trim(),
    });
  }
  return markers;
}

export default { ERROR_KNOWLEDGE_BASE, explainError, parseOutputMarkers };
