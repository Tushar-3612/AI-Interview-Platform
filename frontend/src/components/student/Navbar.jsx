import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  Sun,
  Moon,
  ChevronDown,
  User,
  History,
  BarChart3,
  Settings,
  LogOut,
  Play,
} from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { getAuthUser } from "../../hooks/useStudentProfile";
import Logo from "../ui/Logo";

const NAV_LINKS = [
  { label: "Home", path: "/dashboard" },
  { label: "Interview Practice", path: "/interview-practice" },
  { label: "About", path: "/about" },
  { label: "Contact", path: "/contact" },
];

/**
 * Sticky glassmorphism top navigation for student portal.
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
    : "ST";

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

  const profileMenu = [
    { label: "My Profile", icon: User, path: "/profile" },
    { label: "Interview History", icon: History, path: "/interview-history" },
    { label: "Results", icon: BarChart3, path: "/results" },
    { label: "Settings", icon: Settings, path: "/profile" },
  ];

  return (
    <header className="navbar-glass sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-[72px]">
          {/* Logo */}
          <Link to="/dashboard" className="shrink-0">
            <Logo size="sm" />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
                  style={{
                    color: active ? "var(--primary)" : "var(--text-secondary)",
                    background: active ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "transparent",
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2.5 rounded-xl border cursor-pointer transition-all hover:opacity-80"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <motion.button
              type="button"
              onClick={onStartInterview}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white btn-gradient cursor-pointer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Play className="w-4 h-4" />
              Start Interview
            </motion.button>

            {/* Profile Avatar */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 p-1.5 pr-3 rounded-xl border cursor-pointer transition-all hover:opacity-90"
                style={{ borderColor: "var(--border)" }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: "var(--primary)" }}
                >
                  {initials}
                </div>
                <ChevronDown
                  className={`w-4 h-4 hidden sm:block transition-transform ${profileOpen ? "rotate-180" : ""}`}
                  style={{ color: "var(--text-secondary)" }}
                />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-56 rounded-2xl border py-2 shadow-lg z-50"
                    style={{
                      background: "var(--card-bg)",
                      borderColor: "var(--border)",
                      boxShadow: "var(--shadow-lg)",
                    }}
                  >
                    <div className="px-4 py-2 border-b" style={{ borderColor: "var(--border)" }}>
                      <p className="text-sm font-semibold truncate">{user.name || "Student"}</p>
                      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                        {user.email || ""}
                      </p>
                    </div>
                    {profileMenu.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            setProfileOpen(false);
                            navigate(item.path);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer hover:opacity-80 transition-opacity"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          <Icon className="w-4 h-4" />
                          {item.label}
                        </button>
                      );
                    })}
                    <div className="border-t mt-1 pt-1" style={{ borderColor: "var(--border)" }}>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer"
                        style={{ color: "var(--error)" }}
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2.5 rounded-xl border cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="lg:hidden border-t overflow-hidden"
            style={{ borderColor: "var(--border)" }}
          >
            <nav className="px-4 py-4 space-y-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 rounded-xl text-sm font-medium"
                  style={{
                    color: location.pathname === link.path ? "var(--primary)" : "var(--text-secondary)",
                    background:
                      location.pathname === link.path
                        ? "color-mix(in srgb, var(--primary) 8%, transparent)"
                        : "transparent",
                  }}
                >
                  {link.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onStartInterview?.();
                }}
                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white btn-gradient cursor-pointer"
              >
                <Play className="w-4 h-4" />
                Start Interview
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export default Navbar;
