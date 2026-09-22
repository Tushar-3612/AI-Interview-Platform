import mongoose from "mongoose";

const realInterviewCodingSubmissionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: "RealInterviewCodingQuestion", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    language: { type: String, required: true },
    sourceCode: { type: String, required: true },
    status: { type: String, required: true }, // "Accepted", "Wrong Answer", "Time Limit Exceeded", "Compilation Error", "Runtime Error"
    passedTests: { type: Number, default: 0 },
    totalTests: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    maxMarks: { type: Number, default: 20 },
    executionTime: { type: String, default: "0.00" },
    memory: { type: Number, default: 0 },
    compileOutput: { type: String, default: "" },
    testResults: [
      {
        index: Number,
        passed: Boolean,
        isHidden: Boolean,
        input: String,
        expected: String,
        actual: String,
        error: String,
        status: String,
        timeMs: Number,
      },
    ],
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const RealInterviewCodingSubmission = mongoose.model(
  "RealInterviewCodingSubmission",
  realInterviewCodingSubmissionSchema
);

export default RealInterviewCodingSubmission;
