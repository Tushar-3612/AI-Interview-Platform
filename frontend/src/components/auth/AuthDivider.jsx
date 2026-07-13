/**
 * Auth form divider with optional label.
 */
function AuthDivider({ label = "or" }) {
  return (
    <div className="relative my-7">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t" style={{ borderColor: "var(--border)" }} />
      </div>
      <div className="relative flex justify-center">
        <span
          className="px-4 text-xs font-medium uppercase tracking-wider"
          style={{
            background: "var(--card-bg)",
            color: "var(--text-secondary)",
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

export default AuthDivider;
