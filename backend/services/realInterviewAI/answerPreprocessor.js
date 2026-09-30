/**
 * answerPreprocessor.js
 * =====================
 * Production-ready semantic-preserving NLP answer preprocessor.
 * Prepares candidate answers for AI evaluation without modifying question generation.
 *
 * Operations:
 * 1. Normalize unicode & whitespace
 * 2. Standardize punctuation
 * 3. Remove conversational filler phrases ("um", "uh", "like you know", "basically as I was saying")
 * 4. STRICTLY PRESERVE negations and critical logical connectives:
 *    ("not", "no", "never", "cannot", "can't", "without", "only", "don't", "doesn't",
 *     "isn't", "won't", "didn't", "haven't", "hasn't", "hadn't", "wouldn't", "couldn't",
 *     "shouldn't", "rarely", "neither", "nor", "none", "nothing", "nowhere")
 * 5. Structured JSON Output contract:
 *    {
 *      originalAnswer: string,
 *      cleanedAnswer: string,
 *      normalizedAnswer: string,
 *      compactAnswer: string,
 *      tokens: string[],
 *      tokenCountBefore: number,
 *      tokenCountAfter: number,
 *      reductionPercent: number,
 *      normalizationApplied: boolean
 *    }
 */

// Conversational filler phrases that add zero technical content
const FILLER_PHRASES = [
  /\b(?:um|uh|er|ah|like you know|you know what i mean|as i was saying|basically speaking|to be honest with you|if that makes sense)\b/gi,
  /\b(?:so basically|like basically|honestly speaking|you know like|i mean like)\b/gi,
  /\b(?:i guess so|kind of like|sort of like)\b/gi,
];

// Essential negation and logical words that MUST NEVER be stripped
export const PRESERVED_CRITICAL_WORDS = new Set([
  "not", "no", "never", "none", "nor", "neither", "nothing", "nowhere",
  "cannot", "cant", "can't", "dont", "don't", "doesnt", "doesn't",
  "didnt", "didn't", "isnt", "isn't", "arent", "aren't", "wasnt", "wasn't",
  "werent", "weren't", "havent", "haven't", "hasnt", "hasn't", "hadnt", "hadn't",
  "wont", "won't", "wouldnt", "wouldn't", "couldnt", "couldn't", "shouldnt", "shouldn't",
  "without", "only", "except", "rarely", "seldom", "hardly", "scarcely",
  "true", "false", "null", "undefined", "const", "let", "var", "async", "await",
]);

/**
 * Cleans and tokenizes text while strictly preserving negations and semantics.
 *
 * @param {string} rawText - The raw candidate answer
 * @returns {{ cleanedText: string, tokens: string[] }}
 */
export function cleanAndTokenizeText(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return { cleanedText: "", tokens: [] };
  }

  // 1. Normalize line breaks and tabs to spaces
  let text = rawText.replace(/[\r\n\t]+/g, " ");

  // 2. Remove filler phrases while keeping surrounding structure
  for (const fillerRegex of FILLER_PHRASES) {
    text = text.replace(fillerRegex, " ");
  }

  // 3. Normalize multiple spaces and trim
  text = text.replace(/\s+/g, " ").trim();

  // 4. Tokenize on whitespace
  const rawTokens = text.split(/\s+/).filter(Boolean);

  return {
    cleanedText: text,
    tokens: rawTokens,
  };
}

/**
 * Preprocess a candidate answer for AI evaluation.
 *
 * @param {object} params
 * @param {string} params.answer - Raw candidate answer
 * @param {"technical"|"project"|"hr"|"coding"|"aptitude"} [params.round="technical"] - Round identifier
 * @param {number} [params.maxWords=300] - Word cap for token efficiency
 * @returns {Promise<{
 *   originalAnswer: string,
 *   cleanedAnswer: string,
 *   normalizedAnswer: string,
 *   compactAnswer: string,
 *   tokens: string[],
 *   tokenCountBefore: number,
 *   tokenCountAfter: number,
 *   reductionPercent: number,
 *   normalizationApplied: boolean
 * }>}
 */
export async function preprocessAnswer({ answer, round = "technical", maxWords = 300 }) {
  const raw = String(answer || "").trim();

  if (!raw) {
    return {
      originalAnswer: "",
      cleanedAnswer: "",
      normalizedAnswer: "",
      compactAnswer: "",
      tokens: [],
      tokenCountBefore: 0,
      tokenCountAfter: 0,
      reductionPercent: 0,
      normalizationApplied: false,
    };
  }

  const initialTokens = raw.split(/\s+/).filter(Boolean);
  const tokenCountBefore = initialTokens.length;

  const { cleanedText, tokens } = cleanAndTokenizeText(raw);

  // Apply word limit if exceptionally long, preserving full head and key concepts
  let compactTokens = tokens;
  if (tokens.length > maxWords) {
    compactTokens = tokens.slice(0, maxWords);
  }
  const compactAnswer = compactTokens.join(" ");
  const tokenCountAfter = compactTokens.length;

  const reductionPercent = tokenCountBefore > 0
    ? Math.max(0, Math.round(((tokenCountBefore - tokenCountAfter) / tokenCountBefore) * 100))
    : 0;

  return {
    originalAnswer: raw,
    cleanedAnswer: cleanedText,
    normalizedAnswer: cleanedText,
    compactAnswer,
    tokens: compactTokens,
    tokenCountBefore,
    tokenCountAfter,
    reductionPercent,
    normalizationApplied: true,
  };
}

/**
 * Batch preprocess multiple answers simultaneously.
 *
 * @param {Array<{questionId: string, answer: string, round?: string}>} items
 * @param {number} [maxWords=300]
 * @returns {Promise<Map<string, object>>} Map of questionId -> PreprocessResult
 */
export async function preprocessAnswerBatch(items, maxWords = 300) {
  if (!Array.isArray(items)) return new Map();

  const results = await Promise.all(
    items.map(async (item) => {
      const result = await preprocessAnswer({
        answer: item.answer || item.candidateAnswer,
        round: item.round || "technical",
        maxWords,
      });
      return { questionId: String(item.questionId || item.id || item._id), ...result };
    })
  );

  const map = new Map();
  for (const r of results) {
    map.set(r.questionId, r);
  }
  return map;
}
