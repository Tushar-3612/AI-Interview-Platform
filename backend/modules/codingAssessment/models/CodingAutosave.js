import mongoose from "mongoose";

const codingAutosaveSchema = new mongoose.Schema(
  {
    attemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CodingAttempt",
      required: true,
      index: true,
    },
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CodingQuestion",
      required: true,
      index: true,
    },
    language: {
      type: String,
      required: true,
      default: "python",
    },
    sourceCode: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

codingAutosaveSchema.index({ attemptId: 1, questionId: 1, language: 1 }, { unique: true });

const CodingAutosave = mongoose.model("CodingAutosave", codingAutosaveSchema);
export default CodingAutosave;
