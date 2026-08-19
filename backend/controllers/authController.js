import User from "../models/User.js";
import Admin from "../models/Admin.js";
import generateToken from "../utils/generateToken.js";
import { onUserRegistered } from "../utils/csvExporter.js";

/* ================================
   VALIDATION HELPERS
   ================================ */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

const validateEmail = (email) => EMAIL_REGEX.test(email);

const validatePassword = (password) => PASSWORD_REGEX.test(password);

/* ================================
   HARDCODED ADMIN CREDENTIALS
   Admin is NOT stored in MongoDB.
   ================================ */
const ADMIN_CREDENTIALS = {
  email: "sanjivani@admin.org.in",
  password: "Admin@123",
  id: "admin",
};

/* ================================
   STUDENT SIGNUP
   ================================ */
export const signup = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      confirmPassword,
      department,
      year,
      portfolio,
      github,
      linkedin,
    } = req.body;

    // Required field validation
    if (!name || !email || !password || !confirmPassword || !department || !year) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Email format validation
    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    // Optional fields URL validation
    const validateUrl = (url) => {
      if (!url) return true;
      try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch (_) {
        return false;
      }
    };

    if (portfolio && !validateUrl(portfolio)) {
      return res.status(400).json({ message: "Portfolio Website must be a valid URL (http:// or https://)" });
    }
    if (github && !validateUrl(github)) {
      return res.status(400).json({ message: "GitHub Profile must be a valid URL (http:// or https://)" });
    }
    if (linkedin && !validateUrl(linkedin)) {
      return res.status(400).json({ message: "LinkedIn Profile must be a valid URL (http:// or https://)" });
    }

    // Strong password validation
    if (!validatePassword(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters with uppercase, lowercase, number, and special character",
      });
    }

    // Password match validation
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // Duplicate email check
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    // Create and save user
    const user = await User.create({
      name,
      email,
      password,
      department,
      year,
      portfolio: portfolio || "",
      github: github || "",
      linkedin: linkedin || "",
    });

    /* Auto-update users.csv for admin export */
    onUserRegistered().catch((err) =>
      console.error("CSV export error (users):", err.message)
    );

    res.status(201).json({
      message: "Registration successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        department: user.department,
        year: user.year,
        portfolio: user.portfolio,
        github: user.github,
        linkedin: user.linkedin,
      },
    });
  } catch (error) {
    console.error("Signup Error:", error.message);
    res.status(500).json({ message: "Registration failed. Please try again." });
  }
};

/* ================================
   LOGIN (Student + Admin)
   ================================ */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Required field validation
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    /* --- Admin Login (hardcoded credentials, stored Admin doc) --- */
    if (email.toLowerCase() === ADMIN_CREDENTIALS.email) {
      if (password !== ADMIN_CREDENTIALS.password) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      let admin = await Admin.findOne({ email: ADMIN_CREDENTIALS.email });
      if (!admin) {
        admin = await Admin.create({
          name: "Admin",
          email: ADMIN_CREDENTIALS.email,
          role: "admin",
        });
      }

      const token = generateToken(admin._id.toString(), "admin");

      return res.json({
        message: "Admin login successful",
        token,
        user: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: "admin",
        },
      });
    }

    /* --- Student Login --- */
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = generateToken(user._id.toString(), "student");

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        department: user.department,
        year: user.year,
        role: "student",
      },
    });
  } catch (error) {
    console.error("Login Error:", error.message);
    res.status(500).json({ message: "Login failed. Please try again." });
  }
};

/* ================================
   FORGOT PASSWORD (OTP Generation)
   ================================ */
import { sendReportEmail } from "../utils/emailSender.js";
import { getForgotPasswordOtpEmail } from "../services/emailTemplates.js";

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: "No account found with this email" });
    }

    // Generate a secure 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpires = otpExpires;
    user.resetPasswordOtpAttempts = 0;
    await user.save();

    // Prepare and send email
    const emailData = getForgotPasswordOtpEmail(user.name, otp);
    await sendReportEmail(
      user.email,
      emailData.subject,
      `Your password reset OTP is ${otp}. It is valid for 10 minutes.`,
      emailData.html
    );

    res.status(200).json({ message: "OTP sent to your registered email" });
  } catch (error) {
    console.error("Forgot Password Error:", error.message);
    res.status(500).json({ message: "Failed to send OTP. Please try again." });
  }
};

/* ================================
   VERIFY OTP
   ================================ */
import jwt from "jsonwebtoken";

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: "No account found with this email" });
    }

    // Check if OTP was generated
    if (!user.resetPasswordOtp || !user.resetPasswordOtpExpires) {
      return res.status(400).json({ message: "No active OTP request found for this account" });
    }

    // Check OTP expiry
    if (new Date() > user.resetPasswordOtpExpires) {
      user.resetPasswordOtp = null;
      user.resetPasswordOtpExpires = null;
      user.resetPasswordOtpAttempts = 0;
      await user.save();
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }

    // Check max attempts
    if (user.resetPasswordOtpAttempts >= 3) {
      user.resetPasswordOtp = null;
      user.resetPasswordOtpExpires = null;
      user.resetPasswordOtpAttempts = 0;
      await user.save();
      return res.status(400).json({ message: "Too many incorrect attempts. Please request a new OTP." });
    }

    // Validate OTP
    if (user.resetPasswordOtp !== otp) {
      user.resetPasswordOtpAttempts += 1;
      await user.save();
      const remaining = 3 - user.resetPasswordOtpAttempts;
      if (remaining <= 0) {
        user.resetPasswordOtp = null;
        user.resetPasswordOtpExpires = null;
        user.resetPasswordOtpAttempts = 0;
        await user.save();
        return res.status(400).json({ message: "Incorrect OTP. Too many incorrect attempts. Please request a new OTP." });
      }
      return res.status(400).json({ message: `Incorrect OTP. You have ${remaining} attempts remaining.` });
    }

    // Verification successful - clear OTP fields
    user.resetPasswordOtp = null;
    user.resetPasswordOtpExpires = null;
    user.resetPasswordOtpAttempts = 0;
    await user.save();

    // Create a short-lived password reset token
    const resetToken = jwt.sign(
      { id: user._id, purpose: "password-reset" },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.status(200).json({
      message: "OTP verified successfully",
      resetToken,
    });
  } catch (error) {
    console.error("Verify OTP Error:", error.message);
    res.status(500).json({ message: "Failed to verify OTP. Please try again." });
  }
};

/* ================================
   RESET PASSWORD (Final update)
   ================================ */
export const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ message: "Reset token and new password are required" });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    if (decoded.purpose !== "password-reset") {
      return res.status(400).json({ message: "Invalid reset token purpose" });
    }

    // Validate strong password
    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters with uppercase, lowercase, number, and special character",
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: "Password reset successful. You can now login with your new password." });
  } catch (error) {
    console.error("Reset Password Error:", error.message);
    res.status(500).json({ message: "Failed to reset password. Please try again." });
  }
};
