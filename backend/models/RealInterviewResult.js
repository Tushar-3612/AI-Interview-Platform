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
    status: {
      type: String,
      enum: ["CORRECT", "PARTIALLY_CORRECT", "INCORRECT", "NOT_ATTEMPTED", "FALLBACK_UNVERIFIED"],
      default: "NOT_ATTEMPTED",
    },
    score: { type: Number, required: true, default: 0, min: 0 },
    maxScore: { type: Number, required: true, default: 0, min: 0 },
    evaluationMode: {
      type: String,
      enum: ["DETERMINISTIC", "AI", "JUDGE0", "FALLBACK"],
      default: "DETERMINISTIC",
    },
    correctAnswer: { type: String, default: "" },
    expectedAnswer: { type: String, default: "" },
    feedback: { type: String, default: "" },
    missingPoints: [{ type: String }],
    improvedAnswer: { type: String, default: "" },
    // Coding specific fields
    submission: {
      sourceCode: { type: String, default: "" },
      language: { type: String, default: "" },
      executionStatus: { type: String, default: "" },
      passedTests: { type: Number, default: 0 },
      totalTests: { type: Number, default: 0 },
    },
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
      enum: [
        "SUBMITTED",
        "EVALUATING_APTITUDE",
        "EVALUATING_TECHNICAL",
        "EVALUATING_PROJECT",
        "EVALUATING_HR",
        "EVALUATING_CODING",
        "CALCULATING_RESULT",
        "COMPLETED",
        "EVALUATION_FAILED",
      ],
      default: "SUBMITTED",
    },
    evaluationStage: { type: String, default: "Interview Submitted" },
    evaluationProgress: { type: Number, default: 0, min: 0, max: 100 },
    overallScore: { type: Number, default: 0, min: 0, max: 450 },
    maxScore: { type: Number, default: 450 },
    percentage: { type: Number, default: 0, min: 0, max: 100 },
    roundScores: {
      aptitude: {
        score: { type: Number, default: 0 },
        maxScore: { type: Number, default: 50 },
        percentage: { type: Number, default: 0 },
        status: { type: String, default: "NOT_STARTED" },
      },
      technical: {
        score: { type: Number, default: 0 },
        maxScore: { type: Number, default: 100 },
        percentage: { type: Number, default: 0 },
        status: { type: String, default: "NOT_STARTED" },
      },
      project: {
        score: { type: Number, default: 0 },
        maxScore: { type: Number, default: 100 },
        percentage: { type: Number, default: 0 },
        status: { type: String, default: "NOT_STARTED" },
      },
      hr: {
        score: { type: Number, default: 0 },
        maxScore: { type: Number, default: 100 },
        percentage: { type: Number, default: 0 },
        status: { type: String, default: "NOT_STARTED" },
      },
      coding: {
        score: { type: Number, default: 0 },
        maxScore: { type: Number, default: 100 },
        percentage: { type: Number, default: 0 },
        status: { type: String, default: "NOT_STARTED" },
      },
    },
    questionResults: [questionResultSchema],
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    recommendation: { type: String, default: "Needs Evaluation" },
    errorDetails: { type: String, default: "" },
    submittedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const RealInterviewResult = mongoose.model("RealInterviewResult", realInterviewResultSchema);

export default RealInterviewResult;
