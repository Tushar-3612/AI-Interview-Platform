import mongoose from "mongoose";

const studentPreferenceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["bookmark", "favoriteCompany", "codingDraft"],
      required: true,
    },
    questionId: { type: String, default: "" },
    companyId: { type: String, default: "" },
    language: { type: String, default: "JavaScript" },
    code: { type: String, default: "" },
  },
  { timestamps: true }
);

studentPreferenceSchema.index({ userId: 1, type: 1, questionId: 1, language: 1 }, { unique: true, partialFilterExpression: { questionId: { $ne: "" }, type: "codingDraft" } });
studentPreferenceSchema.index({ userId: 1, type: 1, questionId: 1 }, { unique: true, partialFilterExpression: { questionId: { $ne: "" }, type: { $in: ["bookmark", "favoriteCompany"] } } });
studentPreferenceSchema.index({ userId: 1, type: 1, companyId: 1 }, { unique: true, partialFilterExpression: { companyId: { $ne: "" } } });

const StudentPreference = mongoose.model("StudentPreference", studentPreferenceSchema);
export default StudentPreference;
