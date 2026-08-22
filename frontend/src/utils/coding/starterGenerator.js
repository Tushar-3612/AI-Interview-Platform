/**
 * Helper to generate language-specific starter code from question metadata
 */
export function getStarterCode(question, language = "python") {
  const lang = String(language).toLowerCase().trim();
  const rawStarter = question?.starterCode || "";
  const title = question?.title || "solution";

  // Try extracting function name and params from rawStarter or title
  let fnName = "solution";
  let params = ["*args"];

  const jsMatch = rawStarter.match(/function\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)/);
  const pyMatch = rawStarter.match(/def\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)/);

  if (jsMatch) {
    fnName = jsMatch[1];
    params = jsMatch[2].split(",").map((p) => p.trim()).filter(Boolean);
  } else if (pyMatch) {
    fnName = pyMatch[1];
    params = pyMatch[2].split(",").map((p) => p.trim()).filter(Boolean);
  } else if (title) {
    // Generate camelCase function name from title e.g. "Merge Two Sorted Arrays" -> "mergeSortedArrays"
    const cleaned = title.replace(/[^a-zA-Z0-9\s]/g, "");
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      fnName = words[0].toLowerCase() + words.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
    }
  }

  const paramListStr = params.length > 0 ? params.join(", ") : "";

  if (lang === "python" || lang === "py" || lang === "python3") {
    return `def ${fnName}(${paramListStr || "*args"}):\n    # Write your solution here\n    pass\n`;
  }

  if (lang === "javascript" || lang === "js" || lang === "node") {
    return `function ${fnName}(${paramListStr}) {\n  // Write your solution here\n  \n}\n`;
  }

  if (lang === "java") {
    return `import java.util.*;\n\npublic class Solution {\n    public static Object ${fnName}(${paramListStr ? params.map((p) => `Object ${p}`).join(", ") : "Object... args"}) {\n        // Write your solution here\n        return null;\n    }\n}\n`;
  }

  if (lang === "cpp" || lang === "c++") {
    return `#include <iostream>\n#include <vector>\n#include <algorithm>\nusing namespace std;\n\n// Write your solution here\n`;
  }

  if (lang === "c") {
    return `#include <stdio.h>\n#include <stdlib.h>\n\n// Write your solution here\n`;
  }

  return rawStarter || `// Write your solution here\n`;
}
