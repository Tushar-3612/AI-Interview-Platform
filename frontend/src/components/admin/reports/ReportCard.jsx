import { motion } from "framer-motion";

export default function ReportCard({ icon: Icon, label, value, subtext, color, onClick }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="p-5 rounded-2xl border cursor-pointer transition-all"
      style={{
        background: "var(--card-bg)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: color ? `${color}20` : "var(--admin-hover)" }}
        >
          {Icon && <Icon className="w-5 h-5" style={{ color: color || "var(--primary)" }} />}
        </div>
      </div>
      <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
        {value ?? "-"}
      </p>
      {subtext && (
        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
          {subtext}
        </p>
      )}
    </motion.div>
  );
}
