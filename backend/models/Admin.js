import mongoose from "mongoose";
import bcrypt from "bcryptjs";

/**
 * Admin schema — supports System Admin and Department / Teacher Admins.
 */
const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, default: "Admin" },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["system_admin", "teacher", "admin"],
      default: "teacher",
    },
    department: {
      type: String,
      default: null,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

/**
 * Hash password before saving if modified.
 */
adminSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Compare entered password with stored hash.
 */
adminSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;
