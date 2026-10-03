import { BaseProvider } from "./baseProvider.js";
import { normalizeProviderError } from "../utils/normalizeProviderError.js";

/**
 * Gemini Provider implementing executeChatCompletion.
 */
export class GeminiProvider extends BaseProvider {
  constructor() {
    super("gemini", "gemini-2.0-flash");
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

    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    const systemInstruction = systemMessages.length > 0
      ? { parts: systemMessages.map((m) => ({ text: m.content })) }
      : undefined;

    const contents = (nonSystemMessages.length > 0 ? nonSystemMessages : messages).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const body = {
      ...(systemInstruction ? { systemInstruction } : {}),
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
            status: 200,
            statusCode: 200,
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

        if (!hasText) {
          return {
            success: false,
            text: null,
            parsedResponse: null,
            provider: "gemini",
            model: activeModel,
            finishReason,
            category: finishReason === "MAX_TOKENS" ? "AI_TRUNCATED_JSON" : "AI_EMPTY_RESPONSE",
            status: 200,
            statusCode: 200,
            retryable: true,
            rateLimited: false,
            authenticationError: false,
            quotaError: false,
            timeout: false,
            transientFailure: true,
            rawSafeError: finishReason === "MAX_TOKENS" ? "Response truncated with no text generated" : "Gemini returned empty response",
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
          status: 200,
          statusCode: 200,
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
        let errMessage = `Gemini HTTP ${res.status}`;
        let errDetails = null;
        try {
          const errData = await res.json();
          if (errData?.error?.message) {
            errMessage = `Gemini HTTP ${res.status}: ${errData.error.message}`;
            errDetails = errData.error;
          }
        } catch {
          // ignore json parse failure on non-json error responses
        }

        // Safe raw error logging without logging any API keys
        console.error(`[RAW-GEMINI-ERROR] status=${res.status} message=${errMessage}`);

        const err = new Error(errMessage);
        err.status = res.status;
        err.statusCode = res.status;
        err.details = errDetails;
        const norm = normalizeProviderError(err);
        let category = "AI_PROVIDER_UNKNOWN";
        if (norm.rateLimited) category = "AI_PROVIDER_RATE_LIMIT";
        else if (norm.authenticationError) category = "INVALID_AUTH";
        else if (norm.quotaExceeded) category = "PERMANENT_QUOTA";
        else if (norm.modelUnavailable) category = "MODEL_NOT_FOUND";

        return {
          success: false,
          text: null,
          parsedResponse: null,
          provider: "gemini",
          model: activeModel,
          finishReason: null,
          category,
          status: res.status,
          statusCode: res.status,
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
      console.error(`[RAW-GEMINI-ERROR] status=${norm.status || 0} message=${norm.rawSafeError}`);
      return {
        success: false,
        text: null,
        parsedResponse: null,
        provider: "gemini",
        model: activeModel,
        finishReason: null,
        category: norm.authenticationError ? "INVALID_AUTH" : (norm.rateLimited ? "AI_PROVIDER_RATE_LIMIT" : "AI_PROVIDER_UNKNOWN"),
        status: norm.status || 0,
        statusCode: norm.status || 0,
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
