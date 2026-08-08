import express from "express";
import authMiddleware, { authorizeRoles } from "../middleware/authMiddleware.js";
import {
  getPlacementOverview,
  getStudentCompanyAnalytics,
  getPerformanceData,
  getStudentQuestionAnalytics,
  getLeaderboard,
  startMockOA,
  submitMockOA,
  getMockOAHistory,
  getAdminPlacementAnalytics,
  getCompanyChoices,
  getFilterOptions,
} from "../controllers/placementController.js";

const router = express.Router();
router.use(authMiddleware);

// Student intelligence dashboard
router.get("/overview", getPlacementOverview);
router.get("/company-analytics", getStudentCompanyAnalytics);
router.get("/performance", getPerformanceData);
router.get("/question-analytics", getStudentQuestionAnalytics);
router.get("/leaderboard", getLeaderboard);
router.get("/companies", getCompanyChoices);
router.get("/filters", getFilterOptions);

// Mock OA (realistic online assessment)
router.get("/mock-oa/:companyId/start", startMockOA);
router.post("/mock-oa/:companyId/submit", submitMockOA);
router.get("/mock-oa/history", getMockOAHistory);

// Admin-only placement analytics (question quality, insights)
router.get("/admin/analytics", authorizeRoles("admin"), getAdminPlacementAnalytics);

export default router;
