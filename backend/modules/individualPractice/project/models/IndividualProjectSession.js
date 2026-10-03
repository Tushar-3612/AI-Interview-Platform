import mongoose from "mongoose";

const individualProjectSessionSchema = new mongoose.Schema(
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
    interviewKeyId: {
      type: String,
      default: "",
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard", "Mixed"],
      default: "Mixed",
    },
    questions: [
      {
        questionId: { type: String, required: true },
        question: { type: String, required: true },
        difficulty: { type: String, required: true },
        topic: { type: String, default: "Project Architecture & Workflow" },
        projectName: { type: String, default: "Project" },
        expectedKnowledge: { type: String, default: "" },
        marks: { type: Number, default: 10 },
      },
    ],
    answers: [
      {
        questionId: { type: String, required: true },
        candidateAnswer: { type: String, default: "" },
        inputMethod: { type: String, default: "text" },
        submittedAt: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: [
        "NOT_STARTED",
        "PREPARING",
        "IN_PROGRESS",
        "SUBMITTED",
        "CALCULATING",
        "COMPLETED",
        "EVALUATION_FAILED",
      ],
      default: "IN_PROGRESS",
      index: true,
    },
    progress: {
      currentQuestionIndex: { type: Number, default: 0 },
    },
    submittedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const IndividualProjectSession = mongoose.model(
  "IndividualProjectSession",
  individualProjectSessionSchema
);

export default IndividualProjectSession;
