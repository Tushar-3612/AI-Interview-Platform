import mongoose from "mongoose";

const optionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, enum: ["A", "B", "C", "D"] },
    text: { type: String, required: true },
  },
  { _id: false }
);

const realInterviewAptitudeQuestionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    question: { type: String, required: true },
    options: {
      type: [optionSchema],
      validate: [
        (val) => Array.isArray(val) && val.length === 4,
        "Options must contain exactly 4 choices (A, B, C, D)",
      ],
      required: true,
    },
    correctAnswer: { type: String, required: true, enum: ["A", "B", "C", "D"] },
    explanation: { type: String, required: true },
    difficulty: { type: String, required: true, enum: ["easy", "medium", "hard"] },
    maxMarks: { type: Number, required: true, default: 3 },
    topic: { type: String, required: true },
    questionType: { type: String, required: true, default: "Numerical Aptitude" },
    source: { type: String, default: "real_interview_ai" },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const RealInterviewAptitudeQuestion = mongoose.model(
  "RealInterviewAptitudeQuestion",
  realInterviewAptitudeQuestionSchema
);

export default RealInterviewAptitudeQuestion;
