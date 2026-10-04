import mongoose from "mongoose";

const codingAssessmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    durationMinutes: {
      type: Number,
      required: true,
      default: 60,
    },
    questions: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "CodingQuestion",
          required: true,
        },
        order: {
          type: Number,
          default: 1,
        },
        marks: {
          type: Number,
          default: 10,
        },
      },
    ],
    totalMarks: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    departmentScope: {
      type: String,
      default: "global",
      trim: true,
    },
    creatorRole: {
      type: String,
      enum: ["system_admin", "teacher", "admin"],
      default: "system_admin",
    },
  },
  {
    timestamps: true,
  }
);

codingAssessmentSchema.index({ isActive: 1, createdAt: -1 });

const CodingAssessment = mongoose.model("CodingAssessment", codingAssessmentSchema);
export default CodingAssessment;
