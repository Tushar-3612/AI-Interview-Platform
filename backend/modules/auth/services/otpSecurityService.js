import { getRedisClient, isRedisReady, acquireDistributedLock, releaseDistributedLock } from "../../../core/redis/redisService.js";

// OTP Configuration Constants
export const OTP_VALIDITY_SECONDS = 3 * 60; // Exactly 3 minutes (180s)
export const OTP_SEND_WINDOW_SECONDS = 2 * 60 * 60; // 2 hours (7200s)
export const OTP_MAX_SENDS_PER_WINDOW = 2; // Max 2 OTP emails per email in 2 hours

export const IP_OTP_WINDOW_SECONDS = 60 * 60; // 1 hour (3600s)
export const IP_MAX_OTP_REQUESTS = 25; // Max 25 OTP requests per IP per hour (campus friendly)

export function normalizeEmail(email) {
  return String(email || "").toLowerCase().trim();
}

export function normalizeIp(ip) {
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
 * Acquire concurrency lock for a specific email to prevent race conditions during OTP dispatch.
 * Requires operational Redis cluster. Returns lockToken if acquired, null if Redis is offline or already locked.
 */
export async function acquireOtpLock(email) {
  if (!isRedisReady()) {
    return null;
  }
  const cleanEmail = normalizeEmail(email);
  return acquireDistributedLock(`otp:dispatch:${cleanEmail}`, 5000);
}

export async function releaseOtpLock(email, lockToken) {
  if (!lockToken || !isRedisReady()) return;
  const cleanEmail = normalizeEmail(email);
  return releaseDistributedLock(`otp:dispatch:${cleanEmail}`, lockToken);
}

/**
 * Checks if an OTP request is permitted according to:
 * 1. Distributed Redis availability (Fail-Closed)
 * 2. IP Anti-Abuse (Max 25/hour)
 * 3. Active Unexpired OTP (No new OTP if current is active within 3 minutes)
 * 4. 2 OTPs per 2 Hours (Rolling/Fixed 2-hour window)
 */
export async function checkOtpSendEligibility(email, ip, purpose = "general") {
  // STRICT FAIL-CLOSED: Redis is mandatory for distributed OTP security
  if (!isRedisReady()) {
    return {
      allowed: false,
      statusCode: 503,
      code: "SERVICE_UNAVAILABLE",
      message: "OTP service is temporarily unavailable. Please try again later.",
      retryAfterSeconds: 60,
    };
  }

  const client = getRedisClient();
  if (!client) {
    return {
      allowed: false,
      statusCode: 503,
      code: "SERVICE_UNAVAILABLE",
      message: "OTP service is temporarily unavailable. Please try again later.",
      retryAfterSeconds: 60,
    };
  }

  const cleanEmail = normalizeEmail(email);
  const cleanIp = normalizeIp(ip);

  const activeKey = `otp:active:${purpose}:${cleanEmail}`;
  const emailSendKey = `otp:send:email:${cleanEmail}`;
  const ipSendKey = `otp:send:ip:${cleanIp}`;

  try {
    // 1. Check IP Anti-Abuse
    const ipCountStr = await client.get(ipSendKey);
    const ipCount = parseInt(ipCountStr || "0", 10);
    if (ipCount >= IP_MAX_OTP_REQUESTS) {
      const ttl = await client.ttl(ipSendKey);
      return {
        allowed: false,
        statusCode: 429,
        code: "IP_RATE_LIMIT_EXCEEDED",
        message: "Too many OTP requests from this network. Please try again later.",
        retryAfterSeconds: ttl > 0 ? ttl : IP_OTP_WINDOW_SECONDS,
      };
    }

    // 2. Check Active OTP (Rule 2: No new OTP while current is active)
    const hasActive = await client.exists(activeKey);
    if (hasActive) {
      const ttl = await client.ttl(activeKey);
      return {
        allowed: false,
        statusCode: 429,
        code: "ACTIVE_OTP_EXISTS",
        message: "Your current OTP is still valid. Please use it.",
        retryAfterSeconds: ttl > 0 ? ttl : OTP_VALIDITY_SECONDS,
      };
    }

    // 3. Check 2-Hour Limit (Rule 3: Maximum 2 OTP emails per email in 2 hours)
    const emailCountStr = await client.get(emailSendKey);
    const emailCount = parseInt(emailCountStr || "0", 10);
    if (emailCount >= OTP_MAX_SENDS_PER_WINDOW) {
      const ttl = await client.ttl(emailSendKey);
      return {
        allowed: false,
        statusCode: 429,
        code: "OTP_RATE_LIMIT_EXCEEDED",
        message: "Too many OTP requests. Please try again later.",
        retryAfterSeconds: ttl > 0 ? ttl : OTP_SEND_WINDOW_SECONDS,
      };
    }

    return { allowed: true };
  } catch (err) {
    console.error("[OTPSecurity] Redis eligibility check error:", err.message);
    // Strict fail-closed on Redis communication error
    return {
      allowed: false,
      statusCode: 503,
      code: "SERVICE_UNAVAILABLE",
      message: "OTP service is temporarily unavailable. Please try again later.",
      retryAfterSeconds: 60,
    };
  }
}

/**
 * Records that an OTP was successfully generated and dispatched.
 * Sets active OTP flag with 3-minute TTL and increments 2-hour window counter.
 * Fails closed if Redis is unavailable.
 */
export async function recordOtpDispatched(email, ip, purpose = "general") {
  if (!isRedisReady()) {
    throw new Error("Redis connection unavailable during OTP record dispatch");
  }

  const client = getRedisClient();
  if (!client) {
    throw new Error("Redis client unavailable during OTP record dispatch");
  }

  const cleanEmail = normalizeEmail(email);
  const cleanIp = normalizeIp(ip);

  const activeKey = `otp:active:${purpose}:${cleanEmail}`;
  const emailSendKey = `otp:send:email:${cleanEmail}`;
  const ipSendKey = `otp:send:ip:${cleanIp}`;

  const pipeline = client.pipeline();
  // Set active OTP key (3 minutes = 180s)
  pipeline.set(activeKey, "1", "EX", OTP_VALIDITY_SECONDS);
  // Increment 2-hour email counter
  pipeline.incr(emailSendKey);
  // Increment 1-hour IP counter
  pipeline.incr(ipSendKey);
  const results = await pipeline.exec();

  // Ensure TTL is set on counter keys if newly created
  const emailCount = results[1]?.[1];
  if (emailCount === 1) {
    await client.expire(emailSendKey, OTP_SEND_WINDOW_SECONDS);
  }
  const ipCount = results[2]?.[1];
  if (ipCount === 1) {
    await client.expire(ipSendKey, IP_OTP_WINDOW_SECONDS);
  }
}

/**
 * Invalidate active OTP state when an OTP is verified or burned.
 */
export async function clearActiveOtpState(email, purpose = "general") {
  if (!isRedisReady()) return;
  const cleanEmail = normalizeEmail(email);
  const activeKey = `otp:active:${purpose}:${cleanEmail}`;

  const client = getRedisClient();
  if (client) {
    try {
      await client.del(activeKey);
    } catch (err) {
      console.warn("[OTPSecurity] Redis active OTP clear failed:", err.message);
    }
  }
}
