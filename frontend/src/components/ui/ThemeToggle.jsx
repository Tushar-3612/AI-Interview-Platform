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
      className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full glass-card text-sm font-medium cursor-pointer"
      style={{ color: "var(--text-secondary)" }}
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
          <Sun className="w-4 h-4" style={{ color: "var(--accent)" }} />
        ) : (
          <Moon className="w-4 h-4" style={{ color: "var(--primary)" }} />
        )}
      </motion.div>
      <span>{isDark ? "Dark" : "Light"}</span>
    </motion.button>
  );
}

export default ThemeToggle;
