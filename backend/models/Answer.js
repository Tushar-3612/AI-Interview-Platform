import mongoose from "mongoose";

/**
 * Answer schema — stores individual question responses per interview.
 */
const answerSchema = new mongoose.Schema(
  {
    interviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Interview",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    questionId: { type: String, required: true },
    questionType: {
      type: String,
      enum: ["resume", "technical", "coding"],
    },
    question: { type: String },
    answer: { type: String },
    score: { type: Number, min: 0, max: 100 },
    feedback: { type: String },
  },
  { timestamps: true }
);

const Answer = mongoose.model("Answer", answerSchema);

export default Answer;
