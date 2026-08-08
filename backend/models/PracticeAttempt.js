import mongoose from "mongoose";

const questionSnapshotSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    category: { type: String, default: "General" },
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswer: { type: String, required: true },
    difficulty: { type: String, default: "easy" },
    explanation: { type: String, default: "" },
    marks: { type: Number, default: 1 },
    userAnswer: { type: String, default: null },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: false }
);

const practiceAttemptSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    companyId: { type: String, default: "" },
    companyName: { type: String, default: "" },
    questionCount: { type: Number, default: 15 },
    difficulty: { type: String, enum: ["easy", "medium", "hard", "mixed"], default: "easy" },
    questions: [questionSnapshotSchema],
    score: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    wrong: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    timeTaken: { type: Number, default: 0 },
  },
  { timestamps: true }
);

practiceAttemptSchema.index({ userId: 1, createdAt: -1 });
practiceAttemptSchema.index({ companyId: 1, createdAt: -1 });

const PracticeAttempt = mongoose.model("PracticeAttempt", practiceAttemptSchema);
export default PracticeAttempt;
