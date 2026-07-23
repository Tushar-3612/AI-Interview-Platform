import Notification from "../models/Notification.js";

export async function createNotification({ userId, role, type, title, message, link }) {
  try {
    const notification = await Notification.create({ userId, role, type, title, message, link });
    return notification;
  } catch (error) {
    console.error("Failed to create notification:", error.message);
    return null;
  }
}

export async function notifyAllAdmins(type, title, message, link) {
  return createNotification({ role: "admin", type, title, message, link });
}

export async function notifyStudent(userId, type, title, message, link) {
  return createNotification({ userId, role: "student", type, title, message, link });
}

export async function getUnreadCount(userId, role) {
  const filter = { read: false };
  if (role === "admin") {
    filter.$or = [{ role: "admin" }, { role: "all" }];
  } else {
    filter.$or = [
      { userId: userId },
      { role: "all" },
    ];
  }
  return Notification.countDocuments(filter);
}

export async function markAllRead(userId, role) {
  const filter = {};
  if (role === "admin") {
    filter.$or = [{ role: "admin" }, { role: "all" }];
  } else {
    filter.$or = [{ userId }, { role: "all" }];
  }
  return Notification.updateMany(
    { ...filter, read: false },
    { $set: { read: true, readAt: new Date() } }
  );
}
