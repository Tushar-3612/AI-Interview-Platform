import express from "express";
import authMiddleware, { authorizeRoles } from "../middleware/authMiddleware.js";
import {
  sendTestAssignment,
  sendResultEmail,
  sendReminder,
  sendWelcome,
  sendPasswordReset,
  getEmailStatus,
} from "../controllers/emailController.js";

const router = express.Router();
router.use(authMiddleware);
router.use(authorizeRoles("admin"));

router.get("/status", getEmailStatus);
router.post("/test-assignment", sendTestAssignment);
router.post("/result/:testResultId", sendResultEmail);
router.post("/reminder", sendReminder);
router.post("/welcome", sendWelcome);
router.post("/password-reset", sendPasswordReset);

export default router;
