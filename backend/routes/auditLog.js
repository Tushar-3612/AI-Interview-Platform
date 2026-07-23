import express from "express";
import authMiddleware, { authorizeRoles } from "../middleware/authMiddleware.js";
import { getAuditLogs, getAuditStats } from "../controllers/auditLogController.js";

const router = express.Router();
router.use(authMiddleware);
router.use(authorizeRoles("admin"));

router.get("/", getAuditLogs);
router.get("/stats", getAuditStats);

export default router;
