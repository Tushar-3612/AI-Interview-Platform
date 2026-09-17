import mongoose from "mongoose";
import { safeLogger } from "./safeLogger.js";

/**
 * Verifies MongoDB connection state before executing DB mutations.
 * Waits up to timeoutMs if connection is reconnecting.
 */
export async function ensureMongoConnected(timeoutMs = 5000) {
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  safeLogger.warn(`[MongoHelper] Connection state is ${mongoose.connection.readyState}. Waiting for active connection...`);
  const start = Date.now();

  while (mongoose.connection.readyState !== 1 && (Date.now() - start < timeoutMs)) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  if (mongoose.connection.readyState !== 1) {
    throw new Error(`MongoDB connection lost or disconnected (readyState: ${mongoose.connection.readyState}). Cannot save data.`);
  }

  safeLogger.info("[MongoHelper] Connection restored/active.");
  return true;
}

/**
 * Performs an idempotent upsert for question documents based on { sessionId, orderIndex }.
 */
export async function idempotentUpsertQuestion(Model, query, doc) {
  await ensureMongoConnected();

  try {
    const res = await Model.findOneAndUpdate(
      query,
      { $setOnInsert: doc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res;
  } catch (err) {
    if (err.code === 11000) {
      safeLogger.warn(`[MongoHelper] Duplicate key collision on upsert for ${JSON.stringify(query)}. Fetching existing document.`);
      return await Model.findOne(query);
    }
    throw err;
  }
}
