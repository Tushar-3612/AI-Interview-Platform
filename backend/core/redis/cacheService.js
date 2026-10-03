/**
 * In-memory TTL cache used by the placement intelligence engine.
 * Supports: get/set/delete, per-key TTL, LRU-ish cleanup on write,
 * and a maximum entry count to protect memory under 1000+ concurrent students.
 */
const cache = new Map();
const DEFAULT_TTL_MS = 60 * 1000;
const MAX_ENTRIES = 5000;

export function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export function setCache(key, value, ttlMs = DEFAULT_TTL_MS) {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function deleteCache(key) {
  cache.delete(key);
}

export function deleteCacheByPrefix(prefix) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export function clearCache() {
  cache.clear();
}
