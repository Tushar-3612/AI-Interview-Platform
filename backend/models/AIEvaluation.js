import mongoose from "mongoose";

const subjectScoreSchema = new mongoose.Schema({
  subject: { type: String },
  score: { type: Number, default: 0 },
  analysis: { type: String, default: "" },
}, { _id: false });

const companyRecommendationSchema = new mongoose.Schema({
  company: { type: String },
  matchPercentage: { type: Number, default: 0 },
  rationale: { type: String, default: "" },
}, { _id: false });

const scoreWithFeedbackSchema = new mongoose.Schema({
  score: { type: Number, default: null },
  feedback: { type: String, default: "" },
}, { _id: false });

const evaluationSectionSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ["pending", "completed", "skipped", "failed"],
    default: "pending",
  },
  error: { type: String, default: "" },
  retryCount: { type: Number, default: 0 },
}, { _id: false, discriminatorKey: "type" });

const aptitudeEvaluationSchema = new mongoose.Schema({
  status: { type: String, enum: ["pending", "completed", "skipped", "failed"], default: "pending" },
  error: { type: String, default: "" },
  accuracy: { type: Number, default: null },
  speed: { type: Number, default: null },
  logicalThinking: scoreWithFeedbackSchema,
  numericalAbility: scoreWithFeedbackSchema,
  verbalAbility: scoreWithFeedbackSchema,
  patternRecognition: scoreWithFeedbackSchema,
  strengths: [{ type: String }],
  weaknesses: [{ type: String }],
  suggestions: [{ type: String }],
}, { _id: false });

const technicalEvaluationSchema = new mongoose.Schema({
  status: { type: String, enum: ["pending", "completed", "skipped", "failed"], default: "pending" },
  error: { type: String, default: "" },
  subjectScores: [subjectScoreSchema],
  strongTopics: [{ type: String }],
  weakTopics: [{ type: String }],
  learningSuggestions: [{ type: String }],
}, { _id: false });

const codingEvaluationSchema = new mongoose.Schema({
  status: { type: String, enum: ["pending", "completed", "skipped", "failed"], default: "pending" },
  error: { type: String, default: "" },
  problemSolving: scoreWithFeedbackSchema,
  logic: scoreWithFeedbackSchema,
  timeComplexity: scoreWithFeedbackSchema,
  codeQuality: scoreWithFeedbackSchema,
  optimization: scoreWithFeedbackSchema,
  namingConvention: scoreWithFeedbackSchema,
  overallFeedback: { type: String, default: "" },
  optimizationSuggestions: [{ type: String }],
}, { _id: false });

const resumeMatchSchema = new mongoose.Schema({
  status: { type: String, enum: ["pending", "completed", "skipped", "failed"], default: "pending" },
  error: { type: String, default: "" },
  skillGap: [{ type: String }],
  missingSkills: [{ type: String }],
  resumeAccuracy: { type: Number, default: null },
  suggestions: [{ type: String }],
}, { _id: false });

const companyMatchSchema = new mongoose.Schema({
  status: { type: String, enum: ["pending", "completed", "skipped", "failed"], default: "pending" },
  error: { type: String, default: "" },
  recommendations: [companyRecommendationSchema],
}, { _id: false });

const interviewReadinessSchema = new mongoose.Schema({
  status: { type: String, enum: ["pending", "completed", "skipped", "failed"], default: "pending" },
  error: { type: String, default: "" },
  technicalReadiness: { type: Number, default: null },
  codingReadiness: { type: Number, default: null },
  communicationReadiness: { type: Number, default: null },
  overallPlacementReadiness: { type: Number, default: null },
}, { _id: false });

const aiFeedbackSchema = new mongoose.Schema({
  status: { type: String, enum: ["pending", "completed", "skipped", "failed"], default: "pending" },
  error: { type: String, default: "" },
  positivePoints: [{ type: String }],
  weakAreas: [{ type: String }],
  recommendedSubjects: [{ type: String }],
  practiceStrategy: { type: String, default: "" },
  nextLearningPath: { type: String, default: "" },
}, { _id: false });

const aiEvaluationSchema = new mongoose.Schema({
  testResultId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TestResult",
    required: true,
    unique: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Test",
    required: true,
  },

  status: {
    type: String,
    enum: ["pending", "in_progress", "completed", "partial", "failed"],
    default: "pending",
  },

  aptitudeEvaluation: aptitudeEvaluationSchema,
  technicalEvaluation: technicalEvaluationSchema,
  codingEvaluation: codingEvaluationSchema,
  resumeMatch: resumeMatchSchema,
  companyMatch: companyMatchSchema,
  interviewReadiness: interviewReadinessSchema,
  aiFeedback: aiFeedbackSchema,

  processingStartedAt: { type: Date },
  processingCompletedAt: { type: Date },
  retryCount: { type: Number, default: 0 },
  lastError: { type: String, default: "" },
}, { timestamps: true });

aiEvaluationSchema.index({ userId: 1, createdAt: -1 });
aiEvaluationSchema.index({ testId: 1 });
aiEvaluationSchema.index({ status: 1 });

const AIEvaluation = mongoose.model("AIEvaluation", aiEvaluationSchema);
export default AIEvaluation;
