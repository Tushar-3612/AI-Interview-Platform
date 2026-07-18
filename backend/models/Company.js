import mongoose from "mongoose";

/**
 * Company schema for practice interview targets.
 */
const companySchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, "Company ID is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
    },
    color: {
      type: String,
      default: "#2563EB",
    },
    technical: {
      type: Number,
      default: 0,
    },
    coding: {
      type: Number,
      default: 0,
    },
    hr: {
      type: Number,
      default: 0,
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Medium",
    },
  },
  {
    timestamps: true,
  }
);

const Company = mongoose.model("Company", companySchema);

export default Company;
