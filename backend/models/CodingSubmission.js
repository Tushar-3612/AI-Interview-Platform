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
    timeMs: { type: Number, default: 0 },
  },
  { _id: false }
);

const codingSubmissionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: "CodingQuestion" },
    title: { type: String, default: "" },
    companyId: { type: String, default: "" },
    companyName: { type: String, default: "" },
    language: { type: String, default: "JavaScript" },
    code: { type: String, required: true },
    status: { type: String, enum: ["accepted", "failed", "error", "unsupported"], default: "failed" },
    passedCount: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 },
    results: [testResultSchema],
    timeTakenMs: { type: Number, default: 0 },
  },
  { timestamps: true }
);

codingSubmissionSchema.index({ userId: 1, createdAt: -1 });
codingSubmissionSchema.index({ questionId: 1 });

const CodingSubmission = mongoose.model("CodingSubmission", codingSubmissionSchema);
export default CodingSubmission;
