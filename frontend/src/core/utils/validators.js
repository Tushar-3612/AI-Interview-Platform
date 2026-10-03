/**
 * Shared form validation helpers for auth pages.
 */

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

export const validateEmail = (email) => {
  if (!email?.trim()) return "Email is required";
  if (!EMAIL_REGEX.test(email)) return "Please enter a valid email address";
  return "";
};

export const validatePassword = (password) => {
  if (!password) return "Password is required";
  if (!PASSWORD_REGEX.test(password)) {
    return "Must be 8+ chars with uppercase, lowercase, number & special character";
  }
  return "";
};

export const validateRequired = (value, fieldName) => {
  if (!value?.trim?.() && value !== 0) return `${fieldName} is required`;
  if (typeof value === "string" && !value.trim()) return `${fieldName} is required`;
  return "";
};
