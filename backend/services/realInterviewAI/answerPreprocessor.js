/**
 * answerPreprocessor.js
 * =====================
 * Node.js wrapper for the Python NLP answer preprocessor.
 * Spawns nlp_preprocessor.py and returns a structured preprocessing result.
 *
 * Output shape:
 * {
 *   originalAnswer: string,
 *   normalizedAnswer: string,
 *   compactAnswer: string,
 *   tokenCountBefore: number,
 *   tokenCountAfter: number,
 *   reductionPercent: number
 * }
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NLP_SCRIPT = path.join(__dirname, "../../python_ai/nlp_preprocessor.py");

/**
 * Preprocess a candidate answer using Python NLP.
 * Preserves originalAnswer always. Only compresses compactAnswer for AI input.
 *
 * @param {object} params
 * @param {string} params.answer - Raw candidate answer
 * @param {"technical"|"project"|"hr"} params.round - Round type affects preservation rules
 * @param {number} [params.maxWords=300] - Max words in compactAnswer
 * @returns {Promise<{originalAnswer, normalizedAnswer, compactAnswer, tokenCountBefore, tokenCountAfter, reductionPercent}>}
 */
export async function preprocessAnswer({ answer, round = "technical", maxWords = 300 }) {
  const raw = String(answer || "").trim();

  // Empty answer — return immediately, no Python call needed
  if (!raw) {
    return {
      originalAnswer: "",
      normalizedAnswer: "",
      compactAnswer: "",
      tokenCountBefore: 0,
      tokenCountAfter: 0,
      reductionPercent: 0,
    };
  }

  // Short answer — no compression needed, skip Python overhead
  const wordCount = raw.split(/\s+/).length;
  if (wordCount <= 60) {
    return {
      originalAnswer: raw,
      normalizedAnswer: raw,
      compactAnswer: raw,
      tokenCountBefore: wordCount,
      tokenCountAfter: wordCount,
      reductionPercent: 0,
    };
  }

  return new Promise((resolve) => {
    const payload = JSON.stringify({ answer: raw, round, maxWords });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const proc = spawn("python", [NLP_SCRIPT], { timeout: 15000 });

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, 14000);

    proc.stdin.write(payload);
    proc.stdin.end();

    proc.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    proc.on("close", () => {
      clearTimeout(timer);

      if (timedOut || !stdout.trim()) {
        // Graceful fallback: return original answer unmodified
        resolve({
          originalAnswer: raw,
          normalizedAnswer: raw,
          compactAnswer: raw,
          tokenCountBefore: wordCount,
          tokenCountAfter: wordCount,
          reductionPercent: 0,
        });
        return;
      }

      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed.success) {
          resolve({
            originalAnswer: parsed.originalAnswer || raw,
            normalizedAnswer: parsed.normalizedAnswer || raw,
            compactAnswer: parsed.compactAnswer || raw,
            tokenCountBefore: parsed.tokenCountBefore || wordCount,
            tokenCountAfter: parsed.tokenCountAfter || wordCount,
            reductionPercent: parsed.reductionPercent || 0,
          });
        } else {
          // Python returned error — use original
          resolve({
            originalAnswer: raw,
            normalizedAnswer: raw,
            compactAnswer: raw,
            tokenCountBefore: wordCount,
            tokenCountAfter: wordCount,
            reductionPercent: 0,
          });
        }
      } catch {
        // JSON parse error — use original
        resolve({
          originalAnswer: raw,
          normalizedAnswer: raw,
          compactAnswer: raw,
          tokenCountBefore: wordCount,
          tokenCountAfter: wordCount,
          reductionPercent: 0,
        });
      }
    });

    proc.on("error", () => {
      clearTimeout(timer);
      // Python not available — use original
      resolve({
        originalAnswer: raw,
        normalizedAnswer: raw,
        compactAnswer: raw,
        tokenCountBefore: wordCount,
        tokenCountAfter: wordCount,
        reductionPercent: 0,
      });
    });
  });
}

/**
 * Batch preprocess multiple answers at once.
 * Runs preprocessing in parallel.
 *
 * @param {Array<{questionId, answer, round}>} items
 * @param {number} [maxWords=300]
 * @returns {Promise<Map<string, PreprocessResult>>}
 */
export async function preprocessAnswerBatch(items, maxWords = 300) {
  const results = await Promise.all(
    items.map(async (item) => {
      const result = await preprocessAnswer({
        answer: item.answer,
        round: item.round || "technical",
        maxWords,
      });
      return { questionId: item.questionId, ...result };
    })
  );

  const map = new Map();
  for (const r of results) {
    map.set(r.questionId, r);
  }
  return map;
}
