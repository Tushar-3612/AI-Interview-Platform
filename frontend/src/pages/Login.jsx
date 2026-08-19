import { useState, useEffect, useRef } from "react";
// import { Link } from "react-router-dom";
import { Mail, Lock, Key } from "lucide-react";
import toast from "react-hot-toast";
import AuthLayout from "../layouts/AuthLayout";
import InputField from "../components/ui/InputField";
import Button from "../components/ui/Button";
import api from "../utils/api";
import { validateEmail } from "../utils/validators";
import { Link, useNavigate } from "react-router-dom";

/**
 * Login Page — student & admin authentication.
 */
function Login() {
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState("login"); // login, forgot-password, enter-otp, reset-password
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });
  
  // Forgot Password / Reset states
  const [forgotEmail, setForgotEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [countdown, setCountdown] = useState(0);

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const otpRefs = useRef([]);

  useEffect(() => {
    let timer;
    if (countdown > 0 && viewMode === "enter-otp") {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown, viewMode]);

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

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    const emailErr = validateEmail(forgotEmail);
    if (emailErr) {
      setErrors({ forgotEmail: emailErr });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/forgot-password", {
        email: forgotEmail,
      });
      toast.success(data.message || "OTP sent successfully");
      setViewMode("enter-otp");
      setCountdown(60);
      setOtpDigits(["", "", "", "", "", ""]);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to send OTP. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otpDigits];
    newOtp[index] = value.slice(-1);
    setOtpDigits(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (!otpDigits[index] && index > 0) {
        otpRefs.current[index - 1].focus();
      }
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pasteData)) {
      const digits = pasteData.split("");
      setOtpDigits(digits);
      otpRefs.current[5].focus();
    }
  };

  const handleVerifyOtpSubmit = async (e) => {
    e.preventDefault();
    const otpValue = otpDigits.join("");
    if (otpValue.length < 6) {
      setErrors({ otp: "Please enter all 6 digits" });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/verify-otp", {
        email: forgotEmail,
        otp: otpValue,
      });
      toast.success(data.message || "OTP verified successfully");
      setResetToken(data.resetToken);
      setViewMode("reset-password");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to verify OTP."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/forgot-password", {
        email: forgotEmail,
      });
      toast.success(data.message || "New OTP sent successfully");
      setCountdown(60);
      setOtpDigits(["", "", "", "", "", ""]);
      if (otpRefs.current[0]) otpRefs.current[0].focus();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to resend OTP."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    
    // Strong password validation regex pattern (matches backend rules)
    const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

    if (!newPassword) {
      newErrors.newPassword = "New password is required";
    } else if (newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters";
    } else if (!PASSWORD_REGEX.test(newPassword)) {
      newErrors.newPassword = "Must include uppercase, lowercase, number, and special character";
    }

    if (!confirmNewPassword) {
      newErrors.confirmNewPassword = "Confirm password is required";
    } else if (newPassword !== confirmNewPassword) {
      newErrors.confirmNewPassword = "Passwords do not match";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const resetRes = await api.post("/api/auth/reset-password", {
        resetToken,
        newPassword,
      });
      toast.success(resetRes.data.message || "Password reset successfully");
      setViewMode("login");
      setForgotEmail("");
      setOtpDigits(["", "", "", "", "", ""]);
      setNewPassword("");
      setConfirmNewPassword("");
      setResetToken("");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to reset password."
      );
    } finally {
      setLoading(false);
    }
  };

  const getLayoutTitle = () => {
    if (viewMode === "forgot-password") return "Forgot Password";
    if (viewMode === "enter-otp") return "Verification OTP";
    if (viewMode === "reset-password") return "Reset Password";
    return "Sign In";
  };

  return (
    <AuthLayout title={getLayoutTitle()}>
      {viewMode === "login" && (
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
              onClick={() => {
                setErrors({});
                setViewMode("forgot-password");
              }}
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
      )}

      {viewMode === "forgot-password" && (
        <form onSubmit={handleForgotPasswordSubmit} noValidate className="flex flex-col">
          <InputField
            label="Email"
            type="email"
            name="forgotEmail"
            value={forgotEmail}
            onChange={(e) => {
              setForgotEmail(e.target.value);
              if (errors.forgotEmail) setErrors({});
            }}
            placeholder="Enter your registered email"
            error={errors.forgotEmail}
            required
            autoComplete="email"
            icon={Mail}
          />

          <div className="flex items-center justify-end mb-5">
            <button
              type="button"
              onClick={() => {
                setErrors({});
                setViewMode("login");
              }}
              className="text-xs font-medium transition-opacity hover:opacity-80 cursor-pointer"
              style={{ color: "var(--primary)" }}
            >
              Back to Login
            </button>
          </div>

          <Button type="submit" loading={loading} className="py-2.5">
            Send OTP
          </Button>
        </form>
      )}

      {viewMode === "enter-otp" && (
        <form onSubmit={handleVerifyOtpSubmit} noValidate className="flex flex-col">
          <div className="flex flex-col mb-5">
            <label className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
              Enter 6-Digit OTP
            </label>
            <div className="flex justify-between gap-2" onPaste={handleOtpPaste}>
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (otpRefs.current[index] = el)}
                  type="text"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className="w-11 h-11 text-center font-bold text-lg rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] transition-all"
                  style={{
                    boxShadow: "var(--shadow-sm)",
                  }}
                  autoFocus={index === 0}
                />
              ))}
            </div>
            {errors.otp && (
              <span className="text-xs mt-1.5" style={{ color: "var(--error)" }}>
                {errors.otp}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between mb-5">
            <button
              type="button"
              disabled={countdown > 0 || loading}
              onClick={handleResendOtp}
              className="text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50 cursor-pointer"
              style={{ color: "var(--primary)" }}
            >
              {countdown > 0 ? `Resend in ${countdown}s` : "Resend OTP"}
            </button>

            <button
              type="button"
              onClick={() => {
                setErrors({});
                setViewMode("forgot-password");
              }}
              className="text-xs font-medium transition-opacity hover:opacity-80 cursor-pointer"
              style={{ color: "var(--primary)" }}
            >
              Back
            </button>
          </div>

          <Button type="submit" loading={loading} className="py-2.5">
            Verify OTP
          </Button>
        </form>
      )}

      {viewMode === "reset-password" && (
        <form onSubmit={handleResetPasswordSubmit} noValidate className="flex flex-col">
          <InputField
            label="New Password"
            type="password"
            name="newPassword"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              if (errors.newPassword) setErrors((prev) => ({ ...prev, newPassword: "" }));
            }}
            placeholder="Enter new password"
            error={errors.newPassword}
            required
            icon={Lock}
          />

          <InputField
            label="Confirm New Password"
            type="password"
            name="confirmNewPassword"
            value={confirmNewPassword}
            onChange={(e) => {
              setConfirmNewPassword(e.target.value);
              if (errors.confirmNewPassword) setErrors((prev) => ({ ...prev, confirmNewPassword: "" }));
            }}
            placeholder="Confirm new password"
            error={errors.confirmNewPassword}
            required
            icon={Lock}
          />

          <div className="flex items-center justify-end mb-5">
            <button
              type="button"
              onClick={() => {
                setErrors({});
                setViewMode("enter-otp");
              }}
              className="text-xs font-medium transition-opacity hover:opacity-80 cursor-pointer"
              style={{ color: "var(--primary)" }}
            >
              Back
            </button>
          </div>

          <Button type="submit" loading={loading} className="py-2.5">
            Reset Password
          </Button>
        </form>
      )}

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
