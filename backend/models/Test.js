import mongoose from "mongoose";

const testCaseSchema = new mongoose.Schema({
  input: String,
  output: String,
  isHidden: { type: Boolean, default: false },
}, { _id: false });

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [{ type: String }],
  correctAnswer: { type: String },
  marks: { type: Number, default: 1 },
  negativeMarks: { type: Number, default: 0 },
  subject: { type: String },
  difficulty: { type: String, enum: ["easy", "medium", "hard"] },
  explanation: { type: String, default: "" },

  problemTitle: { type: String },
  description: { type: String },
  constraints: { type: String },
  inputFormat: { type: String },
  outputFormat: { type: String },
  sampleInput: { type: String },
  sampleOutput: { type: String },
  testCases: [testCaseSchema],
  languages: [{ type: String }],
}, { _id: true });

const testSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    companyId: { type: String, default: "" },
    testType: {
      type: String,
      enum: ["aptitude", "technical", "coding", "mixed"],
      required: true,
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Medium",
    },
    duration: { type: Number, default: 30 },
    passingMarks: { type: Number, default: 40 },
    attemptLimit: { type: Number, default: 1 },
    questionSource: {
      type: String,
      enum: ["manual", "csv", "excel", "pdf", "ai"],
      default: "manual",
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "live", "completed"],
      default: "draft",
    },
    scheduledAt: { type: Date },
    subjects: [{ type: String }],
    codingLanguages: [{ type: String }],
    questions: [questionSchema],
    evaluationMethod: {
      type: String,
      enum: ["ai", "manual"],
      default: "ai",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true }
);

const Test = mongoose.model("Test", testSchema);
export default Test;
