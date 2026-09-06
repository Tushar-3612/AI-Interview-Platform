import mongoose from "mongoose";

/**
 * Tracks questions presented to a student across Real AI Interview sessions.
 * Used to ensure NO question is repeated in subsequent Real Interview attempts.
 */
const realInterviewQuestionHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    round: {
      type: String,
      required: true,
      enum: ["aptitude", "technical", "resume_project", "hr", "coding"],
    },
    questionId: {
      type: String,
      default: "",
    },
    questionText: {
      type: String,
      required: true,
    },
    normalizedQuestion: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound index for fast user-level duplicate lookups
realInterviewQuestionHistorySchema.index({ userId: 1, normalizedQuestion: 1 });
realInterviewQuestionHistorySchema.index({ userId: 1, round: 1 });

const RealInterviewQuestionHistory = mongoose.model(
  "RealInterviewQuestionHistory",
  realInterviewQuestionHistorySchema
);

export default RealInterviewQuestionHistory;
