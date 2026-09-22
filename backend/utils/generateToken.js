import jwt from "jsonwebtoken";

/**
 * Generate a signed JWT for authenticated users.
 * @param {string} id - User identifier (MongoDB _id or admin identifier)
 * @param {string} role - User role: "student" | "admin"
 */
const generateToken = (id, role) => {
  const jwtSecret = process.env.JWT_SECRET || "fallback_secret_key";
  return jwt.sign({ id, role }, jwtSecret, {
    expiresIn: "7d",
  });
};

export default generateToken;
