import { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  Flame,
  Trophy,
  Target,
  Lightbulb,
  Calendar,
  Medal,
  TrendingUp,
  ArrowUpRight,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Code2,
  BrainCircuit,
  Sparkles,
  ListChecks,
  Timer,
  Award,
} from "lucide-react";
import useCachedApi from "../../hooks/useCachedApi";
import { ProgressBar, scoreColor } from "../../components/placement/ProgressRing";
import Heatmap from "../../components/placement/Heatmap";
import { DonutChart, LineChart } from "../../components/placement/Charts";

const TYPE_META = {
  aptitude: { icon: BrainCircuit, color: "var(--primary)" },
  coding: { icon: Code2, color: "var(--accent)" },
  mock: { icon: Timer, color: "var(--success)" },
  interview: { icon: Medal, color: "var(--success)" },
  onboarding: { icon: Sparkles, color: "var(--primary)" },
};

function SectionCard({ title, subtitle, icon: Icon, action, children, className = "" }) {
  return (
    <section className={`bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-5 sm:p-6 shadow-[var(--shadow-sm)] ${className}`}>
      <div className="flex items-start justify-between mb-5 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--primary) 8%, transparent)", color: "var(--primary)" }}>
              <Icon className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-base font-bold truncate" style={{ color: "var(--text-primary)" }}>{title}</h3>
            {subtitle && <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ReadinessHero({ scores, prediction, profile }) {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      {/* Overall readiness */}
      <section className="hero-premium rounded-3xl p-6 lg:col-span-1 flex flex-col items-center justify-center text-center">
        <div className="hero-premium-grid" />
        <div className="relative z-10 flex flex-col items-center">
          <DonutChart value={scores.overall} size={170} stroke={14} color={scoreColor(scores.overall)} label="Overall" sublabel={scores.label} />
          <p className="mt-4 text-lg font-black" style={{ color: "var(--text-primary)" }}>
            {scores.label}
          </p>
          <p className="text-xs mt-1 max-w-[220px]" style={{ color: "var(--text-muted)" }}>
            {profile?.name?.split(" ")[0] || "Student"}, here is your placement readiness snapshot.
          </p>
        </div>
      </section>

      {/* Component scores */}
      <section className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 lg:col-span-1 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Score Breakdown</h3>
          <TrendingUp className="w-4 h-4" style={{ color: "var(--primary)" }} />
        </div>
        {[
          { label: "Coding", value: scores.coding },
          { label: "Aptitude", value: scores.aptitude },
          { label: "Problem Solving", value: scores.problemSolving },
          { label: "Consistency", value: scores.consistency },
          { label: "Mock Interview", value: scores.mockInterview },
          { label: "Resume", value: scores.resume, hint: scores.resume === 0 ? "Upload resume to unlock" : "" },
        ].map((s) => (
          <div key={s.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{s.label}</span>
              {s.hint && <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{s.hint}</span>}
            </div>
            <ProgressBar value={s.value} />
          </div>
        ))}
      </section>

      {/* Placement prediction */}
      <section className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 lg:col-span-1 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Placement Prediction</h3>
        </div>
        <div className="flex items-center gap-4 mb-4">
          <DonutChart value={prediction.chance} size={104} stroke={10} color={scoreColor(prediction.chance)} />
          <div>
            <p className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>Estimated Placement Chance</p>
            <p className="text-lg font-black" style={{ color: scoreColor(prediction.chance) }}>
              {prediction.chance}% <span className="text-xs font-bold">{prediction.status}</span>
            </p>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
              Based on coding, aptitude, consistency, accuracy & time
            </p>
          </div>
        </div>
        <div className="space-y-3 flex-1">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--success)" }}>
              Likely Companies
            </p>
            <div className="flex flex-wrap gap-1.5">
              {prediction.likelyCompanies?.length > 0 ? prediction.likelyCompanies.map((c) => (
                <button key={c.companyId} onClick={() => navigate(`/interview-practice/${c.companyId}`)} className="px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition hover:opacity-80" style={{ color: "var(--success)", background: "color-mix(in srgb, var(--success) 10%, transparent)" }}>
                  {c.companyName}
                </button>
              )) : <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Practice more to unlock</span>}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--error)" }}>
              Needs Improvement Before
            </p>
            <div className="flex flex-wrap gap-1.5">
              {prediction.needsImprovement?.length > 0 ? prediction.needsImprovement.map((c) => (
                <span key={c.companyId} className="px-2.5 py-1 rounded-lg text-[10px] font-bold" style={{ color: "var(--error)", background: "color-mix(in srgb, var(--error) 8%, transparent)" }}>
                  {c.companyName}
                </span>
              )) : <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>No companies flagged</span>}
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate("/placement/mock-oa")}
          className="mt-4 w-full py-2.5 rounded-xl text-xs font-bold text-white btn-gradient cursor-pointer"
        >
          Take a Mock OA Now
        </button>
      </section>
    </div>
  );
}

function DailyGoals({ goals }) {
  if (!goals) return null;
  return (
    <SectionCard title="Today's Goal" subtitle={goals.date} icon={Target}
      action={<span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ color: goals.completed === goals.total ? "var(--success)" : "var(--primary)", background: goals.completed === goals.total ? "color-mix(in srgb, var(--success) 10%, transparent)" : "color-mix(in srgb, var(--primary) 10%, transparent)" }}>
        {goals.completed}/{goals.total} completed
      </span>}>
      <div className="space-y-3">
        {goals.goals.map((g) => (
          <div key={g.key} className="flex items-center gap-3">
            {g.done ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "var(--success)" }} />
            ) : (
              <div className="w-5 h-5 rounded-full border-2 shrink-0" style={{ borderColor: "var(--border)" }} />
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold" style={{ color: g.done ? "var(--text-muted)" : "var(--text-primary)" }}>{g.label}</span>
                <span className="text-[10px] font-bold" style={{ color: "var(--text-secondary)" }}>
                  {Math.min(g.progress, g.target)}/{g.target}
                </span>
              </div>
              <ProgressBar value={(g.progress / g.target) * 100} color={g.done ? "var(--success)" : "var(--primary)"} showLabel={false} height={6} />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function StreakCard({ streak }) {
  const getIntensityColor = (count) => {
    if (count === 0) return "var(--border)";
    if (count === 1) return "#86EFAC";
    if (count === 2) return "#4ADE80";
    if (count === 3) return "#22C55E";
    return "#16A34A";
  };

  return (
    <SectionCard title="Practice Streak" subtitle="Daily consistency tracking" icon={Flame}>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-2xl p-4 text-center" style={{ background: "rgba(34, 197, 94, 0.1)" }}>
          <p className="text-2xl font-black" style={{ color: "#22C55E" }}>🔥 {streak.current}</p>
          <p className="text-[10px] font-semibold mt-1" style={{ color: "var(--text-secondary)" }}>Day Streak</p>
        </div>
        <div className="rounded-2xl p-4 text-center" style={{ background: "color-mix(in srgb, var(--primary) 8%, transparent)" }}>
          <p className="text-2xl font-black" style={{ color: "var(--primary)" }}>{streak.best}</p>
          <p className="text-[10px] font-semibold mt-1" style={{ color: "var(--text-secondary)" }}>Best Streak</p>
        </div>
        <div className="rounded-2xl p-4 text-center" style={{ background: "color-mix(in srgb, var(--error) 8%, transparent)" }}>
          <p className="text-2xl font-black" style={{ color: "var(--error)" }}>{streak.missedDays?.length || 0}</p>
          <p className="text-[10px] font-semibold mt-1" style={{ color: "var(--text-secondary)" }}>Missed Days (30d)</p>
        </div>
      </div>

      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Weekly Progress</p>
      <div className="flex items-end gap-2 h-16 mb-5">
        {streak.weekly?.map((d) => (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[9px] font-bold" style={{ color: d.count > 0 ? "#22C55E" : "var(--text-muted)" }}>{d.count}</span>
            <div className="w-full rounded-t-md" style={{ height: `${Math.max(d.count * 20, 4)}px`, background: d.count > 0 ? getIntensityColor(d.count) : "var(--border)" }} />
            <span className="text-[8px]" style={{ color: "var(--text-muted)" }}>{d.label}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Monthly Activity</p>
      <LineChart
        data={streak.monthly?.map((m) => ({ label: new Date(`${m.date}T00:00:00`).getDate(), value: m.count })) || []}
        height={90}
        color="#22C55E"
        showDots={false}
      />
    </SectionCard>
  );
}

function AIRecommendationsCard({ recommendations, weakTopics }) {
  const [isOpen, setIsOpen] = useState(false);
  const hasData = (recommendations && recommendations.length > 0) || (weakTopics && weakTopics.length > 0);

  if (!hasData && !isOpen) return null;

  return (
    <section className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl shadow-[var(--shadow-sm)] overflow-hidden">
      {/* Collapsed state - clickable header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-5 sm:p-6 text-left cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--primary) 8%, transparent)", color: "var(--primary)" }}>
              <Lightbulb className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>AI Recommendations</h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Personalized suggestions based on your performance</p>
            </div>
          </div>
          <motion.div
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
          </motion.div>
        </div>
      </button>

      {/* Expanded detail panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="px-5 sm:px-6 pb-5 sm:pb-6 border-t" style={{ borderColor: "var(--border)" }}>
              <div className="pt-4">
                <p className="text-xs font-semibold mb-4" style={{ color: "var(--text-secondary)" }}>
                  Based on your recent performance
                </p>

                {/* Weak Topics */}
                {weakTopics && weakTopics.length > 0 && (
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-4 h-4" style={{ color: "var(--error)" }} />
                      <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Weak Areas</p>
                    </div>
                    <div className="space-y-2">
                      {weakTopics.map((t) => (
                        <div key={t.kind + t.topic} className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: "color-mix(in srgb, var(--error) 25%, var(--border))", background: "color-mix(in srgb, var(--error) 5%, transparent)" }}>
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "var(--error)" }} />
                            <div>
                              <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{t.topic}</p>
                              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{t.kind === "aptitude" ? "Aptitude" : "Coding"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "color-mix(in srgb, var(--error) 12%, transparent)", color: "var(--error)" }}>
                              {t.accuracy}%
                            </span>
                            <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>accuracy</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {recommendations && recommendations.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="w-4 h-4" style={{ color: "#EF6905" }} />
                      <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Recommendations</p>
                    </div>
                    <div className="space-y-2">
                      {recommendations.map((rec, i) => {
                        const meta = TYPE_META[rec.type] || TYPE_META.onboarding;
                        const Icon = meta.icon;
                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="flex items-start gap-3 p-3 rounded-xl border" style={{ borderColor: "var(--border)" }}
                          >
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${meta.color} 10%, transparent)`, color: meta.color }}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{rec.title}</p>
                              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{rec.detail}</p>
                            </div>
                            {rec.link && (
                              <a href={rec.link} className="shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer hover:opacity-80" style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 10%, transparent)` }}>
                                {rec.action || "Go"}
                              </a>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(!recommendations || recommendations.length === 0) && (!weakTopics || weakTopics.length === 0) && (
                  <p className="text-sm py-4 text-center" style={{ color: "var(--text-muted)" }}>
                    Complete a practice attempt to get personalized recommendations.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function QuickLinks() {
  const navigate = useNavigate();
  const links = [
    { label: "Leaderboard", icon: Trophy, path: "/placement/leaderboard", desc: "Compare with peers" },
    { label: "Mock OA", icon: Timer, path: "/placement/mock-oa", desc: "Real exam experience" },
    { label: "Achievements", icon: Award, path: "/placement/achievements", desc: "Track milestones" },
    { label: "Question Analytics", icon: ListChecks, path: "/placement/question-analytics", desc: "Solve / skip / bookmark" },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {links.map((l) => {
        const Icon = l.icon;
        return (
          <button
            key={l.path}
            onClick={() => navigate(l.path)}
            className="group bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-4 text-left cursor-pointer hover:border-[var(--primary)]/40 hover:-translate-y-0.5 transition-all duration-300"
          >
            <Icon className="w-5 h-5 mb-3" style={{ color: "var(--primary)" }} />
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{l.label}</p>
            <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
              {l.desc} <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
          </button>
        );
      })}
    </div>
  );
}

function PlacementSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 space-y-4">
            <div className="skeleton w-28 h-28 rounded-full mx-auto" />
            <div className="skeleton h-4 w-2/3 mx-auto rounded" />
            <div className="skeleton h-3 w-1/2 mx-auto rounded" />
            <div className="space-y-2.5">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="skeleton h-2.5 w-full rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1].map((i) => (
          <div key={i} className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-6 space-y-3">
            <div className="skeleton h-5 w-40 rounded" />
            <div className="skeleton h-3 w-56 rounded" />
            {[0, 1, 2, 3].map((j) => (
              <div key={j} className="skeleton h-10 w-full rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlacementDashboard() {
  const { profile } = useOutletContext();
  const { data, loading, error, refetch } = useCachedApi({ url: "/api/placement/overview", key: "placement:overview", ttlMs: 60 * 1000 });

  useEffect(() => {
    if (data?.achievements?.newlyUnlocked?.length > 0) {
      const names = data.achievements.newlyUnlocked.map((a) => a.title).join(", ");
      toast.success(`Achievement unlocked: ${names}!`);
    }
  }, [data?.achievements?.newlyUnlocked]);

  if (loading && !data) return <PlacementSkeleton />;

  if (error && !data) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 mx-auto" style={{ color: "var(--error)" }} />
        <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Could not load placement dashboard</p>
        <button onClick={() => refetch()} className="px-4 py-2 rounded-xl text-xs font-bold text-white btn-gradient cursor-pointer">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative" style={{ background: "var(--bg-primary)" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full blur-[180px] opacity-30" style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--primary) 18%, transparent) 0%, transparent 70%)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full blur-[180px] opacity-25" style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 15%, transparent) 0%, transparent 70%)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[200px] opacity-15" style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--primary) 10%, transparent) 0%, transparent 70%)" }} />
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `
            linear-gradient(var(--text-primary) 1px, transparent 1px),
            linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px'
        }} />
      </div>
      <div className="relative z-10 p-4 sm:p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black" style={{ color: "var(--text-primary)" }}>
            Placement Dashboard
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            AI-powered readiness, recommendations and progress tracking
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer hover:opacity-80 transition"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          Refresh Data
        </button>
      </div>

      <QuickLinks />

      <ReadinessHero scores={data.scores} prediction={data.prediction} profile={profile} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <DailyGoals goals={data.dailyGoals} />
        <StreakCard streak={data.streak} />
      </div>

      <AIRecommendationsCard recommendations={data.recommendations} weakTopics={data.weakTopics} />

      <SectionCard title="Daily Practice Heatmap" subtitle="Last 6 months of practice activity" icon={Calendar}>
        <Heatmap days={data.heatmap} />
      </SectionCard>
    </div>
    </div>
  );
}

export default PlacementDashboard;
