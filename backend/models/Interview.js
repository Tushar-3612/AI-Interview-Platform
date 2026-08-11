import mongoose from "mongoose";

/**
 * Interview session schema — tracks each interview attempt.
 * interviewType distinguishes between:
 * - "actual" (real interview) - for the student-facing actual interview feature
 * - "mock" (practice interview) - for the student-facing mock interview feature
 * - "practice" (legacy) - for backward compatibility with admin panel
 * - "real" (legacy) - for backward compatibility with admin panel
 */
const interviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    interviewType: {
      type: String,
      enum: ["actual", "mock", "practice", "real"],
      default: "mock",
    },
    companyId: { type: String, default: "" },
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
    overallScore: { type: Number, default: null },
  },
  { timestamps: true }
);

const Interview = mongoose.model("Interview", interviewSchema);

export default Interview;
