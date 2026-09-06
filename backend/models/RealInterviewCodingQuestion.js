import mongoose from "mongoose";

const testCaseSchema = new mongoose.Schema(
  {
    input: { type: String, default: "" },
    expected: { type: String, default: "" },
    isHidden: { type: Boolean, default: false },
  },
  { _id: true }
);

const exampleSchema = new mongoose.Schema(
  {
    input: { type: String, default: "" },
    output: { type: String, default: "" },
    explanation: { type: String, default: "" },
  },
  { _id: false }
);

const starterCodeSchema = new mongoose.Schema(
  {
    python: { type: String, default: "" },
    javascript: { type: String, default: "" },
    java: { type: String, default: "" },
    cpp: { type: String, default: "" },
  },
  { _id: false }
);

const realInterviewCodingQuestionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    orderIndex: { type: Number, required: true }, // 1, 2, 3
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    difficulty: { type: String, required: true, enum: ["Easy", "Medium", "Hard"] },
    marks: { type: Number, required: true }, // 20 for Q1, 30 for Q2, 50 for Q3
    topic: { type: String, default: "DSA" },
    category: { type: String, default: "Problem Solving" },
    constraints: [{ type: String }],
    examples: [exampleSchema],
    starterCode: { type: starterCodeSchema, default: () => ({}) },
    functionSignature: { type: String, default: "" },
    supportedLanguages: [{ type: String, default: ["python", "javascript", "java", "cpp"] }],
    timeLimit: { type: Number, default: 2000 },
    memoryLimit: { type: Number, default: 128000 },
    visibleTestCases: [testCaseSchema],
    hiddenTestCases: [testCaseSchema],
    source: { type: String, default: "real_interview_coding" },
  },
  { timestamps: true }
);

const RealInterviewCodingQuestion = mongoose.model(
  "RealInterviewCodingQuestion",
  realInterviewCodingQuestionSchema
);

export default RealInterviewCodingQuestion;
