import mongoose from "mongoose";

/**
 * Answer schema — stores individual question responses per interview.
 * Extended to support voice transcripts & contextual AI follow-up questions.
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
      default: "technical",
    },
    section: { type: String, default: "TECHNICAL" },
    question: { type: String, required: true },
    answer: { type: String, default: "" }, // Official response text used for grading & reports
    transcript: { type: String, default: "" }, // Exact final Speech-to-Text transcript
    inputMethod: {
      type: String,
      enum: ["VOICE", "TEXT"],
      default: "TEXT",
    },
    mode: {
      type: String,
      enum: ["text", "voice"],
      default: "text",
    },
    duration: { type: Number, default: 0, min: 0 }, // Audio response duration in seconds
    evaluation: {
      score: { type: Number, min: 0, max: 100 },
      feedback: { type: String, default: "" },
      needsFollowUp: { type: Boolean, default: false },
      followUpQuestion: { type: String, default: "" },
      reason: { type: String, default: "" },
    },
    isFollowUp: { type: Boolean, default: false },
    parentQuestionId: { type: String, default: "" },
    score: { type: Number, min: 0, max: 100, default: 0 },
    feedback: { type: String, default: "" },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Answer = mongoose.model("Answer", answerSchema);

export default Answer;
