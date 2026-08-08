import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import api from "../utils/api";
import { getAuthToken } from "./useStudentProfile";

/**
 * In-memory response cache with request deduplication.
 * - Concurrent calls with the same key share one in-flight promise (no duplicate requests).
 * - Cached GET responses are reused within TTL (caching / performance).
 * - Optional lazy mode keeps the fetch out of the initial render path.
 */
const cache = new Map();

function readCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function writeCache(key, data, ttlMs) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

export function clearApiCache(keyPrefix = "") {
  for (const key of cache.keys()) {
    if (key.startsWith(keyPrefix)) cache.delete(key);
  }
}

export function useCachedApi({ url, params, key, ttlMs = 60 * 1000, enabled = true, lazy = false }) {
  const token = getAuthToken();
  const paramsKey = useMemo(() => JSON.stringify(params || {}), [params]);
  const cacheKey = key || url + paramsKey;
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const [data, setData] = useState(() => (lazy ? null : readCache(cacheKey)));
  const [loading, setLoading] = useState(!lazy && !data);
  const [error, setError] = useState(null);
  const inFlightRef = useRef(null);

  const fetchNow = useCallback(async () => {
    const cached = readCache(cacheKey);
    if (cached !== null) {
      setData(cached);
      setLoading(false);
      setError(null);
      return cached;
    }

    if (!inFlightRef.current) {
      inFlightRef.current = (async () => {
        const res = await api.get(url, { params: paramsRef.current, headers: { Authorization: `Bearer ${token}` } });
        return res.data;
      })().finally(() => {
        inFlightRef.current = null;
      });
    }

    try {
      const result = await inFlightRef.current;
      writeCache(cacheKey, result, ttlMs);
      setData(result);
      setError(null);
      return result;
    } catch (err) {
      setError(err.response?.status || "network_failure");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [url, paramsKey, token, cacheKey, ttlMs]);

  useEffect(() => {
    if (!enabled || lazy) return;
    fetchNow().catch(() => {});
  }, [enabled, lazy, fetchNow]);

  const refetch = useCallback(async () => {
    cache.delete(cacheKey);
    setLoading(true);
    return fetchNow();
  }, [cacheKey, fetchNow]);

  const clear = useCallback(() => {
    cache.delete(cacheKey);
    setData(null);
  }, [cacheKey]);

  return { data, loading, error, refetch, clear, cacheKey };
}

export default useCachedApi;
