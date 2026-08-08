import { useMemo } from "react";
import { motion } from "framer-motion";
import { Building2, Target, TrendingUp, Timer, Sparkles } from "lucide-react";
import useCachedApi from "../../hooks/useCachedApi";
import { ProgressBar, scoreColor } from "../../components/placement/ProgressRing";

function CompanyCard({ c, index, onSelect }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-3xl border p-5"
      style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0" style={{ background: c.color || "var(--primary)" }}>
            {c.companyName?.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>{c.companyName}</p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: scoreColor(c.readiness), background: "color-mix(in srgb, " + scoreColor(c.readiness) + " 10%, transparent)" }}>
              {c.label}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-black leading-none" style={{ color: scoreColor(c.readiness) }}>{c.readiness}%</p>
          <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>readiness</p>
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-[11px]">
          <span style={{ color: "var(--text-muted)" }}>Aptitude</span>
          <span className="font-bold" style={{ color: "var(--text-primary)" }}>{c.breakdown.aptitude}%</span>
        </div>
        <ProgressBar value={c.breakdown.aptitude} showLabel={false} height={6} />
        <div className="flex items-center justify-between text-[11px]">
          <span style={{ color: "var(--text-muted)" }}>Coding</span>
          <span className="font-bold" style={{ color: "var(--text-primary)" }}>{c.breakdown.coding}%</span>
        </div>
        <ProgressBar value={c.breakdown.coding} showLabel={false} height={6} color="var(--accent)" />
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className="rounded-xl p-2.5 text-center" style={{ background: "var(--bg-primary)" }}>
          <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>{c.questionsSolved}</p>
          <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>solved</p>
        </div>
        <div className="rounded-xl p-2.5 text-center" style={{ background: "var(--bg-primary)" }}>
          <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>{Math.round(c.averageTimeSec / 60)}m</p>
          <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>avg time</p>
        </div>
        <div className="rounded-xl p-2.5 text-center" style={{ background: "var(--bg-primary)" }}>
          <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>{c.breakdown.mock || "—"}</p>
          <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>mock OA</p>
        </div>
      </div>

      {c.weakTopics?.length > 0 && (
        <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Weak topics</p>
          <div className="flex flex-wrap gap-1.5">
            {c.weakTopics.map((t) => (
              <span key={t.topic} className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ color: "var(--error)", background: "color-mix(in srgb, var(--error) 8%, transparent)" }}>
                {t.topic} · {t.accuracy}%
              </span>
            ))}
          </div>
        </div>
      )}

      {c.lastAttempt && (
        <p className="text-[10px] mt-3" style={{ color: "var(--text-muted)" }}>
          Last practice: {c.lastAttempt.percentage}% · {new Date(c.lastAttempt.createdAt).toLocaleDateString()}
        </p>
      )}

      <button
        onClick={() => onSelect(c)}
        className="w-full mt-4 py-2.5 rounded-xl text-xs font-bold text-white btn-gradient cursor-pointer"
      >
        Practice for {c.companyName}
      </button>
    </motion.div>
  );
}

function CompanyAnalytics() {
  const { data, loading, error } = useCachedApi({ url: "/api/placement/company-analytics", key: "company-analytics", ttlMs: 60 * 1000 });

  const stats = useMemo(() => {
    const companies = data?.companies || [];
    if (companies.length === 0) return null;
    const withPractice = companies.filter((c) => c.questionsSolved > 0);
    const avg = withPractice.length ? withPractice.reduce((s, c) => s + c.readiness, 0) / withPractice.length : 0;
    const best = [...withPractice].sort((a, b) => b.readiness - a.readiness)[0] || null;
    return { total: companies.length, practiced: withPractice.length, avg: Math.round(avg), best };
  }, [data]);

  const handleSelect = (c) => {
    window.location.href = `/placement/mock-oa?company=${c.companyId}`;
  };

  const companies = [...(data?.companies || [])].sort((a, b) => b.readiness - a.readiness);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1400px] mx-auto w-full space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black" style={{ color: "var(--text-primary)" }}>Company Analytics</h1>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          How ready you are for each company — aptitude, coding, accuracy, speed and mock OA performance.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border p-5 text-sm text-center" style={{ borderColor: "var(--border)", color: "var(--error)" }}>
          Failed to load company analytics — please try again.
        </div>
      )}

      {loading && !data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-72 w-full rounded-3xl" />)}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border p-4 flex items-center gap-3" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-lg font-black leading-none" style={{ color: "var(--text-primary)" }}>{stats.total}</p>
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>companies tracked</p>
            </div>
          </div>
          <div className="rounded-2xl border p-4 flex items-center gap-3" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}>
              <Target className="w-5 h-5" />
            </div>
            <div>
              <p className="text-lg font-black leading-none" style={{ color: "var(--text-primary)" }}>{stats.practiced}</p>
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>companies practiced</p>
            </div>
          </div>
          <div className="rounded-2xl border p-4 flex items-center gap-3" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--success) 10%, transparent)", color: "var(--success)" }}>
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-lg font-black leading-none" style={{ color: "var(--text-primary)" }}>{stats.avg}%</p>
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>avg readiness</p>
            </div>
          </div>
          <div className="rounded-2xl border p-4 flex items-center gap-3" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, #f59e0b 10%, transparent)", color: "#f59e0b" }}>
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black truncate" style={{ color: "var(--text-primary)" }}>{stats.best?.companyName || "—"}</p>
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>most ready ({stats.best?.readiness}%)</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {companies.map((c, i) => (
          <CompanyCard key={c.companyId} c={c} index={i} onSelect={handleSelect} />
        ))}
      </div>

      {data && companies.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <Timer className="w-10 h-10 mx-auto" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>No companies found.</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Companies will appear here once an admin adds them.</p>
        </div>
      )}
    </div>
  );
}

export default CompanyAnalytics;
