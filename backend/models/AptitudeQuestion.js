import mongoose from "mongoose";

const aptitudeQuestionSchema = new mongoose.Schema({
  questionId: { type: String, required: true, unique: true },
  category: { type: String, default: "General" },
  question: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: String, required: true },
  difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
  explanation: { type: String, default: "" },
  marks: { type: Number, default: 1 },
  companyId: { type: String, default: "" },
  companyName: { type: String, default: "" },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  lastEditedAt: { type: Date, default: null },
}, { timestamps: true });

aptitudeQuestionSchema.index({ difficulty: 1, isActive: 1 });
aptitudeQuestionSchema.index({ category: 1 });
aptitudeQuestionSchema.index({ companyId: 1 });

const AptitudeQuestion = mongoose.model("AptitudeQuestion", aptitudeQuestionSchema);
export default AptitudeQuestion;
