import dotenv from "dotenv";
import { SHARED2_CONFIG } from "../../../config/companyMock/shared2.js";
import { parseAIJson } from "../../ai/aiResponseParser.js";

dotenv.config();

/**
 * Shared KEY2 Company Mock — Dedicated AI Client (Groq/OpenAI compatible).
 *
 * Serves: Capgemini, Cognizant, Deloitte, Infosys
 *
 * Strictly isolated:
 * - Reads ONLY MOCK_INTERVIEW_API_KEY2 and MOCK_INTERVIEW_MODEL2 via SHARED2_CONFIG.
 * - NEVER reads MOCK_INTERVIEW_API_KEY, TCS_MOCK_KEY, ACCENTURE_MOCK_KEY,
 *   BENCHMARK_MOCK_KEY, or AI_API_KEY.
 * - NEVER falls back to another key pool.
 * - Handles errors gracefully without crashing, enabling deterministic fallback.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Check if the KEY2 AI service is configured and ready.
 */
export function isShared2AIConfigured() {
  return SHARED2_CONFIG.isConfigured();
}

/**
 * Generate completion using the dedicated KEY2 API key.
 * Throws controlled errors on failure so caller can trigger fallback.
 */
async function shared2GroqGenerate(prompt, { temperature = 0.3, timeoutMs = SHARED2_CONFIG.timeoutMs, maxTokens = 1024 } = {}) {
  if (!isShared2AIConfigured()) {
    console.log("[KEY2 AI] Fallback: API unavailable (Key missing or unconfigured)");
    throw new Error("SHARED2_AI_NOT_CONFIGURED");
  }

  const key = SHARED2_CONFIG.getApiKey();
  const model = SHARED2_CONFIG.getModel();

  const body = {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature,
    max_completion_tokens: maxTokens,
    response_format: { type: "json_object" },
  };

  if (/gpt-oss|deepseek-r1|o\d|reasoning/i.test(model)) {
    body.reasoning_effort = "low";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  console.log("[KEY2 AI] Request started");

  let res;
  try {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err?.name === "AbortError") {
      console.log("[KEY2 AI] Fallback: API unavailable (Request timed out)");
      throw new Error("SHARED2_AI_REQUEST_TIMEOUT");
    }
    console.log("[KEY2 AI] Fallback: API unavailable (Network / Provider failure)");
    throw new Error("SHARED2_AI_PROVIDER_ERROR");
  }
  clearTimeout(timer);

  if (!res.ok) {
    const status = res.status;
    let safeMsg = "SHARED2_AI_PROVIDER_ERROR";
    if (status === 400) safeMsg = "SHARED2_AI_INVALID_REQUEST";
    else if (status === 401) safeMsg = "SHARED2_AI_INVALID_KEY";
    else if (status === 429) safeMsg = "SHARED2_AI_RATE_LIMITED";
    else if (status >= 500) safeMsg = "SHARED2_AI_SERVER_ERROR";

    console.log(`[KEY2 AI] Fallback: API unavailable (Status ${status} - ${safeMsg})`);
    throw new Error(safeMsg);
  }

  const data = await res.json().catch(() => null);
  const text = data?.choices?.[0]?.message?.content || "";
  if (!text || !text.trim()) {
    console.log("[KEY2 AI] Fallback: API unavailable (Empty response)");
    throw new Error("SHARED2_AI_EMPTY_RESPONSE");
  }

  console.log("[KEY2 AI] Response received");
  return text;
}

/**
 * Generate and parse structured JSON using the KEY2 API key.
 * Returns parsed object or throws controlled error.
 */
export async function shared2AiGenerateJSON(prompt, opts = {}) {
  const text = await shared2GroqGenerate(prompt, opts);
  try {
    return parseAIJson(text);
  } catch (e) {
    console.log("[KEY2 AI] Fallback: API unavailable (JSON parse failed)");
    throw new Error("SHARED2_AI_INVALID_RESPONSE");
  }
}

export const callShared2Ai = shared2GroqGenerate;
export const isShared2AiConfigured = isShared2AIConfigured;
