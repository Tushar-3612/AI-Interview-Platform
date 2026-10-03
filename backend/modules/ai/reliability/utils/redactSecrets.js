import crypto from "crypto";

// Matches common AI provider API key patterns (Groq, OpenRouter, Gemini, DeepSeek, OpenAI)
const SECRET_REGEX = /(gsk_[A-Za-z0-9_-]{20,}|sk-or-v1-[A-Za-z0-9_-]{20,}|AIzaSy[A-Za-z0-9_-]{30,}|sk-[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,})/gi;

/**
 * Redacts API keys and sensitive tokens from string inputs.
 */
export function redactSecrets(text) {
  if (!text) return "";
  if (typeof text !== "string") {
    try {
      text = JSON.stringify(text);
    } catch (e) {
      text = String(text);
    }
  }
  return text.replace(SECRET_REGEX, (match) => {
    if (match.startsWith("Bearer ")) {
      return "Bearer [REDACTED_KEY]";
    }
    return match.slice(0, 5) + "...[REDACTED]";
  });
}

export function maskSecret(key) {
  if (!key || typeof key !== "string") return "";
  if (key.length <= 8) return "[REDACTED]";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export function redactObjSecrets(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const copy = JSON.parse(JSON.stringify(obj));
  const redactKeyNames = ["apikey", "key", "token", "authorization", "secret", "password"];

  function traverse(target) {
    if (!target || typeof target !== "object") return;
    for (const k of Object.keys(target)) {
      if (typeof target[k] === "string" && redactKeyNames.some(rk => k.toLowerCase().includes(rk))) {
        target[k] = maskSecret(target[k]);
      } else if (typeof target[k] === "object") {
        traverse(target[k]);
      }
    }
  }

  traverse(copy);
  return copy;
}

const ENCRYPTION_KEY = process.env.BYOK_ENCRYPTION_KEY
  ? crypto.createHash("sha256").update(process.env.BYOK_ENCRYPTION_KEY).digest()
  : crypto.createHash("sha256").update("ai-interview-byok-default-secret-key").digest();

const ALGORITHM = "aes-256-gcm";

/**
 * Encrypts temporary session BYOK API key for at-rest session binding.
 */
export function encryptApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== "string") return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(apiKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts temporary session BYOK API key.
 */
export function decryptApiKey(encryptedPayload) {
  if (!encryptedPayload || typeof encryptedPayload !== "string") return "";
  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) return "";
  try {
    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encryptedText = parts[2];
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    return "";
  }
}

export const encryptSecret = encryptApiKey;
export const decryptSecret = decryptApiKey;
