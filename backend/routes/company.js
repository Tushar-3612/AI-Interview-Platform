import express from "express";
import authMiddleware, { authorizeRoles } from "../middleware/authMiddleware.js";
import { auditLog } from "../middleware/auditMiddleware.js";
import {
  getCompanies,
  getCompanyById,
  addCompany,
  updateCompany,
  deleteCompany,
  getCompanyAnalytics,
} from "../controllers/companyEnhancedController.js";

const router = express.Router();
router.use(authMiddleware);
router.use(authorizeRoles("admin"));

router.get("/", getCompanies);
router.get("/analytics", getCompanyAnalytics);
router.get("/:id", getCompanyById);
router.post("/", auditLog("create_company", "Company"), addCompany);
router.put("/:id", auditLog("update_company", "Company"), updateCompany);
router.delete("/:id", auditLog("delete_company", "Company"), deleteCompany);

export default router;
