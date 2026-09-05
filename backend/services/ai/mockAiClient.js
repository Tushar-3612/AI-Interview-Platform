import dotenv from "dotenv";

dotenv.config();

/**
 * Company Mock — Dedicated AI client (Groq).
 *
 * Uses a SEPARATE API key from Real Interview.
 *
 * Environment (backend/.env, never frontend):
 *   MOCK_INTERVIEW_API_KEY  - Groq API key (starts with gsk_)
 *   MOCK_INTERVIEW_MODEL    - Groq model id, e.g. "llama-3.3-70b-versatile"
 *
 * This client is ONLY used by Company Mock technical-answer evaluation.
 * It does NOT fall back to the Real Interview API key (AI_API_KEY).
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const DEFAULT_TIMEOUT_MS = 60000;

// ── Safe startup logging ──
const _key = (process.env.MOCK_INTERVIEW_API_KEY || "").trim();
const _model = (process.env.MOCK_INTERVIEW_MODEL || "llama-3.3-70b-versatile").trim();
const _hasKey = !!_key && !/mock/i.test(_key);
console.log(`[MOCK AI] MOCK_INTERVIEW_API_KEY: ${_hasKey ? "loaded" : "missing"}`);
console.log(`[MOCK AI] MOCK_INTERVIEW_MODEL: ${_model ? "configured" : "default"} (${_model})`);

/**
 * Read the Company Mock API key from MOCK_INTERVIEW_API_KEY.
 * Never reads AI_API_KEY (Real Interview).
 */
function getMockApiKey() {
  return (process.env.MOCK_INTERVIEW_API_KEY || "").trim();
}

function getMockModel() {
  return (process.env.MOCK_INTERVIEW_MODEL || "llama-3.3-70b-versatile").trim();
}

/**
 * True only when MOCK_INTERVIEW_API_KEY is a usable, real key.
 * Never falls back to AI_API_KEY.
 */
export function isMockAIConfigured() {
  const key = getMockApiKey();
  if (!key) return false;
  if (/mock/i.test(key)) return false;
  return true;
}

async function mockGroqGenerate(prompt, { temperature = 0.3, timeoutMs = DEFAULT_TIMEOUT_MS, maxTokens = 1024 } = {}) {
  const key = getMockApiKey();
  if (!key) throw new Error("MOCK_AI_NOT_CONFIGURED");

  const model = getMockModel();
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
    if (err?.name === "AbortError") throw new Error("MOCK_AI_REQUEST_TIMEOUT");
    console.error("[COMPANY MOCK AI] Groq request failed:", err?.name);
    throw new Error("MOCK_AI_PROVIDER_ERROR");
  }
  clearTimeout(timer);

  if (!res.ok) {
    const status = res.status;
    let safeMsg = "MOCK_AI_PROVIDER_ERROR";
    if (status === 400) safeMsg = "MOCK_AI_INVALID_REQUEST";
    else if (status === 401) safeMsg = "MOCK_AI_INVALID_KEY";
    else if (status === 402) safeMsg = "MOCK_AI_INSUFFICIENT_CREDITS";
    else if (status === 403) safeMsg = "MOCK_AI_FORBIDDEN";
    else if (status === 404) safeMsg = "MOCK_AI_MODEL_NOT_FOUND";
    else if (status === 408) safeMsg = "MOCK_AI_REQUEST_TIMEOUT";
    else if (status === 429) safeMsg = "MOCK_AI_RATE_LIMITED";
    else if (status >= 500) safeMsg = "MOCK_AI_PROVIDER_ERROR";
    console.error("[COMPANY MOCK AI] Groq responded not-ok:", status, "errorType:", safeMsg);
    throw new Error(safeMsg);
  }

  const data = await res.json().catch(() => null);
  const text = data?.choices?.[0]?.message?.content || "";
  if (!text || !text.trim()) throw new Error("MOCK_AI_EMPTY_RESPONSE");
  return text;
}

/**
 * Generate text using the Company Mock API key.
 * Throws if MOCK_INTERVIEW_API_KEY is not configured.
 */
export async function mockAiGenerateText(prompt, { timeoutMs = DEFAULT_TIMEOUT_MS, temperature = 0.3 } = {}) {
  if (!isMockAIConfigured()) throw new Error("MOCK_AI_NOT_CONFIGURED");
  return mockGroqGenerate(prompt, { temperature, timeoutMs });
}

/**
 * Generate and parse JSON using the Company Mock API key.
 * Throws if MOCK_INTERVIEW_API_KEY is not configured.
 */
export async function mockAiGenerateJSON(prompt, opts = {}) {
  const text = await mockAiGenerateText(prompt, opts);
  const { parseAIJson } = await import("./aiResponseParser.js");
  try {
    return parseAIJson(text);
  } catch (e) {
    console.error("[COMPANY MOCK AI] JSON parse failed:", e.message);
    throw new Error("MOCK_AI_INVALID_RESPONSE");
  }
}
