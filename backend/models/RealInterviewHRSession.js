import mongoose from "mongoose";

const hrAnswerSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: "RealInterviewHRQuestion", required: true },
    question: { type: String, required: true },
    difficulty: { type: String, required: true },
    maxScore: { type: Number, default: 5 },
    category: { type: String, default: "" },
    behavioralDimensions: [{ type: String }],
    resumeReference: { type: String, default: "" },
    candidateAnswer: { type: String, default: "" },
    score: { type: Number, default: 0, min: 0 },
    rating: { type: String, default: "pending" },
    reasoningStrengths: [{ type: String }],
    concerns: [{ type: String }],
    feedback: { type: String, default: "" },
    betterAnswer: { type: String, default: "" },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const realInterviewHRSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    candidateProfile: { type: mongoose.Schema.Types.Mixed, default: {} },
    currentQuestionIndex: { type: Number, default: 0 },
    questionsAnswered: { type: Number, default: 0 },
    answers: [hrAnswerSchema],
    status: { type: String, enum: ["in_progress", "completed"], default: "in_progress" },

    // Strict AI Call Tracking & Idempotency States
    generationStatus: {
      type: String,
      enum: ["NOT_STARTED", "GENERATING", "PARTIAL", "GENERATED", "FAILED"],
      default: "NOT_STARTED",
    },
    evaluationStatus: {
      type: String,
      enum: ["NOT_STARTED", "EVALUATING", "COMPLETED", "FAILED"],
      default: "NOT_STARTED",
    },
    aiGenerationCalls: { type: Number, default: 0 },
    aiEvaluationCalls: { type: Number, default: 0 },
    evaluationCompleted: { type: Boolean, default: false },
    evaluationStartedAt: { type: Date, default: null },
    evaluationCompletedAt: { type: Date, default: null },
    totalScore: { type: Number, default: 0 },
    maxScore: { type: Number, default: 100 },
    percentage: { type: Number, default: 0 },
    overallRating: { type: String, default: "" },
    behavioralProfile: { type: mongoose.Schema.Types.Mixed, default: {} },
    consistencyObservations: [{ type: String }],
    strengths: [{ type: String }],
    areasForImprovement: [{ type: String }],
    finalFeedback: { type: String, default: "" },
    fallbackUsed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const RealInterviewHRSession = mongoose.model(
  "RealInterviewHRSession",
  realInterviewHRSessionSchema
);

export default RealInterviewHRSession;
