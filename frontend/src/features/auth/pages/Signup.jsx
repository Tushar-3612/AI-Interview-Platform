import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Mail, Lock, GraduationCap, Link2, Calendar, ArrowRight, ShieldCheck, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import AuthLayout from "../../../core/layouts/AuthLayout.jsx";
import InputField from "../../../core/ui/InputField.jsx";
import Button from "../../../core/ui/Button.jsx";
import api from "../../../core/api/api.js";
import { DEPARTMENTS, YEARS } from "../../../core/utils/constants.js";
import {
  validateEmail,
  validatePassword,
  validateRequired,
} from "../../../core/utils/validators.js";

/**
 * Signup Page — student registration with mandatory server-side OTP email verification.
 */
function Signup() {
  const navigate = useNavigate();

  const [step, setStep] = useState("form"); // "form" | "verify-otp"
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    department: "",
    year: "",
    password: "",
    confirmPassword: "",
    portfolio: "",
    termsAccepted: false,
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // OTP state
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef([]);

  // Countdown timer effect
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

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

  const isValidUrl = (string) => {
    try {
      const url = new URL(string);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
      return false;
    }
  };

  // Step 1: Submit Form -> Send Registration OTP
  const handleInitiateSignup = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/send-registration-otp", {
        name: formData.name,
        email: formData.email,
      });

      toast.success(data.message || "OTP sent. It is valid for 3 minutes.");
      setStep("verify-otp");
      setCountdown(180); // 3 minutes countdown
      setOtpDigits(["", "", "", "", "", ""]);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to send verification OTP. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // OTP Box Handlers
  const handleOtpChange = (index, value) => {
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otpDigits];
    newOtp[index] = value.slice(-1);
    setOtpDigits(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (!otpDigits[index] && index > 0) {
        otpRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pasteData)) {
      const digits = pasteData.split("");
      setOtpDigits(digits);
      otpRefs.current[5]?.focus();
    }
  };

  // Resend Registration OTP
  const handleResendOtp = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/send-registration-otp", {
        name: formData.name,
        email: formData.email,
      });
      toast.success(data.message || "New OTP sent successfully");
      setCountdown(180);
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

  // Step 2: Verify Registration OTP -> Complete Account Creation
  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    const otpValue = otpDigits.join("");
    if (otpValue.length < 6) {
      setErrors({ otp: "Please enter all 6 digits" });
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      // 1. Verify OTP and obtain verified registration token
      const { data: verifyData } = await api.post("/api/auth/verify-registration-otp", {
        email: formData.email,
        otp: otpValue,
      });

      // 2. Submit verified signup payload
      await api.post("/api/auth/signup", {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        department: formData.department,
        year: formData.year,
        portfolio: formData.portfolio || null,
        registrationToken: verifyData.registrationToken,
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
      title={step === "verify-otp" ? "Verify Your Email" : "Create Account"}
      subtitle={
        step === "verify-otp"
          ? "Verify your email before creating your account."
          : "Start your placement preparation journey."
      }
      contentClassName="max-w-[460px]"
      showFooterBadge={false}
    >
      {step === "form" ? (
        <form onSubmit={handleInitiateSignup} noValidate className="flex flex-col">
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
            options={DEPARTMENTS}
            icon={GraduationCap}
          />

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
          <div className="mb-4">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                name="termsAccepted"
                checked={formData.termsAccepted}
                onChange={handleChange}
                className="w-4 h-4 rounded cursor-pointer accent-[var(--primary)] border-[var(--border)] bg-[var(--input-bg)]"
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
      ) : (
        <form onSubmit={handleVerifyAndRegister} noValidate className="flex flex-col">
          <div className="p-3.5 mb-5 rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[var(--primary)] shrink-0 mt-0.5" />
            <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
              A 6-digit verification code was dispatched to{" "}
              <strong className="text-[var(--text-primary)]">{formData.email}</strong>.
              <span className="block mt-0.5 text-[var(--primary)] font-medium">It is valid for 3 minutes.</span>
            </div>
          </div>

          <div className="flex flex-col mb-5">
            <label className="text-xs font-semibold mb-2 text-[var(--text-primary)]">
              Enter 6-Digit Verification Code
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
                  className="w-11 h-11 text-center font-bold text-lg rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 transition-all shadow-xs"
                  autoFocus={index === 0}
                />
              ))}
            </div>
            {errors.otp && (
              <span className="text-xs mt-1.5 text-[#EF4444]">
                {errors.otp}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between mb-5">
            <button
              type="button"
              disabled={countdown > 0 || loading}
              onClick={handleResendOtp}
              className="text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50 cursor-pointer text-[var(--primary)]"
            >
              {countdown > 0 ? `Resend in ${countdown}s` : "Resend OTP"}
            </button>

            <button
              type="button"
              onClick={() => {
                setErrors({});
                setStep("form");
              }}
              className="text-xs font-semibold transition-opacity hover:opacity-80 hover:underline cursor-pointer text-[var(--text-secondary)] flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Edit Information
            </button>
          </div>

          <Button type="submit" loading={loading} className="py-2.5">
            Verify &amp; Create Account
          </Button>
        </form>
      )}

      {/* OR Divider */}
      <div className="relative my-4">
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