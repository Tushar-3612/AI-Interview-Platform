import { safeLogger } from "./utils/safeLogger.js";

/**
 * Handles atomic database persistence for generated interview questions.
 */
export class AICheckpointManager {
  /**
   * Atomically saves or updates a question in MongoDB while enforcing slot uniqueness.
   * @param {object} Model MongoDB Mongoose Model (e.g., RealInterviewTechnicalQuestion)
   * @param {object} query Query criteria (e.g. { sessionId, questionNumber: orderIndex })
   * @param {object} updateDoc Document data to insert/update
   */
  static async saveQuestionAtomic(Model, query, updateDoc) {
    if (!Model) {
      safeLogger.warn("[CheckpointManager] Model not provided to saveQuestionAtomic. Skipping DB write.");
      return updateDoc;
    }

    try {
      const saved = await Model.findOneAndUpdate(
        query,
        { $setOnInsert: updateDoc },
        { new: true, upsert: true }
      );
      safeLogger.info(`[CheckpointManager] Atomic check-in saved question slot: Q${query.questionNumber || query.orderIndex || "N/A"}`);
      return saved;
    } catch (err) {
      if (err.code === 11000) {
        safeLogger.warn(`[CheckpointManager] Duplicate key collision on atomic insert for Q${query.questionNumber || query.orderIndex}. Document already exists.`);
        return await Model.findOne(query);
      }
      safeLogger.error(`[CheckpointManager] Atomic save failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Checks database for missing question slots in a given round.
   * @param {object} Model MongoDB model
   * @param {string} sessionId Interview session ID
   * @param {number} totalRequired Total expected questions (e.g. 20)
   * @returns {object} { existingCount, missingSlots, firstMissingSlot }
   */
  static async getMissingSlots(Model, sessionId, totalRequired) {
    if (!Model || !sessionId) {
      return { existingCount: 0, missingSlots: Array.from({ length: totalRequired }, (_, i) => i + 1), firstMissingSlot: 1 };
    }

    const docs = await Model.find({ sessionId }).select("questionNumber orderIndex").lean();
    const existingNumbers = new Set(
      docs.map(d => d.questionNumber ?? d.orderIndex).filter(n => typeof n === "number")
    );

    const missingSlots = [];
    for (let i = 1; i <= totalRequired; i++) {
      if (!existingNumbers.has(i)) {
        missingSlots.push(i);
      }
    }

    return {
      existingCount: existingNumbers.size,
      missingSlots,
      firstMissingSlot: missingSlots[0] || null
    };
  }
}

export default AICheckpointManager;
