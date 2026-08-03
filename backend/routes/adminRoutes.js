import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/authMiddleware.js";
import {
  getAdminStats,
  getAllUsers,
  getAllResults,
  getAllInterviews,
  exportCSV,
  syncCSV,
} from "../controllers/adminController.js";

const router = express.Router();

// All admin routes require authentication AND admin role
router.use(authMiddleware, authorizeRoles("admin"));

// GET /api/admin/stats — dashboard summary stats
router.get("/stats", getAdminStats);

// GET /api/admin/users — all registered students
router.get("/users", getAllUsers);

// GET /api/admin/results — all interview results (with populated user/interview data)
router.get("/results", getAllResults);

// GET /api/admin/interviews — all interview sessions
router.get("/interviews", getAllInterviews);

// GET /api/admin/export/:type — download CSV (users | interviews | answers | results)
router.get("/export/:type", exportCSV);

// POST /api/admin/sync — rebuild all CSVs from MongoDB
router.post("/sync", syncCSV);

export default router;
