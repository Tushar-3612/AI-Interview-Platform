import { useState } from "react";
import { Outlet, Navigate, Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  ClipboardList,
  FilePlus,
  FileText,
  Building2,
  Mail,
  Bell,
  Activity,
  Settings,
  Database,
} from "lucide-react";
import { getAuthToken, getAuthUser } from "../hooks/useStudentProfile";
import { useTheme } from "../hooks/useTheme";
import NotificationBell from "../components/admin/NotificationBell";
import toast from "react-hot-toast";

function AdminLayout() {
  const token = getAuthToken();
  const user = getAuthUser();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (!token || user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    toast.success("Logged out successfully");
    navigate("/", { replace: true });
  };

  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
    { label: "Students", icon: Users, path: "/admin/students" },
    { label: "Create Test", icon: FilePlus, path: "/admin/tests/create" },
    { label: "Assigned Tests", icon: ClipboardList, path: "/admin/tests/assigned" },
    { label: "Reports", icon: FileText, path: "/admin/reports" },
    { label: "Companies", icon: Building2, path: "/admin/companies" },
    { label: "Email", icon: Mail, path: "/admin/email" },
    { label: "Notifications", icon: Bell, path: "/admin/notifications" },
    { label: "Audit Logs", icon: Activity, path: "/admin/audit-logs" },
    { label: "Config", icon: Settings, path: "/admin/config" },
    { label: "Backup", icon: Database, path: "/admin/backup" },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-primary)" }}>
      <AnimatePresence>
        {!sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(true)}
            className="fixed inset-0 z-40 backdrop-blur-sm lg:hidden"
            style={{ background: "var(--admin-modal-overlay)" }}
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col w-64 border-r transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "-translate-x-full" : "translate-x-0"
        }`}
        style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center text-white text-sm font-bold shadow-md">A</div>
            <span className="font-semibold text-sm tracking-wide uppercase" style={{ color: "var(--text-primary)" }}>Admin Panel</span>
          </div>
          <button type="button" onClick={() => setSidebarOpen(false)} className="p-1 rounded-lg admin-hover lg:hidden">
            <X className="w-5 h-5" style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.label}
                to={item.path}
                className="flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all group"
                style={{
                  color: isActive ? "var(--primary)" : "var(--text-secondary)",
                  background: isActive ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "transparent",
                }}
              >
                <Icon className="w-5 h-5 transition-transform group-hover:scale-105" style={{ color: isActive ? "var(--primary)" : "var(--text-muted)" }} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3 p-2.5 rounded-xl border" style={{ borderColor: "var(--border)" }}>
            <div className="w-9 h-9 rounded-full bg-[var(--primary)] flex items-center justify-center text-white font-semibold">AD</div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>Sanjivani Admin</p>
              <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{user.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={toggleTheme} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium border cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
              {theme === "dark" ? <Sun className="w-4 h-4" style={{ color: "#f59e0b" }} /> : <Moon className="w-4 h-4" style={{ color: "#2563eb" }} />}
              <span>Theme</span>
            </button>
            <button type="button" onClick={handleLogout} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--error)" }}>
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        <header className="h-16 sticky top-0 z-30 flex items-center justify-between px-6 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-xl border lg:hidden cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-sm font-semibold tracking-wide" style={{ color: "var(--text-primary)" }}>Admin Dashboard</h2>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 p-6 sm:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
