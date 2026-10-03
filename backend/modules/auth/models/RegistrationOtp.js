import mongoose from "mongoose";

/**
 * RegistrationOtp schema for pending email verifications prior to student account creation.
 * Auto-expires documents via MongoDB TTL index after 3 minutes (180s).
 */
const registrationOtpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      default: "Student",
      trim: true,
    },
    otp: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL index auto-deletes expired records
    },
    attempts: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const RegistrationOtp = mongoose.model("RegistrationOtp", registrationOtpSchema);

export default RegistrationOtp;
