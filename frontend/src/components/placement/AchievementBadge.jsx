import { motion } from "framer-motion";

const MEDAL_COLORS = {
  unlocked: "var(--primary)",
  locked: "var(--border)",
};

/**
 * Achievement badge — unlocked badges are vibrant, locked ones are dimmed.
 */
export default function AchievementBadge({ achievement, unlocked = false, delay = 0 }) {
  const color = unlocked ? MEDAL_COLORS.unlocked : MEDAL_COLORS.locked;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.25 }}
      whileHover={{ y: -3 }}
      className="relative flex flex-col items-center gap-2 rounded-2xl p-4 border text-center"
      style={{
        borderColor: unlocked ? "color-mix(in srgb, var(--primary) 30%, var(--border))" : "var(--border)",
        background: unlocked ? "color-mix(in srgb, var(--primary) 6%, var(--card-bg))" : "var(--card-bg)",
        filter: unlocked ? "none" : "grayscale(1) opacity(0.55)",
      }}
      title={unlocked ? `${achievement.title} — unlocked` : achievement.title}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
        style={{
          background: unlocked ? "color-mix(in srgb, var(--primary) 15%, transparent)" : "var(--border)",
          border: `2px solid ${color}`,
        }}
      >
        {achievement.icon}
      </div>
      <div className="min-h-[2.5rem]">
        <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{achievement.title}</p>
        <p className="text-[10px] mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>{achievement.description}</p>
      </div>
      {unlocked && (
        <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ color: "var(--primary)", background: "color-mix(in srgb, var(--primary) 10%, transparent)" }}>
          Unlocked
        </span>
      )}
      {!unlocked && (
        <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ color: "var(--text-muted)", background: "var(--border)" }}>
          Locked
        </span>
      )}
    </motion.div>
  );
}
