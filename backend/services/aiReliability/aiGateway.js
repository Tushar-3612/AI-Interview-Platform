import { providerRegistry } from "./aiProviderRegistry.js";
import { circuitBreaker } from "./aiCircuitBreaker.js";
import { requestDeduplicator } from "./aiRequestDeduplicator.js";
import { AIRetryPolicy } from "./aiRetryPolicy.js";
import { AIContextOptimizer } from "./aiContextOptimizer.js";
import { AIJsonRepair } from "./aiJsonRepair.js";
import { AIResponseValidator } from "./aiResponseValidator.js";
import { sessionManager } from "./aiSessionManager.js";
import { safeLogger } from "./utils/safeLogger.js";
import { createRequestFingerprint } from "./utils/requestFingerprint.js";

/**
 * Resolves appropriate model for given provider to avoid provider/model mismatch.
 */
export function resolveProviderModel(providerName, requestedModel) {
  const p = String(providerName).toLowerCase().trim();
  const providerDefaultModels = {
    groq: "llama-3.3-70b-versatile",
    gemini: "gemini-2.5-flash",
    openrouter: "meta-llama/llama-3.3-70b-instruct",
    deepseek: "deepseek-chat",
    openai: "gpt-4o-mini"
  };

  if (!requestedModel || typeof requestedModel !== "string") {
    return providerDefaultModels[p] || "llama-3.3-70b-versatile";
  }

  const isGroqModel = requestedModel.includes("gpt-oss") || requestedModel.includes("llama") || requestedModel.includes("groq");
  if (p === "gemini" && (isGroqModel || !requestedModel.includes("gemini"))) {
    return "gemini-2.5-flash";
  }
  if (p === "deepseek" && (isGroqModel || !requestedModel.includes("deepseek"))) {
    return "deepseek-chat";
  }
  if (p === "openai" && (isGroqModel || !requestedModel.includes("gpt"))) {
    return "gpt-4o-mini";
  }
  if (p === "openrouter" && isGroqModel && !requestedModel.includes("/")) {
    return "meta-llama/llama-3.3-70b-instruct";
  }

  return requestedModel;
}

/**
 * Central AI Gateway coordinating request reliability, BYOK keys, retries, deduplication,
 * circuit breaker, and JSON repair.
 */
export class AIGateway {
  static resolveProviderModel(providerName, requestedModel) {
    return resolveProviderModel(providerName, requestedModel);
  }

  /**
   * Main completion method.
   * Provider resolution priority: session BYOK binding > request provider > platform provider (PLATFORM mode).
   */
  static async execute({
    prompt,
    systemPrompt = "",
    provider,
    apiKey,
    sessionId,
    roundType = "general",
    orderIndex,
    options = {}
  }) {
    let mode = "PLATFORM";
    let activeProviderName = provider;
    let activeApiKey = apiKey;
    let keySource = "PLATFORM_ENV";
    let fallbackAllowed = true;

    // 1. Check Session BYOK Binding (Highest Priority)
    if (sessionId) {
      const sessionBYOK = sessionManager.getSessionBYOK(sessionId);
      if (sessionBYOK && sessionBYOK.apiKey) {
        mode = "BYOK";
        activeProviderName = sessionBYOK.providerName;
        activeApiKey = sessionBYOK.apiKey;
        keySource = "BYOK_SESSION";
        fallbackAllowed = false; // Never fall back to Groq/platform key when session BYOK is active!
      }
    }

    // 2. Check Direct Request Key (Second Priority)
    if (mode !== "BYOK" && apiKey && typeof apiKey === "string" && apiKey.trim() !== "") {
      mode = "BYOK";
      activeProviderName = provider || "groq";
      activeApiKey = apiKey.trim();
      keySource = "BYOK_REQUEST";
      fallbackAllowed = false;
    }

    // 3. Fallback to Platform Provider only if PLATFORM mode
    if (mode === "PLATFORM") {
      activeProviderName = (provider || "groq").toLowerCase().trim();
      keySource = "PLATFORM_ENV";
      fallbackAllowed = true;
    }

    activeProviderName = String(activeProviderName).toLowerCase().trim();

    // Diagnostic Log
    console.log(`\n[AI-PROVIDER-RESOLUTION]\nsessionId=${sessionId || "none"}\nmode=${mode}\nrequestedProvider=${provider || "none"}\nresolvedProvider=${activeProviderName}\nkeySource=${keySource}\nfallbackAllowed=${fallbackAllowed}`);

    // Resolve Provider-Specific Model
    const resolvedModel = resolveProviderModel(activeProviderName, options.model);
    const activeOptions = { ...options, model: resolvedModel, fallbackAllowed };

    // 4. Build fingerprint for deduplication
    const fingerprint = createRequestFingerprint({
      sessionId,
      roundType,
      orderIndex,
      prompt,
      provider: activeProviderName
    });

    // 5. Execute via Deduplicator
    return await requestDeduplicator.deduplicate(
      fingerprint,
      { dbCheckFn: activeOptions.dbCheckFn },
      async () => {
        // 6. Check Circuit Breaker
        circuitBreaker.canExecute(activeProviderName);

        const providerAdapter = providerRegistry.getProvider(activeProviderName);

        // 7. Execute with Retry Policy
        try {
          const parsedResult = await AIRetryPolicy.execute(
            async (attempt, retryCtx) => {
              // 8. Context Optimization
              const { prompt: optPrompt, systemPrompt: optSystem } = AIContextOptimizer.optimizePrompt({
                prompt,
                systemPrompt,
                roundType,
                isRetry: retryCtx.isRetry
              });

              safeLogger.info(`[AIGateway] Executing request via provider [${activeProviderName}] model [${resolvedModel}] for ${roundType} Q${orderIndex || "N/A"}`);

              // 9. Call Provider Adapter
              const rawCompletion = await providerAdapter.generateCompletion({
                prompt: optPrompt,
                systemPrompt: optSystem,
                options: activeOptions,
                apiKey: activeApiKey
              });

              // 10. JSON Repair
              const parsedJSON = AIJsonRepair.parseAndRepair(rawCompletion);

              // 11. Response Validation
              AIResponseValidator.validate(parsedJSON, roundType);

              return parsedJSON;
            },
            {
              maxRetries: activeOptions.maxRetries ?? 3,
              providerName: activeProviderName,
              onContextTooLarge: () => {
                safeLogger.warn(`[AIGateway] CONTEXT_TOO_LARGE trigger for ${roundType}`);
              }
            }
          );

          circuitBreaker.recordSuccess(activeProviderName);
          return parsedResult;
        } catch (err) {
          circuitBreaker.recordFailure(activeProviderName, err.category);
          throw err;
        }
      }
    );
  }
}

export default AIGateway;
