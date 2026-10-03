import mongoose from "mongoose";

const realInterviewProjectQuestionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    orderIndex: { type: Number, required: true },
    question: { type: String, required: true },
    expectedKnowledge: { type: String, required: true },
    difficulty: { type: String, required: true, enum: ["easy", "medium", "hard"] },
    maxMarks: { type: Number, required: true, default: 5 },
    topic: { type: String, required: true },
    category: { type: String, default: "Architecture" },
    projectName: { type: String, default: "" },
    source: { type: String, default: "resume_project" },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const RealInterviewProjectQuestion = mongoose.model(
  "RealInterviewProjectQuestion",
  realInterviewProjectQuestionSchema
);

export default RealInterviewProjectQuestion;
