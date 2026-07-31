import express from "express";
import authMiddleware, { authorizeRoles } from "../middleware/authMiddleware.js";
import { auditLog } from "../middleware/auditMiddleware.js";
import {
  getCompanies,
  getCompanyById,
  addCompany,
  updateCompany,
  uploadCompanyLogo,
  toggleCompanyStatus,
  deleteCompany,
  getTrashedCompanies,
  restoreCompany,
  hardDeleteCompany,
  getCompanyAnalytics,
} from "../controllers/companyEnhancedController.js";

const router = express.Router();
router.use(authMiddleware);

// Students can list/view companies; only admins can modify
router.get("/", getCompanies);
router.get("/analytics", authorizeRoles("admin"), getCompanyAnalytics);
router.get("/trash", authorizeRoles("admin"), getTrashedCompanies);
router.get("/:id", getCompanyById);

// Admin-only routes
router.post("/", authorizeRoles("admin"), auditLog("create_company", "Company"), addCompany);
router.put("/:id", authorizeRoles("admin"), auditLog("update_company", "Company"), updateCompany);
router.patch("/:id/logo", authorizeRoles("admin"), uploadCompanyLogo);
router.patch("/:id/status", authorizeRoles("admin"), toggleCompanyStatus);
router.delete("/:id", authorizeRoles("admin"), auditLog("delete_company", "Company"), deleteCompany);
router.delete("/:id/hard", authorizeRoles("admin"), hardDeleteCompany);
router.post("/:id/restore", authorizeRoles("admin"), restoreCompany);

export default router;
