import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users, Play, Briefcase, FileText, Percent, ClipboardCheck, CheckCircle,
  UserPlus, TrendingUp, Building2, Award, Trophy, GraduationCap, BookOpen,
  Star, Target,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

const ACCENT = "var(--admin-accent)";
const NAVY = "var(--admin-navy)";

function AdminDashboard() {
  const [data, setData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const headers = { Authorization: `Bearer ${getAuthToken()}` };
        const [statsRes, analyticsRes] = await Promise.all([
          api.get("/api/admin/stats", { headers }),
          api.get("/api/admin/analytics", { headers }).catch(() => null),
        ]);
        setData(statsRes.data);
        if (analyticsRes) setAnalytics(analyticsRes.data);
      } catch {
        toast.error("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { metrics = {}, recentActivities = [], charts = {}, companyOverview = [], assignedTestsWidget = [] } = data || {};
  const { departmentWise = [], top10 = [] } = analytics || {};

  const statCards = [
    { label: "Total Students", value: metrics.totalStudents || 0, icon: Users },
    { label: "Practice Interviews", value: metrics.totalPracticeInterviews || 0, icon: Play },
    { label: "Real Interviews", value: metrics.totalRealInterviews || 0, icon: Briefcase },
    { label: "Uploaded Resumes", value: metrics.totalResumes || 0, icon: FileText },
    { label: "Active Tests", value: metrics.totalActiveTests || 0, icon: ClipboardCheck },
    { label: "Completed Tests", value: metrics.totalCompletedTests || 0, icon: CheckCircle },
    { label: "Avg Platform Score", value: `${metrics.avgScore || 0}%`, icon: Percent },
  ];

  const deptData = charts.deptBreakdown || [];
  const maxDept = Math.max(...deptData.map((d) => d.value), 1);
  const maxCompany = Math.max(...companyOverview.map((c) => c.attempts), 1);
  const practiceTotal = metrics.totalPracticeInterviews || 0;
  const realTotal = metrics.totalRealInterviews || 0;
  const interviewTotal = practiceTotal + realTotal || 1;

  const topDept = departmentWise.length > 0
    ? departmentWise.reduce((best, d) => (d.averageScore > best.averageScore ? d : best), departmentWise[0])
    : null;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Dashboard</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Platform overview and key metrics</p>
        </div>
        <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border" style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--success)" }} />
          Live
        </div>
      </div>

      {/* ── Row 1: Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="border rounded-xl p-4"
              style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--admin-navy-bg)" }}>
                  <Icon className="w-4 h-4" style={{ color: NAVY }} />
                </div>
              </div>
              <p className="text-lg font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>{card.value}</p>
              <p className="text-[11px] font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>{card.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* ── Row 2: Top Performing Department + Top Performing Students ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="border rounded-xl p-5" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Award className="w-4 h-4" style={{ color: ACCENT }} /> Top Performing Department
          </h3>
          {topDept ? (
            <div className="flex items-center gap-4 p-4 rounded-xl border" style={{ background: "var(--admin-accent-bg)", borderColor: "var(--border)" }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--admin-accent-bg)" }}>
                <GraduationCap className="w-6 h-6" style={{ color: ACCENT }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{topDept.department}</p>
                <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <span className="flex items-center gap-1"><Star className="w-3 h-3" style={{ color: ACCENT }} /> Avg Score: {topDept.averageScore}%</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {topDept.studentCount} students</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>No department data available</p>
          )}
        </div>

        <div className="border rounded-xl p-5" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Trophy className="w-4 h-4" style={{ color: ACCENT }} /> Top Performing Students
          </h3>
          {top10.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>No student data yet</p>
          ) : (
            <div className="space-y-2">
              {top10.slice(0, 5).map((s, idx) => (
                <div key={s._id} className="flex items-center gap-3 p-2 rounded-lg admin-row-hover">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ background: idx === 0 ? "var(--admin-accent-bg)" : "var(--admin-divider)", color: idx === 0 ? ACCENT : "var(--text-muted)" }}>
                    {idx + 1}
                  </div>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0" style={{ background: "var(--admin-surface-hover)", color: "var(--text-secondary)" }}>
                    {s.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{s.name}</p>
                    <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{s.department} &middot; {s.year}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold" style={{ color: ACCENT }}>{s.averageScore}%</p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{s.interviewCount} intvs</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Department Overview + Company Overview ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="border rounded-xl p-5" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Building2 className="w-4 h-4" style={{ color: NAVY }} /> Department Overview
          </h3>
          {deptData.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>No data</p>
          ) : (
            <div className="space-y-3.5">
              {deptData.map((d) => (
                <div key={d.name}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{ color: "var(--text-secondary)" }}>{d.name}</span>
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>{d.value} students</span>
                  </div>
                  <div className="h-2 admin-bg-surface rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(d.value / maxDept) * 100}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${NAVY}, ${ACCENT})` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border rounded-xl p-5" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Target className="w-4 h-4" style={{ color: NAVY }} /> Company Overview
          </h3>
          {companyOverview.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>No data</p>
          ) : (
            <div className="space-y-3.5">
              {companyOverview.map((c) => (
                <div key={c.name}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{ color: "var(--text-secondary)" }}>{c.name}</span>
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>{c.attempts} attempts</span>
                  </div>
                  <div className="h-2 admin-bg-surface rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(c.attempts / maxCompany) * 100}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ background: c.color || NAVY }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 4: Practice vs Real + Recent Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="border rounded-xl p-5" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <BookOpen className="w-4 h-4" style={{ color: NAVY }} /> Practice vs Real
          </h3>
          <div className="flex items-center justify-center py-4">
            <div className="relative w-36 h-36">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke="var(--border)" strokeWidth="10" fill="none" />
                <circle cx="50" cy="50" r="40" stroke={NAVY} strokeWidth="10" fill="none"
                  strokeDasharray={`${(practiceTotal / interviewTotal) * 251} 251`}
                  strokeLinecap="round" className="transition-all duration-1000" />
                <circle cx="50" cy="50" r="40" stroke={ACCENT} strokeWidth="10" fill="none"
                  strokeDasharray={`${(realTotal / interviewTotal) * 251} 251`}
                  strokeDashoffset={-(practiceTotal / interviewTotal) * 251}
                  strokeLinecap="round" className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{interviewTotal}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: NAVY }} />
              <span style={{ color: "var(--text-secondary)" }}>Practice ({practiceTotal})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: ACCENT }} />
              <span style={{ color: "var(--text-secondary)" }}>Real ({realTotal})</span>
            </div>
          </div>
        </div>

        <div className="border rounded-xl p-5 lg:col-span-2" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <TrendingUp className="w-4 h-4" style={{ color: NAVY }} /> Recent Activity
          </h3>
          <div className="space-y-0">
            {recentActivities.length === 0 ? (
              <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>No recent activity</p>
            ) : (
              recentActivities.slice(0, 6).map((act) => (
                <div key={act.id} className="flex items-center gap-3 py-2.5 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: act.type === "signup" ? "var(--admin-navy-bg)" : act.type === "assignment" ? "var(--admin-accent-bg)" : "var(--admin-success-bg)",
                    }}
                  >
                    {act.type === "signup" ? (
                      <UserPlus className="w-3.5 h-3.5" style={{ color: NAVY }} />
                    ) : act.type === "assignment" ? (
                      <ClipboardCheck className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                    ) : (
                      <TrendingUp className="w-3.5 h-3.5" style={{ color: "var(--success)" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{act.message}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {new Date(act.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  {act.score !== undefined && (
                    <span className="text-xs font-semibold" style={{ color: NAVY }}>{act.score}%</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Row 5: Recent Assigned Tests ── */}
      <div className="border rounded-xl p-5" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <ClipboardCheck className="w-4 h-4" style={{ color: ACCENT }} /> Recent Assigned Tests
        </h3>
        {assignedTestsWidget.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: "var(--text-muted)" }}>No tests assigned yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b admin-table-divider" style={{ color: "var(--text-muted)" }}>
                  <th className="pb-2.5 font-semibold">Test Name</th>
                  <th className="pb-2.5 font-semibold">Type</th>
                  <th className="pb-2.5 font-semibold">Assigned To</th>
                  <th className="pb-2.5 font-semibold">Students</th>
                  <th className="pb-2.5 font-semibold">Completed</th>
                  <th className="pb-2.5 font-semibold">Avg Score</th>
                </tr>
              </thead>
              <tbody>
                {assignedTestsWidget.map((t) => (
                  <tr key={t._id} className="border-b admin-table-divider">
                    <td className="py-2.5 font-medium" style={{ color: "var(--text-primary)" }}>{t.testName}</td>
                    <td className="py-2.5 capitalize" style={{ color: "var(--text-secondary)" }}>{t.testType}</td>
                    <td className="py-2.5" style={{ color: "var(--text-secondary)" }}>
                      {t.assignType === "all" ? "All Students" : `${t.assignType}: ${t.assignValue || ""}`}
                    </td>
                    <td className="py-2.5 font-medium" style={{ color: "var(--text-primary)" }}>{t.studentCount}</td>
                    <td className="py-2.5" style={{ color: "var(--text-secondary)" }}>{t.completedCount}</td>
                    <td className="py-2.5 font-medium" style={{ color: t.averageScore >= 50 ? NAVY : "var(--error)" }}>{t.averageScore}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
