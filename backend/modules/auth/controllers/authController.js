import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Admin from "../../administration/models/Admin.js";
import generateToken from "../utils/generateToken.js";
import { onUserRegistered } from "../../administration/utils/csvExporter.js";
import { normalizeYear, normalizeDepartment } from "../../student/utils/academicConfig.js";
import {
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginAttempts,
} from "../services/loginSecurityService.js";

/* ================================
   VALIDATION HELPERS
   ================================ */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

const validateEmail = (email) => EMAIL_REGEX.test(email);

const validatePassword = (password) => PASSWORD_REGEX.test(password);

const normalizeEmail = (email) => String(email || "").toLowerCase().trim();

const normalizeIp = (ip) => {
  if (!ip) return "unknown_ip";
  let clean = String(ip).trim();
  if (clean.startsWith("::ffff:")) clean = clean.substring(7);
  if (clean === "::1") clean = "127.0.0.1";
  return clean;
};

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
   1. STUDENT SIGNUP (Direct Account Creation)
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

    const cleanEmail = normalizeEmail(email);

    // Email format validation
    if (!validateEmail(cleanEmail)) {
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
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    // Create and save user directly
    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password,
      department: normalizeDepartment(department),
      year: normalizeYear(year),
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
   2. LOGIN (Student + Admin)
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
   3. FORGOT PASSWORD (Disabled notice)
   ================================ */
export const forgotPassword = async (req, res) => {
  return res.status(200).json({
    success: false,
    message: "Password reset is currently unavailable. Please contact the administrator.",
  });
};

/* ================================
   4. VERIFY OTP (Disabled notice)
   ================================ */
export const verifyOtp = async (req, res) => {
  return res.status(400).json({
    success: false,
    message: "OTP verification is disabled. Please contact the administrator.",
  });
};

/* ================================
   5. RESET PASSWORD (Disabled notice)
   ================================ */
export const resetPassword = async (req, res) => {
  return res.status(400).json({
    success: false,
    message: "Password reset is currently unavailable. Please contact the administrator.",
  });
};
