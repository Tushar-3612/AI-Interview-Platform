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
  starterCode: { type: String, default: "function solution() {\n  // Write your code here\n}" },
  testCases: [testCaseSchema],
  languages: [{ type: String }],
  tags: [{ type: String }],
  companyId: { type: String, default: "" },
  companyName: { type: String, default: "" },
  marks: { type: Number, default: 10 },
  timeLimit: { type: Number, default: 1000 },
  memoryLimit: { type: Number, default: 256 },
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
