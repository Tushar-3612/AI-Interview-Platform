import mongoose from "mongoose";

/**
 * Question Exposure schema — tracks which questions have been shown to each student.
 * Used to prevent question repetition across mock interview attempts.
 * 
 * Compound index on (studentId, companyId, questionId) ensures uniqueness.
 */
const questionExposureSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    companyId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    questionId: {
      type: String,
      required: true,
      trim: true,
    },
    questionType: {
      type: String,
      enum: ["aptitude", "technical", "coding"],
      required: true,
    },
    attemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyMockAttempt",
      default: null,
    },
    shownAt: {
      type: Date,
      default: Date.now,
    },
    answeredAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound index for uniqueness and efficient queries
questionExposureSchema.index({ studentId: 1, companyId: 1, questionId: 1 }, { unique: true });
questionExposureSchema.index({ studentId: 1, companyId: 1, questionType: 1 });
questionExposureSchema.index({ studentId: 1, companyId: 1, attemptId: 1 });

const QuestionExposure = mongoose.model("QuestionExposure", questionExposureSchema);

export default QuestionExposure;
