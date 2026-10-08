import api from "../../../core/api/api.js";
import { getAuthToken } from "../hooks/useStudentProfile.js";

/**
 * Service to manage student API keys (Bring Your Own Key) on the platform.
 */

const getHeaders = () => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Fetch all configured API keys and preferences for the current student.
 */
export async function fetchStudentApiKeys() {
  const { data } = await api.get("/api/student/api-keys", {
    headers: getHeaders(),
  });
  return data?.data || data;
}

/**
 * Save or update an API key for a specific AI provider.
 * @param {Object} params
 * @param {string} params.provider Provider id ('gemini', 'groq', 'openai', 'deepseek', 'openrouter')
 * @param {string} params.apiKey Raw API key string
 * @param {boolean} [params.setAsPreferred=true] Whether to set this provider as preferred
 */
export async function saveStudentApiKey({ provider, apiKey, setAsPreferred = true }) {
  const { data } = await api.post(
    "/api/student/api-keys",
    { provider, apiKey, setAsPreferred },
    { headers: getHeaders() }
  );

  // Sync with sessionStorage so legacy/active session components pick it up immediately
  if (apiKey && apiKey.trim()) {
    sessionStorage.setItem("byok_provider", provider);
    sessionStorage.setItem("byok_api_key", apiKey.trim());
  }

  // Broadcast event so any active interview tabs or modals update instantly
  window.dispatchEvent(
    new CustomEvent("byok-updated", {
      detail: { provider, hasKey: true },
    })
  );

  return data;
}

/**
 * Delete a configured API key for a provider.
 * @param {string} provider
 */
export async function deleteStudentApiKey(provider) {
  const { data } = await api.delete(`/api/student/api-keys/${provider}`, {
    headers: getHeaders(),
  });

  const activeProvider = sessionStorage.getItem("byok_provider");
  if (activeProvider === provider) {
    sessionStorage.removeItem("byok_provider");
    sessionStorage.removeItem("byok_api_key");
  }

  window.dispatchEvent(
    new CustomEvent("byok-updated", {
      detail: { provider, hasKey: false },
    })
  );

  return data;
}

/**
 * Update general API key preferences (e.g. switch between platform vs custom key, or change default provider).
 * @param {Object} params
 * @param {string} params.preferredProvider
 * @param {boolean} params.useCustomKey
 */
export async function updateStudentApiKeyPreference({ preferredProvider, useCustomKey }) {
  const { data } = await api.put(
    "/api/student/api-keys/preference",
    { preferredProvider, useCustomKey },
    { headers: getHeaders() }
  );
  return data;
}

/**
 * Test connectivity for an API key against the provider.
 * @param {Object} params
 * @param {string} params.provider
 * @param {string} [params.apiKey] Optional unsaved key. If omitted, tests the saved key in DB.
 */
export async function testStudentApiKeyConnection({ provider, apiKey }) {
  const { data } = await api.post(
    "/api/student/api-keys/test",
    { provider, apiKey },
    { headers: getHeaders() }
  );
  return data;
}
