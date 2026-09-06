import mongoose from "mongoose";

const problemScoreSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: "RealInterviewCodingQuestion", required: true },
    orderIndex: { type: Number, required: true },
    title: { type: String, default: "" },
    difficulty: { type: String, default: "Medium" },
    maxMarks: { type: Number, required: true }, // 20, 30, 50
    score: { type: Number, default: 0 },
    status: { type: String, default: "Not Attempted" }, // "Accepted", "Wrong Answer", "Partial", "Not Attempted"
    passedTests: { type: Number, default: 0 },
    totalTests: { type: Number, default: 0 },
    lastLanguage: { type: String, default: "" },
  },
  { _id: true }
);

const realInterviewCodingSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    candidateProfile: { type: mongoose.Schema.Types.Mixed, default: {} },
    currentQuestionIndex: { type: Number, default: 0 },
    status: { type: String, enum: ["in_progress", "completed"], default: "in_progress" },

    // Strict AI Call Tracking & Idempotency States
    generationStatus: {
      type: String,
      enum: ["NOT_STARTED", "GENERATING", "GENERATED", "FAILED"],
      default: "NOT_STARTED",
    },
    aiGenerationCalls: { type: Number, default: 0 },
    evaluationCompleted: { type: Boolean, default: false },

    totalScore: { type: Number, default: 0 },
    maxScore: { type: Number, default: 100 },
    percentage: { type: Number, default: 0 },
    overallRating: { type: String, default: "" },
    problemScores: [problemScoreSchema],
    fallbackUsed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const RealInterviewCodingSession = mongoose.model(
  "RealInterviewCodingSession",
  realInterviewCodingSessionSchema
);

export default RealInterviewCodingSession;
