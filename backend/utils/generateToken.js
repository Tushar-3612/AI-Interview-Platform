import jwt from "jsonwebtoken";

/**
 * Generate a signed JWT for authenticated users.
 * @param {string} id - User identifier (MongoDB _id or admin identifier)
 * @param {string} role - User role: "student" | "admin"
 */
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

export default generateToken;
