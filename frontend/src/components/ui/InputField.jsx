import { Eye, EyeOff, ChevronDown } from "lucide-react";
import { useState } from "react";

/**
 * Premium input field with icon support, password toggle, dropdown chevron, and error states.
 */
function InputField({
  label,
  type = "text",
  name,
  value,
  onChange,
  placeholder,
  error,
  required = false,
  autoComplete,
  as = "input",
  options = [],
  icon: Icon,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && showPassword ? "text" : type;

  const baseClasses =
    "w-full py-2.5 px-3.5 rounded-xl border text-sm outline-none transition-all duration-200 focus:ring-2";

  const inputStyle = {
    background: "var(--input-bg)",
    borderColor: error ? "var(--error)" : "var(--border)",
    color: "var(--text-primary)",
    paddingLeft: Icon ? "38px" : "14px",
    paddingRight: isPassword || as === "select" ? "38px" : "14px",
  };

  const focusRing = error
    ? "focus:border-[var(--error)] focus:ring-[var(--error)]/20"
    : "focus:border-[var(--primary)] focus:ring-[var(--primary)]/20";

  return (
    <div className="mb-2.5">
      {label && (
        <label
          htmlFor={name}
          className="block text-xs font-semibold mb-1 tracking-wide text-[var(--text-primary)]"
        >
          {label}
          {required && <span className="ml-1 text-[var(--primary)]">*</span>}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <Icon
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-[var(--text-muted)]"
          />
        )}

        {as === "select" ? (
          <>
            <select
              id={name}
              name={name}
              value={value}
              onChange={onChange}
              className={`${baseClasses} ${focusRing} appearance-none cursor-pointer text-sm`}
              style={inputStyle}
            >
              <option value="" disabled className="bg-[var(--card-bg)] text-[var(--text-muted)]">
                {placeholder || "Select an option"}
              </option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[var(--card-bg)] text-[var(--text-primary)]">
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-[var(--text-muted)]"
            />
          </>
        ) : (
          <input
            id={name}
            type={inputType}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            autoComplete={autoComplete}
            className={`${baseClasses} ${focusRing} placeholder:text-[var(--text-muted)] placeholder:text-xs sm:placeholder:text-sm`}
            style={inputStyle}
          />
        )}

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-1 text-[11px] font-medium" style={{ color: "var(--error)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

export default InputField;
