import dotenv from "dotenv";

dotenv.config();

/**
 * Shared KEY2 Company Mock — Centralized Configuration.
 *
 * Serves the following companies using MOCK_INTERVIEW_API_KEY2:
 *   - Capgemini
 *   - Cognizant
 *   - Deloitte
 *   - Infosys
 *
 * Strictly isolated:
 * - Reads ONLY MOCK_INTERVIEW_API_KEY2 and MOCK_INTERVIEW_MODEL2.
 * - NEVER reads MOCK_INTERVIEW_API_KEY, TCS_MOCK_KEY, ACCENTURE_MOCK_KEY,
 *   BENCHMARK_MOCK_KEY, or AI_API_KEY.
 * - NEVER falls back to another key pool.
 */

const KEY2_COMPANIES = ["capgemini", "cognizant", "deloitte", "infosys"];

export const SHARED2_CONFIG = {
  companyId: "shared2",
  companyName: "KEY2 Group (Capgemini, Cognizant, Deloitte, Infosys)",
  companies: KEY2_COMPANIES,
  timeoutMs: 60000,

  /**
   * Get the dedicated KEY2 API key.
   * NEVER reads MOCK_INTERVIEW_API_KEY or any other company key.
   */
  getApiKey() {
    return (process.env.MOCK_INTERVIEW_API_KEY2 || "").trim();
  },

  /**
   * Get the dedicated KEY2 Model ID.
   * Defaults to llama-3.3-70b-versatile if unspecified.
   */
  getModel() {
    return (process.env.MOCK_INTERVIEW_MODEL2 || "llama-3.3-70b-versatile").trim();
  },

  /**
   * Whether the KEY2 AI client is properly configured with a usable key.
   */
  isConfigured() {
    const key = this.getApiKey();
    if (!key) return false;
    if (/mock/i.test(key) && key.length < 20) return false;
    return true;
  },
};

/**
 * Check if a companyId belongs to the KEY2 group.
 */
export function isKey2Company(companyId) {
  return KEY2_COMPANIES.includes(String(companyId || "").toLowerCase());
}

export const shared2Config = SHARED2_CONFIG;
export default SHARED2_CONFIG;
