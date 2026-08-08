import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Medal,
  Crown,
  Code2,
  BrainCircuit,
  TrendingUp,
  Users,
  Filter,
  RefreshCw,
} from "lucide-react";
import useCachedApi from "../../hooks/useCachedApi";

const TYPE_TABS = [
  { key: "placement", label: "Top Placement Score", icon: Trophy },
  { key: "overall", label: "Overall", icon: TrendingUp },
  { key: "coding", label: "Top Coders", icon: Code2 },
  { key: "aptitude", label: "Top Aptitude", icon: BrainCircuit },
];

const PERIODS = [
  { key: "overall", label: "Overall" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

const RANK_COLORS = ["#f59e0b", "#94a3b8", "#b45309"];
const RANK_ICONS = [Crown, Medal, Medal];

function RankBadge({ rank }) {
  const Icon = RANK_ICONS[rank - 1];
  if (Icon) {
    return (
      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${RANK_COLORS[rank - 1]} 15%, transparent)` }}>
        <Icon className="w-4 h-4" style={{ color: RANK_COLORS[rank - 1] }} />
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-black" style={{ color: "var(--text-secondary)", background: "var(--border)" }}>
      {rank}
    </div>
  );
}

function Leaderboard() {
  const [type, setType] = useState("placement");
  const [period, setPeriod] = useState("overall");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");

  const filtersRes = useCachedApi({ url: "/api/placement/filters", key: "lb:filters", ttlMs: 10 * 60 * 1000 });
  const { data, loading, refetch } = useCachedApi({
    url: "/api/placement/leaderboard",
    params: { type, period, department, year, limit: 50 },
    key: `lb:${type}:${period}:${department}:${year}`,
    ttlMs: 60 * 1000,
  });

  const rows = data?.leaderboard || [];
  const departments = filtersRes.data?.departments || [];
  const years = filtersRes.data?.years || [];

  useEffect(() => {
    if (!loading && rows.length === 0 && (department || year)) {
      // no rows for filter — allow empty state below
    }
  }, [loading, rows, department, year]);

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black" style={{ color: "var(--text-primary)" }}>Leaderboard</h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Compete with peers across departments and years</p>
        </div>
        <button onClick={() => refetch()} className="px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer hover:opacity-80 transition flex items-center gap-2" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Type tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {TYPE_TABS.map((t) => {
          const Icon = t.icon;
          const active = type === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              className="flex items-center gap-2.5 px-4 py-3 rounded-2xl border text-left cursor-pointer transition-all"
              style={{
                borderColor: active ? "var(--primary)" : "var(--border)",
                background: active ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "var(--card-bg)",
                color: active ? "var(--primary)" : "var(--text-secondary)",
              }}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-xs font-bold">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          <Filter className="w-3.5 h-3.5" /> Filters
        </div>
        <div className="flex rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className="px-3.5 py-2 text-xs font-bold cursor-pointer transition-colors"
              style={{
                color: period === p.key ? "var(--primary)" : "var(--text-secondary)",
                background: period === p.key ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "transparent",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer"
          style={{ borderColor: "var(--border)", background: "var(--card-bg)", color: "var(--text-primary)" }}
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer"
          style={{ borderColor: "var(--border)", background: "var(--card-bg)", color: "var(--text-primary)" }}
        >
          <option value="">All Years</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl overflow-hidden shadow-[var(--shadow-sm)]">
        <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 border-b text-[10px] font-bold uppercase tracking-wider" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          <span className="col-span-1">Rank</span>
          <span className="col-span-3">Student</span>
          <span className="col-span-2">Department</span>
          <span className="col-span-1">Year</span>
          <span className="col-span-2 text-right">Aptitude</span>
          <span className="col-span-2 text-right">Coding</span>
          <span className="col-span-1 text-right">Score</span>
        </div>

        {loading && rows.length === 0 && (
          <div className="p-6 space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-14 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No ranked students found</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {department || year ? "Try clearing the department/year filters." : "Students appear here after their first practice attempt."}
            </p>
          </div>
        )}

        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {rows.map((r, i) => (
            <motion.div
              key={r.userId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.5) }}
              className="grid grid-cols-2 md:grid-cols-12 gap-3 px-5 py-3.5 items-center hover:bg-[var(--bg-secondary)]/60 transition-colors"
            >
              <div className="col-span-1"><RankBadge rank={r.rank} /></div>
              <div className="col-span-2 md:col-span-3 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>{r.name}</p>
                <p className="text-[10px] md:hidden" style={{ color: "var(--text-muted)" }}>{r.department} · {r.year}</p>
              </div>
              <div className="hidden md:block col-span-2 truncate">
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{r.department || "—"}</span>
              </div>
              <div className="hidden md:block col-span-1">
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{r.year || "—"}</span>
              </div>
              <div className="col-span-1 md:col-span-2 text-right">
                <span className="text-xs font-bold" style={{ color: "var(--primary)" }}>{r.aptitude}%</span>
              </div>
              <div className="col-span-1 md:col-span-2 text-right">
                <span className="text-xs font-bold" style={{ color: "var(--accent)" }}>{r.coding}%</span>
              </div>
              <div className="col-span-1 md:col-span-1 text-right">
                <span className="text-sm font-black" style={{ color: r.rank <= 3 ? "#f59e0b" : "var(--text-primary)" }}>{r.score}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Leaderboard;
