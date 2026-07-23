import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getNotifications,
  getUnreadNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "../controllers/notificationController.js";

const router = express.Router();
router.use(authMiddleware);

router.get("/", getNotifications);
router.get("/unread", getUnreadNotifications);
router.put("/:id/read", markAsRead);
router.put("/read-all", markAllAsRead);
router.delete("/:id", deleteNotification);

export default router;
