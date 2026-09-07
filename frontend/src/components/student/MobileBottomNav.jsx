import { Link, useLocation } from "react-router-dom";
import { Home, Code2, UserCheck, Menu } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";

/**
 * Mobile Bottom Navigation Bar for Students (PrepHire mobile experience).
 * Features Hamburger Menu tab as the first item, followed by Home, Practice, and Mock Test.
 */
export default function MobileBottomNav({ onOpenMobileDrawer = () => {} }) {
  const location = useLocation();
  const { theme } = useTheme();

  const navItems = [
    {
      id: "menu",
      label: "Menu",
      icon: Menu,
      isButton: true,
      onClick: onOpenMobileDrawer,
    },
    {
      id: "home",
      label: "Home",
      path: "/dashboard",
      icon: Home,
      isActive: (pathname) => pathname === "/dashboard" || pathname === "/",
    },
    {
      id: "practice",
      label: "Practice",
      path: "/interview-practice",
      icon: Code2,
      isActive: (pathname) =>
        pathname.startsWith("/interview-practice") ||
        pathname.startsWith("/practice"),
    },
    {
      id: "mock-test",
      label: "Mock Test",
      path: "/mock-interview",
      icon: UserCheck,
      isActive: (pathname) =>
        pathname.startsWith("/mock-interview") ||
        pathname.startsWith("/company-mock"),
    },
  ];

  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 select-none transition-all duration-300"
      style={{
        background:
          theme === "dark"
            ? "rgba(12, 16, 26, 0.88)"
            : "rgba(255, 255, 255, 0.90)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: `1px solid ${
          theme === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)"
        }`,
        boxShadow:
          theme === "dark"
            ? "0 -4px 20px rgba(0, 0, 0, 0.45)"
            : "0 -4px 20px rgba(0, 0, 0, 0.06)",
      }}
    >
      <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-around">
        {navItems.map((item) => {
          const active = item.isActive ? item.isActive(location.pathname) : false;
          const Icon = item.icon;

          if (item.isButton) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className="flex flex-col items-center justify-center flex-1 py-1 transition-all duration-200 cursor-pointer active:scale-95 group"
                style={{
                  color: theme === "dark" ? "#8E95A5" : "#6B7280",
                }}
                aria-label="Open sidebar menu"
              >
                <div className="relative">
                  <Icon
                    className="w-5 h-5 mb-0.5 transition-transform duration-200 group-hover:scale-110"
                    style={{
                      strokeWidth: 2,
                      color: "currentColor",
                    }}
                  />
                </div>
                <span
                  className="text-[11px] font-semibold tracking-tight transition-colors"
                  style={{
                    color: theme === "dark" ? "#8E95A5" : "#6B7280",
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={item.id}
              to={item.path}
              className="flex flex-col items-center justify-center flex-1 py-1 transition-all duration-200 relative group"
              style={{
                color: active
                  ? "#FF6B35"
                  : theme === "dark"
                  ? "#8E95A5"
                  : "#6B7280",
              }}
            >
              <div className="relative">
                <Icon
                  className="w-5 h-5 mb-0.5 transition-transform duration-200 group-hover:scale-110"
                  style={{
                    strokeWidth: active ? 2.4 : 1.9,
                    color: active ? "#FF6B35" : "currentColor",
                  }}
                />
                {active && (
                  <span
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#FF6B35]"
                  />
                )}
              </div>

              <span
                className="text-[11px] font-semibold tracking-tight transition-colors"
                style={{
                  color: active
                    ? "#FF6B35"
                    : theme === "dark"
                    ? "#8E95A5"
                    : "#6B7280",
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
