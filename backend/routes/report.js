import express from "express";
import authMiddleware, { authorizeRoles } from "../middleware/authMiddleware.js";
import {
  getStudentReportHandler,
  downloadStudentPDF,
  downloadStudentCSV,
  emailStudentReport,
  getBatchReportHandler,
  downloadBatchPDF,
  getCompanyReportHandler,
  getPracticeReportHandler,
  exportAllCSV,
  exportAllExcel,
  exportFullExcel,
  searchReportsHandler,
  getReportHistory,
  getCompaniesList,
} from "../controllers/reportController.js";

const router = express.Router();

router.use(authMiddleware);
router.use(authorizeRoles("admin"));

// Reports
router.get("/student/:studentId", getStudentReportHandler);
router.get("/student/:studentId/pdf", downloadStudentPDF);
router.get("/student/:studentId/csv", downloadStudentCSV);
router.post("/student/:studentId/email", emailStudentReport);

router.get("/batch", getBatchReportHandler);
router.get("/batch/pdf", downloadBatchPDF);

router.get("/company/:companyId", getCompanyReportHandler);
router.get("/practice", getPracticeReportHandler);

// Exports
router.get("/export/csv", exportAllCSV);
router.get("/export/excel", exportAllExcel);
router.get("/export/full-excel", exportFullExcel);

// Search & History
router.get("/search", searchReportsHandler);
router.get("/history", getReportHistory);
router.get("/companies/list", getCompaniesList);

export default router;
