import { BaseProvider } from "./baseProvider.js";
import { normalizeProviderError } from "../utils/normalizeProviderError.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export class OpenRouterProvider extends BaseProvider {
  constructor() {
    super("openrouter", "meta-llama/llama-3.3-70b-instruct");
  }

  async executeChatCompletion({ apiKey, model, messages, temperature = 0.2, maxTokens = 4000, timeoutMs = 60000 }) {
    const activeModel = model || this.defaultModel;
    if (!apiKey) {
      return {
        success: false,
        text: null,
        parsedResponse: null,
        provider: "openrouter",
        model: activeModel,
        finishReason: null,
        retryable: false,
        rateLimited: false,
        authenticationError: true,
        quotaError: false,
        timeout: false,
        transientFailure: false,
        rawSafeError: "OpenRouter API key is missing or not provided",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://ai-interview-platform.local",
          "X-Title": "AI Interview Platform",
        },
        body: JSON.stringify({
          model: activeModel,
          messages,
          temperature,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
        }),
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
          provider: "openrouter",
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
        const err = new Error(`OpenRouter HTTP ${res.status}`);
        err.status = res.status;
        const norm = normalizeProviderError(err);
        return {
          success: false,
          text: null,
          parsedResponse: null,
          provider: "openrouter",
          model: activeModel,
          finishReason: null,
          retryable: norm.transientFailure,
          rateLimited: norm.rateLimited,
          authenticationError: norm.authenticationError,
          quotaError: norm.quotaExceeded,
          timeout: norm.timeout,
          transientFailure: norm.transientFailure,
          rawSafeError: norm.rawSafeError,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        };
      }
    } catch (err) {
      clearTimeout(timer);
      const norm = normalizeProviderError(err);
      return {
        success: false,
        text: null,
        parsedResponse: null,
        provider: "openrouter",
        model: activeModel,
        finishReason: null,
        retryable: norm.transientFailure,
        rateLimited: norm.rateLimited,
        authenticationError: norm.authenticationError,
        quotaError: norm.quotaExceeded,
        timeout: norm.timeout,
        transientFailure: norm.transientFailure,
        rawSafeError: norm.rawSafeError,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }
  }
}
