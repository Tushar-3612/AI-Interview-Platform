import { useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, CalendarDays, Activity, Target, Award } from "lucide-react";
import useCachedApi from "../../hooks/useCachedApi";
import { LineChart, GroupedBarChart } from "../../components/placement/Charts";
import { scoreColor } from "../../components/placement/ProgressRing";

function PerformanceGraphs() {
  const { data, loading, error } = useCachedApi({ url: "/api/placement/performance", key: "performance-graphs", ttlMs: 60 * 1000 });

  const stats = useMemo(() => {
    const weekly = data?.weekly || [];
    const monthly = data?.monthly || [];
    const mock = data?.mock || [];
    const all = [...weekly, ...monthly].filter((d) => d.activity > 0);
    if (all.length === 0) return null;
    const avgScore = Math.round(all.reduce((s, d) => s + d.score, 0) / all.length);
    const best = [...all].sort((a, b) => b.score - a.score)[0];
    const totalActivity = all.reduce((s, d) => s + d.activity, 0);
    return { avgScore, bestScore: best.score, bestLabel: best.label, totalActivity, mockCount: mock.length };
  }, [data]);

  const weeklyData = (data?.weekly || []).map((d) => ({ label: d.label, value: d.score }));
  const monthlyData = (data?.monthly || []).map((d) => ({ label: d.label, value: d.score }));
  const companyData = (data?.companyWise || []).map((d) => ({ label: d.company, aptitude: d.aptitude, coding: d.coding }));

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1400px] mx-auto w-full space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black" style={{ color: "var(--text-primary)" }}>Performance Analytics</h1>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Your score trend over the last 30 days, plus company-wise performance breakdown.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border p-5 text-sm text-center" style={{ borderColor: "var(--border)", color: "var(--error)" }}>
          Failed to load performance data — please try again.
        </div>
      )}

      {loading && !data && (
        <div className="space-y-4">
          <div className="skeleton h-64 w-full rounded-3xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="skeleton h-64 w-full rounded-3xl" />
            <div className="skeleton h-64 w-full rounded-3xl" />
          </div>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border p-4 flex items-center gap-3" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-lg font-black leading-none" style={{ color: "var(--text-primary)" }}>{stats.avgScore}%</p>
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>30-day avg score</p>
            </div>
          </div>
          <div className="rounded-2xl border p-4 flex items-center gap-3" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--success) 10%, transparent)", color: "var(--success)" }}>
              <Award className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-black leading-none" style={{ color: "var(--text-primary)" }}>{stats.bestScore}%</p>
              <p className="text-[10px] mt-1 truncate" style={{ color: "var(--text-muted)" }}>best day · {stats.bestLabel}</p>
            </div>
          </div>
          <div className="rounded-2xl border p-4 flex items-center gap-3" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}>
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-lg font-black leading-none" style={{ color: "var(--text-primary)" }}>{stats.totalActivity}</p>
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>activities (30d)</p>
            </div>
          </div>
          <div className="rounded-2xl border p-4 flex items-center gap-3" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, #f59e0b 10%, transparent)", color: "#f59e0b" }}>
              <Target className="w-5 h-5" />
            </div>
            <div>
              <p className="text-lg font-black leading-none" style={{ color: "var(--text-primary)" }}>{stats.mockCount}</p>
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>mock OAs (30d)</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border p-5"
          style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Last 7 days</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Average score per active day</p>
            </div>
            <CalendarDays className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          </div>
          <LineChart data={weeklyData} height={190} color="var(--primary)" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-3xl border p-5"
          style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Last 30 days</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Daily score trend</p>
            </div>
            <CalendarDays className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          </div>
          <LineChart data={monthlyData} height={190} color="var(--accent)" showDots={false} />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-3xl border p-5"
        style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}
      >
        <div className="mb-4">
          <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Company-wise performance</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Average aptitude & coding scores per company (last 30 days)</p>
        </div>
        {companyData.length > 0 ? (
          <>
            <GroupedBarChart
              data={companyData}
              series={[
                { key: "aptitude", label: "Aptitude", color: "var(--primary)" },
                { key: "coding", label: "Coding", color: "var(--accent)" },
              ]}
              height={200}
            />
            <div className="flex items-center gap-4 mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
              <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--primary)" }} /> Aptitude
              </span>
              <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--accent)" }} /> Coding
              </span>
            </div>
          </>
        ) : (
          <div className="text-center py-10 text-sm" style={{ color: "var(--text-muted)" }}>
            No company-wise data in the last 30 days — practice with a company to see your breakdown.
          </div>
        )}
      </motion.div>

      {data?.mock?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-3xl border p-5"
          style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}
        >
          <p className="text-sm font-bold mb-4" style={{ color: "var(--text-primary)" }}>Recent Mock OAs</p>
          <div className="space-y-2">
            {data.mock.slice(0, 6).map((m, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-2 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                <span className="font-bold" style={{ color: "var(--text-primary)" }}>{m.company}</span>
                <span style={{ color: "var(--text-muted)" }}>{new Date(m.date).toLocaleDateString()}</span>
                <span className="font-black" style={{ color: scoreColor(m.score) }}>{m.score}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default PerformanceGraphs;
