import User from "../../auth/models/User.js";
import { encryptSecret, decryptSecret, maskSecret } from "../../ai/reliability/utils/redactSecrets.js";
import { providerRegistry } from "../../ai/reliability/aiProviderRegistry.js";
import { sessionManager } from "../../ai/reliability/aiSessionManager.js";

const SUPPORTED_PROVIDERS = ["gemini", "groq", "openai", "deepseek", "openrouter"];

const PROVIDER_METADATA = {
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    defaultModel: "gemini-3.8-flash",
    description: "Generous free tier with ultra-fast responses and large context window.",
    docsUrl: "https://aistudio.google.com/app/apikey",
    keyPrefixHint: "AIzaSy... or AQ...",
    badge: "Free & Recommended",
  },
  groq: {
    id: "groq",
    name: "Groq",
    defaultModel: "openai/gpt-oss-120b",
    description: "Blazing fast LPU inference for Llama 3.3 and DeepSeek-R1-Distill.",
    docsUrl: "https://console.groq.com/keys",
    keyPrefixHint: "gsk_...",
    badge: "Ultra Fast",
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    defaultModel: "gpt-6",
    description: "Industry gold-standard intelligence and instruction precision.",
    docsUrl: "https://platform.openai.com/api-keys",
    keyPrefixHint: "sk-...",
    badge: "Industry Standard",
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    defaultModel: "deepseek-v4.1-flash",
    description: "High-reasoning V3 and R1 models with competitive pricing.",
    docsUrl: "https://platform.deepseek.com",
    keyPrefixHint: "sk-...",
    badge: "Deep Reasoning",
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    defaultModel: "openai/gpt-oss-120b",
    description: "Unified API gateway accessing dozens of open and proprietary models.",
    docsUrl: "https://openrouter.ai/keys",
    keyPrefixHint: "sk-or-v1-...",
    badge: "Multi-Model Router",
  },
};

/**
 * GET /api/student/api-keys
 * Returns student's configured providers (with masked keys only) and preferences.
 */
export const getStudentApiKeys = async (req, res) => {
  try {
    const student = await User.findById(req.user.id).select("apiKeys");
    if (!student) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const apiKeysConfig = student.apiKeys || {};
    const savedProviders = apiKeysConfig.providers || {};

    const providersResponse = {};
    for (const providerId of SUPPORTED_PROVIDERS) {
      const saved = savedProviders[providerId];
      const meta = PROVIDER_METADATA[providerId];

      providersResponse[providerId] = {
        id: providerId,
        name: meta.name,
        defaultModel: meta.defaultModel,
        description: meta.description,
        docsUrl: meta.docsUrl,
        keyPrefixHint: meta.keyPrefixHint,
        badge: meta.badge,
        isConfigured: Boolean(saved && saved.encryptedKey),
        maskedKey: saved ? saved.maskedKey || maskSecret(decryptSecret(saved.encryptedKey)) : null,
        status: saved?.status || "not_configured",
        lastTestedAt: saved?.lastTestedAt || null,
        updatedAt: saved?.updatedAt || null,
      };
    }

    res.json({
      success: true,
      data: {
        preferredProvider: apiKeysConfig.preferredProvider || "platform",
        useCustomKey: Boolean(apiKeysConfig.useCustomKey),
        providers: providersResponse,
      },
    });
  } catch (error) {
    console.error("[getStudentApiKeys] Error:", error.message);
    res.status(500).json({ success: false, message: "Failed to retrieve API key settings" });
  }
};

/**
 * POST /api/student/api-keys
 * Saves or updates an API key for a specific provider.
 */
export const saveStudentApiKey = async (req, res) => {
  try {
    const { provider, apiKey, setAsPreferred = true } = req.body;

    if (!provider || typeof provider !== "string") {
      return res.status(400).json({ success: false, message: "Valid provider ID is required" });
    }

    const normalizedProvider = provider.toLowerCase().trim();
    if (!SUPPORTED_PROVIDERS.includes(normalizedProvider)) {
      return res.status(400).json({
        success: false,
        message: `Unsupported provider '${provider}'. Supported: ${SUPPORTED_PROVIDERS.join(", ")}`,
      });
    }

    const trimmedKey = typeof apiKey === "string" ? apiKey.trim() : "";
    if (!trimmedKey || trimmedKey.length < 8) {
      return res.status(400).json({
        success: false,
        message: "API key must be a valid non-empty string of at least 8 characters",
      });
    }

    const student = await User.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!student.apiKeys) {
      student.apiKeys = {
        preferredProvider: "platform",
        useCustomKey: false,
        providers: {},
      };
    }

    if (!student.apiKeys.providers) {
      student.apiKeys.providers = {};
    }

    const encryptedKey = encryptSecret(trimmedKey);
    const maskedKey = maskSecret(trimmedKey);

    student.apiKeys.providers[normalizedProvider] = {
      encryptedKey,
      maskedKey,
      status: "configured",
      updatedAt: new Date(),
      lastTestedAt: null,
    };

    if (setAsPreferred) {
      student.apiKeys.preferredProvider = normalizedProvider;
      student.apiKeys.useCustomKey = true;
    }

    student.markModified("apiKeys");
    await student.save();

    res.json({
      success: true,
      message: `${PROVIDER_METADATA[normalizedProvider].name} API key saved successfully`,
      data: {
        provider: normalizedProvider,
        maskedKey,
        preferredProvider: student.apiKeys.preferredProvider,
        useCustomKey: student.apiKeys.useCustomKey,
      },
    });
  } catch (error) {
    console.error("[saveStudentApiKey] Error:", error.message);
    res.status(500).json({ success: false, message: "Failed to save API key" });
  }
};

/**
 * DELETE /api/student/api-keys/:provider
 * Deletes a configured API key for a specific provider.
 */
export const deleteStudentApiKey = async (req, res) => {
  try {
    const { provider } = req.params;
    const normalizedProvider = (provider || "").toLowerCase().trim();

    const student = await User.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (student.apiKeys && student.apiKeys.providers && student.apiKeys.providers[normalizedProvider]) {
      delete student.apiKeys.providers[normalizedProvider];

      // If the removed provider was the preferred one, fall back to platform or another configured provider
      if (student.apiKeys.preferredProvider === normalizedProvider) {
        const remainingProviders = Object.keys(student.apiKeys.providers || {});
        if (remainingProviders.length > 0) {
          student.apiKeys.preferredProvider = remainingProviders[0];
        } else {
          student.apiKeys.preferredProvider = "platform";
          student.apiKeys.useCustomKey = false;
        }
      }

      student.markModified("apiKeys");
      await student.save();
    }

    res.json({
      success: true,
      message: `API key for ${provider} removed successfully`,
      data: {
        preferredProvider: student.apiKeys?.preferredProvider || "platform",
        useCustomKey: Boolean(student.apiKeys?.useCustomKey),
      },
    });
  } catch (error) {
    console.error("[deleteStudentApiKey] Error:", error.message);
    res.status(500).json({ success: false, message: "Failed to delete API key" });
  }
};

/**
 * PUT /api/student/api-keys/preference
 * Updates preferred provider and custom key toggle.
 */
export const updateStudentApiKeyPreference = async (req, res) => {
  try {
    const { preferredProvider, useCustomKey } = req.body;

    const student = await User.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!student.apiKeys) {
      student.apiKeys = {
        preferredProvider: "platform",
        useCustomKey: false,
        providers: {},
      };
    }

    if (preferredProvider !== undefined) {
      const normalized = String(preferredProvider).toLowerCase().trim();
      if (normalized === "platform" || SUPPORTED_PROVIDERS.includes(normalized)) {
        student.apiKeys.preferredProvider = normalized;
      }
    }

    if (useCustomKey !== undefined) {
      student.apiKeys.useCustomKey = Boolean(useCustomKey);
    }

    student.markModified("apiKeys");
    await student.save();

    res.json({
      success: true,
      message: "Preferences updated",
      data: {
        preferredProvider: student.apiKeys.preferredProvider,
        useCustomKey: student.apiKeys.useCustomKey,
      },
    });
  } catch (error) {
    console.error("[updateStudentApiKeyPreference] Error:", error.message);
    res.status(500).json({ success: false, message: "Failed to update preferences" });
  }
};

/**
 * POST /api/student/api-keys/test
 * Tests the connection of an API key against the provider.
 * Can test either a raw key (passed in body) or an existing saved key from DB.
 */
export const testStudentApiKey = async (req, res) => {
  try {
    const { provider, apiKey } = req.body;

    if (!provider) {
      return res.status(400).json({ success: false, message: "Provider is required" });
    }

    const normalizedProvider = String(provider).toLowerCase().trim();
    if (!SUPPORTED_PROVIDERS.includes(normalizedProvider)) {
      return res.status(400).json({
        success: false,
        message: `Unsupported provider: ${provider}`,
      });
    }

    let keyToTest = typeof apiKey === "string" ? apiKey.trim() : "";

    // If key not supplied directly, fetch from user's encrypted record
    let student = null;
    if (!keyToTest) {
      student = await User.findById(req.user.id);
      const saved = student?.apiKeys?.providers?.[normalizedProvider];
      if (saved && saved.encryptedKey) {
        keyToTest = decryptSecret(saved.encryptedKey);
      }
    }

    if (!keyToTest) {
      return res.status(400).json({
        success: false,
        message: `No API key found for ${PROVIDER_METADATA[normalizedProvider].name} to test. Please enter a key.`,
      });
    }

    const adapter = providerRegistry.getProvider(normalizedProvider);
    const startMs = Date.now();

    // Send a lightweight test request
    const testMessages = [
      {
        role: "user",
        content: "Echo test: reply with 'OK' only.",
      },
    ];

    const result = await adapter.executeChatCompletion({
      apiKey: keyToTest,
      messages: testMessages,
      timeoutMs: 15000,
      temperature: 0.1,
      maxTokens: 50,
      round: "ping-test",
    });

    const latencyMs = Date.now() - startMs;

    if (result && result.success) {
      // If student has saved this key in DB, mark status as verified
      if (!student) {
        student = await User.findById(req.user.id);
      }

      if (student?.apiKeys?.providers?.[normalizedProvider]) {
        student.apiKeys.providers[normalizedProvider].status = "verified";
        student.apiKeys.providers[normalizedProvider].lastTestedAt = new Date();
        student.markModified("apiKeys");
        await student.save();
      }

      return res.json({
        success: true,
        message: `Connection to ${PROVIDER_METADATA[normalizedProvider].name} verified successfully!`,
        data: {
          provider: normalizedProvider,
          latencyMs,
          model: result.model || adapter.defaultModel,
          status: "verified",
        },
      });
    } else {
      const errorMsg = result?.rawSafeError || "Failed to authenticate with provider. Please check the key.";
      return res.status(400).json({
        success: false,
        message: errorMsg,
        data: {
          provider: normalizedProvider,
          latencyMs,
          status: "error",
        },
      });
    }
  } catch (error) {
    console.error("[testStudentApiKey] Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to test API key connection",
    });
  }
};
