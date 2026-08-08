import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Target,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Users,
  Building2,
  ShieldQuestion,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import useCachedApi from "../../hooks/useCachedApi";
import { BarChart } from "../../components/placement/Charts";
import { scoreColor } from "../../components/placement/ProgressRing";

const DIFF_COLORS = {
  easy: "var(--success)",
  medium: "#f59e0b",
  hard: "var(--error)",
};

function HighlightCard({ title, item, icon, color }) {
  if (!item) return null;
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}>
          {icon}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{title}</p>
      </div>
      <p className="text-sm font-bold leading-snug" style={{ color: "var(--text-primary)" }}>{item.title}</p>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize" style={{ color: DIFF_COLORS[String(item.difficulty).toLowerCase()] || "var(--text-secondary)", background: "var(--border)" }}>
          {item.difficulty}
        </span>
        {item.companyName && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: "var(--text-secondary)", background: "var(--border)" }}>
            {item.companyName}
          </span>
        )}
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: "var(--primary)", background: "color-mix(in srgb, var(--primary) 8%, transparent)" }}>
          {item.type}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="rounded-lg p-2 text-center" style={{ background: "var(--bg-primary)" }}>
          <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>{item.attempted}</p>
          <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>attempts</p>
        </div>
        <div className="rounded-lg p-2 text-center" style={{ background: "var(--bg-primary)" }}>
          <p className="text-sm font-black" style={{ color: scoreColor(item.correctPct) }}>{item.correctPct}%</p>
          <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>correct</p>
        </div>
        <div className="rounded-lg p-2 text-center" style={{ background: "var(--bg-primary)" }}>
          <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>{item.studentsAttempted}</p>
          <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>students</p>
        </div>
      </div>
    </div>
  );
}

function PlacementAnalytics() {
  const { data, loading, error, refetch } = useCachedApi({ url: "/api/placement/admin/analytics", key: "admin-placement-analytics", ttlMs: 5 * 60 * 1000 });
  const [showOnlyProblematic, setShowOnlyProblematic] = useState(false);

  const summary = data?.summary || {};
  const questions = data?.questions || [];

  const companyChartData = useMemo(
    () => (summary.companyWiseSuccess || []).map((c) => ({ label: c.company, value: c.avgPercentage })),
    [summary]
  );

  const filteredQuestions = showOnlyProblematic
    ? questions.filter((q) => q.health < 50)
    : questions;

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Computing question quality insights...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="text-center py-20 space-y-3">
        <AlertTriangle className="w-10 h-10 mx-auto" style={{ color: "var(--error)" }} />
        <p className="text-sm font-semibold" style={{ color: "var(--error)" }}>Failed to load placement analytics.</p>
        <button onClick={() => refetch()} className="text-xs font-bold cursor-pointer hover:underline" style={{ color: "var(--primary)" }}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Placement Question Analytics</h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Question quality, difficulty health and platform engagement across all students.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border p-4 flex items-center gap-3" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>
            <ShieldQuestion className="w-5 h-5" />
          </div>
          <div>
            <p className="text-lg font-black leading-none" style={{ color: "var(--text-primary)" }}>{summary.totalQuestionsTracked ?? 0}</p>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>questions tracked</p>
          </div>
        </div>
        <div className="rounded-2xl border p-4 flex items-center gap-3" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}>
            <Target className="w-5 h-5" />
          </div>
          <div>
            <p className="text-lg font-black leading-none" style={{ color: "var(--text-primary)" }}>{summary.totalAttempts ?? 0}</p>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>total attempts</p>
          </div>
        </div>
        <div className="rounded-2xl border p-4 flex items-center gap-3" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--success) 10%, transparent)", color: "var(--success)" }}>
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-lg font-black leading-none" style={{ color: "var(--text-primary)" }}>{summary.averageCompletion ?? 0}%</p>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>avg completion</p>
          </div>
        </div>
        <div className="rounded-2xl border p-4 flex items-center gap-3" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, #f59e0b 10%, transparent)", color: "#f59e0b" }}>
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black truncate" style={{ color: "var(--text-primary)" }}>
              {summary.mostActiveDepartment?.department || "—"}
            </p>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
              most active dept · {summary.mostActiveDepartment?.attempts || 0} attempts
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HighlightCard title="Most solved" item={summary.mostSolved} icon={<Trophy className="w-4 h-4" />} color="var(--success)" />
        <HighlightCard title="Hardest question" item={summary.hardest} icon={<TrendingDown className="w-4 h-4" />} color="var(--error)" />
        <HighlightCard title="Highest accuracy" item={summary.highestAccuracy} icon={<TrendingUp className="w-4 h-4" />} color="var(--primary)" />
        <HighlightCard title="Least solved" item={summary.leastSolved} icon={<AlertTriangle className="w-4 h-4" />} color="#f59e0b" />
        <HighlightCard title="Lowest accuracy" item={summary.lowestAccuracy} icon={<TrendingDown className="w-4 h-4" />} color="var(--accent)" />
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>
              <Users className="w-4 h-4" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Most active students (30d)</p>
          </div>
          <div className="space-y-2">
            {(summary.mostActiveStudents || []).slice(0, 5).map((s) => (
              <div key={s.rank} className="flex items-center justify-between text-xs">
                <span className="font-bold truncate" style={{ color: "var(--text-primary)" }}>
                  <span className="mr-1.5" style={{ color: s.rank <= 3 ? "#f59e0b" : "var(--text-muted)" }}>#{s.rank}</span>
                  {s.name}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ color: "var(--primary)", background: "color-mix(in srgb, var(--primary) 8%, transparent)" }}>
                  {s.attempts} attempts
                </span>
              </div>
            ))}
            {(summary.mostActiveStudents || []).length === 0 && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>No activity in the last 30 days.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border p-5"
          style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}
        >
          <p className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>Company-wise average aptitude score</p>
          <p className="text-[10px] mb-4" style={{ color: "var(--text-muted)" }}>Average percentage across all practice attempts per company</p>
          {companyChartData.length > 0 ? (
            <BarChart data={companyChartData} height={200} colorValue={(d) => scoreColor(d.value)} />
          ) : (
            <div className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>No company practice data yet.</div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-3xl border p-5"
          style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}
        >
          <p className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>Company success overview</p>
          <p className="text-[10px] mb-4" style={{ color: "var(--text-muted)" }}>Attempts and coding acceptance per company</p>
          <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
            {(summary.companyWiseSuccess || []).slice(0, 12).map((c) => (
              <div key={c.company} className="flex items-center justify-between text-xs">
                <span className="font-bold truncate" style={{ color: "var(--text-primary)" }}>{c.company}</span>
                <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>
                  {c.attempts} attempts · {c.codingAccepted}/{c.codingSubmissions} cod accepted
                </span>
              </div>
            ))}
            {(summary.companyWiseSuccess || []).length === 0 && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>No company practice data yet.</p>
            )}
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-3xl border overflow-hidden"
        style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}
      >
        <div className="flex items-center justify-between gap-3 p-5 border-b flex-wrap" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Question Health Report</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {filteredQuestions.length} questions
            </span>
            <button
              onClick={() => setShowOnlyProblematic((v) => !v)}
              className="text-[11px] font-bold px-3 py-1.5 rounded-xl border cursor-pointer"
              style={{
                borderColor: showOnlyProblematic ? "var(--error)" : "var(--border)",
                color: showOnlyProblematic ? "var(--error)" : "var(--text-secondary)",
                background: showOnlyProblematic ? "color-mix(in srgb, var(--error) 8%, transparent)" : "transparent",
              }}
            >
              {showOnlyProblematic ? "Showing problem questions" : "Show problem questions (health < 50)"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                {["Question", "Type", "Difficulty", "Attempts", "Correct %", "Avg time", "Health"].map((h) => (
                  <th key={h} className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredQuestions.slice(0, 50).map((q) => (
                <tr key={q.questionId} className="border-b last:border-0 hover:opacity-80" style={{ borderColor: "var(--border)" }}>
                  <td className="px-5 py-3">
                    <p className="text-xs font-bold max-w-[260px] truncate" style={{ color: "var(--text-primary)" }}>{q.title}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {[q.category, q.companyName].filter(Boolean).join(" · ")}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize" style={{ color: "var(--primary)", background: "color-mix(in srgb, var(--primary) 8%, transparent)" }}>
                      {q.type}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize" style={{ color: DIFF_COLORS[String(q.difficulty).toLowerCase()] || "var(--text-secondary)", background: "var(--border)" }}>
                      {q.difficulty}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs font-bold" style={{ color: "var(--text-primary)" }}>{q.attempted}</td>
                  <td className="px-5 py-3 text-xs font-bold" style={{ color: scoreColor(q.correctPct) }}>{q.correctPct}%</td>
                  <td className="px-5 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{q.averageTimeSec}s</td>
                  <td className="px-5 py-3">
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full" style={{
                      color: q.health >= 70 ? "var(--success)" : q.health >= 50 ? "#f59e0b" : "var(--error)",
                      background: "color-mix(in srgb, " + (q.health >= 70 ? "var(--success)" : q.health >= 50 ? "#f59e0b" : "var(--error)") + " 10%, transparent)",
                    }}>
                      {q.health}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredQuestions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    No questions tracked yet — ask students to practice.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

export default PlacementAnalytics;
