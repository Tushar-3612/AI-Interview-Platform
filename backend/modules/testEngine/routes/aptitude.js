import express from "express";
import multer from "multer";
import authMiddleware, { authorizeRoles } from "../../../core/middleware/authMiddleware.js";
import {
  seedAptitudeQuestions, getAptitudeQuestions, getAptitudeQuestionById,
  createAptitudeQuestion, updateAptitudeQuestion, deleteAptitudeQuestion,
  bulkDeleteAptitudeQuestions, toggleAptitudeQuestion,
  getRandomAptitudeQuestions, getAptitudeStats,
  getTrashedAptitudeQuestions, restoreAptitudeQuestion, hardDeleteAptitudeQuestion,
  bulkRestoreAptitudeQuestions, bulkHardDeleteAptitudeQuestions,
  bulkImportAptitudeQuestions, bulkAssignAptitudeQuestions,
  uploadAptitudeQuestions, downloadAptitudeTemplate,
} from "../controllers/aptitudeController.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
router.use(authMiddleware);

router.get("/random", getRandomAptitudeQuestions);
router.get("/stats", getAptitudeStats);

router.get("/", authorizeRoles("system_admin", "teacher"), getAptitudeQuestions);
router.get("/all", authorizeRoles("system_admin", "teacher"), getAptitudeQuestions);
router.get("/trash", authorizeRoles("system_admin", "teacher"), getTrashedAptitudeQuestions);
router.get("/:id", authorizeRoles("system_admin", "teacher"), getAptitudeQuestionById);
router.post("/", authorizeRoles("system_admin", "teacher"), createAptitudeQuestion);
router.post("/seed", authorizeRoles("system_admin", "teacher"), seedAptitudeQuestions);
router.post("/bulk-delete", authorizeRoles("system_admin", "teacher"), bulkDeleteAptitudeQuestions);
router.post("/bulk-restore", authorizeRoles("system_admin", "teacher"), bulkRestoreAptitudeQuestions);
router.post("/bulk-hard-delete", authorizeRoles("system_admin", "teacher"), bulkHardDeleteAptitudeQuestions);
router.post("/bulk-import", authorizeRoles("system_admin", "teacher"), bulkImportAptitudeQuestions);
router.post("/upload-questions", authorizeRoles("system_admin", "teacher"), upload.single("file"), uploadAptitudeQuestions);
router.get("/templates/:format", authorizeRoles("system_admin", "teacher"), downloadAptitudeTemplate);
router.post("/bulk-assign", authorizeRoles("system_admin", "teacher"), bulkAssignAptitudeQuestions);
router.put("/:id", authorizeRoles("system_admin", "teacher"), updateAptitudeQuestion);
router.patch("/:id/toggle", authorizeRoles("system_admin", "teacher"), toggleAptitudeQuestion);
router.delete("/:id", authorizeRoles("system_admin", "teacher"), deleteAptitudeQuestion);
router.delete("/:id/hard", authorizeRoles("system_admin", "teacher"), hardDeleteAptitudeQuestion);
router.post("/:id/restore", authorizeRoles("system_admin", "teacher"), restoreAptitudeQuestion);

export default router;
