import { useMemo } from "react";
import { motion } from "framer-motion";
import { BrainCircuit, Code2, Bookmark, Timer, CheckCircle2, XCircle, SkipForward } from "lucide-react";
import useCachedApi from "../../hooks/useCachedApi";
import { BarChart } from "../../components/placement/Charts";
import { scoreColor } from "../../components/placement/ProgressRing";

function StatCard({ icon, color, value, label, sub }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-black leading-none" style={{ color: "var(--text-primary)" }}>{value}</p>
          <p className="text-[10px] mt-1 truncate" style={{ color: "var(--text-muted)" }}>{label}</p>
        </div>
      </div>
      {sub && <p className="text-[10px] mt-2 font-semibold" style={{ color: "var(--text-secondary)" }}>{sub}</p>}
    </div>
  );
}

function QuestionAnalytics() {
  const { data, loading, error } = useCachedApi({ url: "/api/placement/question-analytics", key: "question-analytics", ttlMs: 60 * 1000 });

  const apt = data?.aptitude || {};
  const cod = data?.coding || {};

  const stats = useMemo(() => {
    const accuracy = apt.answered > 0 ? Math.round((apt.correct / apt.answered) * 100) : 0;
    return { accuracy };
  }, [apt]);

  const diffData = (apt.byDifficulty || []).map((d) => ({
    label: d.difficulty,
    value: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0,
  }));

  const statusData = (cod.byStatus || []).map((s) => ({
    label: s._id,
    value: s.n,
  }));

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1400px] mx-auto w-full space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black" style={{ color: "var(--text-primary)" }}>Question Analytics</h1>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Deep dive into how you perform across aptitude categories and coding problems.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border p-5 text-sm text-center" style={{ borderColor: "var(--border)", color: "var(--error)" }}>
          Failed to load question analytics — please try again.
        </div>
      )}

      {loading && !data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-28 w-full rounded-2xl" />)}
          <div className="skeleton h-64 w-full lg:col-span-2 rounded-3xl" />
          <div className="skeleton h-64 w-full lg:col-span-2 rounded-3xl" />
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<BrainCircuit className="w-5 h-5" />} color="var(--primary)" value={apt.attempted || 0} label="aptitude answered" sub={`${apt.attempts || 0} attempts`} />
            <StatCard icon={<CheckCircle2 className="w-5 h-5" />} color="var(--success)" value={`${stats.accuracy}%`} label="aptitude accuracy" sub={`${apt.correct || 0} correct · ${apt.wrong || 0} wrong`} />
            <StatCard icon={<Bookmark className="w-5 h-5" />} color="#f59e0b" value={apt.bookmarked || 0} label="bookmarked questions" />
            <StatCard icon={<Code2 className="w-5 h-5" />} color="var(--accent)" value={cod.total || 0} label="coding submissions" sub={`${cod.accepted || 0} accepted`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border p-5"
              style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}
            >
              <p className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>Aptitude accuracy by difficulty</p>
              <p className="text-[10px] mb-4" style={{ color: "var(--text-muted)" }}>% correct out of total attempted per difficulty</p>
              {diffData.length > 0 ? (
                <BarChart data={diffData} height={190} colorValue={(d) => scoreColor(d.value)} />
              ) : (
                <div className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>No aptitude attempts yet.</div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-3xl border p-5"
              style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}
            >
              <p className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>Coding submission status</p>
              <p className="text-[10px] mb-4" style={{ color: "var(--text-muted)" }}>accepted vs failed vs compile/run errors</p>
              {statusData.length > 0 ? (
                <div className="space-y-3 pt-2">
                  {statusData.map((s) => (
                    <div key={s.label} className="flex items-center justify-between text-xs">
                      <span className="font-semibold capitalize" style={{ color: "var(--text-secondary)" }}>{s.label}</span>
                      <span className="font-black" style={{ color: s.label === "accepted" ? "var(--success)" : s.label === "failed" ? "var(--error)" : "#f59e0b" }}>{s.value}</span>
                    </div>
                  ))}
                  <div className="pt-3 border-t space-y-2.5" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--text-secondary)" }}><CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--success)" }} /> Acceptance rate</span>
                      <span className="font-black" style={{ color: "var(--success)" }}>{cod.total > 0 ? Math.round((cod.accepted / cod.total) * 100) : 0}%</span>
                    </div>
                    {cod.averageTimeMs > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--text-secondary)" }}><Timer className="w-3.5 h-3.5" /> Avg time per submission</span>
                        <span className="font-bold" style={{ color: "var(--text-primary)" }}>{Math.round(cod.averageTimeMs / 1000)}s</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>No coding submissions yet.</div>
              )}
            </motion.div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--success)" }} /> Correct
              </p>
              <p className="text-xl font-black" style={{ color: "var(--success)" }}>{apt.correct || 0}</p>
            </div>
            <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                <XCircle className="w-3.5 h-3.5" style={{ color: "var(--error)" }} /> Wrong
              </p>
              <p className="text-xl font-black" style={{ color: "var(--error)" }}>{apt.wrong || 0}</p>
            </div>
            <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                <SkipForward className="w-3.5 h-3.5" /> Skipped
              </p>
              <p className="text-xl font-black" style={{ color: "#f59e0b" }}>{apt.skipped || 0}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default QuestionAnalytics;
