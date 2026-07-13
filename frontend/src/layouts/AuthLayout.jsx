import { motion } from "framer-motion";
import { Briefcase } from "lucide-react";
import PremiumIllustration from "../components/auth/PremiumIllustration";
import ThemeToggle from "../components/ui/ThemeToggle";

/**
 * Split-screen auth layout — 60% illustration / 40% form.
 * Premium Placement SaaS design with minimal card and clean viewport constraints.
 */
function AuthLayout({ children, title, subtitle }) {
  return (
    <div
      className="h-screen w-screen overflow-hidden relative select-none bg-[var(--bg-primary)]"
      style={{
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <ThemeToggle />

      <div className="h-full w-full flex flex-col lg:flex-row overflow-hidden">
        {/* ================= LEFT PANEL — 60% Illustration Collage ================= */}
        <motion.div
          className="hidden lg:flex lg:w-[55%] xl:w-[60%] h-full flex-col justify-center items-center p-8 bg-[var(--bg-gradient-start)] border-r border-[var(--border)] overflow-hidden relative"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <PremiumIllustration />
        </motion.div>

        {/* ================= RIGHT PANEL — 40% Clean Auth Card ================= */}
        <motion.div
          className="w-full lg:w-[45%] xl:w-[40%] h-full flex flex-col justify-center items-center p-5 sm:p-8 md:p-10 overflow-y-auto lg:overflow-hidden bg-[var(--bg-primary)]"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
        >
          <div className="w-full max-w-[400px] flex flex-col justify-center">
            {/* Minimal Brand Header */}
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-9 h-9 rounded-xl bg-[var(--primary)] flex items-center justify-center shadow-sm mb-3">
                <Briefcase className="w-4.5 h-4.5 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                Interview Platform
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-1.5 max-w-[280px]">
                Practice smarter.
                <br />
                Prepare confidently for placements.
              </p>
            </div>

            {/* Clean Form Card */}
            <motion.div
              className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5 sm:p-6 shadow-[var(--shadow-card)] relative overflow-hidden"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              {title && (
                <h2 className="text-base font-bold text-center mb-4 text-[var(--text-primary)] tracking-tight">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-xs text-center mb-4 -mt-2 text-[var(--text-secondary)]">
                  {subtitle}
                </p>
              )}
              {children}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default AuthLayout;
