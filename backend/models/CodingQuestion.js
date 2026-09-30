import mongoose from "mongoose";

const testCaseSchema = new mongoose.Schema({
  input: { type: String, required: true },
  expected: { type: String, required: true },
  isHidden: { type: Boolean, default: false },
}, { _id: true });

const exampleSchema = new mongoose.Schema({
  input: { type: String, default: "" },
  output: { type: String, default: "" },
  explanation: { type: String, default: "" },
}, { _id: false });

const codingQuestionSchema = new mongoose.Schema({
  questionId: { type: String, trim: true, default: "" },
  title: { type: String, required: true, trim: true },
  difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], required: true },
  category: { type: String, default: "" },
  problemStatement: { type: String, required: true },
  description: { type: String, default: "" },
  inputFormat: { type: String, default: "" },
  outputFormat: { type: String, default: "" },
  constraints: { type: String, default: "" },
  sampleInput: { type: String, default: "" },
  sampleOutput: { type: String, default: "" },
  explanation: { type: String, default: "" },
  examples: [exampleSchema],
  starterCode: { type: mongoose.Schema.Types.Mixed, default: "function solution() {\n  // Write your code here\n}" },
  starterCodeByLanguage: {
    python: { type: String, default: "" },
    cpp: { type: String, default: "" },
    java: { type: String, default: "" },
    c: { type: String, default: "" },
    javascript: { type: String, default: "" },
  },
  supportedLanguages: {
    type: [{ type: String, enum: ["python", "cpp", "java", "c", "javascript"] }],
    default: ["python", "cpp", "java", "c", "javascript"],
  },
  outputComparison: {
    mode: { type: String, enum: ["exact", "trimmed", "whitespace", "float"], default: "trimmed" },
  },
  testCases: [testCaseSchema],
  languages: [{ type: String }],
  tags: [{ type: String }],
  companyId: { type: String, default: "" },
  companyName: { type: String, default: "" },
  marks: { type: Number, default: 10 },
  timeLimit: { type: Number, default: 2 },
  memoryLimit: { type: Number, default: 256 },
  isPublished: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  lastEditedAt: { type: Date, default: null },
}, { timestamps: true });

codingQuestionSchema.index({ questionId: 1 });
codingQuestionSchema.index({ difficulty: 1, isActive: 1 });
codingQuestionSchema.index({ companyId: 1 });
codingQuestionSchema.index({ tags: 1 });
codingQuestionSchema.index({ category: 1 });

const CodingQuestion = mongoose.model("CodingQuestion", codingQuestionSchema);
export default CodingQuestion;
