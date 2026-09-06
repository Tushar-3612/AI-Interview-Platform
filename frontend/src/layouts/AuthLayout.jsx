import { Link } from "react-router-dom";
import { motion } from "framer-motion";
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
          className="w-full lg:w-[45%] xl:w-[40%] h-full min-h-0 min-w-0 flex flex-col justify-start items-center p-4 sm:p-5 md:p-6 lg:p-8 xl:p-10 overflow-x-hidden overflow-y-auto bg-[var(--bg-primary)]"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
        >
          <div className="w-full max-w-[400px] my-auto flex flex-col justify-center">
            {/* Minimal Brand Header */}
            <div className="flex flex-col items-center text-center mb-4 sm:mb-5">
              <Link to="/" aria-label="PrepHire" className="inline-flex items-center justify-center focus:outline-none">
                <img
                  src="/images/metadata.png"
                  alt="PrepHire"
                  className="h-30 sm:h-34 w-auto object-contain"
                  draggable="false"
                />
              </Link>
              <p className="text-xs text-[var(--text-secondary)] -mt-8 max-w-[280px]">
                Practice smarter.
                <br />
                Prepare confidently for placements.
              </p>
            </div>

            {/* Clean Form Card */}
            <motion.div
              className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-5 md:p-6 shadow-[var(--shadow-card)] relative overflow-hidden"
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
