/**
 * Robust JSON extraction helper for AI responses.
 * Normalizes text by removing <think> tags, markdown code blocks, and surrounding prose.
 * Strictly returns parsed JSON without modifying or aliasing schema properties.
 */
export function extractJsonFromText(rawText) {
  if (!rawText || typeof rawText !== "string") throw new Error("Empty AI text");

  // 1. Strip thinking tags
  let cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // 2. Strip markdown code fences (e.g. ```json ... ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // 3. Try direct parse
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object") return parsed;
  } catch (e) {}

  // 4. Locate root JSON object { ... } or array [ ... ] substring to strip surrounding prose
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");

  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = cleaned.lastIndexOf("}");
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = cleaned.lastIndexOf("]");
  }

  if (startIdx !== -1 && endIdx > startIdx) {
    const candidate = cleaned.slice(startIdx, endIdx + 1);
    try {
      return JSON.parse(candidate);
    } catch (e) {
      try {
        const sanitized = candidate
          .replace(/,\s*([}\]])/g, "$1")
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, (c) => (c === "\n" || c === "\r" || c === "\t" ? c : " "));
        return JSON.parse(sanitized);
      } catch (e2) {}
    }
  }

  // 5. Truncated JSON repair attempt
  if (startIdx !== -1) {
    let partial = cleaned.slice(startIdx);
    
    // Clean trailing partial key/value or unclosed quotes
    partial = partial.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"]*$/s, "");
    partial = partial.replace(/,\s*\{[^}]*$/s, "");

    // Balance open braces and brackets
    let openBraces = 0, openBrackets = 0;
    let inString = false, escape = false;

    for (let i = 0; i < partial.length; i++) {
      const c = partial[i];
      if (escape) { escape = false; continue; }
      if (c === '\\') { escape = true; continue; }
      if (c === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (c === '{') openBraces++;
      if (c === '}') openBraces--;
      if (c === '[') openBrackets++;
      if (c === ']') openBrackets--;
    }

    if (inString) partial += '"';
    while (openBrackets > 0) { partial += "]"; openBrackets--; }
    while (openBraces > 0) { partial += "}"; openBraces--; }

    try {
      const repaired = JSON.parse(partial);
      if (repaired && typeof repaired === "object") {
        console.warn("[jsonExtractor] Successfully repaired truncated JSON response.");
        return repaired;
      }
    } catch (e3) {}
  }

  throw new Error("Could not extract valid JSON from response");
}

