import { acquireDistributedLock, releaseDistributedLock, isRedisReady } from "../redisService.js";

const activeGenerations = new Map();

/**
 * Wraps an async generation function with an in-flight promise lock per key (e.g. "aptitude:sessionId").
 * - If Redis is active: acquires a distributed lock (SET NX PX) to coordinate across multiple backend instances.
 * - In all cases: deduplicates concurrent requests in local process memory and relies on MongoDB atomic constraints.
 */
export async function withInFlightLock(key, generatorFn, ttlMs = 30000) {
  if (!key) return await generatorFn();

  // Check local in-flight execution first
  if (activeGenerations.has(key)) {
    console.log(`[InFlightLock] Request for key '${key}' is already in-flight locally. Awaiting active execution...`);
    return await activeGenerations.get(key);
  }

  let distributedToken = null;
  if (isRedisReady()) {
    distributedToken = await acquireDistributedLock(key, ttlMs);
    if (!distributedToken) {
      console.warn(`[InFlightLock] Distributed lock for key '${key}' already held by another instance.`);
      const busyErr = new Error("Another operation is currently in progress for this session. Please wait a moment.");
      busyErr.statusCode = 429;
      busyErr.code = "CONCURRENT_OPERATION_IN_PROGRESS";
      throw busyErr;
    }
  }

  const promise = (async () => {
    try {
      return await generatorFn();
    } finally {
      activeGenerations.delete(key);
      if (distributedToken) {
        await releaseDistributedLock(key, distributedToken).catch(() => {});
      }
    }
  })();

  activeGenerations.set(key, promise);
  return await promise;
}

