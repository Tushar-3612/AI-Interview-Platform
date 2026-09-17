import { BaseProvider } from "./baseProvider.js";
import { callPythonGroqBridge } from "../../realInterviewAI/pythonGroqBridge.js";
import { normalizeProviderError } from "../utils/normalizeProviderError.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export class GroqProvider extends BaseProvider {
  constructor() {
    super("groq", "llama-3.3-70b-versatile");
  }

  async executeChatCompletion({ apiKey, model, messages, temperature = 0.2, maxTokens = 4000, timeoutMs = 60000, round = "unknown" }) {
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
      
      // If error was Python-bridge specific, attempt direct HTTP fetch fallback
      if (err.message && err.message.includes("Failed to spawn Python process")) {
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
            const fetchErr = new Error(`Groq HTTP ${res.status}`);
            fetchErr.status = res.status;
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
