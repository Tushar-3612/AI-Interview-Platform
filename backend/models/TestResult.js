import mongoose from "mongoose";

const codingResultSchema = new mongoose.Schema({
  language: { type: String, default: "" },
  code: { type: String, default: "" },
  compilationStatus: {
    type: String,
    enum: ["pending", "success", "error"],
    default: "pending",
  },
  executionStatus: {
    type: String,
    enum: ["pending", "passed", "failed", "error"],
    default: "pending",
  },
  visibleTestCasesPassed: { type: Number, default: 0 },
  visibleTestCasesTotal: { type: Number, default: 0 },
  hiddenTestCasesPassed: { type: Number, default: 0 },
  hiddenTestCasesTotal: { type: Number, default: 0 },
  executionTime: { type: Number, default: 0 },
  memoryUsage: { type: Number, default: 0 },
  marksObtained: { type: Number, default: 0 },
}, { _id: false });

const questionResultSchema = new mongoose.Schema({
  questionIndex: { type: Number, required: true },
  questionId: { type: String, default: "" },
  question: { type: String, default: "" },
  type: { type: String, enum: ["MCQ", "True/False", "Descriptive", "Coding"] },
  subject: { type: String, default: "" },
  difficulty: { type: String, enum: ["easy", "medium", "hard"] },
  studentAnswer: { type: String, default: "" },
  correctAnswer: { type: String, default: "" },
  marks: { type: Number, default: 0 },
  negativeMarks: { type: Number, default: 0 },
  obtainedMarks: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ["correct", "wrong", "skipped", "not_visited", "marked", "pending_evaluation"],
    default: "not_visited",
  },
  timeTaken: { type: Number, default: 0 },
  language: { type: String, default: "" },
  codingResult: codingResultSchema,
}, { _id: false });

const sectionSummarySchema = new mongoose.Schema({
  section: { type: String, required: true },
  totalQuestions: { type: Number, default: 0 },
  attempted: { type: Number, default: 0 },
  correct: { type: Number, default: 0 },
  wrong: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 },
  pendingEvaluation: { type: Number, default: 0 },
  totalMarks: { type: Number, default: 0 },
  obtainedMarks: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
}, { _id: false });

const rankingSchema = new mongoose.Schema({
  testRank: { type: Number, default: 0 },
  departmentRank: { type: Number, default: 0 },
  overallRank: { type: Number, default: 0 },
  totalParticipants: { type: Number, default: 0 },
  departmentParticipants: { type: Number, default: 0 },
}, { _id: false });

const auditLogSchema = new mongoose.Schema({
  startedAt: { type: Date },
  submittedAt: { type: Date },
  timeTaken: { type: Number, default: 0 },
  autoSubmitted: { type: Boolean, default: false },
  autoSubmitReason: { type: String, default: "" },
  tabSwitchCount: { type: Number, default: 0 },
  browserCloseDetected: { type: Boolean, default: false },
  networkFailureDetected: { type: Boolean, default: false },
}, { _id: false });

const testResultSchema = new mongoose.Schema({
  attemptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TestAttempt",
    required: true,
    unique: true,
  },
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Test",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  audit: auditLogSchema,

  totalQuestions: { type: Number, default: 0 },
  attempted: { type: Number, default: 0 },
  correct: { type: Number, default: 0 },
  wrong: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 },
  notVisited: { type: Number, default: 0 },
  pendingEvaluation: { type: Number, default: 0 },
  totalMarks: { type: Number, default: 0 },
  obtainedMarks: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  passed: { type: Boolean, default: false },
  grade: { type: String, default: "" },
  passingMarks: { type: Number, default: 0 },
  passingPercentage: { type: Number, default: 0 },

  questions: [questionResultSchema],
  sections: [sectionSummarySchema],

  ranking: rankingSchema,

  studentInfo: {
    name: { type: String },
    email: { type: String },
    department: { type: String },
    year: { type: String },
  },

  processedAt: { type: Date, default: Date.now },
  processingVersion: { type: String, default: "1.0" },
  aiEvaluationReady: { type: Boolean, default: false },
  aiEvaluationDone: { type: Boolean, default: false },
}, { timestamps: true });

testResultSchema.index({ testId: 1, "ranking.testRank": 1 });
testResultSchema.index({ userId: 1, testId: 1 });

const TestResult = mongoose.model("TestResult", testResultSchema);
export default TestResult;
