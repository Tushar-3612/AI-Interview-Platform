import { motion } from "framer-motion";
import { Briefcase } from "lucide-react";

/**
 * Brand logo - clean and minimal for a placement platform.
 */
function Logo({ size = "md" }) {
  const sizes = {
    sm: { container: "w-8 h-8", icon: "w-4.5 h-4.5", text: "text-base" },
    md: { container: "w-10 h-10", icon: "w-5 h-5", text: "text-lg" },
    lg: { container: "w-12 h-12", icon: "w-6 h-6", text: "text-xl" },
  };

  const s = sizes[size] || sizes.md;

  return (
    <div className="flex items-center gap-2.5">
      <motion.div
        className={`${s.container} rounded-xl flex items-center justify-center bg-[var(--primary)] shadow-sm`}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
      >
        <Briefcase className={`${s.icon} text-white`} />
      </motion.div>
      <span
        className={`${s.text} font-semibold`}
        style={{ color: "var(--text-primary)" }}
      >
        Interview Platform
      </span>
    </div>
  );
}

export default Logo;
