import mongoose from "mongoose";

const testResultSchema = new mongoose.Schema(
  {
    index: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    isHidden: { type: Boolean, default: false },
    input: { type: String, default: "" },
    expected: { type: String, default: "" },
    actual: { type: String, default: "" },
    error: { type: String, default: "" },
    status: { type: String, default: "" },
    timeMs: { type: Number, default: 0 },
  },
  { _id: false }
);

const codingSubmissionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false, index: true },
    candidateId: { type: String, default: "" },
    interviewId: { type: String, default: "", index: true },
    roundId: { type: String, default: "coding" },
    questionId: { type: mongoose.Schema.Types.Mixed, required: false },
    title: { type: String, default: "" },
    companyId: { type: String, default: "" },
    companyName: { type: String, default: "" },
    language: { type: String, default: "cpp" },
    code: { type: String, required: true },
    status: {
      type: String,
      enum: ["completed", "accepted", "failed", "compile_error", "runtime_error", "time_limit", "error", "unsupported"],
      default: "failed",
    },
    passedCount: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    executionTime: { type: String, default: "0.00" },
    memory: { type: Number, default: 0 },
    compileOutput: { type: String, default: "" },
    results: [testResultSchema],
    timeTakenMs: { type: Number, default: 0 },
  },
  { timestamps: true }
);

codingSubmissionSchema.index({ userId: 1, createdAt: -1 });
codingSubmissionSchema.index({ interviewId: 1, questionId: 1 });

const CodingSubmission = mongoose.model("CodingSubmission", codingSubmissionSchema);
export default CodingSubmission;
