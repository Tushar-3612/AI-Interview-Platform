import mongoose from "mongoose";

/**
 * Interview session schema — tracks each mock interview attempt.
 */
const interviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed"],
      default: "pending",
    },
    resumeFileName: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
    totalQuestions: { type: Number, default: 0 },
    questionsAnswered: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Interview = mongoose.model("Interview", interviewSchema);

export default Interview;
