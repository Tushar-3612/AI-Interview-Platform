import { GroqProvider } from "./providers/groqProvider.js";
import { OpenRouterProvider } from "./providers/openrouterProvider.js";
import { GeminiProvider } from "./providers/geminiProvider.js";
import { DeepSeekProvider } from "./providers/deepseekProvider.js";
import { OpenAIProvider } from "./providers/openaiProvider.js";

/**
 * Provider Registry holding instances of supported AI Providers.
 */
class AIProviderRegistry {
  constructor() {
    this.providers = new Map();

    const groq = new GroqProvider();
    const openrouter = new OpenRouterProvider();
    const gemini = new GeminiProvider();
    const deepseek = new DeepSeekProvider();
    const openai = new OpenAIProvider();

    this.providers.set("groq", groq);
    this.providers.set("openrouter", openrouter);
    this.providers.set("gemini", gemini);
    this.providers.set("deepseek", deepseek);
    this.providers.set("openai", openai);
  }

  getProvider(providerName = "groq") {
    const normalized = String(providerName).toLowerCase().trim();
    const provider = this.providers.get(normalized);

    if (!provider) {
      throw new Error(`Unsupported AI Provider: '${providerName}'. Available: ${Array.from(this.providers.keys()).join(", ")}`);
    }

    return provider;
  }

  registerCustomProvider(name, providerInstance) {
    this.providers.set(String(name).toLowerCase().trim(), providerInstance);
  }

  hasProvider(name) {
    return this.providers.has(String(name).toLowerCase().trim());
  }

  getSupportedProviders() {
    return Array.from(this.providers.keys());
  }
}

export const providerRegistry = new AIProviderRegistry();
export default providerRegistry;
