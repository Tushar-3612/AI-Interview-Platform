import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Award, Lock, CheckCircle2, ArrowLeft, X } from "lucide-react";
import useCachedApi from "../../hooks/useCachedApi";

const ACTION_MAP = {
  "first-step": { label: "Start Aptitude", link: "/placement-dashboard" },
  "apt-10": { label: "Practice Aptitude", link: "/placement/question-analytics" },
  "apt-100": { label: "Practice Aptitude", link: "/placement/question-analytics" },
  "first-code": { label: "Solve Problems", link: "/placement/question-analytics" },
  "code-50": { label: "Solve Problems", link: "/placement/question-analytics" },
  "streak-7": { label: "View Streak", link: "/placement-dashboard" },
  "streak-30": { label: "View Streak", link: "/placement-dashboard" },
  "perfect": { label: "Take a Test", link: "/placement/mock-oa" },
  "fast-solver": { label: "Take a Test", link: "/placement/mock-oa" },
  "consistency-master": { label: "View Heatmap", link: "/placement-dashboard" },
  "explorer": { label: "Explore Companies", link: "/interview-practice" },
  "curator": { label: "View Bookmarks", link: "/practice/bookmarks" },
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unlocked", label: "Unlocked" },
  { key: "locked", label: "Locked" },
];

function AchievementDetail({ achievement, unlocked, onClose, navigate }) {
  const action = unlocked ? ACTION_MAP[achievement.key] : null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-sm rounded-2xl border p-6 relative"
        style={{
          background: "var(--card-bg)",
          borderColor: unlocked ? "#EF6905" : "var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg cursor-pointer"
          style={{ color: "var(--text-muted)" }}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-5">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-3"
            style={{
              background: unlocked ? "rgba(239, 105, 5, 0.1)" : "var(--border)",
              border: `2px solid ${unlocked ? "#EF6905" : "var(--border)"}`,
            }}
          >
            {achievement.icon}
          </div>
          <h3
            className="text-lg font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {achievement.title}
          </h3>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {achievement.description}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-5">
          {unlocked ? (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
              style={{
                background: "rgba(239, 105, 5, 0.1)",
                color: "#EF6905",
              }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Unlocked
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
              style={{
                background: "var(--border)",
                color: "var(--text-muted)",
              }}
            >
              <Lock className="w-3.5 h-3.5" /> Locked
            </span>
          )}
        </div>

        {unlocked && achievement.unlockedAt && (
          <p
            className="text-center text-xs mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            Unlocked{" "}
            {new Date(achievement.unlockedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        )}

        {action && (
          <button
            onClick={() => {
              onClose();
              navigate(action.link);
            }}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer transition hover:opacity-90"
            style={{ background: "#EF6905" }}
          >
            {action.label}
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}

function Achievements() {
  const navigate = useNavigate();
  const { data, loading } = useCachedApi({
    url: "/api/placement/overview",
    key: "placement:overview",
    ttlMs: 60 * 1000,
  });

  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const achievements = data?.achievements;
  const allAchievements = [
    ...(achievements?.unlocked || []),
    ...(achievements?.locked || []),
  ];

  const filtered = allAchievements.filter((a) => {
    if (filter === "unlocked") return achievements?.unlocked?.some((u) => u.key === a.key);
    if (filter === "locked") return !achievements?.unlocked?.some((u) => u.key === a.key);
    return true;
  });

  const unlockedCount = achievements?.unlocked?.length || 0;
  const lockedCount = achievements?.locked?.length || 0;
  const totalCount = unlockedCount + lockedCount;

  const handleSelect = useCallback((a) => {
    const isUnlocked = achievements?.unlocked?.some((u) => u.key === a.key);
    const full = isUnlocked
      ? achievements.unlocked.find((u) => u.key === a.key)
      : a;
    setSelected({ ...full, unlocked: isUnlocked });
  }, [achievements]);

  if (loading && !data) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="space-y-6">
          <div className="skeleton h-8 w-48 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="skeleton h-40 rounded-2xl"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div>
          <button
            onClick={() => navigate("/placement-dashboard")}
            className="flex items-center gap-1.5 text-xs font-semibold mb-3 cursor-pointer"
            style={{ color: "#EF6905" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </button>
          <h1
            className="text-2xl sm:text-3xl font-bold mb-1"
            style={{ color: "var(--text-primary)" }}
          >
            Achievements
          </h1>
          <p
            className="text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            Track your placement preparation milestones and unlock new badges.
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div
            className="p-4 rounded-2xl border text-center"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--border)",
            }}
          >
            <p
              className="text-2xl font-black"
              style={{ color: "#EF6905" }}
            >
              {unlockedCount}
            </p>
            <p
              className="text-[10px] font-semibold mt-0.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Unlocked
            </p>
          </div>
          <div
            className="p-4 rounded-2xl border text-center"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--border)",
            }}
          >
            <p
              className="text-2xl font-black"
              style={{ color: "var(--text-muted)" }}
            >
              {lockedCount}
            </p>
            <p
              className="text-[10px] font-semibold mt-0.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Remaining
            </p>
          </div>
          <div
            className="p-4 rounded-2xl border text-center"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--border)",
            }}
          >
            <p
              className="text-2xl font-black"
              style={{ color: "var(--text-primary)" }}
            >
              {totalCount}
            </p>
            <p
              className="text-[10px] font-semibold mt-0.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Total
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition"
              style={{
                background:
                  filter === f.key ? "#EF6905" : "var(--card-bg)",
                color:
                  filter === f.key ? "#fff" : "var(--text-secondary)",
                border: `1px solid ${filter === f.key ? "#EF6905" : "var(--border)"}`,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((a, i) => {
            const isUnlocked = achievements?.unlocked?.some(
              (u) => u.key === a.key
            );
            return (
              <motion.div
                key={a.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => handleSelect(a)}
                className="p-5 rounded-2xl border cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
                style={{
                  background: isUnlocked
                    ? "rgba(239, 105, 5, 0.04)"
                    : "var(--card-bg)",
                  borderColor: isUnlocked
                    ? "rgba(239, 105, 5, 0.2)"
                    : "var(--border)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div className="text-center">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mx-auto mb-3"
                    style={{
                      background: isUnlocked
                        ? "rgba(239, 105, 5, 0.1)"
                        : "var(--border)",
                      border: `2px solid ${isUnlocked ? "#EF6905" : "var(--border)"}`,
                    }}
                  >
                    {a.icon}
                  </div>
                  <h3
                    className="font-bold text-sm"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {a.title}
                  </h3>
                  <p
                    className="text-[11px] mt-1 leading-snug"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {a.description}
                  </p>
                  <div className="mt-3">
                    {isUnlocked ? (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: "rgba(239, 105, 5, 0.1)",
                          color: "#EF6905",
                        }}
                      >
                        <CheckCircle2 className="w-3 h-3" /> Unlocked
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: "var(--border)",
                          color: "var(--text-muted)",
                        }}
                      >
                        <Lock className="w-3 h-3" /> Locked
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div
            className="text-center py-12 rounded-2xl border"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--border)",
            }}
          >
            <Award
              className="w-10 h-10 mx-auto mb-3"
              style={{ color: "var(--text-muted)" }}
            />
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--text-secondary)" }}
            >
              No achievements in this category yet.
            </p>
          </div>
        )}
      </motion.div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selected && (
          <AchievementDetail
            achievement={selected}
            unlocked={selected.unlocked}
            onClose={() => setSelected(null)}
            navigate={navigate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default Achievements;
