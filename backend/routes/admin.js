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
import {
  createTeacher,
  getTeachers,
  updateTeacher,
  toggleTeacherStatus,
  resetTeacherPassword,
  deleteTeacher,
} from "../controllers/adminTeacherController.js";
import {
  getPremiumUsers,
  grantPremium,
  revokePremium,
  searchStudentsForPremium,
  getPremiumStats,
} from "../controllers/adminPremiumController.js";

const router = express.Router();

// Protect all admin endpoints with base auth
router.use(authMiddleware);

// ─── System Admin ONLY: Teacher Management ───
router.post("/teachers", authorizeRoles("system_admin"), createTeacher);
router.get("/teachers", authorizeRoles("system_admin"), getTeachers);
router.put("/teachers/:id", authorizeRoles("system_admin"), updateTeacher);
router.patch("/teachers/:id/status", authorizeRoles("system_admin"), toggleTeacherStatus);
router.post("/teachers/:id/reset-password", authorizeRoles("system_admin"), resetTeacherPassword);
router.delete("/teachers/:id", authorizeRoles("system_admin"), deleteTeacher);

// ─── System Admin ONLY: Premium Membership Management ───
router.get("/premium/users", authorizeRoles("system_admin"), getPremiumUsers);
router.post("/premium/grant", authorizeRoles("system_admin"), grantPremium);
router.post("/premium/revoke", authorizeRoles("system_admin"), revokePremium);
router.post("/premium/revoke/:studentId", authorizeRoles("system_admin"), revokePremium);
router.get("/premium/search", authorizeRoles("system_admin"), searchStudentsForPremium);
router.get("/premium/search-students", authorizeRoles("system_admin"), searchStudentsForPremium);
router.get("/premium/stats", authorizeRoles("system_admin"), getPremiumStats);

// Allow access for both System Admin and Teacher Admins for standard admin management
router.use(authorizeRoles("system_admin", "teacher"));

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
