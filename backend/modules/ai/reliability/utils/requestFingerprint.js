import crypto from "crypto";

/**
 * Computes deterministic request fingerprint for process-level deduplication.
 */
export function computeRequestFingerprint({
  sessionId = "",
  round = "unknown",
  roundType = "unknown",
  operation = "generate",
  orderIndex = null,
  questionId = null,
  prompt = "",
  provider = "groq",
  model = "",
}) {
  const r = roundType !== "unknown" ? roundType : round;
  const targetId = orderIndex !== null && orderIndex !== undefined ? `order_${orderIndex}` : questionId || "batch";
  const promptHash = crypto.createHash("sha256").update(String(prompt || "")).digest("hex").slice(0, 16);
  return `${sessionId}:${r}:${operation}:${targetId}:${provider}:${model}:${promptHash}`;
}

export const createRequestFingerprint = computeRequestFingerprint;
