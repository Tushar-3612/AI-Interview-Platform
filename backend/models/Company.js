import mongoose from "mongoose";

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
    color: { type: String, default: "#2563EB" },
    logo: { type: String, default: "" },
    description: { type: String, default: "" },
    website: { type: String, default: "" },
    location: { type: String, default: "" },
    package: { type: String, default: "" },
    eligibleDepartments: [{ type: String }],
    eligibleYears: [{ type: String }],
    requiredSkills: [{ type: String }],
    selectionProcess: { type: String, default: "" },
    passingPercentage: { type: Number, default: 0 },
    minimumCGPA: { type: Number, default: 0 },
    interviewType: {
      type: String,
      enum: ["practice", "real", "both"],
      default: "practice",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    technical: { type: Number, default: 0 },
    coding: { type: Number, default: 0 },
    hr: { type: Number, default: 0 },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Medium",
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    lastUpdated: { type: Date, default: null },
  },
  { timestamps: true }
);

const Company = mongoose.model("Company", companySchema);
export default Company;
