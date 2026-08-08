import { motion } from "framer-motion";

/**
 * Brand logo mark — N-style orange gradient mark matching the reference image.
 */
function Logo({ size = "md", iconOnly = false }) {
  const sizes = {
    sm: { container: "w-9 h-9", text: "text-base" },
    md: { container: "w-10 h-10", text: "text-lg" },
    lg: { container: "w-12 h-12", text: "text-xl" },
  };

  const s = sizes[size] || sizes.md;

  return (
    <div className="flex items-center gap-2.5">
      <motion.div
        className={`${s.container} rounded-xl flex items-center justify-center cursor-pointer shadow-sm`}
        style={{
          background: "linear-gradient(135deg, #FF6B35 0%, #FF8A3D 100%)",
          boxShadow: "0 4px 14px rgba(255, 107, 53, 0.3)"
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        {/* N-Style Geometric Icon matching reference image logo */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 18V6L18 18V6" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.div>
      {!iconOnly && (
        <span
          className={`${s.text} font-extrabold tracking-tight`}
          style={{ color: "var(--text-primary)" }}
        >
          Interview Platform
        </span>
      )}
    </div>
  );
}

export default Logo;
