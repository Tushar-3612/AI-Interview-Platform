import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Play,
  FileText,
  Percent,
  Award,
  TrendingUp,
  Briefcase,
  UserCheck,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = getAuthToken();
        const { data: stats } = await api.get("/api/admin/stats", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(stats);
      } catch (error) {
        console.error("Error fetching dashboard statistics", error);
        toast.error("Failed to load dashboard metrics");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Analyzing placement analytics...
        </p>
      </div>
    );
  }

  const { metrics = {}, recentActivities = [], charts = {} } = data || {};

  const cards = [
    {
      title: "Total Students",
      value: metrics.totalStudents || 0,
      icon: Users,
      color: "var(--primary)",
    },
    {
      title: "Practice Runs",
      value: metrics.totalPracticeInterviews || 0,
      icon: Play,
      color: "var(--accent)",
    },
    {
      title: "Real AI Attempts",
      value: metrics.totalRealInterviews || 0,
      icon: Briefcase,
      color: "var(--success)",
    },
    {
      title: "Resumes Indexed",
      value: metrics.totalResumes || 0,
      icon: FileText,
      color: "#FF9900",
    },
    {
      title: "Average Score",
      value: `${metrics.avgScore || 0}%`,
      icon: Percent,
      color: "#86BC25",
    },
    {
      title: "Top Performer",
      value: `${metrics.topPerformer?.score || 0}%`,
      desc: metrics.topPerformer?.name || "N/A",
      icon: Award,
      color: "#A100FF",
    },
  ];

  // Render SVG Sparkline / Bar Graph
  const activityChart = charts.activityChart || [];
  const maxAttempts = Math.max(...activityChart.map((d) => d.attempts), 1);

  const deptData = charts.deptBreakdown || [];
  const maxDeptVal = Math.max(...deptData.map((d) => d.value), 1);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Title */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Dashboard Overview
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Placement performance, resume parsing coverage, and mock attempt history.
        </p>
      </motion.div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -2 }}
              className="student-card p-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    {card.title}
                  </p>
                  <p className="text-2xl font-bold mt-2" style={{ color: "var(--text-primary)" }}>
                    {card.value}
                  </p>
                  {card.desc && (
                    <p className="text-xs mt-1 font-medium truncate max-w-[150px]" style={{ color: "var(--text-secondary)" }}>
                      {card.desc}
                    </p>
                  )}
                </div>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `color-mix(in srgb, ${card.color} 10%, transparent)` }}
                >
                  <Icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Charts & Graphs Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SVG Activity Graph */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="student-card p-6"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-6" style={{ color: "var(--text-muted)" }}>
            Interview Attempts Last 7 Days
          </h3>
          <div className="h-60 flex items-end justify-between gap-2.5 pt-4">
            {activityChart.map((day) => {
              const heightPct = (day.attempts / maxAttempts) * 80; // Scale to max 80% height
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  <div className="relative w-full flex justify-center">
                    <span className="absolute -top-6 text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity bg-black dark:bg-white text-white dark:text-black px-1.5 py-0.5 rounded shadow">
                      {day.attempts}
                    </span>
                  </div>
                  <div
                    className="w-full rounded-t-lg transition-all duration-500 ease-out bg-[var(--primary)] group-hover:brightness-110"
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[10px] font-medium mt-1 text-center truncate w-full" style={{ color: "var(--text-secondary)" }}>
                    {day.date}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* SVG Department Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="student-card p-6"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-6" style={{ color: "var(--text-muted)" }}>
            Students per Department
          </h3>
          {deptData.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-xs" style={{ color: "var(--text-secondary)" }}>
              No department data available.
            </div>
          ) : (
            <div className="h-60 flex flex-col justify-center gap-4">
              {deptData.map((dept) => {
                const widthPct = (dept.value / maxDeptVal) * 100;
                return (
                  <div key={dept.name} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span style={{ color: "var(--text-primary)" }}>{dept.name}</span>
                      <span style={{ color: "var(--primary)" }}>{dept.value}</span>
                    </div>
                    <div className="h-2.5 rounded-full w-full overflow-hidden bg-slate-100 dark:bg-zinc-800 border" style={{ borderColor: "var(--border)" }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPct}%` }}
                        transition={{ duration: 0.8 }}
                        className="h-full rounded-full"
                        style={{
                          background: "linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Recent Activity Feed */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="student-card p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider mb-5" style={{ color: "var(--text-muted)" }}>
          Recent Activity Feed
        </h3>
        <div className="space-y-4">
          {recentActivities.length === 0 ? (
            <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>
              No recent registration or interview logs found.
            </p>
          ) : (
            recentActivities.map((act) => {
              const isSignup = act.type === "signup";
              return (
                <div key={act.id} className="flex items-center justify-between border-b pb-3.5 last:border-b-0 last:pb-0" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                      style={{ background: isSignup ? "var(--primary)" : "var(--success)" }}
                    >
                      {isSignup ? <UserCheck className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {act.message}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {new Date(act.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {!isSignup && act.score !== undefined && (
                    <div className="text-right">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--success) 10%, transparent)", color: "var(--success)" }}>
                        {act.score}%
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default AdminDashboard;
