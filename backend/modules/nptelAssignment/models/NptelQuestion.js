import mongoose from "mongoose";

const nptelQuestionSchema = new mongoose.Schema(
  {
    questionNumber: { type: Number, required: true },
    questionId: { type: String, required: true, unique: true },
    sectionTitle: { type: String, default: "Introduction to Research" },
    sectionBadge: { type: String, default: "NPTEL" },
    weekNumber: { type: Number, default: 1 },
    questionText: { type: String, required: true },
    type: { type: String, enum: ["single", "multiple"], default: "single" },
    options: [{ type: String, required: true }],
    correctAnswers: [{ type: String, required: true }],
    explanation: { type: String, default: "" },
    passageTitle: { type: String, default: "" },
    passage: { type: String, default: "" },
    points: { type: Number, default: 1 },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

nptelQuestionSchema.index({ questionNumber: 1 });
nptelQuestionSchema.index({ type: 1 });
nptelQuestionSchema.index({ weekNumber: 1 });
nptelQuestionSchema.index({ isActive: 1 });

const NptelQuestion = mongoose.model("NptelQuestion", nptelQuestionSchema);
export default NptelQuestion;
