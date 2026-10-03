import Redis from "ioredis";

let redisClient = null;
let isConnected = false;

const REDIS_URL = process.env.REDIS_URL || (process.env.REDIS_HOST ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}` : null);

/**
 * Initialize Redis connection if configured in environment.
 * Gracefully handles offline states and reconnection attempts.
 */
export function initRedis() {
  if (!REDIS_URL) {
    console.log("ℹ️ REDIS_URL not configured. Running in stateless MongoDB-authoritative mode.");
    return null;
  }

  if (redisClient) return redisClient;

  try {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 2,
      retryStrategy(times) {
        if (times > 5) {
          console.warn("⚠️ Redis retry threshold reached. Continuing with MongoDB-authoritative fallback.");
          return null; // Stop retrying indefinitely
        }
        return Math.min(times * 500, 3000);
      },
      connectTimeout: 5000,
      lazyConnect: true,
    });

    redisClient.on("connect", () => {
      isConnected = true;
      console.log("✅ Redis connected successfully for distributed coordination.");
    });

    redisClient.on("ready", () => {
      isConnected = true;
    });

    redisClient.on("error", (err) => {
      isConnected = false;
      console.warn("⚠️ Redis connection error:", err.message);
    });

    redisClient.on("close", () => {
      isConnected = false;
    });

    redisClient.connect().catch((err) => {
      console.warn("⚠️ Initial Redis connection failed:", err.message);
    });

    return redisClient;
  } catch (err) {
    console.warn("⚠️ Failed to initialize Redis client:", err.message);
    return null;
  }
}

export function isRedisReady() {
  return Boolean(redisClient && isConnected && redisClient.status === "ready");
}

export function getRedisClient() {
  return isRedisReady() ? redisClient : null;
}

/**
 * Acquire a distributed lock with TTL.
 * Uses atomic Redis SET NX PX.
 * Returns lockToken if acquired, null if already locked or Redis unavailable.
 */
export async function acquireDistributedLock(key, ttlMs = 15000) {
  if (!isRedisReady()) return null;

  const lockToken = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  try {
    const result = await redisClient.set(`lock:${key}`, lockToken, "PX", ttlMs, "NX");
    return result === "OK" ? lockToken : null;
  } catch (err) {
    console.warn(`[DistributedLock] Failed to acquire lock for key '${key}':`, err.message);
    return null;
  }
}

/**
 * Release a distributed lock using safe Lua script (only releases if token matches).
 */
export async function releaseDistributedLock(key, lockToken) {
  if (!isRedisReady() || !lockToken) return false;

  const luaScript = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  try {
    const result = await redisClient.eval(luaScript, 1, `lock:${key}`, lockToken);
    return result === 1;
  } catch (err) {
    console.warn(`[DistributedLock] Failed to release lock for key '${key}':`, err.message);
    return false;
  }
}

/**
 * Close Redis connection cleanly on server shutdown.
 */
export async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log("🔒 Redis connection closed cleanly.");
    } catch (e) {
      redisClient.disconnect();
    } finally {
      redisClient = null;
      isConnected = false;
    }
  }
}
