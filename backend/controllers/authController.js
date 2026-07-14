import User from "../models/User.js";
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

    /* --- Admin Login (hardcoded, not in MongoDB) --- */
    if (email.toLowerCase() === ADMIN_CREDENTIALS.email) {
      if (password !== ADMIN_CREDENTIALS.password) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const token = generateToken(ADMIN_CREDENTIALS.id, "admin");

      return res.json({
        message: "Admin login successful",
        token,
        user: {
          id: ADMIN_CREDENTIALS.id,
          name: "Admin",
          email: ADMIN_CREDENTIALS.email,
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
