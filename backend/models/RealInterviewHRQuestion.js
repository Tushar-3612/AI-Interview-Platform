import mongoose from "mongoose";

const realInterviewHRQuestionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    orderIndex: { type: Number, required: true },
    question: { type: String, required: true },
    category: { type: String, required: true, default: "Behavioral" },
    difficulty: { type: String, required: true, enum: ["easy", "medium", "hard"] },
    maxMarks: { type: Number, required: true, default: 5 },
    behavioralDimensions: [{ type: String }],
    resumeReference: { type: String, default: "" },
    source: { type: String, default: "hr_behavioral" },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const RealInterviewHRQuestion = mongoose.model(
  "RealInterviewHRQuestion",
  realInterviewHRQuestionSchema
);

export default RealInterviewHRQuestion;
