import Notification from "../models/Notification.js";
import { getUnreadCount, markAllRead } from "../services/notificationService.js";

export const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const role = req.user.role;
    const filter = {};
    if (role === "admin") {
      filter.$or = [{ role: "admin" }, { role: "all" }];
    } else {
      filter.$or = [{ userId: req.user.id }, { role: "all" }];
    }
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();
    const total = await Notification.countDocuments(filter);
    res.json({ notifications, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("Get Notifications Error:", error.message);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

export const getUnreadNotifications = async (req, res) => {
  try {
    const count = await getUnreadCount(req.user.id, req.user.role);
    const role = req.user.role;
    const filter = { read: false };
    if (role === "admin") {
      filter.$or = [{ role: "admin" }, { role: "all" }];
    } else {
      filter.$or = [{ userId: req.user.id }, { role: "all" }];
    }
    const recent = await Notification.find(filter).sort({ createdAt: -1 }).limit(5).lean();
    res.json({ count, recent });
  } catch (error) {
    console.error("Get Unread Error:", error.message);
    res.status(500).json({ message: "Failed to fetch unread count" });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.findByIdAndUpdate(id, { read: true, readAt: new Date() });
    res.json({ message: "Marked as read" });
  } catch (error) {
    console.error("Mark Read Error:", error.message);
    res.status(500).json({ message: "Failed to mark as read" });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    await markAllRead(req.user.id, req.user.role);
    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Mark All Read Error:", error.message);
    res.status(500).json({ message: "Failed to mark all as read" });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.findByIdAndDelete(id);
    res.json({ message: "Notification deleted" });
  } catch (error) {
    console.error("Delete Notification Error:", error.message);
    res.status(500).json({ message: "Failed to delete notification" });
  }
};
