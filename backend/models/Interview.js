import mongoose from "mongoose";

/**
 * Interview session schema — tracks each interview attempt.
 * interviewType distinguishes between:
 * - "actual" (real interview) - for the student-facing actual interview feature
 * - "mock" (practice interview) - for the student-facing mock interview feature
 * - "practice" (legacy) - for backward compatibility with admin panel
 * - "real" (legacy) - for backward compatibility with admin panel
 */
const interviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    interviewType: {
      type: String,
      enum: ["actual", "mock", "practice", "real"],
      default: "mock",
    },
    targetRound: {
      type: String,
      enum: ["all", "aptitude", "technical", "coding", "hr"],
      default: "all",
    },
    durationMinutes: {
      type: Number,
      default: 150,
    },
    companyId: { type: String, default: "" },
    status: {
      type: String,
      default: "IN_PROGRESS",
    },
    resumeFileName: { type: String, default: "" },
    resumeSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    totalQuestions: { type: Number, default: 0 },
    currentQuestionIndex: { type: Number, default: 1 },
    questionsAnswered: { type: Number, default: 0 },
    overallScore: { type: Number, default: null },
    candidateProfile: { type: mongoose.Schema.Types.Mixed, default: {} },
    generatedQuestions: { type: mongoose.Schema.Types.Mixed, default: [] },
    aptitudeQuestions: { type: mongoose.Schema.Types.Mixed, default: [] },
    technicalQuestions: { type: mongoose.Schema.Types.Mixed, default: [] },
    codingQuestions: { type: mongoose.Schema.Types.Mixed, default: [] },
    hrQuestions: { type: mongoose.Schema.Types.Mixed, default: [] },
    roundsProgress: {
      aptitude: { type: String, default: "NOT_STARTED" },
      technical: { type: String, default: "NOT_STARTED" },
      coding: { type: String, default: "NOT_STARTED" },
      hr: { type: String, default: "NOT_STARTED" },
    },
    integrityEvents: [
      {
        eventType: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        questionId: { type: String, default: "" },
        questionIndex: { type: Number, default: 1 },
        section: { type: String, default: "TECHNICAL" },
        details: { type: String, default: "" }
      }
    ],
  },
  { timestamps: true }
);

const Interview = mongoose.model("Interview", interviewSchema);

export default Interview;
