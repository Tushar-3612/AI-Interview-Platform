/**
 * Ultra-robust JSON extraction helper for AI responses.
 * Uses bracket-depth tracking to perfectly extract JSON objects and arrays even if truncated.
 */
export function extractJsonFromText(rawText) {
  if (!rawText || typeof rawText !== "string") throw new Error("Empty AI text");
  let cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  cleaned = cleaned.replace(/```json\s*|```\s*/g, "").trim();

  // 1. Try direct parse
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed) return parsed;
  } catch (e) {}

  // 2. Bracket-depth tracking to extract all top-level array elements
  const qStart = cleaned.indexOf("[");
  if (qStart !== -1) {
    const items = [];
    let depth = 0;
    let itemStart = -1;

    for (let i = qStart; i < cleaned.length; i++) {
      if (cleaned[i] === "{") {
        if (depth === 0) itemStart = i;
        depth++;
      } else if (cleaned[i] === "}") {
        depth--;
        if (depth === 0 && itemStart !== -1) {
          const itemStr = cleaned.slice(itemStart, i + 1);
          try {
            items.push(JSON.parse(itemStr));
          } catch (e) {
            try {
              const sanitized = itemStr
                .replace(/,\s*([}\]])/g, "$1")
                .replace(/[\u0000-\u001F\u007F-\u009F]/g, (c) => (c === "\n" || c === "\r" || c === "\t" ? c : " "));
              items.push(JSON.parse(sanitized));
            } catch (e2) {}
          }
          itemStart = -1;
        }
      }
    }

    if (items.length > 0) {
      return { questions: items, problems: items, count: items.length };
    }
  }

  // 3. Find { "questions" ... } or first { to last }
  const qIdx = cleaned.search(/\{\s*"questions"/i);
  const startIdx = qIdx !== -1 ? qIdx : cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (startIdx !== -1 && lastBrace > startIdx) {
    const candidate = cleaned.slice(startIdx, lastBrace + 1);
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

  throw new Error("Could not extract valid JSON from response");
}
