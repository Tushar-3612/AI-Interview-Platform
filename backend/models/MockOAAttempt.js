import mongoose from "mongoose";

const mockOAAttemptSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    companyId: { type: String, default: "" },
    companyName: { type: String, default: "" },
    durationSec: { type: Number, default: 0 },
    timeTakenSec: { type: Number, default: 0 },
    aptitude: {
      total: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      wrong: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      percentage: { type: Number, default: 0 },
    },
    coding: {
      attempted: { type: Number, default: 0 },
      accepted: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    overallScore: { type: Number, default: 0 },
  },
  { timestamps: true }
);

mockOAAttemptSchema.index({ userId: 1, createdAt: -1 });
mockOAAttemptSchema.index({ companyId: 1, createdAt: -1 });

const MockOAAttempt = mongoose.model("MockOAAttempt", mockOAAttemptSchema);
export default MockOAAttempt;
