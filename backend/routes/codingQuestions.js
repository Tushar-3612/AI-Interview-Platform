import express from "express";
import authMiddleware, { authorizeRoles } from "../middleware/authMiddleware.js";
import {
  createCodingQuestion, getCodingQuestions, getCodingQuestionById,
  updateCodingQuestion, deleteCodingQuestion, hardDeleteCodingQuestion,
  toggleCodingQuestion,
  addTestCase, updateTestCase, deleteTestCase, getCodingStats,
  getTrashedCodingQuestions, restoreCodingQuestion, bulkImportCodingQuestions,
  syncCodingQuestionsFromJsonHandler, getCodingSourceFiles,
} from "../controllers/codingQuestionController.js";

const router = express.Router();
router.use(authMiddleware);

router.get("/stats", getCodingStats);
router.get("/trash", authorizeRoles("admin"), getTrashedCodingQuestions);
router.get("/source-files", authorizeRoles("admin"), getCodingSourceFiles);
router.post("/sync-from-json", authorizeRoles("admin"), syncCodingQuestionsFromJsonHandler);
router.get("/", getCodingQuestions);
router.get("/:id", getCodingQuestionById);
router.post("/", authorizeRoles("admin"), createCodingQuestion);
router.post("/bulk-import", authorizeRoles("admin"), bulkImportCodingQuestions);
router.put("/:id", authorizeRoles("admin"), updateCodingQuestion);
router.patch("/:id/toggle", authorizeRoles("admin"), toggleCodingQuestion);
router.delete("/:id", authorizeRoles("admin"), deleteCodingQuestion);
router.delete("/:id/hard", authorizeRoles("admin"), hardDeleteCodingQuestion);
router.post("/:id/restore", authorizeRoles("admin"), restoreCodingQuestion);
router.post("/:id/test-cases", authorizeRoles("admin"), addTestCase);
router.put("/:id/test-cases/:testCaseId", authorizeRoles("admin"), updateTestCase);
router.delete("/:id/test-cases/:testCaseId", authorizeRoles("admin"), deleteTestCase);

export default router;
