import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun,
  Moon,
  ChevronDown,
  User,
  Settings,
  LogOut,
  Play,
  PanelLeft,
  ChevronRight,
} from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { getAuthUser } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

// Helper to get breadcrumb subtitle based on pathname
const getBreadcrumbTitle = (pathname) => {
  if (pathname === "/dashboard" || pathname === "/") return "Dashboard";
  if (pathname.startsWith("/interview-practice")) return "Question Tracker";
  if (pathname.startsWith("/coding-round")) return "Coding Round";
  if (pathname.startsWith("/mock-interview")) return "Mock Interview";
  if (pathname.startsWith("/tests")) return "My Tests";
  if (pathname.startsWith("/placement-dashboard")) return "Placement";
  if (pathname.startsWith("/profile")) return "Profile";
  if (pathname.startsWith("/about")) return "Help Center";
  if (pathname.startsWith("/contact")) return "Feedback";
  if (pathname.startsWith("/placement/leaderboard")) return "Leaderboard";
  return "Dashboard";
};

/**
 * Premium Top Header / Navbar
 * Integrates sidebar toggle, breadcrumb, quick CTA pill, streak, notifications, theme toggle, and profile.
 */
function Navbar({
  onToggleSidebar = () => { },
  sidebarCollapsed = false,
  onOpenMobileDrawer = () => { },
  onStartInterview,
}) {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const user = getAuthUser();
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef(null);

  const initials = user?.name
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
    toast.success("Logged out successfully");
    navigate("/");
  };

  const handleStartRealInterview = () => {
    navigate("/interview");
  };

  const currentTitle = getBreadcrumbTitle(location.pathname);

  return (
    <header
      id="student-navbar"
      className="sticky top-0 z-30 transition-all duration-300 select-none"
      style={{
        height: "73px",
        background:
          theme === "dark"
            ? "rgba(12, 15, 23, 0.88)"
            : "rgba(255, 255, 255, 0.90)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${theme === "dark" ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.07)"
          }`,
      }}
    >
      <div className="w-full h-full flex items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* ── LEFT SECTION: Desktop Toggle & Breadcrumb / Mobile Hamburger & Logo ── */}
        <div className="flex items-center gap-3 sm:gap-4">


          {/* Mobile Brand */}
          <Link
            to="/dashboard"
            className="lg:hidden flex items-center group focus:outline-none"
            aria-label="PrepHire Home"
          >
            <img
              src="/images/metadata.png"
              alt="PrepHire Logo"
              className="h-14 sm:h-15 w-auto object-contain transition-transform group-hover:scale-105"
            />
          </Link>

          {/* Desktop Sidebar Toggle Button */}
          <div className="hidden lg:flex items-center gap-3.5">
            <button
              type="button"
              onClick={onToggleSidebar}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-200 active:scale-95"
              style={{
                background:
                  theme === "dark"
                    ? "rgba(255, 255, 255, 0.05)"
                    : "rgba(0, 0, 0, 0.04)",
                border: `1px solid ${theme === "dark"
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.07)"
                  }`,
                color: theme === "dark" ? "#AEB4C0" : "#4B5563",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  theme === "dark"
                    ? "rgba(255, 255, 255, 0.09)"
                    : "rgba(0, 0, 0, 0.07)";
                e.currentTarget.style.color =
                  theme === "dark" ? "#FFFFFF" : "#111827";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  theme === "dark"
                    ? "rgba(255, 255, 255, 0.05)"
                    : "rgba(0, 0, 0, 0.04)";
                e.currentTarget.style.color =
                  theme === "dark" ? "#AEB4C0" : "#4B5563";
              }}
              aria-label="Toggle sidebar"
            >
              <PanelLeft className="w-4.5 h-4.5" />
            </button>

            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span
                style={{
                  color: theme === "dark" ? "#6B7280" : "#9CA3AF",
                }}
              >
                Workspace
              </span>
              <ChevronRight
                className="w-3.5 h-3.5"
                style={{ color: theme === "dark" ? "#4B5563" : "#D1D5DB" }}
              />
              <span
                className="font-bold"
                style={{
                  color: theme === "dark" ? "#FFFFFF" : "#111827",
                }}
              >
                {currentTitle}
              </span>
            </div>
          </div>
        </div>

        {/* ── RIGHT SECTION: Actions, Streak, Notifications, Theme, Profile ── */}
        <div className="flex items-center gap-2.5 sm:gap-3">




          {/* Direct Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all"
            style={{
              color: theme === "dark" ? "#F59E0B" : "#2563EB",
              background:
                theme === "dark"
                  ? "rgba(255, 255, 255, 0.04)"
                  : "rgba(0, 0, 0, 0.03)",
              border: `1px solid ${theme === "dark"
                ? "rgba(255, 255, 255, 0.07)"
                : "rgba(0, 0, 0, 0.06)"
                }`,
            }}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle Theme"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          {/* Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-1.5 cursor-pointer transition-all duration-200 rounded-xl"
              style={{
                padding: "3px",
                border: `1px solid ${theme === "dark"
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.06)"
                  }`,
                background: profileOpen
                  ? theme === "dark"
                    ? "rgba(255, 255, 255, 0.06)"
                    : "rgba(0, 0, 0, 0.04)"
                  : "transparent",
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm"
                style={{
                  background: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)",
                }}
              >
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt="Profile"
                    className="w-full h-full rounded-lg object-cover"
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
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
                    border: `1px solid ${theme === "dark"
                      ? "rgba(255, 255, 255, 0.08)"
                      : "rgba(0, 0, 0, 0.06)"
                      }`,
                    boxShadow:
                      "0 16px 40px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08)",
                  }}
                >
                  {/* User Info Header */}
                  <div
                    className="px-4 py-3 flex items-center gap-3"
                    style={{
                      borderBottom: `1px solid ${theme === "dark"
                        ? "rgba(255, 255, 255, 0.06)"
                        : "rgba(0, 0, 0, 0.05)"
                        }`,
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{
                        background:
                          "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)",
                      }}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-xs font-bold truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {user?.name || "User"}
                      </p>
                      <p
                        className="text-[11px] truncate"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {user?.email || "user@example.com"}
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
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "var(--bg-primary)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
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
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "var(--bg-primary)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <Settings className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                      <span>Settings</span>
                    </button>
                  </div>

                  {/* Logout */}
                  <div
                    className="pt-1.5"
                    style={{
                      borderTop: `1px solid ${theme === "dark"
                        ? "rgba(255, 255, 255, 0.06)"
                        : "rgba(0, 0, 0, 0.05)"
                        }`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold cursor-pointer transition-colors"
                      style={{ color: "#EF4444" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
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
      </div>
    </header>
  );
}

export default Navbar;
