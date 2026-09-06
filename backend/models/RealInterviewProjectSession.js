import mongoose from "mongoose";

const projectAnswerSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: "RealInterviewProjectQuestion", required: true },
    question: { type: String, required: true },
    difficulty: { type: String, required: true },
    maxScore: { type: Number, default: 5 },
    topic: { type: String, default: "" },
    category: { type: String, default: "" },
    projectName: { type: String, default: "" },
    candidateAnswer: { type: String, default: "" },
    score: { type: Number, default: 0, min: 0 },
    rating: { type: String, default: "pending" },
    correctPoints: [{ type: String }],
    missingPoints: [{ type: String }],
    incorrectPoints: [{ type: String }],
    grammarIssues: [{ type: String }],
    feedback: { type: String, default: "" },
    betterAnswer: { type: String, default: "" },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const realInterviewProjectSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    currentQuestionIndex: { type: Number, default: 0 },
    strongAnswerCount: { type: Number, default: 0 },
    hardUnlocked: { type: Boolean, default: false },
    questionsAnswered: { type: Number, default: 0 },
    answers: [projectAnswerSchema],
    status: { type: String, enum: ["in_progress", "completed"], default: "in_progress" },

    // Strict AI Call Tracking & Idempotency States
    generationStatus: {
      type: String,
      enum: ["NOT_STARTED", "GENERATING", "GENERATED", "FAILED"],
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
    overallScore: { type: Number, default: 0 },
    overallRating: { type: String, default: "" },
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    finalFeedback: { type: String, default: "" },
  },
  { timestamps: true }
);

const RealInterviewProjectSession = mongoose.model(
  "RealInterviewProjectSession",
  realInterviewProjectSessionSchema
);

export default RealInterviewProjectSession;
