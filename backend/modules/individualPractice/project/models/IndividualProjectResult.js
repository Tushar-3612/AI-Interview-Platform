import mongoose from "mongoose";

const individualProjectResultSchema = new mongoose.Schema(
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
      unique: true,
      index: true,
    },
    sourceMode: {
      type: String,
      enum: ["RESUME", "INTERVIEW_KEY"],
      default: "RESUME",
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard", "Mixed"],
      default: "Mixed",
    },
    obtainedScore: {
      type: Number,
      required: true,
      default: 0,
    },
    maxScore: {
      type: Number,
      default: 100,
    },
    percentage: {
      type: Number,
      required: true,
      default: 0,
    },
    attemptedCount: {
      type: Number,
      default: 0,
    },
    unattemptedCount: {
      type: Number,
      default: 10,
    },
    performanceStatus: {
      type: String,
      enum: [
        "NOT ASSESSED",
        "Needs Significant Improvement",
        "Developing",
        "Strong Performance",
      ],
      default: "NOT ASSESSED",
    },
    feedback: {
      performanceInsight: { type: String, default: "" },
      whatWentWell: [{ type: String }],
      weakAreas: [{ type: String }],
      whatToImprove: [{ type: String }],
      recommendedNextStep: { type: String, default: "" },
    },
    questionResults: [
      {
        questionId: { type: String, required: true },
        question: { type: String, required: true },
        difficulty: { type: String, default: "Medium" },
        topic: { type: String, default: "Project Architecture & Workflow" },
        projectName: { type: String, default: "Project" },
        attempted: { type: Boolean, default: false },
        candidateAnswer: { type: String, default: "" },
        rawScore: { type: Number, default: 0 },
        rawMaxScore: { type: Number, default: 10 },
        normalizedScore: { type: Number, default: 0 },
        feedback: { type: String, default: "" },
        strengths: [{ type: String }],
        missingPoints: [{ type: String }],
        improvedAnswer: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

const IndividualProjectResult = mongoose.model(
  "IndividualProjectResult",
  individualProjectResultSchema
);

export default IndividualProjectResult;
