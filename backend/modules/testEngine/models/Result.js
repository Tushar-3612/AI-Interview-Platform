import mongoose from "mongoose";

/**
 * Result schema — final evaluation after interview completion.
 */
const resultSchema = new mongoose.Schema(
  {
    interviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Interview",
      required: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    overallScore: { type: Number, min: 0, max: 100, default: 0 },
    targetRound: { type: String, default: "all" },
    resumeScore: { type: Number, min: 0, max: 100, default: 0 },
    technicalScore: { type: Number, min: 0, max: 100, default: 0 },
    codingScore: { type: Number, min: 0, max: 100, default: 0 },
    hrScore: { type: Number, min: 0, max: 100, default: 0 },
    aptitudeScore: { type: Number, min: 0, max: 100, default: 0 },

    overall: {
      obtainedMarks: { type: Number, default: 0 },
      maximumMarks: { type: Number, default: 0 },
      percentage: { type: Number, default: 0 },
    },

    sections: {
      aptitude: {
        score: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
        completed: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        unanswered: { type: Number, default: 0 },
        correct: { type: Number, default: 0 },
      },
      technical: {
        score: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
        completed: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        unanswered: { type: Number, default: 0 },
      },
      coding: {
        score: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
        completed: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        unanswered: { type: Number, default: 0 },
      },
      hr: {
        score: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
        completed: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        unanswered: { type: Number, default: 0 },
      },
    },

    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    recommendation: { type: String, default: "Needs Evaluation" },

    isEndedEarly: { type: Boolean, default: false },
    completedRounds: [{ type: String }],
    incompleteRounds: [{ type: String }],
    attemptedQuestions: { type: Number, default: 0 },
    skippedQuestions: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },

    email: {
      recipient: { type: String },
      status: {
        type: String,
        enum: ["PENDING", "SENT", "FAILED", "SIMULATED"],
        default: "PENDING",
      },
      sentAt: { type: Date },
      error: { type: String },
    },
  },
  { timestamps: true }
);

const Result = mongoose.model("Result", resultSchema);

export default Result;
