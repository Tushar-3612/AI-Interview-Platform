import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  role: { type: String, enum: ["admin", "student", "system"], default: "system" },
  action: { type: String, required: true },
  resource: { type: String, default: "" },
  resourceId: { type: String, default: "" },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String, default: "" },
  userAgent: { type: String, default: "" },
  timestamp: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["success", "failure"],
    default: "success",
  },
}, { timestamps: false });

auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);
export default AuditLog;
