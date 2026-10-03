import express from "express";
import { signup, login, forgotPassword, verifyOtp, resetPassword } from "../controllers/authController.js";
import { authLimiter } from "../../../core/middleware/rateLimiter.js";

const router = express.Router();

/* ================================
   AUTH ROUTES
   ================================ */

// Apply authLimiter across all auth endpoints
router.use(authLimiter);

// POST /api/auth/signup — Register a new student account
router.post("/signup", signup);

// POST /api/auth/login — Student or admin login
router.post("/login", login);

// POST /api/auth/forgot-password — Request password reset OTP
router.post("/forgot-password", forgotPassword);

// POST /api/auth/verify-otp — Verify password reset OTP
router.post("/verify-otp", verifyOtp);

// POST /api/auth/reset-password — Reset password using token
router.post("/reset-password", resetPassword);

export default router;
