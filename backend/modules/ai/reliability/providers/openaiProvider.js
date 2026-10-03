import { BaseProvider } from "./baseProvider.js";
import { normalizeProviderError } from "../utils/normalizeProviderError.js";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

/**
 * OpenAI Provider implementing executeChatCompletion.
 */
export class OpenAIProvider extends BaseProvider {
  constructor() {
    super("openai", "gpt-4o-mini");
  }

  async executeChatCompletion({ apiKey, model, messages, temperature = 0.3, maxTokens = 4000, timeoutMs = 45000 }) {
    const activeModel = model || this.defaultModel;
    let keyToUse;
    try {
      keyToUse = this.resolveApiKey(apiKey);
    } catch (keyErr) {
      return {
        success: false,
        text: null,
        parsedResponse: null,
        provider: "openai",
        model: activeModel,
        finishReason: null,
        retryable: false,
        rateLimited: false,
        authenticationError: true,
        quotaError: false,
        timeout: false,
        transientFailure: false,
        rawSafeError: keyErr.message,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${keyToUse}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: activeModel,
          messages,
          temperature,
          max_tokens: maxTokens,
          response_format: { type: "json_object" }
        }),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content || "";
        return {
          success: true,
          text,
          parsedResponse: null,
          provider: "openai",
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
        const err = new Error(`OpenAI HTTP ${res.status}`);
        err.status = res.status;
        const norm = normalizeProviderError(err);
        return {
          success: false,
          text: null,
          parsedResponse: null,
          provider: "openai",
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
        provider: "openai",
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
