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
  Building2,
  Activity,
  Settings,
  Code2,
  BrainCircuit,
  Target,
  BarChart3,
  HelpCircle,
  Terminal,
  UserCheck,
  Crown,
  ShieldAlert,
} from "lucide-react";
import { getAuthToken, getAuthUser } from "../../features/student/hooks/useStudentProfile.js";
import { useTheme } from "../hooks/useTheme.jsx";
import toast from "react-hot-toast";

function AdminLayout() {
  const token = getAuthToken();
  const user = getAuthUser();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isSystemAdmin = user?.role === "system_admin" || user?.role === "admin";
  const isTeacher = user?.role === "teacher";

  if (!token || (!isSystemAdmin && !isTeacher)) {
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

  // Dynamic nav items based on role
  const navItems = isSystemAdmin
    ? [
        { label: "Master Dashboard", icon: LayoutDashboard, path: "/admin/system-dashboard" },
        { label: "Teachers", icon: UserCheck, path: "/admin/teachers" },
        { label: "Premium Members", icon: Crown, path: "/admin/premium" },
        { label: "All Students", icon: Users, path: "/admin/students" },
        { label: "Platform Analytics", icon: BarChart3, path: "/admin/analytics" },
        { label: "Create Test", icon: FilePlus, path: "/admin/tests/create" },
        { label: "Assigned Tests", icon: ClipboardList, path: "/admin/tests/assigned" },
        { label: "Placement Analytics", icon: Target, path: "/admin/placement-analytics" },
        { label: "Companies", icon: Building2, path: "/admin/companies" },
        { label: "Mock Questions", icon: HelpCircle, path: "/admin/mock-questions" },
        { label: "Aptitude Questions", icon: BrainCircuit, path: "/admin/aptitude-questions" },
        { label: "Coding Questions", icon: Code2, path: "/admin/coding-questions" },
        { label: "Coding Assessments", icon: Terminal, path: "/admin/coding-assessments" },
        { label: "Technical Questions", icon: BrainCircuit, path: "/admin/technical-questions" },
        { label: "Audit Logs", icon: Activity, path: "/admin/audit-logs" },
        { label: "System Config", icon: Settings, path: "/admin/config" },
      ]
    : [
        { label: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
        { label: "My Students", icon: Users, path: "/admin/students" },
        { label: "Department Analytics", icon: BarChart3, path: "/admin/analytics" },
        { label: "Create Test", icon: FilePlus, path: "/admin/tests/create" },
        { label: "Assigned Tests", icon: ClipboardList, path: "/admin/tests/assigned" },
        { label: "Placement Analytics", icon: Target, path: "/admin/placement-analytics" },
        { label: "Companies", icon: Building2, path: "/admin/companies" },
        { label: "Mock Questions", icon: HelpCircle, path: "/admin/mock-questions" },
        { label: "Aptitude Questions", icon: BrainCircuit, path: "/admin/aptitude-questions" },
        { label: "Coding Questions", icon: Code2, path: "/admin/coding-questions" },
        { label: "Coding Assessments", icon: Terminal, path: "/admin/coding-assessments" },
        { label: "Technical Questions", icon: BrainCircuit, path: "/admin/technical-questions" },
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
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-md ${isSystemAdmin ? "bg-purple-600" : "bg-blue-600"}`}>
              {isSystemAdmin ? "SA" : "TA"}
            </div>
            <div>
              <span className="font-semibold text-xs tracking-wide uppercase block" style={{ color: "var(--text-primary)" }}>
                {isSystemAdmin ? "System Admin" : "Teacher Admin"}
              </span>
              {isTeacher && user?.department && (
                <span className="text-[10px] text-blue-500 font-semibold block truncate max-w-[130px]">
                  {user.department}
                </span>
              )}
            </div>
          </div>
          <button type="button" onClick={() => setSidebarOpen(false)} className="p-1 rounded-lg admin-hover lg:hidden">
            <X className="w-5 h-5" style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== "/admin/dashboard" && item.path !== "/admin/system-dashboard" && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.label}
                to={item.path}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group"
                style={{
                  color: isActive ? "var(--primary)" : "var(--text-secondary)",
                  background: isActive ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "transparent",
                }}
              >
                <Icon className="w-4 h-4 transition-transform group-hover:scale-105" style={{ color: isActive ? "var(--primary)" : "var(--text-muted)" }} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl border" style={{ borderColor: "var(--border)" }}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold ${isSystemAdmin ? "bg-purple-600" : "bg-blue-600"}`}>
              {user?.name?.charAt(0)?.toUpperCase() || "A"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                {user?.name || (isSystemAdmin ? "Master Admin" : "Teacher Admin")}
              </p>
              <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={toggleTheme} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
              {theme === "dark" ? <Sun className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} /> : <Moon className="w-3.5 h-3.5" style={{ color: "#2563eb" }} />}
              <span>Theme</span>
            </button>
            <button type="button" onClick={handleLogout} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--error)" }}>
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="main-content flex flex-col lg:pl-64">
        <header className="h-16 sticky top-0 z-30 flex items-center justify-between px-6 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-xl border lg:hidden cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-semibold tracking-wide" style={{ color: "var(--text-primary)" }}>
                {isSystemAdmin ? "Platform Admin Console" : `Faculty Portal — ${user?.department || "Department"}`}
              </h2>
              {isTeacher && user?.department && (
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  {user.department}
                </span>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="page-container">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
