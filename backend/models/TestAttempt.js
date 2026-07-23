import mongoose from "mongoose";

const answerSchema = new mongoose.Schema({
  questionIndex: { type: Number, required: true },
  questionId: { type: String, default: "" },
  type: { type: String, enum: ["MCQ", "True/False", "Descriptive", "Coding"], default: "MCQ" },
  answer: { type: String, default: "" },
  code: { type: String, default: "" },
  language: { type: String, default: "" },
  status: {
    type: String,
    enum: ["not_visited", "answered", "skipped", "marked"],
    default: "not_visited",
  },
  marks: { type: Number, default: 0 },
  scoredMarks: { type: Number, default: 0 },
}, { _id: false });

const tabSwitchSchema = new mongoose.Schema({
  count: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const testAttemptSchema = new mongoose.Schema({
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Test",
    required: true,
  },
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TestAssignment",
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["not_started", "started", "completed", "auto_submitted"],
    default: "not_started",
  },
  answers: [answerSchema],
  currentQuestionIndex: { type: Number, default: 0 },
  tabSwitches: [tabSwitchSchema],
  tabSwitchCount: { type: Number, default: 0 },
  startTime: { type: Date },
  endTime: { type: Date },
  totalScore: { type: Number, default: 0 },
  autoSubmitReason: { type: String, default: "" },
  submittedAt: { type: Date },
}, { timestamps: true });

testAttemptSchema.index({ userId: 1, testId: 1 }, { unique: true });

const TestAttempt = mongoose.model("TestAttempt", testAttemptSchema);
export default TestAttempt;
