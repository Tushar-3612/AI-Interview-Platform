import mongoose from "mongoose";

const nptelAttemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    weekId: {
      type: String,
      required: true,
      index: true,
    },
    weekNumber: {
      type: Number,
      required: true,
    },
    mode: {
      type: String,
      enum: ["practice", "exam"],
      default: "exam",
    },
    totalQuestions: {
      type: Number,
      required: true,
      default: 10,
    },
    correctCount: {
      type: Number,
      required: true,
      default: 0,
    },
    partiallyCorrectCount: {
      type: Number,
      default: 0,
    },
    incorrectCount: {
      type: Number,
      default: 0,
    },
    score: {
      type: Number,
      required: true,
      default: 0,
    },
    maxScore: {
      type: Number,
      required: true,
      default: 10,
    },
    percentage: {
      type: Number,
      required: true,
      default: 0,
    },
    timeSpentSeconds: {
      type: Number,
      default: 0,
    },
    userAnswers: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Composite index to fetch user's best attempt or history per week
nptelAttemptSchema.index({ userId: 1, weekId: 1, createdAt: -1 });

const NptelAttempt = mongoose.models.NptelAttempt || mongoose.model("NptelAttempt", nptelAttemptSchema);

export default NptelAttempt;
