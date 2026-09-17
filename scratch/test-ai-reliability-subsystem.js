import {
  AIGateway,
  providerRegistry,
  AIErrorClassifier,
  ERROR_CATEGORIES,
  AIBackoffManager,
  AIRetryPolicy,
  requestDeduplicator,
  circuitBreaker,
  AIJsonRepair,
  AIResponseValidator,
  sessionManager,
  maskSecret,
  redactObjSecrets
} from "../backend/services/aiReliability/index.js";

async function runTests() {
  console.log("=== STARTING AI RELIABILITY SUBSYSTEM UNIT TESTS ===");

  // Test 1: Provider Registry
  console.log("\n[Test 1] Provider Registry");
  const supported = providerRegistry.getSupportedProviders();
  console.log("Supported providers:", supported);
  if (!supported.includes("groq") || !supported.includes("gemini") || !supported.includes("openrouter") || !supported.includes("deepseek") || !supported.includes("openai")) {
    throw new Error("Provider registry missing expected providers");
  }
  console.log("✓ Provider Registry passed.");

  // Test 2: Secret Redaction & Masking
  console.log("\n[Test 2] Secret Redaction & Masking");
  const rawKey = "gsk_1234567890abcdefghijklmn";
  const masked = maskSecret(rawKey);
  console.log("Raw key masked:", masked);
  if (masked.includes("1234567890abcdef")) {
    throw new Error("Secret masking failed, raw key leaked!");
  }
  const obj = { apiKey: rawKey, user: "test", nested: { token: "secret_token_123456" } };
  const redacted = redactObjSecrets(obj);
  console.log("Redacted object:", JSON.stringify(redacted));
  if (JSON.stringify(redacted).includes("gsk_12345") || JSON.stringify(redacted).includes("secret_token")) {
    throw new Error("Object secret redaction failed!");
  }
  console.log("✓ Secret Redaction passed.");

  // Test 3: Error Classifier
  console.log("\n[Test 3] Error Classifier");
  const authErr = AIErrorClassifier.classify({ status: 401, message: "Invalid API Key provided" });
  console.log("Auth Error classified:", authErr.category, "isRetryable:", authErr.isRetryable);
  if (authErr.category !== ERROR_CATEGORIES.INVALID_AUTH || authErr.isRetryable !== false) {
    throw new Error("Auth Error classification failed");
  }

  const rateErr = AIErrorClassifier.classify({ status: 429, message: "Rate limit reached" });
  console.log("Rate Limit Error classified:", rateErr.category, "isRetryable:", rateErr.isRetryable);
  if (rateErr.category !== ERROR_CATEGORIES.RATE_LIMIT || rateErr.isRetryable !== true) {
    throw new Error("Rate Limit classification failed");
  }
  console.log("✓ Error Classifier passed.");

  // Test 4: Backoff Manager & Retry-After Header
  console.log("\n[Test 4] Backoff Manager");
  const delay1 = AIBackoffManager.calculateDelay(1, { initialDelayMs: 100, useJitter: false });
  const delay2 = AIBackoffManager.calculateDelay(2, { initialDelayMs: 100, useJitter: false });
  console.log("Backoff delay 1 & 2:", delay1, delay2);
  if (delay2 <= delay1) {
    throw new Error("Exponential backoff calculation failed");
  }
  const headerDelay = AIBackoffManager.parseRetryAfter("5");
  if (headerDelay !== 5000) {
    throw new Error("Retry-After header parsing failed");
  }
  console.log("✓ Backoff Manager passed.");

  // Test 5: Non-Retryable Error Fast-Stop
  console.log("\n[Test 5] Non-Retryable Fast-Stop");
  let attemptsMade = 0;
  try {
    await AIRetryPolicy.execute(
      async () => {
        attemptsMade++;
        const err = new Error("Invalid API Key");
        err.status = 401;
        throw err;
      },
      { maxRetries: 3, providerName: "test-provider" }
    );
  } catch (err) {
    console.log(`Caught expected non-retryable error after ${attemptsMade} attempt(s):`, err.message);
  }
  if (attemptsMade !== 1) {
    throw new Error(`Non-retryable error failed to stop immediately! Executed ${attemptsMade} times.`);
  }
  console.log("✓ Non-Retryable Fast-Stop passed.");

  // Test 6: In-Flight Deduplication & DB Pre-Check
  console.log("\n[Test 6] Request Deduplication");
  let executionCount = 0;
  const executor = async () => {
    executionCount++;
    await new Promise((r) => setTimeout(r, 50));
    return { result: "ok", count: executionCount };
  };

  const p1 = requestDeduplicator.deduplicate("fp_1", {}, executor);
  const p2 = requestDeduplicator.deduplicate("fp_1", {}, executor);

  const [res1, res2] = await Promise.all([p1, p2]);
  console.log("Deduplication results:", res1, res2);
  if (executionCount !== 1) {
    throw new Error(`Deduplicator executed target function ${executionCount} times instead of 1!`);
  }

  // DB pre-check test
  const resDb = await requestDeduplicator.deduplicate(
    "fp_2",
    { dbCheckFn: async () => ({ question: "Existing question from DB" }) },
    executor
  );
  console.log("DB pre-check result:", resDb);
  if (resDb.question !== "Existing question from DB") {
    throw new Error("DB pre-check deduplication failed!");
  }
  console.log("✓ Request Deduplication passed.");

  // Test 7: Circuit Breaker
  console.log("\n[Test 7] Circuit Breaker");
  circuitBreaker.reset("mock_provider");
  for (let i = 0; i < 5; i++) {
    circuitBreaker.recordFailure("mock_provider", "TRANSIENT_PROVIDER");
  }
  let tripped = false;
  try {
    circuitBreaker.canExecute("mock_provider");
  } catch (err) {
    tripped = true;
    console.log("Circuit Breaker tripped error:", err.message);
  }
  if (!tripped) {
    throw new Error("Circuit breaker failed to trip after threshold failures!");
  }
  circuitBreaker.reset("mock_provider");
  console.log("✓ Circuit Breaker passed.");

  // Test 8: JSON Repair
  console.log("\n[Test 8] JSON Repair");
  const rawDeepSeekText = `<think>Analyzing candidate response...</think>
\`\`\`json
{
  question: "What is closure in JavaScript?",
  type: "technical",
}
\`\`\``;
  const repaired = AIJsonRepair.parseAndRepair(rawDeepSeekText);
  console.log("Repaired JSON:", repaired);
  if (repaired.question !== "What is closure in JavaScript?") {
    throw new Error("JSON Repair failed to parse raw text!");
  }
  console.log("✓ JSON Repair passed.");

  // Test 9: Response Validator
  console.log("\n[Test 9] Response Validator");
  AIResponseValidator.validate(repaired, "technical");
  let validErrorPassed = false;
  try {
    AIResponseValidator.validate({}, "technical");
  } catch (err) {
    validErrorPassed = true;
  }
  if (!validErrorPassed) {
    throw new Error("Response validator failed to reject empty object!");
  }
  console.log("✓ Response Validator passed.");

  // Test 10: Session Manager BYOK
  console.log("\n[Test 10] Session BYOK Encryption & Recovery");
  const testSessionId = "sess_123456";
  sessionManager.setSessionBYOK(testSessionId, "groq", "gsk_secret12345");
  const recovered = sessionManager.getSessionBYOK(testSessionId);
  console.log("Recovered BYOK provider:", recovered.providerName, "Key recovered:", !!recovered.apiKey);
  if (recovered.providerName !== "groq" || recovered.apiKey !== "gsk_secret12345") {
    throw new Error("Session Manager BYOK decryption failed!");
  }
  sessionManager.clearSession(testSessionId);
  if (sessionManager.getSessionBYOK(testSessionId) !== null) {
    throw new Error("Session Manager clear failed!");
  }
  console.log("✓ Session Manager BYOK passed.");

  console.log("\n=== ALL AI RELIABILITY SUBSYSTEM TESTS PASSED SUCCESSFULLY! ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
