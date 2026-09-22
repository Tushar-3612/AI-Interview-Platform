import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";

/**
 * Theme toggle — top-right corner light/dark switch.
 */
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <motion.button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="fixed top-5 right-6 z-50 flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[var(--border)] bg-[var(--card-bg)] shadow-xs text-xs font-medium cursor-pointer text-[var(--text-primary)] hover:opacity-90 transition-all"
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <motion.div
        key={theme}
        initial={{ rotate: -90, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {isDark ? (
          <Moon className="w-3.5 h-3.5 text-blue-400" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-[var(--primary)]" />
        )}
      </motion.div>
      <span className="text-xs font-medium text-[var(--text-primary)]">{isDark ? "Dark" : "Light"}</span>
    </motion.button>
  );
}

export default ThemeToggle;
