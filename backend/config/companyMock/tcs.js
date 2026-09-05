import dotenv from "dotenv";

dotenv.config();

/**
 * TCS Company Mock — Centralized Configuration.
 *
 * This configuration is dedicated strictly to TCS Mock Interviews.
 * It ONLY reads TCS-specific environment variables and NEVER falls back
 * to Real Interview credentials or Celebal credentials.
 */
export const TCS_CONFIG = {
  companyId: "tcs",
  companyName: "Tata Consultancy Services",
  timeoutMs: 60000,

  /**
   * Get the dedicated TCS API key.
   * NEVER reads AI_API_KEY or MOCK_INTERVIEW_API_KEY.
   */
  getApiKey() {
    return (process.env.TCS_MOCK_KEY || "").trim();
  },

  /**
   * Get the dedicated TCS Model ID.
   * Defaults to llama-3.3-70b-versatile if unspecified.
   */
  getModel() {
    return (process.env.TCS_MOCK_MODEL || "llama-3.3-70b-versatile").trim();
  },

  /**
   * Whether the TCS AI client is properly configured with a usable key.
   */
  isConfigured() {
    const key = this.getApiKey();
    if (!key) return false;
    if (/mock/i.test(key) && key.length < 20) return false;
    return true;
  },
};

export const tcsConfig = TCS_CONFIG;
export default TCS_CONFIG;
