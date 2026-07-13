import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

/**
 * Premium input field with icon support, password toggle, and error states.
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
    "w-full py-3 rounded-xl border text-sm outline-none transition-all duration-200 focus:ring-2";

  const inputStyle = {
    background: "var(--input-bg)",
    borderColor: error ? "var(--error)" : "var(--border)",
    color: "var(--text-primary)",
    paddingLeft: Icon ? "44px" : "16px",
    paddingRight: isPassword ? "44px" : "16px",
  };

  const focusRing = error
    ? "focus:border-[var(--error)] focus:ring-[var(--error)]/20"
    : "focus:border-[var(--primary)] focus:ring-[var(--primary)]/15";

  return (
    <div className="mb-3">
      {label && (
        <label
          htmlFor={name}
          className="block text-sm font-medium mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          {label}
          {required && <span style={{ color: "var(--error)" }} className="ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <Icon
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] pointer-events-none"
            style={{ color: "var(--text-secondary)" }}
          />
        )}

        {as === "select" ? (
          <select
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            className={`${baseClasses} ${focusRing} appearance-none cursor-pointer`}
            style={{ ...inputStyle, paddingLeft: "16px" }}
          >
            <option value="" disabled>
              {placeholder || "Select an option"}
            </option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={name}
            type={inputType}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            autoComplete={autoComplete}
            className={`${baseClasses} ${focusRing} placeholder:opacity-50`}
            style={inputStyle}
          />
        )}

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer"
            style={{ color: "var(--text-secondary)" }}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="w-[18px] h-[18px]" />
            ) : (
              <Eye className="w-[18px] h-[18px]" />
            )}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-1.5 text-xs" style={{ color: "var(--error)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

export default InputField;
