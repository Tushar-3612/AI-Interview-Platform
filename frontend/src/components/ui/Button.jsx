import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

/**
 * Premium gradient button with ripple effect and loading state.
 */
function Button({
  children,
  type = "button",
  onClick,
  loading = false,
  disabled = false,
  variant = "gradient",
  fullWidth = true,
  className = "",
}) {
  const [ripples, setRipples] = useState([]);

  const handleClick = (e) => {
    if (disabled || loading) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const id = Date.now();

    setRipples((prev) => [...prev, { id, x, y, size }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 600);

    onClick?.(e);
  };

  const baseClasses =
    "relative inline-flex items-center justify-center gap-2 font-medium text-sm rounded-2xl transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer overflow-hidden";

  const widthClass = fullWidth ? "w-full" : "";

  const variants = {
    gradient: "btn-gradient text-white py-3.5 px-6 shadow-lg hover:shadow-xl",
    outline:
      "py-3.5 px-6 border hover:opacity-90",
    ghost: "py-3.5 px-6 hover:opacity-80",
  };

  const variantStyle =
    variant === "outline"
      ? { borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--input-bg)" }
      : variant === "ghost"
        ? { color: "var(--primary)" }
        : {};

  return (
    <motion.button
      type={type}
      onClick={handleClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${widthClass} ${variants[variant]} ${className}`}
      style={variantStyle}
      whileHover={!disabled && !loading ? { scale: 1.01 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
    >
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
          }}
        />
      ))}

      {loading && <Loader2 className="w-4 h-4 animate-spin relative z-10" />}
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </motion.button>
  );
}

export default Button;
