import dotenv from "dotenv";

dotenv.config();

/**
 * Accenture Company Mock — Centralized Configuration.
 *
 * This configuration is dedicated strictly to Accenture Mock Interviews.
 * It ONLY reads Accenture-specific environment variables and NEVER falls back
 * to Real Interview credentials, Celebal, TCS, or Wipro credentials.
 */
export const ACCENTURE_CONFIG = {
  companyId: "accenture",
  companyName: "Accenture",
  timeoutMs: 60000,

  /**
   * Get the dedicated Accenture API key.
   * NEVER reads AI_API_KEY, MOCK_INTERVIEW_API_KEY, TCS_MOCK_KEY, or WIPRO_MOCK_KEY.
   */
  getApiKey() {
    return (process.env.ACCENTURE_MOCK_KEY || "").trim();
  },

  /**
   * Get the dedicated Accenture Model ID.
   * Defaults to llama-3.3-70b-versatile if unspecified.
   */
  getModel() {
    return (process.env.ACCENTURE_MOCK_MODEL || "llama-3.3-70b-versatile").trim();
  },

  /**
   * Whether the Accenture AI client is properly configured with a usable key.
   */
  isConfigured() {
    const key = this.getApiKey();
    if (!key) return false;
    if (/mock/i.test(key) && key.length < 20) return false;
    return true;
  },
};

export const accentureConfig = ACCENTURE_CONFIG;
export default ACCENTURE_CONFIG;
