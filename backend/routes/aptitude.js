import express from "express";
import multer from "multer";
import authMiddleware, { authorizeRoles } from "../middleware/authMiddleware.js";
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

router.get("/", authorizeRoles("admin"), getAptitudeQuestions);
router.get("/all", authorizeRoles("admin"), getAptitudeQuestions);
router.get("/trash", authorizeRoles("admin"), getTrashedAptitudeQuestions);
router.get("/:id", authorizeRoles("admin"), getAptitudeQuestionById);
router.post("/", authorizeRoles("admin"), createAptitudeQuestion);
router.post("/seed", authorizeRoles("admin"), seedAptitudeQuestions);
router.post("/bulk-delete", authorizeRoles("admin"), bulkDeleteAptitudeQuestions);
router.post("/bulk-restore", authorizeRoles("admin"), bulkRestoreAptitudeQuestions);
router.post("/bulk-hard-delete", authorizeRoles("admin"), bulkHardDeleteAptitudeQuestions);
router.post("/bulk-import", authorizeRoles("admin"), bulkImportAptitudeQuestions);
router.post("/upload-questions", authorizeRoles("admin"), upload.single("file"), uploadAptitudeQuestions);
router.get("/templates/:format", authorizeRoles("admin"), downloadAptitudeTemplate);
router.post("/bulk-assign", authorizeRoles("admin"), bulkAssignAptitudeQuestions);
router.put("/:id", authorizeRoles("admin"), updateAptitudeQuestion);
router.patch("/:id/toggle", authorizeRoles("admin"), toggleAptitudeQuestion);
router.delete("/:id", authorizeRoles("admin"), deleteAptitudeQuestion);
router.delete("/:id/hard", authorizeRoles("admin"), hardDeleteAptitudeQuestion);
router.post("/:id/restore", authorizeRoles("admin"), restoreAptitudeQuestion);

export default router;
