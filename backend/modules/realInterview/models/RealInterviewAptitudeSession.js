import mongoose from "mongoose";

const aptitudeAnswerSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: "RealInterviewAptitudeQuestion", required: true },
    question: { type: String, required: true },
    selectedOption: { type: String, enum: ["A", "B", "C", "D", ""], default: "" },
    correctAnswer: { type: String, enum: ["A", "B", "C", "D"], required: true },
    isCorrect: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    maxMarks: { type: Number, default: 3 },
    difficulty: { type: String, required: true },
    explanation: { type: String, default: "" },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const realInterviewAptitudeSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    answers: [aptitudeAnswerSchema],
    questionsAnswered: { type: Number, default: 0 },
    status: { type: String, enum: ["in_progress", "completed"], default: "in_progress" },
    totalScore: { type: Number, default: 0 },
    maxScore: { type: Number, default: 50 },
    percentage: { type: Number, default: 0 },
    overallRating: { type: String, default: "" },
    evaluationCompleted: { type: Boolean, default: false },
    evaluatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const RealInterviewAptitudeSession = mongoose.model(
  "RealInterviewAptitudeSession",
  realInterviewAptitudeSessionSchema
);

export default RealInterviewAptitudeSession;
