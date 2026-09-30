import mongoose from "mongoose";

const codingTestCaseSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CodingQuestion",
      required: true,
      index: true,
    },
    input: {
      type: String,
      required: true,
    },
    expectedOutput: {
      type: String,
      required: true,
    },
    isSample: {
      type: Boolean,
      default: false,
    },
    isHidden: {
      type: Boolean,
      default: true,
    },
    weight: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

codingTestCaseSchema.index({ questionId: 1, isSample: 1 });
codingTestCaseSchema.index({ questionId: 1, isHidden: 1 });

const CodingTestCase = mongoose.model("CodingTestCase", codingTestCaseSchema);
export default CodingTestCase;
