const activeGenerations = new Map();

/**
 * Wraps an async generation function with an in-flight promise lock per key (e.g. "aptitude:sessionId").
 * Prevents concurrent duplicate requests for the same session & round from triggering duplicate AI calls.
 */
export async function withInFlightLock(key, generatorFn) {
  if (!key) return await generatorFn();

  if (activeGenerations.has(key)) {
    console.log(`[InFlightLock] Request for key '${key}' is already in-flight. Awaiting active execution...`);
    return await activeGenerations.get(key);
  }

  const promise = (async () => {
    try {
      return await generatorFn();
    } finally {
      activeGenerations.delete(key);
    }
  })();

  activeGenerations.set(key, promise);
  return await promise;
}
