import AuditLog from "../models/AuditLog.js";

export const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 30, action, userId, dateFrom, dateTo } = req.query;
    const filter = {};
    if (action) filter.action = action;
    if (userId) filter.userId = userId;
    if (dateFrom || dateTo) {
      filter.timestamp = {};
      if (dateFrom) filter.timestamp.$gte = new Date(dateFrom);
      if (dateTo) filter.timestamp.$lte = new Date(dateTo);
    }
    const logs = await AuditLog.find(filter)
      .populate("userId", "name email")
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();
    const total = await AuditLog.countDocuments(filter);
    const actions = await AuditLog.distinct("action");
    res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / limit), actions });
  } catch (error) {
    console.error("Get Audit Logs Error:", error.message);
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
};

export const getAuditStats = async (req, res) => {
  try {
    const totalLogs = await AuditLog.countDocuments();
    const todayLogs = await AuditLog.countDocuments({ timestamp: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } });
    const actions = await AuditLog.distinct("action");
    const actionCounts = {};
    for (const action of actions) {
      actionCounts[action] = await AuditLog.countDocuments({ action });
    }
    res.json({ totalLogs, todayLogs, uniqueActions: actions.length, actionCounts });
  } catch (error) {
    console.error("Get Audit Stats Error:", error.message);
    res.status(500).json({ message: "Failed to fetch audit stats" });
  }
};
