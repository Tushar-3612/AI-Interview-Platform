import { BaseProvider } from "./baseProvider.js";
import { normalizeProviderError } from "../utils/normalizeProviderError.js";

/**
 * Gemini Provider implementing executeChatCompletion.
 */
export class GeminiProvider extends BaseProvider {
  constructor() {
    super("gemini", "gemini-2.5-flash");
  }

  async executeChatCompletion({ apiKey, model, messages, temperature = 0.3, maxTokens = 8192, timeoutMs = 45000 }) {
    const activeModel = model || this.defaultModel;
    let keyToUse;
    try {
      keyToUse = this.resolveApiKey(apiKey);
    } catch (keyErr) {
      return {
        success: false,
        text: null,
        parsedResponse: null,
        provider: "gemini",
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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${encodeURIComponent(keyToUse)}`;

    const contents = messages.map((m) => ({
      role: m.role === "system" ? "user" : (m.role === "assistant" ? "model" : "user"),
      parts: [{ text: m.role === "system" ? `SYSTEM: ${m.content}` : m.content }]
    }));

    const body = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: "application/json"
      }
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        const candidate = data.candidates?.[0];
        const finishReason = candidate?.finishReason || null;
        const candidateCount = data.candidates?.length || 0;
        const blockReason = data.promptFeedback?.blockReason || null;
        const text = candidate?.content?.parts?.[0]?.text || "";
        const hasText = Boolean(text && text.trim().length > 0);
        const textLength = text.length;

        const usageMetadata = data.usageMetadata || {};
        const promptTokens = usageMetadata.promptTokenCount || 0;
        const completionTokens = usageMetadata.candidatesTokenCount || 0;
        const totalTokens = usageMetadata.totalTokenCount || 0;

        console.log(`[GEMINI-DIAGNOSTICS] finishReason=${finishReason} candidates=${candidateCount} blockReason=${blockReason} hasText=${hasText} textLength=${textLength} promptTokens=${promptTokens} completionTokens=${completionTokens} totalTokens=${totalTokens}`);

        if (finishReason === "SAFETY" || blockReason) {
          return {
            success: false,
            text: null,
            parsedResponse: null,
            provider: "gemini",
            model: activeModel,
            finishReason,
            category: "AI_SAFETY_BLOCKED",
            retryable: false,
            rateLimited: false,
            authenticationError: false,
            quotaError: false,
            timeout: false,
            transientFailure: false,
            rawSafeError: "Provider safety filter blocked content",
            usage: { promptTokens, completionTokens, totalTokens },
          };
        }

        if (finishReason === "MAX_TOKENS") {
          return {
            success: false,
            text: text || null,
            parsedResponse: null,
            provider: "gemini",
            model: activeModel,
            finishReason,
            category: "AI_TRUNCATED_JSON",
            retryable: true,
            rateLimited: false,
            authenticationError: false,
            quotaError: false,
            timeout: false,
            transientFailure: false,
            rawSafeError: "Response truncated: MAX_TOKENS limit reached",
            usage: { promptTokens, completionTokens, totalTokens },
          };
        }

        if (!hasText) {
          return {
            success: false,
            text: null,
            parsedResponse: null,
            provider: "gemini",
            model: activeModel,
            finishReason,
            category: "AI_EMPTY_RESPONSE",
            retryable: true,
            rateLimited: false,
            authenticationError: false,
            quotaError: false,
            timeout: false,
            transientFailure: true,
            rawSafeError: "Gemini returned empty response",
            usage: { promptTokens, completionTokens, totalTokens },
          };
        }

        return {
          success: true,
          text,
          parsedResponse: null,
          provider: "gemini",
          model: activeModel,
          finishReason: finishReason || "STOP",
          retryable: false,
          rateLimited: false,
          authenticationError: false,
          quotaError: false,
          timeout: false,
          transientFailure: false,
          rawSafeError: null,
          usage: { promptTokens, completionTokens, totalTokens },
        };
      } else {
        const err = new Error(`Gemini HTTP ${res.status}`);
        err.status = res.status;
        const norm = normalizeProviderError(err);
        let category = "AI_PROVIDER_UNKNOWN";
        if (norm.rateLimited) category = "AI_PROVIDER_RATE_LIMIT";
        else if (norm.authenticationError) category = "AI_PROVIDER_AUTH_ERROR";
        else if (norm.quotaExceeded) category = "PERMANENT_QUOTA";

        return {
          success: false,
          text: null,
          parsedResponse: null,
          provider: "gemini",
          model: activeModel,
          finishReason: null,
          category,
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
        provider: "gemini",
        model: activeModel,
        finishReason: null,
        category: "AI_PROVIDER_UNKNOWN",
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
