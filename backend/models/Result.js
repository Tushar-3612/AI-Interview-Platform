import mongoose from "mongoose";

/**
 * Result schema — final evaluation after interview completion.
 */
const resultSchema = new mongoose.Schema(
  {
    interviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Interview",
      required: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    overallScore: { type: Number, min: 0, max: 100 },
    resumeScore: { type: Number, min: 0, max: 100 },
    technicalScore: { type: Number, min: 0, max: 100 },
    codingScore: { type: Number, min: 0, max: 100 },
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    recommendation: { type: String },
  },
  { timestamps: true }
);

const Result = mongoose.model("Result", resultSchema);

export default Result;
