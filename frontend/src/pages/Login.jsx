import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Lock } from "lucide-react";
import toast from "react-hot-toast";
import AuthLayout from "../layouts/AuthLayout";
import InputField from "../components/ui/InputField";
import Button from "../components/ui/Button";
import api from "../utils/api";
import { validateEmail } from "../utils/validators";

/**
 * Login Page — student & admin authentication.
 */
function Login() {
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

      const storage = formData.rememberMe ? localStorage : sessionStorage;
      storage.setItem("token", data.token);
      storage.setItem("user", JSON.stringify(data.user));

      toast.success(data.message);

      if (data.user.role === "admin") {
        toast("Admin dashboard coming soon", { icon: "ℹ️" });
      } else {
        toast("Student dashboard coming soon", { icon: "ℹ️" });
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
    <AuthLayout title="Sign In">
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
        <div className="flex items-center justify-between mb-5">
          <label className="flex items-center gap-2 cursor-pointer group select-none">
            <input
              type="checkbox"
              name="rememberMe"
              checked={formData.rememberMe}
              onChange={handleChange}
              className="w-4 h-4 rounded cursor-pointer accent-[var(--primary)] border-[var(--border)] bg-[var(--input-bg)]"
            />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Remember Me
            </span>
          </label>

          <button
            type="button"
            onClick={() => toast("Password reset coming soon", { icon: "ℹ️" })}
            className="text-xs font-medium transition-opacity hover:opacity-80 cursor-pointer"
            style={{ color: "var(--primary)" }}
          >
            Forgot Password?
          </button>
        </div>

        <Button type="submit" loading={loading} className="py-2.5">
          Login
        </Button>
      </form>

      <p className="text-center text-xs mt-5 pt-3 border-t border-[var(--border)]" style={{ color: "var(--text-secondary)" }}>
        Don&apos;t have an account?{" "}
        <Link
          to="/signup"
          className="font-semibold transition-opacity hover:opacity-80"
          style={{ color: "var(--primary)" }}
        >
          Create Account
        </Link>
      </p>
    </AuthLayout>
  );
}

export default Login;
