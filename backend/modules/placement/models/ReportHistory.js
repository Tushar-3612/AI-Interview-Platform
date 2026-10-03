import mongoose from "mongoose";

const reportHistorySchema = new mongoose.Schema({
  reportType: {
    type: String,
    enum: ["student", "batch", "company", "practice", "interview", "full"],
    required: true,
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: true,
  },
  filters: {
    studentId: { type: String },
    department: { type: String },
    year: { type: String },
    companyId: { type: String },
    testType: { type: String },
    dateFrom: { type: Date },
    dateTo: { type: Date },
  },
  downloadFormat: {
    type: String,
    enum: ["pdf", "csv", "excel"],
  },
  downloadCount: { type: Number, default: 0 },
  fileSize: { type: Number },
  status: {
    type: String,
    enum: ["generated", "downloaded", "emailed", "failed"],
    default: "generated",
  },
  emailedTo: { type: String },
  emailedAt: { type: Date },
}, { timestamps: true });

reportHistorySchema.index({ generatedBy: 1, createdAt: -1 });
reportHistorySchema.index({ reportType: 1 });

const ReportHistory = mongoose.model("ReportHistory", reportHistorySchema);
export default ReportHistory;
