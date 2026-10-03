import mongoose from "mongoose";

const questionResultSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    roundType: {
      type: String,
      enum: ["APTITUDE", "TECHNICAL", "RESUME_PROJECT", "HR", "CODING"],
      required: true,
    },
    question: { type: String, required: true },
    candidateAnswer: { type: String, default: "" },
    correctAnswer: { type: String, default: "" },
    score: { type: Number, required: true, default: 0, min: 0 },
    maxScore: { type: Number, required: true, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["CORRECT", "PARTIALLY_CORRECT", "INCORRECT", "NOT_ATTEMPTED", "EVALUATION_FAILED"],
      default: "NOT_ATTEMPTED",
    },
    evaluationMode: {
      type: String,
      enum: ["DETERMINISTIC", "AI", "JUDGE0", "FALLBACK", "FAILED"],
      default: "DETERMINISTIC",
    },
    feedback: { type: String, default: "" },
    improvedAnswer: { type: String, default: "" },
  },
  { _id: true }
);

const realInterviewResultSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Interview", default: null },

    status: {
      type: String,
      enum: ["SUBMITTED", "CALCULATING", "COMPLETED", "FAILED", "EVALUATION_FAILED", "PARTIAL_EVALUATION"],
      default: "SUBMITTED",
    },


    rounds: {
      aptitude: {
        obtained: { type: Number, default: 0 },
        maximum: { type: Number, default: 20 },
        attempted: { type: Number, default: 0 },
        totalQuestions: { type: Number, default: 15 },
      },
      technical: {
        obtained: { type: Number, default: 0 },
        maximum: { type: Number, default: 35 },
        attempted: { type: Number, default: 0 },
        totalQuestions: { type: Number, default: 15 },
      },
      project: {
        obtained: { type: Number, default: 0 },
        maximum: { type: Number, default: 20 },
        attempted: { type: Number, default: 0 },
        totalQuestions: { type: Number, default: 5 },
      },
      hr: {
        obtained: { type: Number, default: 0 },
        maximum: { type: Number, default: 10 },
        attempted: { type: Number, default: 0 },
        totalQuestions: { type: Number, default: 3 },
      },
      coding: {
        obtained: { type: Number, default: 0 },
        maximum: { type: Number, default: 15 },
        attempted: { type: Number, default: 0 },
        totalQuestions: { type: Number, default: 3 },
      },
    },

    totalObtained: { type: Number, default: 0 },
    maximumMarks: { type: Number, default: 100 },
    percentage: { type: Number, default: 0 },

    attemptedQuestionsCount: { type: Number, default: 0 },
    unattemptedQuestionsCount: { type: Number, default: 0 },
    totalQuestionsCount: { type: Number, default: 41 },

    questionResults: [questionResultSchema],

    errorType: { type: String, default: null },
    keySource: { type: String, default: null },
    requiresUserApiKey: { type: Boolean, default: false },
    requiresNewApiKey: { type: Boolean, default: false },
    recoveryMessage: { type: String, default: null },

    errorDetails: { type: String, default: "" },
    submittedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

realInterviewResultSchema.index({ userId: 1, createdAt: -1 });
realInterviewResultSchema.index({ status: 1, createdAt: -1 });

// Virtual getters for compatibility with existing components / API endpoints
realInterviewResultSchema.virtual("overallScore").get(function () {
  return this.totalObtained;
});
realInterviewResultSchema.virtual("maxScore").get(function () {
  return this.maximumMarks;
});
realInterviewResultSchema.virtual("roundScores").get(function () {
  return {
    aptitude: { score: this.rounds?.aptitude?.obtained || 0, maxScore: 20, status: "COMPLETED" },
    technical: { score: this.rounds?.technical?.obtained || 0, maxScore: 35, status: "COMPLETED" },
    project: { score: this.rounds?.project?.obtained || 0, maxScore: 20, status: "COMPLETED" },
    hr: { score: this.rounds?.hr?.obtained || 0, maxScore: 10, status: "COMPLETED" },
    coding: { score: this.rounds?.coding?.obtained || 0, maxScore: 15, status: "COMPLETED" },
  };
});

realInterviewResultSchema.set("toJSON", { virtuals: true });
realInterviewResultSchema.set("toObject", { virtuals: true });

const RealInterviewResult = mongoose.model("RealInterviewResult", realInterviewResultSchema);

export default RealInterviewResult;
