import { safeLogger } from "./utils/safeLogger.js";

/**
 * Robust JSON extraction and repair utility.
 */
export class AIJsonRepair {
  /**
   * Attempts to repair and parse JSON string from AI response.
   * @param {string} rawText Raw output text from AI
   * @returns {object|array} Parsed JS object
   */
  static parseAndRepair(rawText) {
    if (!rawText || typeof rawText !== "string") {
      throw new Error("Cannot parse empty or non-string response");
    }

    let cleaned = rawText.trim();

    // Step 1: Strip thinking blocks <think>...</think> (common in DeepSeek R1 / reasoning models)
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    // Step 2: Strip Markdown code fences ```json ... ``` or ``` ... ```
    if (cleaned.includes("```")) {
      const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (match && match[1]) {
        cleaned = match[1].trim();
      } else {
        cleaned = cleaned.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
      }
    }

    // Step 3: Fast path - standard JSON parse
    try {
      return JSON.parse(cleaned);
    } catch (e1) {
      // Continue to heuristics
    }

    // Step 4: Extract JSON substring between first { or [ and last } or ]
    const firstBrace = cleaned.indexOf("{");
    const firstBracket = cleaned.indexOf("[");
    let start = -1;
    let end = -1;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      start = firstBrace;
      end = cleaned.lastIndexOf("}");
    } else if (firstBracket !== -1) {
      start = firstBracket;
      end = cleaned.lastIndexOf("]");
    }

    if (start !== -1 && end !== -1 && end > start) {
      cleaned = cleaned.substring(start, end + 1);
      try {
        return JSON.parse(cleaned);
      } catch (e2) {
        // Continue to syntax repair
      }
    }

    // Step 5: Heuristic syntax repair
    let repaired = cleaned
      // Remove trailing commas before } or ]
      .replace(/,\s*([\}\]])/g, "$1")
      // Ensure key names are double quoted: { key: "val" } -> { "key": "val" }
      .replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":')
      // Convert single quoted strings to double quoted strings safely
      .replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"');

    try {
      return JSON.parse(repaired);
    } catch (e3) {
      // Continue to brace balancing
    }

    // Step 6: Balance unclosed braces/brackets
    repaired = this.balanceBraces(repaired);
    try {
      return JSON.parse(repaired);
    } catch (e4) {
      safeLogger.warn(`[JsonRepair] All repair heuristics failed for raw response snippet: ${rawText.slice(0, 150)}`);
      throw new Error(`JSON parse error: Could not repair JSON output: ${e4.message}`);
    }
  }

  /**
   * Automatically balances unclosed braces '{' and brackets '['
   */
  static balanceBraces(str) {
    const stack = [];
    let inString = false;
    let escape = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (inString) {
        if (escape) {
          escape = false;
        } else if (char === "\\") {
          escape = true;
        } else if (char === '"') {
          inString = false;
        }
      } else {
        if (char === '"') {
          inString = true;
        } else if (char === "{" || char === "[") {
          stack.push(char);
        } else if (char === "}") {
          if (stack.length > 0 && stack[stack.length - 1] === "{") {
            stack.pop();
          }
        } else if (char === "]") {
          if (stack.length > 0 && stack[stack.length - 1] === "[") {
            stack.pop();
          }
        }
      }
    }

    let balanced = str;
    // Close remaining open brackets/braces in reverse order
    while (stack.length > 0) {
      const opening = stack.pop();
      if (opening === "{") balanced += "}";
      if (opening === "[") balanced += "]";
    }

    return balanced;
  }
}

export default AIJsonRepair;
