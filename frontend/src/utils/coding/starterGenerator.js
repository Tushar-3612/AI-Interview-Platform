/**
 * Helper to generate language-specific LeetCode-style starter code from question metadata.
 * Supports Python, C++, Java, and JavaScript.
 */

function camelCase(title) {
  if (!title) return "solution";
  const cleaned = String(title).replace(/[^a-zA-Z0-9\s]/g, "");
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "solution";
  return words[0].toLowerCase() + words.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
}

export function getStarterCode(question, language = "python") {
  const lang = String(language).toLowerCase().trim();

  // 1. Check if starterCode is an object containing exact language starter
  if (question && typeof question.starterCode === "object" && question.starterCode !== null) {
    if (question.starterCode[lang]) return question.starterCode[lang];
    if ((lang === "py" || lang === "python3") && question.starterCode.python) return question.starterCode.python;
    if ((lang === "js" || lang === "node") && question.starterCode.javascript) return question.starterCode.javascript;
    if ((lang === "c++" || lang === "cplusplus") && question.starterCode.cpp) return question.starterCode.cpp;
  }

  // 2. Check if starterCode is a non-empty string that matches the requested language
  if (question && typeof question.starterCode === "string" && question.starterCode.trim()) {
    const codeStr = question.starterCode.trim();
    if (lang === "python" || lang === "py" || lang === "python3") {
      if (codeStr.includes("def ") || codeStr.includes("class Solution")) return codeStr;
    } else if (lang === "javascript" || lang === "js") {
      if (codeStr.includes("function") || codeStr.includes("var ") || codeStr.includes("const ")) return codeStr;
    } else if (lang === "cpp" || lang === "c++") {
      if (codeStr.includes("class Solution") || codeStr.includes("#include")) return codeStr;
    } else if (lang === "java") {
      if (codeStr.includes("class Solution") || codeStr.includes("import java.")) return codeStr;
    }
  }

  // 3. Extract or infer function metadata
  const fnName = question?.functionName || question?.fnName || camelCase(question?.title || question?.problemTitle);

  let rawParams = question?.parameters;
  let paramNames = [];
  let paramTypes = [];

  if (Array.isArray(rawParams) && rawParams.length > 0) {
    paramNames = rawParams.map((p) => (typeof p === "object" ? p.name : String(p)));
    paramTypes = rawParams.map((p) => (typeof p === "object" ? p.type : "auto"));
  } else {
    // Default parameter inference based on title/examples
    const t = String(question?.title || question?.problemTitle || "").toLowerCase();
    if (t.includes("two sum") || t.includes("target")) {
      paramNames = ["nums", "target"];
      paramTypes = ["int[]", "int"];
    } else if (t.includes("reverse") || t.includes("palindrome") || t.includes("string")) {
      paramNames = ["s"];
      paramTypes = ["string"];
    } else if (t.includes("array") || t.includes("max") || t.includes("min") || t.includes("sort")) {
      paramNames = ["nums"];
      paramTypes = ["int[]"];
    } else {
      paramNames = ["nums", "target"];
      paramTypes = ["int[]", "int"];
    }
  }

  const retType = question?.returnType || "auto";

  // 4. Construct LeetCode-style templates
  if (lang === "python" || lang === "py" || lang === "python3") {
    const pyArgs = paramNames.join(", ");
    return `class Solution:\n    def ${fnName}(self, ${pyArgs}):\n        # Write your solution here\n        pass\n`;
  }

  if (lang === "cpp" || lang === "c++") {
    const cppRet = retType === "auto" || retType === "int[]" ? "vector<int>" : retType;
    const cppArgs = paramNames.map((p, idx) => {
      const type = paramTypes[idx] || "int";
      if (type === "int[]") return `vector<int>& ${p}`;
      if (type === "string") return `string ${p}`;
      return `${type} ${p}`;
    }).join(", ");

    return `#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    ${cppRet} ${fnName}(${cppArgs}) {\n        // Write your solution here\n    }\n};\n`;
  }

  if (lang === "java") {
    const javaRet = retType === "auto" || retType === "vector<int>" ? "int[]" : retType;
    const javaArgs = paramNames.map((p, idx) => {
      const type = paramTypes[idx] || "int";
      if (type === "int[]" || type === "vector<int>") return `int[] ${p}`;
      if (type === "string") return `String ${p}`;
      return `${type} ${p}`;
    }).join(", ");

    return `import java.util.*;\n\nclass Solution {\n    public ${javaRet} ${fnName}(${javaArgs}) {\n        // Write your solution here\n    }\n}\n`;
  }

  if (lang === "javascript" || lang === "js" || lang === "node") {
    const jsArgs = paramNames.join(", ");
    return `var ${fnName} = function(${jsArgs}) {\n    // Write your solution here\n};\n`;
  }

  if (lang === "c") {
    return `#include <stdio.h>\n#include <stdlib.h>\n\n// Write your solution here\n`;
  }

  return `// Write your solution here\n`;
}
