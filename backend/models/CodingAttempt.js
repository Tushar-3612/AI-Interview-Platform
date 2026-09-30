import mongoose from "mongoose";

const questionProgressSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CodingQuestion",
      required: true,
    },
    status: {
      type: String,
      enum: ["NOT_VISITED", "ATTEMPTED", "SOLVED", "PARTIAL", "FAILED"],
      default: "NOT_VISITED",
    },
    passedTests: {
      type: Number,
      default: 0,
    },
    totalTests: {
      type: Number,
      default: 0,
    },
    marks: {
      type: Number,
      default: 0,
    },
    maxMarks: {
      type: Number,
      default: 10,
    },
    language: {
      type: String,
      default: "python",
    },
    lastSavedCode: {
      type: String,
      default: "",
    },
    submittedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const codingAttemptSchema = new mongoose.Schema(
  {
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CodingAssessment",
      required: true,
      index: true,
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["IN_PROGRESS", "SUBMITTED", "AUTO_SUBMITTED", "EXPIRED"],
      default: "IN_PROGRESS",
    },
    totalMarks: {
      type: Number,
      default: 0,
    },
    obtainedMarks: {
      type: Number,
      default: 0,
    },
    percentage: {
      type: Number,
      default: 0,
    },
    questionProgress: [questionProgressSchema],
    aiFeedback: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

codingAttemptSchema.index({ candidateId: 1, assessmentId: 1, status: 1 });
codingAttemptSchema.index({ candidateId: 1, createdAt: -1 });

const CodingAttempt = mongoose.model("CodingAttempt", codingAttemptSchema);
export default CodingAttempt;
