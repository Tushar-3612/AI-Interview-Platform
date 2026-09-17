/**
 * Abstract Base Provider establishing standard provider interface.
 */
export class BaseProvider {
  constructor(name, defaultModel) {
    this.name = name;
    this.defaultModel = defaultModel;
  }

  resolveApiKey(passedKey) {
    if (passedKey && typeof passedKey === "string" && passedKey.trim() !== "") {
      return passedKey.trim();
    }
    const envVarMap = {
      groq: "GROQ_API_KEY",
      openrouter: "OPENROUTER_API_KEY",
      gemini: "GEMINI_API_KEY",
      deepseek: "DEEPSEEK_API_KEY",
      openai: "OPENAI_API_KEY"
    };
    const envVar = envVarMap[this.name];
    if (envVar && process.env[envVar]) {
      return process.env[envVar].trim();
    }
    throw new Error(`API key for provider '${this.name}' is missing and not found in environment variable '${envVar}'`);
  }

  async generateCompletion({ prompt, systemPrompt, options = {}, apiKey }) {
    const messages = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const result = await this.executeChatCompletion({
      apiKey: apiKey || this.resolveApiKey(apiKey),
      model: options.model || this.defaultModel,
      messages,
      temperature: options.temperature ?? 0.3,
      maxTokens: options.maxOutputTokens || options.maxTokens || 4000,
      timeoutMs: options.timeoutMs || 45000,
      round: options.round || "unknown"
    });

    if (!result.success) {
      const err = new Error(result.rawSafeError || `${this.name} completion failed`);
      err.status = result.rateLimited ? 429 : (result.authenticationError ? 401 : (result.quotaError ? 402 : (result.timeout ? 408 : 500)));
      err.retryable = result.retryable;
      throw err;
    }

    return result.text;
  }

  async executeChatCompletion({ apiKey, model, messages, temperature = 0.2, maxTokens = 4000, timeoutMs = 60000, round = "unknown" }) {
    throw new Error(`executeChatCompletion not implemented for provider ${this.name}`);
  }
}

export class BaseAIProvider extends BaseProvider {}
export default BaseProvider;
