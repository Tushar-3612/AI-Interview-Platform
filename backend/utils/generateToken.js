import jwt from "jsonwebtoken";

/**
 * Generate a signed JWT for authenticated users.
 * @param {string} id - User identifier (MongoDB _id or admin identifier)
 * @param {string} role - User role: "student" | "system_admin" | "teacher" | "admin"
 * @param {string|null} department - Assigned department for teacher or student
 */
const generateToken = (id, role, department = null) => {
  const jwtSecret = process.env.JWT_SECRET || "fallback_secret_key";
  return jwt.sign({ id, role, department }, jwtSecret, {
    expiresIn: "7d",
  });
};

export default generateToken;
