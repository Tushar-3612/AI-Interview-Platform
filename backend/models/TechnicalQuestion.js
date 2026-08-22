import mongoose from "mongoose";

/**
 * Technical Question schema — manually curated questions for company-specific mock interviews.
 * Admin-managed questions only. No AI-generated questions.
 */
const technicalQuestionSchema = new mongoose.Schema(
  {
    questionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    companyId: {
      type: String,
      required: [true, "Company ID is required"],
      trim: true,
      lowercase: true,
    },
    companyName: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
    },
    // Many-to-many company association (primary mechanism for eligibility)
    companyIds: {
      type: [String],
      default: [],
      lowercase: true,
    },
    topic: {
      type: String,
      required: [true, "Topic is required"],
      trim: true,
      enum: [
        "Programming & OOP",
        "Data Structures & Algorithms",
        "DBMS & SQL",
        "Operating Systems",
        "Computer Networks",
        "Software Engineering",
        "Web Development",
        "Cloud Computing",
        "Cyber Security",
        "Git & Version Control",
        "Company-specific Technologies",
        "Other",
      ],
    },
    subtopic: {
      type: String,
      trim: true,
      default: "",
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Medium",
    },
    questionType: {
      type: String,
      enum: ["Conceptual", "Scenario", "Project", "Code-tracing", "Practical"],
      default: "Conceptual",
    },
    question: {
      type: String,
      required: [true, "Question text is required"],
      trim: true,
    },
    // MCQ support
    options: {
      type: [String],
      default: [],
      validate: {
        validator: (v) => !v || v.length === 0 || v.length >= 2,
        message: "A question must have at least 2 options",
      },
    },
    correctAnswer: {
      type: String,
      trim: true,
      default: "",
    },
    // Legacy free-text answer (kept for backward compatibility)
    expectedAnswer: {
      type: String,
      trim: true,
      default: "",
    },
    explanation: {
      type: String,
      trim: true,
      default: "",
    },
    marks: {
      type: Number,
      default: 1,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lastEditedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
technicalQuestionSchema.index({ companyId: 1, isActive: 1, isDeleted: 1 });
technicalQuestionSchema.index({ companyIds: 1, isActive: 1, isDeleted: 1 });
technicalQuestionSchema.index({ companyId: 1, topic: 1 });
technicalQuestionSchema.index({ companyId: 1, difficulty: 1 });

// Keep companyId and companyIds in sync
technicalQuestionSchema.pre("save", function (next) {
  const ids = new Set(this.companyIds || []);
  if (this.companyId) ids.add(this.companyId);
  this.companyIds = [...ids].filter(Boolean);
  next();
});

const TechnicalQuestion = mongoose.model("TechnicalQuestion", technicalQuestionSchema);

export default TechnicalQuestion;
