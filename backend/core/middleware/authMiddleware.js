import jwt from "jsonwebtoken";

/**
 * Protect routes by verifying JWT from the Authorization header.
 */
const authMiddleware = (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const jwtSecret = process.env.JWT_SECRET || "fallback_secret_key";
      const decoded = jwt.verify(token, jwtSecret);

      req.user = {
        id: decoded.id,
        role: decoded.role,
        department: decoded.department || null,
      };

      next();
    } catch (error) {
      return res.status(401).json({ message: "Not authorized, token invalid" });
    }
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
};

/**
 * Restrict access to specific roles.
 * Maps legacy "admin" to match both system_admin and teacher where appropriate.
 */
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized, no user context" });
    }

    const userRole = req.user.role;
    const normalizedUserRole = userRole === "admin" ? "system_admin" : userRole;

    const allowed = new Set();
    for (const r of roles) {
      if (r === "admin") {
        allowed.add("system_admin");
        allowed.add("teacher");
        allowed.add("admin");
      } else {
        allowed.add(r);
        if (r === "system_admin") {
          allowed.add("admin");
        }
      }
    }

    if (!allowed.has(userRole) && !allowed.has(normalizedUserRole)) {
      return res
        .status(403)
        .json({ message: "Access denied. You do not have permission for this resource." });
    }

    next();
  };
};

/**
 * Helper to get strictly enforced department query filter.
 * For teacher, always returns their assigned department.
 * For system_admin / admin, returns explicit query/param department if provided, else null.
 */
export const getEffectiveDepartment = (req) => {
  if (req.user?.role === "teacher") {
    return req.user.department || null;
  }
  return req.query?.department || req.body?.department || null;
};

export default authMiddleware;
