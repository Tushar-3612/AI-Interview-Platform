import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Users, UserCheck, Crown, Building2, Play, Briefcase,
  ClipboardCheck, CheckCircle, Percent, FileText, ArrowUpRight,
  ShieldCheck, ArrowRight, Sparkles, RefreshCw, BarChart3,
  BookOpen, PlusCircle
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

export default function SystemAdminDashboard() {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [teachersCount, setTeachersCount] = useState(0);
  const [premiumCount, setPremiumCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${getAuthToken()}` };
      const [statsRes, analyticsRes, teachersRes, premiumRes] = await Promise.all([
        api.get("/api/admin/stats", { headers }),
        api.get("/api/admin/analytics", { headers }).catch(() => ({ data: {} })),
        api.get("/api/admin/teachers", { headers }).catch(() => ({ data: { total: 0 } })),
        api.get("/api/admin/premium/stats", { headers }).catch(() => ({ data: { totalPremium: 0 } })),
      ]);

      setStats(statsRes.data);
      setAnalytics(analyticsRes.data);
      setTeachersCount(teachersRes.data?.total || 0);
      setPremiumCount(premiumRes.data?.totalPremium || 0);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load System Admin dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-3 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-medium text-[var(--text-secondary)]">Loading platform overview...</p>
      </div>
    );
  }

  const metrics = stats?.metrics || {};
  const departmentWise = analytics?.departmentWise || [];

  const platformCards = [
    { label: "Total Students", value: metrics.totalStudents || 0, icon: Users, color: "#3B82F6", link: "/admin/students" },
    { label: "Faculty Teachers", value: teachersCount, icon: UserCheck, color: "#8B5CF6", link: "/admin/teachers" },
    { label: "Premium Members", value: premiumCount, icon: Crown, color: "#F59E0B", link: "/admin/premium" },
    { label: "Active Departments", value: 7, icon: Building2, color: "#10B981", link: "/admin/analytics" },
    { label: "Practice Interviews", value: metrics.totalPracticeInterviews || 0, icon: Play, color: "#06B6D4" },
    { label: "Real Interviews", value: metrics.totalRealInterviews || 0, icon: Briefcase, color: "#EC4899" },
    { label: "Active Tests", value: metrics.totalActiveTests || 0, icon: ClipboardCheck, color: "#6366F1", link: "/admin/tests/assigned" },
    { label: "Completed Tests", value: metrics.totalCompletedTests || 0, icon: CheckCircle, color: "#14B8A6" },
    { label: "Avg Platform Score", value: `${metrics.avgScore || 0}%`, icon: Percent, color: "#F97316", link: "/admin/analytics" },
    { label: "Uploaded Resumes", value: metrics.totalResumes || 0, icon: FileText, color: "#64748B" },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* ── System Admin Hero Banner ── */}
      <div className="relative overflow-hidden rounded-2xl border p-6 sm:p-8 bg-gradient-to-br from-[var(--card-bg)] to-[var(--bg-secondary)]" style={{ borderColor: "var(--border)" }}>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                System Administration
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[var(--success)] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" /> Live Platform Scope
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              Platform Master Console
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-2xl">
              Cross-department visibility, faculty teacher delegation, premium membership access, and global assessment governance.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={fetchDashboardData}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border bg-[var(--card-bg)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-all cursor-pointer"
              style={{ borderColor: "var(--border)" }}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <Link
              to="/admin/teachers"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--primary)] text-white hover:opacity-90 transition-all shadow-md cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" /> Manage Teachers
            </Link>
          </div>
        </div>
      </div>

      {/* ── Platform KPI Cards Grid ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">Platform Overview</h2>
          <span className="text-xs text-[var(--text-muted)]">{platformCards.length} Master Metrics</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {platformCards.map((card, i) => {
            const Icon = card.icon;
            const CardWrapper = card.link ? Link : "div";
            return (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <CardWrapper
                  to={card.link}
                  className={`block h-full p-4 rounded-xl border bg-[var(--card-bg)] transition-all hover:shadow-md ${card.link ? "hover:border-[var(--primary)] group cursor-pointer" : ""}`}
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
                      style={{ background: `${card.color}15`, color: card.color }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    {card.link && (
                      <ArrowUpRight className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                  <div className="text-xl font-extrabold tracking-tight text-[var(--text-primary)]">
                    {typeof card.value === "number" ? card.value.toLocaleString() : card.value}
                  </div>
                  <div className="text-xs font-medium text-[var(--text-secondary)] mt-0.5 truncate">
                    {card.label}
                  </div>
                </CardWrapper>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Quick Governance & Actions ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/admin/teachers"
          className="group p-5 rounded-2xl border bg-gradient-to-br from-purple-500/5 to-transparent hover:border-purple-500/40 transition-all"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-purple-600 transition-colors">
                Teacher Management
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">Create & assign department teachers</p>
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-3">
            Delegate isolated department administration to individual faculty members. Assign Computer, IT, ENTC, and other departments.
          </p>
          <div className="flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400">
            Open Teacher Portal <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          to="/admin/premium"
          className="group p-5 rounded-2xl border bg-gradient-to-br from-amber-500/5 to-transparent hover:border-amber-500/40 transition-all"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-amber-600 transition-colors">
                Premium Membership
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">Grant or revoke Pro student benefits</p>
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-3">
            Manage premium tier candidates, search students platform-wide, and grant unlimited mock AI interviews & resume analysis.
          </p>
          <div className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
            Manage Subscriptions <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          to="/admin/analytics"
          className="group p-5 rounded-2xl border bg-gradient-to-br from-blue-500/5 to-transparent hover:border-blue-500/40 transition-all"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-blue-600 transition-colors">
                Department Comparison
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">Cross-department placement intelligence</p>
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-3">
            Inspect performance benchmarks, aggregate assessment completion, and department-wise average interview scores.
          </p>
          <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
            View Analytics <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>

      {/* ── Department Breakdown Table ── */}
      <div className="rounded-2xl border overflow-hidden bg-[var(--card-bg)]" style={{ borderColor: "var(--border)" }}>
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-[var(--primary)]" />
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Department-Wise Breakdown</h2>
              <p className="text-xs text-[var(--text-secondary)]">Platform overview across academic branches</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
            {departmentWise.length} Departments Tracked
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b bg-[var(--bg-secondary)]" style={{ borderColor: "var(--border)" }}>
                <th className="px-5 py-3.5 font-semibold text-[var(--text-secondary)]">Department</th>
                <th className="px-5 py-3.5 font-semibold text-[var(--text-secondary)] text-center">Students</th>
                <th className="px-5 py-3.5 font-semibold text-[var(--text-secondary)] text-center">Interviews Conducted</th>
                <th className="px-5 py-3.5 font-semibold text-[var(--text-secondary)] text-center">Avg Score</th>
                <th className="px-5 py-3.5 font-semibold text-[var(--text-secondary)] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
              {departmentWise.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-[var(--text-muted)]">
                    No department data accumulated yet.
                  </td>
                </tr>
              ) : (
                departmentWise.map((dept) => (
                  <tr key={dept._id || dept.department} className="hover:bg-[var(--bg-secondary)]/50 transition-colors">
                    <td className="px-5 py-4 font-semibold text-[var(--text-primary)]">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                        {dept._id || dept.department}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center font-medium text-[var(--text-primary)]">
                      {dept.studentCount || dept.count || 0}
                    </td>
                    <td className="px-5 py-4 text-center font-medium text-[var(--text-primary)]">
                      {dept.interviewCount || 0}
                    </td>
                    <td className="px-5 py-4 text-center font-semibold text-[var(--primary)]">
                      {Math.round(dept.averageScore || dept.avgScore || 0)}%
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        to={`/admin/students?department=${encodeURIComponent(dept._id || dept.department)}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
                      >
                        View Students <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
