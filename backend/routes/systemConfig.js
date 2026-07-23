import express from "express";
import authMiddleware, { authorizeRoles } from "../middleware/authMiddleware.js";
import { getConfigs, updateConfig } from "../controllers/systemConfigController.js";

const router = express.Router();
router.use(authMiddleware);
router.use(authorizeRoles("admin"));

router.get("/", getConfigs);
router.put("/", updateConfig);

export default router;
