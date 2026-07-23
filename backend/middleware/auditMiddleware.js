import AuditLog from "../models/AuditLog.js";

export function auditLog(action, resource = "") {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      const status = res.statusCode >= 200 && res.statusCode < 300 ? "success" : "failure";
      AuditLog.create({
        userId: req.user?.id || null,
        role: req.user?.role || "system",
        action,
        resource,
        resourceId: req.params?.id || req.params?.testId || "",
        details: {
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
        },
        ip: req.ip || req.connection?.remoteAddress || "",
        userAgent: req.headers["user-agent"] || "",
        status,
        timestamp: new Date(),
      }).catch(err => console.error("Audit log error:", err.message));
      return originalJson(body);
    };
    next();
  };
}

export async function createAuditLog({ userId, role, action, resource, resourceId, details, ip, userAgent, status = "success" }) {
  try {
    await AuditLog.create({ userId, role, action, resource, resourceId, details, ip, userAgent, status });
  } catch (error) {
    console.error("Audit log creation error:", error.message);
  }
}
