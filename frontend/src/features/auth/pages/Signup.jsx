import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Mail, Lock, GraduationCap, Link2, Calendar, ArrowRight, Layers } from "lucide-react";
import toast from "react-hot-toast";
import AuthLayout from "../../../core/layouts/AuthLayout.jsx";
import InputField from "../../../core/ui/InputField.jsx";
import Button from "../../../core/ui/Button.jsx";
import api from "../../../core/api/api.js";
import { STUDENT_SIGNUP_DEPARTMENTS, ACADEMIC_SECTIONS, YEARS } from "../../../core/utils/constants.js";
import {
  validateEmail,
  validatePassword,
  validateRequired,
} from "../../../core/utils/validators.js";

/**
 * Signup Page — Direct student registration without OTP dependency.
 */
function Signup() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    department: "",
    section: "",
    year: "",
    password: "",
    confirmPassword: "",
    portfolio: "",
    termsAccepted: false,
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };
      // Reset section when department is deselected
      if (name === "department" && !value) {
        updated.section = "";
      }
      return updated;
    });
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    if (name === "department" && !value && errors.section) {
      setErrors((prev) => ({ ...prev, section: "" }));
    }
  };

  const validate = () => {
    const newErrors = {};

    const nameErr = validateRequired(formData.name, "Full name");
    if (nameErr) newErrors.name = nameErr;

    const emailErr = validateEmail(formData.email);
    if (emailErr) newErrors.email = emailErr;

    if (!formData.department) newErrors.department = "Required";
    if (formData.department && !formData.section) newErrors.section = "Required";
    if (!formData.year) newErrors.year = "Required";

    const passErr = validatePassword(formData.password);
    if (passErr) newErrors.password = passErr;

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Required";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
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

  const isValidUrl = (string) => {
    try {
      const url = new URL(string);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
      return false;
    }
  };

  const handleSignup = async (e) => {
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
        section: formData.section,
        year: formData.year,
        portfolio: formData.portfolio || null,
      });

      toast.success("Account created successfully!");
      navigate("/registration-success");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Start your placement preparation journey."
      contentClassName="max-w-[460px]"
      showFooterBadge={false}
    >
      <form onSubmit={handleSignup} noValidate className="flex flex-col">
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

        {/* Department */}
        <InputField
          label="Department"
          name="department"
          value={formData.department}
          onChange={handleChange}
          placeholder="Select your department"
          error={errors.department}
          required
          as="select"
          options={STUDENT_SIGNUP_DEPARTMENTS}
          icon={GraduationCap}
        />

        {/* Section (Appears only when CS or IT is selected) */}
        {formData.department && (
          <InputField
            label="Section"
            name="section"
            value={formData.section}
            onChange={handleChange}
            placeholder="Select Section"
            error={errors.section}
            required
            as="select"
            options={ACADEMIC_SECTIONS}
            icon={Layers}
          />
        )}

        {/* Year */}
        <InputField
          label="Year"
          name="year"
          value={formData.year}
          onChange={handleChange}
          placeholder="Select your year"
          error={errors.year}
          required
          as="select"
          options={YEARS}
          icon={Calendar}
        />

        {/* Password */}
        <InputField
          label="Password"
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Create a password"
          error={errors.password}
          required
          autoComplete="new-password"
          icon={Lock}
        />

        {/* Confirm Password */}
        <InputField
          label="Confirm Password"
          type="password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          placeholder="Confirm your password"
          error={errors.confirmPassword}
          required
          autoComplete="new-password"
          icon={Lock}
        />

        {/* Terms & Conditions */}
        <div className="mb-3 sm:mb-4">
          <label className="flex items-start sm:items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              name="termsAccepted"
              checked={formData.termsAccepted}
              onChange={handleChange}
              className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0 rounded cursor-pointer accent-[var(--primary)] border-[var(--border)] bg-[var(--input-bg)]"
            />
            <span className="text-xs leading-snug text-[var(--text-secondary)]">
              I agree to the{" "}
              <Link to="/terms-and-conditions" className="font-semibold underline hover:opacity-80 text-[var(--primary)]">
                Terms &amp; Conditions
              </Link>
            </span>
          </label>
          {errors.termsAccepted && (
            <p className="mt-1 text-[11px] font-medium text-[#EF4444]">
              {errors.termsAccepted}
            </p>
          )}
        </div>

        <Button type="submit" loading={loading}>
          Create Account <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </form>

      {/* OR Divider */}
      <div className="relative my-3 sm:my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--border)]" />
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 text-[11px] uppercase tracking-wider bg-[var(--card-bg)] text-[var(--text-muted)] font-semibold">
            OR
          </span>
        </div>
      </div>

      <p className="text-center text-xs text-[var(--text-secondary)]">
        Already have an account?{" "}
        <Link
          to="/"
          className="font-semibold transition-opacity hover:opacity-80 hover:underline text-[var(--primary)]"
        >
          Sign In
        </Link>
      </p>
    </AuthLayout>
  );
}

export default Signup;