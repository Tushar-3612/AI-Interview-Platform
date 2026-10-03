import { getRedisClient, isRedisReady } from "./redisService.js";

// Rate limit configurations
const IP_WINDOW_SECONDS = 15 * 60; // 15 minutes
const IP_MAX_FAILED_ATTEMPTS = 5;   // Max 10 failed attempts per IP per 15 min

const ACCOUNT_WINDOW_SECONDS = 15 * 60; // 15 minutes
const ACCOUNT_MAX_FAILED_ATTEMPTS = 3;   // Max 5 failed attempts per account per 15 min

// Fallback in-memory map if Redis is not configured or temporarily unavailable
const localMemoryStore = new Map();
const LOCAL_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// Periodic cleanup of expired local memory entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of localMemoryStore.entries()) {
    if (now > entry.expiresAt) {
      localMemoryStore.delete(key);
    }
  }
}, LOCAL_CLEANUP_INTERVAL_MS).unref();

function normalizeEmail(email) {
  return String(email || "").toLowerCase().trim();
}

function normalizeIp(ip) {
  if (!ip) return "unknown_ip";
  let clean = String(ip).trim();
  if (clean.startsWith("::ffff:")) {
    clean = clean.substring(7);
  }
  if (clean === "::1") {
    clean = "127.0.0.1";
  }
  return clean;
}

/**
 * Checks if the login attempt from given IP and email is allowed.
 * Returns { allowed: true } or { allowed: false, retryAfterSeconds: number, reason: 'ip' | 'account' }
 */
export async function checkLoginRateLimit(ip, email) {
  const cleanIp = normalizeIp(ip);
  const cleanEmail = normalizeEmail(email);

  const ipKey = `auth:fail:ip:${cleanIp}`;
  const accountKey = cleanEmail ? `auth:fail:acc:${cleanEmail}` : null;

  if (isRedisReady()) {
    const client = getRedisClient();
    try {
      // Check IP limits
      const ipCountStr = await client.get(ipKey);
      const ipCount = parseInt(ipCountStr || "0", 10);
      if (ipCount >= IP_MAX_FAILED_ATTEMPTS) {
        const ttl = await client.ttl(ipKey);
        return {
          allowed: false,
          retryAfterSeconds: ttl > 0 ? ttl : IP_WINDOW_SECONDS,
          reason: "ip",
        };
      }

      // Check Account limits if email is provided
      if (accountKey) {
        const accCountStr = await client.get(accountKey);
        const accCount = parseInt(accCountStr || "0", 10);
        if (accCount >= ACCOUNT_MAX_FAILED_ATTEMPTS) {
          const ttl = await client.ttl(accountKey);
          return {
            allowed: false,
            retryAfterSeconds: ttl > 0 ? ttl : ACCOUNT_WINDOW_SECONDS,
            reason: "account",
          };
        }
      }

      return { allowed: true };
    } catch (err) {
      console.warn("[LoginSecurity] Redis check failed, evaluating fallback security:", err.message);
    }
  }

  // Fallback in-memory evaluation
  const now = Date.now();

  // Check IP
  const ipEntry = localMemoryStore.get(ipKey);
  if (ipEntry && now < ipEntry.expiresAt && ipEntry.count >= IP_MAX_FAILED_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((ipEntry.expiresAt - now) / 1000),
      reason: "ip",
    };
  }

  // Check Account
  if (accountKey) {
    const accEntry = localMemoryStore.get(accountKey);
    if (accEntry && now < accEntry.expiresAt && accEntry.count >= ACCOUNT_MAX_FAILED_ATTEMPTS) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((accEntry.expiresAt - now) / 1000),
        reason: "account",
      };
    }
  }

  return { allowed: true };
}

/**
 * Record a failed login attempt for the given IP and email.
 * Increments counters and sets expiration window.
 */
export async function recordFailedLogin(ip, email) {
  const cleanIp = normalizeIp(ip);
  const cleanEmail = normalizeEmail(email);

  const ipKey = `auth:fail:ip:${cleanIp}`;
  const accountKey = cleanEmail ? `auth:fail:acc:${cleanEmail}` : null;

  if (isRedisReady()) {
    const client = getRedisClient();
    try {
      // Increment IP counter
      const ipCount = await client.incr(ipKey);
      if (ipCount === 1) {
        await client.expire(ipKey, IP_WINDOW_SECONDS);
      }

      // Increment Account counter
      if (accountKey) {
        const accCount = await client.incr(accountKey);
        if (accCount === 1) {
          await client.expire(accountKey, ACCOUNT_WINDOW_SECONDS);
        }
      }
      return;
    } catch (err) {
      console.warn("[LoginSecurity] Redis increment failed, applying fallback security:", err.message);
    }
  }

  // Fallback in-memory increment
  const now = Date.now();

  // IP fallback
  const ipEntry = localMemoryStore.get(ipKey);
  if (!ipEntry || now > ipEntry.expiresAt) {
    localMemoryStore.set(ipKey, { count: 1, expiresAt: now + IP_WINDOW_SECONDS * 1000 });
  } else {
    ipEntry.count += 1;
  }

  // Account fallback
  if (accountKey) {
    const accEntry = localMemoryStore.get(accountKey);
    if (!accEntry || now > accEntry.expiresAt) {
      localMemoryStore.set(accountKey, { count: 1, expiresAt: now + ACCOUNT_WINDOW_SECONDS * 1000 });
    } else {
      accEntry.count += 1;
    }
  }
}

/**
 * Clears failed login attempt counters upon successful authentication.
 */
export async function resetLoginAttempts(ip, email) {
  const cleanIp = normalizeIp(ip);
  const cleanEmail = normalizeEmail(email);

  const ipKey = `auth:fail:ip:${cleanIp}`;
  const accountKey = cleanEmail ? `auth:fail:acc:${cleanEmail}` : null;

  if (isRedisReady()) {
    const client = getRedisClient();
    try {
      const keysToDelete = [ipKey];
      if (accountKey) keysToDelete.push(accountKey);
      await client.del(...keysToDelete);
    } catch (err) {
      console.warn("[LoginSecurity] Redis reset failed:", err.message);
    }
  }

  // Clear in local fallback memory as well
  localMemoryStore.delete(ipKey);
  if (accountKey) localMemoryStore.delete(accountKey);
}
