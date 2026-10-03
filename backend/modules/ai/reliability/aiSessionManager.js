import { encryptSecret, decryptSecret } from "./utils/redactSecrets.js";
import { safeLogger } from "./utils/safeLogger.js";

/**
 * Manages BYOK (Bring Your Own Key) session states in memory safely.
 */
export class AISessionManager {
  constructor() {
    this.sessionKeys = new Map();
  }

  /**
   * Binds BYOK API key and provider to an interview session.
   * Encrypts key before keeping in memory map.
   */
  setSessionBYOK(sessionId, providerName, apiKey, userId = null) {
    if (!sessionId || !providerName || !apiKey) {
      return;
    }

    const encrypted = encryptSecret(apiKey);
    this.sessionKeys.set(sessionId, {
      userId: userId ? String(userId) : null,
      providerName: String(providerName).toLowerCase().trim(),
      encryptedKey: encrypted,
      timestamp: Date.now()
    });

    safeLogger.info(`[AISessionManager] Bound BYOK provider [${providerName}] to session [${sessionId}].`);
    console.log(`[BYOK] provider=${providerName}\n[BYOK] sessionId=${sessionId}\n[BYOK] apiKeyReceived=true\n[BYOK] sessionKeyAttached=true`);
  }

  /**
   * Retrieves decrypted BYOK API key and provider for a session.
   * Validates optional userId against bound owner.
   */
  getSessionBYOK(sessionId, userId = null) {
    if (!sessionId || !this.sessionKeys.has(sessionId)) {
      return null;
    }

    const entry = this.sessionKeys.get(sessionId);
    if (userId && entry.userId && String(userId) !== String(entry.userId)) {
      safeLogger.warn(`[AISessionManager] Unauthorized BYOK access attempt for session [${sessionId}] by user [${userId}].`);
      return null;
    }

    const decryptedKey = decryptSecret(entry.encryptedKey);

    return {
      providerName: entry.providerName,
      apiKey: decryptedKey
    };
  }

  /**
   * Clears session BYOK key when interview session ends.
   */
  clearSession(sessionId) {
    if (sessionId && this.sessionKeys.has(sessionId)) {
      this.sessionKeys.delete(sessionId);
      safeLogger.info(`[AISessionManager] Cleared BYOK keys for session [${sessionId}].`);
    }
  }

  clearSessionBYOK(sessionId) {
    this.clearSession(sessionId);
  }

  /**
   * Cleans up expired session keys older than 6 hours.
   */
  cleanupExpiredSessions(maxAgeMs = 6 * 60 * 60 * 1000) {
    const now = Date.now();
    for (const [sessionId, entry] of this.sessionKeys.entries()) {
      if (now - entry.timestamp > maxAgeMs) {
        this.sessionKeys.delete(sessionId);
      }
    }
  }
}

export const sessionManager = new AISessionManager();
export default sessionManager;
