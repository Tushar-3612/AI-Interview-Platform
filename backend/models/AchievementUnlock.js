import mongoose from "mongoose";

const achievementUnlockSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    key: { type: String, required: true },
    unlockedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

achievementUnlockSchema.index({ userId: 1, key: 1 }, { unique: true });

const AchievementUnlock = mongoose.model("AchievementUnlock", achievementUnlockSchema);
export default AchievementUnlock;
