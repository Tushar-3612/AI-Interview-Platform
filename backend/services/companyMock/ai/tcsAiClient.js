import dotenv from "dotenv";
import { TCS_CONFIG } from "../../../config/companyMock/tcs.js";
import { parseAIJson } from "../../ai/aiResponseParser.js";

dotenv.config();

/**
 * TCS Company Mock — Dedicated AI Client (Groq/OpenAI compatible).
 *
 * Strictly isolated:
 * - Reads ONLY TCS_MOCK_KEY and TCS_MOCK_MODEL from environment via TCS_CONFIG.
 * - NEVER reads MOCK_INTERVIEW_API_KEY or AI_API_KEY.
 * - NEVER falls back to another company's credentials or Real Interview.
 * - Handles errors gracefully without crashing, enabling deterministic fallback.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Check if the TCS AI service is configured and ready.
 */
export function isTcsAIConfigured() {
  return TCS_CONFIG.isConfigured();
}

/**
 * Generate completion using the dedicated TCS API key.
 * Throws controlled errors on failure so caller can trigger fallback.
 */
async function tcsGroqGenerate(prompt, { temperature = 0.3, timeoutMs = TCS_CONFIG.timeoutMs, maxTokens = 1024 } = {}) {
  if (!isTcsAIConfigured()) {
    console.log("[TCS AI] Fallback: API unavailable (Key missing or unconfigured)");
    throw new Error("TCS_AI_NOT_CONFIGURED");
  }

  const key = TCS_CONFIG.getApiKey();
  const model = TCS_CONFIG.getModel();

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

  console.log("[TCS AI] Request started");

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
      console.log("[TCS AI] Fallback: API unavailable (Request timed out)");
      throw new Error("TCS_AI_REQUEST_TIMEOUT");
    }
    console.log("[TCS AI] Fallback: API unavailable (Network / Provider failure)");
    throw new Error("TCS_AI_PROVIDER_ERROR");
  }
  clearTimeout(timer);

  if (!res.ok) {
    const status = res.status;
    let safeMsg = "TCS_AI_PROVIDER_ERROR";
    if (status === 400) safeMsg = "TCS_AI_INVALID_REQUEST";
    else if (status === 401) safeMsg = "TCS_AI_INVALID_KEY";
    else if (status === 429) safeMsg = "TCS_AI_RATE_LIMITED";
    else if (status >= 500) safeMsg = "TCS_AI_SERVER_ERROR";

    console.log(`[TCS AI] Fallback: API unavailable (Status ${status} - ${safeMsg})`);
    throw new Error(safeMsg);
  }

  const data = await res.json().catch(() => null);
  const text = data?.choices?.[0]?.message?.content || "";
  if (!text || !text.trim()) {
    console.log("[TCS AI] Fallback: API unavailable (Empty response)");
    throw new Error("TCS_AI_EMPTY_RESPONSE");
  }

  console.log("[TCS AI] Response received");
  return text;
}

/**
 * Generate and parse structured JSON using the TCS API key.
 * Returns parsed object or throws controlled error.
 */
export async function tcsAiGenerateJSON(prompt, opts = {}) {
  const text = await tcsGroqGenerate(prompt, opts);
  try {
    return parseAIJson(text);
  } catch (e) {
    console.log("[TCS AI] Fallback: API unavailable (JSON parse failed)");
    throw new Error("TCS_AI_INVALID_RESPONSE");
  }
}

export const callTcsAi = tcsGroqGenerate;
export const isTcsAiConfigured = isTcsAIConfigured;
