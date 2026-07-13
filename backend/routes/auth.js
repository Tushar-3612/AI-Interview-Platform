import express from "express";
import { signup, login } from "../controllers/authController.js";

const router = express.Router();

/* ================================
   AUTH ROUTES
   ================================ */

// POST /api/auth/signup — Register a new student account
router.post("/signup", signup);

// POST /api/auth/login — Student or admin login
router.post("/login", login);

export default router;
