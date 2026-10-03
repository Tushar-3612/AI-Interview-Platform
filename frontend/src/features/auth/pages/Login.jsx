import { useState } from "react";
import { Mail, Lock, ArrowRight, ArrowLeft, Info } from "lucide-react";
import toast from "react-hot-toast";
import AuthLayout from "../../../core/layouts/AuthLayout.jsx";
import InputField from "../../../core/ui/InputField.jsx";
import Button from "../../../core/ui/Button.jsx";
import api from "../../../core/api/api.js";
import { validateEmail } from "../../../core/utils/validators.js";
import { clearAuthData } from "../../student/hooks/useStudentProfile.js";
import { Link, useNavigate } from "react-router-dom";

/**
 * Login Page — student & admin authentication.
 */
function Login() {
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState("login"); // "login" | "forgot-password"
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
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
    const emailErr = validateEmail(formData.email);
    if (emailErr) newErrors.email = emailErr;
    if (!formData.password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/login", {
        email: formData.email,
        password: formData.password,
      });

      clearAuthData();
      const storage = formData.rememberMe ? localStorage : sessionStorage;
      storage.setItem("token", data.token);
      storage.setItem("user", JSON.stringify(data.user));

      toast.success(data.message);

      if (data.user.role === "system_admin" || data.user.role === "admin") {
        navigate("/admin/system-dashboard");
      } else if (data.user.role === "teacher") {
        navigate("/admin/dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={viewMode === "forgot-password" ? "Password Reset" : "Welcome Back"}
      subtitle={
        viewMode === "forgot-password"
          ? "Account recovery information."
          : "Sign in to continue your placement journey."
      }
    >
      {viewMode === "login" ? (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col">
          <InputField
            label="Email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter your college email"
            error={errors.email}
            required
            autoComplete="email"
            icon={Mail}
          />

          <InputField
            label="Password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter your password"
            error={errors.password}
            required
            autoComplete="current-password"
            icon={Lock}
          />

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer group select-none">
              <input
                type="checkbox"
                name="rememberMe"
                checked={formData.rememberMe}
                onChange={handleChange}
                className="w-4 h-4 rounded cursor-pointer accent-[var(--primary)] border-[var(--border)] bg-[var(--input-bg)]"
              />
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Remember Me
              </span>
            </label>

            <button
              type="button"
              onClick={() => {
                setErrors({});
                setViewMode("forgot-password");
              }}
              className="text-xs font-semibold whitespace-nowrap transition-opacity hover:opacity-80 hover:underline cursor-pointer text-[var(--primary)]"
            >
              Forgot Password?
            </button>
          </div>

          <Button type="submit" loading={loading}>
            Sign In <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </form>
      ) : (
        <div className="flex flex-col">
          <div className="p-4 mb-6 rounded-xl border border-amber-500/20 bg-amber-500/10 flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
              <p className="font-semibold text-[var(--text-primary)] mb-1">
                Password Reset Unavailable
              </p>
              Password reset is currently unavailable. Please contact the administrator or your department coordinator to reset your password.
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={() => setViewMode("login")}
            className="w-full flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Sign In
          </Button>
        </div>
      )}

      {/* OR Divider */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--border)]" />
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 text-xs uppercase tracking-wider bg-[var(--card-bg)] text-[var(--text-muted)] font-medium">
            or
          </span>
        </div>
      </div>

      <p className="text-center text-xs text-[var(--text-secondary)]">
        Don&apos;t have an account?{" "}
        <Link
          to="/signup"
          className="font-semibold transition-opacity hover:opacity-80 hover:underline text-[var(--primary)]"
        >
          Create Account
        </Link>
      </p>
    </AuthLayout>
  );
}

export default Login;
