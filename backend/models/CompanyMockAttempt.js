import mongoose from "mongoose";

/**
 * Company Mock Attempt schema — tracks each company-specific mock interview attempt.
 * Stores all answers, security events, coding submissions, and results.
 */
const companyMockAttemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    companyId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "paused", "completed", "auto_submitted", "expired", "abandoned"],
      default: "not_started",
    },
    // Configuration
    config: {
      aptitudeCount: { type: Number, default: 15 },
      technicalCount: { type: Number, default: 15 },
      codingCount: { type: Number, default: 2 },
      durationMinutes: { type: Number, default: 60 },
    },
    // Server-authoritative timer
    // Duration in ms is config.durationMinutes * 60000.
    // Active elapsed = now - startedAt - totalPausedMs - (pausedAt ? now - pausedAt : 0)
    // expiresAt is shifted forward on every resume by the paused duration so it
    // always represents the absolute deadline of ACTIVE assessment time.
    startedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    pausedAt: { type: Date, default: null },
    totalPausedMs: { type: Number, default: 0 },
    submittedAt: { type: Date, default: null },
    lastActiveAt: { type: Date, default: Date.now },
    // Current progress
    currentSection: {
      type: String,
      enum: ["aptitude", "technical", "coding"],
      default: "aptitude",
    },
    currentQuestionIndex: { type: Number, default: 0 },
    // Selected question IDs for this attempt (used on resume)
    selectedQuestions: {
      aptitude: { type: [String], default: [] },
      technical: { type: [String], default: [] },
      coding: { type: [String], default: [] },
    },
    // Answers - Aptitude (MCQ)
    aptitudeAnswers: [
      {
        questionId: String,
        selectedOption: String,
        isCorrect: Boolean,
        timeTakenMs: Number,
      },
    ],
    // Answers - Technical (MCQ)
    technicalAnswers: [
      {
        questionId: String,
        answer: String, // selected option text (MCQ)
        selectedOption: String,
        isCorrect: Boolean,
        timeTakenMs: Number,
      },
    ],
    // Answers - Coding
    codingAnswers: [
      {
        questionId: String,
        language: String,
        code: String,
        status: String, // accepted/failed/compile_error/runtime_error/time_limit/error/skipped
        passedCount: Number,
        totalCount: Number,
        results: { type: [mongoose.Schema.Types.Mixed], default: [] },
        timeTakenMs: Number,
        submittedAt: { type: Date, default: null },
      },
    ],
    // Scores
    scores: {
      aptitude: {
        total: { type: Number, default: 0 },
        correct: { type: Number, default: 0 },
        wrong: { type: Number, default: 0 },
        skipped: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
        marksObtained: { type: Number, default: 0 },
        totalMarks: { type: Number, default: 0 },
      },
      technical: {
        total: { type: Number, default: 0 },
        correct: { type: Number, default: 0 },
        wrong: { type: Number, default: 0 },
        answered: { type: Number, default: 0 },
        skipped: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
        marksObtained: { type: Number, default: 0 },
        totalMarks: { type: Number, default: 0 },
      },
      coding: {
        attempted: { type: Number, default: 0 },
        accepted: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        marksObtained: { type: Number, default: 0 },
        totalMarks: { type: Number, default: 0 },
      },
      overall: { type: Number, default: 0 },
    },
    // Security events (persistent, raw event log)
    securityEvents: [
      {
        type: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        section: { type: String, default: null },
        questionId: { type: String, default: null },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
      },
    ],
    // Security events (legacy counters/summaries)
    security: {
      tabSwitchCount: { type: Number, default: 0 },
      tabSwitches: [
        {
          timestamp: Date,
          questionId: String,
          remainingTime: Number,
        },
      ],
      fullscreenExitCount: { type: Number, default: 0 },
      fullscreenExits: [
        {
          timestamp: Date,
          questionId: String,
        },
      ],
      copyAttempts: { type: Number, default: 0 },
      pasteAttempts: { type: Number, default: 0 },
      cutAttempts: { type: Number, default: 0 },
      rightClickAttempts: { type: Number, default: 0 },
    },
    // Coding drafts (per language)
    codingDrafts: {
      type: Map,
      of: String,
      default: {},
    },
    selectedCodingLanguage: {
      type: String,
      default: "java",
    },
    // Feedback
    feedback: {
      weakAreas: [String],
      strongAreas: [String],
      recommendation: String,
    },
  },
  { timestamps: true }
);

// Indexes
companyMockAttemptSchema.index({ userId: 1, companyId: 1, createdAt: -1 });
companyMockAttemptSchema.index({ userId: 1, status: 1 });
companyMockAttemptSchema.index({ companyId: 1, status: 1 });

const CompanyMockAttempt = mongoose.model("CompanyMockAttempt", companyMockAttemptSchema);

export default CompanyMockAttempt;
