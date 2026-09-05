import dotenv from "dotenv";

dotenv.config();

/**
 * Benchmark IT Solutions Company Mock — Centralized Configuration.
 *
 * This configuration is dedicated strictly to Benchmark Mock Interviews.
 * It ONLY reads Benchmark-specific environment variables and NEVER falls back
 * to Real Interview credentials, Celebal, TCS, Wipro, or Accenture credentials.
 */
export const BENCHMARK_CONFIG = {
  companyId: "benchmark",
  companyName: "Benchmark IT Solutions",
  timeoutMs: 60000,

  /**
   * Get the dedicated Benchmark API key.
   * NEVER reads AI_API_KEY, MOCK_INTERVIEW_API_KEY, TCS_MOCK_KEY, WIPRO_MOCK_KEY, or ACCENTURE_MOCK_KEY.
   */
  getApiKey() {
    return (process.env.BENCHMARK_MOCK_KEY || "").trim();
  },

  /**
   * Get the dedicated Benchmark Model ID.
   * Defaults to llama-3.3-70b-versatile if unspecified.
   */
  getModel() {
    return (process.env.BENCHMARK_MOCK_MODEL || "llama-3.3-70b-versatile").trim();
  },

  /**
   * Whether the Benchmark AI client is properly configured with a usable key.
   */
  isConfigured() {
    const key = this.getApiKey();
    if (!key) return false;
    if (/mock/i.test(key) && key.length < 20) return false;
    return true;
  },
};

export const benchmarkConfig = BENCHMARK_CONFIG;
export default BENCHMARK_CONFIG;
