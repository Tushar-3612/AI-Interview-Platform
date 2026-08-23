import dotenv from "dotenv";

dotenv.config();

/**
 * Centralized AI client — Groq ONLY.
 *
 * Environment (backend/.env, never frontend):
 *   AI_PROVIDER   - must be "groq" (Groq is the only supported provider)
 *   AI_API_KEY    - Groq API key (starts with gsk_)
 *   AI_MODEL      - Groq model id, e.g. "openai/gpt-oss-120b"
 *
 * All AI traffic flows through this file. The API key is NEVER returned in
 * any response, log, or error message.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

let cachedClient = null;

const DEFAULT_TIMEOUT_MS = 120000;

export function getProvider() {
  return "groq";
}

export function getApiKey() {
  return (process.env.AI_API_KEY || "").trim();
}

export function getModel() {
  return (process.env.AI_MODEL || "llama-3.3-70b-versatile").trim();
}

/** True only when a usable, real key is configured. */
export function isAIConfigured() {
  const key = getApiKey();
  if (!key) return false;
  if (/mock/i.test(key)) return false;
  return true;
}

function safeErrorMessage(err) {
  const msg = err?.message || "";
  if (/timeout/i.test(msg)) return "AI_REQUEST_TIMEOUT";
  if (/AI_INVALID_KEY|401/.test(msg)) return "AI_INVALID_KEY";
  if (/AI_INSUFFICIENT_CREDITS|402/.test(msg)) return "AI_INSUFFICIENT_CREDITS";
  if (/AI_FORBIDDEN|403/.test(msg)) return "AI_FORBIDDEN";
  if (/AI_MODEL_NOT_FOUND|404/.test(msg)) return "AI_MODEL_NOT_FOUND";
  if (/AI_RATE_LIMITED|429/.test(msg)) return "AI_RATE_LIMITED";
  return "AI_PROVIDER_ERROR";
}

async function groqGenerate(prompt, { temperature = 0.7, timeoutMs = DEFAULT_TIMEOUT_MS, maxTokens = 4096 } = {}) {
  const key = getApiKey();
  if (!key) throw new Error("AI_NOT_CONFIGURED");

  const model = getModel();
  const body = {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature,
    max_completion_tokens: maxTokens,
    // Force the provider to return valid, parseable JSON for our question schema.
    response_format: { type: "json_object" },
  };

  // Reasoning models (gpt-oss, deepseek-r1) consume completion budget on hidden
  // reasoning tokens; keep it low so the actual JSON output isn't truncated.
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
    if (err?.name === "AbortError") throw new Error("AI_REQUEST_TIMEOUT");
    console.error("[AI] Groq request failed:", err?.name);
    throw new Error("AI_PROVIDER_ERROR");
  }
  clearTimeout(timer);

  if (!res.ok) {
    const status = res.status;
    let safeMsg = "AI_PROVIDER_ERROR";
    if (status === 400) safeMsg = "AI_INVALID_REQUEST";
    else if (status === 401) safeMsg = "AI_INVALID_KEY";
    else if (status === 402) safeMsg = "AI_INSUFFICIENT_CREDITS";
    else if (status === 403) safeMsg = "AI_FORBIDDEN";
    else if (status === 404) safeMsg = "AI_MODEL_NOT_FOUND";
    else if (status === 408) safeMsg = "AI_REQUEST_TIMEOUT";
    else if (status === 429) safeMsg = "AI_RATE_LIMITED";
    else if (status >= 500) safeMsg = "AI_PROVIDER_ERROR";
    // Do NOT read/echo the response body (could contain sensitive data).
    console.error("[AI] Groq responded not-ok:", status, "errorType:", safeMsg);
    throw new Error(safeMsg);
  }

  const data = await res.json().catch(() => null);
  const text = data?.choices?.[0]?.message?.content || "";
  if (!text || !text.trim()) throw new Error("AI_EMPTY_RESPONSE");
  return text;
}

export async function aiGenerateText(prompt, { timeoutMs = DEFAULT_TIMEOUT_MS, temperature = 0.7 } = {}) {
  if (!isAIConfigured()) throw new Error("AI_NOT_CONFIGURED");
  return groqGenerate(prompt, { temperature, timeoutMs });
}

export async function aiGenerateJSON(prompt, opts = {}) {
  const text = await aiGenerateText(prompt, opts);
  const { parseAIJson } = await import("./aiResponseParser.js");
  try {
    return parseAIJson(text);
  } catch (e) {
    console.error("[AI] JSON parse failed:", e.message);
    throw new Error("AI_INVALID_RESPONSE");
  }
}

/**
 * Backend-only connectivity check. Never returns the API key.
 */
export async function checkAIConnectivity() {
  const configured = isAIConfigured();
  const result = { configured, provider: "groq", model: getModel(), working: false };
  if (!configured) return result;
  try {
    const text = await aiGenerateText("Reply with exactly the single word: OK", {
      temperature: 0,
      timeoutMs: 15000,
    });
    result.working = !!text && text.trim().length > 0;
  } catch (err) {
    result.working = false;
    result.error = safeErrorMessage(err);
  }
  return result;
}

/**
 * Compatibility shim for legacy callers that expect a Gemini-shaped client
 * (client.models.generateContent). Adapts the call to Groq chat completions.
 */
export function getAIClient() {
  if (cachedClient) return cachedClient;
  cachedClient = {
    models: {
      generateContent: async ({ contents, config } = {}) => {
        const prompt = Array.isArray(contents)
          ? contents
              .map((c) => (c && c.text ? c.text : ""))
              .filter(Boolean)
              .join("\n")
          : (contents?.text || String(contents || ""));
        const text = await groqGenerate(prompt, { temperature: config?.temperature ?? 0.7 });
        return { text };
      },
    },
  };
  return cachedClient;
}
