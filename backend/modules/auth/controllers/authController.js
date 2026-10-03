import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Admin from "../../administration/models/Admin.js";
import RegistrationOtp from "../models/RegistrationOtp.js";
import generateToken from "../utils/generateToken.js";
import { onUserRegistered } from "../../administration/utils/csvExporter.js";
import { normalizeYear, normalizeDepartment } from "../../student/utils/academicConfig.js";
import {
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginAttempts,
} from "../services/loginSecurityService.js";
import {
  checkOtpSendEligibility,
  recordOtpDispatched,
  clearActiveOtpState,
  acquireOtpLock,
  releaseOtpLock,
  normalizeEmail,
  normalizeIp,
  OTP_VALIDITY_SECONDS,
} from "../services/otpSecurityService.js";
import { sendReportEmail, maskEmail } from "../../administration/utils/emailSender.js";
import {
  getForgotPasswordOtpEmail,
  getRegistrationOtpEmail,
} from "../../administration/services/emailTemplates.js";

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
   1. SEND REGISTRATION OTP
   Pre-verification before account creation
   ================================ */
export const sendRegistrationOtp = async (req, res) => {
  const clientIp = normalizeIp(req.ip || req.headers["x-forwarded-for"]);
  const rawEmail = req.body?.email;
  const rawName = req.body?.name;

  if (!rawEmail) {
    return res.status(400).json({ message: "Email is required" });
  }

  if (!validateEmail(rawEmail)) {
    return res.status(400).json({ message: "Please enter a valid email address" });
  }

  const cleanEmail = normalizeEmail(rawEmail);

  // Check if account already exists
  const existingUser = await User.findOne({ email: cleanEmail });
  if (existingUser) {
    return res.status(409).json({ message: "An account with this email already exists" });
  }

  // Acquire concurrency lock to prevent race conditions
  const lockToken = await acquireOtpLock(cleanEmail);

  try {
    // Check eligibility: active OTP (no new OTP while active), 2-per-2-hour limit, IP anti-abuse
    const eligibility = await checkOtpSendEligibility(cleanEmail, clientIp, "registration");
    if (!eligibility.allowed) {
      if (lockToken) await releaseOtpLock(cleanEmail, lockToken);
      res.setHeader("Retry-After", eligibility.retryAfterSeconds || 60);
      return res.status(eligibility.statusCode || 429).json({
        success: false,
        code: eligibility.code,
        message: eligibility.message,
        retryAfter: eligibility.retryAfterSeconds,
      });
    }

    // Generate secure 6-digit OTP with EXACTLY 3-minute validity
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_VALIDITY_SECONDS * 1000);

    // Persist registration OTP
    await RegistrationOtp.findOneAndUpdate(
      { email: cleanEmail },
      {
        otp,
        name: rawName || "Student",
        expiresAt,
        attempts: 0,
      },
      { upsert: true, new: true }
    );

    // Dispatch email
    const emailData = getRegistrationOtpEmail(rawName, otp);
    console.log(`[Auth] Dispatching registration OTP email to ${maskEmail(cleanEmail)} from IP ${clientIp}`);

    await sendReportEmail(
      cleanEmail,
      emailData.subject,
      `Your registration verification code is ${otp}. It is valid for 3 minutes.`,
      emailData.html
    );

    // Record dispatched OTP in distributed store
    await recordOtpDispatched(cleanEmail, clientIp, "registration");

    if (lockToken) await releaseOtpLock(cleanEmail, lockToken);

    return res.status(200).json({
      success: true,
      message: "OTP sent. It is valid for 3 minutes.",
      expiresInSeconds: OTP_VALIDITY_SECONDS,
    });
  } catch (error) {
    if (lockToken) await releaseOtpLock(cleanEmail, lockToken);
    // Cleanup pending OTP on delivery failure so user is not locked
    await RegistrationOtp.deleteOne({ email: cleanEmail }).catch(() => {});
    await clearActiveOtpState(cleanEmail, "registration").catch(() => {});
    console.error(`[Auth] Send Registration OTP Error for ${maskEmail(cleanEmail)}:`, error.message);
    return res.status(500).json({ message: "Failed to send verification OTP. Please try again." });
  }
};

/* ================================
   2. VERIFY REGISTRATION OTP
   Issues short-lived verification token
   ================================ */
export const verifyRegistrationOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const cleanEmail = normalizeEmail(email);
    const cleanOtp = String(otp).trim();

    const record = await RegistrationOtp.findOne({ email: cleanEmail });
    if (!record || new Date() > record.expiresAt) {
      if (record) await RegistrationOtp.deleteOne({ _id: record._id });
      await clearActiveOtpState(cleanEmail, "registration");
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }

    // Check max attempts (3 max)
    if (record.attempts >= 3) {
      await RegistrationOtp.deleteOne({ _id: record._id });
      await clearActiveOtpState(cleanEmail, "registration");
      return res.status(400).json({ message: "Too many incorrect attempts. Please request a new OTP." });
    }

    // Validate OTP
    if (record.otp !== cleanOtp) {
      record.attempts += 1;
      await record.save();
      const remaining = 3 - record.attempts;
      if (remaining <= 0) {
        await RegistrationOtp.deleteOne({ _id: record._id });
        await clearActiveOtpState(cleanEmail, "registration");
        return res.status(400).json({
          message: "Incorrect OTP. Too many incorrect attempts. Please request a new OTP.",
        });
      }
      return res.status(400).json({
        message: `Incorrect OTP. You have ${remaining} attempt${remaining > 1 ? "s" : ""} remaining.`,
      });
    }

    // OTP Verified Successfully -> CONSUME/DELETE IMMEDIATELY (Single Use)
    await RegistrationOtp.deleteOne({ _id: record._id });
    await clearActiveOtpState(cleanEmail, "registration");

    // Issue short-lived email verification token (15m) tied strictly to normalized email
    const registrationToken = jwt.sign(
      { email: cleanEmail, purpose: "email-verification" },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
      registrationToken,
    });
  } catch (error) {
    console.error(`[Auth] Verify Registration OTP Error:`, error.message);
    return res.status(500).json({ message: "Failed to verify OTP. Please try again." });
  }
};

/* ================================
   3. STUDENT SIGNUP
   Requires server-authoritative registrationToken
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
      registrationToken,
    } = req.body;

    // Required field validation
    if (!name || !email || !password || !confirmPassword || !department || !year) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const cleanEmail = normalizeEmail(email);

    // Email format validation
    if (!validateEmail(cleanEmail)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    // CRITICAL: Require verified email ownership via server-authoritative token
    if (!registrationToken) {
      return res.status(400).json({
        message: "Email verification required. Please verify your email with OTP before creating your account.",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(registrationToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({
        message: "Invalid or expired email verification token. Please verify your email again.",
      });
    }

    if (
      decoded.purpose !== "email-verification" ||
      normalizeEmail(decoded.email) !== cleanEmail
    ) {
      return res.status(400).json({
        message: "Verification token does not match the registration email.",
      });
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
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    // Create and save user with emailVerified: true
    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password,
      department: normalizeDepartment(department),
      year: normalizeYear(year),
      portfolio: portfolio || "",
      github: github || "",
      linkedin: linkedin || "",
      emailVerified: true,
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
   4. LOGIN (Student + Admin)
   ================================ */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientIp = normalizeIp(req.ip || req.headers["x-forwarded-for"]);

    // Required field validation
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    const cleanEmail = normalizeEmail(email);

    // Check distributed failed login rate limits (10/IP, 5/Account per 15 min)
    const rateLimitStatus = await checkLoginRateLimit(clientIp, cleanEmail);
    if (!rateLimitStatus.allowed) {
      res.setHeader("Retry-After", rateLimitStatus.retryAfterSeconds);
      return res.status(429).json({
        success: false,
        code: "TOO_MANY_FAILED_LOGINS",
        message: `Too many failed login attempts. Please try again after ${Math.ceil(rateLimitStatus.retryAfterSeconds / 60)} minutes.`,
        retryAfter: rateLimitStatus.retryAfterSeconds,
      });
    }

    /* --- 1. Check Admin / Teacher Accounts in Admin collection --- */
    let admin = await Admin.findOne({ email: cleanEmail });

    // Handle initial / fallback System Admin seeding if logging in with hardcoded master admin credentials
    if (!admin && cleanEmail === ADMIN_CREDENTIALS.email) {
      if (password === ADMIN_CREDENTIALS.password) {
        admin = await Admin.create({
          name: "System Admin",
          email: ADMIN_CREDENTIALS.email,
          password: ADMIN_CREDENTIALS.password,
          role: "system_admin",
          department: null,
          isActive: true,
        });
      }
    }

    if (admin) {
      // Check account activation
      if (admin.isActive === false) {
        return res.status(403).json({ message: "Your account is deactivated. Please contact the System Administrator." });
      }

      // Verify password
      let isMatch = false;
      if (admin.password) {
        isMatch = await admin.matchPassword(password);
      }
      // Fallback for initial legacy admin record if plain password existed
      if (!isMatch && cleanEmail === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
        admin.password = ADMIN_CREDENTIALS.password;
        admin.role = "system_admin";
        await admin.save();
        isMatch = true;
      }

      if (!isMatch) {
        await recordFailedLogin(clientIp, cleanEmail);
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Successful login: reset failed login attempts counter
      await resetLoginAttempts(clientIp, cleanEmail);

      admin.lastLogin = new Date();
      await admin.save();

      const normalizedRole = admin.role === "admin" ? "system_admin" : admin.role;
      const token = generateToken(admin._id.toString(), normalizedRole, admin.department);

      return res.json({
        message: `${normalizedRole === "system_admin" ? "System Admin" : "Teacher"} login successful`,
        token,
        user: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: normalizedRole,
          department: admin.department || null,
        },
      });
    }

    /* --- 2. Student Login --- */
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      await recordFailedLogin(clientIp, cleanEmail);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      await recordFailedLogin(clientIp, cleanEmail);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Successful login: reset failed login attempts counter
    await resetLoginAttempts(clientIp, cleanEmail);

    const token = generateToken(user._id.toString(), "student", user.department);

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
        isPremium: Boolean(user.isPremium),
      },
    });
  } catch (error) {
    console.error("Login Error:", error.message);
    res.status(500).json({ message: "Login failed. Please try again." });
  }
};

/* ================================
   5. FORGOT PASSWORD (OTP Generation)
   Applies 3-minute validity, active OTP blocking, 2-per-2-hour limit
   ================================ */
export const forgotPassword = async (req, res) => {
  const clientIp = normalizeIp(req.ip || req.headers["x-forwarded-for"]);
  const rawEmail = req.body?.email;

  if (!rawEmail) {
    return res.status(400).json({ message: "Email is required" });
  }

  if (!validateEmail(rawEmail)) {
    return res.status(400).json({ message: "Please enter a valid email address" });
  }

  const cleanEmail = normalizeEmail(rawEmail);

  const user = await User.findOne({ email: cleanEmail });
  if (!user) {
    return res.status(404).json({ message: "No account found with this email" });
  }

  // Acquire concurrency lock
  const lockToken = await acquireOtpLock(cleanEmail);

  try {
    // Check eligibility: active OTP (no new OTP while active), 2-per-2-hour limit, IP anti-abuse
    const eligibility = await checkOtpSendEligibility(cleanEmail, clientIp, "forgot-password");
    if (!eligibility.allowed) {
      if (lockToken) await releaseOtpLock(cleanEmail, lockToken);
      res.setHeader("Retry-After", eligibility.retryAfterSeconds || 60);
      return res.status(eligibility.statusCode || 429).json({
        success: false,
        code: eligibility.code,
        message: eligibility.message,
        retryAfter: eligibility.retryAfterSeconds,
      });
    }

    // Also check active DB state (fallback for active OTP)
    if (user.resetPasswordOtp && user.resetPasswordOtpExpires && new Date() < user.resetPasswordOtpExpires) {
      if (lockToken) await releaseOtpLock(cleanEmail, lockToken);
      return res.status(429).json({
        success: false,
        code: "ACTIVE_OTP_EXISTS",
        message: "Your current OTP is still valid. Please use it.",
      });
    }

    // Generate secure 6-digit OTP with EXACTLY 3-minute validity
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + OTP_VALIDITY_SECONDS * 1000);

    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpires = otpExpires;
    user.resetPasswordOtpAttempts = 0;
    await user.save();

    // Prepare and send email
    const emailData = getForgotPasswordOtpEmail(user.name, otp);
    console.log(`[Auth] Dispatching password reset OTP email to ${maskEmail(user.email)} from IP ${clientIp}`);

    await sendReportEmail(
      user.email,
      emailData.subject,
      `Your password reset OTP is ${otp}. It is valid for 3 minutes.`,
      emailData.html
    );

    // Record dispatched OTP in distributed store
    await recordOtpDispatched(cleanEmail, clientIp, "forgot-password");

    if (lockToken) await releaseOtpLock(cleanEmail, lockToken);

    res.status(200).json({
      success: true,
      message: "OTP sent. It is valid for 3 minutes.",
      expiresInSeconds: OTP_VALIDITY_SECONDS,
    });
  } catch (error) {
    if (lockToken) await releaseOtpLock(cleanEmail, lockToken);
    // Cleanup DB state on delivery failure so user is not locked out
    user.resetPasswordOtp = null;
    user.resetPasswordOtpExpires = null;
    await user.save().catch(() => {});
    await clearActiveOtpState(cleanEmail, "forgot-password").catch(() => {});
    console.error(`[Auth] Forgot Password Error for ${maskEmail(cleanEmail)}:`, error.message);
    res.status(500).json({ message: "Failed to send OTP. Please try again." });
  }
};

/* ================================
   6. VERIFY FORGOT PASSWORD OTP
   ================================ */
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const cleanEmail = normalizeEmail(email);
    const cleanOtp = String(otp).trim();

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({ message: "No account found with this email" });
    }

    // Check if OTP was generated
    if (!user.resetPasswordOtp || !user.resetPasswordOtpExpires) {
      return res.status(400).json({ message: "No active OTP request found for this account" });
    }

    // Check OTP expiry (3 minutes)
    if (new Date() > user.resetPasswordOtpExpires) {
      user.resetPasswordOtp = null;
      user.resetPasswordOtpExpires = null;
      user.resetPasswordOtpAttempts = 0;
      await user.save();
      await clearActiveOtpState(cleanEmail, "forgot-password");
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }

    // Check max attempts
    if (user.resetPasswordOtpAttempts >= 3) {
      user.resetPasswordOtp = null;
      user.resetPasswordOtpExpires = null;
      user.resetPasswordOtpAttempts = 0;
      await user.save();
      await clearActiveOtpState(cleanEmail, "forgot-password");
      return res.status(400).json({ message: "Too many incorrect attempts. Please request a new OTP." });
    }

    // Validate OTP
    if (user.resetPasswordOtp !== cleanOtp) {
      user.resetPasswordOtpAttempts += 1;
      await user.save();
      const remaining = 3 - user.resetPasswordOtpAttempts;
      if (remaining <= 0) {
        user.resetPasswordOtp = null;
        user.resetPasswordOtpExpires = null;
        user.resetPasswordOtpAttempts = 0;
        await user.save();
        await clearActiveOtpState(cleanEmail, "forgot-password");
        return res.status(400).json({
          message: "Incorrect OTP. Too many incorrect attempts. Please request a new OTP.",
        });
      }
      return res.status(400).json({
        message: `Incorrect OTP. You have ${remaining} attempt${remaining > 1 ? "s" : ""} remaining.`,
      });
    }

    // Verification successful - CLEAR OTP IMMEDIATELY (Single Use)
    user.resetPasswordOtp = null;
    user.resetPasswordOtpExpires = null;
    user.resetPasswordOtpAttempts = 0;
    await user.save();
    await clearActiveOtpState(cleanEmail, "forgot-password");

    // Create a short-lived password reset token (15m)
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
   7. RESET PASSWORD (Final update)
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
