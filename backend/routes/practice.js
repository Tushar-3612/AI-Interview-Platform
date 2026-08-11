import express from "express";
import authMiddleware, { authorizeRoles } from "../middleware/authMiddleware.js";
import {
  getPracticeHome,
  startAptitudePaper,
  submitAptitude,
  getAptitudeHistory,
  getAptitudeAttempt,
  runCodingCode,
  submitCoding,
  getCodingHistory,
  getCodingSubmission,
  getCodingProgress,
  saveCodingDraft,
  getCodingDraft,
  toggleBookmark,
  getBookmarks,
  toggleFavoriteCompany,
  getRecentActivity,
  getStudentAnalytics,
  getCompanyPracticeAnalytics,
} from "../controllers/practiceController.js";

const router = express.Router();
router.use(authMiddleware);

// Student practice home
router.get("/home", getPracticeHome);

// Aptitude practice
router.get("/aptitude/paper", startAptitudePaper);
router.post("/aptitude/submit", submitAptitude);
router.get("/aptitude/history", getAptitudeHistory);
router.get("/aptitude/history/:id", getAptitudeAttempt);

// Coding practice
router.post("/coding/run", runCodingCode);
router.post("/coding/submit", submitCoding);
router.get("/coding/history", getCodingHistory);
router.get("/coding/history/:id", getCodingSubmission);
router.get("/coding/progress/:companyId", getCodingProgress);
router.post("/coding/draft", saveCodingDraft);
router.get("/coding/draft/:questionId", getCodingDraft);

// Preferences
router.post("/bookmark", toggleBookmark);
router.get("/bookmarks", getBookmarks);
router.post("/favorite-company", toggleFavoriteCompany);

// Activity & analytics
router.get("/activity", getRecentActivity);
router.get("/analytics/student", getStudentAnalytics);
router.get("/analytics/company", authorizeRoles("admin"), getCompanyPracticeAnalytics);

export default router;
