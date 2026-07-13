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
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = {
        id: decoded.id,
        role: decoded.role,
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
 */
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Access denied for this role" });
    }
    next();
  };
};

export default authMiddleware;
