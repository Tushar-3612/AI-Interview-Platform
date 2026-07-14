import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Mail, Lock, Building2, GraduationCap, Link2 } from "lucide-react";
import toast from "react-hot-toast";
import AuthLayout from "../layouts/AuthLayout";
import InputField from "../components/ui/InputField";
import Button from "../components/ui/Button";
import api from "../utils/api";
import { DEPARTMENTS, YEARS } from "../utils/constants";
import {
  validateEmail,
  validatePassword,
  validateRequired,
} from "../utils/validators";

/**
 * Signup Page — student registration with compact layout to fit within one screen.
 */
function Signup() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    department: "",
    year: "",
    password: "",
    confirmPassword: "",
    portfolio: "", // ← Added portfolio field
    termsAccepted: false,
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const newErrors = {};

    const nameErr = validateRequired(formData.name, "Full name");
    if (nameErr) newErrors.name = nameErr;

    const emailErr = validateEmail(formData.email);
    if (emailErr) newErrors.email = emailErr;

    if (!formData.department) newErrors.department = "Required";
    if (!formData.year) newErrors.year = "Required";

    const passErr = validatePassword(formData.password);
    if (passErr) newErrors.password = passErr;

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Required";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Mismatch";
    }

    // Portfolio validation - optional, but if provided should be a valid URL
    if (formData.portfolio && !isValidUrl(formData.portfolio)) {
      newErrors.portfolio = "Please enter a valid URL";
    }

    if (!formData.termsAccepted) {
      newErrors.termsAccepted = "You must accept the terms";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Helper function to validate URL
  const isValidUrl = (string) => {
    try {
      const url = new URL(string);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await api.post("/api/auth/signup", {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        department: formData.department,
        year: formData.year,
        portfolio: formData.portfolio || null, // Send null if empty
      });

      toast.success("Account created successfully!");
      navigate("/registration-success");
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create Account">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col">
        <InputField
          label="Full Name"
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Enter your full name"
          error={errors.name}
          required
          autoComplete="name"
          icon={User}
        />

        <InputField
          label="College Email"
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="you@college.edu"
          error={errors.email}
          required
          autoComplete="email"
          icon={Mail}
        />

        {/* Portfolio Field - Optional */}
        <InputField
          label="Portfolio Link (Optional)"
          type="url"
          name="portfolio"
          value={formData.portfolio}
          onChange={handleChange}
          placeholder="https://your-portfolio.com"
          error={errors.portfolio}
          autoComplete="url"
          icon={Link2}
        />

        {/* Department & Year side-by-side to save vertical space */}
        <div className="grid grid-cols-2 gap-3">
          <InputField
            label="Department"
            name="department"
            value={formData.department}
            onChange={handleChange}
            placeholder="Select"
            error={errors.department}
            required
            as="select"
            options={DEPARTMENTS}
          />

          <InputField
            label="Year"
            name="year"
            value={formData.year}
            onChange={handleChange}
            placeholder="Select"
            error={errors.year}
            required
            as="select"
            options={YEARS}
          />
        </div>

        {/* Password & Confirm Password side-by-side to save vertical space */}
        <div className="grid grid-cols-2 gap-3">
          <InputField
            label="Password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Create password"
            error={errors.password}
            required
            autoComplete="new-password"
            icon={Lock}
          />

          <InputField
            label="Confirm Password"
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="Re-enter password"
            error={errors.confirmPassword}
            required
            autoComplete="new-password"
            icon={Lock}
          />
        </div>

        {/* Terms & Conditions */}
        <div className="mb-4">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              name="termsAccepted"
              checked={formData.termsAccepted}
              onChange={handleChange}
              className="w-4 h-4 mt-0.5 rounded cursor-pointer accent-[var(--primary)] border-[var(--border)] bg-[var(--input-bg)]"
            />
            <span className="text-xs leading-snug" style={{ color: "var(--text-secondary)" }}>
              I agree to the{" "}
              <Link to="/terms-and-conditions" className="font-semibold underline" style={{color:"var(--primary)"}}>Terms&conditions</Link>
            </span>
          </label>
          {errors.termsAccepted && (
            <p className="mt-1 text-[10px]" style={{ color: "var(--error)" }}>
              {errors.termsAccepted}
            </p>
          )}
        </div>

        <Button type="submit" loading={loading} className="py-2.5">
          Create Account
        </Button>
      </form>

      <p className="text-center text-xs mt-4 pt-3 border-t border-[var(--border])" style={{ color: "var(--text-secondary)" }}>
        Already have an account?{" "}
        <Link
          to="/"
          className="font-semibold transition-opacity hover:opacity-80"
          style={{ color: "var(--primary)" }}
        >
          Login
        </Link>
      </p>
    </AuthLayout>
  );
}

export default Signup;