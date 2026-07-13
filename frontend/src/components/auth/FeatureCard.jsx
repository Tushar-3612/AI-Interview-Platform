import { motion } from "framer-motion";
import {
  FileText,
  Mic,
  Brain,
  Code2,
  BarChart3,
  Check,
} from "lucide-react";

const ICON_MAP = {
  FileText,
  Mic,
  Brain,
  Code2,
  BarChart3,
};

/**
 * Animated feature card for the auth landing panel.
 */
function FeatureCard({ label, icon, index }) {
  const Icon = ICON_MAP[icon] || Check;

  return (
    <motion.div
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium"
      style={{
        background: "var(--feature-bg)",
        border: "1px solid var(--border)",
        color: "var(--text-primary)",
      }}
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      whileHover={{ scale: 1.02, x: 4 }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: "var(--orb-1)" }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
      </div>
      <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--success)" }} />
      <span>{label}</span>
    </motion.div>
  );
}

export default FeatureCard;
