import mongoose from "mongoose";

const testAssignmentSchema = new mongoose.Schema(
  {
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Test",
      required: true,
    },
    assignType: {
      type: String,
      enum: ["department", "year", "section", "individual", "multiple", "all"],
      required: true,
    },
    assignValue: { type: String, default: "" },
    studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    startedCount: { type: Number, default: 0 },
    completedCount: { type: Number, default: 0 },
    notAttemptedCount: { type: Number, default: 0 },
    autoSubmittedCount: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "completed", "archived"],
      default: "active",
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true }
);

testAssignmentSchema.virtual("totalStudents").get(function () {
  return this.studentIds.length;
});

testAssignmentSchema.virtual("pendingCount").get(function () {
  return this.totalStudents - this.completedCount - this.autoSubmittedCount;
});

testAssignmentSchema.set("toJSON", { virtuals: true });
testAssignmentSchema.set("toObject", { virtuals: true });

const TestAssignment = mongoose.model("TestAssignment", testAssignmentSchema);
export default TestAssignment;
