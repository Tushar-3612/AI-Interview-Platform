import express from "express";
import {
  signup,
  login,
  sendRegistrationOtp,
  verifyRegistrationOtp,
  forgotPassword,
  verifyOtp,
  resetPassword,
} from "../controllers/authController.js";
import { authLimiter } from "../../../core/middleware/rateLimiter.js";

const router = express.Router();

/* ================================
   AUTH ROUTES
   ================================ */

// Apply authLimiter across all auth endpoints
router.use(authLimiter);

// POST /api/auth/send-registration-otp — Send OTP for new student email verification
router.post("/send-registration-otp", sendRegistrationOtp);

// POST /api/auth/verify-registration-otp — Verify registration OTP & issue registration token
router.post("/verify-registration-otp", verifyRegistrationOtp);

// POST /api/auth/signup — Register a new student account (requires verified registrationToken)
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
