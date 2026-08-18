import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sun,
  Moon,
  ChevronDown,
  User,
  Settings,
  LogOut,
  Play,
  Menu,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../../utils/api";
import { useTheme } from "../../hooks/useTheme";
import { getAuthUser, getAuthToken } from "../../hooks/useStudentProfile";

const NAV_LINKS = [
  { label: "Home", path: "/dashboard" },
  { label: "My Tests", path: "/tests" },
  { label: "Interview Practice", path: "/interview-practice" },
  { label: "Mock Interview", path: "/company-mock" },
  { label: "Placement", path: "/placement-dashboard" },
  { label: "About", path: "/about" },
  { label: "Contact", path: "/contact" },
];

/**
 * Premium Navbar — Apple / Stripe / Linear inspired.
 * Layout: [LOGO] ........... [NAV CENTERED] ........... [CTA + PROFILE]
 * Height: 76px. Thin bottom border. White bg (light) / Charcoal bg (dark).
 * Theme toggle lives ONLY inside the Profile dropdown.
 */
function Navbar({ onStartInterview }) {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const user = getAuthUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef(null);

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "TN";

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    navigate("/");
  };

  const handleStartRealInterview = async () => {
    const toastId = toast.loading("Creating Real Interview Session...");
    try {
      const token = getAuthToken();
      const { data } = await api.post(
        "/api/interview/start",
        { interviewType: "actual" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const sessionId = data.sessionId || data.interviewId;
      if (sessionId) {
        toast.success("Interview Session created!", { id: toastId });
        window.open(`/interview/${sessionId}`, "_blank");
      } else {
        throw new Error("No session ID returned");
      }
    } catch (err) {
      console.error("Start interview error:", err);
      toast.error(err.response?.data?.message || "Failed to start interview session", { id: toastId });
    }
  };

  return (
    <header
      id="student-navbar"
      className="sticky top-0 z-50 transition-all duration-300 select-none"
      style={{
        height: "76px",
        background: theme === "dark"
          ? "rgba(15, 18, 28, 0.78)"
          : "rgba(255, 255, 255, 0.82)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: theme === "dark"
          ? "0 1px 24px rgba(0, 0, 0, 0.35), 0 1px 0 rgba(255, 255, 255, 0.04)"
          : "0 1px 12px rgba(0, 0, 0, 0.04), 0 1px 0 rgba(0, 0, 0, 0.03)",
      }}
    >
      <div
        className="max-w-[1440px] mx-auto h-full flex items-center justify-between"
        style={{ padding: "0 40px" }}
      >
        {/* ── FAR LEFT: Logo ── */}
        <Link to="/dashboard" aria-label="Home" className="shrink-0 flex items-center">
          <img
            src="/images/metadata.png"
            alt="PrepHire"
            className="h-[100px] w-auto object-contain"
            draggable="false"
          />
        </Link>

        {/* ── RIGHT GROUP: Nav Links + CTA + Profile ── */}
        <div className="hidden lg:flex items-center gap-1">

          {/* Navigation Links */}
          {NAV_LINKS.map((link) => {
            const active =
              location.pathname === link.path ||
              (link.path === "/dashboard" && location.pathname === "/") ||
              (link.path === "/company-mock" && location.pathname.startsWith("/company-mock"));
            return (
              <Link
                key={link.path}
                to={link.path}
                className="relative flex items-center h-full transition-all duration-200 whitespace-nowrap rounded-lg"
                style={{
                  padding: "0 13px",
                  fontSize: "13.5px",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                  color: active ? "#FF6B35" : theme === "dark" ? "#AEB4C0" : "#4B5563",
                  background: active
                    ? theme === "dark"
                      ? "rgba(255, 107, 53, 0.10)"
                      : "rgba(255, 107, 53, 0.07)"
                    : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = theme === "dark" ? "#FFFFFF" : "#111827";
                    e.currentTarget.style.background = theme === "dark"
                      ? "rgba(255, 255, 255, 0.06)"
                      : "rgba(0, 0, 0, 0.04)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = theme === "dark" ? "#AEB4C0" : "#4B5563";
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <span>{link.label}</span>
              </Link>
            );
          })}

          {/* Divider */}
          <div
            className="mx-2 h-5 w-px"
            style={{ background: theme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)" }}
          />

          {/* Start Interview Button */}
          <motion.button
            type="button"
            onClick={handleStartRealInterview}
            className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-white cursor-pointer"
            style={{
              padding: "8px 18px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)",
              boxShadow: "0 2px 10px rgba(255, 107, 53, 0.30)",
              fontSize: "13px",
              letterSpacing: "-0.01em",
            }}
            whileHover={{ scale: 1.02, boxShadow: "0 4px 18px rgba(255, 107, 53, 0.40)" }}
            whileTap={{ scale: 0.98 }}
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Start Interview</span>
          </motion.button>

          {/* Profile Dropdown */}
          <div className="relative ml-1" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 cursor-pointer transition-all duration-200 rounded-xl"
              style={{
                padding: "5px 10px 5px 5px",
                border: `1px solid ${theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
                background: profileOpen
                  ? theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"
                  : "transparent",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = theme === "dark"
                ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)")}
              onMouseLeave={(e) => {
                if (!profileOpen) e.currentTarget.style.background = "transparent";
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                style={{ background: "linear-gradient(135deg, #374151 0%, #4B5563 100%)" }}
              >
                {user.avatar ? (
                  <img src={user.avatar} alt="Profile" className="w-full h-full rounded-lg object-cover" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <ChevronDown
                className="w-3.5 h-3.5 transition-transform duration-200"
                style={{
                  color: theme === "dark" ? "#AEB4C0" : "#6B7280",
                  transform: profileOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </button>

            {/* Profile Dropdown Menu */}
            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 mt-2 py-2 z-50 overflow-hidden"
                  style={{
                    width: "240px",
                    borderRadius: "14px",
                    background: theme === "dark" ? "#1A1D27" : "#FFFFFF",
                    border: `1px solid ${theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
                    boxShadow: "0 16px 40px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08)",
                  }}
                >
                  {/* User Info Header */}
                  <div
                    className="px-4 py-3 flex items-center gap-3"
                    style={{ borderBottom: `1px solid ${theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}` }}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{ background: "linear-gradient(135deg, #374151 0%, #4B5563 100%)" }}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-xs font-bold truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {user.name || "User"}
                      </p>
                      <p
                        className="text-[11px] truncate"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {user.email || "user@example.com"}
                      </p>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        navigate("/profile");
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-xs font-medium cursor-pointer transition-colors"
                      style={{ color: "var(--text-secondary)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-primary)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <User className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                      <span>Profile</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        navigate("/profile");
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-xs font-medium cursor-pointer transition-colors"
                      style={{ color: "var(--text-secondary)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-primary)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <Settings className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                      <span>Settings</span>
                    </button>
                  </div>

                  {/* Theme Toggle Switch */}
                  <div
                    className="px-4 py-2.5 flex items-center justify-between"
                    style={{
                      borderTop: `1px solid ${theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}`,
                      borderBottom: `1px solid ${theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}`,
                    }}
                  >
                    <div className="flex items-center gap-2.5 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                      {theme === "dark" ? (
                        <Moon className="w-4 h-4" style={{ color: "#FF6B35" }} />
                      ) : (
                        <Sun className="w-4 h-4" style={{ color: "#FF6B35" }} />
                      )}
                      <span>Theme</span>
                    </div>
                    <div
                      className="flex items-center gap-1 p-0.5 rounded-lg"
                      style={{
                        background: theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                        border: `1px solid ${theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => theme !== "light" && toggleTheme()}
                        className="p-1 rounded-md cursor-pointer transition-all"
                        style={{
                          background: theme === "light" ? "var(--card-bg)" : "transparent",
                          color: theme === "light" ? "#FF6B35" : "var(--text-muted)",
                          boxShadow: theme === "light" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                        }}
                        title="Light Mode"
                      >
                        <Sun className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => theme !== "dark" && toggleTheme()}
                        className="p-1 rounded-md cursor-pointer transition-all"
                        style={{
                          background: theme === "dark" ? "var(--card-bg)" : "transparent",
                          color: theme === "dark" ? "#FF6B35" : "var(--text-muted)",
                          boxShadow: theme === "dark" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                        }}
                        title="Dark Mode"
                      >
                        <Moon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Logout */}
                  <div className="pt-1.5">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold cursor-pointer transition-colors"
                      style={{ color: "#FF6B35" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 107, 53, 0.06)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden p-2 rounded-lg cursor-pointer transition-colors"
          style={{
            color: theme === "dark" ? "#AEB4C0" : "#4B5563",
            border: `1px solid ${theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
          }}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════
          MOBILE DRAWER
      ═══════════════════════════════════════════════ */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="lg:hidden overflow-hidden"
            style={{
              borderTop: `1px solid ${theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}`,
              background: theme === "dark" ? "#1A1D27" : "#FFFFFF",
            }}
          >
            <nav className="px-6 py-4 space-y-1">
              {NAV_LINKS.map((link) => {
                const active = location.pathname === link.path ||
                  (link.path === "/company-mock" && location.pathname.startsWith("/company-mock"));
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                    style={{
                      color: active ? "#FF6B35" : "var(--text-secondary)",
                      background: active ? "rgba(255, 107, 53, 0.06)" : "transparent",
                    }}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  handleStartRealInterview();
                }}
                className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)",
                  boxShadow: "0 2px 10px rgba(255, 107, 53, 0.30)",
                }}
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Start Interview</span>
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export default Navbar;
