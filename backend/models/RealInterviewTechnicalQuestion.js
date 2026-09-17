import mongoose from "mongoose";

const realInterviewTechnicalQuestionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    orderIndex: { type: Number, required: true },
    question: { type: String, required: true },
    expectedKnowledge: { type: String, required: true },
    difficulty: { type: String, required: true, enum: ["easy", "medium", "hard"] },
    maxMarks: { type: Number, required: true, default: 5 },
    topic: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: [
        "Fundamentals",
        "Conceptual",
        "Project Implementation",
        "Debugging",
        "Scenario",
        "Architecture",
        "System Design",
        "Technology Specific",
        "Problem Solving",
      ],
      default: "Conceptual",
    },
    source: { type: String, default: "AI_GENERATED" },
    generationMethod: { type: String, default: "RESUME_BASED_AI" },
    matchedSkill: { type: String, default: "" },
    isFallback: { type: Boolean, default: false },
    relatedSkill: { type: String, default: "" },
    relatedProject: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const RealInterviewTechnicalQuestion = mongoose.model(
  "RealInterviewTechnicalQuestion",
  realInterviewTechnicalQuestionSchema
);

export default RealInterviewTechnicalQuestion;
