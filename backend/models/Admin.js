import mongoose from "mongoose";

/**
 * Admin schema — reference collection for admin metadata.
 * Admin login credentials are hardcoded in authController.
 */
const adminSchema = new mongoose.Schema(
  {
    name: { type: String, default: "Admin" },
    email: { type: String, required: true, unique: true, lowercase: true },
    role: { type: String, default: "admin" },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;
