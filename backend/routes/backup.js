import express from "express";
import authMiddleware, { authorizeRoles } from "../middleware/authMiddleware.js";
import { backupAllCSV, backupExcel, getBackupStatus } from "../controllers/backupController.js";

const router = express.Router();
router.use(authMiddleware);
router.use(authorizeRoles("admin"));

router.post("/csv", backupAllCSV);
router.get("/excel", backupExcel);
router.get("/status", getBackupStatus);

export default router;
