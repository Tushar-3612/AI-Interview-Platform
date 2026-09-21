import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  ClipboardList,
  BookOpen,
  Sparkles,
  Code2,
  Compass,
  HelpCircle,
  MessageSquare,
  User,
  LogOut,
  X,
} from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { getAuthUser } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

const NAV_ITEMS = [
  { label: "Home", path: "/dashboard", icon: Home },
  { label: "My Tests", path: "/tests", icon: ClipboardList },
  { label: "Interview Practice", path: "/interview-practice", icon: BookOpen },
  { label: "Coding Round", path: "/coding-round", icon: Code2 },
  { label: "Mock Interview", path: "/mock-interview", icon: Sparkles },
  { label: "Placement", path: "/placement-dashboard", icon: Compass },
  { label: "About", path: "/about", icon: HelpCircle },
  { label: "Contact", path: "/contact", icon: MessageSquare },
];

export default function StudentSidebar({
  collapsed = false,
  mobileOpen = false,
  onCloseMobile = () => {},
}) {
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const user = getAuthUser();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    toast.success("Logged out successfully");
    navigate("/", { replace: true });
  };

  const isItemActive = (path) => {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard" || location.pathname === "/";
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <>
      {/* ═══════════════════════════════════════════════
          DESKTOP COLLAPSIBLE SIDEBAR (lg:flex)
      ═══════════════════════════════════════════════ */}
      <aside
        id="student-desktop-sidebar"
        className={`hidden lg:flex flex-col fixed top-0 left-0 bottom-0 z-40 transition-all duration-300 ease-in-out select-none ${
          collapsed ? "w-[72px]" : "w-64"
        }`}
        style={{
          height: "100vh",
          background: theme === "dark" ? "#0C0F17" : "#FFFFFF",
          borderRight: `1px solid ${
            theme === "dark" ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.08)"
          }`,
          boxShadow:
            theme === "dark"
              ? "2px 0 12px rgba(0, 0, 0, 0.25)"
              : "2px 0 12px rgba(0, 0, 0, 0.03)",
        }}
      >
        {/* Brand / Logo Area */}
        <div
          className={`h-[72px] flex items-center border-b transition-all duration-300 ${
            collapsed ? "justify-center px-2 pt-2.5" : "px-5 pt-2.5 gap-2.5"
          }`}
          style={{
            borderColor:
              theme === "dark" ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)",
          }}
        >
          <Link
            to="/dashboard"
            className={`flex items-center group focus:outline-none ${
              collapsed ? "justify-center" : "gap-2.5"
            }`}
            title="PrepHire Home"
          >
            <img
              src="/images/metadata.png"
              alt="PrepHire Logo"
              className={`object-contain shrink-0 transition-transform duration-200 group-hover:scale-130 ${
                collapsed
                  ? "h-14 w-14 scale-120 origin-center"
                  : "h-14 w-14 scale-115 origin-center"
              }`}
              draggable="false"
            />
            {!collapsed && (
              <span className="text-2xl font-black tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                <span style={{ color: theme === "dark" ? "#FFFFFF" : "#111827" }}>Prep</span>
                <span style={{ color: "#FF6B35" }}>Hire</span>
              </span>
            )}
          </Link>
        </div>

        {/* Navigation Items (Scrollable) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-1.5 custom-scrollbar">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item.path);

            return (
              <Link
                key={item.label}
                to={item.path}
                title={collapsed ? item.label : undefined}
                className={`relative flex items-center rounded-xl transition-all duration-200 group ${
                  collapsed
                    ? "justify-center w-11 h-11 mx-auto"
                    : "gap-3.5 px-3.5 py-3 text-sm font-semibold"
                }`}
                style={{
                  color: active
                    ? "#FF6B35"
                    : theme === "dark"
                    ? "#AEB4C0"
                    : "#4B5563",
                  background: active
                    ? theme === "dark"
                      ? "rgba(255, 107, 53, 0.12)"
                      : "rgba(255, 107, 53, 0.08)"
                    : "transparent",
                  border: active
                    ? "1px solid rgba(255, 107, 53, 0.25)"
                    : "1px solid transparent",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background =
                      theme === "dark"
                        ? "rgba(255, 255, 255, 0.05)"
                        : "rgba(0, 0, 0, 0.04)";
                    e.currentTarget.style.color =
                      theme === "dark" ? "#FFFFFF" : "#111827";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color =
                      theme === "dark" ? "#AEB4C0" : "#4B5563";
                  }
                }}
              >
                <Icon
                  className="w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110"
                  style={{
                    color: active
                      ? "#FF6B35"
                      : theme === "dark"
                      ? "#8E95A5"
                      : "#6B7280",
                  }}
                />
                {!collapsed && (
                  <span className="whitespace-nowrap truncate">{item.label}</span>
                )}

                {/* Active Indicator Bar on Collapsed */}
                {collapsed && active && (
                  <motion.div
                    layoutId="activeSidebarIndicator"
                    className="absolute -left-1.5 w-1 h-5 rounded-r-full bg-[#FF6B35]"
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Bottom Profile / Logout Footer */}
        <div
          className="p-3 border-t space-y-1"
          style={{
            borderColor:
              theme === "dark" ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)",
          }}
        >
          <Link
            to="/profile"
            title={collapsed ? "Edit Profile" : undefined}
            className={`flex items-center rounded-xl transition-all duration-200 group ${
              collapsed
                ? "justify-center w-11 h-11 mx-auto"
                : "gap-3 px-3 py-2.5 text-xs font-semibold"
            }`}
            style={{
              color: theme === "dark" ? "#AEB4C0" : "#4B5563",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                theme === "dark"
                  ? "rgba(255, 255, 255, 0.05)"
                  : "rgba(0, 0, 0, 0.04)";
              e.currentTarget.style.color =
                theme === "dark" ? "#FFFFFF" : "#111827";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color =
                theme === "dark" ? "#AEB4C0" : "#4B5563";
            }}
          >
            <User className="w-4.5 h-4.5 shrink-0 transition-transform duration-200 group-hover:scale-110 text-gray-400" />
            {!collapsed && <span className="whitespace-nowrap truncate">Edit Profile</span>}
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            title={collapsed ? "Log Out" : undefined}
            className={`w-full flex items-center rounded-xl transition-all duration-200 cursor-pointer group ${
              collapsed
                ? "justify-center w-11 h-11 mx-auto"
                : "gap-3 px-3 py-2.5 text-xs font-bold"
            }`}
            style={{
              color: "#EF4444",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <LogOut className="w-4.5 h-4.5 shrink-0 transition-transform duration-200 group-hover:scale-110 text-[#EF4444]" />
            {!collapsed && <span className="whitespace-nowrap truncate">Log Out</span>}
          </button>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════
          MOBILE OFF-CANVAS DRAWER (lg:hidden)
      ═══════════════════════════════════════════════ */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onCloseMobile}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              aria-hidden="true"
            />

            {/* Off-canvas Sliding Drawer */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-72 max-w-[80vw] h-full flex flex-col z-10 shadow-2xl overflow-hidden"
              style={{
                background: theme === "dark" ? "#0F121C" : "#FFFFFF",
                borderRight: `1px solid ${
                  theme === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)"
                }`,
              }}
            >
              {/* Drawer Top Header */}
              <div
                className="h-16 flex items-center justify-between px-5 border-b"
                style={{
                  borderColor:
                    theme === "dark" ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src="/images/metadata.png"
                    alt="PrepHire Logo"
                    className="h-9 w-9 object-contain"
                  />
                  <span className="text-lg font-black tracking-tight">
                    <span style={{ color: theme === "dark" ? "#FFFFFF" : "#111827" }}>Prep</span>
                    <span style={{ color: "#FF6B35" }}>Hire</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                  style={{
                    color: theme === "dark" ? "#AEB4C0" : "#4B5563",
                    background:
                      theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                  }}
                  aria-label="Close sidebar"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Drawer Navigation List */}
              <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5 custom-scrollbar">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(item.path);

                  return (
                    <Link
                      key={item.label}
                      to={item.path}
                      onClick={onCloseMobile}
                      className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors"
                      style={{
                        color: active
                          ? "#FF6B35"
                          : theme === "dark"
                          ? "#AEB4C0"
                          : "#4B5563",
                        background: active
                          ? theme === "dark"
                            ? "rgba(255, 107, 53, 0.12)"
                            : "rgba(255, 107, 53, 0.08)"
                          : "transparent",
                        border: active
                          ? "1px solid rgba(255, 107, 53, 0.25)"
                          : "1px solid transparent",
                      }}
                    >
                      <Icon
                        className="w-5 h-5 shrink-0"
                        style={{
                          color: active
                            ? "#FF6B35"
                            : theme === "dark"
                            ? "#8E95A5"
                            : "#6B7280",
                        }}
                      />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Drawer Bottom Profile & Logout */}
              <div
                className="p-3 border-t space-y-1"
                style={{
                  borderColor:
                    theme === "dark" ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)",
                }}
              >
                <Link
                  to="/profile"
                  onClick={onCloseMobile}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors"
                  style={{
                    color: theme === "dark" ? "#AEB4C0" : "#4B5563",
                  }}
                >
                  <User className="w-4.5 h-4.5 shrink-0 text-gray-400" />
                  <span>Edit Profile</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    onCloseMobile();
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  style={{
                    color: "#EF4444",
                  }}
                >
                  <LogOut className="w-4.5 h-4.5 shrink-0 text-[#EF4444]" />
                  <span>Log Out</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
