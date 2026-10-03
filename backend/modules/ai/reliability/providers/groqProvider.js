import { BaseProvider } from "./baseProvider.js";
import { callPythonGroqBridge } from "../../../realInterview/ai/pythonGroqBridge.js";
import { normalizeProviderError } from "../utils/normalizeProviderError.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export class GroqProvider extends BaseProvider {
  constructor() {
    const defaultModel = (process.env.GROQ_MODEL || process.env.AI_MODEL || "openai/gpt-oss-120b").trim();
    super("groq", defaultModel);
  }

  async executeChatCompletion({ apiKey, model, messages, temperature = 0.2, maxTokens = 8192, timeoutMs = 60000, round = "unknown" }) {
    const activeModel = model || this.defaultModel;
    if (!apiKey) {
      return {
        success: false,
        text: null,
        parsedResponse: null,
        provider: "groq",
        model: activeModel,
        finishReason: null,
        retryable: false,
        rateLimited: false,
        authenticationError: true,
        quotaError: false,
        timeout: false,
        transientFailure: false,
        rawSafeError: "Groq API key is missing or not provided",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }

    try {
      // First attempt python bridge (preserves existing python subprocess setup)
      const rawText = await callPythonGroqBridge({
        round,
        apiKey,
        model: activeModel,
        messages,
        temperature,
        max_tokens: maxTokens,
        timeoutMs,
      });

      return {
        success: true,
        text: rawText,
        parsedResponse: null,
        provider: "groq",
        model: activeModel,
        finishReason: "stop",
        retryable: false,
        rateLimited: false,
        authenticationError: false,
        quotaError: false,
        timeout: false,
        transientFailure: false,
        rawSafeError: null,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    } catch (err) {
      // Direct HTTP fetch fallback if Python subprocess fails or is unavailable
      const normalized = normalizeProviderError(err);
      
      // If Python bridge failed for any reason (spawn error, network error, timeout, etc.),
      // attempt direct HTTP fetch as fallback
      const isPythonBridgeFailure =
        err.message && (
          err.message.includes("Failed to spawn Python process") ||
          err.message.includes("PythonAIBridge") ||
          err.message.includes("Python bridge") ||
          err.message.includes("Network error connecting to Groq") ||
          err.message.includes("forcibly closed") ||
          err.message.includes("wsasend") ||
          err.message.includes("WinError") ||
          err.message.includes("timed out") ||
          err.message.includes("empty output")
        );
      if (isPythonBridgeFailure) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);

          const body = {
            model: activeModel,
            messages,
            temperature,
            max_completion_tokens: maxTokens,
            response_format: { type: "json_object" },
          };

          const res = await fetch(GROQ_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
          clearTimeout(timer);

          if (res.ok) {
            const data = await res.json();
            const text = data?.choices?.[0]?.message?.content || "";
            return {
              success: true,
              text,
              parsedResponse: null,
              provider: "groq",
              model: activeModel,
              finishReason: data?.choices?.[0]?.finish_reason || "stop",
              retryable: false,
              rateLimited: false,
              authenticationError: false,
              quotaError: false,
              timeout: false,
              transientFailure: false,
              rawSafeError: null,
              usage: {
                promptTokens: data?.usage?.prompt_tokens || 0,
                completionTokens: data?.usage?.completion_tokens || 0,
                totalTokens: data?.usage?.total_tokens || 0,
              },
            };
          } else {
            let errDetail = `Groq HTTP ${res.status}`;
            let errCode = null;
            try {
              const errBody = await res.json();
              if (errBody?.error?.message) {
                errDetail = `Groq HTTP ${res.status}: ${errBody.error.message}`;
              }
              if (errBody?.error?.code) {
                errCode = errBody.error.code;
              }
            } catch (_) {
              const errText = await res.text().catch(() => "");
              if (errText) {
                errDetail = `Groq HTTP ${res.status}: ${errText.slice(0, 300)}`;
              }
            }
            console.error(`[GroqProvider] Provider error: ${errDetail} (code: ${errCode || "none"})`);
            const fetchErr = new Error(errDetail);
            fetchErr.status = res.status;
            fetchErr.code = errCode;
            const fetchNorm = normalizeProviderError(fetchErr);
            return {
              success: false,
              text: null,
              parsedResponse: null,
              provider: "groq",
              model: activeModel,
              finishReason: null,
              retryable: fetchNorm.transientFailure,
              rateLimited: fetchNorm.rateLimited,
              authenticationError: fetchNorm.authenticationError,
              quotaError: fetchNorm.quotaExceeded,
              timeout: fetchNorm.timeout,
              transientFailure: fetchNorm.transientFailure,
              rawSafeError: fetchNorm.rawSafeError,
              usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            };
          }
        } catch (fetchErr) {
          const finalNorm = normalizeProviderError(fetchErr);
          return {
            success: false,
            text: null,
            parsedResponse: null,
            provider: "groq",
            model: activeModel,
            finishReason: null,
            retryable: finalNorm.transientFailure,
            rateLimited: finalNorm.rateLimited,
            authenticationError: finalNorm.authenticationError,
            quotaError: finalNorm.quotaExceeded,
            timeout: finalNorm.timeout,
            transientFailure: finalNorm.transientFailure,
            rawSafeError: finalNorm.rawSafeError,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          };
        }
      }

      return {
        success: false,
        text: null,
        parsedResponse: null,
        provider: "groq",
        model: activeModel,
        finishReason: null,
        retryable: normalized.transientFailure,
        rateLimited: normalized.rateLimited,
        authenticationError: normalized.authenticationError,
        quotaError: normalized.quotaExceeded,
        timeout: normalized.timeout,
        transientFailure: normalized.transientFailure,
        rawSafeError: normalized.rawSafeError,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }
  }
}
