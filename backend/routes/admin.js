import express from "express";
import authMiddleware, { authorizeRoles } from "../middleware/authMiddleware.js";
import {
  getStats,
  getStudents,
  getStudentDetails,
  updateStudent,
  deleteStudent,
  emailReport,
  downloadSinglePDF,
  exportSingleReport,
  exportAllReport,
  getCompanies,
  addCompany,
  updateCompany,
  deleteCompany,
  getCompanyAnalytics,
  getInterviewsReport,
  getAnalytics,
  getResumes,
} from "../controllers/adminController.js";
import {
  getAnalyticsOverview,
  getDepartmentAnalytics,
  getStudentPerformanceAnalytics,
  getRealInterviewAnalytics,
  getCompanyMockAnalytics,
  getMockSectionAnalytics,
  getPerformanceDistribution,
  getTimeBasedAnalytics,
} from "../controllers/adminAnalyticsController.js";
import {
  getMockQuestions,
  checkMockQuestionDuplicate,
  addMockQuestion,
  editMockQuestion,
  deleteMockQuestion,
  importMockQuestions,
} from "../controllers/adminMockQuestionsController.js";

const router = express.Router();

// Protect all admin endpoints
router.use(authMiddleware);
router.use(authorizeRoles("admin"));

// Statistics Dashboard
router.get("/stats", getStats);
router.get("/interviews/report", getInterviewsReport);

// Comprehensive Admin Analytics Endpoints
router.get("/analytics/overview", getAnalyticsOverview);
router.get("/analytics/departments", getDepartmentAnalytics);
router.get("/analytics/students", getStudentPerformanceAnalytics);
router.get("/analytics/real-interviews", getRealInterviewAnalytics);
router.get("/analytics/company-mocks", getCompanyMockAnalytics);
router.get("/analytics/sections", getMockSectionAnalytics);
router.get("/analytics/distribution", getPerformanceDistribution);
router.get("/analytics/time-based", getTimeBasedAnalytics);

// Central Company Mock Questions Management Endpoints
router.get("/mock-questions", getMockQuestions);
router.post("/mock-questions/check-duplicate", checkMockQuestionDuplicate);
router.post("/mock-questions", addMockQuestion);
router.put("/mock-questions/:id", editMockQuestion);
router.delete("/mock-questions/:id", deleteMockQuestion);
router.post("/mock-questions/import", importMockQuestions);

// Students CRUD & reports
router.get("/students", getStudents);
router.get("/students/:id", getStudentDetails);
router.put("/students/:id", updateStudent);
router.delete("/students/:id", deleteStudent);
router.post("/students/:id/email-report", emailReport);
router.get("/students/:id/pdf", downloadSinglePDF);
router.get("/students/:id/csv", exportSingleReport);
router.get("/reports/export-all", exportAllReport);

// Companies CRUD & analytics
router.get("/companies", getCompanies);
router.post("/companies", addCompany);
router.put("/companies/:id", updateCompany);
router.delete("/companies/:id", deleteCompany);
router.get("/companies/analytics", getCompanyAnalytics);

router.get("/analytics", getAnalytics);
router.get("/resumes/list", getResumes);

export default router;
