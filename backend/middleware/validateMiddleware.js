export function validate(schema) {
  return (req, res, next) => {
    const errors = [];
    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];
      for (const rule of rules) {
        if (rule.required && (value === undefined || value === null || value === "")) {
          errors.push(`${field} is required`);
          break;
        }
        if (value !== undefined && value !== null && value !== "") {
          if (rule.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push(`${field} must be a valid email`);
          }
          if (rule.type === "number" && isNaN(Number(value))) {
            errors.push(`${field} must be a number`);
          }
          if (rule.minLength && value.length < rule.minLength) {
            errors.push(`${field} must be at least ${rule.minLength} characters`);
          }
          if (rule.maxLength && value.length > rule.maxLength) {
            errors.push(`${field} must be at most ${rule.maxLength} characters`);
          }
          if (rule.enum && !rule.enum.includes(value)) {
            errors.push(`${field} must be one of: ${rule.enum.join(", ")}`);
          }
        }
      }
    }
    if (errors.length) {
      return res.status(400).json({ message: "Validation failed", errors });
    }
    next();
  };
}

export const commonSchemas = {
  email: {
    email: [{ required: true, type: "email" }],
  },
  password: {
    password: [{ required: true, minLength: 8 }],
  },
};
