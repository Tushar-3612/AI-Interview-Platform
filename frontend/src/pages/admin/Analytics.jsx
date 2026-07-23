import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  Award,
  Users,
  Target,
  BookOpen,
  Star,
  AlertTriangle,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

function Analytics() {
  const token = getAuthToken();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const { data: result } = await api.get("/api/admin/analytics", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(result);
      } catch (error) {
        console.error("Error fetching analytics", error);
        toast.error("Failed to load analytics");
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [token]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Computing analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No analytics data available.</p>
      </div>
    );
  }

  const {
    departmentWise = [],
    yearWise = [],
    companyWise = [],
    mostPracticedCompany,
    highestScoringStudent,
    lowestScoringStudent,
    averageATS,
    averagePlacementReadiness,
    top10 = [],
    weakStudents = [],
    interviewTrends = [],
  } = data;

  const maxDeptVal = Math.max(...departmentWise.map((d) => d.averageScore), 1);
  const maxYearVal = Math.max(...yearWise.map((y) => y.averageScore), 1);
  const maxCompanyVal = Math.max(...companyWise.map((c) => c.averageScore), 1);
  const maxTrendVal = Math.max(...interviewTrends.map((t) => t.total), 1);

  const statCards = [
    { title: "Average ATS Score", value: `${averageATS}%`, icon: Star, color: "var(--primary)" },
    { title: "Placement Readiness", value: `${averagePlacementReadiness}%`, icon: Target, color: "var(--success)" },
    { title: "Most Practiced", value: mostPracticedCompany?.companyName || "N/A", icon: TrendingUp, color: "var(--accent)", sub: `${mostPracticedCompany?.attempts || 0} attempts` },
    { title: "Highest Scorer", value: highestScoringStudent?.name || "N/A", icon: Award, color: "#F59E0B", sub: `${highestScoringStudent?.averageScore || 0}% avg` },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Analytics
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Comprehensive placement analytics and performance insights.
        </p>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -2 }}
              className="student-card p-5"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    {card.title}
                  </p>
                  <p className="text-lg font-bold mt-1 truncate" style={{ color: "var(--text-primary)" }}>
                    {card.value}
                  </p>
                  {card.sub && (
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{card.sub}</p>
                  )}
                </div>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${card.color} 10%, transparent)` }}>
                  <Icon className="w-4.5 h-4.5" style={{ color: card.color }} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department-wise */}
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="student-card p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-6" style={{ color: "var(--text-muted)" }}>
            <BarChart3 className="w-4 h-4 inline mr-1.5" />
            Department-wise Performance
          </h3>
          <div className="space-y-4">
            {departmentWise.map((d) => (
              <div key={d.department} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span style={{ color: "var(--text-primary)" }}>{d.department}</span>
                  <span style={{ color: "var(--primary)" }}>{d.averageScore}%</span>
                </div>
                <div className="h-2.5 rounded-full w-full overflow-hidden bg-slate-100 dark:bg-zinc-800 border" style={{ borderColor: "var(--border)" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(d.averageScore / maxDeptVal) * 100}%` }}
                    transition={{ duration: 0.8 }}
                    className="h-full rounded-full"
                    style={{ background: "var(--primary)" }}
                  />
                </div>
              </div>
            ))}
            {departmentWise.length === 0 && (
              <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>No department data.</p>
            )}
          </div>
        </motion.div>

        {/* Year-wise */}
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="student-card p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-6" style={{ color: "var(--text-muted)" }}>
            <Users className="w-4 h-4 inline mr-1.5" />
            Year-wise Performance
          </h3>
          <div className="space-y-4">
            {yearWise.map((y) => (
              <div key={y.year} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span style={{ color: "var(--text-primary)" }}>{y.year}</span>
                  <span style={{ color: "var(--primary)" }}>{y.averageScore}%</span>
                </div>
                <div className="h-2.5 rounded-full w-full overflow-hidden bg-slate-100 dark:bg-zinc-800 border" style={{ borderColor: "var(--border)" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(y.averageScore / maxYearVal) * 100}%` }}
                    transition={{ duration: 0.8 }}
                    className="h-full rounded-full"
                    style={{ background: "var(--accent)" }}
                  />
                </div>
              </div>
            ))}
            {yearWise.length === 0 && (
              <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>No year data.</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Company-wise */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="student-card p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider mb-6" style={{ color: "var(--text-muted)" }}>
          <TrendingUp className="w-4 h-4 inline mr-1.5" />
          Company-wise Performance
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b text-[10px] font-semibold uppercase tracking-wider" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Avg Score</th>
                <th className="px-4 py-3">Highest</th>
                <th className="px-4 py-3">Success Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs" style={{ borderColor: "var(--border)" }}>
              {companyWise.slice(0, 10).map((c) => (
                <tr key={c.companyId} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/10">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[9px] font-bold" style={{ background: c.color || "#2563EB" }}>
                        {c.companyName[0]}
                      </div>
                      <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{c.companyName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">{c.attempts}</td>
                  <td className="px-4 py-3 font-bold" style={{ color: c.averageScore >= 70 ? "var(--success)" : "var(--primary)" }}>{c.averageScore}%</td>
                  <td className="px-4 py-3 font-bold" style={{ color: "var(--text-primary)" }}>{c.highestScore}%</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      c.successRate >= 70 ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600" :
                      c.successRate >= 40 ? "bg-blue-50 dark:bg-blue-950/20 text-blue-600" :
                      "bg-red-50 dark:bg-red-950/20 text-red-600"
                    }`}>
                      {c.successRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {companyWise.length === 0 && (
            <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>No company data.</p>
          )}
        </div>
      </motion.div>

      {/* Top 10 & Weak Students */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="student-card p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
            <Award className="w-4 h-4 inline mr-1.5" style={{ color: "#F59E0B" }} />
            Top 10 Students
          </h3>
          <div className="space-y-2">
            {top10.map((s, i) => (
              <div key={s._id} className="flex items-center justify-between py-2 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                    i === 0 ? "bg-yellow-500" : i === 1 ? "bg-gray-400" : i === 2 ? "bg-amber-700" : "bg-[var(--primary)]"
                  }`}>{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate max-w-[150px]" style={{ color: "var(--text-primary)" }}>{s.name}</p>
                    <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>{s.department} • {s.year}</p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--success) 10%, transparent)", color: "var(--success)" }}>
                  {s.averageScore}%
                </span>
              </div>
            ))}
            {top10.length === 0 && (
              <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>No data yet.</p>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="student-card p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
            <AlertTriangle className="w-4 h-4 inline mr-1.5" style={{ color: "var(--error)" }} />
            Students Needing Attention
          </h3>
          <div className="space-y-2">
            {weakStudents.map((s, i) => (
              <div key={s._id} className="flex items-center justify-between py-2 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-950/20 flex items-center justify-center text-[10px] font-bold" style={{ color: "var(--error)" }}>
                    {s.name?.[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate max-w-[150px]" style={{ color: "var(--text-primary)" }}>{s.name}</p>
                    <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>{s.department} • {s.year}</p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--error) 10%, transparent)", color: "var(--error)" }}>
                  {s.averageScore}%
                </span>
              </div>
            ))}
            {weakStudents.length === 0 && (
              <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>No data yet.</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Interview Trends */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="student-card p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider mb-6" style={{ color: "var(--text-muted)" }}>
          <BookOpen className="w-4 h-4 inline mr-1.5" />
          Interview Trends (Monthly)
        </h3>
        {interviewTrends.length > 0 ? (
          <div className="h-64 flex items-end justify-between gap-3 pt-4">
            {interviewTrends.map((t) => {
              const heightPct = (t.total / maxTrendVal) * 80;
              const practicePct = t.total > 0 ? (t.practiceCount / t.total) * heightPct : 0;
              return (
                <div key={t.month} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div className="w-full flex flex-col-reverse h-48 relative">
                    <div className="w-full rounded-t-sm" style={{ height: `${practicePct}%`, background: "var(--primary)" }} />
                    <div className="w-full rounded-t-sm" style={{ height: `${heightPct - practicePct}%`, background: "var(--accent)" }} />
                  </div>
                  <span className="text-[9px] font-medium text-center" style={{ color: "var(--text-muted)" }}>{t.month.split(" ")[0]}</span>
                  <span className="text-[8px] font-bold" style={{ color: "var(--text-secondary)" }}>{t.total}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>No trend data available.</p>
        )}
        <div className="flex justify-center gap-6 mt-4 text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: "var(--primary)" }} />
            <span style={{ color: "var(--text-secondary)" }}>Practice</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: "var(--accent)" }} />
            <span style={{ color: "var(--text-secondary)" }}>Real</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default Analytics;
